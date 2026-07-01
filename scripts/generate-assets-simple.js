const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../public/assets');

function createDirIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createPNG(width, height, r, g, b, a = 255) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b, a);
    }
  }

  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createGradientPNG(width, height, colors) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const t = y / height;
      const idx = Math.floor(t * (colors.length - 1));
      const nextIdx = Math.min(idx + 1, colors.length - 1);
      const localT = (t * (colors.length - 1)) % 1;
      
      const r = Math.floor(colors[idx][0] * (1 - localT) + colors[nextIdx][0] * localT);
      const g = Math.floor(colors[idx][1] * (1 - localT) + colors[nextIdx][1] * localT);
      const b = Math.floor(colors[idx][2] * (1 - localT) + colors[nextIdx][2] * localT);
      const a = 255;
      
      rawData.push(r, g, b, a);
    }
  }

  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createCheckerboardPNG(width, height, color1, color2, size) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const isColor1 = ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0);
      const color = isColor1 ? color1 : color2;
      rawData.push(color[0], color[1], color[2], 255);
    }
  }

  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createStarfieldPNG(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const rand = Math.random();
      if (rand > 0.97) {
        const brightness = Math.floor(Math.random() * 155) + 100;
        rawData.push(brightness, brightness, brightness, 255);
      } else if (rand > 0.99) {
        rawData.push(255, 255, 255, 255);
      } else {
        rawData.push(0, 0, 0, 255);
      }
    }
  }

  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function generateEnvironmentTextures() {
  console.log('--- Environment Textures ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'textures/environment'));
  
  const nebula1 = createGradientPNG(2048, 1024, [
    [10, 10, 26], [255, 107, 107], [78, 205, 196], [69, 183, 209], [10, 10, 26]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-nebula-01.png'), nebula1);
  console.log(`Generated: env-nebula-01.png (${(nebula1.length / 1024).toFixed(2)} KB)`);
  
  const nebula2 = createGradientPNG(2048, 1024, [
    [10, 10, 26], [155, 89, 182], [52, 152, 219], [231, 76, 60], [10, 10, 26]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-nebula-02.png'), nebula2);
  console.log(`Generated: env-nebula-02.png (${(nebula2.length / 1024).toFixed(2)} KB)`);
  
  const space1 = createStarfieldPNG(2048, 1024);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-space-01.png'), space1);
  console.log(`Generated: env-space-01.png (${(space1.length / 1024).toFixed(2)} KB)`);
  
  const space2 = createStarfieldPNG(2048, 1024);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-space-02.png'), space2);
  console.log(`Generated: env-space-02.png (${(space2.length / 1024).toFixed(2)} KB)`);
}

function generatePBRTextures() {
  console.log('\n--- PBR Textures ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'textures/pbr'));
  
  const metal1 = createCheckerboardPNG(1024, 1024, [74, 74, 74], [60, 60, 60], 32);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-metal-01.png'), metal1);
  console.log(`Generated: tex-metal-01.png (${(metal1.length / 1024).toFixed(2)} KB)`);
  
  const metal2 = createCheckerboardPNG(1024, 1024, [50, 50, 50], [40, 40, 40], 16);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-metal-02.png'), metal2);
  console.log(`Generated: tex-metal-02.png (${(metal2.length / 1024).toFixed(2)} KB)`);
  
  const carbon = createCheckerboardPNG(1024, 1024, [26, 26, 26], [30, 30, 30], 51);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-carbon-01.png'), carbon);
  console.log(`Generated: tex-carbon-01.png (${(carbon.length / 1024).toFixed(2)} KB)`);
  
  const glass = createGradientPNG(1024, 1024, [[100, 150, 200], [50, 100, 150]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-glass-01.png'), glass);
  console.log(`Generated: tex-glass-01.png (${(glass.length / 1024).toFixed(2)} KB)`);
  
  const rock = createCheckerboardPNG(1024, 1024, [58, 58, 58], [45, 45, 45], 64);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-rock-01.png'), rock);
  console.log(`Generated: tex-rock-01.png (${(rock.length / 1024).toFixed(2)} KB)`);
  
  const energy = createGradientPNG(1024, 1024, [[0, 0, 0], [0, 255, 255], [0, 0, 0]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-energy-01.png'), energy);
  console.log(`Generated: tex-energy-01.png (${(energy.length / 1024).toFixed(2)} KB)`);
}

function generateHullTextures() {
  console.log('\n--- Hull Textures ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'textures/pbr'));
  
  const hullRed = createGradientPNG(1024, 1024, [[51, 51, 51], [255, 107, 107], [51, 51, 51]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-hull-red.png'), hullRed);
  console.log(`Generated: tex-hull-red.png (${(hullRed.length / 1024).toFixed(2)} KB)`);
  
  const hullBlue = createGradientPNG(1024, 1024, [[44, 62, 80], [52, 152, 219], [44, 62, 80]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-hull-blue.png'), hullBlue);
  console.log(`Generated: tex-hull-blue.png (${(hullBlue.length / 1024).toFixed(2)} KB)`);
  
  const hullPurple = createGradientPNG(1024, 1024, [[26, 26, 46], [155, 89, 182], [26, 26, 46]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-hull-purple.png'), hullPurple);
  console.log(`Generated: tex-hull-purple.png (${(hullPurple.length / 1024).toFixed(2)} KB)`);
  
  const hullGreen = createGradientPNG(1024, 1024, [[45, 52, 54], [0, 184, 148], [45, 52, 54]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-hull-green.png'), hullGreen);
  console.log(`Generated: tex-hull-green.png (${(hullGreen.length / 1024).toFixed(2)} KB)`);
}

function generateUIIcons() {
  console.log('\n--- UI Icons ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'textures/ui'));
  
  const missileIcon = createPNG(64, 64, 0, 255, 255);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/ui/icon-missile.png'), missileIcon);
  console.log(`Generated: icon-missile.png (${(missileIcon.length / 1024).toFixed(2)} KB)`);
  
  const shieldIcon = createPNG(64, 64, 0, 255, 255);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/ui/icon-shield.png'), shieldIcon);
  console.log(`Generated: icon-shield.png (${(shieldIcon.length / 1024).toFixed(2)} KB)`);
  
  const clockIcon = createPNG(64, 64, 0, 255, 255);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/ui/icon-clock.png'), clockIcon);
  console.log(`Generated: icon-clock.png (${(clockIcon.length / 1024).toFixed(2)} KB)`);
  
  const zapIcon = createPNG(64, 64, 255, 255, 0);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/ui/icon-zap.png'), zapIcon);
  console.log(`Generated: icon-zap.png (${(zapIcon.length / 1024).toFixed(2)} KB)`);
}

function generateEffectTextures() {
  console.log('\n--- Effect Textures ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'textures/effects'));
  
  const explosion1 = createGradientPNG(512, 512, [
    [0, 0, 0], [255, 0, 0], [255, 136, 0], [255, 255, 0], [255, 255, 255]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/effects/effect-explosion-01.png'), explosion1);
  console.log(`Generated: effect-explosion-01.png (${(explosion1.length / 1024).toFixed(2)} KB)`);
  
  const explosion2 = createGradientPNG(512, 512, [
    [0, 0, 0], [255, 0, 128], [255, 0, 0], [255, 100, 0], [255, 255, 0]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/effects/effect-explosion-02.png'), explosion2);
  console.log(`Generated: effect-explosion-02.png (${(explosion2.length / 1024).toFixed(2)} KB)`);
}

function generateLevelConfigs() {
  console.log('\n--- Level Configs ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'levels'));
  
  const levelNames = [
    'First Contact', 'The Asteroid Field', 'Station Defense', 'Deep Space', 'Boss: Sentinel',
    'Hidden Base', 'Fleet Battle', 'The Maelstrom', 'Final Approach', 'Boss: Overlord'
  ];
  const difficulties = ['easy', 'easy', 'medium', 'medium', 'hard', 'medium', 'hard', 'hard', 'hard', 'extreme'];
  
  levelNames.forEach((name, index) => {
    const levelNum = index + 1;
    const config = {
      id: `level-${String(levelNum).padStart(2, '0')}`,
      name,
      description: `Level ${levelNum}: ${name}`,
      difficulty: difficulties[index],
      environment: {
        skybox: levelNum % 2 === 0 ? 'env-space-01' : 'env-nebula-01',
        nebula: levelNum % 2 !== 0,
        asteroidField: levelNum % 3 === 0,
        lighting: levelNum === 5 || levelNum === 10 ? 'dramatic' : 'normal'
      },
      player: {
        health: 100 + (levelNum - 1) * 10,
        shield: 50 + (levelNum - 1) * 8,
        maxHealth: 100 + (levelNum - 1) * 10,
        maxShield: 50 + (levelNum - 1) * 8,
        startingPosition: { x: 0, y: 0, z: 0 }
      },
      waves: [
        {
          number: 1,
          enemies: [{ type: 'enemy-scout', count: 3 + levelNum, spawnDelay: 1000 }],
          objectives: ['Destroy all enemies']
        },
        {
          number: 2,
          enemies: [{ type: 'enemy-fighter', count: 2 + Math.floor(levelNum / 2), spawnDelay: 800 }],
          objectives: ['Destroy all enemies']
        }
      ],
      rewards: {
        experience: 100 + (levelNum - 1) * 50,
        credits: 500 + (levelNum - 1) * 250,
        unlocks: []
      }
    };
    
    if (levelNum === 5 || levelNum === 10) {
      config.waves.push({
        number: 3,
        enemies: [{ type: levelNum === 5 ? 'boss-sentinel' : 'boss-overlord', count: 1, spawnDelay: 3000 }],
        objectives: ['Defeat the boss']
      });
    }
    
    const filePath = path.join(ASSETS_DIR, `levels/level-${String(levelNum).padStart(2, '0')}.json`);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    console.log(`Generated: level-${String(levelNum).padStart(2, '0')}.json`);
  });
}

function generateAssetManifest() {
  console.log('\n--- Asset Manifest ---');
  
  const manifest = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    totalSize: 0,
    assetCount: 0,
    categories: []
  };
  
  const categories = [
    {
      id: 'textures-environment',
      name: 'Environment Maps',
      description: '环境贴图',
      assets: [
        { id: 'env-nebula-01', name: 'Nebula 01', type: 'texture', url: '/assets/textures/environment/env-nebula-01.png', size: 0, format: 'png', tags: ['environment', 'skybox'] },
        { id: 'env-nebula-02', name: 'Nebula 02', type: 'texture', url: '/assets/textures/environment/env-nebula-02.png', size: 0, format: 'png', tags: ['environment', 'skybox'] },
        { id: 'env-space-01', name: 'Space 01', type: 'texture', url: '/assets/textures/environment/env-space-01.png', size: 0, format: 'png', tags: ['environment', 'skybox'] },
        { id: 'env-space-02', name: 'Space 02', type: 'texture', url: '/assets/textures/environment/env-space-02.png', size: 0, format: 'png', tags: ['environment', 'skybox'] }
      ],
      totalSize: 0
    },
    {
      id: 'textures-pbr',
      name: 'PBR Textures',
      description: 'PBR材质贴图',
      assets: [
        { id: 'tex-metal-01', name: 'Metal Plate', type: 'texture', url: '/assets/textures/pbr/tex-metal-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-metal-02', name: 'Metal Dark', type: 'texture', url: '/assets/textures/pbr/tex-metal-02.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-carbon-01', name: 'Carbon Fiber', type: 'texture', url: '/assets/textures/pbr/tex-carbon-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-glass-01', name: 'Glass', type: 'texture', url: '/assets/textures/pbr/tex-glass-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-rock-01', name: 'Rock', type: 'texture', url: '/assets/textures/pbr/tex-rock-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-energy-01', name: 'Energy Field', type: 'texture', url: '/assets/textures/pbr/tex-energy-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-hull-red', name: 'Hull Red', type: 'texture', url: '/assets/textures/pbr/tex-hull-red.png', size: 0, format: 'png', tags: ['hull', 'ship'] },
        { id: 'tex-hull-blue', name: 'Hull Blue', type: 'texture', url: '/assets/textures/pbr/tex-hull-blue.png', size: 0, format: 'png', tags: ['hull', 'ship'] },
        { id: 'tex-hull-purple', name: 'Hull Purple', type: 'texture', url: '/assets/textures/pbr/tex-hull-purple.png', size: 0, format: 'png', tags: ['hull', 'ship'] },
        { id: 'tex-hull-green', name: 'Hull Green', type: 'texture', url: '/assets/textures/pbr/tex-hull-green.png', size: 0, format: 'png', tags: ['hull', 'ship'] }
      ],
      totalSize: 0
    },
    {
      id: 'textures-ui',
      name: 'UI Icons',
      description: 'UI图标',
      assets: [
        { id: 'icon-missile', name: 'Missile Icon', type: 'texture', url: '/assets/textures/ui/icon-missile.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-shield', name: 'Shield Icon', type: 'texture', url: '/assets/textures/ui/icon-shield.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-clock', name: 'Clock Icon', type: 'texture', url: '/assets/textures/ui/icon-clock.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-zap', name: 'Zap Icon', type: 'texture', url: '/assets/textures/ui/icon-zap.png', size: 0, format: 'png', tags: ['ui', 'icon'] }
      ],
      totalSize: 0
    },
    {
      id: 'textures-effects',
      name: 'Effect Textures',
      description: '特效贴图',
      assets: [
        { id: 'effect-explosion-01', name: 'Explosion 01', type: 'texture', url: '/assets/textures/effects/effect-explosion-01.png', size: 0, format: 'png', tags: ['effect', 'particle'] },
        { id: 'effect-explosion-02', name: 'Explosion 02', type: 'texture', url: '/assets/textures/effects/effect-explosion-02.png', size: 0, format: 'png', tags: ['effect', 'particle'] }
      ],
      totalSize: 0
    },
    {
      id: 'levels',
      name: 'Levels',
      description: '关卡配置',
      assets: [
        { id: 'level-01', name: 'First Contact', type: 'config', url: '/assets/levels/level-01.json', size: 0, format: 'json', tags: ['level'] },
        { id: 'level-02', name: 'The Asteroid Field', type: 'config', url: '/assets/levels/level-02.json', size: 0, format: 'json', tags: ['level'] },
        { id: 'level-03', name: 'Station Defense', type: 'config', url: '/assets/levels/level-03.json', size: 0, format: 'json', tags: ['level'] },
        { id: 'level-04', name: 'Deep Space', type: 'config', url: '/assets/levels/level-04.json', size: 0, format: 'json', tags: ['level'] },
        { id: 'level-05', name: 'Boss: Sentinel', type: 'config', url: '/assets/levels/level-05.json', size: 0, format: 'json', tags: ['level', 'boss'] },
        { id: 'level-06', name: 'Hidden Base', type: 'config', url: '/assets/levels/level-06.json', size: 0, format: 'json', tags: ['level'] },
        { id: 'level-07', name: 'Fleet Battle', type: 'config', url: '/assets/levels/level-07.json', size: 0, format: 'json', tags: ['level'] },
        { id: 'level-08', name: 'The Maelstrom', type: 'config', url: '/assets/levels/level-08.json', size: 0, format: 'json', tags: ['level'] },
        { id: 'level-09', name: 'Final Approach', type: 'config', url: '/assets/levels/level-09.json', size: 0, format: 'json', tags: ['level'] },
        { id: 'level-10', name: 'Boss: Overlord', type: 'config', url: '/assets/levels/level-10.json', size: 0, format: 'json', tags: ['level', 'boss'] }
      ],
      totalSize: 0
    }
  ];
  
  let totalSize = 0;
  let totalCount = 0;
  
  categories.forEach(cat => {
    cat.assets.forEach(asset => {
      const filePath = path.join(ASSETS_DIR, asset.url.replace('/assets/', ''));
      if (fs.existsSync(filePath)) {
        asset.size = fs.statSync(filePath).size;
      }
      cat.totalSize += asset.size;
      totalSize += asset.size;
      totalCount++;
    });
    manifest.categories.push(cat);
  });
  
  manifest.totalSize = totalSize;
  manifest.assetCount = totalCount;
  
  fs.writeFileSync(path.join(ASSETS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Generated: manifest.json (${totalCount} assets, ${(totalSize / 1024).toFixed(2)} KB)`);
}

function main() {
  console.log('=== Generating Game Assets ===\n');
  
  createDirIfNotExists(ASSETS_DIR);
  
  generateEnvironmentTextures();
  generatePBRTextures();
  generateHullTextures();
  generateUIIcons();
  generateEffectTextures();
  generateLevelConfigs();
  generateAssetManifest();
  
  console.log('\n=== Asset Generation Complete ===');
  
  const totalSize = fs.statSync(ASSETS_DIR).size;
  console.log(`\nTotal assets size: ${(totalSize / 1024).toFixed(2)} KB`);
}

main();
