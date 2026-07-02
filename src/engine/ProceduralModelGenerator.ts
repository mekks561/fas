import * as pc from 'playcanvas';

/**
 * 程序化3D模型生成器
 * 使用PlayCanvas API构建复杂的飞船、敌人、空间站等3D模型
 */

export type ShipModelType =
  'fighter' | 'bomber' | 'cruiser' | 'stealth' | 'corvette' | 'dreadnought';

export type EnemyModelType =
  | 'scout'
  | 'fighter'
  | 'bomber'
  | 'tank'
  | 'assassin'
  | 'drone'
  | 'corvette'
  | 'destroyer'
  | 'boss_sentinel'
  | 'boss_overlord';

export type StructureModelType =
  'space_station' | 'asteroid' | 'debris' | 'satellite' | 'mining_rig' | 'defense_platform';

export interface ModelOptions {
  primaryColor?: [number, number, number];
  secondaryColor?: [number, number, number];
  emissiveColor?: [number, number, number];
  scale?: number;
}

export class ProceduralModelGenerator {
  private app: pc.Application;

  constructor(app: pc.Application) {
    this.app = app;
  }

  // ============ 飞船模型 ============

  public createFighterShip(options: ModelOptions = {}): pc.Entity {
    const ship = new pc.Entity('fighter_ship');
    const primary = options.primaryColor || [0.2, 0.5, 0.8];
    const secondary = options.secondaryColor || [0.1, 0.3, 0.6];
    const emissive = options.emissiveColor || [0.1, 0.2, 0.4];
    const scale = options.scale || 1;

    const hullMat = this.createMaterial(primary, [0.8, 0.8, 0.8], emissive, 80);
    const accentMat = this.createMaterial(secondary, [0.6, 0.6, 0.6], [0.05, 0.1, 0.2], 60);
    const glowMat = this.createEmissiveMaterial([0.3, 0.6, 1.0], 2.0);
    const darkMat = this.createMaterial([0.1, 0.1, 0.15], [0.3, 0.3, 0.3], [0, 0, 0], 20);

    // 主机身 - 流线型
    const fuselage = new pc.Entity('fuselage');
    fuselage.addComponent('model', { type: 'cone' });
    if (fuselage.model) fuselage.model.material = hullMat;
    fuselage.setLocalScale(0.6 * scale, 2.5 * scale, 0.6 * scale);
    fuselage.setLocalEulerAngles(-90, 0, 0);
    ship.addChild(fuselage);

    // 驾驶舱
    const cockpit = new pc.Entity('cockpit');
    cockpit.addComponent('model', { type: 'sphere' });
    if (cockpit.model) cockpit.model.material = this.createGlassMaterial([0.3, 0.6, 1.0]);
    cockpit.setLocalPosition(0, 0.2 * scale, 0.6 * scale);
    cockpit.setLocalScale(0.35 * scale, 0.25 * scale, 0.45 * scale);
    ship.addChild(cockpit);

    // 左翼
    const wingLeft = this.createWing('wingLeft', -1, hullMat, accentMat, scale);
    ship.addChild(wingLeft);

    // 右翼
    const wingRight = this.createWing('wingRight', 1, hullMat, accentMat, scale);
    ship.addChild(wingRight);

    // 引擎尾焰
    const engineGlow = new pc.Entity('engineGlow');
    engineGlow.addComponent('model', { type: 'cylinder' });
    if (engineGlow.model) engineGlow.model.material = glowMat;
    engineGlow.setLocalPosition(0, 0, -1.2 * scale);
    engineGlow.setLocalScale(0.25 * scale, 0.3 * scale, 0.25 * scale);
    engineGlow.setLocalEulerAngles(90, 0, 0);
    ship.addChild(engineGlow);

    // 武器挂载
    const weaponL = this.createWeaponMount(-0.7, scale, darkMat);
    const weaponR = this.createWeaponMount(0.7, scale, darkMat);
    ship.addChild(weaponL);
    ship.addChild(weaponR);

    return ship;
  }

