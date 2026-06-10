import { useRef, useEffect, useCallback } from 'react';
import { Scene } from '@babylonjs/core';
import { useGameStore } from '../store/useGameStore';
import { PlayerShip } from '../PlayerShip';
import { EnemySystem } from '../EnemySystem';
import { WeaponSystem } from '../WeaponSystem';
import { ParticleManager } from '../ParticleManager';
import { AudioSystem } from '../AudioSystem';
import { ScoreSystem } from '../ScoreSystem';
import { GameStateManager } from '../GameStateManager';

interface GameRefs {
  playerShipRef: React.MutableRefObject<PlayerShip | null>;
  enemySystemRef: React.MutableRefObject<EnemySystem | null>;
  weaponSystemRef: React.MutableRefObject<WeaponSystem | null>;
  particleManagerRef: React.MutableRefObject<ParticleManager | null>;
  audioSystemRef: React.MutableRefObject<AudioSystem | null>;
  scoreSystemRef: React.MutableRefObject<ScoreSystem | null>;
  gameStateManagerRef: React.MutableRefObject<GameStateManager | null>;
}

export const useGameLoop = (
  scene: Scene | null,
  refs: GameRefs,
  getControls: () => any,
  getMouseDelta: () => any
) => {
  const animationFrameIdRef = useRef<number>(0);
  const {
    isSceneReady,
    isGamePaused,
    setSpeed,
    setBoostActive,
    addScore,
    setFps,
    setEnemyCount,
    setProjectileCount,
    setParticleCount,
  } = useGameStore((state) => ({
    isSceneReady: state.isSceneReady,
    isGamePaused: state.isGamePaused,
    setSpeed: state.setSpeed,
    setBoostActive: state.setBoostActive,
    addScore: state.addScore,
    setFps: state.setFps,
    setEnemyCount: state.setEnemyCount,
    setProjectileCount: state.setProjectileCount,
    setParticleCount: state.setParticleCount,
  }));

  const gameLoop = useCallback(() => {
    if (!scene || !isSceneReady) return;

    const currentTime = performance.now();
    const lastTimeRef = useRef<number>(currentTime);
    const fpsUpdateInterval = useRef<number>(0);
    const frameCount = useRef<number>(0);

    const loop = () => {
      const now = performance.now();
      const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 1 / 30);
      lastTimeRef.current = now;

      fpsUpdateInterval.current += deltaTime;
      frameCount.current++;

      if (fpsUpdateInterval.current >= 0.5) {
        setFps(Math.round(frameCount.current / fpsUpdateInterval.current));
        fpsUpdateInterval.current = 0;
        frameCount.current = 0;
      }

      if (!isGamePaused) {
        const controls = getControls();
        const mouseDelta = getMouseDelta();

        refs.gameStateManagerRef.current?.update(deltaTime);
        refs.playerShipRef.current?.update(deltaTime, controls, mouseDelta);
        refs.enemySystemRef.current?.update(deltaTime);
        refs.weaponSystemRef.current?.update(deltaTime);

        if (controls.fire) {
          refs.weaponSystemRef.current?.fire();
        }

        const enemies = refs.enemySystemRef.current?.getEnemies() || [];
        const hits = refs.weaponSystemRef.current?.checkCollisions(enemies) || 0;
        if (hits > 0) {
          addScore(hits * 100);
        }

        refs.particleManagerRef.current?.update(deltaTime);
        refs.scoreSystemRef.current?.update(deltaTime);

        if (refs.playerShipRef.current) {
          setSpeed(Math.round(refs.playerShipRef.current.speed));
          setBoostActive(controls.boost);
        }

        setEnemyCount(refs.enemySystemRef.current?.getEnemies()?.length || 0);
        setProjectileCount(refs.weaponSystemRef.current?.getProjectileCount() || 0);
        setParticleCount(refs.particleManagerRef.current?.getParticleSystemCount() || 0);
      }

      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    animationFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [scene, isSceneReady, isGamePaused, getControls, getMouseDelta, refs,
    setSpeed, setBoostActive, addScore, setFps, setEnemyCount, setProjectileCount, setParticleCount]);

  useEffect(() => {
    if (!isSceneReady || !scene) return;

    const cleanup = gameLoop();

    return cleanup;
  }, [isSceneReady, scene, gameLoop]);

  return {
    animationFrameIdRef,
  };
};
