import React, { useRef, useCallback, useEffect } from 'react';
import { Scene, Vector3, Color3, Color4, MeshBuilder, StandardMaterial, ArcRotateCamera, HemisphericLight, DirectionalLight } from '@babylonjs/core';
import { Engine, Scene as BabylonScene } from 'react-babylonjs';
import { PlayerShip } from '../PlayerShip';
import { EnemySystem } from '../EnemySystem';
import { WeaponSystem } from '../WeaponSystem';
import { ParticleManager } from '../ParticleManager';
import { AudioSystem } from '../AudioSystem';
import { ScoreSystem } from '../ScoreSystem';
import { TextureManager } from '../TextureManager';
import { GameStateManager } from '../GameStateManager';
import { useGameStore } from '../store/useGameStore';
import { useInputManager } from '../hooks/useInputManager';
import { GameHUD } from './GameHUD';
import { LoadingOverlay } from './LoadingOverlay';
import { ErrorOverlay } from './ErrorOverlay';
import { PauseOverlay } from './PauseOverlay';
import './GameScene.css';

export const GameScene: React.FC = React.memo(() => {
  // Store
  const {
    isLoading,
    loadingProgress,
    error,
    isGamePaused,
    setSceneReady,
    setLoading,
    setLoadingProgress,
    setError,
    setGamePaused,
    resetGame,
  } = useGameStore((state) => ({
    isLoading: state.isLoading,
    loadingProgress: state.loadingProgress,
    error: state.error,
    isGamePaused: state.isGamePaused,
    setSceneReady: state.setSceneReady,
    setLoading: state.setLoading,
    setLoadingProgress: state.setLoadingProgress,
    setError: state.setError,
    setGamePaused: state.setGamePaused,
    resetGame: state.resetGame,
  }));

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const playerShipRef = useRef<PlayerShip | null>(null);
  const enemySystemRef = useRef<EnemySystem | null>(null);
  const weaponSystemRef = useRef<WeaponSystem | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const audioSystemRef = useRef<AudioSystem | null>(null);
  const scoreSystemRef = useRef<ScoreSystem | null>(null);
  const gameStateManagerRef = useRef<GameStateManager | null>(null);
  const textureManagerRef = useRef<TextureManager | null>(null);
  const animationFrameIdRef = useRef<number>(0);

  // Hooks
  const { getControls, getMouseDelta } = useInputManager(canvasRef.current);

  // Scene Setup
  const setupScene = useCallback((scene: Scene) => {
    scene.clearColor = new Color4(0, 0, 0.05, 1);
    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogDensity = 0.01;
    scene.fogColor = new Color3(0, 0, 0.1);
  }, []);

  const setupCamera = useCallback((scene: Scene) => {
    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2, 20, Vector3.Zero(), scene);
    const canvas = scene.getEngine().getRenderingCanvas();
    if (canvas) {
      camera.attachControl(canvas, true);
    }
  }, []);

  const setupLighting = useCallback((scene: Scene) => {
    const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.8;
    ambientLight.groundColor = new Color3(0.2, 0.2, 0.4);
    ambientLight.diffuse = new Color3(0.8, 0.8, 1.0);

    const sunLight = new DirectionalLight('sunLight', new Vector3(-1, -2, -1), scene);
    sunLight.intensity = 2.0;
    sunLight.position = new Vector3(20, 40, 20);
    sunLight.diffuse = new Color3(1, 1, 0.9);
    sunLight.specular = new Color3(1, 1, 1);
  }, []);

  const initializeBaseComponents = useCallback((scene: Scene) => {
    textureManagerRef.current = new TextureManager(scene);
    audioSystemRef.current = new AudioSystem(scene);
    particleManagerRef.current = new ParticleManager(scene);
    scoreSystemRef.current = new ScoreSystem();
    gameStateManagerRef.current = new GameStateManager(scene);
  }, []);

  const initializeTextureDependentComponents = useCallback((scene: Scene, textureManager: TextureManager) => {
    playerShipRef.current = new PlayerShip(scene, textureManager);
    weaponSystemRef.current = new WeaponSystem(scene);
    weaponSystemRef.current.setPlayer(playerShipRef.current);
    enemySystemRef.current = new EnemySystem(scene, playerShipRef.current, textureManager);
    
    if (gameStateManagerRef.current) {
      gameStateManagerRef.current.setPlayingState();
    }
  }, []);

  const onSceneReady = useCallback((scene: Scene) => {
    sceneRef.current = scene;
    
    try {
      setLoading(true);
      setLoadingProgress(0);
      setError(null);

      setupScene(scene);
      setupCamera(scene);
      setupLighting(scene);

      const ground = MeshBuilder.CreateBox('ground', {
        width: 100,
        height: 1,
        depth: 100
      }, scene);
      ground.position.y = -5;
      const groundMaterial = new StandardMaterial('groundMat', scene);
      groundMaterial.diffuseColor = new Color3(0.2, 0.2, 0.4);
      ground.material = groundMaterial;

      setLoadingProgress(50);
      initializeBaseComponents(scene);

      const tempTextureManager = textureManagerRef.current || new TextureManager(scene);
      initializeTextureDependentComponents(scene, tempTextureManager);

      setLoadingProgress(100);
      setLoading(false);
      setSceneReady(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error initializing game scene:', err);
      setError(`Error initializing game scene: ${errorMessage}`);
      setLoading(false);
    }
  }, [setupScene, setupCamera, setupLighting, initializeBaseComponents, 
      initializeTextureDependentComponents, setLoading, setLoadingProgress, setError, setSceneReady]);

  // Game Loop
  useEffect(() => {
    if (!sceneRef.current || !useGameStore.getState().isSceneReady) return;

    let lastTime = performance.now();
    let fpsUpdateInterval = 0;
    let frameCount = 0;
    const {
      setSpeed,
      setBoostActive,
      addScore,
      setFps,
      setEnemyCount,
      setProjectileCount,
      setParticleCount,
    } = useGameStore.getState();

    const gameLoop = () => {
      const currentTime = performance.now();
      const deltaTime = Math.min((currentTime - lastTime) / 1000, 1 / 30);
      lastTime = currentTime;

      fpsUpdateInterval += deltaTime;
      frameCount++;

      if (fpsUpdateInterval >= 0.5) {
        setFps(Math.round(frameCount / fpsUpdateInterval));
        fpsUpdateInterval = 0;
        frameCount = 0;
      }

      if (!isGamePaused) {
        const controls = getControls();
        const mouseDelta = getMouseDelta();

        gameStateManagerRef.current?.update(deltaTime);
        playerShipRef.current?.update(deltaTime, controls, mouseDelta);
        enemySystemRef.current?.update(deltaTime);
        weaponSystemRef.current?.update(deltaTime);

        if (controls.fire) {
          weaponSystemRef.current?.fire();
        }

        const enemies = enemySystemRef.current?.getEnemies() || [];
        const hits = weaponSystemRef.current?.checkCollisions(enemies) || 0;
        if (hits > 0) {
          addScore(hits * 100);
        }

        particleManagerRef.current?.update(deltaTime);
        scoreSystemRef.current?.update(deltaTime);

        if (playerShipRef.current) {
          setSpeed(Math.round(playerShipRef.current.speed));
          setBoostActive(controls.boost);
        }

        setEnemyCount(enemies.length);
        setProjectileCount(weaponSystemRef.current?.getProjectileCount() || 0);
        setParticleCount(particleManagerRef.current?.getParticleSystemCount() || 0);
      }

      animationFrameIdRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameIdRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [isGamePaused, getControls, getMouseDelta]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  const handleRestart = useCallback(() => {
    resetGame();
  }, [resetGame]);

  const handleResume = useCallback(() => {
    setGamePaused(false);
  }, [setGamePaused]);

  return (
    <div className="scene-container" style={{ width: '100%', height: '100%' }}>
      <Engine antialias adaptToDeviceRatio>
        <BabylonScene onSceneMount={({ scene }: { scene: Scene }) => onSceneReady(scene)}>
        </BabylonScene>
      </Engine>

      <GameHUD />

      {isLoading && <LoadingOverlay progress={loadingProgress} />}
      {error && <ErrorOverlay message={error} onRetry={handleRestart} />}
      {isGamePaused && <PauseOverlay onResume={handleResume} />}
    </div>
  );
});
