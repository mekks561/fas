import * as pc from 'playcanvas';

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

/**
 * PlayCanvas' public PostEffect type only exposes render/drawQuad, but the
 * engine also supports a convenience constructor that accepts a shader along
 * with init()/setUniform() helpers. These are not part of the .d.ts, so we
 * extend the type with the members we rely on and cast at construction time.
 */
type PostEffectWithUniforms = pc.PostEffect & {
  pass?: number;
  init(): void;
  setUniform(name: string, value: number | number[] | Float32Array): void;
};

export interface VisualEffectConfig {
  bloomEnabled: boolean;
  bloomThreshold: number;
  bloomStrength: number;
  bloomBlur: number;

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

  fxaaEnabled: boolean;
}

export class VisualEffectSystem {
  private app: pc.Application;
  private camera: pc.Entity;
  private postEffectQueue: pc.PostEffectQueue | null = null;

  private config: VisualEffectConfig;

  private bloomEffect: PostEffectWithUniforms | null = null;
  private vignetteEffect: PostEffectWithUniforms | null = null;
  private chromaticAberrationEffect: PostEffectWithUniforms | null = null;
  private colorCorrectionEffect: PostEffectWithUniforms | null = null;
  private fxaaEffect: PostEffectWithUniforms | null = null;

  private bloomShader: pc.Shader | null = null;
  private vignetteShader: pc.Shader | null = null;
  private chromaticAberrationShader: pc.Shader | null = null;
  private colorCorrectionShader: pc.Shader | null = null;
  private fxaaShader: pc.Shader | null = null;

  // Multi-pass bloom resources.
  private bloomBrightShader: pc.Shader | null = null;
  private bloomBlurShader: pc.Shader | null = null;
  private bloomCompositeShader: pc.Shader | null = null;
  private bloomRenderTarget1: pc.RenderTarget | null = null;
  private bloomRenderTarget2: pc.RenderTarget | null = null;

  // SSAO is only available on WebGPU; on WebGL2 it remains a no-op stub.
  private ssaoEnabled = false;

  constructor(app: pc.Application, camera: pc.Entity) {
    this.app = app;
    this.camera = camera;

    this.config = {
      bloomEnabled: true,
      bloomThreshold: 0.8,
      bloomStrength: 0.4,
      bloomBlur: 4,

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

      fxaaEnabled: true
    };

    this.initializeShaders();
    this.initializePostEffects();
  }

  /** True when the active graphics device is a WebGPU device. */
  private get isWebGPU(): boolean {
    return this.app.graphicsDevice.deviceType === pc.DEVICETYPE_WEBGPU;
  }

  /** The shader language (WGSL or GLSL) that matches the active device. */
  private get shaderLanguage(): string {
    return this.isWebGPU ? pc.SHADERLANGUAGE_WGSL : pc.SHADERLANGUAGE_GLSL;
  }

  /**
   * Creates a Shader using the appropriate language for the active device.
   * Both GLSL (WebGL2 fallback) and WGSL (WebGPU) sources must be supplied.
   */
  private createShader(
    name: string,
    glslVert: string,
    glslFrag: string,
    wgslVert: string,
    wgslFrag: string
  ): pc.Shader {
    const isWGSL = this.isWebGPU;
    return new pc.Shader(this.app.graphicsDevice, {
      name,
      shaderLanguage: this.shaderLanguage,
      attributes: { aPosition: pc.SEMANTIC_POSITION },
      vshader: isWGSL ? wgslVert : glslVert,
      fshader: isWGSL ? wgslFrag : glslFrag
    });
  }

  /**
   * Wraps the non-standard PostEffect constructor (which accepts a shader) and
   * the init() helper that are not present in the public type definitions.
   */
  private createPostEffect(shader: pc.Shader, pass?: number): PostEffectWithUniforms {
    const ctor = pc.PostEffect as unknown as new (
      device: pc.GraphicsDevice,
      shader?: pc.Shader
    ) => PostEffectWithUniforms;
    const effect = new ctor(this.app.graphicsDevice, shader);
    if (pass !== undefined) {
      effect.pass = pass;
    }
    effect.init();
    return effect;
  }

