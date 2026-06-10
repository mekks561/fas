import { Scene, Texture, Engine } from '@babylonjs/core';

export interface TextureOptions {
    wrapU?: number;
    wrapV?: number;
    anisotropicFilteringLevel?: number;
    samplingMode?: number;
}

export class TextureManager {
    private scene: Scene;
    private textureCache: Map<string, Texture> = new Map();
    private loadingPromises: Map<string, Promise<Texture>> = new Map();
    private defaultOptions: TextureOptions = {
        wrapU: Texture.WRAP_ADDRESSMODE,
        wrapV: Texture.WRAP_ADDRESSMODE,
        anisotropicFilteringLevel: 4,
        samplingMode: Texture.TRILINEAR_SAMPLINGMODE
    };
    private engine: Engine;
    private isDisposed: boolean = false;
    
    constructor(scene: Scene) {
        this.scene = scene;
        this.engine = scene.getEngine() as Engine;
    }
    
    // 预加载纹理
    public preloadTexture(url: string, options?: TextureOptions): Promise<Texture> {
        // 如果管理器已销毁，直接拒绝
        if (this.isDisposed) {
            return Promise.reject(new Error('TextureManager has been disposed'));
        }
        
        // 如果纹理已经在缓存中，直接返回
        if (this.textureCache.has(url)) {
            return Promise.resolve(this.textureCache.get(url)!);
        }
        
        // 如果纹理正在加载，返回现有的Promise
        if (this.loadingPromises.has(url)) {
            return this.loadingPromises.get(url)!;
        }
        
        // 合并默认选项和传入选项
        const finalOptions = { ...this.defaultOptions, ...options };
        
        // 创建新的加载Promise
        const promise = new Promise<Texture>((resolve, reject) => {
            try {
                const texture = new Texture(
                    url,
                    this.scene,
                    true, // generateMipMaps
                    false, // invertY
                    finalOptions.samplingMode,
                    () => {
                        // 加载成功
                        this.configureTexture(texture, finalOptions);
                        this.textureCache.set(url, texture);
                        this.loadingPromises.delete(url);
                        resolve(texture);
                    },
                    (message, exception) => {
                        // 加载失败
                        console.warn(`Failed to load texture: ${url}`, exception);
                        this.loadingPromises.delete(url);
                        reject(new Error(`Failed to load texture: ${url}`));
                    }
                );
                
            } catch (error) {
                console.warn(`Failed to create texture: ${url}`, error);
                this.loadingPromises.delete(url);
                reject(new Error(`Failed to create texture: ${url}`));
            }
        });
        
        this.loadingPromises.set(url, promise);
        return promise;
    }
    
    // 获取纹理，如果不存在则加载
    public getTexture(url: string, options?: TextureOptions): Texture {
        // 如果管理器已销毁，抛出错误
        if (this.isDisposed) {
            throw new Error('TextureManager has been disposed');
        }
        
        // 如果纹理已经在缓存中，直接返回
        if (this.textureCache.has(url)) {
            return this.textureCache.get(url)!;
        }
        
        // 合并默认选项和传入选项
        const finalOptions = { ...this.defaultOptions, ...options };
        
        // 同步加载纹理
        const texture = new Texture(
            url,
            this.scene,
            false, // generateMipMaps
            false, // invertY
            finalOptions.samplingMode
        );
        
        this.configureTexture(texture, finalOptions);
        this.textureCache.set(url, texture);
        return texture;
    }
    
    // 配置纹理选项
    private configureTexture(texture: Texture, options: TextureOptions): void {
        if (options.wrapU !== undefined) {
            texture.wrapU = options.wrapU;
        }
        if (options.wrapV !== undefined) {
            texture.wrapV = options.wrapV;
        }
        if (options.anisotropicFilteringLevel !== undefined) {
            texture.anisotropicFilteringLevel = options.anisotropicFilteringLevel;
        }
    }
    
    // 检查纹理是否已加载
    public hasTexture(url: string): boolean {
        return this.textureCache.has(url);
    }
    
    // 预加载所有需要的纹理
    public preloadAllTextures(): Promise<Texture[]> {
        const texturesToPreload = [
            './textures/metal.jpg',
            './textures/carbon.jpg',
            './textures/metalScratched.jpg',
            './textures/glass.jpg',
            './textures/flare.png',
            './textures/rock.jpg',
            './textures/grid.png',
            './textures/earth.jpg'
        ];
        
        const promises = texturesToPreload.map(url => this.preloadTexture(url));
        return Promise.all(promises);
    }
    
    // 添加纹理到缓存
    public addTexture(url: string, texture: Texture): void {
        if (this.isDisposed) {
            return;
        }
        
        // 如果已有相同URL的纹理，先销毁旧的
        if (this.textureCache.has(url)) {
            const oldTexture = this.textureCache.get(url)!;
            if (oldTexture !== texture) {
                oldTexture.dispose();
            }
        }
        
        this.textureCache.set(url, texture);
    }
    
    // 移除纹理
    public removeTexture(url: string): void {
        const texture = this.textureCache.get(url);
        if (texture) {
            texture.dispose();
            this.textureCache.delete(url);
        }
    }
    
    // 获取纹理数量
    public getTextureCount(): number {
        return this.textureCache.size;
    }
    
    // 清理特定纹理
    public clearTexture(url: string): void {
        this.removeTexture(url);
    }
    
    // 清理纹理缓存
    public dispose(): void {
        if (this.isDisposed) {
            return;
        }
        
        // 标记为已销毁
        this.isDisposed = true;
        
        // 销毁所有纹理
        for (const texture of this.textureCache.values()) {
            try {
                texture.dispose();
            } catch (error) {
                console.warn('Error disposing texture:', error);
            }
        }
        
        // 清空缓存
        this.textureCache.clear();
        this.loadingPromises.clear();
    }
    
    // 检查管理器是否已销毁
    public isDisposedState(): boolean {
        return this.isDisposed;
    }
}