export interface ExternalAsset {
  id: string;
  name: string;
  type: 'model' | 'texture' | 'audio' | 'config' | 'effect';
  url: string;
  size: number;
  format: string;
  lodVariants?: LODVariant[];
  platform?: 'web' | 'mobile' | 'desktop';
  dependencies?: string[];
  tags?: string[];
}

export interface LODVariant {
  level: number;
  url: string;
  size: number;
  quality: 'low' | 'medium' | 'high';
}

export interface AssetCategory {
  id: string;
  name: string;
  description: string;
  assets: ExternalAsset[];
  totalSize: number;
}

export interface ManifestMetadata {
  version: string;
  createdAt: string;
  totalSize: number;
  assetCount: number;
  categories: string[];
}

export class AssetManifest {
  private categories: Map<string, AssetCategory> = new Map();
  private metadata: ManifestMetadata | null = null;

  constructor() {
    this.initializeDefaultCategories();
  }

  async loadFromFile(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
      }
      const json = await response.text();
      this.importFromJSON(json);
    } catch (error) {
      console.warn('Failed to load external manifest, using default:', error);
      this.generateDefaultAssets();
    }
  }

  private initializeDefaultCategories(): void {
    this.categories.set('player-ships', {
      id: 'player-ships',
      name: 'Player Ships',
      description: '玩家飞船模型',
      assets: [],
      totalSize: 0
    });

    this.categories.set('enemies', {
      id: 'enemies',
      name: 'Enemies',
      description: '敌人单位模型',
      assets: [],
      totalSize: 0
    });

    this.categories.set('bosses', {
      id: 'bosses',
      name: 'Bosses',
      description: 'Boss模型',
      assets: [],
      totalSize: 0
    });

    this.categories.set('projectiles', {
      id: 'projectiles',
      name: 'Projectiles',
      description: '投射物模型',
      assets: [],
      totalSize: 0
    });

    this.categories.set('powerups', {
      id: 'powerups',
      name: 'Powerups',
      description: '道具模型',
      assets: [],
      totalSize: 0
    });

    this.categories.set('environment', {
      id: 'environment',
      name: 'Environment',
      description: '场景环境模型',
      assets: [],
      totalSize: 0
    });

    this.categories.set('textures-pbr', {
      id: 'textures-pbr',
      name: 'PBR Textures',
      description: 'PBR材质贴图',
      assets: [],
      totalSize: 0
    });

    this.categories.set('textures-environment', {
      id: 'textures-environment',
      name: 'Environment Maps',
      description: '环境贴图',
      assets: [],
      totalSize: 0
    });

    this.categories.set('textures-ui', {
      id: 'textures-ui',
      name: 'UI Textures',
      description: 'UI贴图',
      assets: [],
      totalSize: 0
    });

    this.categories.set('audio-bgm', {
      id: 'audio-bgm',
      name: 'BGM',
      description: '背景音乐',
      assets: [],
      totalSize: 0
    });

    this.categories.set('audio-sfx', {
      id: 'audio-sfx',
      name: 'Sound Effects',
      description: '音效',
      assets: [],
      totalSize: 0
    });

    this.categories.set('audio-voice', {
      id: 'audio-voice',
      name: 'Voice',
      description: '语音',
      assets: [],
      totalSize: 0
    });

    this.categories.set('levels', {
      id: 'levels',
      name: 'Levels',
      description: '关卡配置',
      assets: [],
      totalSize: 0
    });

    this.categories.set('effects', {
      id: 'effects',
      name: 'Effects',
      description: '特效配置',
      assets: [],
      totalSize: 0
    });

    this.categories.set('story', {
      id: 'story',
      name: 'Story',
      description: '剧情文本',
      assets: [],
      totalSize: 0
    });
  }

  addAsset(categoryId: string, asset: ExternalAsset): void {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category not found: ${categoryId}`);
    }

    category.assets.push(asset);
    category.totalSize += asset.size;
  }

  getCategory(categoryId: string): AssetCategory | undefined {
    return this.categories.get(categoryId);
  }

  getAllCategories(): AssetCategory[] {
    return Array.from(this.categories.values());
  }

  getAsset(assetId: string): ExternalAsset | undefined {
    for (const category of this.categories.values()) {
      const asset = category.assets.find(a => a.id === assetId);
      if (asset) return asset;
    }
    return undefined;
  }

  getAssetsByTag(tag: string): ExternalAsset[] {
    const result: ExternalAsset[] = [];
    for (const category of this.categories.values()) {
      result.push(...category.assets.filter(a => a.tags?.includes(tag)));
    }
    return result;
  }

  getAssetsByType(type: ExternalAsset['type']): ExternalAsset[] {
    const result: ExternalAsset[] = [];
    for (const category of this.categories.values()) {
      result.push(...category.assets.filter(a => a.type === type));
    }
    return result;
  }

  getTotalSize(): number {
    let total = 0;
    for (const category of this.categories.values()) {
      total += category.totalSize;
    }
    return total;
  }

  getAssetCount(): number {
    let count = 0;
    for (const category of this.categories.values()) {
      count += category.assets.length;
    }
    return count;
  }

  generateMetadata(): ManifestMetadata {
    this.metadata = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      totalSize: this.getTotalSize(),
      assetCount: this.getAssetCount(),
      categories: Array.from(this.categories.keys())
    };
    return this.metadata;
  }

  getMetadata(): ManifestMetadata | null {
    return this.metadata;
  }

  exportToJSON(): string {
    const data = {
      metadata: this.metadata || this.generateMetadata(),
      categories: Array.from(this.categories.values())
    };
    return JSON.stringify(data, null, 2);
  }

  importFromJSON(json: string): void {
    const data = JSON.parse(json);
    this.metadata = data.metadata;
    
    for (const category of data.categories) {
      this.categories.set(category.id, category);
    }
  }

  generateDefaultAssets(): void {
    this.generatePlayerShips();
    this.generateEnemies();
    this.generateBosses();
    this.generateTextures();
    this.generateAudio();
    this.generateLevels();
  }

  private generatePlayerShips(): void {
    const ships = [
      { id: 'ship-fighter', name: 'Fighter', size: 15 * 1024 * 1024 },
      { id: 'ship-bomber', name: 'Bomber', size: 20 * 1024 * 1024 },
      { id: 'ship-cruiser', name: 'Cruiser', size: 25 * 1024 * 1024 },
      { id: 'ship-stealth', name: 'Stealth', size: 18 * 1024 * 1024 },
      { id: 'ship-corvette', name: 'Corvette', size: 12 * 1024 * 1024 }
    ];

    ships.forEach(ship => {
      this.addAsset('player-ships', {
        id: ship.id,
        name: ship.name,
        type: 'model',
        url: `/assets/models/player/${ship.id}.glb`,
        size: ship.size,
        format: 'glb',
        lodVariants: [
          { level: 0, url: `/assets/models/player/${ship.id}-low.glb`, size: ship.size * 0.3, quality: 'low' },
          { level: 1, url: `/assets/models/player/${ship.id}-med.glb`, size: ship.size * 0.6, quality: 'medium' },
          { level: 2, url: `/assets/models/player/${ship.id}.glb`, size: ship.size, quality: 'high' }
        ],
        tags: ['player', 'ship']
      });
    });
  }

  private generateEnemies(): void {
    const enemies = [
      { id: 'enemy-scout', name: 'Scout', size: 8 * 1024 * 1024 },
      { id: 'enemy-fighter', name: 'Enemy Fighter', size: 10 * 1024 * 1024 },
      { id: 'enemy-bomber', name: 'Enemy Bomber', size: 12 * 1024 * 1024 },
      { id: 'enemy-tank', name: 'Tank', size: 15 * 1024 * 1024 },
      { id: 'enemy-assassin', name: 'Assassin', size: 8 * 1024 * 1024 },
      { id: 'enemy-drone', name: 'Drone', size: 5 * 1024 * 1024 },
      { id: 'enemy-corvette', name: 'Enemy Corvette', size: 12 * 1024 * 1024 },
      { id: 'enemy-destroyer', name: 'Destroyer', size: 18 * 1024 * 1024 }
    ];

    enemies.forEach(enemy => {
      this.addAsset('enemies', {
        id: enemy.id,
        name: enemy.name,
        type: 'model',
        url: `/assets/models/enemies/${enemy.id}.glb`,
        size: enemy.size,
        format: 'glb',
        tags: ['enemy']
      });
    });
  }

  private generateBosses(): void {
    const bosses = [
      { id: 'boss-sentinel', name: 'Sentinel', size: 40 * 1024 * 1024 },
      { id: 'boss-overlord', name: 'Overlord', size: 45 * 1024 * 1024 },
      { id: 'boss-devourer', name: 'Devourer', size: 50 * 1024 * 1024 },
      { id: 'boss-phantom', name: 'Phantom', size: 35 * 1024 * 1024 }
    ];

    bosses.forEach(boss => {
      this.addAsset('bosses', {
        id: boss.id,
        name: boss.name,
        type: 'model',
        url: `/assets/models/bosses/${boss.id}.glb`,
        size: boss.size,
        format: 'glb',
        lodVariants: [
          { level: 0, url: `/assets/models/bosses/${boss.id}-low.glb`, size: boss.size * 0.2, quality: 'low' },
          { level: 1, url: `/assets/models/bosses/${boss.id}-med.glb`, size: boss.size * 0.5, quality: 'medium' },
          { level: 2, url: `/assets/models/bosses/${boss.id}.glb`, size: boss.size, quality: 'high' }
        ],
        tags: ['boss']
      });
    });
  }

  private generateTextures(): void {
    const pbrTextures = [
      { id: 'tex-metal-01', name: 'Metal Plate', size: 18 * 1024 },
      { id: 'tex-metal-02', name: 'Metal Dark', size: 16 * 1024 },
      { id: 'tex-carbon-01', name: 'Carbon Fiber', size: 31 * 1024 },
      { id: 'tex-glass-01', name: 'Glass', size: 6 * 1024 },
      { id: 'tex-rock-01', name: 'Rock', size: 22 * 1024 },
      { id: 'tex-energy-01', name: 'Energy Field', size: 8 * 1024 },
      { id: 'tex-hull-red', name: 'Hull Red', size: 8 * 1024 },
      { id: 'tex-hull-blue', name: 'Hull Blue', size: 8 * 1024 },
      { id: 'tex-hull-purple', name: 'Hull Purple', size: 8 * 1024 },
      { id: 'tex-hull-green', name: 'Hull Green', size: 8 * 1024 }
    ];

    pbrTextures.forEach(tex => {
      this.addAsset('textures-pbr', {
        id: tex.id,
        name: tex.name,
        type: 'texture',
        url: `/assets/textures/pbr/${tex.id}.png`,
        size: tex.size,
        format: 'png',
        tags: ['pbr', 'material']
      });
    });

    const envMaps = [
      { id: 'env-space-01', name: 'Deep Space', size: 253 * 1024 },
      { id: 'env-space-02', name: 'Deep Space 2', size: 255 * 1024 },
      { id: 'env-nebula-01', name: 'Nebula', size: 13 * 1024 },
      { id: 'env-nebula-02', name: 'Nebula 2', size: 13 * 1024 }
    ];

    envMaps.forEach(env => {
      this.addAsset('textures-environment', {
        id: env.id,
        name: env.name,
        type: 'texture',
        url: `/assets/textures/environment/${env.id}.png`,
        size: env.size,
        format: 'png',
        tags: ['environment', 'skybox']
      });
    });

    const uiIcons = [
      { id: 'icon-missile', name: 'Missile Icon', size: 225 },
      { id: 'icon-shield', name: 'Shield Icon', size: 225 },
      { id: 'icon-clock', name: 'Clock Icon', size: 225 },
      { id: 'icon-zap', name: 'Zap Icon', size: 205 }
    ];

    uiIcons.forEach(icon => {
      this.addAsset('textures-ui', {
        id: icon.id,
        name: icon.name,
        type: 'texture',
        url: `/assets/textures/ui/${icon.id}.png`,
        size: icon.size,
        format: 'png',
        tags: ['ui', 'icon']
      });
    });

    const effectTextures = [
      { id: 'effect-explosion-01', name: 'Explosion 01', size: 3 * 1024 },
      { id: 'effect-explosion-02', name: 'Explosion 02', size: 3 * 1024 }
    ];

    effectTextures.forEach(effect => {
      this.addAsset('effects', {
        id: effect.id,
        name: effect.name,
        type: 'effect',
        url: `/assets/textures/effects/${effect.id}.png`,
        size: effect.size,
        format: 'png',
        tags: ['effect', 'particle']
      });
    });
  }

  private generateAudio(): void {
    const bgmTracks = [
      { id: 'bgm-menu', name: 'Menu Theme', size: 15 * 1024 * 1024 },
      { id: 'bgm-combat-01', name: 'Combat 1', size: 18 * 1024 * 1024 },
      { id: 'bgm-combat-02', name: 'Combat 2', size: 18 * 1024 * 1024 },
      { id: 'bgm-boss', name: 'Boss Theme', size: 20 * 1024 * 1024 },
      { id: 'bgm-victory', name: 'Victory', size: 12 * 1024 * 1024 }
    ];

    bgmTracks.forEach(bgm => {
      this.addAsset('audio-bgm', {
        id: bgm.id,
        name: bgm.name,
        type: 'audio',
        url: `/assets/audio/bgm/${bgm.id}.ogg`,
        size: bgm.size,
        format: 'ogg',
        tags: ['bgm', 'music']
      });
    });

    const sfx = [
      { id: 'sfx-laser', name: 'Laser Shot', size: 500 * 1024 },
      { id: 'sfx-missile', name: 'Missile Launch', size: 800 * 1024 },
      { id: 'sfx-explosion', name: 'Explosion', size: 1 * 1024 * 1024 },
      { id: 'sfx-engine', name: 'Engine', size: 2 * 1024 * 1024 },
      { id: 'sfx-shield', name: 'Shield', size: 600 * 1024 },
      { id: 'sfx-powerup', name: 'Powerup', size: 400 * 1024 }
    ];

    sfx.forEach(sound => {
      this.addAsset('audio-sfx', {
        id: sound.id,
        name: sound.name,
        type: 'audio',
        url: `/assets/audio/sfx/${sound.id}.ogg`,
        size: sound.size,
        format: 'ogg',
        tags: ['sfx']
      });
    });
  }

  private generateLevels(): void {
    const levels = [
      { id: 'level-01', name: 'First Contact', size: 1000 },
      { id: 'level-02', name: 'The Asteroid Field', size: 1000 },
      { id: 'level-03', name: 'Station Defense', size: 1000 },
      { id: 'level-04', name: 'Deep Space', size: 1000 },
      { id: 'level-05', name: 'Boss: Sentinel', size: 1200 },
      { id: 'level-06', name: 'Hidden Base', size: 1000 },
      { id: 'level-07', name: 'Fleet Battle', size: 1000 },
      { id: 'level-08', name: 'The Maelstrom', size: 1000 },
      { id: 'level-09', name: 'Final Approach', size: 1000 },
      { id: 'level-10', name: 'Boss: Overlord', size: 1200 }
    ];

    levels.forEach(level => {
      this.addAsset('levels', {
        id: level.id,
        name: level.name,
        type: 'config',
        url: `/assets/levels/${level.id}.json`,
        size: level.size,
        format: 'json',
        tags: ['level']
      });
    });
  }
}
