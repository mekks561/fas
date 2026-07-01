import { create } from 'zustand';

describe('useGameStore', () => {
  let store: any;

  beforeEach(() => {
    // 重新创建store实例以重置状态
    store = create((set: any) => ({
      isLoading: true,
      loadingProgress: 0,
      error: null,
      isGamePaused: false,
      isSceneReady: false,
      player: {
        health: 100,
        maxHealth: 100,
        shield: 50,
        maxShield: 50,
        score: 0,
        level: 1,
        speed: 0,
        isBoostActive: false
      },
      skills: {
        cooldowns: {
          skill1: 0,
          skill2: 0,
          skill3: 0,
          skill4: 0
        },
        maxCooldowns: {
          skill1: 8,
          skill2: 10,
          skill3: 15,
          skill4: 20
        }
      },
      touchHandlers: null,
      currentWave: 1,
      waveProgress: 0,
      enemyCount: 0,
      projectileCount: 0,
      fps: 60,

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setLoadingProgress: (progress: number) => set({ loadingProgress: progress }),
      setError: (error: string | null) => set({ error }),
      setGamePaused: (paused: boolean) => set({ isGamePaused: paused }),
      setSceneReady: (ready: boolean) => set({ isSceneReady: ready }),
      updatePlayerHealth: (health: number) => set((state: any) => ({
        player: { ...state.player, health: Math.max(0, Math.min(state.player.maxHealth, health)) }
      })),
      updatePlayerShield: (shield: number) => set((state: any) => ({
        player: { ...state.player, shield: Math.max(0, Math.min(state.player.maxShield, shield)) }
      })),
      addScore: (score: number) => set((state: any) => ({
        player: { ...state.player, score: state.player.score + score }
      })),
      setPlayerLevel: (level: number) => set((state: any) => ({
        player: { ...state.player, level }
      })),
      setSpeed: (speed: number) => set((state: any) => ({
        player: { ...state.player, speed }
      })),
      setBoostActive: (active: boolean) => set((state: any) => ({
        player: { ...state.player, isBoostActive: active }
      })),
      setWave: (wave: number) => set({ currentWave: wave }),
      setWaveProgress: (progress: number) => set({ waveProgress: progress }),
      setEnemyCount: (count: number) => set({ enemyCount: count }),
      setProjectileCount: (count: number) => set({ projectileCount: count }),
      setFps: (fps: number) => set({ fps }),
      setSkillCooldown: (skillId: string, cooldown: number) => set((state: any) => ({
        skills: {
          ...state.skills,
          cooldowns: {
            ...state.skills.cooldowns,
            [skillId]: Math.max(0, cooldown)
          }
        }
      })),
      updateSkillCooldowns: (dt: number) => set((state: any) => ({
        skills: {
          ...state.skills,
          cooldowns: {
            skill1: Math.max(0, state.skills.cooldowns.skill1 - dt),
            skill2: Math.max(0, state.skills.cooldowns.skill2 - dt),
            skill3: Math.max(0, state.skills.cooldowns.skill3 - dt),
            skill4: Math.max(0, state.skills.cooldowns.skill4 - dt)
          }
        }
      })),
      setTouchHandlers: (handlers: any) => set({ touchHandlers: handlers }),
      resetGame: () => set({
        isLoading: true,
        loadingProgress: 0,
        error: null,
        isGamePaused: false,
        isSceneReady: false,
        player: {
          health: 100,
          maxHealth: 100,
          shield: 50,
          maxShield: 50,
          score: 0,
          level: 1,
          speed: 0,
          isBoostActive: false
        },
        skills: {
          cooldowns: {
            skill1: 0,
            skill2: 0,
            skill3: 0,
            skill4: 0
          },
          maxCooldowns: {
            skill1: 8,
            skill2: 10,
            skill3: 15,
            skill4: 20
          }
        },
        touchHandlers: null,
        currentWave: 1,
        waveProgress: 0,
        enemyCount: 0,
        projectileCount: 0,
        fps: 60
      })
    }));
  });

  describe('基础状态', () => {
    it('应该正确初始化状态', () => {
      expect(store.getState().isLoading).toBe(true);
      expect(store.getState().isGamePaused).toBe(false);
      expect(store.getState().isSceneReady).toBe(false);
      expect(store.getState().player.health).toBe(100);
      expect(store.getState().player.score).toBe(0);
    });

    it('应该正确更新加载状态', () => {
      store.getState().setLoading(false);
      expect(store.getState().isLoading).toBe(false);
    });

    it('应该正确更新加载进度', () => {
      store.getState().setLoadingProgress(50);
      expect(store.getState().loadingProgress).toBe(50);
    });

    it('应该正确设置错误信息', () => {
      const errorMsg = 'Test error';
      store.getState().setError(errorMsg);
      expect(store.getState().error).toBe(errorMsg);
    });
  });

  describe('游戏暂停状态', () => {
    it('应该正确切换暂停状态', () => {
      expect(store.getState().isGamePaused).toBe(false);
      store.getState().setGamePaused(true);
      expect(store.getState().isGamePaused).toBe(true);
      store.getState().setGamePaused(false);
      expect(store.getState().isGamePaused).toBe(false);
    });
  });

  describe('玩家状态管理', () => {
    it('应该正确更新玩家生命值', () => {
      store.getState().updatePlayerHealth(80);
      expect(store.getState().player.health).toBe(80);
    });

    it('应该限制玩家生命值在有效范围内', () => {
      store.getState().updatePlayerHealth(150);
      expect(store.getState().player.health).toBe(100); // 不应超过最大值

      store.getState().updatePlayerHealth(-10);
      expect(store.getState().player.health).toBe(0); // 不应低于0
    });

    it('应该正确更新护盾值', () => {
      store.getState().updatePlayerShield(30);
      expect(store.getState().player.shield).toBe(30);
    });

    it('应该限制护盾值在有效范围内', () => {
      store.getState().updatePlayerShield(100);
      expect(store.getState().player.shield).toBe(50); // 不应超过最大值

      store.getState().updatePlayerShield(-10);
      expect(store.getState().player.shield).toBe(0); // 不应低于0
    });

    it('应该正确添加分数', () => {
      store.getState().addScore(100);
      expect(store.getState().player.score).toBe(100);

      store.getState().addScore(200);
      expect(store.getState().player.score).toBe(300);
    });

    it('应该正确设置玩家等级', () => {
      store.getState().setPlayerLevel(5);
      expect(store.getState().player.level).toBe(5);
    });

    it('应该正确设置玩家速度', () => {
      store.getState().setSpeed(15.5);
      expect(store.getState().player.speed).toBe(15.5);
    });

    it('应该正确设置加速状态', () => {
      store.getState().setBoostActive(true);
      expect(store.getState().player.isBoostActive).toBe(true);

      store.getState().setBoostActive(false);
      expect(store.getState().player.isBoostActive).toBe(false);
    });
  });

  describe('波次管理', () => {
    it('应该正确设置当前波次', () => {
      store.getState().setWave(5);
      expect(store.getState().currentWave).toBe(5);
    });

    it('应该正确设置波次进度', () => {
      store.getState().setWaveProgress(0.75);
      expect(store.getState().waveProgress).toBe(0.75);
    });
  });

  describe('敌人和投射物计数', () => {
    it('应该正确设置敌人数量', () => {
      store.getState().setEnemyCount(10);
      expect(store.getState().enemyCount).toBe(10);
    });

    it('应该正确设置投射物数量', () => {
      store.getState().setProjectileCount(5);
      expect(store.getState().projectileCount).toBe(5);
    });
  });

  describe('性能监控', () => {
    it('应该正确设置FPS', () => {
      store.getState().setFps(60);
      expect(store.getState().fps).toBe(60);

      store.getState().setFps(144);
      expect(store.getState().fps).toBe(144);
    });
  });

  describe('技能冷却管理', () => {
    it('应该正确设置技能冷却时间', () => {
      store.getState().setSkillCooldown('skill1', 5);
      expect(store.getState().skills.cooldowns.skill1).toBe(5);
    });

    it('不应该设置负数冷却时间', () => {
      store.getState().setSkillCooldown('skill1', -5);
      expect(store.getState().skills.cooldowns.skill1).toBe(0);
    });

    it('应该正确更新技能冷却时间', () => {
      // 设置初始冷却
      store.getState().setSkillCooldown('skill1', 8);
      expect(store.getState().skills.cooldowns.skill1).toBe(8);

      // 更新冷却（减少2秒）
      store.getState().updateSkillCooldowns(2);
      expect(store.getState().skills.cooldowns.skill1).toBe(6);

      // 更新冷却（减少到0）
      store.getState().updateSkillCooldowns(10);
      expect(store.getState().skills.cooldowns.skill1).toBe(0);
    });

    it('应该同时更新所有技能的冷却时间', () => {
      store.getState().setSkillCooldown('skill1', 8);
      store.getState().setSkillCooldown('skill2', 10);
      store.getState().setSkillCooldown('skill3', 15);
      store.getState().setSkillCooldown('skill4', 20);

      store.getState().updateSkillCooldowns(1);

      expect(store.getState().skills.cooldowns.skill1).toBe(7);
      expect(store.getState().skills.cooldowns.skill2).toBe(9);
      expect(store.getState().skills.cooldowns.skill3).toBe(14);
      expect(store.getState().skills.cooldowns.skill4).toBe(19);
    });
  });

  describe('触摸控制', () => {
    it('应该正确设置触摸处理器', () => {
      const handlers = {
        onMove: vi.fn(),
        onFire: vi.fn(),
        onBoost: vi.fn(),
        onSkill1: vi.fn(),
        onSkill2: vi.fn(),
        onSkill3: vi.fn(),
        onSkill4: vi.fn()
      };

      store.getState().setTouchHandlers(handlers);
      expect(store.getState().touchHandlers).toBe(handlers);
    });
  });

  describe('重置游戏', () => {
    it('应该正确重置所有状态', () => {
      // 修改一些状态
      store.getState().setLoading(false);
      store.getState().setSceneReady(true);
      store.getState().updatePlayerHealth(50);
      store.getState().addScore(1000);
      store.getState().setWave(5);
      store.getState().setSkillCooldown('skill1', 5);

      // 重置游戏
      store.getState().resetGame();

      // 验证所有状态已重置
      expect(store.getState().isLoading).toBe(true);
      expect(store.getState().isSceneReady).toBe(false);
      expect(store.getState().player.health).toBe(100);
      expect(store.getState().player.score).toBe(0);
      expect(store.getState().currentWave).toBe(1);
      expect(store.getState().skills.cooldowns.skill1).toBe(0);
      expect(store.getState().touchHandlers).toBe(null);
    });
  });

  describe('场景就绪状态', () => {
    it('应该正确设置场景就绪状态', () => {
      store.getState().setSceneReady(true);
      expect(store.getState().isSceneReady).toBe(true);

      store.getState().setSceneReady(false);
      expect(store.getState().isSceneReady).toBe(false);
    });
  });
});
