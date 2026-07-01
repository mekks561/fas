# Fighter Game API Documentation

## Overview

This documentation provides detailed information about the Fighter Game project's API, including engine systems, components, and utilities.

---

## Table of Contents

1. [Engine Systems](#engine-systems)
   - [InputSystem](#inputsystem)
   - [EventSystem](#eventsystem)
   - [CameraSystem](#camerasystem)
   - [AnimationSystem](#animationsystem)
   - [ResourceManager](#resourcemanager)
   - [InstancedRenderer](#instancedrenderer)
   - [CloudSaveSystem](#cloudsavesystem)
   - [DebugSystem](#debugsystem)
   - [LevelEditor](#leveleditor)
   - [MultiplayerSystem](#multiplayersystem)
   - [AudioManager](#audiomanager)

2. [Game Systems](#game-systems)
   - [PlayerShip](#playership)
   - [EnemySystem](#enemysystem)
   - [WeaponSystem](#weaponsystem)
   - [SkillSystem](#skillsystem)
   - [PowerupSpawner](#powerupspawner)
   - [AchievementSystem](#achievementsystem)
   - [ScoreSystem](#scoresystem)

3. [UI Components](#ui-components)
   - [TouchControlOverlay](#touchcontroloverlay)
   - [GameHUD](#gamehud)
   - [MainMenu](#mainmenu)
   - [PauseMenu](#pausemenu)
   - [GameOver](#gameover)

4. [Utilities](#utilities)
   - [ObjectPool](#objectpool)

5. [State Management](#state-management)
   - [useGameStore](#usegamestore)

---

## Engine Systems

### InputSystem

```typescript
import { InputSystem } from './engine/InputSystem';

const inputSystem = new InputSystem(canvas);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `registerBinding(action, binding)` | Register input binding | `action: string`, `binding: InputBinding` | `void` |
| `getAction(action)` | Get action state | `action: string` | `InputAction \| undefined` |
| `isPressed(action)` | Check if action was just pressed | `action: string` | `boolean` |
| `isHeld(action)` | Check if action is held | `action: string` | `boolean` |
| `on(action, callback)` | Subscribe to action events | `action: string`, `callback: Function` | `() => void` (unsubscribe) |
| `update()` | Update input state | - | `void` |
| `enable()` | Enable input processing | - | `void` |
| `disable()` | Disable input processing | - | `void` |
| `reset()` | Reset all input states | - | `void` |
| `destroy()` | Clean up resources | - | `void` |

#### InputBinding Interface

```typescript
interface InputBinding {
  keys: string[];        // Keyboard key codes
  gamepad?: string;      // Gamepad input
  touch?: string;        // Touch control identifier
}
```

#### InputAction Interface

```typescript
interface InputAction {
  state: 'pressed' | 'held' | 'released';
  value: number;         // 0-1 for analog inputs
}
```

---

### EventSystem

```typescript
import { EventSystem } from './engine/EventSystem';

const eventSystem = new EventSystem();
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `on(type, callback)` | Subscribe to events | `type: GameEventType`, `callback: EventCallback` | `() => void` |
| `once(type, callback)` | Subscribe once | `type: GameEventType`, `callback: EventCallback` | `() => void` |
| `emit(type, data)` | Emit event | `type: GameEventType`, `data?: Record<string, any>` | `void` |
| `getHistory()` | Get event history | - | `EventData[]` |
| `clearHistory()` | Clear event history | - | `void` |
| `enable()` | Enable event system | - | `void` |
| `disable()` | Disable event system | - | `void` |
| `getListenerCount(type)` | Count listeners | `type: GameEventType` | `number` |
| `destroy()` | Clean up | - | `void` |

#### Game Events

| Event Type | Description | Data |
|------------|-------------|------|
| `player_damage` | Player took damage | `{ damage, remainingHealth, maxHealth }` |
| `player_heal` | Player healed | `{ amount, remainingHealth, maxHealth }` |
| `player_death` | Player died | `{ killCount, score, wave }` |
| `player_shoot` | Player fired weapon | `{ weaponType, weaponLevel, position }` |
| `enemy_spawn` | Enemy spawned | `{ type, count, wave }` |
| `enemy_death` | Enemy killed | `{ type, score, position }` |
| `powerup_collect` | Powerup collected | `{ type, position }` |
| `skill_activate` | Skill activated | `{ skillId, level }` |
| `wave_start` | Wave started | `{ wave, enemyCount }` |
| `wave_complete` | Wave completed | `{ wave, enemyCount }` |
| `game_pause` | Game paused | - |
| `game_resume` | Game resumed | - |
| `game_over` | Game ended | - |
| `game_win` | Game won | - |
| `score_update` | Score changed | `{ score, delta }` |

---

### CameraSystem

```typescript
import { CameraSystem } from './engine/CameraSystem';

const cameraSystem = new CameraSystem(cameraEntity);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `setTarget(entity)` | Set target to follow | `entity: pc.Entity` | `void` |
| `setMode(mode)` | Set camera mode | `mode: 'thirdPerson' \| 'firstPerson' \| 'cinematic'` | `void` |
| `setDistance(distance)` | Set follow distance | `distance: number` | `void` |
| `setHeight(height)` | Set follow height | `height: number` | `void` |
| `shake(intensity, duration)` | Apply camera shake | `intensity: number`, `duration: number` | `void` |
| `zoom(factor)` | Zoom camera | `factor: number` | `void` |
| `update(dt)` | Update camera position | `dt: number` | `void` |
| `enable()` | Enable camera system | - | `void` |
| `disable()` | Disable camera system | - | `void` |
| `destroy()` | Clean up | - | `void` |

---

### AnimationSystem

```typescript
import { AnimationSystem } from './engine/AnimationSystem';

const animationSystem = new AnimationSystem();
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `registerEntity(entity, initialState)` | Register entity with animations | `entity: pc.Entity`, `initialState: string` | `void` |
| `playAnimation(entity, animationName, blendTime)` | Play animation | `entity: pc.Entity`, `animationName: string`, `blendTime?: number` | `void` |
| `setState(entity, state)` | Set animation state | `entity: pc.Entity`, `state: string` | `void` |
| `getState(entity)` | Get current state | `entity: pc.Entity` | `string` |
| `setSpeed(entity, speed)` | Set animation speed | `entity: pc.Entity`, `speed: number` | `void` |
| `isPlaying(entity)` | Check if animation is playing | `entity: pc.Entity` | `boolean` |
| `update(dt)` | Update animations | `dt: number` | `void` |
| `enable()` | Enable animation system | - | `void` |
| `disable()` | Disable animation system | - | `void` |
| `destroy()` | Clean up | - | `void` |

---

### ResourceManager

```typescript
import { ResourceManager } from './engine/ResourceManager';

const resourceManager = new ResourceManager(app);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `load(resourceId)` | Load resource | `resourceId: string` | `Promise<any>` |
| `loadAll(ids)` | Load multiple resources | `ids: string[]` | `Promise<any[]>` |
| `get(resourceId)` | Get loaded resource | `resourceId: string` | `any` |
| `unload(resourceId)` | Unload resource | `resourceId: string` | `void` |
| `clear()` | Clear all resources | - | `void` |
| `getProgress()` | Get loading progress | - | `number` |
| `onProgress(callback)` | Subscribe to progress updates | `callback: (progress: number) => void` | `() => void` |
| `enable()` | Enable resource manager | - | `void` |
| `disable()` | Disable resource manager | - | `void` |
| `destroy()` | Clean up | - | `void` |

---

### InstancedRenderer

```typescript
import { InstancedRenderer } from './engine/InstancedRenderer';

const instancedRenderer = new InstancedRenderer(app);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `createInstance(type)` | Create instance template | `type: string` | `InstanceTemplate` |
| `addInstance(type, position, rotation, scale)` | Add instance | `type: string`, `position: pc.Vec3`, `rotation?: pc.Quat`, `scale?: pc.Vec3` | `void` |
| `removeInstance(type, index)` | Remove instance | `type: string`, `index: number` | `void` |
| `updateInstance(type, index, position, rotation)` | Update instance | `type: string`, `index: number`, `position: pc.Vec3`, `rotation?: pc.Quat` | `void` |
| `clearInstances(type)` | Clear all instances | `type: string` | `void` |
| `update(dt, cameraPosition)` | Update renderer | `dt: number`, `cameraPosition: pc.Vec3` | `void` |
| `enable()` | Enable instanced rendering | - | `void` |
| `disable()` | Disable instanced rendering | - | `void` |
| `destroy()` | Clean up | - | `void` |

---

### CloudSaveSystem

```typescript
import { CloudSaveSystem } from './engine/CloudSaveSystem';

const cloudSave = new CloudSaveSystem();
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `save(data)` | Save game data | `data: SaveData` | `Promise<void>` |
| `load()` | Load game data | - | `Promise<SaveData>` |
| `sync()` | Sync with cloud | - | `Promise<void>` |
| `getSaveSlots()` | Get available save slots | - | `SaveSlot[]` |
| `deleteSave(slotId)` | Delete save slot | `slotId: string` | `Promise<void>` |
| `uploadScore(score)` | Upload score to leaderboard | `score: number` | `Promise<void>` |
| `getLeaderboard(count)` | Get leaderboard | `count: number` | `Promise<LeaderboardEntry[]>` |
| `enable()` | Enable cloud save | - | `void` |
| `disable()` | Disable cloud save | - | `void` |
| `destroy()` | Clean up | - | `void` |

#### SaveData Interface

```typescript
interface SaveData {
  playerName: string;
  score: number;
  level: number;
  wave: number;
  upgrades: PlayerUpgrades;
  achievements: string[];
  timestamp: number;
}
```

---

### DebugSystem

```typescript
import { DebugSystem } from './engine/DebugSystem';

const debugSystem = new DebugSystem(app);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `toggleOverlay()` | Toggle debug overlay | - | `void` |
| `log(message, type)` | Log message | `message: string`, `type?: 'info' \| 'warning' \| 'error' \| 'system'` | `void` |
| `drawLine(start, end, color)` | Draw debug line | `start: pc.Vec3`, `end: pc.Vec3`, `color: pc.Color` | `void` |
| `drawSphere(position, radius, color)` | Draw debug sphere | `position: pc.Vec3`, `radius: number`, `color: pc.Color` | `void` |
| `drawBox(position, halfExtents, color)` | Draw debug box | `position: pc.Vec3`, `halfExtents: pc.Vec3`, `color: pc.Color` | `void` |
| `showStats()` | Show performance stats | - | `void` |
| `hideStats()` | Hide performance stats | - | `void` |
| `enable()` | Enable debug system | - | `void` |
| `disable()` | Disable debug system | - | `void` |
| `destroy()` | Clean up | - | `void` |

---

### LevelEditor

```typescript
import { LevelEditor } from './engine/LevelEditor';

const levelEditor = new LevelEditor(app);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `enable()` | Enable level editor | - | `void` |
| `disable()` | Disable level editor | - | `void` |
| `placeObject(type, position)` | Place object | `type: string`, `position: pc.Vec3` | `pc.Entity` |
| `selectObject(entity)` | Select object | `entity: pc.Entity` | `void` |
| `deleteSelected()` | Delete selected object | - | `void` |
| `moveSelected(position)` | Move selected object | `position: pc.Vec3` | `void` |
| `rotateSelected(rotation)` | Rotate selected object | `rotation: pc.Quat` | `void` |
| `scaleSelected(scale)` | Scale selected object | `scale: pc.Vec3` | `void` |
| `exportLevel()` | Export level data | - | `LevelData` |
| `importLevel(data)` | Import level data | `data: LevelData` | `void` |
| `clearLevel()` | Clear all objects | - | `void` |
| `destroy()` | Clean up | - | `void` |

---

### MultiplayerSystem

```typescript
import { MultiplayerSystem } from './engine/MultiplayerSystem';

const multiplayer = new MultiplayerSystem();
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `createRoom(name, maxPlayers)` | Create room | `name: string`, `maxPlayers: number` | `Promise<string>` |
| `joinRoom(roomId)` | Join room | `roomId: string` | `Promise<void>` |
| `leaveRoom()` | Leave room | - | `void` |
| `getRooms()` | Get available rooms | - | `Promise<Room[]>` |
| `sendMessage(data)` | Send message to room | `data: any` | `void` |
| `sendReliableMessage(data)` | Send reliable message | `data: any` | `void` |
| `getPlayerCount()` | Get player count | - | `number` |
| `getPlayerList()` | Get player list | - | `Player[]` |
| `isConnected()` | Check connection status | - | `boolean` |
| `enable()` | Enable multiplayer | - | `void` |
| `disable()` | Disable multiplayer | - | `void` |
| `destroy()` | Clean up | - | `void` |

---

### AudioManager

```typescript
import { AudioManager } from './engine/AudioSystem';

AudioManager.initialize(app);
```

#### Static Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `initialize(app)` | Initialize audio system | `app: pc.Application` | `void` |
| `playMusic(track)` | Play background music | `track: string` | `void` |
| `stopMusic()` | Stop background music | - | `void` |
| `pauseMusic()` | Pause music | - | `void` |
| `resumeMusic()` | Resume music | - | `void` |
| `setMusicVolume(volume)` | Set music volume | `volume: number` | `void` |
| `playSound(soundId, position)` | Play sound effect | `soundId: string`, `position?: pc.Vec3` | `void` |
| `stopSound(soundId)` | Stop sound | `soundId: string` | `void` |
| `setSoundVolume(volume)` | Set sound volume | `volume: number` | `void` |
| `setMuted(muted)` | Mute all audio | `muted: boolean` | `void` |
| `isMuted()` | Check if muted | - | `boolean` |

---

## Game Systems

### PlayerShip

```typescript
import { PlayerShip } from './engine/PlayerShip';

const player = new PlayerShip({
  engine,
  initialPosition: new pc.Vec3(0, 0, 0),
  health: 100,
  shield: 50
});
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `update(dt, controls)` | Update player | `dt: number`, `controls: PlayerControls` | `void` |
| `getPosition()` | Get position | - | `pc.Vec3` |
| `getEntity()` | Get PlayCanvas entity | - | `pc.Entity` |
| `getHealth()` | Get current health | - | `number` |
| `getShield()` | Get current shield | - | `number` |
| `takeDamage(damage)` | Apply damage | `damage: number` | `void` |
| `heal(amount)` | Heal player | `amount: number` | `void` |
| `addShield(amount)` | Add shield | `amount: number` | `void` |
| `setSpeed(speed)` | Set movement speed | `speed: number` | `void` |
| `getSpeed()` | Get current speed | - | `number` |
| `destroy()` | Destroy player | - | `void` |

#### PlayerControls Interface

```typescript
interface PlayerControls {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  boost: boolean;
  fire: boolean;
}
```

---

### EnemySystem

```typescript
import { EnemySystem } from './engine/EnemySystem';

const enemySystem = new EnemySystem(engine, player);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `update(dt)` | Update enemies | `dt: number` | `void` |
| `spawnEnemy(type, position)` | Spawn enemy | `type: string`, `position: pc.Vec3` | `void` |
| `getEnemies()` | Get all enemies | - | `Enemy[]` |
| `getCurrentWave()` | Get current wave | - | `number` |
| `startWave(wave)` | Start wave | `wave: number` | `void` |
| `isWaveComplete()` | Check if wave is complete | - | `boolean` |
| `enable()` | Enable enemy system | - | `void` |
| `disable()` | Disable enemy system | - | `void` |
| `destroy()` | Clean up | - | `void` |

---

### WeaponSystem

```typescript
import { WeaponSystem } from './engine/WeaponSystem';

const weaponSystem = new WeaponSystem(engine);
weaponSystem.setPlayer(player);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `setPlayer(player)` | Set player reference | `player: PlayerShip` | `void` |
| `shoot()` | Fire current weapon | - | `void` |
| `upgradeWeapon()` | Upgrade current weapon | - | `void` |
| `setWeapon(weaponType)` | Switch weapon | `weaponType: string` | `void` |
| `getCurrentWeapon()` | Get current weapon | - | `string` |
| `getWeaponLevel()` | Get weapon level | - | `number` |
| `checkCollisions(enemies)` | Check projectile collisions | `enemies: Enemy[]` | `number` |
| `getProjectileCount()` | Get active projectiles | - | `number` |
| `update(dt)` | Update weapons | `dt: number` | `void` |
| `destroy()` | Clean up | - | `void` |

---

### SkillSystem

```typescript
import { SkillSystem } from './engine/SkillSystem';

const skillSystem = new SkillSystem(engine, player);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `activateSkill(skillId)` | Activate skill | `skillId: string` | `void` |
| `getSkillCooldown(skillId)` | Get cooldown | `skillId: string` | `number` |
| `isSkillReady(skillId)` | Check if skill is ready | `skillId: string` | `boolean` |
| `upgradeSkill(skillId)` | Upgrade skill | `skillId: string` | `void` |
| `getSkillLevel(skillId)` | Get skill level | `skillId: string` | `number` |
| `update(dt)` | Update skills | `dt: number` | `void` |
| `destroy()` | Clean up | - | `void` |

#### Available Skills

| Skill ID | Name | Cooldown | Effect |
|----------|------|----------|--------|
| `missile_strike` | Missile Strike | 8s | Launch homing missiles |
| `shield_burst` | Shield Burst | 10s | Activate temporary shield |
| `time_slow` | Time Slow | 15s | Slow down time |
| `overdrive` | Overdrive | 20s | Increase damage and speed |

---

### PowerupSpawner

```typescript
import { PowerupSpawner } from './engine/PowerupSystem';

const powerupSystem = new PowerupSpawner(engine);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `spawnPowerup(type, position)` | Spawn powerup | `type: string`, `position: pc.Vec3` | `void` |
| `update(dt)` | Update powerups | `dt: number` | `void` |
| `enable()` | Enable spawning | - | `void` |
| `disable()` | Disable spawning | - | `void` |
| `destroy()` | Clean up | - | `void` |

#### Powerup Types

| Type | Effect |
|------|--------|
| `health` | Restore health |
| `shield` | Add shield |
| `damage` | Increase damage |
| `speed` | Increase speed |
| `score` | Multiplier |

---

### AchievementSystem

```typescript
import { AchievementSystem } from './engine/AchievementSystem';

const achievementSystem = new AchievementSystem();
achievementSystem.load();
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `load()` | Load achievements from storage | - | `void` |
| `save()` | Save achievements to storage | - | `void` |
| `update(data)` | Update achievement progress | `data: AchievementData` | `void` |
| `addKill()` | Increment kill count | - | `void` |
| `addPowerup()` | Increment powerup count | - | `void` |
| `addSkill()` | Increment skill use | - | `void` |
| `isUnlocked(achievementId)` | Check if unlocked | `achievementId: string` | `boolean` |
| `getUnlockedAchievements()` | Get all unlocked | - | `Achievement[]` |
| `getProgress(achievementId)` | Get progress | `achievementId: string` | `number` |

---

### ScoreSystem

```typescript
import { ScoreSystem } from './ScoreSystem';

const scoreSystem = new ScoreSystem();
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `addScore(score)` | Add score | `score: number` | `void` |
| `addKillScore(multiplier)` | Add kill score | `multiplier?: number` | `void` |
| `setMultiplier(multiplier, duration)` | Set score multiplier | `multiplier: number`, `duration: number` | `void` |
| `getScoreMultiplier()` | Get current multiplier | - | `number` |
| `getCurrentScore()` | Get current score | - | `number` |
| `resetScore()` | Reset score | - | `void` |
| `addHighScore(playerName)` | Add to high scores | `playerName: string` | `boolean` |
| `getHighScores()` | Get all high scores | - | `HighScore[]` |
| `isHighScore(score)` | Check if score qualifies | `score: number` | `boolean` |
| `clearHighScores()` | Clear all high scores | - | `void` |
| `exportHighScores()` | Export to JSON | - | `string` |
| `importHighScores(data)` | Import from JSON | `data: string` | `boolean` |
| `formatScore(score)` | Format score display | `score: number` | `string` |
| `update(dt)` | Update multipliers | `dt: number` | `void` |

---

## UI Components

### TouchControlOverlay

```tsx
import { TouchControlOverlay } from './components/TouchControlOverlay';

<TouchControlOverlay
  onMove={(x, y) => handleMove(x, y)}
  onFire={(active) => handleFire(active)}
  onBoost={(active) => handleBoost(active)}
  onSkill1={() => activateSkill('missile_strike')}
  onSkill2={() => activateSkill('shield_burst')}
  onSkill3={() => activateSkill('time_slow')}
  onSkill4={() => activateSkill('overdrive')}
  skillCooldowns={skillCooldowns}
  skillMaxCooldowns={skillMaxCooldowns}
  isVisible={isMobile}
/>
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `onMove` | `(x: number, y: number) => void` | Joystick move callback |
| `onFire` | `(active: boolean) => void` | Fire button callback |
| `onBoost` | `(active: boolean) => void` | Boost button callback |
| `onSkill1-4` | `() => void` | Skill button callbacks |
| `skillCooldowns` | `{ skill1-4: number }` | Current cooldowns |
| `skillMaxCooldowns` | `{ skill1-4: number }` | Max cooldowns |
| `isVisible` | `boolean` | Show/hide controls |

---

### GameHUD

```tsx
import { GameHUD } from './components/GameHUD';

<GameHUD
  health={playerHealth}
  maxHealth={maxHealth}
  shield={playerShield}
  maxShield={maxShield}
  score={score}
  level={level}
  wave={wave}
  totalWaves={totalWaves}
  enemiesRemaining={enemyCount}
  fps={fps}
/>
```

---

### MainMenu

```tsx
import { MainMenu } from './components/MainMenu';

<MainMenu
  onStartGame={() => startGame()}
  onLevelSelect={() => showLevelSelect()}
  onSettings={() => showSettings()}
  onAchievements={() => showAchievements()}
/>
```

---

### PauseMenu

```tsx
import { PauseMenu } from './components/PauseMenu';

<PauseMenu
  onResume={() => resumeGame()}
  onRestart={() => restartGame()}
  onSettings={() => showSettings()}
  onMainMenu={() => goToMainMenu()}
/>
```

---

### GameOver

```tsx
import { GameOver } from './components/GameOver';

<GameOver
  score={finalScore}
  wave={finalWave}
  kills={killCount}
  onRestart={() => restartGame()}
  onMainMenu={() => goToMainMenu()}
/>
```

---

## Utilities

### ObjectPool

```typescript
import { ObjectPool } from './utils/ObjectPool';

const pool = new ObjectPool<Projectile>(
  () => createProjectile(),
  (proj) => resetProjectile(proj),
  200,
  10000
);

const projectile = pool.acquire();
// Use projectile...
pool.release(projectile);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `acquire()` | Get object from pool | - | `T` |
| `release(instance)` | Return object to pool | `instance: T` | `void` |
| `prefill(count)` | Pre-fill pool | `count: number` | `void` |
| `getActiveCount()` | Count active objects | - | `number` |
| `getPoolSize()` | Get pool size | - | `number` |
| `dispose()` | Destroy pool | - | `void` |

---

## State Management

### useGameStore

```typescript
import { useGameStore } from './store/useGameStore';

// Subscribe to state
const playerHealth = useGameStore((state) => state.player.health);
const isGamePaused = useGameStore((state) => state.isGamePaused);

// Dispatch actions
const setGamePaused = useGameStore((state) => state.setGamePaused);
const addScore = useGameStore((state) => state.addScore);
```

#### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `isLoading` | `boolean` | Loading state |
| `loadingProgress` | `number` | Loading progress 0-100 |
| `error` | `string \| null` | Error message |
| `isGamePaused` | `boolean` | Pause state |
| `isSceneReady` | `boolean` | Scene ready state |
| `player` | `PlayerState` | Player data |
| `skills` | `SkillsState` | Skill cooldowns |
| `touchHandlers` | `TouchHandlers \| null` | Touch handlers |
| `currentWave` | `number` | Current wave |
| `waveProgress` | `number` | Wave progress |
| `enemyCount` | `number` | Active enemies |
| `projectileCount` | `number` | Active projectiles |
| `fps` | `number` | Frames per second |

#### Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `setLoading` | `loading: boolean` | Set loading state |
| `setLoadingProgress` | `progress: number` | Set progress |
| `setError` | `error: string \| null` | Set error |
| `setGamePaused` | `paused: boolean` | Set pause state |
| `setSceneReady` | `ready: boolean` | Set scene ready |
| `updatePlayerHealth` | `health: number` | Update health |
| `updatePlayerShield` | `shield: number` | Update shield |
| `addScore` | `score: number` | Add score |
| `setPlayerLevel` | `level: number` | Set level |
| `setSpeed` | `speed: number` | Set speed |
| `setBoostActive` | `active: boolean` | Set boost |
| `setWave` | `wave: number` | Set wave |
| `setWaveProgress` | `progress: number` | Set wave progress |
| `setEnemyCount` | `count: number` | Set enemy count |
| `setProjectileCount` | `count: number` | Set projectile count |
| `setFps` | `fps: number` | Set FPS |
| `setSkillCooldown` | `skillId: string, cooldown: number` | Set skill cooldown |
| `updateSkillCooldowns` | `dt: number` | Update all cooldowns |
| `setTouchHandlers` | `handlers: TouchHandlers` | Set touch handlers |
| `resetGame` | - | Reset all state |

---

## Game.ts Central Coordinator

```typescript
import { Game } from './engine/Game';

const game = Game.getInstance({
  canvas: document.getElementById('game-canvas'),
  antialias: true,
  enablePostEffects: true,
  debugMode: true,
  multiplayerEnabled: false
});

await game.initialize();

const player = game.createPlayer(100, 50);
const enemySystem = game.createEnemySystem(player);
const weaponSystem = game.createWeaponSystem(player);
const skillSystem = game.createSkillSystem(player);
game.createPowerupSpawner();

game.start();

game.setUpdateCallback((dt) => {
  // Custom game logic
});

const stats = game.getStats();
console.log(`FPS: ${stats.fps}`);
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `getInstance(config)` | Get singleton instance | `config?: GameConfig` | `Game` |
| `initialize()` | Initialize all systems | - | `Promise<void>` |
| `start()` | Start game loop | - | `void` |
| `shutdown()` | Shut down game | - | `void` |
| `setGameState(state)` | Set game state | `state: GameState` | `void` |
| `getSystem(name)` | Get system instance | `name: string` | `any` |
| `enableSystem(name)` | Enable system | `name: string` | `void` |
| `disableSystem(name)` | Disable system | `name: string` | `void` |
| `setUpdateCallback(callback)` | Set custom update callback | `callback: (dt: number) => void` | `void` |
| `getStats()` | Get performance stats | - | `GameStats` |
| `createPlayer(health, shield)` | Create player | `health: number`, `shield: number` | `PlayerShip` |
| `createEnemySystem(player)` | Create enemy system | `player: PlayerShip` | `EnemySystem` |
| `createWeaponSystem(player)` | Create weapon system | `player: PlayerShip` | `WeaponSystem` |
| `createSkillSystem(player)` | Create skill system | `player: PlayerShip` | `SkillSystem` |
| `createPowerupSpawner()` | Create powerup spawner | - | `PowerupSpawner` |

#### GameState

```typescript
type GameState = 
  | 'menu' 
  | 'loading' 
  | 'playing' 
  | 'paused' 
  | 'game_over' 
  | 'level_complete' 
  | 'settings';
```

---

## Error Handling

### Common Error Codes

| Code | Message | Cause | Solution |
|------|---------|-------|----------|
| 1001 | "Maximum update depth exceeded" | Zustand subscription issue | Use atomic subscriptions |
| 2001 | "Failed to load resource" | Network error | Check internet connection |
| 3001 | "localStorage is not available" | Storage disabled | Enable cookies/storage |
| 4001 | "WebSocket connection failed" | Multiplayer error | Check network |

---

## Performance Tips

1. **Use React.memo** for components with expensive renders
2. **Use useMemo/useCallback** to avoid unnecessary re-computations
3. **Object pooling** for frequently created objects (projectiles, particles)
4. **Instanced rendering** for large groups of similar objects
5. **Zustand selective subscription** to avoid unnecessary re-renders

---

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | >= 90 | ✅ |
| Firefox | >= 88 | ✅ |
| Safari | >= 14 | ✅ |
| Edge | >= 90 | ✅ |

---

## License

MIT License - See LICENSE file for details.
