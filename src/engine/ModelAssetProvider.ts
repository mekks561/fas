import * as pc from 'playcanvas';
import type { ShipModelType, EnemyModelType, StructureModelType } from './ProceduralModelGenerator';

/**
 * 真实模型资产提供器（GLB）
 *
 * 背景：在本次改造之前，游戏里的飞船/敌人模型由 ProceduralModelGenerator 用代码现算几何。
 * 仓库里虽然躺着 public/assets/models 下的 .glb，但它们：
 *   1) 由 generate-models.js 生成，GLB 头写错、chunk 头缺失 → 45/45 不是合法 GLB；
 *   2) 只有 12–32 个三角面，形同一个立方体。
 * 现在这批文件已由 scripts/fetch-kenney-models.mjs 换成 Kenney 的 CC0 真实模型。
 *
 * 本模块做的事：把 GLB 接进渲染。两条硬约束：
 *   - 加载是异步的，而 createPlayerShip / createEnemy 是同步的 → 采用「先占位、后替换」，
 *     不阻塞游戏启动；
 *   - 任何一步失败（文件缺失、解析失败、网络错误）都必须静默回落到程序化模型，游戏不能崩。
 */

/** 逻辑模型类型 → public/assets/models 下的相对路径（不含 .glb） */
const SHIP_FILES: Record<ShipModelType, string> = {
  fighter: 'ships/ship-fighter',
  bomber: 'ships/ship-bomber',
  cruiser: 'ships/ship-cruiser',
  stealth: 'ships/ship-stealth',
  corvette: 'ships/ship-corvette',
  dreadnought: 'ships/ship-dreadnought',
};

const ENEMY_FILES: Record<EnemyModelType, string> = {
  scout: 'enemies/enemy-scout',
  fighter: 'enemies/enemy-fighter',
  bomber: 'enemies/enemy-bomber',
  tank: 'enemies/enemy-tank',
  assassin: 'enemies/enemy-assassin',
  drone: 'enemies/enemy-drone',
  corvette: 'enemies/enemy-corvette',
  destroyer: 'enemies/enemy-destroyer',
  boss_sentinel: 'bosses/boss-sentinel',
  boss_overlord: 'bosses/boss-overlord',
};

/**
 * 结构物 → 候选 GLB 路径（不含 .glb）。
 *
 * 与飞船/敌人不同，结构物是「一个类型 → 多个变体」：小行星带一次要放 40 个，
 * 若全用同一个外壳会明显机械重复，因此这里给出一组候选，运行时随机取一个。
 *
 * 空数组表示「该类型暂无可替换素材」—— upgradeStructure 会直接返回，
 * 调用方保留程序化模型。debris / mining_rig / defense_platform 三个类型
 * 目前 createStructure 支持、但渲染路径上没有调用点，故不引入素材。
 */
const STRUCTURE_FILES: Record<StructureModelType, string[]> = {
  asteroid: [
    'structures/meteor',
    'structures/meteor_detailed',
    'structures/meteor_half',
    'structures/rock_largeA',
    'structures/rock_largeB',
    'structures/rock_crystalsLargeA',
    'structures/rock_crystalsLargeB',
    'structures/rocks_smallA',
    'structures/rocks_smallB',
  ],
  space_station: ['structures/station-hangar'],
  satellite: ['structures/satellite-dish'],
  debris: [],
  mining_rig: [],
  defense_platform: [],
};

/**
 * 尺寸换算：Kenney 的模型原始尺寸与原先程序化模型的尺度不同，需要按类别缩放。
 * 这几个值是配合渲染验证调出来的，改动后请重新跑一次画面验证。
 */
const SHIP_SCALE = 1.6;
const ENEMY_SCALE = 1.6;
const BOSS_SCALE = 3.0;

/**
 * 结构物基础缩放。结构物的最终大小由调用方决定（小行星带每个都不同），
 * 这里只做「Kenney 模型 ↔ 原程序化图元」的量级折算，调用方再乘自己的缩放。
 * 切换占位与真模型时若大小跳变明显，调这个值。
 */
const STRUCTURE_SCALE = 1.0;

/**
 * 朝向修正：不少 glTF 素材的「机头」指向与引擎默认的 +Z 不一致。
 * 若画面里飞船横着飞，就调这里的角度（单位：度）。
 */
const SHIP_YAW = 180;
const ENEMY_YAW = 180;
const BOSS_YAW = 180;

export interface AttachOptions {
  /** 战斗配色。会按「保持亮度」的方式叠到模型原有配色上，不会把模型压暗 */
  tint?: [number, number, number];
  /** 额外缩放，叠在类别默认缩放之上 */
  scaleMultiplier?: number;
  /** 绕 Y 轴的朝向修正（度） */
  yaw?: number;
}

/**
 * GLB 加载成功后 asset.resource 是容器资源（ContainerResource）。
 * 这里只声明我们真正用到的那一个方法，避免依赖引擎内部的类型导出细节。
 */
interface ContainerResourceLike {
  instantiateRenderEntity(): pc.Entity;
}

export class ModelAssetProvider {
  private app: pc.Application;
  /** 相对路径 → 加载中的 Promise（同一个模型只加载一次，多个敌人实例共享） */
  private pending = new Map<string, Promise<pc.Asset | null>>();
  /** 已经明确失败的路径，避免每个波次都重复报错刷屏 */
  private failed = new Set<string>();

