/**
 * 可活动空间（arena）的唯一真源。
 *
 * ## 为什么需要这个文件
 *
 * 「世界有多大」原本分散硬编码在 5 处，彼此没有约束：
 *
 * | 位置 | 常量 | 旧值 |
 * | --- | --- | --- |
 * | `PlayerShip.update` | 飞船钳制 | ±25 / ±15 / ±25 |
 * | `EnemyAI.moveTowards` | 敌机钳制 | ±30 / ±15 / ±30 |
 * | `EnemySystem.spawnEnemy` | 生成环半径 / Y 限幅 | 20~30 / ±10 |
 * | `GameScene` 布景调用处 | 小行星带 / 星场 / 星云 / 行星 / 空间站 | 35~55 / 20~60 … |
 * | `WeaponSystem` 弹丸回收 | 距原点半径 | 100 |
 *
 * 结果是改空间大小必然漏改：只放宽飞船钳制 → 敌机追不出原边界被卡住、
 * 生成环还在中间导致敌机全从背后冒出来、小行星带陷进场地里被撞、
 * 布景相对位置失真、弹丸在场地边缘被提前回收。这里收口成一处，其余全部派生。
 *
 * ## 依赖方向（硬约束）
 *
 * 本文件**不得** import 任何东西。理由：它要同时被
 * ① 引擎热路径（`PlayerShip` / `EnemyAI` / `EnemySystem` / `WeaponSystem`）和
 * ② 关卡派生层（`src/levels/index.ts` 从这里再导出，保持既有导入点不破）
 * 引用。一旦它反向依赖关卡配置，就会把 `LuaEngine` → wasmoon 整条链拖进热路径。
 *
 * ## 几何约定
 *
 * 钳制是**盒子**（各轴独立），不是球/柱。小行星带是**球壳**，
 * 两者只有在「球壳内缘 ≈ 盒子对角」时才相切。当前
 * 对角线 = √(50² + 30² + 50²) ≈ 76.8，带内缘 70 —— 与旧版
 * （√(25²+15²+25²) ≈ 38.4 vs 内缘 35）保持**完全相同的相切关系**，
 * 即最极端的 3D 角落仍会略微探入带内（旧版就如此）。这不是本次引入的行为。
 */

/** 世界整体放大倍数（相对最初的 1× 基准）。改这一个数即可整体缩放并对齐所有派生值。 */
export const ARENA_SCALE = 2 as const;

/**
 * 飞船可活动范围（各轴半边长，盒子钳制）。
 *
 * 旧值 ±25 / ±15 / ±25 配 `maxSpeed 15 × boost 2.5 = 37.5 u/s`，
 * 满速横穿全场不足 1.4 秒 —— 这是「空间过于有限」的直接来源。
 * 现为 2×：50×60×50，横穿约 2.7 秒、体积约 8 倍。
 */
export const PLAYER_BOUNDS = { x: 50, y: 30, z: 50 } as const;

/**
 * 敌机活动边界：刻意比玩家大一圈（保持 1.2× 的既有比例）。
 *
 * 为什么必须比玩家大而不是相等：玩家贴到边界时敌机还有外圈可以绕，
 * 否则会出现「玩家背靠墙、敌机一起撞墙排队」的观感。
 * **改 `PLAYER_BOUNDS` 时必须同步本值**，否则敌机追不出边界 = 直接的行为回归。
 */
export const ENEMY_BOUNDS = { x: 60, y: 30, z: 60 } as const;

/**
 * 敌机生成环：球面采样半径区间 + Y 轴限幅。
 * 生成环与场地同比例（0.8×~1.2× 于 `PLAYER_BOUNDS.x`），
 * 保证无论玩家在中心还是边缘，敌机都在合理距离上出现。
 */
export const ENEMY_SPAWN = { ringInner: 40, ringOuter: 60, yLimit: 20 } as const;

/**
 * 小行星带：球壳。内缘必须明显大于 `PLAYER_BOUNDS` 的单轴半边长，
 * 否则飞船会直接穿进带里撞岩石（带是有碰撞体的，见 `AsteroidSystem`）。
 *
 * `sizeScale` 用于维持**观感不变**：带外移 2× 后，岩石若不放大 2×，
 * 从原点看过去的视角尺寸会缩到一半。数量则**不需要**变（角度密度只由数量决定）——
 * 所以这次外移没有增加任何 draw call。
 */
export const ASTEROID_BELT = {
  count: 40,
  innerRadius: 70,
  outerRadius: 110,
  sizeScale: 2,
} as const;

/**
 * 远景布景：位置与尺寸**同倍**放大。
 *
 * 位置 ×2 + 尺寸 ×2 ⇒ 从原点看过去的视角尺寸与方位完全不变，
 * 天空观感逐像素保持，只是整体后退了一倍 —— 飞船因此获得更大的活动体积
 * 而画面构图不被破坏。
 */
export const BACKDROP = {
  /** 近景星点：数量不变（角度密度只取决于数量），半径与尺寸 ×2 */
  starField: { count: 120, innerRadius: 40, outerRadius: 120, sizeScale: 2 },
  nebulae: [
    { position: [60, 20, -60], scale: 50 },
    { position: [-60, -10, 50], scale: 40 },
  ],
  planets: [
    { name: 'planet1', position: [80, 30, 70], radius: 10, color: [0.4, 0.6, 0.8] },
    { name: 'planet2', position: [-70, -20, -50], radius: 8, color: [0.8, 0.5, 0.3] },
  ],
  structures: [
    {
      name: 'space_station',
      position: [-100, 10, -80],
      yaw: 40,
      scale: 2,
      material: 'metalPlates',
    },
    { name: 'satellite', position: [90, 24, -60], yaw: 200, scale: 1, material: 'metal' },
  ],
} as const;

/** 盒子对角半径（各轴半边长 → 距原点距离） */
const cornerDistance = (b: { x: number; y: number; z: number }): number =>
  Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z);

/** 飞船能到达的最远距离（盒子对角） */
export const PLAYER_CORNER_DISTANCE = cornerDistance(PLAYER_BOUNDS);

/** 敌机能到达的最远距离（盒子对角） */
export const ENEMY_CORNER_DISTANCE = cornerDistance(ENEMY_BOUNDS);

/**
 * 弹丸回收半径（距原点）。
 *
 * 派生而非魔数：必须 ≥ 敌机对角距离（否则玩家在场地一端开火、敌机在另一端时，
 * 弹丸会在够到敌机前被回收 —— 空间放大后旧值 100 只剩 10 的余量，过于脆弱），
 * 再加一段交战余量留出瞄准偏差与外圈追击的空间。
 */
export const PROJECTILE_CULL_RADIUS = Math.ceil(ENEMY_CORNER_DISTANCE) + 60;
