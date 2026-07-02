import { EventSystem } from './EventSystem';
import * as pc from 'playcanvas';

describe('EventSystem', () => {
  let eventSystem: EventSystem;

  beforeEach(() => {
    eventSystem = new EventSystem();
  });

  afterEach(() => {
    eventSystem.destroy();
  });

  describe('基础功能', () => {
    it('应该正确创建EventSystem实例', () => {
      expect(eventSystem).toBeInstanceOf(EventSystem);
    });

    it('应该正确注册事件监听器', () => {
      const callback = vi.fn();
      const unsubscribe = eventSystem.on('player_damage', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('应该正确触发事件', () => {
      const callback = vi.fn();
      eventSystem.on('player_damage', callback);

      eventSystem.emit('player_damage', { damage: 10 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'player_damage',
        data: { damage: 10 }
      }));
    });

    it('应该正确取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = eventSystem.on('player_damage', callback);

      eventSystem.emit('player_damage', { damage: 10 });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      eventSystem.emit('player_damage', { damage: 10 });
      expect(callback).toHaveBeenCalledTimes(1); // 不应再触发
    });
  });

  describe('多监听器', () => {
    it('应该支持多个监听器', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      eventSystem.on('player_damage', callback1);
      eventSystem.on('player_damage', callback2);
      eventSystem.on('player_damage', callback3);

      eventSystem.emit('player_damage', { damage: 10 });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('应该独立取消订阅', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = eventSystem.on('player_damage', callback1);
      eventSystem.on('player_damage', callback2);

      unsubscribe1();
      eventSystem.emit('player_damage', { damage: 10 });

      expect(callback1).toHaveBeenCalledTimes(0);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('一次性监听器', () => {
    it('应该只触发一次', () => {
      const callback = vi.fn();
      eventSystem.once('player_damage', callback);

      eventSystem.emit('player_damage', { damage: 10 });
      eventSystem.emit('player_damage', { damage: 20 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        data: { damage: 10 }
      }));
    });
  });

  describe('游戏事件', () => {
    it('应该正确发射玩家伤害事件', () => {
      const callback = vi.fn();
      eventSystem.on('player_damage', callback);

      eventSystem.emitPlayerDamage(50, 100, 100);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'player_damage',
        data: { damage: 50, remainingHealth: 100, maxHealth: 100 }
      }));
    });

    it('应该正确发射敌人死亡事件', () => {
      const callback = vi.fn();
      eventSystem.on('enemy_death', callback);

      const position = new pc.Vec3(0, 0, 0);
      eventSystem.emitEnemyDeath('basic', 100, position);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'enemy_death',
        data: expect.objectContaining({
          type: 'basic',
          score: 100
        })
      }));
    });

    it('应该正确发射道具收集事件', () => {
      const callback = vi.fn();
      eventSystem.on('powerup_collect', callback);

      const position = new pc.Vec3(5, 0, 5);
      eventSystem.emitPowerupCollect('health', position);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'powerup_collect',
        data: expect.objectContaining({
          type: 'health'
        })
      }));
    });

    it('应该正确发射技能激活事件', () => {
      const callback = vi.fn();
      eventSystem.on('skill_activate', callback);

      eventSystem.emitSkillActivate('missile_strike', 1);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'skill_activate',
        data: { skillId: 'missile_strike', level: 1 }
      }));
    });

    it('应该正确发射波次开始事件', () => {
      const callback = vi.fn();
      eventSystem.on('wave_start', callback);

      eventSystem.emitWaveStart(3, 10);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'wave_start',
        data: { wave: 3, enemyCount: 10 }
      }));
    });

    it('应该正确发射波次完成事件', () => {
      const callback = vi.fn();
      eventSystem.on('wave_complete', callback);

      eventSystem.emitWaveComplete(5, 0);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'wave_complete',
        data: { wave: 5, enemyCount: 0 }
      }));
    });

    it('应该正确发射分数更新事件', () => {
      const callback = vi.fn();
      eventSystem.on('score_update', callback);

      eventSystem.emitScoreUpdate(1000, 100);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'score_update',
        data: { score: 1000, delta: 100 }
      }));
    });

    it('应该正确发射玩家射击事件', () => {
      const callback = vi.fn();
      eventSystem.on('player_shoot', callback);

      const position = new pc.Vec3(0, 0, 0);
      eventSystem.emitPlayerShoot('laser', 2, position);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'player_shoot',
        data: expect.objectContaining({
          weaponType: 'laser',
          weaponLevel: 2
        })
      }));
    });

    it('应该正确发射游戏暂停事件', () => {
      const callback = vi.fn();
      eventSystem.on('game_pause', callback);

      eventSystem.emitGamePause();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'game_pause'
      }));
    });

    it('应该正确发射游戏恢复事件', () => {
      const callback = vi.fn();
      eventSystem.on('game_resume', callback);

      eventSystem.emitGameResume();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'game_resume'
      }));
    });

    it('应该正确发射游戏胜利事件', () => {
      const callback = vi.fn();
      eventSystem.on('game_win', callback);

      eventSystem.emitGameWin();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'game_win'
      }));
    });

    it('应该正确发射游戏失败事件', () => {
      const callback = vi.fn();
      eventSystem.on('game_over', callback);

      eventSystem.emitGameOver();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'game_over'
      }));
    });
  });

  describe('事件历史', () => {
    it('应该正确记录事件历史', () => {
      eventSystem.emit('player_damage', { damage: 10 });
      eventSystem.emit('player_heal', { amount: 20 });

      const history = eventSystem.getHistory();

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].type).toBe('player_damage');
      expect(history[1].type).toBe('player_heal');
    });

    it('应该限制历史记录数量', () => {
      for (let i = 0; i < 200; i++) {
        eventSystem.emit('player_damage', { index: i });
      }

      const history = eventSystem.getHistory();

      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('应该正确清除历史', () => {
      eventSystem.emit('player_damage', { damage: 10 });
      eventSystem.emit('player_heal', { amount: 20 });

      eventSystem.clearHistory();

      expect(eventSystem.getHistory().length).toBe(0);
    });
  });

  describe('启用/禁用功能', () => {
    it('应该正确禁用事件系统', () => {
      const callback = vi.fn();
      eventSystem.on('player_damage', callback);

      eventSystem.disable();
      eventSystem.emit('player_damage', { damage: 10 });

      expect(callback).toHaveBeenCalledTimes(0);
    });

    it('应该正确启用事件系统', () => {
      const callback = vi.fn();
      eventSystem.on('player_damage', callback);

      eventSystem.disable();
      eventSystem.emit('player_damage', { damage: 10 });
      expect(callback).toHaveBeenCalledTimes(0);

      eventSystem.enable();
      eventSystem.emit('player_damage', { damage: 10 });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('监听器计数', () => {
    it('应该正确统计监听器数量', () => {
      eventSystem.on('player_damage', vi.fn());
      eventSystem.on('player_damage', vi.fn());
      eventSystem.on('player_heal', vi.fn());

      expect(eventSystem.getListenerCount('player_damage')).toBe(2);
      expect(eventSystem.getListenerCount('player_heal')).toBe(1);
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁系统', () => {
      const callback = vi.fn();
      eventSystem.on('player_damage', callback);

      eventSystem.destroy();

      // 销毁后不应再触发
      eventSystem.emit('player_damage', { damage: 10 });

      expect(callback).toHaveBeenCalledTimes(0);
    });
  });
});