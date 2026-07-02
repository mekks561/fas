/**
 * 成就系统
 * 管理游戏中的成就解锁和奖励发放
 */

export type AchievementCategory =
  'combat' | 'progression' | 'exploration' | 'collection' | 'miscellaneous';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  points: number;
  unlocked: boolean;
  progress: number;
  requiredProgress: number;
  rewards: AchievementReward[];
}

export interface AchievementReward {
  type: 'score' | 'health' | 'shield' | 'weapon' | 'skin';
  value: number | string;
}

export interface AchievementProgress {
  achievementId: string;
  progress: number;
  unlocked: boolean;
  unlockedAt?: number;
}

export class AchievementSystem {
  private achievements: Map<string, Achievement> = new Map();
  private progress: Map<string, AchievementProgress> = new Map();
  private listeners: Set<(achievement: Achievement) => void> = new Set();

  constructor() {
    this.initializeAchievements();
    this.loadProgress();
  }

  private initializeAchievements(): void {
    const achievements: Achievement[] = [
      {
        id: 'first_blood',
        name: 'First Blood',
        description: 'Defeat your first enemy',
        category: 'combat',
        icon: 'sword',
        points: 10,
        unlocked: false,
        progress: 0,
        requiredProgress: 1,
        rewards: [{ type: 'score', value: 500 }],
      },
      {
        id: 'killer',
        name: 'Killer',
        description: 'Defeat 10 enemies',
        category: 'combat',
        icon: 'skull',
        points: 25,
        unlocked: false,
        progress: 0,
        requiredProgress: 10,
        rewards: [{ type: 'score', value: 1000 }],
      },
      {
        id: 'massacre',
        name: 'Massacre',
        description: 'Defeat 50 enemies',
        category: 'combat',
        icon: 'skull-crossbones',
        points: 50,
        unlocked: false,
        progress: 0,
        requiredProgress: 50,
        rewards: [{ type: 'score', value: 5000 }],
      },
      {
        id: 'survivor',
        name: 'Survivor',
        description: 'Survive 5 waves',
        category: 'progression',
        icon: 'shield',
        points: 30,
        unlocked: false,
        progress: 0,
        requiredProgress: 5,
        rewards: [{ type: 'health', value: 20 }],
      },
      {
        id: 'wave_master',
        name: 'Wave Master',
        description: 'Complete 10 waves',
        category: 'progression',
        icon: 'trophy',
        points: 50,
        unlocked: false,
        progress: 0,
        requiredProgress: 10,
        rewards: [{ type: 'shield', value: 30 }],
      },
      {
        id: 'boss_slayer',
        name: 'Boss Slayer',
        description: 'Defeat a boss',
        category: 'combat',
        icon: 'medal',
        points: 100,
        unlocked: false,
        progress: 0,
        requiredProgress: 1,
        rewards: [{ type: 'score', value: 10000 }],
      },
      {
        id: 'speed_demon',
        name: 'Speed Demon',
        description: 'Reach max speed',
        category: 'miscellaneous',
        icon: 'bolt',
        points: 20,
        unlocked: false,
        progress: 0,
        requiredProgress: 1,
        rewards: [{ type: 'score', value: 500 }],
      },
      {
        id: 'treasure_hunter',
        name: 'Treasure Hunter',
        description: 'Collect 10 power-ups',
        category: 'collection',
        icon: 'gem',
        points: 35,
        unlocked: false,
        progress: 0,
        requiredProgress: 10,
        rewards: [{ type: 'score', value: 2000 }],
      },
      {
        id: 'perfect_run',
        name: 'Perfect Run',
        description: 'Complete a wave without taking damage',
        category: 'combat',
        icon: 'star',
        points: 40,
        unlocked: false,
        progress: 0,
        requiredProgress: 1,
        rewards: [{ type: 'health', value: 50 }],
      },
      {
        id: 'millionaire',
        name: 'Millionaire',
        description: 'Reach 1,000,000 points',
        category: 'progression',
        icon: 'coin',
        points: 100,
        unlocked: false,
        progress: 0,
        requiredProgress: 1000000,
        rewards: [{ type: 'score', value: 100000 }],
      },
    ];

    achievements.forEach((achievement) => {
      this.achievements.set(achievement.id, achievement);
    });
  }

