# Fighter Game - 3D Space Shooter

一个基于 PlayCanvas 和 React 19 的高性能 3D 太空射击游戏。

## 🎮 项目概述

这是一个达到高品质标准的3D空间射击游戏，采用最新的Web技术栈开发，具备以下特性：

- **高性能渲染**: 基于 PlayCanvas 的 WebGL/WebGPU 渲染
- **React 19 前端**: 使用最新的 React 框架
- **Zustand 状态管理**: 高效的响应式状态管理
- **TypeScript**: 完整的类型安全
- **Vite 构建**: 快速的开发和构建体验

## 🚀 技术栈

### 核心框架
- **PlayCanvas**: ^1.62.0 - 3D 游戏引擎
- **React**: ^19.0.0 - UI 框架
- **TypeScript**: ^6.0.0 - 类型系统

### 状态管理
- **Zustand**: ^5.0.0 - 轻量级状态管理

### 构建工具
- **Vite**: ^8.1.0 - 模块打包

### 样式
- **Tailwind CSS**: ^4.3.0 - 原子化CSS框架
- **shadcn/ui**: React UI组件库

### 后端
- **Node.js**: ^21.0.0 - 服务端运行时
- **Express**: ^5.0.0 - Web框架
- **Prisma**: 数据库ORM

### 脚本语言
- **Lua**: 技能系统、敌人AI、配置管理

### 测试框架
- **Vitest**: ^4.1.0 - 单元测试
- **Playwright**: ^1.61.0 - E2E测试

## 📦 已安装包

```json
{
  "playcanvas": "^1.62.0",
  "react": "^19.2.6",
  "react-dom": "^19.2.6",
  "zustand": "^5.0.14",
  "tailwindcss": "^4.3.2",
  "dexie": "^4.4.4",
  "wasmoon": "^1.16.0"
}
```

## 🏗️ 项目结构

```
fighter-game/
├── src/
│   ├── components/      # React 组件
│   │   ├── ui/         # shadcn/ui 组件
│   │   └── ...         # 游戏UI组件
│   ├── engine/         # 游戏引擎核心
│   │   ├── PlayCanvasEngine.ts
│   │   ├── PlayerShip.ts
│   │   ├── EnemySystem.ts
│   │   └── ...
│   ├── store/          # Zustand 状态管理
│   ├── lua/            # Lua脚本系统
│   ├── levels/         # 关卡定义
│   ├── types/          # TypeScript 类型
│   ├── i18n/           # 国际化
│   └── ...
├── public/             # 公共资源
│   └── assets/         # 游戏资源（模型、纹理、配置）
├── server/             # 后端服务
├── scripts/            # 资源生成脚本
├── docs/               # 文档
└── ...
```

## 🎯 核心功能

### 1. 游戏引擎系统
- [x] PlayCanvas 引擎封装
- [x] 3D 场景管理
- [x] 相机系统
- [x] 光照系统
- [x] PBR材质系统
- [x] 粒子效果

### 2. 游戏玩法系统
- [x] 玩家控制（键盘/鼠标/触摸）
- [x] 敌人 AI
- [x] 碰撞检测
- [x] 波次系统
- [x] 武器系统
- [x] 技能系统
- [x] 道具系统
- [x] 成就系统

### 3. UI系统
- [x] 主菜单
- [x] 游戏 HUD
- [x] 设置界面
- [x] 暂停菜单
- [x] 游戏结束界面
- [x] 排行榜
- [x] 商店系统
- [x] 成就面板

### 4. 资源系统
- [x] 纹理管理
- [x] 模型加载
- [x] 音频管理
- [x] 资源清单
- [x] 程序化资源生成

### 5. 性能优化
- [x] 对象池
- [x] 资源缓存
- [x] 性能监控
- [x] LOD系统
- [x] 实例化渲染

### 6. 社交系统
- [x] 排行榜
- [x] 好友系统
- [x] 成就分享
- [ ] 多人游戏

## 🔧 开发指南

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
# 访问 http://localhost:5173
```

### 构建生产版本

```bash
npm run build
```

### 运行测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
```

### 生成模型资源

```bash
npm run generate:models
```

## 🎨 游戏特性

### 视觉效果
- 高质量3D模型
- PBR材质系统
- 动态光照和阴影
- 粒子特效系统
- 环境映射

### 游戏机制
- 连续波次挑战
- 多种敌人类型（10种）
- 多种武器类型（10种）
- 技能系统（4个主动技能）
- 道具系统（10种）
- 经验升级系统
- 飞船定制（6种）

### 叙事系统
- 5个剧情章节
- 20个任务（主线/支线/日常）
- 对话系统
- 成就系统（15个）

### 用户体验
- 流畅的 60 FPS
- 响应式控制
- 多种难度选择
- 成就系统
- 排行榜

## 📊 性能指标

- **目标帧率**: 60 FPS
- **首屏加载**: < 3 秒
- **包体积**: < 50 MB
- **内存占用**: < 512 MB

## 📈 开发进度

### 已完成 ✅
- 项目基础架构
- 游戏引擎核心系统
- 战斗系统（武器、技能、敌人）
- UI界面体系
- 资源系统
- 剧情内容系统
- 成就系统
- 商店系统

### 进行中 🔄
- 多人游戏系统
- 社交功能完善
- 性能优化

### 计划中 📋
- 生存/挑战模式
- 角色自定义系统
- 跨平台发布

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

**开始你的太空之旅！🚀**