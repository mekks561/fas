import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { PlayerControls } from '../engine/PlayerShip';
import type { Dialogue } from '../engine/StoryMissionManager';
import { useGameStore } from '../store/useGameStore';
import { GameHUD } from './GameHUD';
import { LoadingOverlay } from './LoadingOverlay';
import { PauseOverlay } from './PauseOverlay';
import { TouchControlOverlay } from './TouchControlOverlay';
import { DialogueSystem } from './DialogueSystem';
import { QuestTracker } from './QuestTracker';
import { gameplayManager } from '../engine/GameplayManager';
import type { GameplayEvents } from '../engine/GameplayManager';
import { dailyChallengeManager } from '../engine/DailyChallengeManager';
import './GameScene.css';

type PlayCanvasGameEngine = import('../engine/PlayCanvasEngine').PlayCanvasGameEngine;
type PlayerShip = import('../engine/PlayerShip').PlayerShip;
type EnemySystem = import('../engine/EnemySystem').EnemySystem;
type WeaponSystem = import('../engine/WeaponSystem').WeaponSystem;
type SkillSystem = import('../engine/SkillSystem').SkillSystem;
type SkillType = import('../engine/SkillSystem').SkillType;
type StoryMissionManager = import('../engine/StoryMissionManager').StoryMissionManager;
type PowerupSpawner = import('../engine/PowerupSystem').PowerupSpawner;

const enginePowerupTypeToLua = (engineType: string): string | null => {
  const mapping: Record<string, string> = {
    health: 'health',
    shield: 'shield',
    speedBoost: 'speed',
    weaponUpgrade: 'damage',
    invincibility: 'invincible',
    scoreBonus: 'damage',
    missile: 'triple_shot',
    laser: 'triple_shot',
  };
  return mapping[engineType] || null;
};


