import { luaEngine } from '../LuaEngine';

const combatScriptModules = import.meta.glob('./combat-stats.lua', { as: 'raw', eager: true });
const combatStatsScript = combatScriptModules['./combat-stats.lua'] || '';

export interface CombatStatsData {
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  damageHealed: number;
  skillsUsed: number;
  skillsHit: number;
  powerupsCollected: number;
  projectilesFired: number;
  projectilesHit: number;
  comboMax: number;
  comboCurrent: number;
  comboTotal: number;
  accuracy: number;
  playTime: number;
  wavesCompleted: number;
  bossesKilled: number;
  elitesKilled: number;
  score: number;
  rank: string;
  enemiesDefeated: Record<string, number>;
  skillsUsedBreakdown: Record<string, number>;
}

export interface ComboInfo {
  comboCurrent: number;
  comboMax: number;
  comboTimer: number;
  comboTimeout: number;
}

export interface ScoreBreakdown {
  baseScore: number;
  comboBonus: number;
  accuracyBonus: number;
  efficiencyBonus: number;
  survivalBonus: number;
}

export class CombatStatsManager {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();

    const combatStatsScript = await this.loadCombatStatsScript();
    luaEngine.registerModule({ name: 'combat_stats', script: combatStatsScript });

    this.initialized = true;
    console.log('[CombatStatsManager] Initialized');
  }

  private async loadCombatStatsScript(): Promise<string> {
    if (combatStatsScript) {
      return `
${combatStatsScript}

local CombatStats = require("combat_stats_module")

function getStats()
  local result = CombatStats.getStats()
  if result.success then
    return result.stats
  end
  return nil
end

function onKill(enemyType, isBoss, isElite)
  local result = CombatStats.onKill(enemyType, isBoss, isElite)
  if result.success then
    return {
      success = true,
      kills = result.kills,
      comboCurrent = result.comboCurrent,
      comboMax = result.comboMax
    }
  end
  return { success = false, error = result.error }
end

function onDeath()
  local result = CombatStats.onDeath()
  if result.success then
    return { success = true, deaths = result.deaths }
  end
  return { success = false }
end

function addDamageDealt(damage)
  local result = CombatStats.addDamageDealt(damage)
  if result.success then
    return { success = true, damageDealt = result.damageDealt }
  end
  return { success = false, error = result.error }
end

function addDamageTaken(damage)
  local result = CombatStats.addDamageTaken(damage)
  if result.success then
    return { success = true, damageTaken = result.damageTaken }
  end
  return { success = false, error = result.error }
end

function addDamageHealed(healAmount)
  local result = CombatStats.addDamageHealed(healAmount)
  if result.success then
    return { success = true, damageHealed = result.damageHealed }
  end
  return { success = false, error = result.error }
end

function onSkillUse(skillId, hit)
  local result = CombatStats.onSkillUse(skillId, hit)
  if result.success then
    return {
      success = true,
      skillsUsed = result.skillsUsed,
      skillsHit = result.skillsHit,
      accuracy = result.accuracy
    }
  end
  return { success = false, error = result.error }
end

function onPowerupCollected(powerupType)
  local result = CombatStats.onPowerupCollected(powerupType)
  if result.success then
    return { success = true, powerupsCollected = result.powerupsCollected }
  end
  return { success = false, error = result.error }
end

function onProjectileFired()
  local result = CombatStats.onProjectileFired()
  if result.success then
    return { success = true, projectilesFired = result.projectilesFired }
  end
  return { success = false }
end

function onProjectileHit()
  local result = CombatStats.onProjectileHit()
  if result.success then
    return { success = true, projectilesHit = result.projectilesHit }
  end
  return { success = false }
end

function updateCombo(deltaTime)
  local result = CombatStats.updateCombo(deltaTime)
  if result.success then
    return {
      success = true,
      comboCurrent = result.comboCurrent,
      comboTimer = result.comboTimer,
      comboTimeout = result.comboTimeout
    }
  end
  return { success = false, error = result.error }
end

function addScore(points)
  local result = CombatStats.addScore(points)
  if result.success then
    return { success = true, score = result.score, rank = result.rank }
  end
  return { success = false, error = result.error }
end

function updatePlayTime(deltaTime)
  local result = CombatStats.updatePlayTime(deltaTime)
  if result.success then
    return { success = true, playTime = result.playTime }
  end
  return { success = false, error = result.error }
end

function onWaveCompleted(waveNumber)
  local result = CombatStats.onWaveCompleted(waveNumber)
  if result.success then
    return { success = true, wavesCompleted = result.wavesCompleted }
  end
  return { success = false, error = result.error }
end

function getComboMultiplier()
  local result = CombatStats.getComboMultiplier()
  if result.success then
    return { success = true, multiplier = result.multiplier }
  end
  return { success = false, multiplier = 1.0 }
end

function getEfficiency()
  local result = CombatStats.getEfficiency()
  if result.success then
    return { success = true, efficiency = result.efficiency }
  end
  return { success = false, efficiency = 0 }
end

function getSurvivalRate()
  local result = CombatStats.getSurvivalRate()
  if result.success then
    return { success = true, rate = result.rate }
  end
  return { success = false, rate = 0 }
end

function calculateFinalScore()
  local result = CombatStats.calculateFinalScore()
  if result.success then
    return {
      success = true,
      finalScore = result.finalScore,
      breakdown = result.breakdown
    }
  end
  return { success = false, finalScore = 0, breakdown = nil }
end

function resetCombatStats()
  local result = CombatStats.reset()
  return result.success
end

function getRankThresholds()
  local result = CombatStats.getRankThresholds()
  if result.success then
    return result.thresholds
  end
  return {}
end
      `;
    }

    console.warn('[CombatStatsManager] Failed to load lua file, using fallback');
    return `
CombatStats = {
  kills = 0,
  deaths = 0,
  damageDealt = 0,
  damageTaken = 0,
  damageHealed = 0,
  skillsUsed = 0,
  skillsHit = 0,
  powerupsCollected = 0,
  projectilesFired = 0,
  projectilesHit = 0,
  comboMax = 0,
  comboCurrent = 0,
  comboTotal = 0,
  accuracy = 0,
  playTime = 0,
  wavesCompleted = 0,
  bossesKilled = 0,
  elitesKilled = 0,
  score = 0,
  rank = "D"
}

function getStats()
  return CombatStats
end

function onKill(enemyType, isBoss, isElite)
  CombatStats.kills = CombatStats.kills + 1
  if isBoss then CombatStats.bossesKilled = CombatStats.bossesKilled + 1 end
  if isElite then CombatStats.elitesKilled = CombatStats.elitesKilled + 1 end
  CombatStats.comboCurrent = CombatStats.comboCurrent + 1
  CombatStats.comboMax = math.max(CombatStats.comboMax, CombatStats.comboCurrent)
  return { success = true, kills = CombatStats.kills, comboCurrent = CombatStats.comboCurrent, comboMax = CombatStats.comboMax }
end

function onDeath()
  CombatStats.deaths = CombatStats.deaths + 1
  CombatStats.comboCurrent = 0
  return { success = true, deaths = CombatStats.deaths }
end

function addDamageDealt(damage)
  CombatStats.damageDealt = CombatStats.damageDealt + damage
  return { success = true, damageDealt = CombatStats.damageDealt }
end

function addDamageTaken(damage)
  CombatStats.damageTaken = CombatStats.damageTaken + damage
  return { success = true, damageTaken = CombatStats.damageTaken }
end

function addDamageHealed(healAmount)
  CombatStats.damageHealed = CombatStats.damageHealed + healAmount
  return { success = true, damageHealed = CombatStats.damageHealed }
end

function onSkillUse(skillId, hit)
  CombatStats.skillsUsed = CombatStats.skillsUsed + 1
  if hit then CombatStats.skillsHit = CombatStats.skillsHit + 1 end
  return { success = true, skillsUsed = CombatStats.skillsUsed, skillsHit = CombatStats.skillsHit }
end

function onPowerupCollected(powerupType)
  CombatStats.powerupsCollected = CombatStats.powerupsCollected + 1
  return { success = true, powerupsCollected = CombatStats.powerupsCollected }
end

function onProjectileFired()
  CombatStats.projectilesFired = CombatStats.projectilesFired + 1
  return { success = true, projectilesFired = CombatStats.projectilesFired }
end

function onProjectileHit()
  CombatStats.projectilesHit = CombatStats.projectilesHit + 1
  return { success = true, projectilesHit = CombatStats.projectilesHit }
end

function updateCombo(deltaTime)
  return { success = true, comboCurrent = CombatStats.comboCurrent, comboTimer = 0, comboTimeout = 2.0 }
end

function addScore(points)
  CombatStats.score = CombatStats.score + points
  return { success = true, score = CombatStats.score, rank = CombatStats.rank }
end

function updatePlayTime(deltaTime)
  CombatStats.playTime = CombatStats.playTime + deltaTime
  return { success = true, playTime = CombatStats.playTime }
end

function onWaveCompleted(waveNumber)
  CombatStats.wavesCompleted = CombatStats.wavesCompleted + 1
  return { success = true, wavesCompleted = CombatStats.wavesCompleted }
end

function getComboMultiplier()
  if CombatStats.comboCurrent <= 1 then return { success = true, multiplier = 1.0 } end
  if CombatStats.comboCurrent <= 5 then return { success = true, multiplier = 1.5 } end
  if CombatStats.comboCurrent <= 10 then return { success = true, multiplier = 2.0 } end
  return { success = true, multiplier = 3.0 }
end

function getEfficiency()
  if CombatStats.playTime > 0 then
    return { success = true, efficiency = math.floor(CombatStats.damageDealt / CombatStats.playTime) }
  end
  return { success = true, efficiency = 0 }
end

function getSurvivalRate()
  if CombatStats.kills + CombatStats.deaths == 0 then
    return { success = true, rate = 0 }
  end
  return { success = true, rate = math.floor((CombatStats.kills / (CombatStats.kills + CombatStats.deaths)) * 100) }
end

function calculateFinalScore()
  return { success = true, finalScore = CombatStats.score, breakdown = { baseScore = CombatStats.score, comboBonus = 0, accuracyBonus = 0, efficiencyBonus = 0, survivalBonus = 0 } }
end

function resetCombatStats()
  CombatStats = { kills = 0, deaths = 0, damageDealt = 0, damageTaken = 0, damageHealed = 0, skillsUsed = 0, skillsHit = 0, powerupsCollected = 0, projectilesFired = 0, projectilesHit = 0, comboMax = 0, comboCurrent = 0, comboTotal = 0, accuracy = 0, playTime = 0, wavesCompleted = 0, bossesKilled = 0, elitesKilled = 0, score = 0, rank = "D" }
  return true
end

function getRankThresholds()
  return { S = 10000, A = 5000, B = 2500, C = 1000, D = 0 }
end
      `;
  }

  getStats(): CombatStatsData | null {
    if (!this.initialized) return null;

    try {
      const stubModule = luaEngine.getStubModule('combat_stats_module');
      if (stubModule) {
        const getStatsFunc = (stubModule as Record<string, unknown>)['getStats'] as (...args: unknown[]) => unknown;
        if (getStatsFunc) {
          const result = getStatsFunc();
          if (result && typeof result === 'object') {
            const resultObj = result as Record<string, unknown>;
            return (resultObj.stats as CombatStatsData) || (resultObj as unknown as CombatStatsData) || null;
          }
        }
      }
      const callResult = luaEngine.call<Record<string, unknown>>('getStats');
      if (callResult) {
        return (callResult.stats as CombatStatsData) || (callResult as unknown as CombatStatsData) || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  onKill(enemyType: string, isBoss = false, isElite = false): { success: boolean; kills?: number; comboCurrent?: number; comboMax?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const stubModule = luaEngine.getStubModule('combat_stats_module');
      if (stubModule) {
        const onKillFunc = (stubModule as Record<string, unknown>)['onKill'] as (...args: unknown[]) => unknown;
        if (onKillFunc) {
          return onKillFunc(enemyType, isBoss, isElite) as { success: boolean; kills?: number; comboCurrent?: number; comboMax?: number } | { success: boolean; error: string };
        }
      }
      return luaEngine.call<{ success: boolean; kills?: number; comboCurrent?: number; comboMax?: number } | { success: boolean; error: string }>('onKill', enemyType, isBoss, isElite);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onDeath(): { success: boolean; deaths?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; deaths?: number } | { success: boolean; error: string }>('onDeath');
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  addDamageDealt(damage: number): { success: boolean; damageDealt?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; damageDealt?: number } | { success: boolean; error: string }>('addDamageDealt', damage);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  addDamageTaken(damage: number): { success: boolean; damageTaken?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; damageTaken?: number } | { success: boolean; error: string }>('addDamageTaken', damage);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  addDamageHealed(healAmount: number): { success: boolean; damageHealed?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; damageHealed?: number } | { success: boolean; error: string }>('addDamageHealed', healAmount);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onSkillUse(skillId: string, hit = false): { success: boolean; skillsUsed?: number; skillsHit?: number; accuracy?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; skillsUsed?: number; skillsHit?: number; accuracy?: number } | { success: boolean; error: string }>('onSkillUse', skillId, hit);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onPowerupCollected(powerupType: string): { success: boolean; powerupsCollected?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; powerupsCollected?: number } | { success: boolean; error: string }>('onPowerupCollected', powerupType);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onProjectileFired(): { success: boolean; projectilesFired?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; projectilesFired?: number } | { success: boolean; error: string }>('onProjectileFired');
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onProjectileHit(): { success: boolean; projectilesHit?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; projectilesHit?: number } | { success: boolean; error: string }>('onProjectileHit');
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  updateCombo(deltaTime: number): { success: boolean; comboCurrent?: number; comboTimer?: number; comboTimeout?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; comboCurrent?: number; comboTimer?: number; comboTimeout?: number } | { success: boolean; error: string }>('updateCombo', deltaTime);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  addScore(points: number): { success: boolean; score?: number; rank?: string } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; score?: number; rank?: string } | { success: boolean; error: string }>('addScore', points);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  updatePlayTime(deltaTime: number): { success: boolean; playTime?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; playTime?: number } | { success: boolean; error: string }>('updatePlayTime', deltaTime);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onWaveCompleted(waveNumber: number): { success: boolean; wavesCompleted?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; wavesCompleted?: number } | { success: boolean; error: string }>('onWaveCompleted', waveNumber);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  getComboMultiplier(): { success: boolean; multiplier?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; multiplier?: number } | { success: boolean; error: string }>('getComboMultiplier');
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  getEfficiency(): { success: boolean; efficiency?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; efficiency?: number } | { success: boolean; error: string }>('getEfficiency');
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  getSurvivalRate(): { success: boolean; rate?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; rate?: number } | { success: boolean; error: string }>('getSurvivalRate');
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  calculateFinalScore(): { success: boolean; finalScore?: number; breakdown?: ScoreBreakdown } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; finalScore?: number; breakdown?: ScoreBreakdown } | { success: boolean; error: string }>('calculateFinalScore');
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  reset(): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('resetCombatStats');
    } catch {
      return false;
    }
  }

  getRankThresholds(): Record<string, number> {
    if (!this.initialized) return {};

    try {
      return luaEngine.call<Record<string, number>>('getRankThresholds');
    } catch {
      return {};
    }
  }

  async reloadScript(): Promise<void> {
    console.log('[CombatStatsManager] Reloading combat stats script...');
    const newScript = await this.loadCombatStatsScript();
    luaEngine.registerModule({ name: 'combat_stats', script: newScript });
    console.log('[CombatStatsManager] Combat stats script reloaded');
  }

  destroy(): void {
    this.initialized = false;
    console.log('[CombatStatsManager] Destroyed');
  }
}

export const combatStatsManager = new CombatStatsManager();