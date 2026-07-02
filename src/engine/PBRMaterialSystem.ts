import * as pc from 'playcanvas';

export type MaterialType = 'metal' | 'energy' | 'glass' | 'plastic' | 'glow' | 'shield';

export interface MaterialConfig {
  baseColor?: pc.Color;
  roughness?: number;
  metalness?: number;
  emissive?: pc.Color;
  emissiveIntensity?: number;
  transparency?: number;
  opacityMap?: pc.Texture;
  normalMap?: pc.Texture;
  roughnessMap?: pc.Texture;
  metalnessMap?: pc.Texture;
}

export class PBRMaterialSystem {
  private app: pc.Application;
  private materials: Map<string, pc.StandardMaterial> = new Map();

  constructor(app: pc.Application) {
    this.app = app;
  }

  public createMaterial(
    name: string,
    type: MaterialType,
    config?: MaterialConfig,
  ): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.name = name;

    switch (type) {
      case 'metal':
        this.setupMetalMaterial(material, config);
        break;
      case 'energy':
        this.setupEnergyMaterial(material, config);
        break;
      case 'glass':
        this.setupGlassMaterial(material, config);
        break;
      case 'plastic':
        this.setupPlasticMaterial(material, config);
        break;
      case 'glow':
        this.setupGlowMaterial(material, config);
        break;
      case 'shield':
        this.setupShieldMaterial(material, config);
        break;
    }

    material.update();
    this.materials.set(name, material);

