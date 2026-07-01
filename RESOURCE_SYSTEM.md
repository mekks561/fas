# 战斗机游戏资源系统

## 概述

这是一个完整的游戏资源管理系统，用于管理游戏中所有需要的资源，包括纹理、3D模型、音频和数据。

## 核心组件

### 1. GameResources.ts - 资源清单

定义游戏中所有资源清单，包括：
- **纹理资源**：金属、碳纤维、玻璃等材质纹理
- **程序化纹理**：通过代码生成的动态纹理
- **模型资源**：玩家飞船、敌人、子弹等3D模型
- **音频资源**：爆炸、射击、背景音乐等音效
- **数据资源**：关卡配置、敌人配置等数据

#### 主要API

```typescript
import { GAME_RESOURCES, getRequiredResources, getResourceStats } from './GameResources';

// 获取所有资源清单
const resources = GAME_RESOURCES.resources;

// 获取必需资源
const required = getRequiredResources();

// 获取资源统计
const stats = getResourceStats();
// 返回: { total, required, optional, textures, models, audio, data, totalSize }
```

### 2. AssetPreloader.ts - 资源预加载器

负责加载和生成所有游戏资源。

#### 特性

- 异步加载所有资源
- 实时进度回调
- 错误处理和重试机制
- 纹理、模型、音频的统一管理

#### 使用方法

```typescript
import { AssetPreloader } from './AssetPreloader';

const preloader = new AssetPreloader(scene, engine);

// 监听进度
preloader.onProgress((progress) => {
    console.log(`Loaded ${progress.loadedAssets}/${progress.totalAssets}`);
    console.log(`Progress: ${progress.progress.toFixed(0)}%`);
    console.log(`Current: ${progress.currentAsset}`);
});

// 预加载所有资源
const success = await preloader.preloadAll();

// 获取加载进度
const progress = preloader.getLoadingProgress();

// 获取特定资源
const texture = preloader.getTexture('texture_metal');
const model = preloader.getModel('model_player_ship');

// 释放资源
await preloader.dispose();
```

#### 进度回调接口

```typescript
interface AssetLoadingProgress {
    totalAssets: number;      // 总资源数
    loadedAssets: number;     // 已加载数
    currentAsset: string;     // 当前加载的资源
    progress: number;         // 进度百分比 (0-100)
    errors: string[];         // 错误列表
}
```

### 3. TextureGenerator.ts - 程序化纹理生成器

使用Canvas API生成各种游戏纹理。

#### 生成纹理

```typescript
import { TextureGenerator } from './TextureGenerator';

const generator = new TextureGenerator(scene);

// 生成玩家飞船纹理（蓝银配色）
const playerTexture = generator.generatePlayerShipDiffuse();

// 生成敌飞船纹理（红黑配色）
const enemyTexture = generator.generateEnemyShipDiffuse();

// 生成Boss纹理（紫色金属）
const bossTexture = generator.generateBossDiffuse();

// 生成能量弹纹理
const blueBullet = generator.generateProjectileTexture(true);  // 玩家子弹
const redBullet = generator.generateProjectileTexture(false);   // 敌人子弹

// 生成爆炸纹理
const explosion = generator.generateExplosionTexture();

// 生成护盾纹理
const shield = generator.generateShieldTexture();

// 生成引擎发光纹理
const engineGlow = generator.generateEngineGlowTexture();

// 生成道具纹理
const healthPowerUp = generator.generatePowerUpTexture('health');
const shieldPowerUp = generator.generatePowerUpTexture('shield');
const speedPowerUp = generator.generatePowerUpTexture('speed');
const weaponPowerUp = generator.generatePowerUpTexture('weapon');

// 预生成所有纹理
generator.preloadAll();

// 获取缓存的纹理
const cached = generator.getTexture('player_ship_diffuse');

// 清除所有缓存
generator.clearCache();
```

### 4. ModelGenerator.ts - 程序化模型生成器

使用Babylon.js创建各种3D模型。

#### 生成模型

```typescript
import { ModelGenerator } from './ModelGenerator';

const generator = new ModelGenerator(scene);

// 玩家飞船
const playerShip = generator.generatePlayerShip();

// 敌人类型
const scout = generator.generateScout();       // 侦察机
const fighter = generator.generateFighter();   // 战斗机
const tank = generator.generateTank();         // 坦克
const assaulter = generator.generateAssaulter(); // 突击者
const elite = generator.generateElite();      // 精英

// Boss
const boss = generator.generateBoss();

// 武器
const playerBullet = generator.generateBullet(true);  // 玩家子弹
const enemyBullet = generator.generateBullet(false);   // 敌人子弹
const missile = generator.generateMissile();          // 导弹

// 环境
const asteroid = generator.generateAsteroid(2);  // 小行星（可指定大小）
const planet = generator.generatePlanet();       // 行星

// 道具
const healthPowerUp = generator.generatePowerUp('health');
const shieldPowerUp = generator.generatePowerUp('shield');
const speedPowerUp = generator.generatePowerUp('speed');
const weaponPowerUp = generator.generatePowerUp('weapon');

// 根据类型生成
const model = generator.generateByType('player_ship');
```

### 5. AudioGenerator.ts - 程序化音频生成器

使用Web Audio API生成游戏音效。

