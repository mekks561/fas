import mongoose, { Document, Schema } from 'mongoose';

// 排行榜条目接口
export interface ILeaderboard extends Document {
  userId: mongoose.Types.ObjectId;
  username: string;
  score: number;
  level: number;
  wave: number;
  kills: number;
  gameDuration: number;
  difficulty: string;
  date: Date;
  createdAt: Date;
}

// 排行榜Schema
const leaderboardSchema = new Schema<ILeaderboard>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      required: true,
      index: true
    },
    level: {
      type: Number,
      default: 1
    },
    wave: {
      type: Number,
      default: 1
    },
    kills: {
      type: Number,
      default: 0
    },
    gameDuration: {
      type: Number,
      default: 0
    },
    difficulty: {
      type: String,
      enum: ['EASY', 'NORMAL', 'HARD', 'EXPERT'],
      default: 'NORMAL'
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// 创建复合索引
leaderboardSchema.index({ score: -1 });
leaderboardSchema.index({ userId: 1, score: -1 });
leaderboardSchema.index({ difficulty: 1, score: -1 });

export const Leaderboard = mongoose.model<ILeaderboard>('Leaderboard', leaderboardSchema);
