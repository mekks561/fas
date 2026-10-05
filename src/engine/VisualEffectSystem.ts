import * as pc from 'playcanvas';

/**
 * 后处理（post-processing）系统：bloom + 暗角 + 色差 + 色彩校正。
 *
 * ## 为什么这个文件在 PlayCanvas 2.x 上曾经整条不可用
 *
 * 这份实现最初是按 PlayCanvas 1.x 的 API 写的，迁移到 2.23 后三处都变了形，
 * 结果是构造函数第一句就抛异常，GameScene 里的 try/catch 把它咽掉，
 * 整套后处理（953 行）从未在渲染路径上生效过：
 *
 * 1. `PostEffectQueue` 的构造签名是 `(app, camera)`。原代码强转成单参数的
 *    `(device)` 只传了 graphicsDevice → 队列的 `camera` 是 undefined，
 *    基类构造里 `camera.on('set:rect', ...)` 立刻抛 TypeError。
 * 2. `CameraComponent.postEffects` 是**只读 getter**（相机在构造时就自建了队列），
 *    原代码 `cam.postEffects = queue` 在严格模式下同样抛 TypeError。
 *    → 正确做法是直接复用相机自带的队列，不要自建。
 * 3. `PostEffect` 在 2.x 里退化成占位基类：构造函数只接收 graphicsDevice，
 *    不再接受 shader，也没有 `init()` / `setUniform()`。自定义效果必须
 *    继承 PostEffect 覆写 `render()`，在里面把 uniform 写进 `device.scope`，
 *    再调用基类 `drawQuad()` 画全屏四边形。
 *
 * ## 一个必须知道的坑
 *
 * uniform 一定要在 `drawQuad()` **之前**绑定。未绑定的 sampler 会被引擎悄悄
 * 回落到 `builtInTextures.pink`（画面糊成粉色）——不报错，只是颜色全错。
 */

// Shared GLSL vertex shader used by all post effects (WebGL2 fallback).
const GLSL_VERTEX = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main(void) {
      gl_Position = vec4(aPosition, 0.0, 1.0);
      vUv = (aPosition + 1.0) * 0.5;
  }
`;

// Shared WGSL vertex shader used by all post effects (WebGPU).
const WGSL_VERTEX = `
  @vertex
  fn mainVertex(@location(0) aPosition: vec2<f32>) -> @builtin(position) vec4<f32> {
      return vec4<f32>(aPosition, 0.0, 1.0);
  }
