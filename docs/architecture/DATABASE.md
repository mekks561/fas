# Fighter Game - 数据库设计文档

## 数据库概述

本项目使用 MongoDB 作为主数据库，采用 Mongoose ODM 进行数据建模。

## 数据库连接

```javascript
// 环境变量
MONGODB_URI=mongodb://localhost:27017/fighter-game

// 连接配置
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
```

## 集合设计

### 1. users (用户集合)

存储用户基本信息。

```javascript
{
  _id: ObjectId,                    // 主键
  username: String,                 // 用户名 (唯一, 3-20字符)
  email: String,                    // 邮箱 (唯一)
  password: String,                 // 密码 (加密存储)
  avatar: String,                   // 头像URL
  level: Number,                    // 等级 (默认1)
  experience: Number,               // 经验值 (默认0)
  createdAt: Date,                  // 创建时间
  updatedAt: Date                   // 更新时间
}
```

**索引：**
- `username`: 唯一索引
- `email`: 唯一索引

**示例数据：**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "username": "Player1",
  "email": "player1@example.com",
  "password": "$2a$10$X8K1...",
  "avatar": "https://example.com/avatar.png",
  "level": 5,
  "experience": 2500,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T12:30:00.000Z"
}
```

### 2. leaderboard (排行榜集合)

存储游戏成绩记录。

```javascript
{
  _id: ObjectId,                    // 主键
  userId: ObjectId,                // 用户ID (外键)
  username: String,                 // 用户名 (冗余存储)
  score: Number,                   // 分数
  level: Number,                   // 等级
  wave: Number,                    // 波次
  kills: Number,                   // 击杀数
  gameDuration: Number,            // 游戏时长 (秒)
  difficulty: String,              // 难度 (EASY|NORMAL|HARD|EXPERT)
  date: Date,                      // 游戏日期
  createdAt: Date,                 // 创建时间
  updatedAt: Date                  // 更新时间
}
```

**索引：**
- `score`: 降序索引 (用于排名查询)
- `userId + score`: 复合索引
- `difficulty + score`: 复合索引

**示例数据：**
```json
{
  "_id": "507f1f77bcf86cd799439022",
  "userId": "507f1f77bcf86cd799439011",
  "username": "Player1",
  "score": 15000,
  "level": 8,
  "wave": 25,
  "kills": 180,
  "gameDuration": 1800,
  "difficulty": "HARD",
  "date": "2024-01-15T12:30:00.000Z",
  "createdAt": "2024-01-15T12:30:00.000Z"
}
```

### 3. achievements (成就集合)

存储用户成就信息。

```javascript
{
  _id: ObjectId,                    // 主键
  userId: ObjectId,                // 用户ID (外键, 唯一)
  achievements: [{
    id: String,                    // 成就ID
    name: String,                  // 成就名称
    description: String,           // 成就描述
    unlockedAt: Date              // 解锁时间
  }],
  createdAt: Date,                 // 创建时间
  updatedAt: Date                  // 更新时间
}
```

**索引：**
- `userId`: 唯一索引

**示例数据：**
```json
{
  "_id": "507f1f77bcf86cd799439033",
  "userId": "507f1f77bcf86cd799439011",
  "achievements": [
    {
      "id": "first_kill",
      "name": "首杀",
      "description": "击杀一个敌人",
      "unlockedAt": "2024-01-01T00:10:00.000Z"
    },
    {
      "id": "wave_10",
      "name": "波次达人",
      "description": "到达第10波",
      "unlockedAt": "2024-01-05T15:20:00.000Z"
    }
  ]
}
```

### 4. user_settings (用户设置集合)

存储用户游戏设置。

```javascript
{
  _id: ObjectId,                    // 主键
  userId: ObjectId,                // 用户ID (外键, 唯一)
  settings: {
    difficulty: String,              // 难度
    soundEnabled: Boolean,          // 音效开关
    musicEnabled: Boolean,          // 音乐开关
    graphicsQuality: String,         // 画质 (LOW|MEDIUM|HIGH|ULTRA)
    fieldOfView: Number,            // 视野 (45-120)
    sensitivity: Number             // 灵敏度 (0.1-2.0)
  },
  createdAt: Date,                 // 创建时间
  updatedAt: Date                  // 更新时间
}
```

**索引：**
- `userId`: 唯一索引

**示例数据：**
```json
{
  "_id": "507f1f77bcf86cd799439044",
  "userId": "507f1f77bcf86cd799439011",
  "settings": {
    "difficulty": "HARD",
    "soundEnabled": true,
    "musicEnabled": true,
    "graphicsQuality": "HIGH",
    "fieldOfView": 75,
    "sensitivity": 0.8
  }
}
```

### 5. game_sessions (游戏会话集合)

存储游戏会话信息（可选，用于分析）。

```javascript
{
  _id: ObjectId,                    // 主键
  userId: ObjectId,                // 用户ID
  startTime: Date,                 // 开始时间
  endTime: Date,                   // 结束时间
  duration: Number,                // 持续时间 (秒)
  score: Number,                   // 最终分数
  wave: Number,                    // 到达波次
  kills: Number,                   // 击杀数
  result: String,                  // 结果 (WIN|LOSE|QUIT)
  difficulty: String,              // 难度
  device: String,                  // 设备信息
  createdAt: Date,                 // 创建时间
  updatedAt: Date                  // 更新时间
}
```

**索引：**
- `userId + startTime`: 复合索引
- `startTime`: 降序索引

## 数据关系

```
users (1) ──────< (N) leaderboard
  │                    (一个用户多条记录)
  │
  ├─────< (N) achievements
  │                   (一个用户一组成就)
  │
  ├─────< (N) user_settings
  │                   (一个用户一组设置)
  │
  └─────< (N) game_sessions
                          (一个用户多次游戏)
