/**
 * 可活动空间（arena）的不变量测试。
 *
 * 这个文件存在的意义：场地大小原本分散硬编码在 5 处（飞船钳制 / 敌机钳制 /
 * 生成环 / 小行星带与布景 / 弹丸回收半径），改一处不改另一处的后果是**玩法回归**
 * 而不是报错 —— 敌机追不出边界被卡住、小行星带陷进场地里被撞、布景相对位置失真、
 * 弹丸在场地边缘被提前回收。这些都很容易被漏掉，所以用测试把它们锁住。
 *
 * 两类断言：
 *  A. **同倍关系**：所有派生值必须等于 1× 基准 × ARENA_SCALE。防的是
 *     「调了 ARENA_SCALE / 手改了某个值，其他值没跟着走」。
 *  B. **语义关系**：与倍数无关的相互约束（敌机边界 ⊇ 玩家边界、小行星带在场地之外
 *     …）。防的是「倍数一致但关系被改坏」。
 */

import { describe, it, expect } from 'vitest';
import {
  ARENA_SCALE,
  ASTEROID_BELT,
  BACKDROP,
  ENEMY_BOUNDS,
  ENEMY_CORNER_DISTANCE,
  ENEMY_SPAWN,
  PLAYER_BOUNDS,
  PLAYER_CORNER_DISTANCE,
  PROJECTILE_CULL_RADIUS,
} from './arena';

/**
 * 1× 基准 —— **只读参照物，不是用来改的配置**。
 *
 * 它记录的是「最多人玩过的那个版本」的世界尺寸（飞船 ±25/±15/±25，横穿不到 1.4 秒）。
 * 所有派生值都必须是它的 ARENA_SCALE 倍，世界才是「原版的等比放大」而不是
 * 一处一处拍脑袋调出来的拼装件。
 */
const BASE_1X = {
  player: { x: 25, y: 15, z: 25 },
  enemy: { x: 30, y: 15, z: 30 },
  spawn: { ringInner: 20, ringOuter: 30, yLimit: 10 },
  belt: { innerRadius: 35, outerRadius: 55 },
  starField: { count: 120, innerRadius: 20, outerRadius: 60 },
  nebulae: [
    { position: [30, 10, -30], scale: 25 },
    { position: [-30, -5, 25], scale: 20 },
  ],
  planets: [
    { position: [40, 15, 35], radius: 5 },
    { position: [-35, -10, -25], radius: 4 },
  ],
  structures: [{ position: [-50, 5, -40] }, { position: [45, 12, -30] }],
} as const;

const k = ARENA_SCALE;

describe('arena：世界是 1× 基准的等比放大（防单点漂移）', () => {
  it('飞船 / 敌机钳制各轴都是基准的 k 倍', () => {
    expect(PLAYER_BOUNDS).toEqual({
      x: BASE_1X.player.x * k,
      y: BASE_1X.player.y * k,
      z: BASE_1X.player.z * k,
    });
    expect(ENEMY_BOUNDS).toEqual({
      x: BASE_1X.enemy.x * k,
      y: BASE_1X.enemy.y * k,
      z: BASE_1X.enemy.z * k,
    });
  });

  it('敌机生成环与 Y 限幅同为 k 倍（否则敌机全挤在中心）', () => {
    expect(ENEMY_SPAWN.ringInner).toBe(BASE_1X.spawn.ringInner * k);
    expect(ENEMY_SPAWN.ringOuter).toBe(BASE_1X.spawn.ringOuter * k);
    expect(ENEMY_SPAWN.yLimit).toBe(BASE_1X.spawn.yLimit * k);
  });

  it('小行星带半径 k 倍，岩石尺寸同倍（角度密度只由数量决定，故数量不变）', () => {
    expect(ASTEROID_BELT.innerRadius).toBe(BASE_1X.belt.innerRadius * k);
    expect(ASTEROID_BELT.outerRadius).toBe(BASE_1X.belt.outerRadius * k);
    expect(ASTEROID_BELT.sizeScale).toBe(k);
    // 数量刻意不变：球壳的角密度只由数量决定，外移不改变天空里的疏密
    expect(ASTEROID_BELT.count).toBe(40);
  });

  it('星场半径与星点尺寸 k 倍', () => {
    expect(BACKDROP.starField.innerRadius).toBe(BASE_1X.starField.innerRadius * k);
    expect(BACKDROP.starField.outerRadius).toBe(BASE_1X.starField.outerRadius * k);
    expect(BACKDROP.starField.sizeScale).toBe(k);
    expect(BACKDROP.starField.count).toBe(BASE_1X.starField.count);
  });

  it('星云 / 行星 / 结构物的位置与尺寸都是 k 倍（天空构图不变）', () => {
    BACKDROP.nebulae.forEach((nebula, i) => {
      expect([...nebula.position]).toEqual(BASE_1X.nebulae[i].position.map((v) => v * k));
      expect(nebula.scale).toBe(BASE_1X.nebulae[i].scale * k);
    });
    BACKDROP.planets.forEach((planet, i) => {
      expect([...planet.position]).toEqual(BASE_1X.planets[i].position.map((v) => v * k));
      expect(planet.radius).toBe(BASE_1X.planets[i].radius * k);
    });
    BACKDROP.structures.forEach((structure, i) => {
      expect([...structure.position]).toEqual(BASE_1X.structures[i].position.map((v) => v * k));
    });
  });
});

