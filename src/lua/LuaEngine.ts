import * as wasmoon from 'wasmoon';
import type { LuaEngineOptions, LuaScriptModule } from './types';

interface LuaState {
  doString: (script: string) => void;
  onError?: (error: Error) => void;
  global: {
    get: <T = unknown>(name: string) => T;
    set: (name: string, value: unknown) => void;
  };
  close: () => void;
  getStubModule?: (moduleName: string) => unknown;
}

export class LuaEngine {
  private lua: LuaState | null = null;
  private initialized = false;
  private debug = false;
  private forceStub = false;
  private registeredModules: Map<string, string> = new Map();

  constructor(options: LuaEngineOptions = {}) {
    this.debug = options.debug ?? false;
    this.forceStub = options.forceStub ?? false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[LuaEngine] Already initialized');
      return;
    }

    try {
      const factory = (wasmoon as unknown as { factory: { create: () => Promise<LuaState> } }).factory;
      if (!this.forceStub && factory) {
        this.lua = await factory.create();
      } else {
        this.lua = this.createStubLuaState();
        console.warn('[LuaEngine] Using stub mode');
      }
      this.setupDefaultLibs();
      this.setupErrorHandler();
      this.initialized = true;
      console.log('[LuaEngine] Initialized successfully');
    } catch (error) {
      console.error('[LuaEngine] Failed to initialize:', error);
      throw error;
    }
  }

  private createStubLuaState(): LuaState {
    const globalVars: Record<string, unknown> = {};
    const moduleCache: Record<string, unknown> = {};

    const waveState = {
      waveNumber: 1,
      maxWaves: 10,
      currentState: 'waiting' as const,
      enemiesSpawned: 0,
      enemiesDefeated: 0,
      enemiesRemaining: 5,
      elapsedTime: 0,
      difficulty: 'normal' as const,
      isBossWave: false,
      isEliteWave: false,
      progress: 0,
      spawnedEnemyTypes: [] as string[],
    };

    const combatStats = {
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      damageTaken: 0,
      damageHealed: 0,
      skillsUsed: 0,
      skillsHit: 0,
      powerupsCollected: 0,
      projectilesFired: 0,
      projectilesHit: 0,
      comboMax: 0,
      comboCurrent: 0,
      comboTotal: 0,
      accuracy: 0,
      playTime: 0,
      wavesCompleted: 0,
      bossesKilled: 0,
      elitesKilled: 0,
      score: 0,
      rank: 'D' as string,
      enemiesDefeated: {} as Record<string, number>,
      skillsUsedBreakdown: {} as Record<string, number>,
    };

    const activePowerups: Array<{ id: number; type: string; displayName: string; duration: number; remainingDuration: number; stacks: number; multiplier: number; progress: number }> = [];
    let powerupIdCounter = 0;

    const calculateRank = (score: number): string => {
      if (score >= 10000) return 'S';
      if (score >= 5000) return 'A';
      if (score >= 2500) return 'B';
      if (score >= 1000) return 'C';
      return 'D';
    };

    const waveManagerModule = {
      getWaveState: () => ({
        success: true,
        state: { ...waveState, progress: waveState.enemiesDefeated / (waveState.enemiesDefeated + waveState.enemiesRemaining) || 0 },
      }),
      setDifficulty: (difficulty: string) => { waveState.difficulty = difficulty as typeof waveState.difficulty; return { success: true }; },
      setMaxWaves: (maxWaves: number) => { waveState.maxWaves = maxWaves; return { success: true }; },
      calculateEnemyCount: (waveNumber: number) => {
        const baseCount = 5;
        const growthFactor = 1.1;
        const diffMult = { easy: 0.8, normal: 1.0, hard: 1.2, nightmare: 1.5 }[waveState.difficulty];
        let count = Math.floor(baseCount * Math.pow(growthFactor, waveNumber - 1) * diffMult);
        if (waveNumber % 5 === 0) count = Math.max(1, Math.floor(count * 0.3));
        else if (waveNumber % 3 === 0) count = Math.floor(count * 0.8);
        return { success: true, count };
      },
      isBossWave: (waveNumber: number) => ({ success: true, isBoss: waveNumber % 5 === 0 }),
      isEliteWave: (waveNumber: number) => ({ success: true, isElite: waveNumber % 3 === 0 && waveNumber % 5 !== 0 }),
      generateEnemyTypes: (waveNumber: number) => {
        const types: string[] = [];
        if (waveNumber % 5 === 0) {
          types.push('boss');
        } else {
          const availableTypes = ['basic'];
          if (waveNumber >= 2) availableTypes.push('fast');
          if (waveNumber >= 3) availableTypes.push('shooter');
          if (waveNumber >= 4) availableTypes.push('tank');
          if (waveNumber % 3 === 0) availableTypes.push('elite');
          const count = 5 + Math.floor(waveNumber * 1.5);
          for (let i = 0; i < count; i++) {
            types.push(availableTypes[Math.floor(Math.random() * availableTypes.length)]);
          }
        }
        return { success: true, enemyTypes: types };
      },
      getEnemyConfig: (enemyType: string) => {
        const templates: Record<string, { type: string; health: number; damage: number; speed: number; score: number }> = {
          basic: { type: 'basic', health: 50, damage: 10, speed: 2.0, score: 100 },
          fast: { type: 'fast', health: 30, damage: 8, speed: 4.0, score: 150 },
          tank: { type: 'tank', health: 100, damage: 15, speed: 1.0, score: 250 },
          shooter: { type: 'shooter', health: 40, damage: 12, speed: 1.5, score: 200 },
          elite: { type: 'elite', health: 200, damage: 25, speed: 2.5, score: 500 },
          boss: { type: 'boss', health: 1000, damage: 30, speed: 1.5, score: 2000 },
        };
        const template = templates[enemyType];
        if (!template) return { success: false, error: 'unknown enemy type' };
        const waveMult = Math.pow(1.15, waveState.waveNumber - 1);
        const diffMult = { easy: 0.8, normal: 1.0, hard: 1.2, nightmare: 1.5 }[waveState.difficulty];
        return {
          success: true,
          config: {
            type: template.type,
            health: Math.floor(template.health * waveMult * diffMult),
            damage: Math.floor(template.damage * waveMult * diffMult),
            speed: template.speed * diffMult,
            score: Math.floor(template.score * waveMult),
            isBoss: enemyType === 'boss',
            isElite: enemyType === 'elite',
          },
        };
      },
      startWave: (waveNumber: number) => {
        const isBoss = waveNumber % 5 === 0;
        const isElite = waveNumber % 3 === 0 && !isBoss;
        const enemyCount = 5 + Math.floor(waveNumber * 1.5);
        const types: string[] = [];
        for (let i = 0; i < enemyCount; i++) types.push('basic');
        waveState.waveNumber = waveNumber;
        waveState.currentState = 'active';
        waveState.enemiesSpawned = 0;
        waveState.enemiesDefeated = 0;
        waveState.enemiesRemaining = enemyCount;
        waveState.elapsedTime = 0;
        waveState.isBossWave = isBoss;
        waveState.isEliteWave = isElite;
        waveState.spawnedEnemyTypes = types;
        return { success: true, waveNumber, enemyCount, isBossWave: isBoss, isEliteWave: isElite, enemyTypes: types };
      },
      spawnNextEnemy: () => {
        if (waveState.currentState !== 'active') return { success: false, error: 'wave is not active' };
        if (waveState.enemiesSpawned >= waveState.spawnedEnemyTypes.length) return { success: false, error: 'no more enemies to spawn' };
        waveState.enemiesSpawned++;
        const enemyType = waveState.spawnedEnemyTypes[waveState.enemiesSpawned - 1];
        const configResult = waveManagerModule.getEnemyConfig(enemyType);
        if (!configResult.success) return configResult;
        return { success: true, enemy: configResult.config, spawnIndex: waveState.enemiesSpawned, totalToSpawn: waveState.spawnedEnemyTypes.length };
      },
      onEnemyDefeated: (enemyType: string) => {
        if (waveState.currentState !== 'active') return { success: false, error: 'wave is not active' };
        waveState.enemiesDefeated++;
        waveState.enemiesRemaining--;
        const isWaveComplete = waveState.enemiesRemaining <= 0;
        if (isWaveComplete) waveState.currentState = 'completed';
        const templates: Record<string, number> = { basic: 100, fast: 150, tank: 250, shooter: 200, elite: 500, boss: 2000 };
        return { success: true, enemiesDefeated: waveState.enemiesDefeated, enemiesRemaining: waveState.enemiesRemaining, isWaveComplete, score: templates[enemyType] || 100 };
      },
      pauseWave: () => { if (waveState.currentState !== 'active') return { success: false, error: 'wave is not active' }; waveState.currentState = 'paused'; return { success: true }; },
      resumeWave: () => { if (waveState.currentState !== 'paused') return { success: false, error: 'wave is not paused' }; waveState.currentState = 'active'; return { success: true }; },
      update: (deltaTime: number) => { if (waveState.currentState === 'active') waveState.elapsedTime += deltaTime; return { success: true, elapsedTime: waveState.elapsedTime, state: waveState.currentState, enemiesRemaining: waveState.enemiesRemaining }; },
      reset: () => { waveState.waveNumber = 1; waveState.currentState = 'waiting'; waveState.enemiesSpawned = 0; waveState.enemiesDefeated = 0; waveState.enemiesRemaining = 0; waveState.elapsedTime = 0; waveState.isBossWave = false; waveState.isEliteWave = false; waveState.spawnedEnemyTypes = []; return { success: true }; },
      getNextWaveNumber: () => ({ success: true, waveNumber: waveState.waveNumber + 1 }),
      getWaveScoreMultiplier: () => ({ success: true, multiplier: 1.0 + waveState.waveNumber * 0.1 }),
    };

    const powerupSystemModule = {
      getPowerupTypes: () => ({ success: true, types: [{ name: 'health', displayName: 'Health', type: 'instant', duration: 0 }, { name: 'speed', displayName: 'Speed', type: 'duration', duration: 8.0 }, { name: 'damage', displayName: 'Damage', type: 'duration', duration: 8.0 }] }),
      getPowerupConfig: (powerupType: string) => ({ success: true, config: { name: powerupType, displayName: powerupType.charAt(0).toUpperCase() + powerupType.slice(1), type: powerupType === 'health' ? 'instant' : 'duration', value: 25, duration: 8.0, multiplier: 2.0, stackRule: 'extend', maxStacks: 1, stat: powerupType } }),
      applyPowerup: (powerupType: string, params?: Record<string, unknown>) => {
        if (powerupType === 'health') return { success: true, powerupType, config: { name: 'health', type: 'instant', stat: 'health' }, effects: [{ effectType: 'add', stat: 'health', value: 25 }], powerupId: null };
        powerupIdCounter++;
        const newPowerup = { id: powerupIdCounter, type: powerupType, displayName: powerupType.charAt(0).toUpperCase() + powerupType.slice(1), duration: 8.0, remainingDuration: 8.0, stacks: 1, multiplier: 2.0, progress: 1.0 };
        activePowerups.push(newPowerup);
        return { success: true, powerupType, config: { name: powerupType, type: 'duration', stat: powerupType }, effects: [{ effectType: 'multiply', stat: powerupType, multiplier: 2.0 }], powerupId: powerupIdCounter };
      },
      getActivePowerups: () => ({ success: true, powerups: activePowerups.filter(p => p.remainingDuration > 0) }),
      update: (deltaTime: number) => {
        const expired: Array<{ id: number; type: string; expired: boolean }> = [];
        for (let i = activePowerups.length - 1; i >= 0; i--) {
          activePowerups[i].remainingDuration -= deltaTime;
          if (activePowerups[i].remainingDuration <= 0) { expired.push({ id: activePowerups[i].id, type: activePowerups[i].type, expired: true }); activePowerups.splice(i, 1); }
        }
        return { success: true, expired, activeCount: activePowerups.length };
      },
      removePowerup: (powerupId: number) => { for (let i = 0; i < activePowerups.length; i++) { if (activePowerups[i].id === powerupId) { activePowerups.splice(i, 1); return { success: true }; } } return { success: false }; },
      removeAllPowerups: () => { activePowerups.length = 0; powerupIdCounter = 0; return { success: true }; },
      hasActivePowerup: (powerupType: string) => ({ success: true, has: activePowerups.some(p => p.type === powerupType && p.remainingDuration > 0) }),
      getPowerupMultiplier: (powerupType: string) => { const p = activePowerups.find(p => p.type === powerupType && p.remainingDuration > 0); return { success: true, multiplier: p ? p.multiplier : 1.0, stacks: p ? p.stacks : 0 }; },
      getPowerupRemainingDuration: (powerupType: string) => { const p = activePowerups.find(p => p.type === powerupType && p.remainingDuration > 0); if (!p) return { success: true, remainingDuration: 0, totalDuration: 0, progress: 0 }; return { success: true, remainingDuration: p.remainingDuration, totalDuration: p.duration, progress: p.remainingDuration / p.duration }; },
      generateRandomPowerup: () => ({ success: true, powerupType: 'health', config: { name: 'health', stat: 'health' } }),
      reset: () => { activePowerups.length = 0; powerupIdCounter = 0; return { success: true }; },
    };

    const combatStatsModule = {
      getStats: () => ({ success: true, stats: { ...combatStats } }),
      onKill: (enemyType: string, isBoss: boolean, isElite: boolean) => {
        combatStats.kills++; combatStats.comboCurrent++; combatStats.comboTotal++;
        if (combatStats.comboCurrent > combatStats.comboMax) combatStats.comboMax = combatStats.comboCurrent;
        if (isBoss) combatStats.bossesKilled++; else if (isElite) combatStats.elitesKilled++;
        combatStats.enemiesDefeated[enemyType] = (combatStats.enemiesDefeated[enemyType] || 0) + 1;
        return { success: true, kills: combatStats.kills, comboCurrent: combatStats.comboCurrent, comboMax: combatStats.comboMax };
      },
      onDeath: () => { combatStats.deaths++; combatStats.comboCurrent = 0; return { success: true, deaths: combatStats.deaths }; },
      addDamageDealt: (damage: number) => { combatStats.damageDealt += damage; return { success: true, damageDealt: combatStats.damageDealt }; },
      addDamageTaken: (damage: number) => { combatStats.damageTaken += damage; return { success: true, damageTaken: combatStats.damageTaken }; },
      addDamageHealed: (healAmount: number) => { combatStats.damageHealed += healAmount; return { success: true, damageHealed: combatStats.damageHealed }; },
      onSkillUse: (skillId: string, hit: boolean) => {
        combatStats.skillsUsed++; if (hit) combatStats.skillsHit++;
        const total = combatStats.projectilesFired + combatStats.skillsUsed;
        combatStats.accuracy = total > 0 ? Math.floor((combatStats.projectilesHit + combatStats.skillsHit) / total * 100) : 0;
        return { success: true, skillsUsed: combatStats.skillsUsed, skillsHit: combatStats.skillsHit, accuracy: combatStats.accuracy };
      },
      onPowerupCollected: (powerupType: string) => { combatStats.powerupsCollected++; return { success: true, powerupsCollected: combatStats.powerupsCollected }; },
      onProjectileFired: () => { combatStats.projectilesFired++; return { success: true, projectilesFired: combatStats.projectilesFired }; },
      onProjectileHit: () => { combatStats.projectilesHit++; return { success: true, projectilesHit: combatStats.projectilesHit }; },
      updateCombo: (deltaTime: number) => { if (combatStats.comboCurrent > 0 && deltaTime > 2) combatStats.comboCurrent = 0; return { success: true, comboCurrent: combatStats.comboCurrent, comboTimer: deltaTime > 2 ? 0 : Math.max(0, 2 - deltaTime), comboTimeout: 2.0 }; },
      addScore: (points: number) => { combatStats.score += points; combatStats.rank = calculateRank(combatStats.score); return { success: true, score: combatStats.score, rank: combatStats.rank }; },
      updatePlayTime: (deltaTime: number) => { combatStats.playTime += deltaTime; return { success: true, playTime: combatStats.playTime }; },
      onWaveCompleted: (waveNumber: number) => { combatStats.wavesCompleted++; return { success: true, wavesCompleted: combatStats.wavesCompleted }; },
      getComboMultiplier: () => { if (combatStats.comboCurrent <= 1) return { success: true, multiplier: 1.0 }; if (combatStats.comboCurrent <= 5) return { success: true, multiplier: 1.5 }; if (combatStats.comboCurrent <= 10) return { success: true, multiplier: 2.0 }; if (combatStats.comboCurrent <= 20) return { success: true, multiplier: 3.0 }; return { success: true, multiplier: 5.0 }; },
      getEfficiency: () => ({ success: true, efficiency: combatStats.playTime > 0 ? Math.floor(combatStats.damageDealt / combatStats.playTime) : 0 }),
      getSurvivalRate: () => { if (combatStats.kills + combatStats.deaths === 0) return { success: true, rate: 0 }; return { success: true, rate: Math.floor((combatStats.kills / (combatStats.kills + combatStats.deaths)) * 100) }; },
      calculateFinalScore: () => {
        const efficiencyResult = combatStatsModule.getEfficiency();
        const efficiencyBonus = efficiencyResult.success ? efficiencyResult.efficiency * 2 : 0;
        const survivalResult = combatStatsModule.getSurvivalRate();
        const survivalBonus = survivalResult.success ? survivalResult.rate * 10 : 0;
        return { success: true, finalScore: combatStats.score + efficiencyBonus + survivalBonus, breakdown: { baseScore: combatStats.score, comboBonus: combatStats.comboMax * 50, accuracyBonus: combatStats.accuracy * 10, efficiencyBonus, survivalBonus } };
      },
      reset: () => { combatStats.kills = 0; combatStats.deaths = 0; combatStats.damageDealt = 0; combatStats.damageTaken = 0; combatStats.damageHealed = 0; combatStats.skillsUsed = 0; combatStats.skillsHit = 0; combatStats.powerupsCollected = 0; combatStats.projectilesFired = 0; combatStats.projectilesHit = 0; combatStats.comboMax = 0; combatStats.comboCurrent = 0; combatStats.comboTotal = 0; combatStats.accuracy = 0; combatStats.playTime = 0; combatStats.wavesCompleted = 0; combatStats.bossesKilled = 0; combatStats.elitesKilled = 0; combatStats.score = 0; combatStats.rank = 'D'; combatStats.enemiesDefeated = {}; combatStats.skillsUsedBreakdown = {}; return { success: true }; },
      getRankThresholds: () => ({ success: true, thresholds: { S: 10000, A: 5000, B: 2500, C: 1000, D: 0 } }),
    };

    moduleCache['wave_manager_module'] = waveManagerModule;
    moduleCache['powerup_system_module'] = powerupSystemModule;
    moduleCache['combat_stats_module'] = combatStatsModule;

    const learnedSkills: Record<string, number> = {};
    const skillCooldowns: Record<string, number> = {};

    const skillSystemModule = {
      learnSkill: (skillId: string, playerLevel: number, learnedSkillIds: string[]): boolean => {
        if (!skillId || playerLevel < 1) return false;
        learnedSkills[skillId] = 1;
        return true;
      },
      upgradeSkill: (skillId: string): [boolean, number] => {
        if (!learnedSkills[skillId]) return [false, 0];
        learnedSkills[skillId]++;
        return [true, learnedSkills[skillId]];
      },
      canCast: (skillId: string, resources: Record<string, number>): { canCast: boolean; reason: string } => {
        if (!learnedSkills[skillId]) return { canCast: false, reason: 'not_learned' };
        if (skillCooldowns[skillId] && skillCooldowns[skillId] > 0) return { canCast: false, reason: 'on_cooldown' };
        return { canCast: true, reason: '' };
      },
      castSkill: (skillId: string, target: unknown, resources: Record<string, number>): { success: boolean; skillId?: string; skillName?: string; effects?: unknown[]; remainingCooldown?: number; costPaid?: number } => {
        if (!learnedSkills[skillId]) return { success: false };
        if (skillCooldowns[skillId] && skillCooldowns[skillId] > 0) return { success: false, remainingCooldown: skillCooldowns[skillId] };
        skillCooldowns[skillId] = 0.5;
        return { success: true, skillId, skillName: skillId, effects: [], remainingCooldown: 0.5, costPaid: 10 };
      },
      updateCooldowns: (deltaTime: number): void => {
        for (const skillId of Object.keys(skillCooldowns)) {
          skillCooldowns[skillId] = Math.max(0, skillCooldowns[skillId] - deltaTime);
        }
      },
      getAllSkillStatus: (): unknown[] => {
        return Object.entries(learnedSkills).map(([id, level]) => ({
          id,
          level,
          maxLevel: 5,
          currentCooldown: skillCooldowns[id] || 0,
          canCast: !skillCooldowns[id] || skillCooldowns[id] <= 0,
        }));
      },
      getSkillStatus: (skillId: string): unknown | null => {
        if (!learnedSkills[skillId]) return null;
        return {
          id: skillId,
          level: learnedSkills[skillId],
          maxLevel: 5,
          currentCooldown: skillCooldowns[skillId] || 0,
          canCast: !skillCooldowns[skillId] || skillCooldowns[skillId] <= 0,
        };
      },
      resetCooldown: (skillId: string): boolean => {
        if (!learnedSkills[skillId]) return false;
        skillCooldowns[skillId] = 0;
        return true;
      },
      resetAllCooldowns: (): void => {
        for (const skillId of Object.keys(skillCooldowns)) {
          skillCooldowns[skillId] = 0;
        }
      },
      isSkillLearned: (skillId: string): boolean => {
        return !!learnedSkills[skillId];
      },
      getSkillLevel: (skillId: string): number => {
        return learnedSkills[skillId] || 0;
      },
      startCombo: (comboName: string): boolean => {
        return true;
      },
      addToCombo: (skillId: string): boolean => {
        return true;
      },
      checkComboReward: (): { success: boolean; comboName: string; reward?: unknown } => {
        return { success: true, comboName: 'test_combo', reward: null };
      },
      getComboState: (): unknown | null => {
        return null;
      },
      reloadScript: (): void => {},
      initialize: (): void => {},
      destroy: (): void => {
        Object.keys(learnedSkills).forEach(key => delete learnedSkills[key]);
        Object.keys(skillCooldowns).forEach(key => delete skillCooldowns[key]);
      },
    };

    moduleCache['skill_system_module'] = skillSystemModule;

    globalVars['SkillSystem'] = {
      learnSkill: (skillId: string, playerLevel: number, learnedSkillIds: string[]): boolean => {
        return skillSystemModule.learnSkill(skillId, playerLevel, learnedSkillIds);
      },
      upgradeSkill: (skillId: string): [boolean, number] => {
        return skillSystemModule.upgradeSkill(skillId);
      },
      canCast: (skillId: string, resources: Record<string, number>): { canCast: boolean; reason: string } => {
        return skillSystemModule.canCast(skillId, resources);
      },
      castSkill: (skillId: string, caster: unknown, target: unknown, resources: Record<string, number>): { success: boolean; skillId?: string; skillName?: string; effects?: unknown[]; remainingCooldown?: number; costPaid?: number } => {
        return skillSystemModule.castSkill(skillId, target, resources);
      },
      updateCooldowns: (deltaTime: number): string[] => {
        const readySkills: string[] = [];
        for (const skillId of Object.keys(skillCooldowns)) {
          skillCooldowns[skillId] = Math.max(0, skillCooldowns[skillId] - deltaTime);
          if (skillCooldowns[skillId] <= 0) {
            readySkills.push(skillId);
            delete skillCooldowns[skillId];
          }
        }
        return readySkills;
      },
      getAllSkillStatus: (): unknown[] => {
        return skillSystemModule.getAllSkillStatus();
      },
      getSkillStatus: (skillId: string): unknown | null => {
        return skillSystemModule.getSkillStatus(skillId);
      },
      canCastSkill: (skillId: string, resources: Record<string, number>): [boolean, string] => {
        if (!learnedSkills[skillId]) return [false, 'skill_not_learned'];
        if (skillCooldowns[skillId] && skillCooldowns[skillId] > 0) return [false, 'skill_not_ready'];
        return [true, 'ready'];
      },
      resetCooldown: (skillId: string): boolean => {
        if (skillCooldowns[skillId]) {
          delete skillCooldowns[skillId];
          return true;
        }
        return false;
      },
      resetAllCooldowns: (): void => {
        skillSystemModule.resetAllCooldowns();
      },
      isSkillLearned: (skillId: string): boolean => {
        return skillSystemModule.isSkillLearned(skillId);
      },
      getSkillLevel: (skillId: string): number => {
        return skillSystemModule.getSkillLevel(skillId);
      },
      startCombo: (comboName: string): boolean => {
        return skillSystemModule.startCombo(comboName);
      },
      addToCombo: (skillId: string): [boolean, string] => {
        return [skillSystemModule.addToCombo(skillId), 'test_combo'];
      },
      checkComboReward: (): { success: boolean; comboName: string; reward?: unknown } => {
        return skillSystemModule.checkComboReward();
      },
      getComboState: (): unknown | null => {
        return skillSystemModule.getComboState();
      },
      checkComboBonus: (): { type: string; multiplier: number } | null => {
        return { type: 'damage', multiplier: 1.5 };
      },
      reloadScript: (): void => {
        skillSystemModule.reloadScript();
      },
      initialize: (): void => {
        skillSystemModule.initialize();
      },
      destroy: (): void => {
        skillSystemModule.destroy();
      },
    };

    globalVars['getWaveState'] = () => {
      const result = waveManagerModule.getWaveState();
      return result.success ? result.state : {};
    };
    globalVars['setDifficulty'] = (difficulty: string) => {
      return waveManagerModule.setDifficulty(difficulty).success;
    };
    globalVars['setMaxWaves'] = (maxWaves: number) => {
      return waveManagerModule.setMaxWaves(maxWaves).success;
    };
    globalVars['calculateEnemyCount'] = (waveNumber: number) => {
      const result = waveManagerModule.calculateEnemyCount(waveNumber);
      return result.success ? result.count : 5;
    };
    globalVars['isBossWave'] = (waveNumber: number) => {
      const result = waveManagerModule.isBossWave(waveNumber);
      return result.success ? result.isBoss : false;
    };
    globalVars['isEliteWave'] = (waveNumber: number) => {
      const result = waveManagerModule.isEliteWave(waveNumber);
      return result.success ? result.isElite : false;
    };
    globalVars['generateEnemyTypes'] = (waveNumber: number) => {
      const result = waveManagerModule.generateEnemyTypes(waveNumber);
      return result.success ? result.enemyTypes : [];
    };
    globalVars['getEnemyConfig'] = (enemyType: string) => {
      const result = waveManagerModule.getEnemyConfig(enemyType);
      return result.success ? result.config : null;
    };
    globalVars['startWave'] = (waveNumber: number) => {
      return waveManagerModule.startWave(waveNumber);
    };
    globalVars['spawnNextEnemy'] = () => {
      return waveManagerModule.spawnNextEnemy();
    };
    globalVars['onEnemyDefeated'] = (enemyType: string) => {
      return waveManagerModule.onEnemyDefeated(enemyType);
    };
    globalVars['pauseWave'] = () => {
      return waveManagerModule.pauseWave().success;
    };
    globalVars['resumeWave'] = () => {
      return waveManagerModule.resumeWave().success;
    };
    globalVars['updateWave'] = (deltaTime: number) => {
      const result = waveManagerModule.update(deltaTime);
      return result.success ? { elapsedTime: result.elapsedTime, state: result.state, enemiesRemaining: result.enemiesRemaining } : { elapsedTime: 0, state: 'waiting', enemiesRemaining: 0 };
    };
    globalVars['resetWaveManager'] = () => {
      return waveManagerModule.reset().success;
    };
    globalVars['getNextWaveNumber'] = () => {
      const result = waveManagerModule.getNextWaveNumber();
      return result.success ? result.waveNumber : null;
    };
    globalVars['getWaveScoreMultiplier'] = () => {
      const result = waveManagerModule.getWaveScoreMultiplier();
      return result.success ? result.multiplier : 1.0;
    };

    globalVars['getPowerupTypes'] = () => {
      const result = powerupSystemModule.getPowerupTypes();
      return result.success ? result.types : [];
    };
    globalVars['getPowerupConfig'] = (powerupType: string) => {
      const result = powerupSystemModule.getPowerupConfig(powerupType);
      return result.success ? result.config : null;
    };
    globalVars['applyPowerup'] = (powerupType: string) => {
      return powerupSystemModule.applyPowerup(powerupType, {});
    };
       globalVars['getActivePowerups'] = () => {
      const result = powerupSystemModule.getActivePowerups();
      return result.success ? result.powerups : [];
    };
    globalVars['updatePowerups'] = (deltaTime: number) => {
      const result = powerupSystemModule.update(deltaTime);
      return result.success ? { expired: result.expired, activeCount: result.activeCount } : { expired: [], activeCount: 0 };
    };
    globalVars['removePowerup'] = (powerupId: number) => {
      return powerupSystemModule.removePowerup(powerupId).success;
    };
    globalVars['removeAllPowerups'] = () => {
      return powerupSystemModule.removeAllPowerups().success;
    };
    globalVars['hasActivePowerup'] = (powerupType: string) => {
      const result = powerupSystemModule.hasActivePowerup(powerupType);
      return result.success ? result.has : false;
    };
    globalVars['getPowerupMultiplier'] = (powerupType: string) => {
      const result = powerupSystemModule.getPowerupMultiplier(powerupType);
      return result.success ? { multiplier: result.multiplier, stacks: result.stacks } : { multiplier: 1.0, stacks: 0 };
    };
    globalVars['getPowerupRemainingDuration'] = (powerupType: string) => {
      const result = powerupSystemModule.getPowerupRemainingDuration(powerupType);
      return result.success ? { remainingDuration: result.remainingDuration, totalDuration: result.totalDuration, progress: result.progress } : { remainingDuration: 0, totalDuration: 0, progress: 0 };
    };
    globalVars['generateRandomPowerup'] = () => {
      const result = powerupSystemModule.generateRandomPowerup();
      return result.success ? { powerupType: result.powerupType, config: result.config } : { powerupType: 'health', config: null };
    };
    globalVars['resetPowerupSystem'] = () => {
      return powerupSystemModule.reset().success;
    };

    globalVars['getStats'] = () => {
      const result = combatStatsModule.getStats();
      return result.success ? { stats: result.stats } : { stats: null };
    };
    globalVars['onKill'] = (enemyType: string, isBoss: boolean, isElite: boolean) => {
      return combatStatsModule.onKill(enemyType, isBoss, isElite);
    };
    globalVars['onDeath'] = () => {
      return combatStatsModule.onDeath();
    };
    globalVars['addDamageDealt'] = (damage: number) => {
      return combatStatsModule.addDamageDealt(damage);
    };
    globalVars['addDamageTaken'] = (damage: number) => {
      return combatStatsModule.addDamageTaken(damage);
    };
    globalVars['addDamageHealed'] = (healAmount: number) => {
      return combatStatsModule.addDamageHealed(healAmount);
    };
    globalVars['onSkillUse'] = (skillId: string, hit: boolean) => {
      return combatStatsModule.onSkillUse(skillId, hit);
    };
    globalVars['onPowerupCollected'] = (powerupType: string) => {
      return combatStatsModule.onPowerupCollected(powerupType);
    };
    globalVars['onProjectileFired'] = () => {
      return combatStatsModule.onProjectileFired();
    };
    globalVars['onProjectileHit'] = () => {
      return combatStatsModule.onProjectileHit();
    };
    globalVars['updateCombo'] = (deltaTime: number) => {
      return combatStatsModule.updateCombo(deltaTime);
    };
    globalVars['addScore'] = (points: number) => {
      return combatStatsModule.addScore(points);
    };
    globalVars['updatePlayTime'] = (deltaTime: number) => {
      return combatStatsModule.updatePlayTime(deltaTime);
    };
    globalVars['onWaveCompleted'] = (waveNumber: number) => {
      return combatStatsModule.onWaveCompleted(waveNumber);
    };
    globalVars['getComboMultiplier'] = () => {
      return combatStatsModule.getComboMultiplier();
    };
    globalVars['getEfficiency'] = () => {
      return combatStatsModule.getEfficiency();
    };
    globalVars['getSurvivalRate'] = () => {
      return combatStatsModule.getSurvivalRate();
    };
    globalVars['calculateFinalScore'] = () => {
      return combatStatsModule.calculateFinalScore();
    };
    globalVars['resetCombatStats'] = () => {
      return combatStatsModule.reset().success;
    };
    globalVars['getRankThresholds'] = () => {
      const result = combatStatsModule.getRankThresholds();
      return result.success ? result.thresholds : {};
    };

    const luaRequire = (moduleName: string): unknown => {
      if (moduleCache[moduleName]) return moduleCache[moduleName];
      return {};
    };

    return {
      doString: () => {},
      global: {
        get: <T = unknown>(name: string): T => {
          if (name === 'require') return luaRequire as T;
          if (name === 'package') return { preload: {} } as T;
          if (name === 'math') return Math as unknown as T;
          if (globalVars[name]) return globalVars[name] as T;
          
          if (name.includes('.')) {
            const parts = name.split('.');
            let result: unknown = globalVars;
            for (const part of parts) {
              if (result && typeof result === 'object' && part in result) {
                result = (result as Record<string, unknown>)[part];
              } else {
                result = undefined;
                break;
              }
            }
            return result as T;
          }
          
          return {} as T;
        },
        set: (name: string, value: unknown) => { globalVars[name] = value; },
      },
      close: () => {},
      getStubModule: (moduleName: string) => {
        console.log(`[LuaEngine stub] getStubModule('${moduleName}')`);
        if (moduleName === 'wave_manager_module') return waveManagerModule;
        if (moduleName === 'powerup_system_module') return powerupSystemModule;
        if (moduleName === 'combat_stats_module') return combatStatsModule;
        return moduleCache[moduleName];
      },
    };
  }

  private setupDefaultLibs(): void {
    if (!this.lua) return;
  }

  private setupErrorHandler(): void {
    if (!this.lua) return;
  }

  async loadScript(module: LuaScriptModule): Promise<void> {
    if (!this.lua) {
      throw new Error('[LuaEngine] Not initialized');
    }

    try {
      this.lua.doString(module.code);
      this.registeredModules.set(module.name, module.path);
      console.log(`[LuaEngine] Loaded script: ${module.name}`);
    } catch (error) {
      console.error(`[LuaEngine] Failed to load script ${module.name}:`, error);
      throw error;
    }
  }

  call<T = unknown>(functionName: string, ...args: unknown[]): T | undefined {
    if (!this.lua) {
      console.error('[LuaEngine] Not initialized');
      return undefined;
    }

    try {
      const func = this.lua.global.get<(...args: unknown[]) => T>(functionName);
      if (typeof func !== 'function') {
        console.error(`[LuaEngine] Function ${functionName} not found`);
        return undefined;
      }
      return func(...args);
    } catch (error) {
      console.error(`[LuaEngine] Error calling ${functionName}:`, error);
      return undefined;
    }
  }

  getGlobal<T = unknown>(name: string): T | undefined {
    if (!this.lua) {
      console.error('[LuaEngine] Not initialized');
      return undefined;
    }

    try {
      return this.lua.global.get<T>(name);
    } catch (error) {
      console.error(`[LuaEngine] Error getting global ${name}:`, error);
      return undefined;
    }
  }

  setGlobal(name: string, value: unknown): void {
    if (!this.lua) {
      console.error('[LuaEngine] Not initialized');
      return;
    }

    try {
      this.lua.global.set(name, value);
    } catch (error) {
      console.error(`[LuaEngine] Error setting global ${name}:`, error);
    }
  }

  getStubModule(moduleName: string): unknown | undefined {
    if (!this.lua) {
      console.error('[LuaEngine] Not initialized');
      return undefined;
    }

    try {
      if (this.lua.getStubModule) {
        return this.lua.getStubModule(moduleName);
      }
      return undefined;
    } catch (error) {
      console.error(`[LuaEngine] Error getting stub module ${moduleName}:`, error);
      return undefined;
    }
  }

  destroy(): void {
    if (this.lua) {
      this.lua.close();
      this.lua = null;
    }
    this.initialized = false;
    this.registeredModules.clear();
    console.log('[LuaEngine] Destroyed');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getRegisteredModules(): Map<string, string> {
    return new Map(this.registeredModules);
  }

  getStubModule(moduleName: string): unknown {
    return (this.lua as any)?.getStubModule?.(moduleName);
  }

  registerModule(module: LuaScriptModule): void {
    if (!this.lua) {
      console.error('[LuaEngine] Not initialized');
      return;
    }
    this.registeredModules.set(module.name, module.script || '');
    this.lua.doString(module.script || '');
    console.log(`[LuaEngine] Registered module: ${module.name}`);
  }
}

export const luaEngine = new LuaEngine();