  private loadProgress(): void {
    const saved = localStorage.getItem('achievements');
    if (saved) {
      try {
        const data = JSON.parse(saved) as AchievementProgress[];
        data.forEach((p) => {
          this.progress.set(p.achievementId, p);
          const achievement = this.achievements.get(p.achievementId);
          if (achievement && p.unlocked) {
            achievement.unlocked = true;
            achievement.progress = p.progress;
          }
        });
      } catch {
        console.warn('Failed to load achievement progress');
      }
    }
  }

  private saveProgress(): void {
    const data = Array.from(this.progress.values());
    localStorage.setItem('achievements', JSON.stringify(data));
  }

  public getAchievement(id: string): Achievement | undefined {
    return this.achievements.get(id);
  }

  public getAllAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  public getAchievementsByCategory(category: AchievementCategory): Achievement[] {
    return Array.from(this.achievements.values()).filter((a) => a.category === category);
  }

  public getUnlockedAchievements(): Achievement[] {
    return Array.from(this.achievements.values()).filter((a) => a.unlocked);
  }

  public getLockedAchievements(): Achievement[] {
    return Array.from(this.achievements.values()).filter((a) => !a.unlocked);
  }

  public updateProgress(id: string, amount: number): Achievement | null {
    const achievement = this.achievements.get(id);
    if (!achievement) return null;

    if (achievement.unlocked) return achievement;

    const currentProgress = this.progress.get(id)?.progress || 0;
    const newProgress = Math.min(achievement.requiredProgress, currentProgress + amount);

    this.progress.set(id, {
      achievementId: id,
      progress: newProgress,
      unlocked: newProgress >= achievement.requiredProgress,
    });

    achievement.progress = newProgress;

    if (newProgress >= achievement.requiredProgress && !achievement.unlocked) {
      achievement.unlocked = true;
      const progressEntry = this.progress.get(id);
      if (progressEntry) {
        progressEntry.unlocked = true;
        progressEntry.unlockedAt = Date.now();
      }

      this.saveProgress();
      this.listeners.forEach((listener) => listener(achievement));
    }

    return achievement;
  }

  public addKill(): Achievement | null {
    return (
      this.updateProgress('first_blood', 1) ||
      this.updateProgress('killer', 1) ||
      this.updateProgress('massacre', 1)
    );
  }

  public addWaveComplete(): Achievement | null {
    return this.updateProgress('survivor', 1) || this.updateProgress('wave_master', 1);
  }

  public addBossKill(): Achievement | null {
    return this.updateProgress('boss_slayer', 1);
  }

  public addPowerUp(): Achievement | null {
    return this.updateProgress('treasure_hunter', 1);
  }

  public addScore(points: number): Achievement | null {
    return this.updateProgress('millionaire', points);
  }

  public markPerfectWave(): Achievement | null {
    return this.updateProgress('perfect_run', 1);
  }

  public markSpeedAchievement(): Achievement | null {
    return this.updateProgress('speed_demon', 1);
  }

  public getRewards(id: string): AchievementReward[] {
    const achievement = this.achievements.get(id);
    return achievement?.rewards || [];
  }

  public onAchievementUnlocked(listener: (achievement: Achievement) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public getTotalPoints(): number {
    return Array.from(this.achievements.values())
      .filter((a) => a.unlocked)
      .reduce((sum, a) => sum + a.points, 0);
  }

  public resetProgress(): void {
    this.progress.clear();
    this.achievements.forEach((a) => {
      a.unlocked = false;
      a.progress = 0;
    });
    this.saveProgress();
  }
}
