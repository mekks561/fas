# Fighter Game - 后端API设计文档

## 概述

本文档定义了战斗机游戏的后端API接口规范，用于前后端数据交互。

## 技术栈

- **Node.js**: ^18.0.0
- **Express**: ^4.18.0 - Web框架
- **MongoDB**: ^6.0 - 数据库
- **Mongoose**: ^8.0 - MongoDB ORM
- **Redis**: ^7.0 - 缓存
- **JWT**: ^9.0 - 身份认证
- **Socket.io**: ^4.6 - 实时通信

## 数据库架构

### 用户集合 (users)

```javascript
{
  _id: ObjectId,
  username: String,          // 用户名 (唯一)
  email: String,            // 邮箱 (唯一)
  password: String,         // 密码 (加密)
  avatar: String,           // 头像URL
  level: Number,            // 等级
  experience: Number,       // 经验值
  createdAt: Date,
  updatedAt: Date
}
```

### 玩家统计集合 (player_stats)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,         // 关联用户ID
  totalPlayTime: Number,    // 总游戏时长 (秒)
  totalScore: Number,       // 总分数
  totalKills: Number,       // 总击杀数
  gamesPlayed: Number,      // 游玩次数
  gamesWon: Number,         // 胜利次数
  maxCombo: Number,         // 最大连击
  maxWave: Number,          // 最大波次
  accuracy: Number,         // 命中率
  createdAt: Date,
  updatedAt: Date
}
```

### 排行榜集合 (leaderboard)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,         // 关联用户ID
  username: String,         // 用户名
  score: Number,            // 分数
  level: Number,            // 等级
  wave: Number,             // 波次
  kills: Number,            // 击杀数
  gameDuration: Number,     // 游戏时长
  difficulty: String,       // 难度
  date: Date,               // 日期
  createdAt: Date
}
```

### 成就集合 (achievements)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,         // 关联用户ID
  achievements: [{
    id: String,            // 成就ID
    name: String,           // 成就名称
    description: String,   // 成就描述
    unlockedAt: Date        // 解锁时间
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### 设置集合 (user_settings)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,         // 关联用户ID
  settings: {
    difficulty: String,      // 难度
    soundEnabled: Boolean,   // 音效开关
    musicEnabled: Boolean,   // 音乐开关
    graphicsQuality: String, // 画质
    fieldOfView: Number,    // 视野
    sensitivity: Number     // 灵敏度
  },
  createdAt: Date,
  updatedAt: Date
}
```

## API端点

### 认证

#### POST /api/auth/register
注册新用户

**请求体：**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "user": { "id": "string", "username": "string", "email": "string" },
    "token": "string"
  }
}
```

#### POST /api/auth/login
用户登录

**请求体：**
```json
{
  "email": "string",
  "password": "string"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "user": { "id": "string", "username": "string", "email": "string" },
    "token": "string"
  }
}
```

### 用户

#### GET /api/users/me
获取当前用户信息

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "username": "string",
    "email": "string",
    "avatar": "string",
    "level": 1,
    "experience": 0
  }
}
```

#### PUT /api/users/me
更新用户信息

**请求体：**
```json
{
  "username": "string",
  "avatar": "string"
}
```

#### GET /api/users/:id
获取指定用户信息

#### GET /api/users/:id/stats
获取用户游戏统计

### 排行榜

#### GET /api/leaderboard
获取排行榜

**查询参数：**
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 20)
- `difficulty`: 难度筛选 (可选)

**响应：**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "string",
        "username": "string",
        "score": 10000,
        "level": 5,
        "wave": 20,
        "kills": 150,
        "date": "2024-01-01"
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

#### POST /api/leaderboard
提交分数

**请求体：**
```json
{
  "score": 10000,
  "level": 5,
  "wave": 20,
  "kills": 150,
  "gameDuration": 1800,
  "difficulty": "NORMAL"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "rank": 15,
    "totalPlayers": 1000
  }
}
```

#### GET /api/leaderboard/my-rank
获取当前用户排名

### 成就

#### GET /api/achievements
获取用户成就列表

**响应：**
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
        "unlockedAt": "2024-01-01"
      }
    ]
  }
}
```

#### POST /api/achievements/unlock
解锁成就

**请求体：**
```json
{
  "achievementId": "first_kill"
}
```

### 设置

#### GET /api/settings
获取用户设置

**响应：**
```json
{
  "success": true,
  "data": {
    "difficulty": "NORMAL",
    "soundEnabled": true,
    "musicEnabled": true,
    "graphicsQuality": "HIGH",
    "fieldOfView": 75,
    "sensitivity": 0.5
  }
}
```

#### PUT /api/settings
更新用户设置

**请求体：**
```json
{
  "difficulty": "HARD",
  "soundEnabled": false
}
```

### 资源

#### GET /api/resources
获取资源列表

**响应：**
```json
{
  "success": true,
  "data": {
    "resources": [
      {
        "id": "string",
        "name": "string",
        "type": "texture",
        "url": "string",
        "size": 1024,
        "hash": "string"
      }
    ]
  }
}
```

#### GET /api/resources/:id
获取单个资源信息

#### POST /api/resources/verify
验证资源完整性

**请求体：**
```json
{
  "resources": [
    { "id": "string", "hash": "string" }
  ]
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "valid": ["id1", "id2"],
    "invalid": ["id3"]
  }
}
```

## WebSocket事件

### 实时排行榜

#### `leaderboard:update`
服务器推送排行榜更新

```json
{
  "type": "leaderboard:update",
  "data": {
    "rank": 15,
    "username": "Player1",
    "score": 10000
  }
}
```

### 多人游戏（计划中）

#### `game:join`
加入游戏房间

#### `game:leave`
离开游戏房间

#### `game:state`
游戏状态同步

#### `game:action`
玩家动作同步

## 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误信息",
    "details": {}
  }
}
```

## 错误代码

- `AUTH_REQUIRED`: 需要登录
- `INVALID_CREDENTIALS`: 凭证无效
- `USER_EXISTS`: 用户已存在
- `RESOURCE_NOT_FOUND`: 资源未找到
- `VALIDATION_ERROR`: 验证错误
- `SERVER_ERROR`: 服务器错误

## 认证方式

所有需要认证的请求都需要在请求头中携带JWT token：

```
Authorization: Bearer <token>
```

## 分页格式

列表API使用以下分页格式：

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

## 速率限制

- 认证端点: 10请求/分钟
- 其他API: 100请求/分钟
- 排行榜提交: 5请求/分钟

## 环境变量

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/fighter-game
REDIS_URI=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

## 部署

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/fighter-game
      - REDIS_URI=redis://redis:6379
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7
    volumes:
      - redis_data:/data

volumes:
  mongo_data:
  redis_data:
```

## 文档版本

- 版本: 1.0.0
- 更新日期: 2024-01-01
- 作者: Game Developer