  constructor(app: pc.Application) {
    this.app = app;
  }

  public static shipPath(type: ShipModelType): string {
    return SHIP_FILES[type];
  }

  public static enemyPath(type: EnemyModelType): string {
    return ENEMY_FILES[type];
  }

  public static shipScale(): number {
    return SHIP_SCALE;
  }

  public static enemyScale(): number {
    return ENEMY_SCALE;
  }

  public static bossScale(): number {
    return BOSS_SCALE;
  }

  public static shipYaw(): number {
    return SHIP_YAW;
  }

  public static enemyYaw(): number {
    return ENEMY_YAW;
  }

  public static bossYaw(): number {
    return BOSS_YAW;
  }

  public static structureScale(): number {
    return STRUCTURE_SCALE;
  }

  /** 该结构物类型是否有可替换素材。没有的话调用方不必包装实体、白跑一趟 */
  public static hasStructureModel(type: StructureModelType): boolean {
    return STRUCTURE_FILES[type].length > 0;
  }

  /**
   * 把 parent 下现有的程序化模型替换成真实 GLB 模型。
   *
   * 时序：立刻返回，程序化模型继续显示；GLB 加载好之后才做替换。
   * 替换前会再次确认占位模型还在 parent 下（防止期间已被销毁）。
   * 任何失败都只记一条警告，占位模型原样保留。
   */
  public upgrade(
    parent: pc.Entity,
    placeholder: pc.Entity,
    relPath: string,
    options: AttachOptions = {},
  ): void {
    if (this.failed.has(relPath)) return;

    void this.load(relPath).then((asset) => {
      if (!asset) {
        this.failed.add(relPath);
        console.warn(`[ModelAssetProvider] ${relPath}.glb 无法加载，保留程序化模型作为回落`);
        return;
      }
      // 占位模型可能已经被别的逻辑替换或随实体一起销毁了
      if (placeholder.parent !== parent) return;

      const instance = (asset.resource as ContainerResourceLike).instantiateRenderEntity();
      instance.name = `${relPath}-instance`;

      const scale = options.scaleMultiplier ?? 1;
      if (scale !== 1) instance.setLocalScale(scale, scale, scale);

      const yaw = options.yaw ?? 0;
      if (yaw !== 0) instance.setLocalEulerAngles(0, yaw, 0);

      if (options.tint) this.applyTint(instance, options.tint);

      parent.addChild(instance);
      placeholder.destroy();
      console.log(`[ModelAssetProvider] ${relPath}.glb 已替换程序化模型`);
    });
  }

  /**
   * 把 parent 下的程序化结构物替换成真实 GLB 模型。
   *
   * 与 upgrade 的差别只有一处：结构物是「一个类型对应多个候选外壳」，
   * 这里随机挑一个，好让 40 个小行星不至于长得一模一样。
   *
   * 任一候选失败只影响那一个文件，下次调用仍会尝试其它候选。
   */
  public upgradeStructure(
    parent: pc.Entity,
    placeholder: pc.Entity,
    type: StructureModelType,
    options: AttachOptions = {},
  ): void {
    const variants = STRUCTURE_FILES[type];
    if (variants.length === 0) return;

    const relPath = variants[Math.floor(Math.random() * variants.length)];
    this.upgrade(parent, placeholder, relPath, options);
  }

  /** 只加载，不做替换。用于需要在创建实体前就拿到资源的场景 */
  public load(relPath: string): Promise<pc.Asset | null> {
    const cached = this.pending.get(relPath);
    if (cached) return cached;

    const url = `/assets/models/${relPath}.glb`;
    const promise = new Promise<pc.Asset | null>((resolve) => {
      this.app.assets.loadFromUrl(url, 'container', (err, asset) => {
        if (err || !asset) {
          console.warn(`[ModelAssetProvider] 加载 ${url} 失败:`, err);
          resolve(null);
          return;
        }
        resolve(asset);
      });
    });

    this.pending.set(relPath, promise);
    return promise;
  }

  /**
   * 用某个颜色给整棵子树着色。
   *
   * 实现要点：不直接把材质颜色设成目标色（那会把模型的多材质层次压成一片死色），
   * 而是把目标色归一化到「最大通道 = 1」，再与材质原色相乘 ——
   * 这样既有派系配色，又保住原模型高光/舱盖/引擎口之间的明暗差异。
   */
  private applyTint(root: pc.Entity, tint: [number, number, number]): void {
    const maxChannel = Math.max(tint[0], tint[1], tint[2]) || 1;
    const k = [tint[0] / maxChannel, tint[1] / maxChannel, tint[2] / maxChannel];

    root.forEach((node: pc.GraphNode) => {
      const render = (node as pc.Entity).render;
      if (!render) return;
      for (const meshInstance of render.meshInstances) {
        const material = meshInstance.material as pc.StandardMaterial;
        const source = material.diffuse;
        if (!source) continue;
        const clone = material.clone() as pc.StandardMaterial;
        clone.diffuse = new pc.Color(
          Math.min(1, source.r * k[0]),
          Math.min(1, source.g * k[1]),
          Math.min(1, source.b * k[2]),
        );
        clone.update();
        meshInstance.material = clone;
      }
    });
  }
}
