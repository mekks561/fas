# 2026 Tech: Production-ready Dockerfile for Fighter Game Server
FROM node:20-alpine AS builder

WORKDIR /app

# 安装必要的构建工具
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

# 安装所有依赖（包含开发依赖以进行编译）
RUN npm ci

COPY . .

# 编译 TypeScript 并生成 Prisma Client
RUN npm run build
RUN npx prisma generate

# 第二阶段：运行阶段
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# 生产环境仅暴露端口
EXPOSE 3001

# 启动脚本
CMD ["npm", "start"]
