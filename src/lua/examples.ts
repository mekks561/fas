/**
 * Lua 集成示例
 *
 * 展示如何在 fighter-game 项目中使用 Lua 脚本系统
 */

import {
  luaEngine,
  enemyAIManager,
  gameConfigManager,
  type AIType,
  type DifficultyLevel,
  type WeaponType,
} from './index';

/**
 * 示例 1: 初始化 Lua 系统
 */
export async function initializeLuaSystem(): Promise<void> {
  console.log('[Example] Initializing Lua system...');

  // 初始化 AI 管理器
  await enemyAIManager.initialize();

  // 初始化配置管理器
  await gameConfigManager.initialize();

  console.log('[Example] Lua system initialized');
}

/**
 * 示例 2: 创建和管理敌人
 */
export function enemyExample(): void {
  // 创建不同类型的敌人
  const enemyTypes: AIType[] = ['PATROL', 'AGGRESSIVE', 'SNIPER', 'BOSS'];

  enemyTypes.forEach((type) => {
    const enemy = enemyAIManager.createEnemy(type);
    if (enemy) {
      console.log(`[Example] Created ${type} enemy:`, enemy);
    }
  });

  // 更新敌人 AI
  const enemy = enemyAIManager.createEnemy('AGGRESSIVE');
  if (enemy) {
    // 模拟玩家位置
    const playerX = 100;
    const playerY = 50;
    const deltaTime = 0.016; // ~60 FPS

    // 更新 AI 并获取动作
    const action = enemyAIManager.update(enemy, playerX, playerY, deltaTime);

    if (action) {
      console.log(`[Example] Enemy action: ${action.action}`, action);
    }

    // 更新位置
    if (enemy.x !== undefined && enemy.y !== undefined) {
      console.log(`[Example] Enemy position: (${enemy.x}, ${enemy.y})`);
    }
  }
}

/**
 * 示例 3: 使用游戏配置
 */
export function configExample(): void {
  const levels: DifficultyLevel[] = ['easy', 'normal', 'hard', 'nightmare'];

  console.log('[Example] Difficulty configurations:');
  levels.forEach((level) => {
    const config = gameConfigManager.getDifficultyConfig(level);
    console.log(
      `${level}: waveInterval=${config.waveInterval}s, scoreMult=${config.scoreMultiplier}`,
    );
  });

  // 获取武器配置
  const weapons: WeaponType[] = ['basic', 'rapid', 'heavy', 'spread'];
  console.log('[Example] Weapon configurations:');
  weapons.forEach((weapon) => {
    const config = gameConfigManager.getWeaponConfig(weapon);
    console.log(`${weapon}: damage=${config.damage}, fireRate=${config.fireRate}/s`);
  });

  // 计算伤害
  const baseDamage = 100;
  const playerBonus = 0.5; // 50% 额外伤害
  const difficultyMultiplier = 1.2;
  const finalDamage = gameConfigManager.calculateDamage(
    baseDamage,
    playerBonus,
    difficultyMultiplier,
  );
  console.log(
    `[Example] Calculated damage: ${baseDamage} * (1+${playerBonus}) * ${difficultyMultiplier} = ${finalDamage}`,
  );

  // 计算分数
  const score = gameConfigManager.calculateScore('elite', 'hard', 2.5);
  console.log(`[Example] Score for killing elite enemy: ${score}`);
}

/**
 * 示例 4: 波次系统
 */
export function waveExample(): void {
  console.log('[Example] Wave system:');
  for (let wave = 1; wave <= 15; wave++) {
    const enemyCount = gameConfigManager.getWaveEnemyCount(wave);
    const isBoss = gameConfigManager.isBossWave(wave);
    const isElite = gameConfigManager.isEliteWave(wave);

    let type = 'normal';
    if (isBoss) type = 'BOSS';
    else if (isElite) type = 'elite';

    console.log(`  Wave ${wave}: ${enemyCount} enemies (${type})`);
  }
}

/**
 * 示例 5: 直接使用 Lua 引擎
 */
export function engineExample(): void {
  // 执行任意 Lua 代码
  luaEngine.doString(`
    -- 定义自定义函数
    function customMath(a, b, c)
      return (a + b) * c
    end

    -- 定义表
    myTable = {
      name = "test",
      value = 42,
      items = {1, 2, 3}
    }
  `);

  // 调用自定义函数
  const result = luaEngine.call<number>('customMath', 2, 3, 4);
  console.log(`[Example] customMath(2, 3, 4) = ${result}`);

  // 获取全局变量
  const tableResult = luaEngine.call<{ name: string; value: number }>('myTable');
  console.log(`[Example] myTable =`, tableResult);
}

/**
 * 示例 6: 热更新
 */
export async function hotReloadExample(): Promise<void> {
  console.log('[Example] Hot reloading...');

  // 重新加载 AI 脚本
  await enemyAIManager.reloadScript();

  // 重新加载配置
  await gameConfigManager.reloadConfig();

  // 或者重新加载所有模块
  luaEngine.reloadAllModules();

  console.log('[Example] Hot reload complete');
}

/**
 * 运行所有示例
 */
export async function runAllExamples(): Promise<void> {
  try {
    await initializeLuaSystem();
    console.log('\n');
    enemyExample();
    console.log('\n');
    configExample();
    console.log('\n');
    waveExample();
    console.log('\n');
    engineExample();
    console.log('\n');
    console.log('[Example] All examples completed!');
  } catch (error) {
    console.error('[Example] Error running examples:', error);
  }
}
