import Dexie, { Table } from 'dexie';
import { PlayerProgress, GameSettings, LeaderboardEntry } from './CloudSaveSystem';

export interface GameSession {
  id: string;
  playerId: string;
  wave: number;
  score: number;
  kills: number;
  health: number;
  shield: number;
  timestamp: number;
  isCompleted: boolean;
}

export interface GameResource {
  id: string;
  filename: string;
  data: ArrayBuffer;
  type: string;
  size: number;
  timestamp: number;
}

export interface AchievementRecord {
  id: string;
  playerId: string;
  achievementId: string;
  unlockedAt: number;
  progress: number;
  total: number;
}

export interface SkillProgress {
  id: string;
  playerId: string;
  skillId: string;
  level: number;
  experience: number;
}

export interface WeaponProgress {
  id: string;
  playerId: string;
  weaponId: string;
  level: number;
  experience: number;
}

export class GameDatabase extends Dexie {
  playerProgress!: Table<PlayerProgress, string>;
  gameSessions!: Table<GameSession, string>;
  leaderboard!: Table<LeaderboardEntry, string>;
  resources!: Table<GameResource, string>;
  achievements!: Table<AchievementRecord, string>;
  skills!: Table<SkillProgress, string>;
  weapons!: Table<WeaponProgress, string>;

  constructor() {
    super('FighterGameDB');

    this.version(1).stores({
      playerProgress: 'playerId, playerName, level, highestScore, highestWave, lastUpdated',
      gameSessions: 'id, playerId, timestamp, wave, isCompleted',
      leaderboard: 'id, playerId, score, wave, timestamp',
      resources: 'id, filename, type, timestamp',
      achievements: 'id, playerId, achievementId',
      skills: 'id, playerId, skillId',
      weapons: 'id, playerId, weaponId',
    });

    this.on('populate', () => this.populateInitialData());
  }

  private async populateInitialData(): Promise<void> {
    const defaultSettings: GameSettings = {
      masterVolume: 0.8,
      musicVolume: 0.6,
      sfxVolume: 0.8,
      difficulty: 'normal',
      quality: 'high',
      showFPS: false,
      showDamageNumbers: true,
      cameraShake: true,
      screenFlash: true,
      touchControls: true,
    };

    const defaultProgress: PlayerProgress = {
      playerId: 'default_player',
      playerName: 'Player',
      level: 1,
      totalScore: 0,
      highestScore: 0,
      highestWave: 0,
      totalPlayTime: 0,
      totalKills: 0,
      totalDeaths: 0,
      achievementsUnlocked: [],
      unlockedLevels: [1],
      levelStars: {},
      settings: defaultSettings,
      lastUpdated: Date.now(),
      version: '1.0.0',
    };

    await this.playerProgress.add(defaultProgress);
  }

  public async savePlayerProgress(progress: PlayerProgress): Promise<void> {
    progress.lastUpdated = Date.now();
    await this.playerProgress.put(progress);
  }

  public async getPlayerProgress(playerId: string): Promise<PlayerProgress | undefined> {
    return this.playerProgress.get(playerId);
  }

  public async getAllPlayerProgress(): Promise<PlayerProgress[]> {
    return this.playerProgress.toArray();
  }

  public async updatePlayerSettings(
    playerId: string,
    settings: Partial<GameSettings>,
  ): Promise<void> {
    const progress = await this.playerProgress.get(playerId);
    if (progress) {
      progress.settings = { ...progress.settings, ...settings };
      progress.lastUpdated = Date.now();
      await this.playerProgress.put(progress);
    }
  }

  public async addAchievement(playerId: string, achievementId: string): Promise<boolean> {
    const progress = await this.playerProgress.get(playerId);
    if (!progress) return false;

    if (progress.achievementsUnlocked.includes(achievementId)) return false;

    progress.achievementsUnlocked.push(achievementId);
    progress.lastUpdated = Date.now();
    await this.playerProgress.put(progress);

    const record: AchievementRecord = {
      id: `${playerId}_${achievementId}`,
      playerId,
      achievementId,
      unlockedAt: Date.now(),
      progress: 1,
      total: 1,
    };
    await this.achievements.put(record);

    return true;
  }

  public async saveGameSession(session: GameSession): Promise<void> {
    session.timestamp = Date.now();
    await this.gameSessions.put(session);
  }