    return material;
  }

  private setupMetalMaterial(material: pc.StandardMaterial, config?: MaterialConfig): void {
    material.diffuse.set(
      config?.baseColor?.r || 0.6,
      config?.baseColor?.g || 0.6,
      config?.baseColor?.b || 0.7,
    );
    material.specular.set(0.9, 0.9, 0.9);
    // @ts-expect-error - shininess 可能不在类型定义中但在实际 API 中存在
    material.shininess = config?.metalness !== undefined ? 50 + config.metalness * 50 : 80;
    // @ts-expect-error - playcanvas API property not in type definitions
    material.gloss = config?.roughness !== undefined ? 1 - config.roughness : 0.8;
    material.emissive.set(
      config?.emissive?.r || 0.1,
      config?.emissive?.g || 0.1,
      config?.emissive?.b || 0.2,
    );

    if (config?.emissiveIntensity !== undefined) {
      // @ts-expect-error - playcanvas API property not in type definitions
      material.emissiveIntensity = config.emissiveIntensity;
    }
  }

  private setupEnergyMaterial(material: pc.StandardMaterial, config?: MaterialConfig): void {
    material.diffuse.set(
      config?.baseColor?.r || 0.2,
      config?.baseColor?.g || 0.5,
      config?.baseColor?.b || 1.0,
    );
    material.specular.set(1.0, 1.0, 1.0);
    // @ts-expect-error - playcanvas API property not in type definitions
    material.shininess = 100;
    // @ts-expect-error - playcanvas API property not in type definitions
    material.gloss = 1.0;
    material.emissive.set(
      config?.emissive?.r || 0.3,
      config?.emissive?.g || 0.7,
      config?.emissive?.b || 1.0,
    );
    // @ts-expect-error - playcanvas API property not in type definitions
    material.emissiveIntensity = config?.emissiveIntensity || 2.0;
    material.blendType = pc.BLEND_ADDITIVEALPHA;
  }

  private setupGlassMaterial(material: pc.StandardMaterial, config?: MaterialConfig): void {
    material.diffuse.set(
      config?.baseColor?.r || 0.1,
      config?.baseColor?.g || 0.3,
      config?.baseColor?.b || 0.5,
    );
    material.specular.set(0.9, 0.9, 0.9);
    // @ts-expect-error - playcanvas API property not in type definitions
    material.shininess = 100;
    // @ts-expect-error - playcanvas API property not in type definitions
    material.gloss = 0.9;
    // @ts-expect-error - playcanvas API property not in type definitions
    material.opacity = config?.transparency || 0.4;
    material.emissive.set(
      config?.emissive?.r || 0.1,
      config?.emissive?.g || 0.2,
      config?.emissive?.b || 0.4,
    );
    // @ts-expect-error - playcanvas API property not in type definitions
    material.cull = pc.CULLFACE_NONE;
    material.blendType = pc.BLEND_NORMAL;
  }

  private setupPlasticMaterial(material: pc.StandardMaterial, config?: MaterialConfig): void {
    material.diffuse.set(
      config?.baseColor?.r || 0.7,
      config?.baseColor?.g || 0.7,
      config?.baseColor?.b || 0.7,
    );
    material.specular.set(0.5, 0.5, 0.5);
    // @ts-expect-error - playcanvas API property not in type definitions
    material.shininess = 60;
    // @ts-expect-error - playcanvas API property not in type definitions
    material.gloss = 0.6;
    material.emissive.set(0, 0, 0);
  }

  private setupGlowMaterial(material: pc.StandardMaterial, config?: MaterialConfig): void {
    material.diffuse.set(
      config?.baseColor?.r || 1.0,
      config?.baseColor?.g || 0.8,
      config?.baseColor?.b || 0.2,
    );
    material.specular.set(1.0, 1.0, 1.0);
    // @ts-expect-error - playcanvas API property not in type definitions
    material.shininess = 100;
    // @ts-expect-error - playcanvas API property not in type definitions
    material.gloss = 1.0;
    material.emissive.set(
      config?.emissive?.r || 1.0,
      config?.emissive?.g || 0.8,
      config?.emissive?.b || 0.2,
    );
    // @ts-expect-error - playcanvas API property not in type definitions
    material.emissiveIntensity = config?.emissiveIntensity || 3.0;
    material.blendType = pc.BLEND_ADDITIVEALPHA;
  }

  private setupShieldMaterial(material: pc.StandardMaterial, config?: MaterialConfig): void {
    material.diffuse.set(
      config?.baseColor?.r || 0.1,
      config?.baseColor?.g || 0.4,
      config?.baseColor?.b || 0.8,
    );
    material.specular.set(1.0, 1.0, 1.0);
    // @ts-expect-error - playcanvas API property not in type definitions
    material.shininess = 100;
    // @ts-expect-error - playcanvas API property not in type definitions
    material.gloss = 1.0;
    // @ts-expect-error - playcanvas API property not in type definitions
    material.opacity = config?.transparency || 0.3;
    material.emissive.set(
      config?.emissive?.r || 0.2,
      config?.emissive?.g || 0.6,
      config?.emissive?.b || 1.0,
    );
    // @ts-expect-error - playcanvas API property not in type definitions
    material.emissiveIntensity = config?.emissiveIntensity || 1.5;
    // @ts-expect-error - playcanvas API property not in type definitions
    material.cull = pc.CULLFACE_NONE;
    material.blendType = pc.BLEND_ADDITIVEALPHA;
  }

  public getMaterial(name: string): pc.StandardMaterial | undefined {
    return this.materials.get(name);
  }

  public removeMaterial(name: string): void {
    const material = this.materials.get(name);
    if (material) {
      // @ts-expect-error - dispose 方法可能在类型定义中未声明
      material.dispose();
      this.materials.delete(name);
    }
  }

  public createShipBodyMaterial(): pc.StandardMaterial {
    return this.createMaterial('shipBody', 'metal', {
      baseColor: new pc.Color(0.2, 0.5, 0.8),
      roughness: 0.3,
      metalness: 0.8,
      emissive: new pc.Color(0.1, 0.2, 0.4),
      emissiveIntensity: 0.5,
    });
  }

  public createShipCockpitMaterial(): pc.StandardMaterial {
    return this.createMaterial('shipCockpit', 'glass', {
      baseColor: new pc.Color(0.1, 0.4, 0.7),
      transparency: 0.35,
      emissive: new pc.Color(0.1, 0.3, 0.5),
    });
  }

  public createWeaponMaterial(): pc.StandardMaterial {
    return this.createMaterial('weapon', 'metal', {
      baseColor: new pc.Color(0.3, 0.3, 0.3),
      roughness: 0.2,
      metalness: 0.9,
    });
  }

  public createEngineMaterial(): pc.StandardMaterial {
    return this.createMaterial('engine', 'glow', {
      baseColor: new pc.Color(1.0, 0.6, 0.2),
      emissive: new pc.Color(1.0, 0.5, 0.1),
      emissiveIntensity: 2.5,
    });
  }

  public createShieldMaterial(): pc.StandardMaterial {
    return this.createMaterial('shield', 'shield', {
      baseColor: new pc.Color(0.1, 0.5, 1.0),
      transparency: 0.3,
      emissive: new pc.Color(0.2, 0.6, 1.0),
      emissiveIntensity: 2.0,
    });
  }

  public createProjectileMaterial(color: pc.Color): pc.StandardMaterial {
    return this.createMaterial(`projectile_${color.r}_${color.g}_${color.b}`, 'glow', {
      baseColor: color,
      emissive: color,
      emissiveIntensity: 3.0,
    });
  }

  public createEnemyMaterial(
    type: 'scout' | 'fighter' | 'tank' | 'elite' | 'boss',
  ): pc.StandardMaterial {
    switch (type) {
      case 'scout':
        return this.createMaterial('enemyScout', 'metal', {
          baseColor: new pc.Color(0.6, 0.8, 0.6),
          roughness: 0.4,
          metalness: 0.7,
        });
      case 'fighter':
        return this.createMaterial('enemyFighter', 'metal', {
          baseColor: new pc.Color(0.8, 0.6, 0.4),
          roughness: 0.3,
          metalness: 0.8,
        });
      case 'tank':
        return this.createMaterial('enemyTank', 'metal', {
          baseColor: new pc.Color(0.6, 0.6, 0.6),
          roughness: 0.2,
          metalness: 0.9,
        });
      case 'elite':
        return this.createMaterial('enemyElite', 'energy', {
          baseColor: new pc.Color(0.6, 0.3, 1.0),
          emissive: new pc.Color(0.8, 0.5, 1.0),
          emissiveIntensity: 1.5,
        });
      case 'boss':
        return this.createMaterial('enemyBoss', 'energy', {
          baseColor: new pc.Color(1.0, 0.2, 0.4),
          emissive: new pc.Color(1.0, 0.3, 0.5),
          emissiveIntensity: 2.5,
        });
    }
  }

  public dispose(): void {
    // @ts-expect-error - dispose 方法可能在类型定义中未声明
    this.materials.forEach((material) => material.dispose());
    this.materials.clear();
  }
}
