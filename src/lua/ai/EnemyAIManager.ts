import { luaEngine } from '../LuaEngine';
import type { AIConfig } from '../types';

export type AIType = 'PATROL' | 'AGGRESSIVE' | 'SNIPER' | 'BOSS';

export class EnemyAIManager {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();

    const aiScript = await this.loadAIScript();
    luaEngine.registerModule({ name: 'enemy_ai', script: aiScript });

    this.initialized = true;
    console.log('[EnemyAIManager] Initialized');
  }

  private async loadAIScript(): Promise<string> {
    try {
      const response = await fetch('/src/lua/ai/enemy-ai.lua');
      if (!response.ok) {
        throw new Error(`Failed to load enemy-ai.lua: ${response.status}`);
      }
      const luaCode = await response.text();

      return `
${luaCode}

local EnemyAI = require("enemy_ai_module")

function createEnemyAI(type, x, y)
  local result = EnemyAI.createEnemyAI(type, x, y)
  if result.success then
    return result.enemy
  end
  return nil
end

function updateAI(enemy, playerX, playerY, deltaTime)
  local result = EnemyAI.updateAI(enemy, playerX, playerY, deltaTime)
  if result.success then
    return result.action
  end
  return nil
end

function calculateDamage(baseDamage, modifier)
  local result = EnemyAI.calculateDamage(baseDamage, modifier)
  if result.success then
    return result.damage
  end
  return math.floor(baseDamage * (modifier or 1))
end

function checkHit(attackerX, attackerY, targetX, targetY, accuracy)
  local result = EnemyAI.checkHit(attackerX, attackerY, targetX, targetY, accuracy)
  if result.success then
    return result.hit
  end
  return false
end

function getEnemyStatus(enemy)
  local result = EnemyAI.getEnemyStatus(enemy)
  if result.success then
    return result.status
  end
  return nil
end

function resetEnemy(enemy)
  local result = EnemyAI.resetEnemy(enemy)
  return result.success
end
      `;
    } catch (error) {
      console.warn('[EnemyAIManager] Failed to load external lua file, using fallback:', error);
      return `
AI_TYPES = {
  PATROL = { name = "patrol", speed = 2.0, detectRange = 10.0, damage = 5.0, health = 50.0, behavior = "patrol" },
  AGGRESSIVE = { name = "aggressive", speed = 4.0, detectRange = 20.0, damage = 10.0, health = 80.0, behavior = "chase" },
  SNIPER = { name = "sniper", speed = 1.0, detectRange = 30.0, damage = 20.0, health = 30.0, behavior = "ranged" },
  BOSS = { name = "boss", speed = 3.0, detectRange = 25.0, damage = 15.0, health = 500.0, behavior = "mixed" }
}

function createEnemyAI(type)
  local config = AI_TYPES[type]
  if not config then return nil end
  return {
    type = config.name, x = 0, y = 0, speed = config.speed, detectRange = config.detectRange,
    damage = config.damage, health = config.health, maxHealth = config.health,
    behavior = config.behavior, state = "idle", targetX = 0, targetY = 0,
    attackCooldown = 0, patrolTimer = 0
  }
end

function updateAI(enemy, playerX, playerY, deltaTime)
  if not enemy then return nil end
  local dx = playerX - enemy.x
  local dy = playerY - enemy.y
  local distance = math.sqrt(dx * dx + dy * dy)

  if enemy.behavior == "patrol" then
    enemy.patrolTimer = enemy.patrolTimer + deltaTime
    if enemy.patrolTimer >= 3.0 then
      enemy.targetX = enemy.x + math.random(-5, 5)
      enemy.targetY = enemy.y + math.random(-5, 5)
      enemy.patrolTimer = 0
    end
    local pdx = enemy.targetX - enemy.x
    local pdy = enemy.targetY - enemy.y
    local pdist = math.sqrt(pdx * pdx + pdy * pdy)
    if pdist > 0.1 then
      enemy.x = enemy.x + (pdx / pdist) * enemy.speed * deltaTime
      enemy.y = enemy.y + (pdy / pdist) * enemy.speed * deltaTime
    end
  elseif enemy.behavior == "chase" then
    if distance < enemy.detectRange then
      enemy.x = enemy.x + (dx / distance) * enemy.speed * deltaTime
      enemy.y = enemy.y + (dy / distance) * enemy.speed * deltaTime
      enemy.state = "chasing"
      if distance < 2.0 and enemy.attackCooldown <= 0 then
        enemy.attackCooldown = 1.0
        enemy.state = "attacking"
      end
    else
      enemy.state = "idle"
    end
  elseif enemy.behavior == "ranged" then
    if distance < enemy.detectRange then
      enemy.state = "aiming"
      if distance < 15.0 then
        enemy.x = enemy.x - (dx / distance) * enemy.speed * deltaTime
        enemy.y = enemy.y - (dy / distance) * enemy.speed * deltaTime
      elseif distance > 25.0 then
        enemy.x = enemy.x + (dx / distance) * enemy.speed * deltaTime
        enemy.y = enemy.y + (dy / distance) * enemy.speed * deltaTime
      end
      if enemy.attackCooldown <= 0 then
        enemy.attackCooldown = 2.0
        enemy.state = "shooting"
        return { action = "shoot", x = dx, y = dy, damage = enemy.damage }
      end
    else
      enemy.state = "idle"
    end
  elseif enemy.behavior == "mixed" then
    local healthPercent = enemy.health / enemy.maxHealth
    if healthPercent > 0.5 then
      if distance < enemy.detectRange then
        enemy.state = "aggressive"
        enemy.x = enemy.x + (dx / distance) * enemy.speed * deltaTime
        enemy.y = enemy.y + (dy / distance) * enemy.speed * deltaTime
        if distance < 3.0 and enemy.attackCooldown <= 0 then
          enemy.attackCooldown = 0.5
          return { action = "melee", damage = enemy.damage }
        end
      end
    else
      enemy.state = "retreating"
      enemy.x = enemy.x - (dx / distance) * enemy.speed * 0.5 * deltaTime
      enemy.y = enemy.y - (dy / distance) * enemy.speed * 0.5 * deltaTime
      if enemy.attackCooldown <= 0 then
        enemy.attackCooldown = 1.0
        return { action = "ranged", x = dx, y = dy, damage = enemy.damage * 0.7 }
      end
    end
  end

  if enemy.attackCooldown > 0 then
    enemy.attackCooldown = enemy.attackCooldown - deltaTime
  end

  return nil
end

function calculateDamage(baseDamage, modifier)
  return math.floor(baseDamage * (modifier or 1))
end

function checkHit(attackerX, attackerY, targetX, targetY, accuracy)
  local dx = targetX - attackerX
  local dy = targetY - attackerY
  local distance = math.sqrt(dx * dx + dy * dy)
  local hitChance = math.clamp((accuracy or 1) - distance * 0.05, 0.1, 1.0)
  return math.random() < hitChance
end
      `;
    }
  }

  createEnemy(type: AIType): AIConfig | null {
    if (!this.initialized) {
      console.warn('[EnemyAIManager] Not initialized');
      return null;
    }

    try {
      const enemy = luaEngine.call<AIConfig>('createEnemyAI', type);
      return enemy;
    } catch (error) {
      console.error('[EnemyAIManager] Failed to create enemy:', error);
      return null;
    }
  }

  update(enemy: AIConfig, playerX: number, playerY: number, deltaTime: number): { action: string; x?: number; y?: number; damage?: number } | null {
    if (!this.initialized) {
      console.warn('[EnemyAIManager] Not initialized');
      return null;
    }

    try {
      return luaEngine.call<{ action: string; x?: number; y?: number; damage?: number } | null>('updateAI', enemy, playerX, playerY, deltaTime);
    } catch (error) {
      console.error('[EnemyAIManager] Failed to update AI:', error);
      return null;
    }
  }

  async reloadScript(): Promise<void> {
    console.log('[EnemyAIManager] Reloading AI script...');
    const newScript = await this.loadAIScript();
    luaEngine.registerModule({ name: 'enemy_ai', script: newScript });
    console.log('[EnemyAIManager] AI script reloaded');
  }

  destroy(): void {
    if (this.initialized) {
      this.initialized = false;
      console.log('[EnemyAIManager] Destroyed');
    }
  }
}

export const enemyAIManager = new EnemyAIManager();