#### 播放音效

```typescript
import { AudioGenerator } from './AudioGenerator';

const generator = new AudioGenerator();

// 播放各种音效
generator.playExplosion();  // 爆炸
generator.playShoot();      // 射击
generator.playMissile();    // 导弹发射
generator.playHit();        // 命中
generator.playPowerUp();    // 道具获取

// 创建引擎循环音效
const { oscillator, gainNode } = generator.createEngineLoopSound();
if (oscillator && gainNode) {
    oscillator.start();
    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); // 调整音量
    // oscillator.stop(); // 需要时停止
}

// 创建背景音乐
const bgMusic = generator.createBackgroundMusic(60); // 60秒循环
if (bgMusic) {
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    bgMusic.connect(gainNode);
    gainNode.connect(audioContext.destination);
    bgMusic.start();
}

// 释放资源
generator.dispose();
```

### 6. ResourceDownloadUI.tsx - 资源下载UI组件

React组件，用于显示资源加载进度。

#### 使用方法

```typescript
import { ResourceDownloadUI } from './components/ResourceDownloadUI';

const [progress, setProgress] = useState<AssetLoadingProgress>({
    totalAssets: 0,
    loadedAssets: 0,
    currentAsset: '',
    progress: 0,
    errors: []
});

// 显示加载UI
<ResourceDownloadUI
    progress={progress}
    onComplete={() => {
        console.log('All resources loaded!');
        setGameReady(true);
    }}
    onRetry={() => {
        console.log('Retrying...');
        preloadResources();
    }}
    autoHideDelay={2000}  // 完成后2秒自动隐藏
/>
```

## 资源清单结构

每个资源定义包含以下字段：

```typescript
interface ResourceInfo {
    id: string;           // 资源唯一标识
    url: string;          // 资源URL（支持 'generated:' 前缀表示程序化生成）
    filename: string;     // 文件名
    size: number;         // 大小（字节）
    md5: string;          // MD5校验值
    type: 'texture' | 'model' | 'audio' | 'data' | 'font';  // 资源类型
    version: string;      // 版本号
    required: boolean;    // 是否必需
    description?: string; // 描述
}
```

## 工作流程

### 1. 初始化阶段

```typescript
// 1. 创建资源管理器
const resourceManager = new GameResourceManager();
resourceManager.setManifest(GAME_RESOURCES);

// 2. 创建预加载器
const preloader = new AssetPreloader(scene, engine);

// 3. 设置进度回调
preloader.onProgress((progress) => {
    updateLoadingUI(progress);
});

// 4. 开始预加载
await preloader.preloadAll();
```

### 2. 游戏运行阶段

```typescript
// 获取资源
const texture = preloader.getTexture('texture_metal');
const model = preloader.getModel('model_player_ship');

// 播放音效
audioGenerator.playExplosion();

// 创建新的模型实例
const newShip = model.clone('newShip');
newShip.position = new Vector3(0, 0, 0);
```

### 3. 清理阶段

```typescript
// 游戏结束时释放资源
await preloader.dispose();
audioGenerator.dispose();
```

## 性能优化

### 1. 纹理优化

- 使用纹理图集（Texture Atlas）减少纹理切换
- 适当的纹理分辨率（根据目标平台选择）
- 启用纹理压缩

### 2. 模型优化

- 使用LOD（Level of Detail）系统
- 合并网格减少Draw Calls
- 使用实例化渲染批量物体

### 3. 音频优化

- 使用音频池复用音效实例
- 适当的音频质量设置
- 启用音频压缩

## 扩展资源

### 添加新纹理

1. 在 GameResources.ts 的 resources 数组中添加条目
2. 在 TextureGenerator.ts 中添加对应的生成方法
3. 在 AssetPreloader.ts 的 generateParticleTextures 中调用

### 添加新模型

1. 在 GameResources.ts 的 resources 数组中添加条目
2. 在 ModelGenerator.ts 中添加对应的生成方法
3. 在 AssetPreloader.ts 的 generateModel 中添加case

### 添加新音效

1. 在 GameResources.ts 的 resources 数组中添加条目
2. 在 AudioGenerator.ts 中添加对应的生成方法
3. 在 AssetPreloader.ts 的 initAudioSystem 中调用

## 注意事项

1. **纹理路径**：本地纹理使用相对路径（如 `./textures/metal.jpg`）
2. **程序化生成**：使用 `generated:` 前缀的资源由代码生成
3. **必需资源**：required: true 的资源必须成功加载才能开始游戏
4. **可选资源**：required: false 的资源可以延迟加载或跳过
5. **错误处理**：加载失败会记录到 errors 数组，但不会阻止其他资源加载

## 调试

启用调试模式：

```typescript
// 查看加载进度
preloader.onProgress((progress) => {
    console.log('Loading:', progress.currentAsset);
    console.log('Progress:', progress.progress);
    if (progress.errors.length > 0) {
        console.warn('Errors:', progress.errors);
    }
});

// 检查纹理缓存
const textures = textureGenerator.getAllTextures();
console.log('Cached textures:', textures.size);

// 检查模型
const playerModel = preloader.getModel('model_player_ship');
console.log('Player model:', playerModel);
```

## 许可证

本资源系统是游戏项目的一部分。