`;

export interface VisualEffectConfig {
  bloomEnabled: boolean;
  bloomThreshold: number;
  bloomStrength: number;

  vignetteEnabled: boolean;
  vignetteIntensity: number;
  vignetteRadius: number;
  vignetteColor: pc.Color;

  chromaticAberrationEnabled: boolean;
  chromaticAberrationAmount: number;

  colorCorrectionEnabled: boolean;
  colorCorrectionSaturation: number;
  colorCorrectionContrast: number;
  colorCorrectionExposure: number;
}

/** 创建一张用于后处理中间结果的纹理缓冲（线性过滤 + CLAMP，避免边缘渗色）。 */
function createEffectTarget(
  device: pc.GraphicsDevice,
  name: string,
  width: number,
  height: number,
): pc.RenderTarget {
  const colorBuffer = new pc.Texture(device, {
    name,
    width,
    height,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: pc.FILTER_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  return new pc.RenderTarget({ name, colorBuffer, depth: false });
}

/** 释放一个中间缓冲（颜色纹理需要单独 destroy）。 */
function destroyEffectTarget(rt: pc.RenderTarget | null): void {
  if (!rt) return;
  rt.colorBuffer.destroy();
  rt.destroy();
}

/**
 * 单遍后处理效果：把 inputTarget 的颜色缓冲绑到 `uColorBuffer`，写入登记过的
 * uniform，然后把全屏四边形画到 outputTarget。
 */
class ShaderPostEffect extends pc.PostEffect {
  protected readonly shader: pc.Shader;
  protected readonly uniforms = new Map<string, unknown>();
  /** 是否自动把 inputTarget 的颜色缓冲绑到 uColorBuffer（多遍效果自行控制）。 */
  protected bindColorBuffer = true;

  constructor(device: pc.GraphicsDevice, shader: pc.Shader) {
    super(device);
    this.shader = shader;
  }

  /** 登记一个 uniform，实际写入发生在 render() 里（scope 是全局的，必须每帧刷）。 */
  public setUniform(name: string, value: unknown): void {
    this.uniforms.set(name, value);
  }

  /** 读取一个数值型 uniform（带回落值），供子类在 render 里使用。 */
  protected num(name: string, fallback: number): number {
    const value = this.uniforms.get(name);
    return typeof value === 'number' ? value : fallback;
  }

  protected bindColorBufferTexture(buffer: pc.Texture): void {
    this.device.scope.resolve('uColorBuffer').setValue(buffer);
  }

  protected commitUniforms(): void {
    const scope = this.device.scope;
    for (const [name, value] of this.uniforms) {
      scope.resolve(name).setValue(value);
    }
  }

  public override render(
    inputTarget: pc.RenderTarget,
    outputTarget: pc.RenderTarget,
    rect?: pc.Vec4,
  ): void {
    if (this.bindColorBuffer) {
      this.bindColorBufferTexture(inputTarget.colorBuffer);
    }
    this.commitUniforms();
    this.drawQuad(outputTarget, this.shader, rect);
  }
}

/**
 * 三遍 bloom：亮部提取 → 可分离高斯模糊（横一遍、竖一遍）→ 加回原图。
 *
 * 中间缓冲是**惰性**创建的：按输入缓冲的一半分辨率建两张 ping-pong 纹理，
 * 输入尺寸变化（窗口缩放）时自动重建。不放在构造函数里是因为构造时还不
 * 知道渲染分辨率（相机 rect 可能尚未生效）。
 */
class BloomPostEffect extends ShaderPostEffect {
  private readonly brightShader: pc.Shader;
  private readonly blurShader: pc.Shader;
  private readonly compositeShader: pc.Shader;

  private rt1: pc.RenderTarget | null = null;
  private rt2: pc.RenderTarget | null = null;
  private rtWidth = 0;
  private rtHeight = 0;

  constructor(
    device: pc.GraphicsDevice,
    shaders: { bright: pc.Shader; blur: pc.Shader; composite: pc.Shader },
  ) {
    super(device, shaders.composite);
    this.brightShader = shaders.bright;
    this.blurShader = shaders.blur;
    this.compositeShader = shaders.composite;
    this.bindColorBuffer = false; // 四个 pass 各自按需绑定，见 render()
  }

  private ensureTargets(width: number, height: number): void {
    if (this.rt1 && this.rt2 && this.rtWidth === width && this.rtHeight === height) return;
    this.destroyTargets();
    this.rt1 = createEffectTarget(this.device, 'bloomRT1', width, height);
    this.rt2 = createEffectTarget(this.device, 'bloomRT2', width, height);
    this.rtWidth = width;
    this.rtHeight = height;
  }

  private destroyTargets(): void {
    destroyEffectTarget(this.rt1);
    destroyEffectTarget(this.rt2);
    this.rt1 = null;
    this.rt2 = null;
    this.rtWidth = 0;
    this.rtHeight = 0;
  }

  public override render(
    inputTarget: pc.RenderTarget,
    outputTarget: pc.RenderTarget,
    rect?: pc.Vec4,
  ): void {
    const width = Math.max(1, Math.floor(inputTarget.colorBuffer.width / 2));
    const height = Math.max(1, Math.floor(inputTarget.colorBuffer.height / 2));
    this.ensureTargets(width, height);
    const rt1 = this.rt1;
    const rt2 = this.rt2;
    if (!rt1 || !rt2) return;

    const scope = this.device.scope;
    const threshold = this.num('uThreshold', 0.8);
    const strength = this.num('uStrength', 0.4);

    // 1) 亮部提取：inputTarget → rt1
    scope.resolve('uColorBuffer').setValue(inputTarget.colorBuffer);
    scope.resolve('uThreshold').setValue(threshold);
    this.drawQuad(rt1, this.brightShader);

    // 2) 横向高斯模糊：rt1 → rt2
    scope.resolve('uColorBuffer').setValue(rt1.colorBuffer);
    scope.resolve('uDirection').setValue([1, 0]);
    scope.resolve('uResolution').setValue([width, height]);
    this.drawQuad(rt2, this.blurShader);

    // 3) 纵向高斯模糊：rt2 → rt1
    scope.resolve('uColorBuffer').setValue(rt2.colorBuffer);
    scope.resolve('uDirection').setValue([0, 1]);
    this.drawQuad(rt1, this.blurShader);

    // 4) 合成：原图 + 模糊亮部 → outputTarget
    scope.resolve('uColorBuffer').setValue(inputTarget.colorBuffer);
    scope.resolve('uBlurBuffer').setValue(rt1.colorBuffer);
    scope.resolve('uStrength').setValue(strength);
    this.drawQuad(outputTarget, this.compositeShader, rect);
  }

  /** 释放中间缓冲（效果被移除或系统销毁时调用）。 */
  public destroyTargetsAndShaders(): void {
    this.destroyTargets();
  }
}

export class VisualEffectSystem {
  private readonly app: pc.Application;

  /** 相机自带的队列（2.x 里由 CameraComponent 自行创建，不可替换）。 */
  private readonly queue: pc.PostEffectQueue;

  private config: VisualEffectConfig;

  private bloomEffect: BloomPostEffect | null = null;
  private vignetteEffect: ShaderPostEffect | null = null;
  private chromaticAberrationEffect: ShaderPostEffect | null = null;
  private colorCorrectionEffect: ShaderPostEffect | null = null;

  private bloomBrightShader: pc.Shader | null = null;
  private bloomBlurShader: pc.Shader | null = null;
  private bloomCompositeShader: pc.Shader | null = null;
  private vignetteShader: pc.Shader | null = null;
  private chromaticAberrationShader: pc.Shader | null = null;
  private colorCorrectionShader: pc.Shader | null = null;

  private disposed = false;

  constructor(app: pc.Application, camera: pc.Entity) {
    this.app = app;

    const cameraComponent = camera.camera;
    if (!cameraComponent) {
      throw new Error('[VisualEffectSystem] camera entity has no CameraComponent');
    }
    // 复用相机自带的队列：postEffects 只有 getter，赋值会抛 TypeError。
    this.queue = cameraComponent.postEffects;

    this.config = {
      bloomEnabled: true,
      bloomThreshold: 0.8,
      bloomStrength: 0.4,

      vignetteEnabled: true,
      vignetteIntensity: 0.6,
      vignetteRadius: 0.5,
      vignetteColor: new pc.Color(0, 0, 0),

      chromaticAberrationEnabled: false,
      chromaticAberrationAmount: 3.0,

      colorCorrectionEnabled: true,
      colorCorrectionSaturation: 1.2,
      colorCorrectionContrast: 1.1,
      colorCorrectionExposure: 1.0,
    };

    this.initializeShaders();
    this.initializePostEffects();
  }

  private get isWebGPU(): boolean {
    return this.app.graphicsDevice.deviceType === pc.DEVICETYPE_WEBGPU;
  }

  private get shaderLanguage(): string {
    return this.isWebGPU ? pc.SHADERLANGUAGE_WGSL : pc.SHADERLANGUAGE_GLSL;
  }

  /**
   * 用当前设备匹配的语言创建一个 Shader。GLSL（WebGL2）与 WGSL（WebGPU）
   * 两份源码都必须提供。
   */
  private createShader(
    name: string,
    glslVert: string,
    glslFrag: string,
    wgslVert: string,
    wgslFrag: string,
  ): pc.Shader {
    const isWGSL = this.isWebGPU;
    return new pc.Shader(this.app.graphicsDevice, {
      name,
      shaderLanguage: this.shaderLanguage,
      attributes: { aPosition: pc.SEMANTIC_POSITION },
      vshader: isWGSL ? wgslVert : glslVert,
      fshader: isWGSL ? wgslFrag : glslFrag,
    });
  }

  private initializeShaders(): void {
    // ---- Bloom: 亮部提取 ----
    this.bloomBrightShader = this.createShader(
      'bloomBright',
      GLSL_VERTEX,
      `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uColorBuffer;
        uniform float uThreshold;

        void main(void) {
            vec4 color = texture2D(uColorBuffer, vUv);
            float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            if (brightness > uThreshold) {
                gl_FragColor = vec4(color.rgb * (brightness - uThreshold), 1.0);
            } else {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            }
        }
      `,
      WGSL_VERTEX,
      `
        @group(0) @binding(0) var uColorBuffer: texture_2d<f32>;
        @group(0) @binding(1) var uColorBufferSampler: sampler;
        uniform uThreshold: f32;

        @fragment
        fn mainFragment(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            let dim = textureDimensions(uColorBuffer);
            let uv = fragCoord.xy / vec2<f32>(f32(dim.x), f32(dim.y));
            let color = textureSample(uColorBuffer, uColorBufferSampler, uv);
            let brightness = dot(color.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
            if (brightness > uThreshold) {
                return vec4<f32>(color.rgb * (brightness - uThreshold), 1.0);
            }
            return vec4<f32>(0.0, 0.0, 0.0, 1.0);
        }
      `,
    );

    // ---- Bloom: 可分离高斯模糊（9 tap，方向由 uDirection 决定） ----
    this.bloomBlurShader = this.createShader(
      'bloomBlur',
      GLSL_VERTEX,
      `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uColorBuffer;
        uniform vec2 uDirection;
        uniform vec2 uResolution;

        void main(void) {
            vec2 texel = 1.0 / uResolution;
            vec2 step = uDirection * texel * 2.0;
            vec4 sum = vec4(0.0);
            sum += texture2D(uColorBuffer, vUv + step * -4.0) * 0.0625;
            sum += texture2D(uColorBuffer, vUv + step * -3.0) * 0.09375;
            sum += texture2D(uColorBuffer, vUv + step * -2.0) * 0.125;
            sum += texture2D(uColorBuffer, vUv + step * -1.0) * 0.15625;
            sum += texture2D(uColorBuffer, vUv) * 0.1875;
            sum += texture2D(uColorBuffer, vUv + step * 1.0) * 0.15625;
            sum += texture2D(uColorBuffer, vUv + step * 2.0) * 0.125;
            sum += texture2D(uColorBuffer, vUv + step * 3.0) * 0.09375;
            sum += texture2D(uColorBuffer, vUv + step * 4.0) * 0.0625;
            gl_FragColor = sum;
        }
      `,
      WGSL_VERTEX,
      `
        @group(0) @binding(0) var uColorBuffer: texture_2d<f32>;
        @group(0) @binding(1) var uColorBufferSampler: sampler;
        uniform uDirection: vec2<f32>;
        uniform uResolution: vec2<f32>;

        @fragment
        fn mainFragment(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            let uv = fragCoord.xy / uResolution;
            let texel = 1.0 / uResolution;

            var sum = vec4<f32>(0.0);
            let weights = array<f32, 9>(0.0625, 0.09375, 0.125, 0.15625, 0.1875, 0.15625, 0.125, 0.09375, 0.0625);
            for (var i = -4; i <= 4; i = i + 1) {
                let offset = uDirection * texel * f32(i) * 2.0;
                sum = sum + textureSample(uColorBuffer, uColorBufferSampler, uv + offset) * weights[i + 4];
            }
            return sum;
        }
      `,
    );

    // ---- Bloom: 合成（原图 + 模糊亮部） ----
    this.bloomCompositeShader = this.createShader(
      'bloomComposite',
      GLSL_VERTEX,
      `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uColorBuffer;
        uniform sampler2D uBlurBuffer;
        uniform float uStrength;

        void main(void) {
            vec4 color = texture2D(uColorBuffer, vUv);
            vec4 blur = texture2D(uBlurBuffer, vUv);
            gl_FragColor = vec4(color.rgb + blur.rgb * uStrength, color.a);
        }
      `,
      WGSL_VERTEX,
      `
        @group(0) @binding(0) var uColorBuffer: texture_2d<f32>;
        @group(0) @binding(1) var uColorBufferSampler: sampler;
        @group(0) @binding(2) var uBlurBuffer: texture_2d<f32>;
        @group(0) @binding(3) var uBlurBufferSampler: sampler;
        uniform uStrength: f32;

        @fragment
        fn mainFragment(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            let dim = textureDimensions(uColorBuffer);
            let uv = fragCoord.xy / vec2<f32>(f32(dim.x), f32(dim.y));
            let color = textureSample(uColorBuffer, uColorBufferSampler, uv);
            let blur = textureSample(uBlurBuffer, uBlurBufferSampler, uv);
            return vec4<f32>(color.rgb + blur.rgb * uStrength, color.a);
        }
      `,
    );

    // ---- 暗角 ----
    this.vignetteShader = this.createShader(
      'vignette',
      GLSL_VERTEX,
      `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uColorBuffer;
        uniform float uIntensity;
        uniform float uRadius;
        uniform vec3 uColor;

        void main(void) {
            vec4 color = texture2D(uColorBuffer, vUv);

            vec2 center = vec2(0.5, 0.5);
            float dist = distance(vUv, center);
            float vignette = smoothstep(uRadius, 0.0, dist);
            vignette = 1.0 - (1.0 - vignette) * uIntensity;

            color.rgb = mix(color.rgb, color.rgb * vec3(vignette) + uColor * (1.0 - vignette), uIntensity);

            gl_FragColor = color;
        }
      `,
      WGSL_VERTEX,
      `
        @group(0) @binding(0) var uColorBuffer: texture_2d<f32>;
        @group(0) @binding(1) var uColorBufferSampler: sampler;
        uniform uIntensity: f32;
        uniform uRadius: f32;
        uniform uColor: vec3<f32>;

        @fragment
        fn mainFragment(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            let dim = textureDimensions(uColorBuffer);
            let uv = fragCoord.xy / vec2<f32>(f32(dim.x), f32(dim.y));
            let color = textureSample(uColorBuffer, uColorBufferSampler, uv);
            let center = vec2<f32>(0.5, 0.5);
            let dist = distance(uv, center);
            var vignette = smoothstep(uRadius, 0.0, dist);
            vignette = 1.0 - (1.0 - vignette) * uIntensity;
            let outRgb = mix(color.rgb, color.rgb * vec3<f32>(vignette) + uColor * (1.0 - vignette), uIntensity);
            return vec4<f32>(outRgb, color.a);
        }
      `,
    );

    // ---- 色差 ----
    this.chromaticAberrationShader = this.createShader(
      'chromaticAberration',
      GLSL_VERTEX,
      `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uColorBuffer;
        uniform float uAmount;

        void main(void) {
            vec2 center = vec2(0.5, 0.5);
            vec2 dist = (vUv - center) * uAmount * 0.01;

            float r = texture2D(uColorBuffer, vUv + dist).r;
            float g = texture2D(uColorBuffer, vUv).g;
            float b = texture2D(uColorBuffer, vUv - dist).b;

            gl_FragColor = vec4(r, g, b, 1.0);
        }
      `,
      WGSL_VERTEX,
      `
        @group(0) @binding(0) var uColorBuffer: texture_2d<f32>;
        @group(0) @binding(1) var uColorBufferSampler: sampler;
        uniform uAmount: f32;

        @fragment
        fn mainFragment(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            let dim = textureDimensions(uColorBuffer);
            let uv = fragCoord.xy / vec2<f32>(f32(dim.x), f32(dim.y));
            let center = vec2<f32>(0.5, 0.5);
            let dist = (uv - center) * uAmount * 0.01;
            let r = textureSample(uColorBuffer, uColorBufferSampler, uv + dist).r;
            let g = textureSample(uColorBuffer, uColorBufferSampler, uv).g;
            let b = textureSample(uColorBuffer, uColorBufferSampler, uv - dist).b;
            return vec4<f32>(r, g, b, 1.0);
        }
      `,
    );

    // ---- 色彩校正（饱和度 / 对比度 / 曝光） ----
    this.colorCorrectionShader = this.createShader(
      'colorCorrection',
      GLSL_VERTEX,
      `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uColorBuffer;
        uniform float uSaturation;
        uniform float uContrast;
        uniform float uExposure;

        void main(void) {
            vec4 color = texture2D(uColorBuffer, vUv);

            float gray = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            color.rgb = mix(vec3(gray), color.rgb, uSaturation);

            color.rgb = ((color.rgb - 0.5) * uContrast + 0.5);

            color.rgb *= uExposure;

            gl_FragColor = color;
        }
      `,
      WGSL_VERTEX,
      `
        @group(0) @binding(0) var uColorBuffer: texture_2d<f32>;
        @group(0) @binding(1) var uColorBufferSampler: sampler;
        uniform uSaturation: f32;
        uniform uContrast: f32;
        uniform uExposure: f32;

        @fragment
        fn mainFragment(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            let dim = textureDimensions(uColorBuffer);
            let uv = fragCoord.xy / vec2<f32>(f32(dim.x), f32(dim.y));
            var color = textureSample(uColorBuffer, uColorBufferSampler, uv);
            let gray = dot(color.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
            color = vec4<f32>(mix(vec3<f32>(gray), color.rgb, uSaturation), color.a);
            color = vec4<f32>((color.rgb - vec3<f32>(0.5)) * uContrast + vec3<f32>(0.5), color.a);
            color = vec4<f32>(color.rgb * uExposure, color.a);
            return color;
        }
      `,
    );
  }

  private initializePostEffects(): void {
    // 顺序即渲染链：第一个进队的会成为「场景渲染目标」（带 MSAA + 深度），
    // 之后依次叠加。bloom 放最前是为了让它吃到多采样抗锯齿的目标。
    if (this.config.bloomEnabled) {
      this.enableBloom();
    }
    if (this.config.vignetteEnabled && this.vignetteShader) {
      this.vignetteEffect = new ShaderPostEffect(this.app.graphicsDevice, this.vignetteShader);
      this.queue.addEffect(this.vignetteEffect);
    }
    if (this.config.colorCorrectionEnabled && this.colorCorrectionShader) {
      this.colorCorrectionEffect = new ShaderPostEffect(
        this.app.graphicsDevice,
        this.colorCorrectionShader,
      );
      this.queue.addEffect(this.colorCorrectionEffect);
    }
    if (this.config.chromaticAberrationEnabled && this.chromaticAberrationShader) {
      this.chromaticAberrationEffect = new ShaderPostEffect(
        this.app.graphicsDevice,
        this.chromaticAberrationShader,
      );
      this.queue.addEffect(this.chromaticAberrationEffect);
    }

    this.updateEffects();
    console.log(
      `[VisualEffectSystem] Post effects initialized (${this.queue.effects.length} effects, enabled: ${this.queue.enabled})`,
    );
  }

  private updateEffects(): void {
    if (this.bloomEffect) {
      this.bloomEffect.setUniform('uThreshold', this.config.bloomThreshold);
      this.bloomEffect.setUniform('uStrength', this.config.bloomStrength);
    }

    if (this.vignetteEffect) {
      const c = this.config.vignetteColor;
      this.vignetteEffect.setUniform('uIntensity', this.config.vignetteIntensity);
      this.vignetteEffect.setUniform('uRadius', this.config.vignetteRadius);
      this.vignetteEffect.setUniform('uColor', [c.r, c.g, c.b]);
    }

    if (this.chromaticAberrationEffect) {
      this.chromaticAberrationEffect.setUniform('uAmount', this.config.chromaticAberrationAmount);
    }

    if (this.colorCorrectionEffect) {
      this.colorCorrectionEffect.setUniform('uSaturation', this.config.colorCorrectionSaturation);
      this.colorCorrectionEffect.setUniform('uContrast', this.config.colorCorrectionContrast);
      this.colorCorrectionEffect.setUniform('uExposure', this.config.colorCorrectionExposure);
    }
  }

  /** 后处理链是否真的在渲染（队列启用且至少有一个效果）。 */
  public isActive(): boolean {
    return this.queue.enabled && this.queue.effects.length > 0;
  }

  /** 已入队的效果数量，供验证脚本断言链路就绪。 */
  public getEffectCount(): number {
    return this.queue.effects.length;
  }

  public enableBloom(): void {
    if (
      !this.bloomEffect &&
      this.bloomBrightShader &&
      this.bloomBlurShader &&
      this.bloomCompositeShader
    ) {
      this.bloomEffect = new BloomPostEffect(this.app.graphicsDevice, {
        bright: this.bloomBrightShader,
        blur: this.bloomBlurShader,
        composite: this.bloomCompositeShader,
      });
      this.queue.addEffect(this.bloomEffect);
    }
    this.config.bloomEnabled = true;
    this.updateEffects();
  }

  public disableBloom(): void {
    if (this.bloomEffect) {
      this.queue.removeEffect(this.bloomEffect);
      this.bloomEffect.destroyTargetsAndShaders();
      this.bloomEffect = null;
    }
    this.config.bloomEnabled = false;
  }

  public enableVignette(): void {
    if (!this.vignetteEffect && this.vignetteShader) {
      this.vignetteEffect = new ShaderPostEffect(this.app.graphicsDevice, this.vignetteShader);
      this.queue.addEffect(this.vignetteEffect);
    }
    this.config.vignetteEnabled = true;
    this.updateEffects();
  }

  public disableVignette(): void {
    if (this.vignetteEffect) {
      this.queue.removeEffect(this.vignetteEffect);
      this.vignetteEffect = null;
    }
    this.config.vignetteEnabled = false;
  }

  public enableChromaticAberration(): void {
    if (!this.chromaticAberrationEffect && this.chromaticAberrationShader) {
      this.chromaticAberrationEffect = new ShaderPostEffect(
        this.app.graphicsDevice,
        this.chromaticAberrationShader,
      );
      this.queue.addEffect(this.chromaticAberrationEffect);
    }
    this.config.chromaticAberrationEnabled = true;
    this.updateEffects();
  }

  public disableChromaticAberration(): void {
    if (this.chromaticAberrationEffect) {
      this.queue.removeEffect(this.chromaticAberrationEffect);
      this.chromaticAberrationEffect = null;
    }
    this.config.chromaticAberrationEnabled = false;
  }

  public enableColorCorrection(): void {
    if (!this.colorCorrectionEffect && this.colorCorrectionShader) {
      this.colorCorrectionEffect = new ShaderPostEffect(
        this.app.graphicsDevice,
        this.colorCorrectionShader,
      );
      this.queue.addEffect(this.colorCorrectionEffect);
    }
    this.config.colorCorrectionEnabled = true;
    this.updateEffects();
  }

  public disableColorCorrection(): void {
    if (this.colorCorrectionEffect) {
      this.queue.removeEffect(this.colorCorrectionEffect);
      this.colorCorrectionEffect = null;
    }
    this.config.colorCorrectionEnabled = false;
  }

  public setBloomThreshold(value: number): void {
    this.config.bloomThreshold = value;
    this.updateEffects();
  }

  public setBloomStrength(value: number): void {
    this.config.bloomStrength = value;
    this.updateEffects();
  }

  public setVignetteIntensity(value: number): void {
    this.config.vignetteIntensity = value;
    this.updateEffects();
  }

  public setVignetteRadius(value: number): void {
    this.config.vignetteRadius = value;
    this.updateEffects();
  }

  public setChromaticAberrationAmount(value: number): void {
    this.config.chromaticAberrationAmount = value;
    this.updateEffects();
  }

  public setSaturation(value: number): void {
    this.config.colorCorrectionSaturation = value;
    this.updateEffects();
  }

  public setContrast(value: number): void {
    this.config.colorCorrectionContrast = value;
    this.updateEffects();
  }

  public setExposure(value: number): void {
    this.config.colorCorrectionExposure = value;
    this.updateEffects();
  }

  public applyPreset(preset: 'cinematic' | 'vibrant' | 'realistic' | 'retro'): void {
    switch (preset) {
      case 'cinematic':
        this.config.bloomThreshold = 0.7;
        this.config.bloomStrength = 0.5;
        this.config.vignetteIntensity = 0.8;
        this.config.vignetteRadius = 0.4;
        this.config.colorCorrectionContrast = 1.3;
        this.config.colorCorrectionExposure = 0.9;
        this.enableBloom();
        this.enableVignette();
        this.enableColorCorrection();
        break;

      case 'vibrant':
        this.config.bloomThreshold = 0.9;
        this.config.bloomStrength = 0.6;
        this.config.colorCorrectionSaturation = 1.5;
        this.config.colorCorrectionContrast = 1.4;
        this.config.colorCorrectionExposure = 1.2;
        this.enableBloom();
        this.enableColorCorrection();
        break;

      case 'realistic':
        this.config.bloomThreshold = 0.85;
        this.config.bloomStrength = 0.2;
        this.config.vignetteIntensity = 0.3;
        this.config.colorCorrectionContrast = 1.1;
        this.config.colorCorrectionExposure = 1.0;
        this.enableBloom();
        this.enableVignette();
        this.enableColorCorrection();
        break;

      case 'retro':
        this.config.bloomThreshold = 0.6;
        this.config.bloomStrength = 0.7;
        this.config.colorCorrectionContrast = 1.4;
        this.config.colorCorrectionExposure = 1.1;
        this.config.chromaticAberrationAmount = 5.0;
        this.enableBloom();
        this.enableColorCorrection();
        this.enableChromaticAberration();
        break;
    }

    this.updateEffects();
  }

  public updateConfig(config: Partial<VisualEffectConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.bloomEnabled !== undefined) {
      if (config.bloomEnabled) this.enableBloom();
      else this.disableBloom();
    }
    if (config.vignetteEnabled !== undefined) {
      if (config.vignetteEnabled) this.enableVignette();
      else this.disableVignette();
    }
    if (config.chromaticAberrationEnabled !== undefined) {
      if (config.chromaticAberrationEnabled) this.enableChromaticAberration();
      else this.disableChromaticAberration();
    }
    if (config.colorCorrectionEnabled !== undefined) {
      if (config.colorCorrectionEnabled) this.enableColorCorrection();
      else this.disableColorCorrection();
    }

    this.updateEffects();
  }

  public getConfig(): VisualEffectConfig {
    return { ...this.config };
  }

  /**
   * 摘掉自己加进相机队列的效果并把相机的渲染目标还原。
   *
   * 刻意**不**调用 queue.destroy()：那是相机自己的队列，且 disable() 会顺带
   * 还原 camera.renderTarget、清掉 onPostprocessing 回调，正是我们要的收尾。
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.disableBloom();
    this.disableVignette();
    this.disableChromaticAberration();
    this.disableColorCorrection();

    this.bloomBrightShader?.destroy();
    this.bloomBlurShader?.destroy();
    this.bloomCompositeShader?.destroy();
    this.vignetteShader?.destroy();
    this.chromaticAberrationShader?.destroy();
    this.colorCorrectionShader?.destroy();

    this.bloomBrightShader = null;
    this.bloomBlurShader = null;
    this.bloomCompositeShader = null;
    this.vignetteShader = null;
    this.chromaticAberrationShader = null;
    this.colorCorrectionShader = null;
  }
}
