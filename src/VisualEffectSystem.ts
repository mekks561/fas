/**
 * 高质量视觉效果系统
 * High-Quality Visual Effects System
 * 
 * 功能：
 * - 后期处理效果
 * - 粒子系统
 * - 动态光照
 * - 材质管理
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/post-processes';

export interface VisualEffectConfig {
    bloomEnabled: boolean;
    bloomThreshold: number;
    bloomWeight: number;
    bloomKernel: number;
    bloomScale: number;
    
    chromaticAberrationEnabled: boolean;
    chromaticAberrationAmount: number;
    
    depthOfFieldEnabled: boolean;
    depthOfFieldBlurLevel: number;
    focalLength: number;
    fStop: number;
    
    vignetteEnabled: boolean;
    vignetteWeight: number;
    vignetteColor: string;
    
    colorGradingEnabled: boolean;
    colorGradingExposure: number;
    colorGradingContrast: number;
}

export class VisualEffectSystem {
    private scene: BABYLON.Scene;
    private engine: BABYLON.Engine;
    private defaultPipeline: BABYLON.DefaultRenderingPipeline;
    
    // 效果配置
    private config: VisualEffectConfig;
    
    // 后处理
    private bloom: BABYLON.BloomEffect | null = null;
    private chromaticAberration: BABYLON.ChromaticAberrationPostProcess | null = null;
    private depthOfField: BABYLON.DepthOfFieldEffect | null = null;
    private vignette: BABYLON.ImageProcessingPostProcess | null = null;
    private colorGrading: BABYLON.ImageProcessingPostProcess | null = null;
    
    // HDR
    private hdr: BABYLON.HDRRenderingPipeline | null = null;
    
    constructor(scene: BABYLON.Scene, engine: BABYLON.Engine) {
        this.scene = scene;
        this.engine = engine;
        
        // 默认配置
        this.config = {
            bloomEnabled: true,
            bloomThreshold: 0.8,
            bloomWeight: 0.3,
            bloomKernel: 64,
            bloomScale: 0.5,
            
            chromaticAberrationEnabled: false,
            chromaticAberrationAmount: 3.5,
            
            depthOfFieldEnabled: false,
            depthOfFieldBlurLevel: BABYLON.DepthOfFieldEffectBlurLevel.Medium,
            focalLength: 50,
            fStop: 2.8,
            
            vignetteEnabled: true,
            vignetteWeight: 1.5,
            vignetteColor: '#000000',
            
            colorGradingEnabled: true,
            colorGradingExposure: 1.0,
            colorGradingContrast: 1.2
        };
        
        // 初始化后期处理管线
        this.initializePipeline();
    }
    
    /**
     * 初始化后期处理管线
     */
    private initializePipeline(): void {
        try {
            // 创建默认渲染管线
            this.defaultPipeline = new BABYLON.DefaultRenderingPipeline(
                'defaultPipeline',
                true,
                this.scene,
                [this.scene.activeCamera]
            );
            
            // 配置Bloom效果
            if (this.config.bloomEnabled) {
                this.enableBloom();
            }
            
            // 配置Vignette
            if (this.config.vignetteEnabled) {
                this.enableVignette();
            }
            
            // 配置Color Grading
            if (this.config.colorGradingEnabled) {
                this.enableColorGrading();
            }
            
            // 配置Depth of Field
            if (this.config.depthOfFieldEnabled) {
                this.enableDepthOfField();
            }
            
            console.log('[VisualEffects] 后期处理管线初始化完成');
        } catch (error) {
            console.error('[VisualEffects] 后期处理管线初始化失败:', error);
        }
    }
    
    /**
     * 启用Bloom效果
     */
    public enableBloom(): void {
        if (!this.defaultPipeline) return;
        
        try {
            this.defaultPipeline.bloomEnabled = this.config.bloomEnabled;
            this.defaultPipeline.bloomThreshold = this.config.bloomThreshold;
            this.defaultPipeline.bloomWeight = this.config.bloomWeight;
            this.defaultPipeline.bloomKernel = this.config.bloomKernel;
            this.defaultPipeline.bloomScale = this.config.bloomScale;
            
            console.log('[VisualEffects] Bloom效果已启用');
        } catch (error) {
            console.error('[VisualEffects] Bloom效果启用失败:', error);
        }
    }
    
    /**
     * 禁用Bloom效果
     */
    public disableBloom(): void {
        if (!this.defaultPipeline) return;
        
        this.defaultPipeline.bloomEnabled = false;
        console.log('[VisualEffects] Bloom效果已禁用');
    }
    
    /**
     * 启用Vignette效果
     */
    public enableVignette(): void {
        if (!this.defaultPipeline) return;
        
        try {
            this.defaultPipeline.imageProcessingEnabled = true;
            this.defaultPipeline.imageProcessing.vignetteEnabled = true;
            this.defaultPipeline.imageProcessing.vignetteWeight = this.config.vignetteWeight;
            this.defaultPipeline.imageProcessing.vignetteColor = BABYLON.Color4.FromHexString(this.config.vignetteColor);
            
            console.log('[VisualEffects] Vignette效果已启用');
        } catch (error) {
            console.error('[VisualEffects] Vignette效果启用失败:', error);
        }
    }
    
    /**
     * 禁用Vignette效果
     */
    public disableVignette(): void {
        if (!this.defaultPipeline) return;
        
        this.defaultPipeline.imageProcessing.vignetteEnabled = false;
        console.log('[VisualEffects] Vignette效果已禁用');
    }
    
    /**
     * 启用颜色分级
     */
    public enableColorGrading(): void {
        if (!this.defaultPipeline) return;
        
        try {
            this.defaultPipeline.imageProcessingEnabled = true;
            this.defaultPipeline.imageProcessing.exposure = this.config.colorGradingExposure;
            this.defaultPipeline.imageProcessing.contrast = this.config.colorGradingContrast;
            
            console.log('[VisualEffects] 颜色分级已启用');
        } catch (error) {
            console.error('[VisualEffects] 颜色分级启用失败:', error);
        }
    }
    
    /**
     * 设置曝光度
     */
    public setExposure(exposure: number): void {
        if (!this.defaultPipeline) return;
        
        this.defaultPipeline.imageProcessing.exposure = exposure;
    }
    
    /**
     * 设置对比度
     */
    public setContrast(contrast: number): void {
        if (!this.defaultPipeline) return;
        
        this.defaultPipeline.imageProcessing.contrast = contrast;
    }
    
    /**
     * 启用景深效果
     */
    public enableDepthOfField(): void {
        if (!this.defaultPipeline || !this.scene.activeCamera) return;
        
        try {
            this.defaultPipeline.depthOfFieldEnabled = true;
            this.defaultPipeline.depthOfFieldBlurLevel = this.config.depthOfFieldBlurLevel;
            
            // 设置相机参数
            const camera = this.scene.activeCamera as BABYLON.FreeCamera;
            if (camera.fov) {
                this.defaultPipeline.depthOfField.fStop = this.config.fStop;
            }
            
            console.log('[VisualEffects] 景深效果已启用');
        } catch (error) {
            console.error('[VisualEffects] 景深效果启用失败:', error);
        }
    }
    
    /**
     * 禁用景深效果
     */
    public disableDepthOfField(): void {
        if (!this.defaultPipeline) return;
        
        this.defaultPipeline.depthOfFieldEnabled = false;
        console.log('[VisualEffects] 景深效果已禁用');
    }
    
    /**
     * 启用色差效果
     */
    public enableChromaticAberration(): void {
        if (this.chromaticAberration) return;
        
        try {
            this.chromaticAberration = new BABYLON.ChromaticAberrationPostProcess(
                'chromaticAberration',
                this.config.chromaticAberrationAmount,
                this.scene.activeCamera
            );
            
            console.log('[VisualEffects] 色差效果已启用');
        } catch (error) {
            console.error('[VisualEffects] 色差效果启用失败:', error);
        }
    }
    
    /**
     * 设置色差强度
     */
    public setChromaticAberration(amount: number): void {
        if (!this.chromaticAberration) return;
        
        this.chromaticAberration.aberrationAmount = amount;
    }
    
    /**
     * 禁用色差效果
     */
    public disableChromaticAberration(): void {
        if (this.chromaticAberration) {
            this.chromaticAberration.dispose();
            this.chromaticAberration = null;
            console.log('[VisualEffects] 色差效果已禁用');
        }
    }
    
    /**
     * 应用后期处理预设
     */
    public applyPreset(preset: 'cinematic' | 'vibrant' | 'realistic' | 'retro'): void {
        switch (preset) {
            case 'cinematic':
                this.config.bloomWeight = 0.4;
                this.config.bloomThreshold = 0.7;
                this.config.vignetteWeight = 2.0;
                this.config.colorGradingContrast = 1.3;
                this.config.colorGradingExposure = 0.9;
                break;
                
            case 'vibrant':
                this.config.bloomWeight = 0.5;
                this.config.bloomThreshold = 0.9;
                this.config.colorGradingContrast = 1.5;
                this.config.colorGradingExposure = 1.2;
                break;
                
            case 'realistic':
                this.config.bloomWeight = 0.2;
                this.config.bloomThreshold = 0.85;
                this.config.colorGradingContrast = 1.1;
                this.config.colorGradingExposure = 1.0;
                break;
                
            case 'retro':
                this.config.bloomWeight = 0.6;
                this.config.bloomThreshold = 0.6;
                this.config.colorGradingContrast = 1.4;
                this.config.colorGradingExposure = 1.1;
                this.enableChromaticAberration();
                this.setChromaticAberration(5.0);
                break;
        }
        
        // 应用配置
        this.enableBloom();
        this.enableVignette();
        this.enableColorGrading();
        
        console.log(`[VisualEffects] 已应用预设: ${preset}`);
    }
    
    /**
     * 更新配置
     */
    public updateConfig(config: Partial<VisualEffectConfig>): void {
        this.config = { ...this.config, ...config };
        
        // 重新应用配置
        if (config.bloomEnabled !== undefined) {
            config.bloomEnabled ? this.enableBloom() : this.disableBloom();
        }
        if (config.vignetteEnabled !== undefined) {
            config.vignetteEnabled ? this.enableVignette() : this.disableVignette();
        }
        if (config.colorGradingEnabled !== undefined) {
            config.colorGradingEnabled ? this.enableColorGrading() : null;
        }
        if (config.depthOfFieldEnabled !== undefined) {
            config.depthOfFieldEnabled ? this.enableDepthOfField() : this.disableDepthOfField();
        }
        if (config.chromaticAberrationEnabled !== undefined) {
            config.chromaticAberrationEnabled ? this.enableChromaticAberration() : this.disableChromaticAberration();
        }
    }
    
    /**
     * 获取当前配置
     */
    public getConfig(): VisualEffectConfig {
        return { ...this.config };
    }
    
    /**
     * 启用HDR
     */
    public enableHDR(): void {
        try {
            if (this.hdr) return;
            
            this.hdr = new BABYLON.HDRRenderingPipeline(
                'hdr',
                this.scene,
                1.0,
                [this.scene.activeCamera]
            );
            
            console.log('[VisualEffects] HDR已启用');
        } catch (error) {
            console.error('[VisualEffects] HDR启用失败:', error);
        }
    }
    
    /**
     * 禁用HDR
     */
    public disableHDR(): void {
        if (this.hdr) {
            this.hdr.dispose();
            this.hdr = null;
            console.log('[VisualEffects] HDR已禁用');
        }
    }
    
    /**
     * 销毁视觉效果系统
     */
    public dispose(): void {
        if (this.defaultPipeline) {
            this.defaultPipeline.dispose();
        }
        
        if (this.chromaticAberration) {
            this.chromaticAberration.dispose();
        }
        
        if (this.hdr) {
            this.hdr.dispose();
        }
        
        console.log('[VisualEffects] 视觉效果系统已销毁');
    }
}

// 全局实例
let visualEffectSystemInstance: VisualEffectSystem | null = null;

export const createVisualEffectSystem = (
    scene: BABYLON.Scene,
    engine: BABYLON.Engine
): VisualEffectSystem => {
    if (visualEffectSystemInstance) {
        visualEffectSystemInstance.dispose();
    }
    
    visualEffectSystemInstance = new VisualEffectSystem(scene, engine);
    return visualEffectSystemInstance;
};

export const getVisualEffectSystem = (): VisualEffectSystem | null => {
    return visualEffectSystemInstance;
};