  private initializeShaders(): void {
    // ---- Bloom (single-pass, used as the queued effect / WebGL2 fallback) ----
    this.bloomShader = this.createShader(
      'bloom',
      GLSL_VERTEX,
      `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uColorBuffer;
        uniform sampler2D uBlurBuffer;
        uniform float uThreshold;
        uniform float uStrength;

        void main(void) {
            vec4 color = texture2D(uColorBuffer, vUv);
            vec4 blur = texture2D(uBlurBuffer, vUv);

            float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            if (brightness > uThreshold) {
                color.rgb += blur.rgb * uStrength;
            }

            gl_FragColor = color;
        }
      `,
      WGSL_VERTEX,
      `
        @group(0) @binding(0) var uColorBuffer: texture_2d<f32>;
        @group(0) @binding(1) var uColorBufferSampler: sampler;
        @group(0) @binding(2) var uBlurBuffer: texture_2d<f32>;
        @group(0) @binding(3) var uBlurBufferSampler: sampler;
        uniform uThreshold: f32;
        uniform uStrength: f32;

        @fragment
        fn mainFragment(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            let dim = textureDimensions(uColorBuffer);
            let uv = fragCoord.xy / vec2<f32>(f32(dim.x), f32(dim.y));
            let color = textureSample(uColorBuffer, uColorBufferSampler, uv);
            let blur = textureSample(uBlurBuffer, uBlurBufferSampler, uv);
            let brightness = dot(color.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
            if (brightness > uThreshold) {
                return vec4<f32>(color.rgb + blur.rgb * uStrength, color.a);
            }
            return color;
        }
      `
    );

    // ---- Vignette ----
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
      `
    );

    // ---- Chromatic aberration ----
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
      `
    );

    // ---- Color correction ----
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
      `
    );

    // ---- FXAA ----
    this.fxaaShader = this.createShader(
      'fxaa',
      GLSL_VERTEX,
      `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uColorBuffer;
        uniform vec2 uResolution;

