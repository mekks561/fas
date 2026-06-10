import mongoose, { Document, Schema } from 'mongoose';

// 用户接口
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  avatar?: string;
  level: number;
  experience: number;
  createdAt: Date;
  updatedAt: Date;
}

// 用户Schema
const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    avatar: {
      type: String,
      default: ''
    },
    level: {
      type: Number,
      default: 1
    },
    experience: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// 创建索引
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
