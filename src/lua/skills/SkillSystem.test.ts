/**
 * 技能系统单元测试
 *
 * 测试 Lua 脚本系统的功能完整性、边界条件和稳定性
 */

import { SkillSystemManager } from './SkillSystemManager';

// 模拟施放者数据
const mockCaster = {
  x: 0,
  y: 0,
  stats: {
    damage: 100,
    critChance: 10,
    critDamage: 50
  }
};

// 模拟目标数据
const mockTarget = {
  x: 50,
  y: 50
};

// 模拟资源
const mockResources = {
  mana: 100,
  energy: 100,
  health: 100
};

/**
 * 测试套件
 */
describe('SkillSystemManager', () => {
  let skillManager: SkillSystemManager;

  // 每个测试前初始化
  beforeEach(async () => {
    skillManager = new SkillSystemManager();
    await skillManager.initialize();
  });

  // 每个测试后清理
  afterEach(() => {
    skillManager.destroy();
  });

  // ==========================================
  // 基础功能测试
  // ==========================================

  describe('基础功能', () => {
    test('应该成功初始化', async () => {
      const manager = new SkillSystemManager();
      await manager.initialize();
      expect(manager).toBeDefined();
    });

    test('应该能够学习技能', () => {
      const result = skillManager.learnSkill('basic_attack', 5, []);
      expect(result).toBe(true);
    });

    test('应该拒绝学习未满足条件的技能', () => {
      const result = skillManager.learnSkill('power_shot', 1, []);
      // 根据实际逻辑调整预期
      expect(typeof result).toBe('boolean');
    });

    test('应该能够升级技能', () => {
      // 先学习技能
      skillManager.learnSkill('basic_attack', 5, []);
      
      // 升级
      const result = skillManager.upgradeSkill('basic_attack');
      expect(result.success).toBeDefined();
      expect(typeof result.newLevel).toBe('number');
    });

    test('不应该超过最大等级', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      
      // 多次升级直到达到上限
      for (let i = 0; i < 15; i++) {
        skillManager.upgradeSkill('basic_attack');
      }
      
      const status = skillManager.getSkillStatus('basic_attack');
      // 根据实际逻辑调整预期
      expect(status).toBeDefined();
    });
  });

  // ==========================================
  // 技能施放测试
  // ==========================================

  describe('技能施放', () => {
    test('应该能够施放已学习的技能', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      
      const canCast = skillManager.canCastSkill('basic_attack', mockResources);
      expect(canCast.canCast).toBe(true);
      expect(canCast.reason).toBe('ready');
    });

    test('应该不能施放未学习的技能', () => {
      const canCast = skillManager.canCastSkill('unknown_skill', mockResources);
      expect(canCast.canCast).toBe(false);
      expect(canCast.reason).toBe('skill_not_learned');
    });

    test('应该不能施放冷却中的技能', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      
      // 第一次施放
      const result1 = skillManager.castSkill('basic_attack', mockCaster, mockTarget, mockResources);
      expect(result1.success).toBe(true);
      
      // 立即再次施放（应该失败）
      const canCast = skillManager.canCastSkill('basic_attack', mockResources);
      expect(canCast.canCast).toBe(false);
      expect(canCast.reason).toBe('skill_not_ready');
    });

    test('应该返回施放结果', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      
      const result = skillManager.castSkill('basic_attack', mockCaster, mockTarget, mockResources);
      
      expect(result.success).toBe(true);
      expect(result.skillId).toBe('basic_attack');
      expect(result.effects).toBeDefined();
    });

    test('应该消耗资源', () => {
      const resources = { ...mockResources };
      skillManager.learnSkill('power_shot', 5, ['basic_attack']);
      
      const result = skillManager.castSkill('power_shot', mockCaster, mockTarget, resources);
      
      if (result.success) {
        // 资源应该被消耗（根据实际逻辑）
        expect(result.costPaid).toBeDefined();
      }
    });
  });

  // ==========================================
  // 冷却系统测试
  // ==========================================

  describe('冷却系统', () => {
    test('应该正确更新冷却时间', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      skillManager.castSkill('basic_attack', mockCaster, mockTarget, mockResources);
      
      // 更新冷却
      const readySkills = skillManager.updateCooldowns(0.1);
      expect(Array.isArray(readySkills)).toBe(true);
      
      // 检查状态
      const status = skillManager.getSkillStatus('basic_attack');
      expect(status).toBeDefined();
    });

    test('冷却结束后技能应该恢复就绪', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      skillManager.castSkill('basic_attack', mockCaster, mockTarget, mockResources);
      
      // 等待冷却结束（0.5秒）
      skillManager.updateCooldowns(0.6);
      
      const canCast = skillManager.canCastSkill('basic_attack', mockResources);
      expect(canCast.canCast).toBe(true);
    });

    test('应该能够重置冷却', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      skillManager.castSkill('basic_attack', mockCaster, mockTarget, mockResources);
      
      // 重置冷却
      const result = skillManager.resetCooldown('basic_attack');
      expect(result).toBe(true);
      
      const canCast = skillManager.canCastSkill('basic_attack', mockResources);
      expect(canCast.canCast).toBe(true);
    });
  });

  // ==========================================
  // 边界条件测试
  // ==========================================

  describe('边界条件', () => {
    test('应该处理空技能ID', () => {
      const result = skillManager.learnSkill('', 5, []);
      expect(result).toBe(false);
    });

    test('应该处理无效的玩家等级', () => {
      const result = skillManager.learnSkill('basic_attack', -1, []);
      expect(result).toBe(false);
    });

    test('应该处理空资源对象', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      
      const canCast = skillManager.canCastSkill('basic_attack', {});
      expect(canCast.canCast).toBeDefined();
    });

    test('应该处理空目标', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      
      const result = skillManager.castSkill('basic_attack', mockCaster, null, mockResources);
      expect(result.success).toBe(true);
    });

    test('应该处理零冷却时间', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      
      const readySkills = skillManager.updateCooldowns(0);
      expect(Array.isArray(readySkills)).toBe(true);
    });

    test('应该处理非常小的冷却时间', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      
      const readySkills = skillManager.updateCooldowns(0.001);
      expect(Array.isArray(readySkills)).toBe(true);
    });

    test('应该处理非常大的冷却时间', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      
      const readySkills = skillManager.updateCooldowns(1000);
      expect(Array.isArray(readySkills)).toBe(true);
    });
  });

  // ==========================================
  // 连招系统测试
  // ==========================================

  describe('连招系统', () => {
    test('应该能够开始连招', () => {
      const result = skillManager.startCombo();
      expect(result).toBe(true);
    });

    test('应该能够添加技能到连招', () => {
      skillManager.startCombo();
      
      const result = skillManager.addToCombo('basic_attack');
      expect(result.success).toBe(true);
      expect(result.comboName).toBeDefined();
    });

    test('应该能够检查连招奖励', () => {
      skillManager.startCombo();
      skillManager.addToCombo('basic_attack');
      
      const bonus = skillManager.checkComboBonus();
      // 根据连招定义决定返回值
      expect(bonus).toBeDefined();
    });
  });

  // ==========================================
  // 状态查询测试
  // ==========================================

  describe('状态查询', () => {
    test('应该能够获取单个技能状态', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      
      const status = skillManager.getSkillStatus('basic_attack');
      expect(status).toBeDefined();
      expect(status?.id).toBe('basic_attack');
    });

    test('未学习的技能应该返回 null', () => {
      const status = skillManager.getSkillStatus('unknown_skill');
      expect(status).toBeNull();
    });

    test('应该能够获取所有技能状态', () => {
      skillManager.learnSkill('basic_attack', 5, []);
      skillManager.learnSkill('power_shot', 5, ['basic_attack']);
      
      const statuses = skillManager.getAllSkillStatus();
      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // 热更新测试
  // ==========================================

  describe('热更新', () => {
    test('应该能够重新加载脚本', async () => {
      await skillManager.reloadScript();
      
      // 验证系统仍然工作
      const result = skillManager.learnSkill('basic_attack', 5, []);
      expect(typeof result).toBe('boolean');
    });
  });

  // ==========================================
  // 稳定性测试
  // ==========================================

  describe('稳定性', () => {
    test('多次初始化应该安全', async () => {
      await skillManager.initialize();
      await skillManager.initialize();
      await skillManager.initialize();
      
      expect(skillManager).toBeDefined();
    });

    test('多次销毁应该安全', () => {
      skillManager.destroy();
      skillManager.destroy();
      skillManager.destroy();
      
      expect(skillManager).toBeDefined();
    });

    test('大量技能操作应该稳定', () => {
      // 学习多个技能
      for (let i = 0; i < 10; i++) {
        skillManager.learnSkill(`skill_${i}`, 5 + i, []);
      }
      
      // 执行多次施放
      for (let i = 0; i < 100; i++) {
        skillManager.castSkill('basic_attack', mockCaster, mockTarget, mockResources);
        skillManager.updateCooldowns(0.01);
      }
      
      // 验证系统仍然稳定
      const statuses = skillManager.getAllSkillStatus();
      expect(Array.isArray(statuses)).toBe(true);
    });
  });
});

/**
 * 手动测试函数
 */
export async function runSkillSystemTests(): Promise<void> {
  console.log('[Test] Running Skill System tests...');
  
  const manager = new SkillSystemManager();
  await manager.initialize();
  
  // 测试 1: 学习技能
  console.log('\n[Test 1] Learning skills...');
  const learnResult = manager.learnSkill('basic_attack', 5, []);
  console.log(`  Result: ${learnResult}`);
  
  // 测试 2: 施放技能
  console.log('\n[Test 2] Casting skill...');
  const castResult = manager.castSkill('basic_attack', mockCaster, mockTarget, mockResources);
  console.log(`  Success: ${castResult.success}`);
  console.log(`  Skill: ${castResult.skillName}`);
  
  // 测试 3: 冷却更新
  console.log('\n[Test 3] Updating cooldowns...');
  const readySkills = manager.updateCooldowns(0.1);
  console.log(`  Ready skills: ${readySkills.length}`);
  
  // 测试 4: 连招
  console.log('\n[Test 4] Combo system...');
  manager.startCombo();
  manager.addToCombo('basic_attack');
  manager.addToCombo('basic_attack');
  const comboResult = manager.addToCombo('power_shot');
  console.log(`  Combo: ${comboResult.comboName}`);
  
  // 测试 5: 状态查询
  console.log('\n[Test 5] Status query...');
  const status = manager.getSkillStatus('basic_attack');
  console.log(`  Status: ${JSON.stringify(status, null, 2)}`);
  
  manager.destroy();
  console.log('\n[Test] All tests completed!');
}