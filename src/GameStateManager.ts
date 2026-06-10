import { Scene } from '@babylonjs/core';

export enum GameState {
    MAIN_MENU,
    PLAYING,
    PAUSED,
    GAME_OVER,
    SETTINGS,
    LOADING,
    CREDITS
}

export interface GameStateChangeEvent {
    from: GameState;
    to: GameState;
    data?: any;
}

export class GameStateManager {
    private currentState: GameState = GameState.MAIN_MENU;
    private previousState: GameState = GameState.MAIN_MENU;
    private scene: Scene;
    private stateChangeCallbacks: Array<(event: GameStateChangeEvent) => void> = [];
    private stateData: Map<GameState, any> = new Map();

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public setState(state: GameState, data?: any): void {
        if (this.currentState === state) return;

        const event: GameStateChangeEvent = {
            from: this.currentState,
            to: state,
            data: data
        };

        // 更新状态
        this.previousState = this.currentState;
        this.currentState = state;

        // 存储状态数据
        if (data) {
            this.stateData.set(state, data);
        }

        // 触发状态变化回调
        this.notifyStateChange(event);

        // 执行状态特定的处理
        this.handleStateTransition(event);
    }

    public getCurrentState(): GameState {
        return this.currentState;
    }

    public getPreviousState(): GameState {
        return this.previousState;
    }

    public isState(state: GameState): boolean {
        return this.currentState === state;
    }

    public getStateData(state: GameState): any {
        return this.stateData.get(state);
    }

    public setLoadingState(progress: number = 0): void {
        this.setState(GameState.LOADING, { progress });
    }

    public setPlayingState(): void {
        this.setState(GameState.PLAYING);
    }

    public setPausedState(): void {
        if (this.currentState === GameState.PLAYING) {
            this.setState(GameState.PAUSED);
        }
    }

    public resumeState(): void {
        if (this.currentState === GameState.PAUSED) {
            this.setState(GameState.PLAYING);
        }
    }

    public togglePause(): void {
        if (this.currentState === GameState.PLAYING) {
            this.setPausedState();
        } else if (this.currentState === GameState.PAUSED) {
            this.resumeState();
        }
    }

    public setGameOverState(score: number = 0): void {
        this.setState(GameState.GAME_OVER, { score });
    }

    public setMainMenuState(): void {
        this.setState(GameState.MAIN_MENU);
    }

    public setSettingsState(): void {
        this.setState(GameState.SETTINGS);
    }

    public setCreditsState(): void {
        this.setState(GameState.CREDITS);
    }

    private handleStateTransition(event: GameStateChangeEvent): void {
        switch (event.to) {
            case GameState.MAIN_MENU:
                this.handleMainMenuState();
                break;
            case GameState.PLAYING:
                this.handlePlayingState();
                break;
            case GameState.PAUSED:
                this.handlePausedState();
                break;
            case GameState.GAME_OVER:
                this.handleGameOverState(event.data);
                break;
            case GameState.LOADING:
                this.handleLoadingState(event.data);
                break;
            case GameState.SETTINGS:
                this.handleSettingsState();
                break;
            case GameState.CREDITS:
                this.handleCreditsState();
                break;
        }
    }

    private handleMainMenuState(): void {
        // 主菜单状态处理
        // 例如：显示主菜单UI，停止游戏循环等
        // 注意：Babylon.js的引擎没有public的getRenderLoop方法
        // 我们可以通过其他方式处理状态转换，比如通过Game类来控制
    }

    private handlePlayingState(): void {
        // 游戏中状态处理
        // 例如：隐藏菜单UI，开始游戏循环等
        // 注意：Babylon.js的引擎没有public的getRenderLoop方法
        // 我们可以通过其他方式处理状态转换，比如通过Game类来控制
    }

    private handlePausedState(): void {
        // 暂停状态处理
        // 例如：显示暂停菜单，暂停游戏逻辑等
        // 注意：Babylon.js的引擎没有public的getRenderLoop方法
        // 我们可以通过其他方式处理状态转换，比如通过Game类来控制
    }

    private handleGameOverState(data?: any): void {
        // 游戏结束状态处理
        // 例如：显示游戏结束UI，保存分数等
        // 注意：Babylon.js的引擎没有public的getRenderLoop方法
        // 我们可以通过其他方式处理状态转换，比如通过Game类来控制
    }

    private handleLoadingState(data?: any): void {
        // 加载状态处理
        // 例如：显示加载进度条等
    }

    private handleSettingsState(): void {
        // 设置状态处理
        // 例如：显示设置UI等
    }

    private handleCreditsState(): void {
        //  credits状态处理
        // 例如：显示 credits UI等
    }

    public onStateChange(callback: (event: GameStateChangeEvent) => void): void {
        this.stateChangeCallbacks.push(callback);
    }

    public offStateChange(callback: (event: GameStateChangeEvent) => void): void {
        const index = this.stateChangeCallbacks.indexOf(callback);
        if (index > -1) {
            this.stateChangeCallbacks.splice(index, 1);
        }
    }

    private notifyStateChange(event: GameStateChangeEvent): void {
        for (const callback of this.stateChangeCallbacks) {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in state change callback:', error);
            }
        }
    }

    public dispose(): void {
        this.stateChangeCallbacks = [];
        this.stateData.clear();
    }

    public update(deltaTime: number): void {
        // 根据当前状态执行特定的更新逻辑
        switch (this.currentState) {
            case GameState.PLAYING:
                this.updatePlayingState(deltaTime);
                break;
            case GameState.LOADING:
                this.updateLoadingState(deltaTime);
                break;
            // 其他状态可能不需要每帧更新
        }
    }

    private updatePlayingState(deltaTime: number): void {
        // 游戏中状态的每帧更新逻辑
        // 例如：检查游戏条件，更新状态计时器等
    }

    private updateLoadingState(deltaTime: number): void {
        // 加载状态的每帧更新逻辑
        // 例如：更新加载进度，检查加载完成条件等
    }

    public getStateName(state: GameState): string {
        return GameState[state];
    }
}