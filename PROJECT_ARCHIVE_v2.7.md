# Fighter Game v2.7 "深空觉醒" 项目存档说明 (2026-10-14)

## 1. 当前版本状态
**版本号**: v2.7.5-stable (Deep Space Awakening)
**核心架构**: PlayCanvas (Render) + WebGPU (Physics/Compute) + Node.js/MySQL (Backend)

## 2. 已交付的核心特性
- **GPU 驱动的程序化宇宙**:
  - `ComputePCG`: 利用 WebGPU Compute Shader 瞬间生成 10,000+ 陨石。
  - `InstancedRenderer`: GPU 实例化渲染，万级物体 Draw Call 压减至个位数。
- **极致物理损毁系统**:
  - `WebGPUDamageSystem`: 顶点级网格撕裂、关键组件（反应堆、引擎、机翼）功能性损毁。
  - `PhysicsKernel`: 动态质心 (CoM) 偏移导致的非对称飞行反馈。
- **神经网络派系 AI**:
  - `StrategicAICore`: 基于加权神经元的星区扩张与动态市场价格干预。
- **2026 沉浸式环境**:
  - `AudioRaytracer`: 实时音频射线追踪，模拟空间混响与遮挡。
  - `Volumetric Nebula`: 具备 LOD 分级的体积星云与隐身/环境阻力逻辑。

## 3. 部署与环境
- **Docker**: 已修复 `docker-compose.yml`，统一为 MySQL 8.0 架构。
- **Server**: 实现了多阶段构建的 `Dockerfile`，支持一键部署 API 服务。
- **文档**: 更新了 `server/README.md`，对齐了最新的 Prisma/MySQL 技术栈。

## 4. 下一阶段规划 (v2.8 "觉醒舰队")
- **集群战术网 (Swarm Intelligence)**: NPC 编队协同与进化式行为学习。
- **巨型母舰 (Capital Ships)**: 多级损毁判定的大型旗舰实体。
- **跨星系跃迁流**: 完善星图与跃迁的 UI 深度交互。

---
*存档人: TRAE Code Assistant*
*存档日期: 2026-10-14*
