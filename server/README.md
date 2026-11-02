# Fighter Game - 后端服务完整文档

## 目录

1. [项目概述](#项目概述)
2. [技术栈](#技术栈)
3. [快速开始](#快速开始)
4. [项目结构](#项目结构)
5. [API文档](#api文档)
6. [数据库设计](#数据库设计)
7. [测试](#测试)
8. [部署](#部署)
9. [性能优化](#性能优化)
10. [安全最佳实践](#安全最佳实践)

## 项目概述

这是一个生产级别的后端服务，为3D战斗机游戏提供完整的API支持。

### 主要功能

- ✅ 用户认证系统（注册、登录、JWT）
- ✅ 排行榜系统（分数提交、排名查询）
- ✅ 成就系统（15+成就、自动解锁）
- ✅ 用户设置管理
- ✅ 资源管理和验证
- ✅ Redis缓存层
- ✅ 完整的日志系统
- ✅ 请求限流
- ✅ 单元测试和集成测试

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Node.js** | ^18.0.0 | 运行时环境 |
| **Express** | ^4.18.2 | Web框架 |
| **MySQL** | ^8.0 | 主数据库 |
| **Prisma** | ^7.8.0 | ORM / 数据库建模 |
| **Redis** | ^5.4.1 | 缓存层 |
| **JWT** | ^8.5.1 | 身份认证 |
| **bcryptjs** | ^2.4.3 | 密码加密 |
| **Joi** | ^17.11.0 | 数据验证 |
| **Socket.io** | ^4.6.1 | 实时通信 |
| **Vitest** | ^4.1.9 | 测试框架 |

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- MySQL >= 8.0
- Redis >= 7.0 (可选)

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd fighter-game/server

# 安装依赖
npm install

# 复制环境变量文件并配置 DATABASE_URL
cp .env.example .env

# 初始化数据库
npx prisma db push
```

### 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start

# 运行测试
npm test

# 生成测试覆盖率报告
npm run test:coverage
```

## 项目结构

```
server/
├── src/
│   ├── __tests__/              # 测试文件
│   │   ├── achievement.test.ts
│   │   ├── logger.test.ts
│   │   └── validation.test.ts
│   ├── middleware/             # 中间件
│   │   ├── auth.ts           # 认证中间件
│   │   ├── logger.ts          # 日志中间件
│   │   └── validation.ts      # 验证中间件
│   ├── models/                # 数据模型
│   │   ├── Leaderboard.ts     # 排行榜模型
│   │   └── User.ts           # 用户模型
│   ├── routes/                # 路由
│   │   ├── achievements.ts    # 成就路由
│   │   ├── auth.ts           # 认证路由
│   │   ├── leaderboard.ts     # 排行榜路由
│   │   ├── resources.ts       # 资源路由
│   │   ├── settings.ts       # 设置路由
│   │   └── users.ts         # 用户路由
│   ├── services/             # 业务服务
│   │   ├── achievement.ts     # 成就服务
│   │   └── cache.ts         # 缓存服务
│   ├── server.ts            # 服务器入口
│   └── app.ts               # 应用配置
├── tests/                   # 集成测试
├── .env.example            # 环境变量示例
├── jest.config.js          # Jest配置
├── package.json
└── tsconfig.json
```

## API文档

### 认证 API

#### 注册用户
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "player1",
  "email": "player1@example.com",
  "password": "password123"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "username": "player1",
      "email": "player1@example.com",
      "level": 1
    },
    "token": "eyJhbGc..."
  }
}
```

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "player1@example.com",
  "password": "password123"
}
```

#### 获取当前用户
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 排行榜 API

#### 获取排行榜
```http
GET /api/leaderboard?page=1&limit=20&difficulty=NORMAL
```

**响应:**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "rank": 1,
        "username": "Player1",
        "score": 15000,
        "level": 8,
        "wave": 25
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

#### 提交分数
```http
POST /api/leaderboard
Authorization: Bearer <token>
Content-Type: application/json

{
  "score": 10000,
  "level": 5,
  "wave": 15,
  "kills": 120,
  "gameDuration": 1800,
  "difficulty": "HARD"
}
```

### 成就 API

#### 获取用户成就
```http
GET /api/achievements
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "achievements": [
      {
        "id": "first_kill",
        "name": "首杀",
        "description": "击杀一个敌人",
        "unlocked": true,
        "unlockedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

## 数据库设计

本项目使用 Prisma 进行 ORM 建模，详细 Schema 请参考 `prisma/schema.prisma`。

### 主要模型

- **User**: 核心用户信息，包含等级、经验、信用点等。
- **Leaderboard**: 全球/区域排行榜数据。
- **Achievement**: 玩家成就解锁进度。
- **GameSession**: 详细的游戏场次记录（用于分析 v2.7 战略 AI 行为）。
- **UserInventory**: 玩家拥有的飞船、武器及组件。
- **Friendship**: 社交系统数据。
- **GameResource**: 游戏资源清单（用于 v2.7 程序化生成校验）。

## 测试

### 运行测试

```bash
# 所有测试
npm test

# 监视模式
npm run test:watch

# 带覆盖率
npm run test:coverage
```

### 测试覆盖范围

- ✅ 验证中间件 (100%)
- ✅ 日志系统 (80%+)
- ✅ 成就服务 (80%+)
- ✅ 用户认证 (计划中)

### 编写新测试

```typescript
// src/__tests__/myfeature.test.ts
describe('MyFeature', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

## 部署

### Docker 部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root_pass
      MYSQL_DATABASE: fighter_game
    volumes:
      - mysql_data:/var/lib/mysql

  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=mysql://root:root_pass@mysql:3306/fighter_game
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mysql

  redis:
    image: redis:7-alpine
```

### 环境变量配置

```bash
# 生产环境必须设置
NODE_ENV=production
JWT_SECRET=your-production-secret-key
MONGODB_URI=mongodb://production-db:27017/fighter-game
REDIS_URI=redis://production-redis:6379
```

## 性能优化

### 1. 缓存策略

- **排行榜缓存**: 5分钟TTL
- **用户信息缓存**: 10分钟TTL
- **资源列表缓存**: 10分钟TTL
- **排行榜统计**: 10分钟TTL

### 2. 数据库优化

```javascript
// 复合索引
leaderboardSchema.index({ score: -1 });
leaderboardSchema.index({ userId: 1, score: -1 });

// 投影查询
const entries = await Leaderboard.find(query)
  .select('username score level wave kills')
  .lean();
```

### 3. 请求限流

- **认证端点**: 10请求/15分钟
- **其他API**: 100请求/15分钟
- **排行榜提交**: 5请求/分钟

## 安全最佳实践

### 1. 密码安全

```typescript
// 使用 bcrypt 加密
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);
```

### 2. JWT安全

```typescript
// Token 包含用户ID和邮箱
const token = jwt.sign(
  { userId: user._id, email: user.email },
  JWT_SECRET,
  { expiresIn: '7d' }
);
```

### 3. 输入验证

```typescript
// 使用 Joi 验证所有输入
const schema = Joi.object({
  username: Joi.string().alphanum().min(3).max(20).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});
```

### 4. 安全头

```typescript
// 使用 Helmet 设置安全头
app.use(helmet());
```

### 5. CORS 配置

```typescript
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
```

## 错误代码

| 代码 | 描述 |
|------|------|
| `AUTH_REQUIRED` | 需要登录 |
| `INVALID_CREDENTIALS` | 凭证无效 |
| `USER_EXISTS` | 用户已存在 |
| `USER_NOT_FOUND` | 用户不存在 |
| `VALIDATION_ERROR` | 验证错误 |
| `RATE_LIMIT` | 请求过于频繁 |
| `TOKEN_EXPIRED` | 令牌已过期 |
| `INVALID_TOKEN` | 无效的令牌 |

## 监控和日志

### 日志级别

- **INFO**: 正常操作日志
- **WARN**: 警告日志
- **ERROR**: 错误日志
- **DEBUG**: 调试日志 (仅开发环境)

### 日志统计

```bash
# 获取最近日志
GET /api/logs/recent?count=100

# 获取日志统计
GET /api/logs/stats
```

## 许可证

MIT License
