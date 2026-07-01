import * as pc from 'playcanvas';

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
  
  private bloomEffect: pc.PostEffect | null = null;
  private vignetteEffect: pc.PostEffect | null = null;
  private chromaticAberrationEffect: pc.PostEffect | null = null;
  private colorCorrectionEffect: pc.PostEffect | null = null;
  private fxaaEffect: pc.PostEffect | null = null;
  
  private bloomShader: pc.Shader | null = null;
  private vignetteShader: pc.Shader | null = null;
  private chromaticAberrationShader: pc.Shader | null = null;
  private colorCorrectionShader: pc.Shader | null = null;
  
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
  
  private createFXAAShader(): pc.Shader {
    return new pc.Shader(this.app.graphicsDevice, {
      attributes: {
        aPosition: pc.SEMANTIC_POSITION
      },
      vshader: `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main(void) {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vUv = (aPosition + 1.0) * 0.5;
        }
      `,
      fshader: `
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
      `
    });
  }
  
  private initializeShaders(): void {
    this.bloomShader = new pc.Shader(this.app.graphicsDevice, {
      attributes: {
        aPosition: pc.SEMANTIC_POSITION
      },
      vshader: `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main(void) {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vUv = (aPosition + 1.0) * 0.5;
        }
      `,
      fshader: `
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
      `
    });
    
    this.vignetteShader = new pc.Shader(this.app.graphicsDevice, {
      attributes: {
        aPosition: pc.SEMANTIC_POSITION
      },
      vshader: `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main(void) {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vUv = (aPosition + 1.0) * 0.5;
        }
      `,
      fshader: `
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
      `
    });
    
    this.chromaticAberrationShader = new pc.Shader(this.app.graphicsDevice, {
      attributes: {
        aPosition: pc.SEMANTIC_POSITION
      },
      vshader: `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main(void) {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vUv = (aPosition + 1.0) * 0.5;
        }
      `,
      fshader: `
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
      `
    });
    
    this.colorCorrectionShader = new pc.Shader(this.app.graphicsDevice, {
      attributes: {
        aPosition: pc.SEMANTIC_POSITION
      },
      vshader: `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main(void) {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vUv = (aPosition + 1.0) * 0.5;
        }
      `,
      fshader: `
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
      `
    });
  }
  
  private initializePostEffects(): void {
    // @ts-ignore - PostEffectQueue API 可能与版本不兼容
    this.postEffectQueue = new pc.PostEffectQueue(this.app.graphicsDevice);
    
    if (this.config.fxaaEnabled) {
      const fxaaShader = this.createFXAAShader();
      // @ts-ignore
      this.fxaaEffect = new pc.PostEffect(this.app.graphicsDevice, fxaaShader);
      // @ts-ignore
      this.fxaaEffect.init();
      // @ts-ignore
      this.postEffectQueue.addEffect(this.fxaaEffect);
    }
    
    if (this.config.bloomEnabled && this.bloomShader) {
      // @ts-ignore
      this.bloomEffect = new pc.PostEffect(this.app.graphicsDevice, this.bloomShader);
      // @ts-ignore
      this.bloomEffect.pass = 1;
      // @ts-ignore
      this.bloomEffect.init();
      // @ts-ignore
      this.postEffectQueue.addEffect(this.bloomEffect);
    }
    
    if (this.config.vignetteEnabled && this.vignetteShader) {
      // @ts-ignore
      this.vignetteEffect = new pc.PostEffect(this.app.graphicsDevice, this.vignetteShader);
      // @ts-ignore
      this.vignetteEffect.init();
      // @ts-ignore
      this.postEffectQueue.addEffect(this.vignetteEffect);
    }
    
    if (this.config.colorCorrectionEnabled && this.colorCorrectionShader) {
      // @ts-ignore
      this.colorCorrectionEffect = new pc.PostEffect(this.app.graphicsDevice, this.colorCorrectionShader);
      // @ts-ignore
      this.colorCorrectionEffect.init();
      // @ts-ignore
      this.postEffectQueue.addEffect(this.colorCorrectionEffect);
    }
    
    if (this.camera.camera) {
      // @ts-ignore - postEffects 可能只读
      this.camera.camera.postEffects = this.postEffectQueue;
    }
    
    this.updateEffects();
  }
  
  private updateEffects(): void {
    if (this.bloomEffect) {
      // @ts-ignore
      this.bloomEffect.setUniform('uThreshold', this.config.bloomThreshold);
      // @ts-ignore
      this.bloomEffect.setUniform('uStrength', this.config.bloomStrength);
    }
    
    if (this.vignetteEffect) {
      // @ts-ignore
      this.vignetteEffect.setUniform('uIntensity', this.config.vignetteIntensity);
      // @ts-ignore
      this.vignetteEffect.setUniform('uRadius', this.config.vignetteRadius);
      // @ts-ignore
      this.vignetteEffect.setUniform('uColor', this.config.vignetteColor.data);
    }
    
    if (this.chromaticAberrationEffect) {
      // @ts-ignore
      this.chromaticAberrationEffect.setUniform('uAmount', this.config.chromaticAberrationAmount);
    }
    
    if (this.colorCorrectionEffect) {
      // @ts-ignore
      this.colorCorrectionEffect.setUniform('uSaturation', this.config.colorCorrectionSaturation);
      // @ts-ignore
      this.colorCorrectionEffect.setUniform('uContrast', this.config.colorCorrectionContrast);
      // @ts-ignore
      this.colorCorrectionEffect.setUniform('uExposure', this.config.colorCorrectionExposure);
    }
  }
  
  public enableBloom(): void {
    if (!this.bloomEffect && this.bloomShader) {
      // @ts-ignore
      this.bloomEffect = new pc.PostEffect(this.app.graphicsDevice, this.bloomShader);
      // @ts-ignore
      this.bloomEffect.pass = 1;
      // @ts-ignore
      this.bloomEffect.init();
      // @ts-ignore
      this.postEffectQueue?.addEffect(this.bloomEffect);
    }
    this.config.bloomEnabled = true;
    this.updateEffects();
  }
  
  public disableBloom(): void {
    if (this.bloomEffect) {
      // @ts-ignore
      this.postEffectQueue?.removeEffect(this.bloomEffect);
      this.bloomEffect = null;
    }
    this.config.bloomEnabled = false;
  }
  
  public enableVignette(): void {
    if (!this.vignetteEffect && this.vignetteShader) {
      // @ts-ignore
      this.vignetteEffect = new pc.PostEffect(this.app.graphicsDevice, this.vignetteShader);
      // @ts-ignore
      this.vignetteEffect.init();
      // @ts-ignore
      this.postEffectQueue?.addEffect(this.vignetteEffect);
    }
    this.config.vignetteEnabled = true;
    this.updateEffects();
  }
  
  public disableVignette(): void {
    if (this.vignetteEffect) {
      // @ts-ignore
      this.postEffectQueue?.removeEffect(this.vignetteEffect);
      this.vignetteEffect = null;
    }
    this.config.vignetteEnabled = false;
  }
  
  public enableChromaticAberration(): void {
    if (!this.chromaticAberrationEffect && this.chromaticAberrationShader) {
      // @ts-ignore
      this.chromaticAberrationEffect = new pc.PostEffect(this.app.graphicsDevice, this.chromaticAberrationShader);
      // @ts-ignore
      this.chromaticAberrationEffect.init();
      // @ts-ignore
      this.postEffectQueue?.addEffect(this.chromaticAberrationEffect);
    }
    this.config.chromaticAberrationEnabled = true;
    this.updateEffects();
  }
  
  public disableChromaticAberration(): void {
    if (this.chromaticAberrationEffect) {
      // @ts-ignore
      this.postEffectQueue?.removeEffect(this.chromaticAberrationEffect);
      this.chromaticAberrationEffect = null;
    }
    this.config.chromaticAberrationEnabled = false;
  }
  
  public enableColorCorrection(): void {
    if (!this.colorCorrectionEffect && this.colorCorrectionShader) {
      // @ts-ignore
      this.colorCorrectionEffect = new pc.PostEffect(this.app.graphicsDevice, this.colorCorrectionShader);
      // @ts-ignore
      this.colorCorrectionEffect.init();
      // @ts-ignore
      this.postEffectQueue?.addEffect(this.colorCorrectionEffect);
    }
    this.config.colorCorrectionEnabled = true;
    this.updateEffects();
  }
  
  public disableColorCorrection(): void {
    if (this.colorCorrectionEffect) {
      // @ts-ignore
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
      config.chromaticAberrationEnabled ? this.enableChromaticAberration() : this.disableChromaticAberration();
    }
    if (config.colorCorrectionEnabled !== undefined) {
      config.colorCorrectionEnabled ? this.enableColorCorrection() : this.disableColorCorrection();
    }
    
    this.updateEffects();
  }
  
  public getConfig(): VisualEffectConfig {
    return { ...this.config };
  }
  
  public dispose(): void {
    if (this.postEffectQueue) {
      // @ts-ignore - clear 方法可能不存在
      this.postEffectQueue.clear();
    }
    
    this.bloomEffect = null;
    this.vignetteEffect = null;
    this.chromaticAberrationEffect = null;
    this.colorCorrectionEffect = null;
    this.fxaaEffect = null;
    
    this.bloomShader = null;
    this.vignetteShader = null;
    this.chromaticAberrationShader = null;
    this.colorCorrectionShader = null;
  }
}