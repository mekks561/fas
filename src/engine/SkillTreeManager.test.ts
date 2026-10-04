import { SkillTreeManager } from './SkillTreeManager';

describe('SkillTreeManager', () => {
  let manager: SkillTreeManager;

  beforeEach(() => {
    manager = SkillTreeManager.getInstance();
    manager.reset();
  });

  describe('Initialization', () => {
    it('should start with default state', () => {
      expect(manager.getPlayerLevel()).toBe(1);
      expect(manager.getTalentPoints()).toBe(0);
      expect(manager.getTotalSpentPoints()).toBe(0);
    });

    it('should have all talent nodes initialized', () => {
      const nodes = manager.getTalentNodes();
      expect(nodes.length).toBeGreaterThan(0);

      const states = manager.getAllTalentStates();
      expect(states.length).toBe(nodes.length);
    });

    it('should have initial stats as zero', () => {
      const stats = manager.getStats();
      expect(stats.damageBonus).toBe(0);
      expect(stats.fireRateBonus).toBe(0);
      expect(stats.healthBonus).toBe(0);
      expect(stats.shieldBonus).toBe(0);
      expect(stats.speedBonus).toBe(0);
    });
  });

  describe('Player Level', () => {
    it('should increase talent points when leveling up', () => {
      manager.setPlayerLevel(5);
      expect(manager.getTalentPoints()).toBe(4);
      expect(manager.getPlayerLevel()).toBe(5);
    });

    it('should not decrease talent points when leveling down', () => {
      manager.setPlayerLevel(5);
      const points = manager.getTalentPoints();
      manager.setPlayerLevel(3);
      expect(manager.getTalentPoints()).toBe(points);
    });

    it('should unlock talents at appropriate levels', () => {
      manager.setPlayerLevel(1);
      expect(manager.isTalentUnlocked('offensive_mastery')).toBe(true);
      expect(manager.isTalentUnlocked('rapid_fire')).toBe(false);

      manager.setPlayerLevel(2);
      expect(manager.isTalentUnlocked('rapid_fire')).toBe(true);
      expect(manager.isTalentUnlocked('critical_eye')).toBe(false);

      manager.setPlayerLevel(5);
      expect(manager.isTalentUnlocked('critical_eye')).toBe(true);
    });
  });

  describe('Talent Upgrade', () => {
    it('should upgrade talent when conditions are met', () => {
      manager.setPlayerLevel(2);

      const result = manager.upgradeTalent('offensive_mastery');
      expect(result).toBe(true);

      const state = manager.getTalentState('offensive_mastery');
      expect(state?.level).toBe(1);
      expect(manager.getTalentPoints()).toBe(0);
    });

    it('should not upgrade locked talent', () => {
      manager.setPlayerLevel(1);

      const result = manager.upgradeTalent('rapid_fire');
      expect(result).toBe(false);
    });

    it('should not upgrade talent without enough points', () => {
      manager.setPlayerLevel(1);

      const result = manager.upgradeTalent('offensive_mastery');
      expect(result).toBe(false);
    });

    it('should not upgrade talent without prerequisites', () => {
      manager.setPlayerLevel(5);

      const result = manager.upgradeTalent('critical_eye');
      expect(result).toBe(false);
    });

    it('should not upgrade talent past max level', () => {
      manager.setPlayerLevel(10);

      for (let i = 0; i < 5; i++) {
        manager.upgradeTalent('offensive_mastery');
      }

      const state = manager.getTalentState('offensive_mastery');
      expect(state?.level).toBe(5);

      const result = manager.upgradeTalent('offensive_mastery');
      expect(result).toBe(false);
    });

    it('should allow upgrading after prerequisite is met', () => {
      manager.setPlayerLevel(5);

      manager.upgradeTalent('offensive_mastery');
      manager.upgradeTalent('rapid_fire');

      const result = manager.upgradeTalent('critical_eye');
      expect(result).toBe(true);

      const state = manager.getTalentState('critical_eye');
      expect(state?.level).toBe(1);
    });
  });

  describe('Talent Downgrade', () => {
    it('should downgrade talent when no dependents', () => {
      manager.setPlayerLevel(3);

      manager.upgradeTalent('offensive_mastery');

      const result = manager.downgradeTalent('offensive_mastery');
      expect(result).toBe(true);

      const state = manager.getTalentState('offensive_mastery');
      expect(state?.level).toBe(0);
      expect(manager.getTalentPoints()).toBe(2);
    });

    it('should not downgrade talent with dependents', () => {
      manager.setPlayerLevel(5);

      manager.upgradeTalent('offensive_mastery');
      manager.upgradeTalent('rapid_fire');

      const result = manager.downgradeTalent('offensive_mastery');
      expect(result).toBe(false);

      const state = manager.getTalentState('offensive_mastery');
      expect(state?.level).toBe(1);
    });

    it('should not downgrade talent at level 0', () => {
      manager.setPlayerLevel(5);

      const result = manager.downgradeTalent('offensive_mastery');
      expect(result).toBe(false);
    });
  });

  describe('Stats Calculation', () => {
    it('should update stats when talent is upgraded', () => {
      manager.setPlayerLevel(3);

      manager.upgradeTalent('offensive_mastery');

      const stats = manager.getStats();
      expect(stats.damageBonus).toBe(5);
    });

    it('should accumulate stats from multiple talents', () => {
      manager.setPlayerLevel(5);

      manager.upgradeTalent('offensive_mastery');
      manager.upgradeTalent('rapid_fire');

      const stats = manager.getStats();
      expect(stats.damageBonus).toBe(5);
      expect(stats.fireRateBonus).toBe(5);
    });

    it('should calculate per-level bonuses correctly', () => {
      manager.setPlayerLevel(10);

      for (let i = 0; i < 3; i++) {
        manager.upgradeTalent('offensive_mastery');
      }

      const stats = manager.getStats();
      expect(stats.damageBonus).toBe(15);
    });

    it('should update stats when talent is downgraded', () => {
      manager.setPlayerLevel(5);

      manager.upgradeTalent('offensive_mastery');
      manager.upgradeTalent('offensive_mastery');

      expect(manager.getStats().damageBonus).toBe(10);

      manager.downgradeTalent('offensive_mastery');

      expect(manager.getStats().damageBonus).toBe(5);
    });
  });

  describe('Reset', () => {
    it('should reset all talents and refund points', () => {
      manager.setPlayerLevel(5);

      manager.upgradeTalent('offensive_mastery');
      manager.upgradeTalent('defensive_mastery');

      const spent = manager.getTotalSpentPoints();
      const pointsBefore = manager.getTalentPoints();

      manager.resetAllTalents();

      expect(manager.getTalentPoints()).toBe(spent + pointsBefore);

      const states = manager.getAllTalentStates();
      states.forEach((state) => {
        expect(state.level).toBe(0);
      });

      const stats = manager.getStats();
      expect(stats.damageBonus).toBe(0);
      expect(stats.healthBonus).toBe(0);
    });

    it('should keep player level after reset', () => {
      manager.setPlayerLevel(5);
      manager.upgradeTalent('offensive_mastery');

      manager.resetAllTalents();

      expect(manager.getPlayerLevel()).toBe(5);
    });
  });

  describe('Prerequisites', () => {
    it('should check prerequisites correctly', () => {
      manager.setPlayerLevel(5);

      expect(manager.arePrerequisitesMet('offensive_mastery')).toBe(true);
      expect(manager.arePrerequisitesMet('rapid_fire')).toBe(false);

      manager.upgradeTalent('offensive_mastery');

      expect(manager.arePrerequisitesMet('rapid_fire')).toBe(true);
    });

    it('should handle nested prerequisites', () => {
      manager.setPlayerLevel(10);

      expect(manager.arePrerequisitesMet('precision_strike')).toBe(false);

      manager.upgradeTalent('offensive_mastery');
      expect(manager.arePrerequisitesMet('precision_strike')).toBe(false);

      manager.upgradeTalent('rapid_fire');
      expect(manager.arePrerequisitesMet('precision_strike')).toBe(false);

      manager.upgradeTalent('critical_eye');
      expect(manager.arePrerequisitesMet('precision_strike')).toBe(true);
    });
  });

  describe('Effect Description', () => {
    it('should format effect description correctly', () => {
      const node = manager.getTalentNode('offensive_mastery');
      expect(node).toBeDefined();

      if (node) {
        const effect = node.effects[0];
        const formatted = manager.formatEffectDescription(effect, 2);
        expect(formatted).toBe('伤害提升 10%');
      }
    });

    it('should format effect with base value', () => {
      const node = manager.getTalentNode('offensive_mastery');
      expect(node).toBeDefined();

      if (node) {
        const effect = node.effects[0];
        const formatted = manager.formatEffectDescription(effect, 1);
        expect(formatted).toBe('伤害提升 5%');
      }
    });
  });

  describe('Talent Types', () => {
    it('should have talents of different types', () => {
      const nodes = manager.getTalentNodes();

      const offensiveCount = nodes.filter((n) => n.type === 'offensive').length;
      const defensiveCount = nodes.filter((n) => n.type === 'defensive').length;
      const utilityCount = nodes.filter((n) => n.type === 'utility').length;

      expect(offensiveCount).toBeGreaterThan(0);
      expect(defensiveCount).toBeGreaterThan(0);
      expect(utilityCount).toBeGreaterThan(0);
    });
  });
});
