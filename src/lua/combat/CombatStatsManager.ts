import { luaEngine } from '../LuaEngine';
import { getLuaSource } from '../luaSources';

// 取源码统一走 luaSources（构建期内联）——理由见 luaSources.ts 头注释。
const combatStatsScript = getLuaSource('combat/combat-stats') ?? '';

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
    luaEngine.registerModule({ name: 'combat_stats', script: combatStatsScript, host: false });

    this.initialized = true;
    console.log('[CombatStatsManager] Initialized');
  }

  private async loadCombatStatsScript(): Promise<string> {
    return `
local CombatStats = require("combat/combat-stats")

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

  getStats(): CombatStatsData | null {
    if (!this.initialized) return null;

    try {
      const callResult = luaEngine.call<Record<string, unknown>>('getStats');
      if (callResult) {
        return (
          (callResult['stats'] as CombatStatsData) ||
          (callResult as unknown as CombatStatsData) ||
          null
        );
      }
      return null;
    } catch {
      return null;
    }
  }

  onKill(
    enemyType: string,
    isBoss = false,
    isElite = false,
  ):
    | { success: boolean; kills?: number; comboCurrent?: number; comboMax?: number }
    | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        | { success: boolean; kills?: number; comboCurrent?: number; comboMax?: number }
        | { success: boolean; error: string }
      >('onKill', enemyType, isBoss, isElite);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onDeath(): { success: boolean; deaths?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; deaths?: number } | { success: boolean; error: string }
      >('onDeath');
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  addDamageDealt(
    damage: number,
  ): { success: boolean; damageDealt?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; damageDealt?: number } | { success: boolean; error: string }
      >('addDamageDealt', damage);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  addDamageTaken(
    damage: number,
  ): { success: boolean; damageTaken?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; damageTaken?: number } | { success: boolean; error: string }
      >('addDamageTaken', damage);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  addDamageHealed(
    healAmount: number,
  ): { success: boolean; damageHealed?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; damageHealed?: number } | { success: boolean; error: string }
      >('addDamageHealed', healAmount);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onSkillUse(
    skillId: string,
    hit = false,
  ):
    | { success: boolean; skillsUsed?: number; skillsHit?: number; accuracy?: number }
    | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        | { success: boolean; skillsUsed?: number; skillsHit?: number; accuracy?: number }
        | { success: boolean; error: string }
      >('onSkillUse', skillId, hit);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onPowerupCollected(
    powerupType: string,
  ): { success: boolean; powerupsCollected?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; powerupsCollected?: number } | { success: boolean; error: string }
      >('onPowerupCollected', powerupType);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onProjectileFired():
    { success: boolean; projectilesFired?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; projectilesFired?: number } | { success: boolean; error: string }
      >('onProjectileFired');
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onProjectileHit():
    { success: boolean; projectilesHit?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; projectilesHit?: number } | { success: boolean; error: string }
      >('onProjectileHit');
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  updateCombo(
    deltaTime: number,
  ):
    | { success: boolean; comboCurrent?: number; comboTimer?: number; comboTimeout?: number }
    | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        | { success: boolean; comboCurrent?: number; comboTimer?: number; comboTimeout?: number }
        | { success: boolean; error: string }
      >('updateCombo', deltaTime);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  addScore(
    points: number,
  ): { success: boolean; score?: number; rank?: string } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; score?: number; rank?: string } | { success: boolean; error: string }
      >('addScore', points);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  updatePlayTime(
    deltaTime: number,
  ): { success: boolean; playTime?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; playTime?: number } | { success: boolean; error: string }
      >('updatePlayTime', deltaTime);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onWaveCompleted(
    waveNumber: number,
  ): { success: boolean; wavesCompleted?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; wavesCompleted?: number } | { success: boolean; error: string }
      >('onWaveCompleted', waveNumber);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  getComboMultiplier():
    { success: boolean; multiplier?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; multiplier?: number } | { success: boolean; error: string }
      >('getComboMultiplier');
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  getEfficiency(): { success: boolean; efficiency?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; efficiency?: number } | { success: boolean; error: string }
      >('getEfficiency');
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  getSurvivalRate(): { success: boolean; rate?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        { success: boolean; rate?: number } | { success: boolean; error: string }
      >('getSurvivalRate');
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  calculateFinalScore():
    | { success: boolean; finalScore?: number; breakdown?: ScoreBreakdown }
    | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        | { success: boolean; finalScore?: number; breakdown?: ScoreBreakdown }
        | { success: boolean; error: string }
      >('calculateFinalScore');
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  reset(): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('resetCombatStats') ?? false;
    } catch {
      return false;
    }
  }

  getRankThresholds(): Record<string, number> {
    if (!this.initialized) return {};

    try {
      return luaEngine.call<Record<string, number>>('getRankThresholds') ?? {};
    } catch {
      return {};
    }
  }

  async reloadScript(): Promise<void> {
    console.log('[CombatStatsManager] Reloading combat stats script...');
    const newScript = await this.loadCombatStatsScript();
    luaEngine.registerModule({ name: 'combat_stats', script: newScript, host: false });
    console.log('[CombatStatsManager] Combat stats script reloaded');
  }

  destroy(): void {
    this.initialized = false;
    console.log('[CombatStatsManager] Destroyed');
  }
}

export const combatStatsManager = new CombatStatsManager();