export const GameScene: React.FC<{ onGameOver: () => void; onLevelComplete?: () => void }> =
  React.memo(({ onGameOver, onLevelComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<PlayCanvasGameEngine | null>(null);
    const playerRef = useRef<PlayerShip | null>(null);
    const enemySystemRef = useRef<EnemySystem | null>(null);
    const weaponSystemRef = useRef<WeaponSystem | null>(null);
    const skillSystemRef = useRef<SkillSystem | null>(null);
    const storyManagerRef = useRef<StoryMissionManager | null>(null);
    const gameplayManagerRef = useRef<typeof gameplayManager | null>(null);
    const powerupSpawnerRef = useRef<PowerupSpawner | null>(null);

    const [storyManager, setStoryManager] = useState<StoryMissionManager | null>(null);
    const [currentDialogue, setCurrentDialogue] = useState<Dialogue | null>(null);

    const isLoading = useGameStore((state) => state.isLoading);
    const isGamePaused = useGameStore((state) => state.isGamePaused);
    const isSceneReady = useGameStore((state) => state.isSceneReady);

    const playerHealth = useGameStore((state) => state.player.health);
    const playerMaxHealth = useGameStore((state) => state.player.maxHealth);
    const playerShield = useGameStore((state) => state.player.shield);
    const playerMaxShield = useGameStore((state) => state.player.maxShield);
    const playerScore = useGameStore((state) => state.player.score);
    const playerLevel = useGameStore((state) => state.player.level);
    const playerSpeed = useGameStore((state) => state.player.speed);
  const isBoostActive = useGameStore((state) => state.player.isBoostActive);
  const playerBoostEnergy = useGameStore((state) => state.player.boostEnergy);
  const playerMaxBoostEnergy = useGameStore((state) => state.player.maxBoostEnergy);

    const currentWave = useGameStore((state) => state.currentWave);
    const totalWaves = useGameStore((state) => state.totalWaves);
    const enemyCount = useGameStore((state) => state.enemyCount);
    const fps = useGameStore((state) => state.fps);
    const combo = useGameStore((state) => state.combo);
    const maxCombo = useGameStore((state) => state.maxCombo);
    const rank = useGameStore((state) => state.rank);
    const activePowerups = useGameStore((state) => state.activePowerups);
    const isBossWave = useGameStore((state) => state.isBossWave);
    const isEliteWave = useGameStore((state) => state.isEliteWave);
    const killCount = useGameStore((state) => state.killCount);

    const skillCooldowns = useGameStore((state) => state.skills.cooldowns);
    const skillMaxCooldowns = useGameStore((state) => state.skills.maxCooldowns);

    const controlsRef = useRef<PlayerControls>({
      left: false,
      right: false,
      up: false,
      down: false,
      boost: false,
      fire: false,
    });

    const [isEngineInitialized, setIsEngineInitialized] = useState(false);
    const [isCanvasReady, setIsCanvasReady] = useState(false);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
      };

      resizeCanvas();
      const readyTimer = setTimeout(() => setIsCanvasReady(true), 0);
      window.addEventListener('resize', resizeCanvas);

      return () => {
        clearTimeout(readyTimer);
        window.removeEventListener('resize', resizeCanvas);
      };
    }, []);

    const handleTouchMove = useCallback((x: number, y: number) => {
      if (controlsRef.current) {
        controlsRef.current.left = x < -0.1;
        controlsRef.current.right = x > 0.1;
        controlsRef.current.up = y < -0.1;
        controlsRef.current.down = y > 0.1;
      }
    }, []);

    const handleTouchFire = useCallback((active: boolean) => {
      if (controlsRef.current) {
        controlsRef.current.fire = active;
      }
    }, []);

    const handleTouchBoost = useCallback((active: boolean) => {
      if (controlsRef.current) {
        controlsRef.current.boost = active;
      }
    }, []);

    const handleTouchSkill1 = useCallback(() => {
      if (skillSystemRef.current) {
        skillSystemRef.current.activateSkill('missile_strike' as SkillType);
        useGameStore.getState().setSkillCooldown('skill1', 8);
      }
    }, []);

    const handleTouchSkill2 = useCallback(() => {
      if (skillSystemRef.current) {
        skillSystemRef.current.activateSkill('shield_burst' as SkillType);
        useGameStore.getState().setSkillCooldown('skill2', 10);
      }
    }, []);

    const handleTouchSkill3 = useCallback(() => {
      if (skillSystemRef.current) {
        skillSystemRef.current.activateSkill('time_slow' as SkillType);
        useGameStore.getState().setSkillCooldown('skill3', 15);
      }
    }, []);

    const handleTouchSkill4 = useCallback(() => {
      if (skillSystemRef.current) {
        skillSystemRef.current.activateSkill('overdrive' as SkillType);
        useGameStore.getState().setSkillCooldown('skill4', 20);
      }
    }, []);

    const initializeEngine = useCallback(async () => {
      if (!canvasRef.current) {
        console.error('[GameScene] Canvas ref is null');
        return;
      }

      console.log('[GameScene] Initializing game engine...');

      try {
        const [pcModule, { PlayCanvasGameEngine }, { PlayerShip }, { EnemySystem }, { WeaponSystem }, { SkillSystem, SkillType }, { StoryMissionManager }, { AudioManager }, { PowerupSpawner, PowerupType: EnginePowerupType }] = await Promise.all([
          import('playcanvas'),
          import('../engine/PlayCanvasEngine'),
          import('../engine/PlayerShip'),
          import('../engine/EnemySystem'),
          import('../engine/WeaponSystem'),
          import('../engine/SkillSystem'),
          import('../engine/StoryMissionManager'),
          import('../engine/AudioSystem'),
          import('../engine/PowerupSystem'),
        ]);

        const pc = pcModule;

        const engine = new PlayCanvasGameEngine({
          canvas: canvasRef.current,
          antialias: true,
          enablePhysics: false,
        });
        engineRef.current = engine;
        console.log('[GameScene] PlayCanvas engine created');

        AudioManager.initialize(engine.getApp());
        AudioManager.playMusic('gameMusic');
        console.log('[GameScene] Audio system initialized');

        engine.setCameraPosition(0, 10, 15);
        engine.lookAt(new pc.Vec3(0, 0, 0));
        console.log('[GameScene] Camera position set to (0, 10, 15)');

        engine.addDirectionalLight('sun', new pc.Vec3(-5, 10, 5), new pc.Color(1, 0.95, 0.9), 1.5);
        engine.addLight('fill', new pc.Vec3(10, 5, -10), new pc.Color(0.4, 0.5, 0.8), 0.5);
        console.log('[GameScene] Lights added');

        engine.createStarField(300, 20, 60);
        engine.createNebula(new pc.Vec3(30, 10, -30), 25);
        engine.createNebula(new pc.Vec3(-30, -5, 25), 20);
        engine.createPlanet('planet1', new pc.Vec3(40, 15, 35), 5, new pc.Color(0.4, 0.6, 0.8));
        engine.createPlanet('planet2', new pc.Vec3(-35, -10, -25), 4, new pc.Color(0.8, 0.5, 0.3));
        console.log('[GameScene] Environment created');

        const gameState = useGameStore.getState();
        const player = new PlayerShip({
          engine,
          initialPosition: new pc.Vec3(0, 0, 0),
          health: gameState.player.health,
          shield: gameState.player.shield,
        });
        playerRef.current = player;
        console.log('[GameScene] Player created at position (0, 0, 0)');

        const enemySystem = new EnemySystem(engine, player);
        enemySystemRef.current = enemySystem;
        console.log('[GameScene] Enemy system created');

        const weaponSystem = new WeaponSystem(engine);
        weaponSystem.setPlayer(player);
        weaponSystemRef.current = weaponSystem;
        console.log('[GameScene] Weapon system created');

        const powerupSpawner = new PowerupSpawner(engine);
        powerupSpawner.setSpawnInterval(8);
        powerupSpawner.setMaxPowerups(6);
        powerupSpawnerRef.current = powerupSpawner;
        console.log('[GameScene] Powerup spawner created');

        const skillSystem = new SkillSystem(player, engine);
        skillSystemRef.current = skillSystem;
        console.log('[GameScene] Skill system created');

        const storyMgr = new StoryMissionManager();
        storyManagerRef.current = storyMgr;
        storyMgr.loadAll().then(() => {
          setStoryManager(storyMgr);
          const startDialogue = storyMgr.getDialogueByTrigger('story', 'story-chapter-01', 'start');
          if (startDialogue) {
            setCurrentDialogue(startDialogue);
          }
          storyMgr.startMission('mission-01');
          console.log('[GameScene] Story mission manager initialized');
        });

        gameplayManagerRef.current = gameplayManager;
        const gameplayEvents: GameplayEvents = {
          onWaveStart: (waveNumber) => {
            useGameStore.getState().setWave(waveNumber);
            const waveState = gameplayManager.getWaveState();
            if (waveState) {
              useGameStore.getState().setWaveInfo({
                isBossWave: waveState.isBossWave,
                isEliteWave: waveState.isEliteWave,
                enemiesSpawned: waveState.enemiesSpawned,
                enemiesDefeated: waveState.enemiesDefeated,
                enemiesRemaining: waveState.enemiesRemaining,
              });
            }
          },
          onWaveComplete: (_waveNumber, _score) => {
          },
          onWaveReward: (reward) => {
            useGameStore.getState().addScore(reward.totalScoreBonus);
            useGameStore.getState().setWaveRewardNotification({
              waveNumber: reward.waveNumber,
              rewards: reward.rewards.map((r) => ({ label: r.label })),
            });
            for (const r of reward.rewards) {
              if (r.type === 'heal' && playerRef.current) {
                playerRef.current.heal(r.amount);
              } else if (r.type === 'shield' && playerRef.current) {
                playerRef.current.addShield(r.amount);
              }
            }
          },
          onEnemyKilled: (_enemyType, score) => {
            useGameStore.getState().addScore(score);
            useGameStore.getState().addKill();
          },
          onComboUpdate: (comboCurrent, comboMax) => {
            const comboInfo = gameplayManager.getComboInfo();
            useGameStore.getState().setCombo(
              comboCurrent,
              comboMax,
              comboInfo?.comboTimer || 0,
            );
          },
          onRankChange: (newRank) => {
            useGameStore.getState().setRank(newRank);
          },
          onPowerupApplied: (powerupType) => {
            useGameStore.getState().addPowerup();
            const config = gameplayManager.getPowerupConfig(powerupType as Parameters<typeof gameplayManager.getPowerupConfig>[0]);
            const active = gameplayManager.getActivePowerups();
            const powerupData = active.find((p) => p.type === powerupType);
            if (powerupData) {
              useGameStore.getState().addActivePowerup({
                type: powerupData.type,
                name: powerupData.displayName || config?.name || powerupData.type,
                remainingTime: powerupData.remainingDuration,
                duration: powerupData.duration,
                value: powerupData.multiplier || powerupData.stacks || 0,
              });
            }
          },
          onPowerupExpired: (powerupType) => {
            useGameStore.getState().removeActivePowerup(powerupType);
          },
          onGameOver: (_finalScore, _rank) => {
          },
          onAchievementUnlocked: (achievement) => {
            useGameStore.getState().addAchievementNotification({
              id: achievement.id,
              name: achievement.name,
              description: achievement.description,
              icon: achievement.icon,
              rarity: achievement.rarity,
              timestamp: Date.now(),
            });
          },
        };
        gameplayManager.setEventCallbacks(gameplayEvents);

        // 读取难度设置（基础难度 + 自适应配置）
        const savedSettings = localStorage.getItem('gameSettings');
        let baseDifficulty: 'easy' | 'normal' | 'hard' = 'normal';
        let adaptiveEnabled = true;
        let adaptiveIntensity: 'low' | 'medium' | 'high' = 'medium';
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings);
            if (parsed.difficulty) baseDifficulty = parsed.difficulty;
            if (parsed.adaptiveDifficulty !== undefined) adaptiveEnabled = parsed.adaptiveDifficulty;
            if (parsed.adaptiveIntensity) adaptiveIntensity = parsed.adaptiveIntensity;
          } catch {
            // 忽略解析错误，使用默认值
          }
        }

        // 每日挑战模式：覆盖基础难度为目标挑战难度，并关闭自适应（保证挑战条件一致）
        const isDailyChallenge = dailyChallengeManager.isDailyChallengeActive();
        if (isDailyChallenge) {
          const challengeConfig = dailyChallengeManager.getActiveChallenge();
          if (challengeConfig) {
            baseDifficulty = challengeConfig.baseDifficulty;
            adaptiveEnabled = false;
            console.log(
              `[GameScene] 每日挑战模式已启用：难度=${baseDifficulty}，目标波次=${challengeConfig.targetWaves}，倍率=${challengeConfig.totalScoreMultiplier.toFixed(2)}x，修饰器=${challengeConfig.modifiers.map((m) => m.type).join(',')}`,
            );
          }
        }

        // 将自适应配置同步到 DifficultyManager
        gameplayManager.setAdaptiveConfig({ enabled: adaptiveEnabled, intensity: adaptiveIntensity });

        await gameplayManager.initialize(baseDifficulty);
        await gameplayManager.startGame(baseDifficulty);

        if (enemySystemRef.current) {
          const waveMgr = gameplayManager.getWaveManager();
          if (waveMgr) {
            enemySystemRef.current.setWaveManager(waveMgr);
          }
          enemySystemRef.current.startWave(1);
          enemySystemRef.current.setPowerupDropCallback((position, _enemyType) => {
            if (powerupSpawnerRef.current) {
              const types = Object.values(EnginePowerupType);
              const randomType = types[Math.floor(Math.random() * types.length)];
              powerupSpawnerRef.current.addPowerup(randomType, new pc.Vec3(position.x, 0, position.z), 1, 8);
            }
          });
        }

        gameplayManager.startWave(1);
        console.log('[GameScene] Gameplay manager initialized');

        let frameCount = 0;
        let lastFpsUpdate = Date.now();

        engine.setUpdateCallback((dt: number) => {
          const gameState = useGameStore.getState();

          if (!gameState.isGamePaused && gameState.isSceneReady && playerRef.current) {
            playerRef.current.update(dt, controlsRef.current);

            if (controlsRef.current.fire && weaponSystemRef.current) {
              weaponSystemRef.current.shoot();
              AudioManager.playSound('playerShoot', playerRef.current.getPosition());
            }

            if (weaponSystemRef.current) {
              weaponSystemRef.current.update(dt);
            }

            if (enemySystemRef.current) {
              enemySystemRef.current.update(dt);
            }

            if (skillSystemRef.current) {
              skillSystemRef.current.update(dt);
            }

            if (weaponSystemRef.current && enemySystemRef.current) {
              const enemies = enemySystemRef.current.getEnemies();
              const hits = weaponSystemRef.current.checkCollisions(enemies);
              if (hits > 0) {
                const killedEnemies = enemies.slice(0, hits);
                let totalScore = 0;
                for (const enemy of killedEnemies) {
                  const score = enemySystemRef.current.onEnemyKilled(enemy);
                  totalScore += score;
                  if (gameplayManagerRef.current && gameplayManagerRef.current.isRunning()) {
                    const type = enemy.getType();
                    const isBoss = type.includes('boss') || type === 'boss';
                    const isElite = type === 'elite';
                    gameplayManagerRef.current.onEnemyKilled(type, isBoss, isElite);
                  }
                }
                if (totalScore > 0) {
                  useGameStore.getState().addScore(totalScore);
                }
                AudioManager.playSound('enemyHit');
                if (storyManagerRef.current) {
                  storyManagerRef.current.getActiveMissions().forEach((state) => {
                    storyManagerRef.current?.incrementObjective(state.mission.id, 'destroy', hits);
                  });
                }
              }
            }

            if (powerupSpawnerRef.current && playerRef.current) {
              powerupSpawnerRef.current.update(dt);
              const collected = powerupSpawnerRef.current.checkCollisions(playerRef.current, weaponSystemRef.current || undefined);
              if (collected) {
                AudioManager.playSound('powerup');

                if (collected.getType() === 'scoreBonus') {
                  useGameStore.getState().addScore(500);
                }

                if (gameplayManagerRef.current && gameplayManagerRef.current.isRunning()) {
                  const engineType = collected.getType();
                  const luaType = enginePowerupTypeToLua(engineType);
                  if (luaType) {
                    gameplayManagerRef.current.applyPowerup(luaType as 'health' | 'shield' | 'speed' | 'damage' | 'triple_shot' | 'invincible' | 'magnet' | 'slow_time');
                  }
                }
              }
            }

            if (gameplayManagerRef.current && gameplayManagerRef.current.isRunning()) {
              gameplayManagerRef.current.update(dt);
              const activePowerups = gameplayManagerRef.current.getActivePowerups();
              if (activePowerups.length > 0) {
                const storePowerups = activePowerups.map((p) => ({
                  type: p.type,
                  name: p.displayName || p.type,
                  remainingTime: p.remainingDuration,
                  duration: p.duration,
                  value: p.multiplier || p.stacks || 0,
                }));
                useGameStore.getState().setActivePowerups(storePowerups);
              }
            }

            useGameStore.getState().updatePlayerHealth(playerRef.current.getHealth());
            useGameStore.getState().updatePlayerShield(playerRef.current.getShield());
            useGameStore.getState().setSpeed(playerRef.current.getSpeed());
            useGameStore.getState().setBoostActive(playerRef.current.isBoostActive());
            useGameStore.getState().setBoostEnergy(playerRef.current.getBoostEnergy());

            // 难度自适应：上报玩家生命并将倍率同步到敌人系统
            if (gameplayManagerRef.current && gameplayManagerRef.current.isRunning()) {
              gameplayManagerRef.current.reportPlayerHealth(
                playerRef.current.getHealth(),
                playerRef.current.getMaxHealth(),
              );
              const diffMultiplier = gameplayManagerRef.current.getDifficultyMultiplier();
              if (enemySystemRef.current) {
                enemySystemRef.current.setDifficultyMultiplier(diffMultiplier);
              }
              useGameStore.getState().setDifficultyInfo(gameplayManagerRef.current.getDifficultySnapshot());
            }

            if (enemySystemRef.current) {
              useGameStore.getState().setEnemyCount(enemySystemRef.current.getAliveCount());
              useGameStore.getState().setWave(enemySystemRef.current.getCurrentWave());
              useGameStore.getState().setTotalWaves(enemySystemRef.current.getTotalWaves());
              useGameStore.getState().setWaveInfo({
                isBossWave: enemySystemRef.current.isBossWave(),
                isEliteWave: enemySystemRef.current.isEliteWave(),
                enemiesRemaining: enemySystemRef.current.getRemainingCount(),
              });
            }

            useGameStore.getState().updateSkillCooldowns(dt);

            frameCount++;
            const now = Date.now();
            if (now - lastFpsUpdate >= 1000) {
              const currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
              useGameStore.getState().setFps(currentFps);
              frameCount = 0;
              lastFpsUpdate = now;
            }

            if (playerRef.current.getHealth() <= 0) {
              AudioManager.playSound('playerExplosion', playerRef.current.getPosition());
              AudioManager.stopMusic();
              onGameOver();
            }

            if (enemySystemRef.current && onLevelComplete) {
              const totalWaves = enemySystemRef.current.getTotalWaves();
              const currentWave = enemySystemRef.current.getCurrentWave();
              const enemies = enemySystemRef.current.getEnemies();

              if (currentWave > totalWaves && enemies.length === 0) {
                AudioManager.playSound('levelComplete');
                onLevelComplete();
              }
            }
          }
        });

        engine.start();
        console.log('[GameScene] Engine started');

        const handleKeyDown = (e: KeyboardEvent) => {
          switch (e.code) {
            case 'KeyW':
            case 'ArrowUp':
              controlsRef.current.up = true;
              e.preventDefault();
              break;
            case 'KeyS':
            case 'ArrowDown':
              controlsRef.current.down = true;
              e.preventDefault();
              break;
            case 'KeyA':
            case 'ArrowLeft':
              controlsRef.current.left = true;
              e.preventDefault();
              break;
            case 'KeyD':
            case 'ArrowRight':
              controlsRef.current.right = true;
              e.preventDefault();
              break;
            case 'Space':
              controlsRef.current.boost = true;
              e.preventDefault();
              break;
            case 'KeyJ':
              controlsRef.current.fire = true;
              e.preventDefault();
              break;
            case 'KeyQ':
              if (skillSystemRef.current) {
                skillSystemRef.current.activateSkill(SkillType.MISSILE_STRIKE);
                useGameStore.getState().setSkillCooldown('skill1', 8);
                AudioManager.playSound('weaponUpgrade');
              }
              break;
            case 'KeyE':
              if (skillSystemRef.current) {
                skillSystemRef.current.activateSkill(SkillType.SHIELD_BURST);
                useGameStore.getState().setSkillCooldown('skill2', 10);
                AudioManager.playSound('shieldActivate');
              }
              break;
            case 'KeyT':
              if (skillSystemRef.current) {
                skillSystemRef.current.activateSkill(SkillType.TIME_SLOW);
                useGameStore.getState().setSkillCooldown('skill3', 15);
              }
              break;
            case 'KeyG':
              if (skillSystemRef.current) {
                skillSystemRef.current.activateSkill(SkillType.OVERDRIVE);
                useGameStore.getState().setSkillCooldown('skill4', 20);
              }
              break;
          }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
          switch (e.code) {
            case 'KeyW':
            case 'ArrowUp':
              controlsRef.current.up = false;
              break;
            case 'KeyS':
            case 'ArrowDown':
              controlsRef.current.down = false;
              break;
            case 'KeyA':
            case 'ArrowLeft':
              controlsRef.current.left = false;
              break;
            case 'KeyD':
            case 'ArrowRight':
              controlsRef.current.right = false;
              break;
            case 'Space':
              controlsRef.current.boost = false;
              break;
            case 'KeyJ':
              controlsRef.current.fire = false;
              break;
          }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        useGameStore.getState().setTouchHandlers({
          onMove: handleTouchMove,
          onFire: handleTouchFire,
          onBoost: handleTouchBoost,
          onSkill1: handleTouchSkill1,
          onSkill2: handleTouchSkill2,
          onSkill3: handleTouchSkill3,
          onSkill4: handleTouchSkill4,
        });

        const initTimer = setTimeout(() => {
          // eslint-disable-next-line @eslint-react/set-state-in-effect
          setIsEngineInitialized(true);
          useGameStore.getState().setSceneReady(true);
          useGameStore.getState().setLoading(false);
          console.log('[GameScene] Scene ready - isSceneReady set to true');
        }, 500);

        return () => {
          clearTimeout(initTimer);
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);

          AudioManager.stopMusic();
          AudioManager.destroy();

          if (powerupSpawnerRef.current) {
            powerupSpawnerRef.current.clearAll();
            powerupSpawnerRef.current = null;
          }

          if (engineRef.current) {
            engineRef.current.destroy();
            engineRef.current = null;
          }
        };
      } catch (error) {
        console.error('[GameScene] Initialization failed:', error);
        useGameStore.getState().setError('游戏初始化失败: ' + (error as Error).message);
        useGameStore.getState().setLoading(false);
        return () => {};
      }
    }, [onGameOver, onLevelComplete, handleTouchMove, handleTouchFire, handleTouchBoost, handleTouchSkill1, handleTouchSkill2, handleTouchSkill3, handleTouchSkill4]);

    useEffect(() => {
      if (isCanvasReady && !isEngineInitialized) {
        const cleanupPromise = initializeEngine();
        return () => {
          cleanupPromise?.then((cleanup) => cleanup?.());
        };
      }
    }, [isCanvasReady, isEngineInitialized, initializeEngine]);

    const skills = useMemo(
      () => [
        {
          name: '导弹打击',
          icon: 'missile',
          cooldown: skillCooldowns.skill1,
          maxCooldown: skillMaxCooldowns.skill1,
          keyBinding: 'Q',
          isActive: false,
        },
        {
          name: '护盾爆发',
          icon: 'shield',
          cooldown: skillCooldowns.skill2,
          maxCooldown: skillMaxCooldowns.skill2,
          keyBinding: 'E',
          isActive: false,
        },
        {
          name: '时间减缓',
          icon: 'clock',
          cooldown: skillCooldowns.skill3,
          maxCooldown: skillMaxCooldowns.skill3,
          keyBinding: 'T',
          isActive: false,
        },
        {
          name: '过载驱动',
          icon: 'zap',
          cooldown: skillCooldowns.skill4,
          maxCooldown: skillMaxCooldowns.skill4,
          keyBinding: 'G',
          isActive: false,
        },
      ],
      [skillCooldowns, skillMaxCooldowns],
    );

    const handleSkillActivate = useCallback((index: number) => {
      if (!skillSystemRef.current) return;

      const skillTypes: SkillType[] = ['missile_strike', 'shield_burst', 'time_slow', 'overdrive'] as SkillType[];
      const skillKeys = ['skill1', 'skill2', 'skill3', 'skill4'];
      const cooldowns = [8, 10, 15, 20];

      skillSystemRef.current.activateSkill(skillTypes[index]);
      useGameStore.getState().setSkillCooldown(skillKeys[index], cooldowns[index]);
    }, []);

    const hudProps = useMemo(
      () => ({
        health: playerHealth,
        maxHealth: playerMaxHealth,
        shield: playerShield,
        maxShield: playerMaxShield,
        score: playerScore,
        level: playerLevel,
        wave: currentWave,
        totalWaves: totalWaves,
        enemiesRemaining: enemyCount,
        fps: fps,
        skills,
        onSkillActivate: handleSkillActivate,
        speed: playerSpeed,
        isBoostActive: isBoostActive,
        boostEnergy: playerBoostEnergy,
        maxBoostEnergy: playerMaxBoostEnergy,
        combo,
        maxCombo,
        rank,
        killCount,
        isBossWave,
        isEliteWave,
        activeEffects: activePowerups.map((p) => ({
          type: p.type,
          icon: p.type,
          remainingTime: p.remainingTime,
          duration: p.duration,
          value: p.value,
        })),
      }),
      [
        playerHealth,
        playerMaxHealth,
        playerShield,
        playerMaxShield,
        playerScore,
        playerLevel,
        currentWave,
        totalWaves,
        enemyCount,
        fps,
        skills,
        handleSkillActivate,
        playerSpeed,
        isBoostActive,
        playerBoostEnergy,
        playerMaxBoostEnergy,
        combo,
        maxCombo,
        rank,
        killCount,
        isBossWave,
        isEliteWave,
        activePowerups,
      ],
    );

    return (
      <div className="game-scene">
        <canvas ref={canvasRef} className="game-canvas" tabIndex={0} onClick={(e) => e.currentTarget.focus()} />

        {isSceneReady && <GameHUD {...hudProps} />}

        {isSceneReady && storyManager && <QuestTracker manager={storyManager} />}

        {isSceneReady && currentDialogue && (
          <DialogueSystem dialogue={currentDialogue} onComplete={() => setCurrentDialogue(null)} />
        )}

        {isLoading && <LoadingOverlay />}

        {isSceneReady && isGamePaused && <PauseOverlay />}

        {isSceneReady && (
          <TouchControlOverlay
            onMove={handleTouchMove}
            onFire={handleTouchFire}
            onBoost={handleTouchBoost}
            onSkill1={handleTouchSkill1}
            onSkill2={handleTouchSkill2}
            onSkill3={handleTouchSkill3}
            onSkill4={handleTouchSkill4}
            skillCooldowns={skillCooldowns}
            skillMaxCooldowns={skillMaxCooldowns}
          />
        )}
      </div>
    );
  });

GameScene.displayName = 'GameScene';

export default GameScene;