  public createBomberShip(options: ModelOptions = {}): pc.Entity {
    const ship = new pc.Entity('bomber_ship');
    const primary = options.primaryColor || [0.6, 0.4, 0.2];
    const emissive = options.emissiveColor || [0.2, 0.1, 0];
    const scale = options.scale || 1;

    const hullMat = this.createMaterial(primary, [0.5, 0.5, 0.5], emissive, 40);
    const darkMat = this.createMaterial([0.15, 0.1, 0.08], [0.3, 0.3, 0.3], [0, 0, 0], 20);

    // 宽大机身
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'box' });
    if (body.model) body.model.material = hullMat;
    body.setLocalScale(1.5 * scale, 0.6 * scale, 2.5 * scale);
    ship.addChild(body);

    // 炸弹舱
    const bombBay = new pc.Entity('bombBay');
    bombBay.addComponent('model', { type: 'cylinder' });
    if (bombBay.model) bombBay.model.material = darkMat;
    bombBay.setLocalPosition(0, -0.4 * scale, 0);
    bombBay.setLocalScale(0.4 * scale, 0.8 * scale, 0.4 * scale);
    bombBay.setLocalEulerAngles(90, 0, 0);
    ship.addChild(bombBay);

    // 双尾翼
    for (const side of [-1, 1]) {
      const tail = new pc.Entity(`tail_${side}`);
      tail.addComponent('model', { type: 'box' });
      if (tail.model) tail.model.material = hullMat;
      tail.setLocalPosition(side * 0.5 * scale, 0.5 * scale, -1 * scale);
      tail.setLocalScale(0.1 * scale, 0.8 * scale, 0.6 * scale);
      ship.addChild(tail);
    }

    // 引擎 × 2
    for (const side of [-1, 1]) {
      const engine = new pc.Entity(`engine_${side}`);
      engine.addComponent('model', { type: 'cylinder' });
      if (engine.model) engine.model.material = this.createEmissiveMaterial([1.0, 0.4, 0.1], 1.5);
      engine.setLocalPosition(side * 0.6 * scale, 0, -1.3 * scale);
      engine.setLocalScale(0.2 * scale, 0.25 * scale, 0.2 * scale);
      engine.setLocalEulerAngles(90, 0, 0);
      ship.addChild(engine);
    }

    return ship;
  }

  public createCruiserShip(options: ModelOptions = {}): pc.Entity {
    const ship = new pc.Entity('cruiser_ship');
    const primary = options.primaryColor || [0.3, 0.3, 0.5];
    const emissive = options.emissiveColor || [0.1, 0.1, 0.3];
    const scale = options.scale || 1;

    const hullMat = this.createMaterial(primary, [0.7, 0.7, 0.8], emissive, 60);
    const accentMat = this.createMaterial([0.5, 0.5, 0.6], [0.5, 0.5, 0.5], [0.05, 0.05, 0.1], 40);

    // 主体 - 长形结构
    const hull = new pc.Entity('hull');
    hull.addComponent('model', { type: 'cylinder' });
    if (hull.model) hull.model.material = hullMat;
    hull.setLocalScale(0.8 * scale, 3.5 * scale, 0.8 * scale);
    hull.setLocalEulerAngles(90, 0, 0);
    ship.addChild(hull);

    // 上层建筑
    const superstructure = new pc.Entity('superstructure');
    superstructure.addComponent('model', { type: 'box' });
    if (superstructure.model) superstructure.model.material = accentMat;
    superstructure.setLocalPosition(0, 0.5 * scale, 0.3 * scale);
    superstructure.setLocalScale(0.6 * scale, 0.4 * scale, 1.5 * scale);
    ship.addChild(superstructure);

    // 侧翼
    for (const side of [-1, 1]) {
      const wing = new pc.Entity(`wing_${side}`);
      wing.addComponent('model', { type: 'box' });
      if (wing.model) wing.model.material = hullMat;
      wing.setLocalPosition(side * 1.0 * scale, 0, 0);
      wing.setLocalScale(0.8 * scale, 0.15 * scale, 2.0 * scale);
      ship.addChild(wing);
    }

    // 炮塔 × 3
    const turretPositions = [
      [0, 0.7, 0.8],
      [-0.8, 0.3, -0.5],
      [0.8, 0.3, -0.5],
    ];
    turretPositions.forEach((pos, _i) => {
      const turret = this.createTurret(scale, hullMat);
      turret.setLocalPosition(pos[0] * scale, pos[1] * scale, pos[2] * scale);
      ship.addChild(turret);
    });

    // 引擎 × 3
    for (let i = -1; i <= 1; i++) {
      const engine = new pc.Entity(`engine_${i}`);
      engine.addComponent('model', { type: 'cylinder' });
      if (engine.model) engine.model.material = this.createEmissiveMaterial([0.3, 0.5, 1.0], 1.5);
      engine.setLocalPosition(i * 0.4 * scale, 0, -1.8 * scale);
      engine.setLocalScale(0.2 * scale, 0.2 * scale, 0.2 * scale);
      engine.setLocalEulerAngles(90, 0, 0);
      ship.addChild(engine);
    }

    return ship;
  }

  public createStealthShip(options: ModelOptions = {}): pc.Entity {
    const ship = new pc.Entity('stealth_ship');
    const primary = options.primaryColor || [0.05, 0.05, 0.08];
    const emissive = options.emissiveColor || [0.2, 0, 0.3];
    const scale = options.scale || 1;

    const hullMat = this.createMaterial(primary, [0.2, 0.2, 0.3], emissive, 100);

    // 扁平三角机身
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'cone' });
    if (body.model) body.model.material = hullMat;
    body.setLocalScale(1.8 * scale, 0.3 * scale, 1.2 * scale);
    body.setLocalEulerAngles(-90, 0, 0);
    ship.addChild(body);

    // 隐形装置
    const cloak = new pc.Entity('cloak');
    cloak.addComponent('model', { type: 'sphere' });
    if (cloak.model) cloak.model.material = this.createGlassMaterial([0.5, 0, 0.8]);
    cloak.setLocalScale(2.0 * scale, 0.5 * scale, 1.5 * scale);
    ship.addChild(cloak);

    // 引擎
    const engine = new pc.Entity('engine');
    engine.addComponent('model', { type: 'cylinder' });
    if (engine.model) engine.model.material = this.createEmissiveMaterial([0.5, 0, 0.8], 2.0);
    engine.setLocalPosition(0, 0, -0.8 * scale);
    engine.setLocalScale(0.2 * scale, 0.2 * scale, 0.2 * scale);
    engine.setLocalEulerAngles(90, 0, 0);
    ship.addChild(engine);

    return ship;
  }

  public createDreadnoughtShip(options: ModelOptions = {}): pc.Entity {
    const ship = new pc.Entity('dreadnought_ship');
    const primary = options.primaryColor || [0.2, 0.2, 0.25];
    const emissive = options.emissiveColor || [0.3, 0.1, 0];
    const scale = options.scale || 1.5;

    const hullMat = this.createMaterial(primary, [0.4, 0.4, 0.5], emissive, 30);
    const accentMat = this.createMaterial([0.1, 0.1, 0.15], [0.2, 0.2, 0.2], [0, 0, 0], 10);

    // 巨大主体
    const hull = new pc.Entity('hull');
    hull.addComponent('model', { type: 'box' });
    if (hull.model) hull.model.material = hullMat;
    hull.setLocalScale(3 * scale, 1.2 * scale, 5 * scale);
    ship.addChild(hull);

    // 舰首
    const bow = new pc.Entity('bow');
    bow.addComponent('model', { type: 'cone' });
    if (bow.model) bow.model.material = hullMat;
    bow.setLocalScale(2 * scale, 1.2 * scale, 2 * scale);
    bow.setLocalPosition(0, 0, 3.5 * scale);
    bow.setLocalEulerAngles(-90, 0, 0);
    ship.addChild(bow);

    // 侧装甲板
    for (const side of [-1, 1]) {
      const armor = new pc.Entity(`armor_${side}`);
      armor.addComponent('model', { type: 'box' });
      if (armor.model) armor.model.material = accentMat;
      armor.setLocalPosition(side * 1.8 * scale, 0, 0);
      armor.setLocalScale(0.6 * scale, 0.8 * scale, 4 * scale);
      ship.addChild(armor);
    }

    // 炮塔群
    const turretPositions = [
      [0, 1.0, 1.5],
      [-1.2, 0.8, 0.5],
      [1.2, 0.8, 0.5],
      [-1.2, 0.8, -1],
      [1.2, 0.8, -1],
      [0, 1.0, -2],
    ];
    turretPositions.forEach((pos) => {
      const turret = this.createTurret(scale, hullMat);
      turret.setLocalPosition(pos[0] * scale, pos[1] * scale, pos[2] * scale);
      ship.addChild(turret);
    });

    // 引擎群
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const engine = new pc.Entity(`engine_${i}`);
      engine.addComponent('model', { type: 'cylinder' });
      if (engine.model) engine.model.material = this.createEmissiveMaterial([1.0, 0.3, 0.1], 2.0);
      engine.setLocalPosition(i * 0.5 * scale, 0, -2.8 * scale);
      engine.setLocalScale(0.25 * scale, 0.3 * scale, 0.25 * scale);
      engine.setLocalEulerAngles(90, 0, 0);
      ship.addChild(engine);
    }

    return ship;
  }

  // ============ 敌人模型 ============

  public createEnemyModel(type: EnemyModelType, options: ModelOptions = {}): pc.Entity {
    switch (type) {
      case 'scout':
        return this.createEnemyScout(options);
      case 'fighter':
        return this.createEnemyFighter(options);
      case 'bomber':
        return this.createEnemyBomber(options);
      case 'tank':
        return this.createEnemyTank(options);
      case 'assassin':
        return this.createEnemyAssassin(options);
      case 'drone':
        return this.createEnemyDrone(options);
      case 'corvette':
        return this.createEnemyCorvette(options);
      case 'destroyer':
        return this.createEnemyDestroyer(options);
      case 'boss_sentinel':
        return this.createBossSentinel(options);
      case 'boss_overlord':
        return this.createBossOverlord(options);
      default:
        return this.createEnemyFighter(options);
    }
  }

  private createEnemyScout(options: ModelOptions = {}): pc.Entity {
    const enemy = new pc.Entity('enemy_scout');
    const scale = options.scale || 0.8;
    const mat = this.createMaterial(
      options.primaryColor || [0.4, 0.8, 0.4],
      [0.5, 0.5, 0.5],
      options.emissiveColor || [0.1, 0.3, 0.1],
      30,
    );

    // 小型锥形机身
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'cone' });
    if (body.model) body.model.material = mat;
    body.setLocalScale(0.4 * scale, 1.2 * scale, 0.4 * scale);
    body.setLocalEulerAngles(-90, 0, 0);
    enemy.addChild(body);

    // 翼片
    for (const side of [-1, 1]) {
      const wing = new pc.Entity(`wing_${side}`);
      wing.addComponent('model', { type: 'box' });
      if (wing.model) wing.model.material = mat;
      wing.setLocalPosition(side * 0.4 * scale, 0, -0.2 * scale);
      wing.setLocalScale(0.5 * scale, 0.05 * scale, 0.4 * scale);
      enemy.addChild(wing);
    }

    // 引擎光
    const engine = new pc.Entity('engine');
    engine.addComponent('model', { type: 'sphere' });
    if (engine.model) engine.model.material = this.createEmissiveMaterial([0.2, 1.0, 0.2], 1.5);
    engine.setLocalPosition(0, 0, -0.6 * scale);
    engine.setLocalScale(0.15 * scale, 0.15 * scale, 0.15 * scale);
    enemy.addChild(engine);

    return enemy;
  }

  private createEnemyFighter(options: ModelOptions = {}): pc.Entity {
    const enemy = new pc.Entity('enemy_fighter');
    const scale = options.scale || 1;
    const mat = this.createMaterial(
      options.primaryColor || [0.8, 0.5, 0.2],
      [0.5, 0.5, 0.5],
      options.emissiveColor || [0.2, 0.1, 0],
      30,
    );

    // 机身
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'cylinder' });
    if (body.model) body.model.material = mat;
    body.setLocalScale(0.5 * scale, 1.5 * scale, 0.5 * scale);
    body.setLocalEulerAngles(90, 0, 0);
    enemy.addChild(body);

    // 驾驶舱
    const cockpit = new pc.Entity('cockpit');
    cockpit.addComponent('model', { type: 'sphere' });
    if (cockpit.model)
      cockpit.model.material = this.createMaterial(
        [0.2, 0.1, 0.05],
        [0.3, 0.3, 0.3],
        [0.1, 0.05, 0],
        50,
      );
    cockpit.setLocalPosition(0, 0.2 * scale, 0.3 * scale);
    cockpit.setLocalScale(0.25 * scale, 0.2 * scale, 0.3 * scale);
    enemy.addChild(cockpit);

    // 翼
    for (const side of [-1, 1]) {
      const wing = new pc.Entity(`wing_${side}`);
      wing.addComponent('model', { type: 'box' });
      if (wing.model) wing.model.material = mat;
      wing.setLocalPosition(side * 0.6 * scale, -0.1 * scale, 0);
      wing.setLocalScale(0.8 * scale, 0.08 * scale, 0.8 * scale);
      enemy.addChild(wing);
    }

    // 引擎
    const engine = new pc.Entity('engine');
    engine.addComponent('model', { type: 'cylinder' });
    if (engine.model) engine.model.material = this.createEmissiveMaterial([1.0, 0.5, 0.1], 1.5);
    engine.setLocalPosition(0, 0, -0.8 * scale);
    engine.setLocalScale(0.2 * scale, 0.2 * scale, 0.2 * scale);
    engine.setLocalEulerAngles(90, 0, 0);
    enemy.addChild(engine);

    return enemy;
  }

  private createEnemyBomber(options: ModelOptions = {}): pc.Entity {
    const enemy = new pc.Entity('enemy_bomber');
    const scale = options.scale || 1.2;
    const mat = this.createMaterial(
      options.primaryColor || [0.5, 0.3, 0.1],
      [0.4, 0.4, 0.4],
      [0.1, 0.05, 0],
      20,
    );

    // 宽机身
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'box' });
    if (body.model) body.model.material = mat;
    body.setLocalScale(1.2 * scale, 0.5 * scale, 1.5 * scale);
    enemy.addChild(body);

    // 弹舱
    const bombBay = new pc.Entity('bombBay');
    bombBay.addComponent('model', { type: 'box' });
    if (bombBay.model)
      bombBay.model.material = this.createMaterial([0.1, 0.1, 0.1], [0.2, 0.2, 0.2], [0, 0, 0], 10);
    bombBay.setLocalPosition(0, -0.3 * scale, 0);
    bombBay.setLocalScale(0.5 * scale, 0.3 * scale, 0.8 * scale);
    enemy.addChild(bombBay);

    // 双引擎
    for (const side of [-1, 1]) {
      const engine = new pc.Entity(`engine_${side}`);
      engine.addComponent('model', { type: 'cylinder' });
      if (engine.model) engine.model.material = this.createEmissiveMaterial([1.0, 0.3, 0], 1.5);
      engine.setLocalPosition(side * 0.4 * scale, 0, -0.8 * scale);
      engine.setLocalScale(0.2 * scale, 0.2 * scale, 0.2 * scale);
      engine.setLocalEulerAngles(90, 0, 0);
      enemy.addChild(engine);
    }

    return enemy;
  }

  private createEnemyTank(options: ModelOptions = {}): pc.Entity {
    const enemy = new pc.Entity('enemy_tank');
    const scale = options.scale || 1.5;
    const mat = this.createMaterial(
      options.primaryColor || [0.4, 0.4, 0.45],
      [0.3, 0.3, 0.3],
      [0.05, 0.05, 0.05],
      10,
    );

    // 重型机身
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'box' });
    if (body.model) body.model.material = mat;
    body.setLocalScale(1.5 * scale, 1.0 * scale, 2.0 * scale);
    enemy.addChild(body);

    // 装甲板
    const armor = new pc.Entity('armor');
    armor.addComponent('model', { type: 'box' });
    if (armor.model)
      armor.model.material = this.createMaterial([0.2, 0.2, 0.25], [0.2, 0.2, 0.2], [0, 0, 0], 5);
    armor.setLocalPosition(0, 0.6 * scale, 0);
    armor.setLocalScale(1.6 * scale, 0.3 * scale, 2.1 * scale);
    enemy.addChild(armor);

    // 主炮塔
    const turret = this.createTurret(scale, mat);
    turret.setLocalPosition(0, 0.8 * scale, 0);
    enemy.addChild(turret);

    // 副炮塔
    for (const side of [-1, 1]) {
      const subTurret = this.createTurret(scale * 0.6, mat);
      subTurret.setLocalPosition(side * 0.6 * scale, 0.7 * scale, -0.5 * scale);
      enemy.addChild(subTurret);
    }

    return enemy;
  }

  private createEnemyAssassin(options: ModelOptions = {}): pc.Entity {
    const enemy = new pc.Entity('enemy_assassin');
    const scale = options.scale || 0.9;
    const mat = this.createMaterial(
      options.primaryColor || [0.6, 0.3, 1.0],
      [0.4, 0.4, 0.4],
      [0.3, 0.1, 0.5],
      80,
    );

    // 锐利机身
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'cone' });
    if (body.model) body.model.material = mat;
    body.setLocalScale(0.35 * scale, 2.0 * scale, 0.35 * scale);
    body.setLocalEulerAngles(-90, 0, 0);
    enemy.addChild(body);

    // 后掠翼
    for (const side of [-1, 1]) {
      const wing = new pc.Entity(`wing_${side}`);
      wing.addComponent('model', { type: 'box' });
      if (wing.model) wing.model.material = mat;
      wing.setLocalPosition(side * 0.5 * scale, -0.1 * scale, -0.3 * scale);
      wing.setLocalScale(0.8 * scale, 0.05 * scale, 0.6 * scale);
      wing.setLocalEulerAngles(0, side * 20, 0);
      enemy.addChild(wing);
    }

    // 隐形装置
    const cloak = new pc.Entity('cloak');
    cloak.addComponent('model', { type: 'sphere' });
    if (cloak.model) cloak.model.material = this.createGlassMaterial([0.5, 0.2, 0.8]);
    cloak.setLocalScale(1.5 * scale, 0.4 * scale, 1.2 * scale);
    enemy.addChild(cloak);

    // 引擎
    const engine = new pc.Entity('engine');
    engine.addComponent('model', { type: 'cylinder' });
    if (engine.model) engine.model.material = this.createEmissiveMaterial([0.5, 0.1, 0.8], 2.0);
    engine.setLocalPosition(0, 0, -1.0 * scale);
    engine.setLocalScale(0.15 * scale, 0.2 * scale, 0.15 * scale);
    engine.setLocalEulerAngles(90, 0, 0);
    enemy.addChild(engine);

    return enemy;
  }

  private createEnemyDrone(options: ModelOptions = {}): pc.Entity {
    const enemy = new pc.Entity('enemy_drone');
    const scale = options.scale || 0.6;
    const mat = this.createMaterial(
      options.primaryColor || [0.3, 0.3, 0.35],
      [0.4, 0.4, 0.4],
      [0.1, 0.1, 0.15],
      50,
    );

    // 球形主体
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'sphere' });
    if (body.model) body.model.material = mat;
    body.setLocalScale(0.5 * scale, 0.5 * scale, 0.5 * scale);
    enemy.addChild(body);

    // 旋翼/推进器 × 4
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const prop = new pc.Entity(`prop_${i}`);
      prop.addComponent('model', { type: 'cylinder' });
      if (prop.model) prop.model.material = this.createEmissiveMaterial([0.2, 0.5, 1.0], 1.0);
      prop.setLocalPosition(
        Math.cos(angle) * 0.4 * scale,
        0.3 * scale,
        Math.sin(angle) * 0.4 * scale,
      );
      prop.setLocalScale(0.1 * scale, 0.15 * scale, 0.1 * scale);
      enemy.addChild(prop);
    }

    // 眼睛/传感器
    const eye = new pc.Entity('eye');
    eye.addComponent('model', { type: 'sphere' });
    if (eye.model) eye.model.material = this.createEmissiveMaterial([1.0, 0.1, 0.1], 1.5);
    eye.setLocalPosition(0, -0.1 * scale, 0.3 * scale);
    eye.setLocalScale(0.12 * scale, 0.12 * scale, 0.12 * scale);
    enemy.addChild(eye);

    return enemy;
  }

  private createEnemyCorvette(options: ModelOptions = {}): pc.Entity {
    const enemy = new pc.Entity('enemy_corvette');
    const scale = options.scale || 1.3;
    const mat = this.createMaterial(
      options.primaryColor || [0.3, 0.4, 0.5],
      [0.4, 0.4, 0.4],
      [0.05, 0.1, 0.15],
      30,
    );

    // 主体
    const hull = new pc.Entity('hull');
    hull.addComponent('model', { type: 'cylinder' });
    if (hull.model) hull.model.material = mat;
    hull.setLocalScale(0.7 * scale, 2.5 * scale, 0.7 * scale);
    hull.setLocalEulerAngles(90, 0, 0);
    enemy.addChild(hull);

    // 侧翼
    for (const side of [-1, 1]) {
      const wing = new pc.Entity(`wing_${side}`);
      wing.addComponent('model', { type: 'box' });
      if (wing.model) wing.model.material = mat;
      wing.setLocalPosition(side * 0.9 * scale, 0, 0);
      wing.setLocalScale(0.7 * scale, 0.12 * scale, 1.5 * scale);
      enemy.addChild(wing);
    }

    // 炮塔
    const turret = this.createTurret(scale * 0.7, mat);
    turret.setLocalPosition(0, 0.6 * scale, 0.3 * scale);
    enemy.addChild(turret);

    // 引擎
    for (const side of [-1, 1]) {
      const engine = new pc.Entity(`engine_${side}`);
      engine.addComponent('model', { type: 'cylinder' });
      if (engine.model) engine.model.material = this.createEmissiveMaterial([0.3, 0.6, 1.0], 1.5);
      engine.setLocalPosition(side * 0.3 * scale, 0, -1.3 * scale);
      engine.setLocalScale(0.18 * scale, 0.18 * scale, 0.18 * scale);
      engine.setLocalEulerAngles(90, 0, 0);
      enemy.addChild(engine);
    }

    return enemy;
  }

  private createEnemyDestroyer(options: ModelOptions = {}): pc.Entity {
    const enemy = new pc.Entity('enemy_destroyer');
    const scale = options.scale || 1.8;
    const mat = this.createMaterial(
      options.primaryColor || [0.25, 0.25, 0.3],
      [0.3, 0.3, 0.3],
      [0.05, 0.05, 0.1],
      20,
    );

    // 大型机身
    const hull = new pc.Entity('hull');
    hull.addComponent('model', { type: 'box' });
    if (hull.model) hull.model.material = mat;
    hull.setLocalScale(2 * scale, 0.8 * scale, 3 * scale);
    enemy.addChild(hull);

    // 舰首
    const bow = new pc.Entity('bow');
    bow.addComponent('model', { type: 'cone' });
    if (bow.model) bow.model.material = mat;
    bow.setLocalScale(1.5 * scale, 0.8 * scale, 1.5 * scale);
    bow.setLocalPosition(0, 0, 2 * scale);
    bow.setLocalEulerAngles(-90, 0, 0);
    enemy.addChild(bow);

    // 炮塔群
    const positions = [
      [0, 0.6, 1],
      [-1, 0.5, 0],
      [1, 0.5, 0],
      [0, 0.6, -1],
    ];
    positions.forEach((pos) => {
      const turret = this.createTurret(scale * 0.8, mat);
      turret.setLocalPosition(pos[0] * scale, pos[1] * scale, pos[2] * scale);
      enemy.addChild(turret);
    });

    // 引擎群
    for (let i = -1; i <= 1; i++) {
      const engine = new pc.Entity(`engine_${i}`);
      engine.addComponent('model', { type: 'cylinder' });
      if (engine.model) engine.model.material = this.createEmissiveMaterial([1.0, 0.4, 0.1], 2.0);
      engine.setLocalPosition(i * 0.5 * scale, 0, -1.7 * scale);
      engine.setLocalScale(0.22 * scale, 0.25 * scale, 0.22 * scale);
      engine.setLocalEulerAngles(90, 0, 0);
      enemy.addChild(engine);
    }

    return enemy;
  }

  // ============ Boss模型 ============

  private createBossSentinel(options: ModelOptions = {}): pc.Entity {
    const boss = new pc.Entity('boss_sentinel');
    const scale = options.scale || 3;
    const mat = this.createMaterial(
      options.primaryColor || [0.5, 0.2, 0.2],
      [0.4, 0.4, 0.4],
      [0.3, 0.1, 0.1],
      30,
    );

    // 核心球体
    const core = new pc.Entity('core');
    core.addComponent('model', { type: 'sphere' });
    if (core.model) core.model.material = this.createEmissiveMaterial([1.0, 0.2, 0.2], 3.0);
    core.setLocalScale(1.5 * scale, 1.5 * scale, 1.5 * scale);
    boss.addChild(core);

    // 外壳环
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const shell = new pc.Entity(`shell_${i}`);
      shell.addComponent('model', { type: 'box' });
      if (shell.model) shell.model.material = mat;
      shell.setLocalPosition(Math.cos(angle) * 2 * scale, 0, Math.sin(angle) * 2 * scale);
      shell.setLocalScale(1.5 * scale, 0.8 * scale, 0.5 * scale);
      shell.setLocalEulerAngles(0, (-angle * 180) / Math.PI, 0);
      boss.addChild(shell);
    }

    // 武器臂
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const arm = new pc.Entity(`arm_${i}`);
      arm.addComponent('model', { type: 'cylinder' });
      if (arm.model) arm.model.material = mat;
      arm.setLocalPosition(Math.cos(angle) * 2.5 * scale, 0, Math.sin(angle) * 2.5 * scale);
      arm.setLocalScale(0.3 * scale, 1.5 * scale, 0.3 * scale);
      arm.setLocalEulerAngles(90, 0, 0);
      boss.addChild(arm);

      // 武器尖端
      const tip = new pc.Entity(`tip_${i}`);
      tip.addComponent('model', { type: 'sphere' });
      if (tip.model) tip.model.material = this.createEmissiveMaterial([1.0, 0.1, 0.1], 2.0);
      tip.setLocalPosition(Math.cos(angle) * 3.2 * scale, 0, Math.sin(angle) * 3.2 * scale);
      tip.setLocalScale(0.35 * scale, 0.35 * scale, 0.35 * scale);
      boss.addChild(tip);
    }

    return boss;
  }

  private createBossOverlord(options: ModelOptions = {}): pc.Entity {
    const boss = new pc.Entity('boss_overlord');
    const scale = options.scale || 4;
    const mat = this.createMaterial(
      options.primaryColor || [0.3, 0.0, 0.3],
      [0.5, 0.5, 0.5],
      [0.4, 0.1, 0.5],
      40,
    );

    // 中央核心
    const core = new pc.Entity('core');
    core.addComponent('model', { type: 'sphere' });
    if (core.model) core.model.material = this.createEmissiveMaterial([0.8, 0.2, 1.0], 4.0);
    core.setLocalScale(2 * scale, 2 * scale, 2 * scale);
    boss.addChild(core);

    // 外环 × 3
    for (let ring = 0; ring < 3; ring++) {
      const ringRadius = (2.5 + ring * 0.8) * scale;
      const segmentCount = 8 + ring * 4;
      for (let i = 0; i < segmentCount; i++) {
        const angle = (i / segmentCount) * Math.PI * 2;
        const seg = new pc.Entity(`ring_${ring}_seg_${i}`);
        seg.addComponent('model', { type: 'box' });
        if (seg.model) seg.model.material = mat;
        seg.setLocalPosition(
          Math.cos(angle) * ringRadius,
          Math.sin(ring * 0.5) * 0.5 * scale,
          Math.sin(angle) * ringRadius,
        );
        seg.setLocalScale(0.6 * scale, 0.4 * scale, 0.6 * scale);
        seg.setLocalEulerAngles(0, (-angle * 180) / Math.PI, 0);
        boss.addChild(seg);
      }
    }

    // 能量柱
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pillar = new pc.Entity(`pillar_${i}`);
      pillar.addComponent('model', { type: 'cylinder' });
      if (pillar.model) pillar.model.material = this.createEmissiveMaterial([0.5, 0.1, 0.8], 2.5);
      pillar.setLocalPosition(Math.cos(angle) * 4 * scale, 0, Math.sin(angle) * 4 * scale);
      pillar.setLocalScale(0.3 * scale, 3 * scale, 0.3 * scale);
      boss.addChild(pillar);
    }

    return boss;
  }

  // ============ 建筑模型 ============

  public createStructure(type: StructureModelType, options: ModelOptions = {}): pc.Entity {
    switch (type) {
      case 'space_station':
        return this.createSpaceStation(options);
      case 'asteroid':
        return this.createAsteroid(options);
      case 'debris':
        return this.createDebris(options);
      case 'satellite':
        return this.createSatellite(options);
      case 'mining_rig':
        return this.createMiningRig(options);
      case 'defense_platform':
        return this.createDefensePlatform(options);
      default:
        return this.createSpaceStation(options);
    }
  }

  private createSpaceStation(options: ModelOptions = {}): pc.Entity {
    const station = new pc.Entity('space_station');
    const scale = options.scale || 2;
    const mat = this.createMaterial(
      options.primaryColor || [0.4, 0.4, 0.5],
      [0.5, 0.5, 0.5],
      [0.1, 0.1, 0.2],
      30,
    );

    // 中央塔
    const tower = new pc.Entity('tower');
    tower.addComponent('model', { type: 'cylinder' });
    if (tower.model) tower.model.material = mat;
    tower.setLocalScale(1 * scale, 3 * scale, 1 * scale);
    station.addChild(tower);

    // 环形结构 × 2
    for (let r = 0; r < 2; r++) {
      const radius = (2 + r * 1.5) * scale;
      const segments = 12;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const seg = new pc.Entity(`ring_${r}_${i}`);
        seg.addComponent('model', { type: 'box' });
        if (seg.model) seg.model.material = mat;
        seg.setLocalPosition(Math.cos(angle) * radius, (r - 0.5) * scale, Math.sin(angle) * radius);
        seg.setLocalScale(0.8 * scale, 0.3 * scale, 0.8 * scale);
        seg.setLocalEulerAngles(0, (-angle * 180) / Math.PI, 0);
        station.addChild(seg);
      }
    }

    // 对接口
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const dock = new pc.Entity(`dock_${i}`);
      dock.addComponent('model', { type: 'cylinder' });
      if (dock.model) dock.model.material = mat;
      dock.setLocalPosition(Math.cos(angle) * 3.5 * scale, 0, Math.sin(angle) * 3.5 * scale);
      dock.setLocalScale(0.5 * scale, 0.8 * scale, 0.5 * scale);
      dock.setLocalEulerAngles(0, 0, 90);
      station.addChild(dock);
    }

    // 信号灯
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const light = new pc.Entity(`light_${i}`);
      light.addComponent('model', { type: 'sphere' });
      if (light.model)
        light.model.material = this.createEmissiveMaterial(
          i % 2 === 0 ? [1.0, 0.3, 0.1] : [0.1, 1.0, 0.3],
          2.0,
        );
      light.setLocalPosition(Math.cos(angle) * 2 * scale, 1.5 * scale, Math.sin(angle) * 2 * scale);
      light.setLocalScale(0.15 * scale, 0.15 * scale, 0.15 * scale);
      station.addChild(light);
    }

    return station;
  }

  private createAsteroid(options: ModelOptions = {}): pc.Entity {
    const asteroid = new pc.Entity('asteroid');
    const scale = options.scale || 1;
    const mat = this.createMaterial(
      options.primaryColor || [0.3, 0.28, 0.25],
      [0.2, 0.2, 0.2],
      [0, 0, 0],
      5,
    );

    // 不规则形状 - 使用多个球体组合
    const core = new pc.Entity('core');
    core.addComponent('model', { type: 'sphere' });
    if (core.model) core.model.material = mat;
    core.setLocalScale(1.5 * scale, 1.2 * scale, 1.4 * scale);
    asteroid.addChild(core);

    // 凸起
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const bump = new pc.Entity(`bump_${i}`);
      bump.addComponent('model', { type: 'sphere' });
      if (bump.model) bump.model.material = mat;
      bump.setLocalPosition(
        Math.cos(angle) * 0.8 * scale,
        (Math.random() - 0.5) * 0.8 * scale,
        Math.sin(angle) * 0.8 * scale,
      );
      bump.setLocalScale(0.5 * scale, 0.4 * scale, 0.6 * scale);
      asteroid.addChild(bump);
    }

    return asteroid;
  }

  private createDebris(options: ModelOptions = {}): pc.Entity {
    const debris = new pc.Entity('debris');
    const scale = options.scale || 0.5;
    const mat = this.createMaterial(
      options.primaryColor || [0.2, 0.2, 0.2],
      [0.1, 0.1, 0.1],
      [0, 0, 0],
      5,
    );

    // 随机碎片
    for (let i = 0; i < 4; i++) {
      const piece = new pc.Entity(`piece_${i}`);
      const types = ['box', 'cylinder', 'cone'] as const;
      piece.addComponent('model', { type: types[i % 3] });
      if (piece.model) piece.model.material = mat;
      piece.setLocalPosition(
        (Math.random() - 0.5) * scale,
        (Math.random() - 0.5) * scale,
        (Math.random() - 0.5) * scale,
      );
      piece.setLocalScale(0.3 * scale, 0.4 * scale, 0.2 * scale);
      piece.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
      debris.addChild(piece);
    }

    return debris;
  }

  private createSatellite(options: ModelOptions = {}): pc.Entity {
    const satellite = new pc.Entity('satellite');
    const scale = options.scale || 0.8;
    const mat = this.createMaterial(
      options.primaryColor || [0.5, 0.5, 0.5],
      [0.6, 0.6, 0.6],
      [0.1, 0.1, 0.1],
      40,
    );

    // 主体
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'box' });
    if (body.model) body.model.material = mat;
    body.setLocalScale(0.8 * scale, 0.6 * scale, 0.8 * scale);
    satellite.addChild(body);

    // 太阳能板
    for (const side of [-1, 1]) {
      const panel = new pc.Entity(`panel_${side}`);
      panel.addComponent('model', { type: 'box' });
      if (panel.model)
        panel.model.material = this.createMaterial(
          [0.1, 0.1, 0.3],
          [0.3, 0.3, 0.3],
          [0.05, 0.05, 0.2],
          60,
        );
      panel.setLocalPosition(side * 1.2 * scale, 0, 0);
      panel.setLocalScale(1.5 * scale, 0.05 * scale, 0.8 * scale);
      satellite.addChild(panel);
    }

    // 天线
    const antenna = new pc.Entity('antenna');
    antenna.addComponent('model', { type: 'cone' });
    if (antenna.model) antenna.model.material = mat;
    antenna.setLocalPosition(0, 0.5 * scale, 0);
    antenna.setLocalScale(0.1 * scale, 0.6 * scale, 0.1 * scale);
    satellite.addChild(antenna);

    // 信号灯
    const light = new pc.Entity('light');
    light.addComponent('model', { type: 'sphere' });
    if (light.model) light.model.material = this.createEmissiveMaterial([0.1, 1.0, 0.1], 1.5);
    light.setLocalPosition(0, -0.4 * scale, 0);
    light.setLocalScale(0.1 * scale, 0.1 * scale, 0.1 * scale);
    satellite.addChild(light);

    return satellite;
  }

  private createMiningRig(options: ModelOptions = {}): pc.Entity {
    const rig = new pc.Entity('mining_rig');
    const scale = options.scale || 1.5;
    const mat = this.createMaterial(
      options.primaryColor || [0.35, 0.3, 0.2],
      [0.3, 0.3, 0.3],
      [0.1, 0.08, 0.02],
      15,
    );

    // 平台
    const platform = new pc.Entity('platform');
    platform.addComponent('model', { type: 'cylinder' });
    if (platform.model) platform.model.material = mat;
    platform.setLocalScale(2 * scale, 0.3 * scale, 2 * scale);
    rig.addChild(platform);

    // 钻头
    const drill = new pc.Entity('drill');
    drill.addComponent('model', { type: 'cone' });
    if (drill.model)
      drill.model.material = this.createMaterial([0.5, 0.5, 0.5], [0.6, 0.6, 0.6], [0, 0, 0], 80);
    drill.setLocalPosition(0, -1 * scale, 0);
    drill.setLocalScale(0.5 * scale, 1.5 * scale, 0.5 * scale);
    drill.setLocalEulerAngles(180, 0, 0);
    rig.addChild(drill);

    // 支撑柱
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pillar = new pc.Entity(`pillar_${i}`);
      pillar.addComponent('model', { type: 'cylinder' });
      if (pillar.model) pillar.model.material = mat;
      pillar.setLocalPosition(
        Math.cos(angle) * 1.3 * scale,
        0.5 * scale,
        Math.sin(angle) * 1.3 * scale,
      );
      pillar.setLocalScale(0.15 * scale, 1.5 * scale, 0.15 * scale);
      rig.addChild(pillar);
    }

    return rig;
  }

  private createDefensePlatform(options: ModelOptions = {}): pc.Entity {
    const platform = new pc.Entity('defense_platform');
    const scale = options.scale || 1.5;
    const mat = this.createMaterial(
      options.primaryColor || [0.3, 0.35, 0.4],
      [0.4, 0.4, 0.4],
      [0.05, 0.1, 0.15],
      25,
    );

    // 基座
    const base = new pc.Entity('base');
    base.addComponent('model', { type: 'cylinder' });
    if (base.model) base.model.material = mat;
    base.setLocalScale(2 * scale, 0.5 * scale, 2 * scale);
    platform.addChild(base);

    // 中央炮塔
    const turret = this.createTurret(scale * 1.5, mat);
    turret.setLocalPosition(0, 0.5 * scale, 0);
    platform.addChild(turret);

    // 副炮塔
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const sub = this.createTurret(scale * 0.7, mat);
      sub.setLocalPosition(
        Math.cos(angle) * 1.3 * scale,
        0.4 * scale,
        Math.sin(angle) * 1.3 * scale,
      );
      platform.addChild(sub);
    }

    // 雷达
    const radar = new pc.Entity('radar');
    radar.addComponent('model', { type: 'box' });
    if (radar.model)
      radar.model.material = this.createMaterial(
        [0.1, 0.2, 0.1],
        [0.3, 0.3, 0.3],
        [0.05, 0.1, 0.05],
        50,
      );
    radar.setLocalPosition(0, 1.5 * scale, 0);
    radar.setLocalScale(0.6 * scale, 0.05 * scale, 1.2 * scale);
    platform.addChild(radar);

    return platform;
  }

  // ============ 辅助方法 ============

  private createWing(
    name: string,
    side: number,
    hullMat: pc.StandardMaterial,
    accentMat: pc.StandardMaterial,
    scale: number,
  ): pc.Entity {
    const wing = new pc.Entity(name);

    const mainWing = new pc.Entity('mainWing');
    mainWing.addComponent('model', { type: 'box' });
    if (mainWing.model) mainWing.model.material = hullMat;
    mainWing.setLocalPosition(side * 0.8 * scale, -0.1 * scale, 0);
    mainWing.setLocalScale(1.2 * scale, 0.08 * scale, 1.3 * scale);
    wing.addChild(mainWing);

    const wingtip = new pc.Entity('wingtip');
    wingtip.addComponent('model', { type: 'box' });
    if (wingtip.model) wingtip.model.material = accentMat;
    wingtip.setLocalPosition(side * 1.4 * scale, -0.1 * scale, 0.4 * scale);
    wingtip.setLocalScale(0.3 * scale, 0.06 * scale, 0.5 * scale);
    wing.addChild(wingtip);

    const navLight = new pc.Entity('navLight');
    navLight.addComponent('model', { type: 'sphere' });
    if (navLight.model)
      navLight.model.material = this.createEmissiveMaterial(
        side < 0 ? [1.0, 0.1, 0.1] : [0.1, 1.0, 0.1],
        1.5,
      );
    navLight.setLocalPosition(side * 1.5 * scale, -0.1 * scale, 0.4 * scale);
    navLight.setLocalScale(0.08 * scale, 0.08 * scale, 0.08 * scale);
    wing.addChild(navLight);

    return wing;
  }

  private createWeaponMount(side: number, scale: number, mat: pc.StandardMaterial): pc.Entity {
    const mount = new pc.Entity(`weaponMount_${side}`);

    const barrel = new pc.Entity('barrel');
    barrel.addComponent('model', { type: 'cylinder' });
    if (barrel.model) barrel.model.material = mat;
    barrel.setLocalPosition(side * scale, 0, -0.8 * scale);
    barrel.setLocalScale(0.06 * scale, 0.8 * scale, 0.06 * scale);
    barrel.setLocalEulerAngles(90, 0, 0);
    mount.addChild(barrel);

    const muzzle = new pc.Entity('muzzle');
    muzzle.addComponent('model', { type: 'sphere' });
    if (muzzle.model) muzzle.model.material = this.createEmissiveMaterial([0.2, 0.6, 1.0], 0.5);
    muzzle.setLocalPosition(side * scale, 0, -1.2 * scale);
    muzzle.setLocalScale(0.05 * scale, 0.05 * scale, 0.05 * scale);
    mount.addChild(muzzle);

    return mount;
  }

  private createTurret(scale: number, mat: pc.StandardMaterial): pc.Entity {
    const turret = new pc.Entity('turret');

    const base = new pc.Entity('base');
    base.addComponent('model', { type: 'cylinder' });
    if (base.model) base.model.material = mat;
    base.setLocalScale(0.3 * scale, 0.2 * scale, 0.3 * scale);
    turret.addChild(base);

    const housing = new pc.Entity('housing');
    housing.addComponent('model', { type: 'box' });
    if (housing.model) housing.model.material = mat;
    housing.setLocalPosition(0, 0.15 * scale, 0);
    housing.setLocalScale(0.4 * scale, 0.25 * scale, 0.4 * scale);
    turret.addChild(housing);

    const barrel = new pc.Entity('barrel');
    barrel.addComponent('model', { type: 'cylinder' });
    if (barrel.model) barrel.model.material = mat;
    barrel.setLocalPosition(0, 0.2 * scale, 0.3 * scale);
    barrel.setLocalScale(0.08 * scale, 0.5 * scale, 0.08 * scale);
    barrel.setLocalEulerAngles(90, 0, 0);
    turret.addChild(barrel);

    return turret;
  }

  private createMaterial(
    diffuse: [number, number, number],
    specular: [number, number, number],
    emissive: [number, number, number],
    shininess: number,
  ): pc.StandardMaterial {
    const mat = new pc.StandardMaterial();
    mat.diffuse.set(diffuse[0], diffuse[1], diffuse[2]);
    mat.specular.set(specular[0], specular[1], specular[2]);
    (mat as unknown as { shininess: number }).shininess = shininess;
    mat.emissive.set(emissive[0], emissive[1], emissive[2]);
    mat.update();
    return mat;
  }

  private createEmissiveMaterial(
    emissive: [number, number, number],
    intensity: number,
  ): pc.StandardMaterial {
    const mat = new pc.StandardMaterial();
    mat.diffuse.set(0, 0, 0);
    mat.specular.set(0, 0, 0);
    mat.emissive.set(emissive[0] * intensity, emissive[1] * intensity, emissive[2] * intensity);
    mat.update();
    return mat;
  }

  private createGlassMaterial(color: [number, number, number]): pc.StandardMaterial {
    const mat = new pc.StandardMaterial();
    mat.diffuse.set(color[0] * 0.3, color[1] * 0.3, color[2] * 0.3);
    mat.specular.set(0.9, 0.9, 0.9);
    (mat as unknown as { shininess: number }).shininess = 100;
    mat.emissive.set(color[0] * 0.2, color[1] * 0.2, color[2] * 0.2);
    (mat as unknown as { opacity: number }).opacity = 0.6;
    mat.blendType = pc.BLEND_NORMAL;
    mat.update();
    return mat;
  }

  // ============ 统一创建入口 ============

  public createShipModel(type: ShipModelType, options: ModelOptions = {}): pc.Entity {
    switch (type) {
      case 'fighter':
        return this.createFighterShip(options);
      case 'bomber':
        return this.createBomberShip(options);
      case 'cruiser':
        return this.createCruiserShip(options);
      case 'stealth':
        return this.createStealthShip(options);
      case 'corvette':
        return this.createCruiserShip(options);
      case 'dreadnought':
        return this.createDreadnoughtShip(options);
      default:
        return this.createFighterShip(options);
    }
  }
}