        vec4 fxaa(vec2 pos) {
            vec2 texel = 1.0 / uResolution;

            vec3 rgbNW = texture2D(uColorBuffer, pos + vec2(-1.0, -1.0) * texel).rgb;
            vec3 rgbNE = texture2D(uColorBuffer, pos + vec2(1.0, -1.0) * texel).rgb;
            vec3 rgbSW = texture2D(uColorBuffer, pos + vec2(-1.0, 1.0) * texel).rgb;
            vec3 rgbSE = texture2D(uColorBuffer, pos + vec2(1.0, 1.0) * texel).rgb;
            vec3 rgbM = texture2D(uColorBuffer, pos).rgb;

            vec3 luma = vec3(0.299, 0.587, 0.114);
            float lNW = dot(rgbNW, luma);
            float lNE = dot(rgbNE, luma);
            float lSW = dot(rgbSW, luma);
            float lSE = dot(rgbSE, luma);
            float lM = dot(rgbM, luma);

            float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
            float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));

            float dirX = ((((lNW + lNE) - (lSW + lSE)) * 0.25) + ((lNE + lSE) - (lNW + lSW)) * 0.25);
            float dirY = ((((lNW + lSW) - (lNE + lSE)) * 0.25) + ((lSW + lSE) - (lNW + lNE)) * 0.25);

            float dirReduce = max((lNW + lNE + lSW + lSE) * 0.025, 0.009);

            float rcpDirMin = 1.0 / (min(abs(dirX), abs(dirY)) + dirReduce);

            vec2 dir = vec2(dirX, dirY) * rcpDirMin;
            vec3 rgbA = 0.5 * (
                texture2D(uColorBuffer, pos + dir * (1.0 / 3.0 - 0.5) * texel).rgb +
                texture2D(uColorBuffer, pos + dir * (2.0 / 3.0 - 0.5) * texel).rgb
            );
            vec3 rgbB = rgbA * 0.5 + 0.25 * (
                texture2D(uColorBuffer, pos - dir * 0.5 * texel).rgb +
                texture2D(uColorBuffer, pos + dir * 0.5 * texel).rgb
            );

            float lB = dot(rgbB, luma);

            if ((lB < lMin) || (lB > lMax)) {
                return vec4(rgbA, 1.0);
            }

            return vec4(rgbB, 1.0);
        }

        void main(void) {
            gl_FragColor = fxaa(vUv);
        }
      `,
      WGSL_VERTEX,
      `
        @group(0) @binding(0) var uColorBuffer: texture_2d<f32>;
        @group(0) @binding(1) var uColorBufferSampler: sampler;
        uniform uResolution: vec2<f32>;

        @fragment
        fn mainFragment(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            let texel = 1.0 / uResolution;
            let pos = fragCoord.xy * texel;

            let rgbNW = textureSample(uColorBuffer, uColorBufferSampler, pos + vec2<f32>(-1.0, -1.0) * texel).rgb;
            let rgbNE = textureSample(uColorBuffer, uColorBufferSampler, pos + vec2<f32>(1.0, -1.0) * texel).rgb;
            let rgbSW = textureSample(uColorBuffer, uColorBufferSampler, pos + vec2<f32>(-1.0, 1.0) * texel).rgb;
            let rgbSE = textureSample(uColorBuffer, uColorBufferSampler, pos + vec2<f32>(1.0, 1.0) * texel).rgb;
            let rgbM = textureSample(uColorBuffer, uColorBufferSampler, pos).rgb;

            let luma = vec3<f32>(0.299, 0.587, 0.114);
            let lNW = dot(rgbNW, luma);
            let lNE = dot(rgbNE, luma);
            let lSW = dot(rgbSW, luma);
            let lSE = dot(rgbSE, luma);
            let lM = dot(rgbM, luma);

            let lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
            let lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));

            let dirX = ((((lNW + lNE) - (lSW + lSE)) * 0.25) + ((lNE + lSE) - (lNW + lSW)) * 0.25);
            let dirY = ((((lNW + lSW) - (lNE + lSE)) * 0.25) + ((lSW + lSE) - (lNW + lNE)) * 0.25);

            let dirReduce = max((lNW + lNE + lSW + lSE) * 0.025, 0.009);
            let rcpDirMin = 1.0 / (min(abs(dirX), abs(dirY)) + dirReduce);

            let dir = vec2<f32>(dirX, dirY) * rcpDirMin;
            let rgbA = 0.5 * (
                textureSample(uColorBuffer, uColorBufferSampler, pos + dir * (1.0 / 3.0 - 0.5) * texel).rgb +
                textureSample(uColorBuffer, uColorBufferSampler, pos + dir * (2.0 / 3.0 - 0.5) * texel).rgb
            );
            let rgbB = rgbA * 0.5 + 0.25 * (
                textureSample(uColorBuffer, uColorBufferSampler, pos - dir * 0.5 * texel).rgb +
                textureSample(uColorBuffer, uColorBufferSampler, pos + dir * 0.5 * texel).rgb
            );

            let lB = dot(rgbB, luma);

            if ((lB < lMin) || (lB > lMax)) {
                return vec4<f32>(rgbA, 1.0);
            }
            return vec4<f32>(rgbB, 1.0);
        }
      `
    );

    // Multi-pass bloom shaders + intermediate render targets.
    this.createMultiPassBloom();
  }

  /**
   * Builds the three-pass bloom pipeline:
   *   1. Bright pass  - extract pixels above the threshold.
   *   2. Blur pass    - separable Gaussian blur (ping-pong between two RTs).
   *   3. Composite    - add the blurred bright buffer back onto the original.
   * Both GLSL and WGSL sources are provided so the same code path works on
   * WebGL2 and WebGPU.
   */
  private createMultiPassBloom(): void {
    // ---- Bright pass ----
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
      `
    );

    // ---- Separable Gaussian blur ----
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

            // 9-tap Gaussian blur
            var sum = vec4<f32>(0.0);
            let weights = array<f32, 9>(0.0625, 0.09375, 0.125, 0.15625, 0.1875, 0.15625, 0.125, 0.09375, 0.0625);
            for (var i = -4; i <= 4; i = i + 1) {
                let offset = uDirection * texel * f32(i) * 2.0;
                sum = sum + textureSample(uColorBuffer, uColorBufferSampler, uv + offset) * weights[i + 4];
            }
            return sum;
        }
      `
    );

    // ---- Composite pass ----
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
      `
    );

    // Ping-pong render targets at half resolution for the blur passes.
    this.bloomRenderTarget1 = this.createBloomRenderTarget('bloomRT1');
    this.bloomRenderTarget2 = this.createBloomRenderTarget('bloomRT2');
  }

  /** Creates a half-resolution RGBA8 render target for intermediate bloom results. */
  private createBloomRenderTarget(name: string): pc.RenderTarget {
    const device = this.app.graphicsDevice;
    const width = Math.max(1, Math.floor(device.width / 2));
    const height = Math.max(1, Math.floor(device.height / 2));
    const colorBuffer = new pc.Texture(device, {
      name,
      width,
      height,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });
    return new pc.RenderTarget({
      name,
      colorBuffer,
      depth: false
    });
  }

  private initializePostEffects(): void {
    // PostEffectQueue's public constructor expects (app, camera); the legacy
    // single-argument form used here is preserved via a cast.
    const queueCtor = pc.PostEffectQueue as unknown as new (
      device: pc.GraphicsDevice
    ) => pc.PostEffectQueue;
    this.postEffectQueue = new queueCtor(this.app.graphicsDevice);

    if (this.config.fxaaEnabled && this.fxaaShader) {
      this.fxaaEffect = this.createPostEffect(this.fxaaShader);
      this.postEffectQueue.addEffect(this.fxaaEffect);
    }

    if (this.config.bloomEnabled && this.bloomShader) {
      this.bloomEffect = this.createPostEffect(this.bloomShader, 1);
      this.postEffectQueue.addEffect(this.bloomEffect);
    }

    if (this.config.vignetteEnabled && this.vignetteShader) {
      this.vignetteEffect = this.createPostEffect(this.vignetteShader);
      this.postEffectQueue.addEffect(this.vignetteEffect);
    }

    if (this.config.colorCorrectionEnabled && this.colorCorrectionShader) {
      this.colorCorrectionEffect = this.createPostEffect(this.colorCorrectionShader);
      this.postEffectQueue.addEffect(this.colorCorrectionEffect);
    }

    if (this.camera.camera) {
      // postEffects only exposes a getter, so assign through a cast.
      const cam = this.camera.camera as unknown as {
        postEffects: pc.PostEffectQueue | null;
      };
      cam.postEffects = this.postEffectQueue;
    }

    this.updateEffects();
  }

  private updateEffects(): void {
    if (this.bloomEffect) {
      this.bloomEffect.setUniform('uThreshold', this.config.bloomThreshold);
      this.bloomEffect.setUniform('uStrength', this.config.bloomStrength);
    }

    if (this.vignetteEffect) {
      this.vignetteEffect.setUniform('uIntensity', this.config.vignetteIntensity);
      this.vignetteEffect.setUniform('uRadius', this.config.vignetteRadius);
      this.vignetteEffect.setUniform('uColor', this.config.vignetteColor.data);
    }

    if (this.chromaticAberrationEffect) {
      this.chromaticAberrationEffect.setUniform(
        'uAmount',
        this.config.chromaticAberrationAmount
      );
    }

    if (this.colorCorrectionEffect) {
      this.colorCorrectionEffect.setUniform(
        'uSaturation',
        this.config.colorCorrectionSaturation
      );
      this.colorCorrectionEffect.setUniform(
        'uContrast',
        this.config.colorCorrectionContrast
      );
      this.colorCorrectionEffect.setUniform(
        'uExposure',
        this.config.colorCorrectionExposure
      );
    }
  }

  public enableBloom(): void {
    if (!this.bloomEffect && this.bloomShader) {
      this.bloomEffect = this.createPostEffect(this.bloomShader, 1);
      this.postEffectQueue?.addEffect(this.bloomEffect);
    }
    this.config.bloomEnabled = true;
    this.updateEffects();
  }

  public disableBloom(): void {
    if (this.bloomEffect) {
      this.postEffectQueue?.removeEffect(this.bloomEffect);
      this.bloomEffect = null;
    }
    this.config.bloomEnabled = false;
  }

  public enableVignette(): void {
    if (!this.vignetteEffect && this.vignetteShader) {
      this.vignetteEffect = this.createPostEffect(this.vignetteShader);
      this.postEffectQueue?.addEffect(this.vignetteEffect);
    }
    this.config.vignetteEnabled = true;
    this.updateEffects();
  }

  public disableVignette(): void {
    if (this.vignetteEffect) {
      this.postEffectQueue?.removeEffect(this.vignetteEffect);
      this.vignetteEffect = null;
    }
    this.config.vignetteEnabled = false;
  }

  public enableChromaticAberration(): void {
    if (!this.chromaticAberrationEffect && this.chromaticAberrationShader) {
      this.chromaticAberrationEffect = this.createPostEffect(
        this.chromaticAberrationShader
      );
      this.postEffectQueue?.addEffect(this.chromaticAberrationEffect);
    }
    this.config.chromaticAberrationEnabled = true;
    this.updateEffects();
  }

  public disableChromaticAberration(): void {
    if (this.chromaticAberrationEffect) {
      this.postEffectQueue?.removeEffect(this.chromaticAberrationEffect);
      this.chromaticAberrationEffect = null;
    }
    this.config.chromaticAberrationEnabled = false;
  }

  public enableColorCorrection(): void {
    if (!this.colorCorrectionEffect && this.colorCorrectionShader) {
      this.colorCorrectionEffect = this.createPostEffect(
        this.colorCorrectionShader
      );
      this.postEffectQueue?.addEffect(this.colorCorrectionEffect);
    }
    this.config.colorCorrectionEnabled = true;
    this.updateEffects();
  }

  public disableColorCorrection(): void {
    if (this.colorCorrectionEffect) {
      this.postEffectQueue?.removeEffect(this.colorCorrectionEffect);
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

  /**
   * Enables screen-space ambient occlusion. Only supported on WebGPU; on WebGL2
   * this is a no-op and emits a warning.
   */
  public enableSSAO(): void {
    if (!this.isWebGPU) {
      console.warn(
        'VisualEffectSystem.enableSSAO: SSAO is only supported on WebGPU; ignored on WebGL2.'
      );
      return;
    }
    this.ssaoEnabled = true;
  }

  /** Disables SSAO. */
  public disableSSAO(): void {
    this.ssaoEnabled = false;
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
      config.bloomEnabled ? this.enableBloom() : this.disableBloom();
    }
    if (config.vignetteEnabled !== undefined) {
      config.vignetteEnabled ? this.enableVignette() : this.disableVignette();
    }
    if (config.chromaticAberrationEnabled !== undefined) {
      config.chromaticAberrationEnabled
        ? this.enableChromaticAberration()
        : this.disableChromaticAberration();
    }
    if (config.colorCorrectionEnabled !== undefined) {
      config.colorCorrectionEnabled
        ? this.enableColorCorrection()
        : this.disableColorCorrection();
    }

    this.updateEffects();
  }

  public getConfig(): VisualEffectConfig {
    return { ...this.config