export interface ScoreEntry {
    name: string;
    score: number;
    date: string;
    level: number;
}

export class ScoreSystem {
    private currentScore: number = 0;
    private highScores: ScoreEntry[] = [];
    private scoreMultiplier: number = 1;
    private multiplierTimeLeft: number = 0;
    private baseKillScore: number = 100;
    private storageKey: string = 'fighterGameHighScores';

    constructor() {
        this.loadHighScores();
    }

    private loadHighScores(): void {
        try {
            const storedScores = localStorage.getItem(this.storageKey);
            if (storedScores) {
                this.highScores = JSON.parse(storedScores);
                this.highScores.sort((a, b) => b.score - a.score);
            }
        } catch (error) {
            console.error('Failed to load high scores:', error);
            this.highScores = [];
        }
    }

    private saveHighScores(): void {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.highScores));
        } catch (error) {
            console.error('Failed to save high scores:', error);
        }
    }

    public addScore(points: number): number {
        const totalPoints = Math.floor(points * this.scoreMultiplier);
        this.currentScore += totalPoints;
        return totalPoints;
    }

    public addKillScore(enemyLevel: number = 1): number {
        const points = this.baseKillScore * enemyLevel;
        return this.addScore(points);
    }

    public setMultiplier(multiplier: number, duration: number): void {
        this.scoreMultiplier = multiplier;
        this.multiplierTimeLeft = duration;
    }

    public update(deltaTime: number): void {
        if (this.multiplierTimeLeft > 0) {
            this.multiplierTimeLeft -= deltaTime;
            if (this.multiplierTimeLeft <= 0) {
                this.scoreMultiplier = 1;
                this.multiplierTimeLeft = 0;
            }
        }
    }

    public getCurrentScore(): number {
        return this.currentScore;
    }

    public getScoreMultiplier(): number {
        return this.scoreMultiplier;
    }

    public getMultiplierTimeLeft(): number {
        return this.multiplierTimeLeft;
    }

    public resetScore(): void {
        this.currentScore = 0;
        this.scoreMultiplier = 1;
        this.multiplierTimeLeft = 0;
    }

    public addHighScore(name: string, level: number = 1): boolean {
        if (this.currentScore <= 0) return false;

        const newScore: ScoreEntry = {
            name: name || 'Player',
            score: this.currentScore,
            date: new Date().toISOString(),
            level: level
        };

        this.highScores.push(newScore);
        this.highScores.sort((a, b) => b.score - a.score);
        
        // 只保留前10名
        if (this.highScores.length > 10) {
            this.highScores = this.highScores.slice(0, 10);
        }

        this.saveHighScores();
        
        // 检查是否是新的最高分
        return this.highScores[0].score === this.currentScore;
    }

    public getHighScores(): ScoreEntry[] {
        return [...this.highScores];
    }

    public getHighScore(): number {
        return this.highScores.length > 0 ? this.highScores[0].score : 0;
    }

    public isHighScore(score: number): boolean {
        if (this.highScores.length < 10) return true;
        // 数组按降序排序，最后一个元素是最低分
        // 检查分数是否大于最低分
        return score > this.highScores[this.highScores.length - 1].score;
    }

    public clearHighScores(): void {
        this.highScores = [];
        this.saveHighScores();
    }

    public formatScore(score: number): string {
        return score.toLocaleString('en-US', { minimumIntegerDigits: 6, useGrouping: true });
    }

    public exportHighScores(): string {
        return JSON.stringify(this.highScores, null, 2);
    }

    public importHighScores(data: string): boolean {
    try {
      const importedScores = JSON.parse(data);
      if (Array.isArray(importedScores)) {
        // 验证每个元素是否符合ScoreEntry接口的要求
        const validScores = importedScores.filter(score => {
          return (
            typeof score === 'object' &&
            score !== null &&
            typeof score.name === 'string' &&
            typeof score.score === 'number' &&
            typeof score.date === 'string' &&
            typeof score.level === 'number' &&
            !isNaN(Date.parse(score.date)) // 验证日期格式是否有效
          );
        });
        
        if (validScores.length > 0) {
          this.highScores = validScores;
          this.highScores.sort((a, b) => b.score - a.score);
          this.saveHighScores();
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to import high scores:', error);
    }
    return false;
  }

  public dispose(): void {
    // ScoreSystem 不需要特殊清理，此方法保持接口一致性
  }
}