describe('arena：与倍数无关的语义约束', () => {
  it('敌机边界在每个轴向上都 ≥ 玩家边界（玩家贴墙时敌机仍有外圈可绕）', () => {
    expect(ENEMY_BOUNDS.x).toBeGreaterThanOrEqual(PLAYER_BOUNDS.x);
    expect(ENEMY_BOUNDS.y).toBeGreaterThanOrEqual(PLAYER_BOUNDS.y);
    expect(ENEMY_BOUNDS.z).toBeGreaterThanOrEqual(PLAYER_BOUNDS.z);
  });

  it('生成环外径 ≥ 玩家单轴半边长（敌机不会全生成在玩家脚下）', () => {
    expect(ENEMY_SPAWN.ringOuter).toBeGreaterThanOrEqual(PLAYER_BOUNDS.x);
  });

  it('生成环 Y 限幅不超过敌机 Y 边界（不会被钳制挤成一排）', () => {
    expect(ENEMY_SPAWN.yLimit).toBeLessThanOrEqual(ENEMY_BOUNDS.y);
  });

  it('小行星带内缘 > 玩家单轴半边长（带仍在场地之外，不会被穿进撞岩石）', () => {
    expect(ASTEROID_BELT.innerRadius).toBeGreaterThan(PLAYER_BOUNDS.x);
    expect(ASTEROID_BELT.innerRadius).toBeGreaterThan(PLAYER_BOUNDS.z);
  });

  it('小行星带内缘与玩家盒子对角线保持相切关系（内缘/半边长 ∈ [1.4, √2]）', () => {
    // 这正是 1× 时的设计关系：对角 25√2≈35.4 vs 内缘 35 —— 极端 3D 角会
    // 略微探入带内，但带整体仍在场地之外。改值时别把这个关系破坏掉。
    const ratio = ASTEROID_BELT.innerRadius / PLAYER_BOUNDS.x;
    expect(ratio).toBeCloseTo(BASE_1X.belt.innerRadius / BASE_1X.player.x, 6);
    expect(ratio).toBeGreaterThanOrEqual(1.4);
    expect(ratio).toBeLessThanOrEqual(Math.SQRT2);
  });

  it('弹丸回收半径覆盖得到最远敌机（否则边缘交战会被提前回收）', () => {
    expect(PROJECTILE_CULL_RADIUS).toBeGreaterThan(ENEMY_CORNER_DISTANCE);
  });

  it('对角距离按盒子半边长正确推导', () => {
    expect(PLAYER_CORNER_DISTANCE).toBeCloseTo(
      Math.sqrt(PLAYER_BOUNDS.x ** 2 + PLAYER_BOUNDS.y ** 2 + PLAYER_BOUNDS.z ** 2),
      6,
    );
    expect(ENEMY_CORNER_DISTANCE).toBeGreaterThan(PLAYER_CORNER_DISTANCE);
  });

  it('放大后确实更宽敞：体积与横穿时间都是 1× 的数倍', () => {
    const volume1x = BASE_1X.player.x * 2 * (BASE_1X.player.y * 2) * (BASE_1X.player.z * 2);
    const volumeNow = PLAYER_BOUNDS.x * 2 * (PLAYER_BOUNDS.y * 2) * (PLAYER_BOUNDS.z * 2);
    expect(volumeNow / volume1x).toBeCloseTo(k ** 3, 6);

    // 满速横穿时间：基础速度 15 × boost 2.5 = 37.5 u/s（PlayerShip 的既有值）
    const topSpeed = 15 * 2.5;
    const crossSeconds1x = (BASE_1X.player.x * 2) / topSpeed;
    const crossSecondsNow = (PLAYER_BOUNDS.x * 2) / topSpeed;
    expect(crossSeconds1x).toBeLessThan(1.5); // 旧版确实「过于有限」
    expect(crossSecondsNow).toBeGreaterThan(2.5); // 新版有实质改善
  });
});
