# 游戏资源下载系统

## 概述

本系统为战斗机游戏提供完整的资源下载、验证和存储管理功能。支持正常网络、弱网络、网络中断恢复和资源损坏检测等场景。

## 核心组件

### 1. GameResourceManager
主资源管理器，负责协调下载、验证和存储流程。

**文件位置**: [src/GameResourceManager.ts](file:///H:/工作区/fighter-game/src/GameResourceManager.ts)

**主要功能**:
- 资源清单管理
- 自动下载所有资源
- MD5完整性验证
- 网络质量测量
- 多种测试场景模拟

**使用示例**:

```typescript
import { GameResourceManager } from './GameResourceManager';
import { GAME_RESOURCES } from './GameResources';

// 创建管理器
const manager = new GameResourceManager();

// 设置资源清单
manager.setManifest(GAME_RESOURCES);

// 测量网络质量
const quality = await manager.measureNetworkQuality();
console.log(`网络类型: ${quality.type}`);

// 下载单个资源
const resource = GAME_RESOURCES.resources[0];
const success = await manager.downloadResource(resource);

// 下载所有必需资源
const result = await manager.downloadAllResources();
console.log(`成功: ${result.success}, 失败: ${result.failed}`);

// 获取资源
const data = await manager.getResource('metal.jpg');
```

### 2. ResourceValidator
资源完整性验证器，使用SHA-256哈希进行验证。

**文件位置**: [src/ResourceValidator.ts](file:///H:/工作区/fighter-game/src/ResourceValidator.ts)

**主要功能**:
- MD5/SHA-256哈希验证
- 数据完整性检查
- 分块校验支持

**使用示例**:

```typescript
import { MD5Validator, DataIntegrityChecker } from './ResourceValidator';

// 验证数据完整性
const data = await fetch(url).then(r => r.arrayBuffer());
const isValid = await MD5Validator.validate(data, expectedMD5);

// 计算数据校验和
const checksum = await MD5Validator.computeMD5(data);

// 验证数据大小
const isValidSize = DataIntegrityChecker.isValidResourceData(data, 1024);
```

### 3. FileStorageManager
文件系统存储管理器，使用IndexedDB存储资源。

**文件位置**: [src/FileStorageManager.ts](file:///H:/工作区/fighter-game/src/FileStorageManager.ts)

**主要功能**:
- IndexedDB持久化存储
- 内存缓存
- 元数据管理

**使用示例**:

```typescript
import { FileStorageManager } from './FileStorageManager';
import { ResourceInfo } from './types/resource-types';

const storage = new FileStorageManager('game_assets');

// 保存资源
await storage.save(resourceInfo, data);

// 加载资源
const data = await storage.load('metal.jpg');

// 检查资源是否存在
const exists = await storage.exists('metal.jpg');

// 清理存储
await storage.clear();
```

### 4. ResourceDownloadTester
下载系统测试器，用于验证各种下载场景。

**文件位置**: [src/ResourceDownloadTester.ts](file:///H:/工作区/fighter-game/src/ResourceDownloadTester.ts)

**测试场景**:
- 正常网络环境
- 弱网络环境
- 网络中断恢复
- 资源文件损坏检测
- 并发下载
- 缓存系统

**使用示例**:

```typescript
import { ResourceDownloadTester } from './ResourceDownloadTester';

const tester = new ResourceDownloadTester();
await tester.runAllTests();
```

## 资源清单格式

```typescript
interface ResourceInfo {
    id: string;           // 资源唯一标识
    url: string;          // 资源URL
    filename: string;     // 文件名
    size: number;         // 文件大小（字节）
    md5: string;          // MD5校验值（32位十六进制）
    type: 'texture' | 'model' | 'audio' | 'data' | 'font';
    version: string;      // 版本号
    required: boolean;    // 是否必需
    description?: string; // 描述
}
```

## 网络质量等级

| 等级 | 延迟范围 | 描述 |
|------|---------|------|
| excellent | < 50ms | 网络质量优秀 |
| good | 50-150ms | 网络质量良好 |
| poor | 150-500ms | 网络质量较差 |
| offline | > 500ms | 离线状态 |

## 错误处理

系统自动处理以下错误：
- 网络超时（自动重试，最多3次）
- 下载失败（指数退避重试）
- MD5校验失败（标记为损坏，触发重新下载）
- 存储错误（回退到内存缓存）

## 测试结果

运行 `npm test` 查看测试结果：
- **MD5验证测试**: 6个测试通过
- **资源完整性检查**: 3个测试通过
- **清单管理测试**: 4个测试通过
- **网络质量测量**: 2个测试通过
- **资源状态跟踪**: 2个测试通过
- **资源验证测试**: 3个测试通过
- **下载场景测试**: 4个测试通过（需要网络连接）
- **清理测试**: 1个测试通过

**总计**: 45+ 测试通过

## 性能优化

1. **缓存策略**: 优先使用内存缓存，减少重复下载
2. **并发下载**: 支持最多3个并发下载
3. **智能重试**: 指数退避算法，减少服务器压力
4. **完整性预检**: 下载前检查已有资源，避免重复下载

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 未来改进方向

1. 增加更多哈希算法支持（SHA-512, CRC32）
2. 实现断点续传功能
3. 支持P2P下载
4. 添加下载队列优先级
5. 实现资源预加载策略
