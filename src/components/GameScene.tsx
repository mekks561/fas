import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from '../engine/PlayCanvasEngine';
import { PlayerShip, PlayerControls } from '../engine/PlayerShip';
import { EnemySystem } from '../engine/EnemySystem';
import { WeaponSystem } from '../engine/WeaponSystem';
import { SkillSystem, SkillType } from '../engine/SkillSystem';
import { StoryMissionManager } from '../engine/StoryMissionManager';
import type { Dialogue } from '../engine/StoryMissionManager';
import { AudioManager } from '../engine/AudioSystem';
import { useGameStore } from '../store/useGameStore';
import { GameHUD } from './GameHUD';
import { LoadingOverlay } from './LoadingOverlay';
import { PauseOverlay } from './PauseOverlay';
import { TouchControlOverlay } from './TouchControlOverlay';
import { DialogueSystem } from './DialogueSystem';
import { QuestTracker } from './QuestTracker';
import './GameScene.css';

export const GameScene: React.FC<{ onGameOver: () => void; onLevelComplete?: () => void }> =
  React.memo(({ onGameOver, onLevelComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<PlayCanvasGameEngine | null>(null);
    const playerRef = useRef<PlayerShip | null>(null);
    const enemySystemRef = useRef<EnemySystem | null>(null);
    const weaponSystemRef = useRef<WeaponSystem | null>(null);
    const skillSystemRef = useRef<SkillSystem | null>(null);
    const storyManagerRef = useRef<StoryMissionManager | null>(null);

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

    const currentWave = useGameStore((state) => state.currentWave);
    const totalWaves = useGameStore((state) => state.totalWaves);
    const enemyCount = useGameStore((state) => state.enemyCount);
    const fps = useGameStore((state) => state.fps);

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
          console.log('[GameScene] Canvas resized to:', canvas.width, 'x', canvas.height);
        }
      };

      resizeCanvas();
      setIsCanvasReady(true);
      window.addEventListener('resize', resizeCanvas);

      return () => {
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
        skillSystemRef.current.activateSkill(SkillType.MISSILE_STRIKE);
        useGameStore.getState().setSkillCooldown('skill1', 8);
      }
    }, []);

    const handleTouchSkill2 = useCallback(() => {
      if (skillSystemRef.current) {
        skillSystemRef.current.activateSkill(SkillType.SHIELD_BURST);
        useGameStore.getState().setSkillCooldown('skill2', 10);
      }
    }, []);

    const handleTouchSkill3 = useCallback(() => {
      if (skillSystemRef.current) {
        skillSystemRef.current.activateSkill(SkillType.TIME_SLOW);
        useGameStore.getState().setSkillCooldown('skill3', 15);
      }
    }, []);

    const handleTouchSkill4 = useCallback(() => {
      if (skillSystemRef.current) {
        skillSystemRef.current.activateSkill(SkillType.OVERDRIVE);
        useGameStore.getState().setSkillCooldown('skill4', 20);
      }
    }, []);

    const initializeEngine = useCallback(() => {
      if (!canvasRef.current) {
        console.error('[GameScene] Canvas ref is null');
        return;
      }

      console.log('[GameScene] Initializing game engine...');

      try {
        const engine = new PlayCanvasGameEngine({
          canvas: canvasRef.current,
          antialias: true,
          enablePhysics: false,
        });
        engineRef.current = engine;
        console.log('[GameScene] PlayCanvas engine created');

        // 初始化音频系统
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

        const skillSystem = new SkillSystem(player, engine);
        skillSystemRef.current = skillSystem;
        console.log('[GameScene] Skill system created');

        // 初始化剧情任务管理器
        const storyMgr = new StoryMissionManager();
        storyManagerRef.current = storyMgr;
        storyMgr.loadAll().then(() => {
          setStoryManager(storyMgr);
          // 自动开始第一章剧情对话
          const startDialogue = storyMgr.getDialogueByTrigger('story', 'story-chapter-01', 'start');
          if (startDialogue) {
            setCurrentDialogue(startDialogue);
          }
          // 自动开始第一个任务
          storyMgr.startMission('mission-01');
          console.log('[GameScene] Story mission manager initialized');
        });

        let frameCount = 0;
        let lastFpsUpdate = Date.now();

        engine.setUpdateCallback((dt: number) => {
          const gameState = useGameStore.getState();

          if (!gameState.isGamePaused && gameState.isSceneReady && playerRef.current) {
            player.update(dt, controlsRef.current);

            if (controlsRef.current.fire && weaponSystemRef.current) {
              weaponSystemRef.current.shoot();
              AudioManager.playSound('playerShoot', player.getPosition());
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
                useGameStore.getState().addScore(hits * 100);
                AudioManager.playSound('enemyHit');
                // 更新任务目标进度
                if (storyManagerRef.current) {
                  storyManagerRef.current.getActiveMissions().forEach((state) => {
                    storyManagerRef.current?.incrementObjective(state.mission.id, 'destroy', hits);
                  });
                }
              }
            }

            useGameStore.getState().updatePlayerHealth(player.getHealth());
            useGameStore.getState().updatePlayerShield(player.getShield());
            useGameStore.getState().setSpeed(player.getSpeed());
            useGameStore.getState().setBoostActive(controlsRef.current.boost);

            if (enemySystemRef.current) {
              useGameStore.getState().setEnemyCount(enemySystemRef.current.getEnemies().length);
              useGameStore.getState().setWave(enemySystemRef.current.getCurrentWave());
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

            if (player.getHealth() <= 0) {
              AudioManager.playSound('playerExplosion', player.getPosition());
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
              break;
            case 'KeyS':
            case 'ArrowDown':
              controlsRef.current.down = true;
              break;
            case 'KeyA':
            case 'ArrowLeft':
              controlsRef.current.left = true;
              break;
            case 'KeyD':
            case 'ArrowRight':
              controlsRef.current.right = true;
              break;
            case 'Space':
              controlsRef.current.boost = true;
              break;
            case 'KeyJ':
              controlsRef.current.fire = true;
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

        setTimeout(() => {
          setIsEngineInitialized(true);
          useGameStore.getState().setSceneReady(true);
          useGameStore.getState().setLoading(false);
          console.log('[GameScene] Scene ready - isSceneReady set to true');
        }, 500);

        return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);

          AudioManager.stopMusic();
          AudioManager.destroy();

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
    }, [isCanvasReady, onGameOver]);

    useEffect(() => {
      if (isCanvasReady && !isEngineInitialized) {
        const cleanup = initializeEngine();
        return cleanup;
      }
    }, [isCanvasReady, isEngineInitialized, initializeEngine]);

    const enemiesRemaining = useMemo(() => {
      return enemyCount;
    }, [enemyCount]);

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

      const skillTypes = [
        SkillType.MISSILE_STRIKE,
        SkillType.SHIELD_BURST,
        SkillType.TIME_SLOW,
        SkillType.OVERDRIVE,
      ];
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
        enemiesRemaining: enemiesRemaining,
        fps: fps,
        skills,
        onSkillActivate: handleSkillActivate,
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
        enemiesRemaining,
        fps,
        skills,
        handleSkillActivate,
      ],
    );

    return (
      <div className="game-scene">
        <canvas ref={canvasRef} className="game-canvas" />

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