```

## 查询优化

### 1. 排行榜查询
```javascript
// 获取前10名
db.leaderboard.find().sort({ score: -1 }).limit(10)

// 获取用户排名
db.leaderboard.countDocuments({ score: { $gt: userScore } }) + 1
```

### 2. 用户数据查询
```javascript
// 获取用户及其最新成绩
db.users.aggregate([
  { $match: { _id: userId } },
  {
    $lookup: {
      from: 'leaderboard',
      localField: '_id',
      foreignField: 'userId',
      as: 'scores'
    }
  },
  { $unwind: '$scores' },
  { $sort: { 'scores.score': -1 } },
  { $limit: 1 }
])
```

### 3. 统计聚合
```javascript
// 用户总游戏时长
db.game_sessions.aggregate([
  { $match: { userId: userId } },
  { $group: { _id: null, totalDuration: { $sum: '$duration' } } }
])

// 每日活跃用户
db.game_sessions.aggregate([
  { $match: { startTime: { $gte: last24Hours } } },
  { $group: { _id: '$userId' } },
  { $count: 'activeUsers' }
])
```

## 数据安全

### 1. 密码加密
```javascript
const bcrypt = require('bcryptjs');
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);
```

### 2. JWT认证
```javascript
const token = jwt.sign(
  { userId: user._id },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
```

### 3. 输入验证
```javascript
// 使用 Joi 或 express-validator
const schema = Joi.object({
  username: Joi.string().alphanum().min(3).max(20),
  email: Joi.string().email(),
  password: Joi.string().min(6)
});
```

## 数据备份

```javascript
// mongodump 备份
mongodump --db fighter-game --out /backup/path

// mongorestore 恢复
mongorestore --db fighter-game --dir /backup/path
```

## 性能监控

```javascript
// MongoDB Profiler
db.setProfilingLevel(2, { slowms: 100 })

// 查看慢查询
db.system.profile.find({ millis: { $gt: 100 } })
```

## 分片策略 (可选)

当数据量超过1000万条时考虑分片：

```javascript
// 排行榜按用户ID分片
sh.shardCollection('fighter-game.leaderboard', { userId: 1 })

// 时间序列按日期分片
sh.shardCollection('fighter-game.game_sessions', { date: 1 })
```

## 文档版本

- 版本: 1.0.0
- 更新日期: 2024-01-01
- 作者: Game Developer
