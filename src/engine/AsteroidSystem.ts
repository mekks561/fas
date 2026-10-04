import * as pc from 'playcanvas';
import type { PlayCanvasGameEngine } from './PlayCanvasEngine';
import type { PlayerShip } from './PlayerShip';

/**
 * 小行星碰撞检测系统
 * 每帧检测玩家与小行星场的距离，触发碰撞伤害和视觉反馈
 * 每个小行星有独立冷却时间，避免连续伤害
 */
export class AsteroidSystem {
  private engine: PlayCanvasGameEngine;
  private player: PlayerShip;
  private asteroids: pc.Entity[] = [];
  private collisionRadius: number = 2.0; // 玩家碰撞半径
  private damageOnHit: number = 15; // 单次碰撞伤害
  private cooldownPerAsteroid: Map<pc.Entity, number> = new Map();

  constructor(player: PlayerShip, engine: PlayCanvasGameEngine) {
    this.player = player;
    this.engine = engine;
    this.collectAsteroids();
  }

  /**
   * 从场景中收集所有小行星实体引用
   * 在 createAsteroidField 之后调用
   */
  private collectAsteroids(): void {
    const field = this.engine.getApp().root.findByName('asteroidField');
    if (!field) {
      console.warn('[AsteroidSystem] asteroidField not found in scene');
      return;
    }
    this.asteroids = field.children as pc.Entity[];
    console.log(`[AsteroidSystem] Collected ${this.asteroids.length} asteroids`);
  }

  /**
   * 每帧更新：检测玩家与小行星的碰撞
   * @param dt 帧间隔（秒）
   */
  public update(dt: number): void {
    if (this.asteroids.length === 0) return;

    const playerPos = this.player.getPosition();

    for (const asteroid of this.asteroids) {
      // 冷却递减（避免同一小行星连续造成伤害）
      const cd = this.cooldownPerAsteroid.get(asteroid) || 0;
      if (cd > 0) {
        this.cooldownPerAsteroid.set(asteroid, cd - dt);
        continue;
      }

      const dist = asteroid.getPosition().distance(playerPos);
      // 小行星碰撞半径 = 缩放值 × 1.5（createAsteroid 中 scale 0.5-2.5）
      const asteroidScale = asteroid.getLocalScale().x || 1;
      const asteroidRadius = asteroidScale * 1.5;

      if (dist < asteroidRadius + this.collisionRadius) {
        // 触发碰撞伤害（PlayerShip.takeDamage 内部会处理无敌帧和护盾）
        const killed = this.player.takeDamage(this.damageOnHit);
        // 设置 1.5s 冷却避免连续伤害
        this.cooldownPerAsteroid.set(asteroid, 1.5);
        console.log(
          `[AsteroidSystem] Collision detected (dist: ${dist.toFixed(2)}, damage: ${this.damageOnHit})`,
        );
        if (killed) break;
      }
    }
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    this.asteroids = [];
    this.cooldownPerAsteroid.clear();
  }
}
