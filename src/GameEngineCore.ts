/**
 * 高性能游戏引擎核心
 * Fighter Game Engine Core
 * 
 * 功能：
 * - 游戏循环管理
 * - 性能监控
 * - 时间管理
 * - 场景管理
 */

import { useGameStore } from './store/useGameStore';

export class GameEngineCore {
    private static instance: GameEngineCore;
    
    // 性能指标
    private fps: number = 60;
    private frameCount: number = 0;
    private lastFrameTime: number = 0;
    private deltaTime: number = 0;
    private fpsUpdateInterval: number = 500;
    private lastFpsUpdate: number = 0;
    private frameTimeHistory: number[] = [];
    private maxHistorySize: number = 60;
    
    // 游戏循环
    private animationFrameId: number | null = null;
    private isRunning: boolean = false;
    private targetFps: number = 60;
    private fixedTimeStep: number = 1000 / 60;
    private accumulator: number = 0;
    
    // 性能监控
    private performanceMonitor: {
        memoryUsage: number;
        drawCalls: number;
        triangles: number;
        lastUpdate: number;
    } = {
        memoryUsage: 0,
        drawCalls: 0,
        triangles: 0,
        lastUpdate: 0
    };
    
    // 回调函数
    private updateCallbacks: Array<(deltaTime: number) => void> = [];
    private renderCallbacks: Array<(deltaTime: number) => void> = [];
    
    private constructor() {
        this.lastFrameTime = performance.now();
    }
    
    public static getInstance(): GameEngineCore {
        if (!GameEngineCore.instance) {
            GameEngineCore.instance = new GameEngineCore();
        }
        return GameEngineCore.instance;
    }
    
    /**
     * 启动游戏引擎
     */
    public start(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.lastFpsUpdate = performance.now();
        this.accumulator = 0;
        
        console.log('[GameEngine] 引擎启动');
        this.gameLoop();
    }
    
    /**
     * 停止游戏引擎
     */
    public stop(): void {
        this.isRunning = false;
        
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        console.log('[GameEngine] 引擎停止');
    }
    
    /**
     * 游戏主循环
     */
    private gameLoop = (): void => {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        const frameTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // 更新FPS计算
        this.updateFps(frameTime);
        
        // 固定时间步长更新
        this.accumulator += frameTime;
        
        while (this.accumulator >= this.fixedTimeStep) {
            this.fixedUpdate(this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
        }
        
        // 变量时间步长更新
        this.update(frameTime);
        
        // 渲染
        this.render(frameTime);
        
        // 更新性能监控
        this.updatePerformanceMonitor();
        
        // 帧计数
        this.frameCount++;
        
        // 更新store
        this.updateStore();
        
        // 下一帧
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    };
    
    /**
     * 固定时间步长更新（物理、游戏逻辑）
     */
    private fixedUpdate(deltaTime: number): void {
        // 更新所有注册的回调节器
        for (const callback of this.updateCallbacks) {
            callback(deltaTime);
        }
    }
    
    /**
     * 变量时间步长更新
     */
    private update(deltaTime: number): void {
        this.deltaTime = deltaTime;
    }
    
    /**
     * 渲染
     */
    private render(deltaTime: number): void {
        for (const callback of this.renderCallbacks) {
            callback(deltaTime);
        }
    }
    
    /**
     * 更新FPS计算
     */
    private updateFps(frameTime: number): void {
        // 记录帧时间历史
        this.frameTimeHistory.push(frameTime);
        if (this.frameTimeHistory.length > this.maxHistorySize) {
            this.frameTimeHistory.shift();
        }
        
        // 周期性更新FPS显示
        const now = performance.now();
        if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
            const frames = this.frameCount;
            const elapsed = now - this.lastFpsUpdate;
            this.fps = Math.round((frames / elapsed) * 1000);
            
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
    }
    
    /**
     * 更新性能监控
     */
    private updatePerformanceMonitor(): void {
        const now = performance.now();
        if (now - this.performanceMonitor.lastUpdate >= 1000) {
            // 内存使用情况（如果支持）
            const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
            if (perfMemory) {
                this.performanceMonitor.memoryUsage = Math.round(
                    (perfMemory.usedJSHeapSize / 1048576) * 100
                ) / 100;
            }

            this.performanceMonitor.lastUpdate = now;
        }
    }
    
    /**
     * 更新Store
     */
    private updateStore(): void {
        const store = useGameStore.getState();
        
        store.setFps(this.fps);
        store.incrementFrameCount();
        store.updatePerformanceStats({
            drawCalls: this.performanceMonitor.drawCalls,
            triangles: this.performanceMonitor.triangles,
            memoryUsage: this.performanceMonitor.memoryUsage
        });
    }
    
    /**
     * 注册更新回调
     */
    public onUpdate(callback: (deltaTime: number) => void): () => void {
        this.updateCallbacks.push(callback);
        return () => {
            const index = this.updateCallbacks.indexOf(callback);
            if (index > -1) {
                this.updateCallbacks.splice(index, 1);
            }
        };
    }
    
    /**
     * 注册渲染回调
     */
    public onRender(callback: (deltaTime: number) => void): () => void {
        this.renderCallbacks.push(callback);
        return () => {
            const index = this.renderCallbacks.indexOf(callback);
            if (index > -1) {
                this.renderCallbacks.splice(index, 1);
            }
        };
    }
    
    /**
     * 获取当前FPS
     */
    public getFps(): number {
        return this.fps;
    }
    
    /**
     * 获取平均帧时间
     */
    public getAverageFrameTime(): number {
        if (this.frameTimeHistory.length === 0) return 0;
        const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
        return sum / this.frameTimeHistory.length;
    }
    
    /**
     * 获取性能统计
     */
    public getPerformanceStats(): typeof this.performanceMonitor {
        return { ...this.performanceMonitor };
    }
    
    /**
     * 设置目标FPS
     */
    public setTargetFps(fps: number): void {
        this.targetFps = fps;
        this.fixedTimeStep = 1000 / fps;
    }
    
    /**
     * 是否正在运行
     */
    public getIsRunning(): boolean {
        return this.isRunning;
    }
    
    /**
     * 获取Delta Time
     */
    public getDeltaTime(): number {
        return this.deltaTime;
    }
    
    /**
     * 设置Draw Calls数量
     */
    public setDrawCalls(count: number): void {
        this.performanceMonitor.drawCalls = count;
    }
    
    /**
     * 设置三角形数量
     */
    public setTriangles(count: number): void {
        this.performanceMonitor.triangles = count;
    }
}

// Hook: 访问游戏引擎核心
export const useGameEngine = () => {
    return GameEngineCore.getInstance();
};

// Hook: 性能统计
export const usePerformanceStats = () => {
    const fps = useGameStore((state) => state.fps);
    const performanceStats = useGameStore((state) => state.performanceStats);
    
    return {
        fps,
        ...performanceStats
    };
};