  public async getRecentSessions(playerId: string, limit: number = 10): Promise<GameSession[]> {
    return this.gameSessions.where('playerId').equals(playerId).reverse().limit(limit).toArray();
  }

  public async getBestSession(playerId: string): Promise<GameSession | undefined> {
    return this.gameSessions
      .where('playerId')
      .equals(playerId)
      .and((session) => session.isCompleted)
      .reverse()
      .sortBy('score')
      .then((sessions) => sessions[sessions.length - 1]);
  }

  public async saveLeaderboardEntry(entry: Omit<LeaderboardEntry, 'id'>): Promise<void> {
    const fullEntry: LeaderboardEntry = {
      ...entry,
      id: `${entry.playerId}_${entry.timestamp}`,
    };
    await this.leaderboard.put(fullEntry);
  }

  public async getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
    const entries = await this.leaderboard
      .reverse()
      .sortBy('score')
      .then((sorted) => sorted.reverse());

    return entries.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  public async getPlayerRank(playerId: string): Promise<number> {
    const leaderboard = await this.getLeaderboard(1000);
    const entry = leaderboard.find((e) => e.playerId === playerId);
    return entry?.rank || 0;
  }

  public async saveResource(resource: Omit<GameResource, 'id' | 'timestamp'>): Promise<string> {
    const id = `${resource.filename}_${Date.now()}`;
    const fullResource: GameResource = {
      ...resource,
      id,
      timestamp: Date.now(),
    };
    await this.resources.put(fullResource);
    return id;
  }

  public async getResource(filename: string): Promise<GameResource | undefined> {
    return this.resources.where('filename').equals(filename).first();
  }

  public async deleteResource(filename: string): Promise<void> {
    const resource = await this.getResource(filename);
    if (resource) {
      await this.resources.delete(resource.id);
    }
  }

  public async clearOldResources(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    const oldResources = await this.resources.where('timestamp').below(cutoff).toArray();
    for (const resource of oldResources) {
      await this.resources.delete(resource.id);
    }
  }

  public async saveSkillProgress(
    playerId: string,
    skillId: string,
    level: number,
    experience: number,
  ): Promise<void> {
    const record: SkillProgress = {
      id: `${playerId}_${skillId}`,
      playerId,
      skillId,
      level,
      experience,
    };
    await this.skills.put(record);
  }

  public async getSkillProgress(
    playerId: string,
    skillId: string,
  ): Promise<SkillProgress | undefined> {
    return this.skills.get(`${playerId}_${skillId}`);
  }

  public async getAllSkillProgress(playerId: string): Promise<SkillProgress[]> {
    return this.skills.where('playerId').equals(playerId).toArray();
  }

  public async saveWeaponProgress(
    playerId: string,
    weaponId: string,
    level: number,
    experience: number,
  ): Promise<void> {
    const record: WeaponProgress = {
      id: `${playerId}_${weaponId}`,
      playerId,
      weaponId,
      level,
      experience,
    };
    await this.weapons.put(record);
  }

  public async getWeaponProgress(
    playerId: string,
    weaponId: string,
  ): Promise<WeaponProgress | undefined> {
    return this.weapons.get(`${playerId}_${weaponId}`);
  }

  public async getAllWeaponProgress(playerId: string): Promise<WeaponProgress[]> {
    return this.weapons.where('playerId').equals(playerId).toArray();
  }

  public async deletePlayerData(playerId: string): Promise<void> {
    await this.playerProgress.delete(playerId);
    await this.gameSessions.where('playerId').equals(playerId).delete();
    await this.achievements.where('playerId').equals(playerId).delete();
    await this.skills.where('playerId').equals(playerId).delete();
    await this.weapons.where('playerId').equals(playerId).delete();
  }

  public async getDatabaseSize(): Promise<number> {
    const resources = await this.resources.toArray();
    return resources.reduce((total, r) => total + r.size, 0);
  }

  public async clearAll(): Promise<void> {
    await this.playerProgress.clear();
    await this.gameSessions.clear();
    await this.leaderboard.clear();
    await this.resources.clear();
    await this.achievements.clear();
    await this.skills.clear();
    await this.weapons.clear();
  }
}

export const gameDatabase = new GameDatabase();
