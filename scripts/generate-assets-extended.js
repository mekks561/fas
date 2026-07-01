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

function createNoisePNG(width, height, baseColor, intensity) {
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
      const noise = (Math.random() - 0.5) * intensity;
      const r = Math.max(0, Math.min(255, baseColor[0] + noise));
      const g = Math.max(0, Math.min(255, baseColor[1] + noise));
      const b = Math.max(0, Math.min(255, baseColor[2] + noise));
      rawData.push(Math.floor(r), Math.floor(g), Math.floor(b), 255);
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
  
  const nebula3 = createGradientPNG(2048, 1024, [
    [10, 10, 26], [243, 156, 18], [230, 126, 34], [255, 191, 0], [10, 10, 26]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-nebula-03.png'), nebula3);
  console.log(`Generated: env-nebula-03.png (${(nebula3.length / 1024).toFixed(2)} KB)`);
  
  const space1 = createStarfieldPNG(2048, 1024);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-space-01.png'), space1);
  console.log(`Generated: env-space-01.png (${(space1.length / 1024).toFixed(2)} KB)`);
  
  const space2 = createStarfieldPNG(2048, 1024);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-space-02.png'), space2);
  console.log(`Generated: env-space-02.png (${(space2.length / 1024).toFixed(2)} KB)`);
  
  const galaxy1 = createGradientPNG(2048, 1024, [
    [10, 10, 30], [50, 20, 80], [30, 10, 50], [20, 5, 30], [10, 10, 30]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-galaxy-01.png'), galaxy1);
  console.log(`Generated: env-galaxy-01.png (${(galaxy1.length / 1024).toFixed(2)} KB)`);
  
  const planet1 = createGradientPNG(1024, 1024, [
    [100, 149, 237], [65, 105, 225], [30, 50, 100], [20, 30, 60], [100, 149, 237]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-planet-01.png'), planet1);
  console.log(`Generated: env-planet-01.png (${(planet1.length / 1024).toFixed(2)} KB)`);
  
  const planet2 = createGradientPNG(1024, 1024, [
    [139, 69, 19], [160, 82, 45], [101, 67, 33], [80, 50, 25], [139, 69, 19]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-planet-02.png'), planet2);
  console.log(`Generated: env-planet-02.png (${(planet2.length / 1024).toFixed(2)} KB)`);
  
  const station1 = createGradientPNG(2048, 1024, [
    [30, 30, 40], [50, 50, 60], [40, 40, 50], [35, 35, 45], [30, 30, 40]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/environment/env-station-01.png'), station1);
  console.log(`Generated: env-station-01.png (${(station1.length / 1024).toFixed(2)} KB)`);
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
  
  const metalGold = createGradientPNG(1024, 1024, [[212, 175, 55], [255, 215, 0], [212, 175, 55]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-metal-gold.png'), metalGold);
  console.log(`Generated: tex-metal-gold.png (${(metalGold.length / 1024).toFixed(2)} KB)`);
  
  const metalChrome = createGradientPNG(1024, 1024, [[200, 200, 200], [255, 255, 255], [200, 200, 200]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-metal-chrome.png'), metalChrome);
  console.log(`Generated: tex-metal-chrome.png (${(metalChrome.length / 1024).toFixed(2)} KB)`);
  
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
  
  const energyRed = createGradientPNG(1024, 1024, [[0, 0, 0], [255, 0, 0], [0, 0, 0]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-energy-red.png'), energyRed);
  console.log(`Generated: tex-energy-red.png (${(energyRed.length / 1024).toFixed(2)} KB)`);
  
  const energyGreen = createGradientPNG(1024, 1024, [[0, 0, 0], [0, 255, 0], [0, 0, 0]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-energy-green.png'), energyGreen);
  console.log(`Generated: tex-energy-green.png (${(energyGreen.length / 1024).toFixed(2)} KB)`);
  
  const lava = createGradientPNG(1024, 1024, [[100, 0, 0], [255, 100, 0], [255, 255, 0], [255, 100, 0], [100, 0, 0]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-lava-01.png'), lava);
  console.log(`Generated: tex-lava-01.png (${(lava.length / 1024).toFixed(2)} KB)`);
  
  const ice = createGradientPNG(1024, 1024, [[173, 216, 230], [224, 255, 255], [173, 216, 230]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-ice-01.png'), ice);
  console.log(`Generated: tex-ice-01.png (${(ice.length / 1024).toFixed(2)} KB)`);
  
  const wood = createGradientPNG(1024, 1024, [[139, 90, 43], [160, 100, 50], [139, 90, 43]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-wood-01.png'), wood);
  console.log(`Generated: tex-wood-01.png (${(wood.length / 1024).toFixed(2)} KB)`);
  
  const concrete = createNoisePNG(1024, 1024, [128, 128, 128], 30);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-concrete-01.png'), concrete);
  console.log(`Generated: tex-concrete-01.png (${(concrete.length / 1024).toFixed(2)} KB)`);
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
  
  const hullOrange = createGradientPNG(1024, 1024, [[60, 40, 30], [255, 165, 0], [60, 40, 30]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-hull-orange.png'), hullOrange);
  console.log(`Generated: tex-hull-orange.png (${(hullOrange.length / 1024).toFixed(2)} KB)`);
  
  const hullWhite = createGradientPNG(1024, 1024, [[200, 200, 200], [255, 255, 255], [200, 200, 200]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-hull-white.png'), hullWhite);
  console.log(`Generated: tex-hull-white.png (${(hullWhite.length / 1024).toFixed(2)} KB)`);
  
  const hullBlack = createGradientPNG(1024, 1024, [[20, 20, 20], [60, 60, 60], [20, 20, 20]]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-hull-black.png'), hullBlack);
  console.log(`Generated: tex-hull-black.png (${(hullBlack.length / 1024).toFixed(2)} KB)`);
  
  const hullCamo = createCheckerboardPNG(1024, 1024, [34, 139, 34], [85, 107, 47], 64);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/pbr/tex-hull-camo.png'), hullCamo);
  console.log(`Generated: tex-hull-camo.png (${(hullCamo.length / 1024).toFixed(2)} KB)`);
}

function generateUIIcons() {
  console.log('\n--- UI Icons ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'textures/ui'));
  
  const icons = [
    { name: 'icon-missile', color: [0, 255, 255] },
    { name: 'icon-shield', color: [0, 255, 255] },
    { name: 'icon-clock', color: [0, 255, 255] },
    { name: 'icon-zap', color: [255, 255, 0] },
    { name: 'icon-heart', color: [255, 0, 0] },
    { name: 'icon-star', color: [255, 215, 0] },
    { name: 'icon-coins', color: [255, 215, 0] },
    { name: 'icon-exp', color: [148, 0, 211] },
    { name: 'icon-gun', color: [192, 192, 192] },
    { name: 'icon-bomb', color: [255, 0, 0] },
    { name: 'icon-shoot', color: [0, 255, 0] },
    { name: 'icon-speed', color: [100, 149, 237] },
    { name: 'icon-damage', color: [255, 69, 0] },
    { name: 'icon-defense', color: [65, 105, 225] },
    { name: 'icon-heal', color: [0, 255, 127] },
    { name: 'icon-stealth', color: [105, 105, 105] },
    { name: 'icon-energy', color: [255, 255, 0] },
    { name: 'icon-reload', color: [0, 191, 255] },
    { name: 'icon-target', color: [255, 0, 0] },
    { name: 'icon-crosshair', color: [0, 255, 0] },
    { name: 'icon-map', color: [135, 206, 250] },
    { name: 'icon-settings', color: [169, 169, 169] },
    { name: 'icon-help', color: [0, 191, 255] },
    { name: 'icon-pause', color: [255, 255, 255] },
    { name: 'icon-play', color: [0, 255, 0] },
    { name: 'icon-resume', color: [0, 255, 0] },
    { name: 'icon-restart', color: [255, 165, 0] },
    { name: 'icon-exit', color: [255, 0, 0] },
    { name: 'icon-next', color: [0, 191, 255] },
    { name: 'icon-prev', color: [0, 191, 255] },
    { name: 'icon-upgrade', color: [255, 215, 0] },
    { name: 'icon-unlock', color: [0, 255, 0] },
    { name: 'icon-achieve', color: [255, 215, 0] },
    { name: 'icon-challenge', color: [255, 69, 0] },
    { name: 'icon-event', color: [255, 105, 180] },
    { name: 'icon-shop', color: [0, 255, 0] },
    { name: 'icon-inventory', color: [139, 119, 101] },
    { name: 'icon-character', color: [70, 130, 180] },
    { name: 'icon-skills', color: [148, 0, 211] },
    { name: 'icon-equipment', color: [169, 169, 169] }
  ];
  
  icons.forEach(icon => {
    const png = createPNG(64, 64, icon.color[0], icon.color[1], icon.color[2]);
    const filePath = path.join(ASSETS_DIR, `textures/ui/${icon.name}.png`);
    fs.writeFileSync(filePath, png);
    console.log(`Generated: ${icon.name}.png (${(png.length / 1024).toFixed(2)} KB)`);
  });
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
  
  const fire1 = createGradientPNG(512, 512, [
    [0, 0, 0], [255, 50, 0], [255, 150, 0], [255, 255, 0], [255, 255, 100]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/effects/effect-fire-01.png'), fire1);
  console.log(`Generated: effect-fire-01.png (${(fire1.length / 1024).toFixed(2)} KB)`);
  
  const smoke1 = createGradientPNG(512, 512, [
    [0, 0, 0], [50, 50, 50], [100, 100, 100], [150, 150, 150], [200, 200, 200]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/effects/effect-smoke-01.png'), smoke1);
  console.log(`Generated: effect-smoke-01.png (${(smoke1.length / 1024).toFixed(2)} KB)`);
  
  const spark1 = createGradientPNG(256, 256, [
    [0, 0, 0], [255, 200, 0], [255, 255, 100], [255, 255, 255]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/effects/effect-spark-01.png'), spark1);
  console.log(`Generated: effect-spark-01.png (${(spark1.length / 1024).toFixed(2)} KB)`);
  
  const laser1 = createGradientPNG(256, 1024, [
    [0, 0, 0], [0, 255, 255], [255, 255, 255], [0, 255, 255], [0, 0, 0]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/effects/effect-laser-01.png'), laser1);
  console.log(`Generated: effect-laser-01.png (${(laser1.length / 1024).toFixed(2)} KB)`);
  
  const energyBall1 = createGradientPNG(512, 512, [
    [0, 0, 0], [0, 100, 255], [0, 200, 255], [0, 255, 255], [255, 255, 255]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/effects/effect-energyball-01.png'), energyBall1);
  console.log(`Generated: effect-energyball-01.png (${(energyBall1.length / 1024).toFixed(2)} KB)`);
  
  const shockwave1 = createGradientPNG(512, 512, [
    [0, 0, 0], [50, 50, 100], [100, 100, 200], [150, 150, 255], [200, 200, 255]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/effects/effect-shockwave-01.png'), shockwave1);
  console.log(`Generated: effect-shockwave-01.png (${(shockwave1.length / 1024).toFixed(2)} KB)`);
  
  const trail1 = createGradientPNG(512, 128, [
    [0, 0, 0], [0, 150, 255], [0, 200, 255], [0, 255, 255], [255, 255, 255]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/effects/effect-trail-01.png'), trail1);
  console.log(`Generated: effect-trail-01.png (${(trail1.length / 1024).toFixed(2)} KB)`);
  
  const damage1 = createGradientPNG(256, 256, [
    [255, 0, 0], [200, 0, 0], [150, 0, 0], [100, 0, 0], [0, 0, 0]
  ]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'textures/effects/effect-damage-01.png'), damage1);
  console.log(`Generated: effect-damage-01.png (${(damage1.length / 1024).toFixed(2)} KB)`);
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

function generateWeaponConfigs() {
  console.log('\n--- Weapon Configs ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'weapons'));
  
  const weapons = [
    {
      id: 'weapon-laser',
      name: 'Laser Cannon',
      type: 'energy',
      damage: 15,
      fireRate: 0.2,
      range: 50,
      energyCost: 5,
      accuracy: 0.95,
      projectileSpeed: 100,
      description: 'Standard laser cannon with high accuracy',
      icon: 'icon-gun'
    },
    {
      id: 'weapon-missile',
      name: 'Missile Launcher',
      type: 'projectile',
      damage: 50,
      fireRate: 2.0,
      range: 80,
      energyCost: 25,
      accuracy: 0.85,
      projectileSpeed: 30,
      description: 'Fires guided missiles with splash damage',
      icon: 'icon-missile'
    },
    {
      id: 'weapon-plasma',
      name: 'Plasma Rifle',
      type: 'energy',
      damage: 25,
      fireRate: 0.4,
      range: 40,
      energyCost: 10,
      accuracy: 0.9,
      projectileSpeed: 60,
      description: 'High damage plasma rounds',
      icon: 'icon-zap'
    },
    {
      id: 'weapon-bomb',
      name: 'Cluster Bomb',
      type: 'explosive',
      damage: 100,
      fireRate: 5.0,
      range: 30,
      energyCost: 50,
      accuracy: 0.7,
      projectileSpeed: 20,
      description: 'Drops cluster bombs that explode on impact',
      icon: 'icon-bomb'
    },
    {
      id: 'weapon-sniper',
      name: 'Sniper Rifle',
      type: 'energy',
      damage: 80,
      fireRate: 1.5,
      range: 150,
      energyCost: 30,
      accuracy: 0.99,
      projectileSpeed: 200,
      description: 'Long range precision weapon',
      icon: 'icon-target'
    },
    {
      id: 'weapon-shotgun',
      name: 'Shotgun',
      type: 'projectile',
      damage: 40,
      fireRate: 1.0,
      range: 20,
      energyCost: 15,
      accuracy: 0.6,
      projectileSpeed: 50,
      spread: 0.3,
      description: 'Wide spread shotgun blast',
      icon: 'icon-shoot'
    },
    {
      id: 'weapon-turret',
      name: 'Auto Turret',
      type: 'energy',
      damage: 10,
      fireRate: 0.1,
      range: 35,
      energyCost: 3,
      accuracy: 0.8,
      projectileSpeed: 80,
      description: 'Rapid fire auto turret',
      icon: 'icon-crosshair'
    },
    {
      id: 'weapon-gravity',
      name: 'Gravity Gun',
      type: 'special',
      damage: 0,
      fireRate: 3.0,
      range: 45,
      energyCost: 20,
      accuracy: 0.85,
      projectileSpeed: 10,
      effect: 'pull',
      description: 'Pulls enemies towards you',
      icon: 'icon-zap'
    },
    {
      id: 'weapon-blackhole',
      name: 'Black Hole Generator',
      type: 'special',
      damage: 150,
      fireRate: 10.0,
      range: 25,
      energyCost: 100,
      accuracy: 0.75,
      projectileSpeed: 5,
      effect: 'attract',
      description: 'Creates a temporary black hole',
      icon: 'icon-zap'
    },
    {
      id: 'weapon-nuke',
      name: 'Nuclear Missile',
      type: 'explosive',
      damage: 500,
      fireRate: 30.0,
      range: 200,
      energyCost: 200,
      accuracy: 0.6,
      projectileSpeed: 40,
      description: 'Devastating nuclear warhead',
      icon: 'icon-bomb'
    }
  ];
  
  weapons.forEach(weapon => {
    const filePath = path.join(ASSETS_DIR, `weapons/${weapon.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(weapon, null, 2));
    console.log(`Generated: ${weapon.id}.json`);
  });
}

function generateSkillConfigs() {
  console.log('\n--- Skill Configs ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'skills'));
  
  const skills = [
    {
      id: 'skill-shield',
      name: 'Energy Shield',
      type: 'defensive',
      cooldown: 15,
      duration: 5,
      energyCost: 30,
      effect: {
        type: 'shield',
        value: 100
      },
      description: 'Activates a protective energy shield',
      icon: 'icon-shield',
      tier: 1
    },
    {
      id: 'skill-speed',
      name: 'Afterburner',
      type: 'movement',
      cooldown: 20,
      duration: 8,
      energyCost: 40,
      effect: {
        type: 'speed',
        multiplier: 2.0
      },
      description: 'Temporarily doubles movement speed',
      icon: 'icon-speed',
      tier: 1
    },
    {
      id: 'skill-heal',
      name: 'Nanobot Repair',
      type: 'support',
      cooldown: 30,
      duration: 0,
      energyCost: 50,
      effect: {
        type: 'heal',
        value: 50
      },
      description: 'Instantly repairs hull damage',
      icon: 'icon-heal',
      tier: 1
    },
    {
      id: 'skill-stealth',
      name: 'Cloaking Device',
      type: 'tactical',
      cooldown: 45,
      duration: 10,
      energyCost: 60,
      effect: {
        type: 'invisibility',
        duration: 10
      },
      description: 'Renders ship invisible to enemies',
      icon: 'icon-stealth',
      tier: 2
    },
    {
      id: 'skill-damage',
      name: 'Overcharge',
      type: 'offensive',
      cooldown: 25,
      duration: 6,
      energyCost: 45,
      effect: {
        type: 'damage',
        multiplier: 1.5
      },
      description: 'Increases weapon damage by 50%',
      icon: 'icon-damage',
      tier: 2
    },
    {
      id: 'skill-reload',
      name: 'Rapid Reload',
      type: 'support',
      cooldown: 10,
      duration: 0,
      energyCost: 15,
      effect: {
        type: 'reload',
        speed: 3.0
      },
      description: 'Instantly reloads all weapons',
      icon: 'icon-reload',
      tier: 1
    },
    {
      id: 'skill-energy',
      name: 'Energy Surge',
      type: 'support',
      cooldown: 40,
      duration: 0,
      energyCost: 0,
      effect: {
        type: 'energy',
        value: 100
      },
      description: 'Restores energy reserves',
      icon: 'icon-energy',
      tier: 2
    },
    {
      id: 'skill-time',
      name: 'Time Warp',
      type: 'special',
      cooldown: 60,
      duration: 3,
      energyCost: 80,
      effect: {
        type: 'slowTime',
        multiplier: 0.3
      },
      description: 'Slows down time for enemies',
      icon: 'icon-clock',
      tier: 3
    },
    {
      id: 'skill-rebirth',
      name: 'Emergency Protocol',
      type: 'support',
      cooldown: 120,
      duration: 0,
      energyCost: 0,
      effect: {
        type: 'resurrect',
        health: 30
      },
      description: 'Revives with 30% health when destroyed',
      icon: 'icon-heart',
      tier: 3
    },
    {
      id: 'skill-blackhole',
      name: 'Gravity Well',
      type: 'offensive',
      cooldown: 90,
      duration: 4,
      energyCost: 100,
      effect: {
        type: 'attract',
        radius: 30,
        damage: 50
      },
      description: 'Creates a gravity well pulling enemies',
      icon: 'icon-zap',
      tier: 3
    }
  ];
  
  skills.forEach(skill => {
    const filePath = path.join(ASSETS_DIR, `skills/${skill.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(skill, null, 2));
    console.log(`Generated: ${skill.id}.json`);
  });
}

function generatePowerupConfigs() {
  console.log('\n--- Powerup Configs ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'powerups'));
  
  const powerups = [
    {
      id: 'powerup-health',
      name: 'Health Pack',
      type: 'heal',
      effect: {
        type: 'heal',
        value: 30
      },
      rarity: 'common',
      duration: 0,
      icon: 'icon-heart',
      description: 'Restores 30% health'
    },
    {
      id: 'powerup-shield',
      name: 'Shield Battery',
      type: 'shield',
      effect: {
        type: 'shield',
        value: 50
      },
      rarity: 'common',
      duration: 0,
      icon: 'icon-shield',
      description: 'Restores 50 shield'
    },
    {
      id: 'powerup-energy',
      name: 'Energy Cell',
      type: 'energy',
      effect: {
        type: 'energy',
        value: 40
      },
      rarity: 'common',
      duration: 0,
      icon: 'icon-energy',
      description: 'Restores 40 energy'
    },
    {
      id: 'powerup-damage',
      name: 'Damage Boost',
      type: 'buff',
      effect: {
        type: 'damage',
        multiplier: 1.5
      },
      rarity: 'rare',
      duration: 15,
      icon: 'icon-damage',
      description: '50% damage increase for 15s'
    },
    {
      id: 'powerup-speed',
      name: 'Speed Boost',
      type: 'buff',
      effect: {
        type: 'speed',
        multiplier: 1.5
      },
      rarity: 'rare',
      duration: 20,
      icon: 'icon-speed',
      description: '50% speed increase for 20s'
    },
    {
      id: 'powerup-defense',
      name: 'Defense Matrix',
      type: 'buff',
      effect: {
        type: 'defense',
        multiplier: 0.5
      },
      rarity: 'rare',
      duration: 12,
      icon: 'icon-defense',
      description: '50% damage reduction for 12s'
    },
    {
      id: 'powerup-experience',
      name: 'XP Crystal',
      type: 'reward',
      effect: {
        type: 'experience',
        multiplier: 2.0
      },
      rarity: 'epic',
      duration: 30,
      icon: 'icon-exp',
      description: 'Double XP for 30s'
    },
    {
      id: 'powerup-credits',
      name: 'Credit Cache',
      type: 'reward',
      effect: {
        type: 'credits',
        value: 500
      },
      rarity: 'epic',
      duration: 0,
      icon: 'icon-coins',
      description: 'Grants 500 credits'
    },
    {
      id: 'powerup-invincible',
      name: 'Invincibility',
      type: 'buff',
      effect: {
        type: 'invincible',
        duration: 5
      },
      rarity: 'legendary',
      duration: 5,
      icon: 'icon-shield',
      description: 'Invincible for 5 seconds'
    },
    {
      id: 'powerup-nuke',
      name: 'Emergency Nuke',
      type: 'offensive',
      effect: {
        type: 'nuke',
        damage: 1000,
        radius: 100
      },
      rarity: 'legendary',
      duration: 0,
      icon: 'icon-bomb',
      description: 'Destroys all enemies on screen'
    }
  ];
  
  powerups.forEach(powerup => {
    const filePath = path.join(ASSETS_DIR, `powerups/${powerup.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(powerup, null, 2));
    console.log(`Generated: ${powerup.id}.json`);
  });
}

function generateShipConfigs() {
  console.log('\n--- Ship Configs ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'ships'));
  
  const ships = [
    {
      id: 'ship-fighter',
      name: 'Fighter',
      type: 'light',
      stats: {
        health: 100,
        shield: 50,
        speed: 15,
        acceleration: 5,
        rotationSpeed: 3,
        energy: 100,
        energyRegen: 5
      },
      weapons: ['weapon-laser', 'weapon-plasma'],
      skills: ['skill-speed', 'skill-reload'],
      description: 'Fast and agile light fighter',
      icon: 'icon-character',
      texture: 'tex-hull-blue'
    },
    {
      id: 'ship-bomber',
      name: 'Bomber',
      type: 'heavy',
      stats: {
        health: 200,
        shield: 80,
        speed: 8,
        acceleration: 2,
        rotationSpeed: 1.5,
        energy: 150,
        energyRegen: 3
      },
      weapons: ['weapon-missile', 'weapon-bomb'],
      skills: ['skill-shield', 'skill-damage'],
      description: 'Heavy assault ship with devastating firepower',
      icon: 'icon-character',
      texture: 'tex-hull-red'
    },
    {
      id: 'ship-cruiser',
      name: 'Cruiser',
      type: 'medium',
      stats: {
        health: 150,
        shield: 100,
        speed: 10,
        acceleration: 3,
        rotationSpeed: 2,
        energy: 120,
        energyRegen: 4
      },
      weapons: ['weapon-laser', 'weapon-turret', 'weapon-plasma'],
      skills: ['skill-shield', 'skill-energy', 'skill-heal'],
      description: 'Balanced multi-role cruiser',
      icon: 'icon-character',
      texture: 'tex-hull-purple'
    },
    {
      id: 'ship-stealth',
      name: 'Stealth',
      type: 'light',
      stats: {
        health: 80,
        shield: 40,
        speed: 20,
        acceleration: 6,
        rotationSpeed: 4,
        energy: 110,
        energyRegen: 6
      },
      weapons: ['weapon-sniper', 'weapon-shotgun'],
      skills: ['skill-stealth', 'skill-speed'],
      description: 'Infiltration ship with cloaking capability',
      icon: 'icon-character',
      texture: 'tex-hull-black'
    },
    {
      id: 'ship-corvette',
      name: 'Corvette',
      type: 'light',
      stats: {
        health: 90,
        shield: 60,
        speed: 18,
        acceleration: 5,
        rotationSpeed: 3.5,
        energy: 90,
        energyRegen: 5
      },
      weapons: ['weapon-laser', 'weapon-gravity'],
      skills: ['skill-speed', 'skill-reload', 'skill-energy'],
      description: 'Fast interceptor with gravity weapons',
      icon: 'icon-character',
      texture: 'tex-hull-green'
    },
    {
      id: 'ship-dreadnought',
      name: 'Dreadnought',
      type: 'heavy',
      stats: {
        health: 300,
        shield: 150,
        speed: 5,
        acceleration: 1.5,
        rotationSpeed: 1,
        energy: 200,
        energyRegen: 2
      },
      weapons: ['weapon-missile', 'weapon-bomb', 'weapon-nuke'],
      skills: ['skill-shield', 'skill-damage', 'skill-blackhole'],
      description: 'Massive warship with ultimate firepower',
      icon: 'icon-character',
      texture: 'tex-hull-camo'
    }
  ];
  
  ships.forEach(ship => {
    const filePath = path.join(ASSETS_DIR, `ships/${ship.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(ship, null, 2));
    console.log(`Generated: ${ship.id}.json`);
  });
}

function generateEnemyConfigs() {
  console.log('\n--- Enemy Configs ---');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'enemies'));
  
  const enemies = [
    {
      id: 'enemy-scout',
      name: 'Scout',
      type: 'light',
      stats: {
        health: 30,
        shield: 10,
        speed: 12,
        damage: 8,
        fireRate: 0.5
      },
      behavior: 'aggressive',
      points: 100,
      icon: 'icon-target',
      texture: 'tex-metal-02'
    },
    {
      id: 'enemy-fighter',
      name: 'Fighter',
      type: 'light',
      stats: {
        health: 50,
        shield: 20,
        speed: 10,
        damage: 12,
        fireRate: 0.4
      },
      behavior: 'tactical',
      points: 150,
      icon: 'icon-target',
      texture: 'tex-hull-red'
    },
    {
      id: 'enemy-bomber',
      name: 'Bomber',
      type: 'heavy',
      stats: {
        health: 100,
        shield: 40,
        speed: 6,
        damage: 25,
        fireRate: 1.5
      },
      behavior: 'dive',
      points: 300,
      icon: 'icon-target',
      texture: 'tex-metal-01'
    },
    {
      id: 'enemy-tank',
      name: 'Tank',
      type: 'heavy',
      stats: {
        health: 200,
        shield: 100,
        speed: 4,
        damage: 20,
        fireRate: 0.8
      },
      behavior: 'charge',
      points: 400,
      icon: 'icon-target',
      texture: 'tex-rock-01'
    },
    {
      id: 'enemy-assassin',
      name: 'Assassin',
      type: 'light',
      stats: {
        health: 40,
        shield: 15,
        speed: 18,
        damage: 18,
        fireRate: 0.3
      },
      behavior: 'ambush',
      points: 200,
      icon: 'icon-target',
      texture: 'tex-hull-black'
    },
    {
      id: 'enemy-drone',
      name: 'Drone',
      type: 'light',
      stats: {
        health: 20,
        shield: 5,
        speed: 8,
        damage: 5,
        fireRate: 0.2
      },
      behavior: 'swarm',
      points: 50,
      icon: 'icon-target',
      texture: 'tex-metal-02'
    },
    {
      id: 'enemy-corvette',
      name: 'Corvette',
      type: 'medium',
      stats: {
        health: 80,
        shield: 35,
        speed: 11,
        damage: 15,
        fireRate: 0.6
      },
      behavior: 'flank',
      points: 250,
      icon: 'icon-target',
      texture: 'tex-metal-01'
    },
    {
      id: 'enemy-destroyer',
      name: 'Destroyer',
      type: 'heavy',
      stats: {
        health: 150,
        shield: 70,
        speed: 5,
        damage: 28,
        fireRate: 1.0
      },
      behavior: 'siege',
      points: 500,
      icon: 'icon-target',
      texture: 'tex-metal-01'
    },
    {
      id: 'boss-sentinel',
      name: 'Sentinel',
      type: 'boss',
      stats: {
        health: 1000,
        shield: 500,
        speed: 3,
        damage: 50,
        fireRate: 0.5
      },
      behavior: 'boss',
      points: 2000,
      icon: 'icon-target',
      texture: 'tex-energy-red',
      phases: [
        { healthThreshold: 100, abilities: ['laser', 'missile'] },
        { healthThreshold: 50, abilities: ['laser', 'missile', 'energy'] },
        { healthThreshold: 25, abilities: ['all'] }
      ]
    },
    {
      id: 'boss-overlord',
      name: 'Overlord',
      type: 'boss',
      stats: {
        health: 2000,
        shield: 1000,
        speed: 2,
        damage: 80,
        fireRate: 0.4
      },
      behavior: 'boss',
      points: 5000,
      icon: 'icon-target',
      texture: 'tex-energy-green',
      phases: [
        { healthThreshold: 100, abilities: ['missile', 'bomb'] },
        { healthThreshold: 70, abilities: ['missile', 'bomb', 'laser'] },
        { healthThreshold: 40, abilities: ['missile', 'bomb', 'laser', 'blackhole'] },
        { healthThreshold: 15, abilities: ['all'] }
      ]
    }
  ];
  
  enemies.forEach(enemy => {
    const filePath = path.join(ASSETS_DIR, `enemies/${enemy.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(enemy, null, 2));
    console.log(`Generated: ${enemy.id}.json`);
  });
}

function generateAssetManifest() {
  console.log('\n--- Asset Manifest ---');
  
  const manifest = {
    version: '2.0.0',
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
        { id: 'env-nebula-03', name: 'Nebula 03', type: 'texture', url: '/assets/textures/environment/env-nebula-03.png', size: 0, format: 'png', tags: ['environment', 'skybox'] },
        { id: 'env-space-01', name: 'Space 01', type: 'texture', url: '/assets/textures/environment/env-space-01.png', size: 0, format: 'png', tags: ['environment', 'skybox'] },
        { id: 'env-space-02', name: 'Space 02', type: 'texture', url: '/assets/textures/environment/env-space-02.png', size: 0, format: 'png', tags: ['environment', 'skybox'] },
        { id: 'env-galaxy-01', name: 'Galaxy 01', type: 'texture', url: '/assets/textures/environment/env-galaxy-01.png', size: 0, format: 'png', tags: ['environment', 'skybox'] },
        { id: 'env-planet-01', name: 'Planet 01', type: 'texture', url: '/assets/textures/environment/env-planet-01.png', size: 0, format: 'png', tags: ['environment', 'planet'] },
        { id: 'env-planet-02', name: 'Planet 02', type: 'texture', url: '/assets/textures/environment/env-planet-02.png', size: 0, format: 'png', tags: ['environment', 'planet'] },
        { id: 'env-station-01', name: 'Station 01', type: 'texture', url: '/assets/textures/environment/env-station-01.png', size: 0, format: 'png', tags: ['environment', 'station'] }
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
        { id: 'tex-metal-gold', name: 'Gold Metal', type: 'texture', url: '/assets/textures/pbr/tex-metal-gold.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-metal-chrome', name: 'Chrome Metal', type: 'texture', url: '/assets/textures/pbr/tex-metal-chrome.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-carbon-01', name: 'Carbon Fiber', type: 'texture', url: '/assets/textures/pbr/tex-carbon-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-glass-01', name: 'Glass', type: 'texture', url: '/assets/textures/pbr/tex-glass-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-rock-01', name: 'Rock', type: 'texture', url: '/assets/textures/pbr/tex-rock-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-energy-01', name: 'Energy Field', type: 'texture', url: '/assets/textures/pbr/tex-energy-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-energy-red', name: 'Energy Red', type: 'texture', url: '/assets/textures/pbr/tex-energy-red.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-energy-green', name: 'Energy Green', type: 'texture', url: '/assets/textures/pbr/tex-energy-green.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-lava-01', name: 'Lava', type: 'texture', url: '/assets/textures/pbr/tex-lava-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-ice-01', name: 'Ice', type: 'texture', url: '/assets/textures/pbr/tex-ice-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-wood-01', name: 'Wood', type: 'texture', url: '/assets/textures/pbr/tex-wood-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-concrete-01', name: 'Concrete', type: 'texture', url: '/assets/textures/pbr/tex-concrete-01.png', size: 0, format: 'png', tags: ['pbr', 'material'] },
        { id: 'tex-hull-red', name: 'Hull Red', type: 'texture', url: '/assets/textures/pbr/tex-hull-red.png', size: 0, format: 'png', tags: ['hull', 'ship'] },
        { id: 'tex-hull-blue', name: 'Hull Blue', type: 'texture', url: '/assets/textures/pbr/tex-hull-blue.png', size: 0, format: 'png', tags: ['hull', 'ship'] },
        { id: 'tex-hull-purple', name: 'Hull Purple', type: 'texture', url: '/assets/textures/pbr/tex-hull-purple.png', size: 0, format: 'png', tags: ['hull', 'ship'] },
        { id: 'tex-hull-green', name: 'Hull Green', type: 'texture', url: '/assets/textures/pbr/tex-hull-green.png', size: 0, format: 'png', tags: ['hull', 'ship'] },
        { id: 'tex-hull-orange', name: 'Hull Orange', type: 'texture', url: '/assets/textures/pbr/tex-hull-orange.png', size: 0, format: 'png', tags: ['hull', 'ship'] },
        { id: 'tex-hull-white', name: 'Hull White', type: 'texture', url: '/assets/textures/pbr/tex-hull-white.png', size: 0, format: 'png', tags: ['hull', 'ship'] },
        { id: 'tex-hull-black', name: 'Hull Black', type: 'texture', url: '/assets/textures/pbr/tex-hull-black.png', size: 0, format: 'png', tags: ['hull', 'ship'] },
        { id: 'tex-hull-camo', name: 'Hull Camo', type: 'texture', url: '/assets/textures/pbr/tex-hull-camo.png', size: 0, format: 'png', tags: ['hull', 'ship'] }
      ],
      totalSize: 0
    },
    {
      id: 'textures-ui',
      name: 'UI Icons',
      description: 'UI图标',
      assets: [
        { id: 'icon-missile', name: 'Missile', type: 'texture', url: '/assets/textures/ui/icon-missile.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-shield', name: 'Shield', type: 'texture', url: '/assets/textures/ui/icon-shield.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-clock', name: 'Clock', type: 'texture', url: '/assets/textures/ui/icon-clock.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-zap', name: 'Zap', type: 'texture', url: '/assets/textures/ui/icon-zap.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-heart', name: 'Heart', type: 'texture', url: '/assets/textures/ui/icon-heart.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-star', name: 'Star', type: 'texture', url: '/assets/textures/ui/icon-star.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-coins', name: 'Coins', type: 'texture', url: '/assets/textures/ui/icon-coins.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-exp', name: 'Experience', type: 'texture', url: '/assets/textures/ui/icon-exp.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-gun', name: 'Gun', type: 'texture', url: '/assets/textures/ui/icon-gun.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-bomb', name: 'Bomb', type: 'texture', url: '/assets/textures/ui/icon-bomb.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-shoot', name: 'Shoot', type: 'texture', url: '/assets/textures/ui/icon-shoot.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-speed', name: 'Speed', type: 'texture', url: '/assets/textures/ui/icon-speed.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-damage', name: 'Damage', type: 'texture', url: '/assets/textures/ui/icon-damage.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-defense', name: 'Defense', type: 'texture', url: '/assets/textures/ui/icon-defense.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-heal', name: 'Heal', type: 'texture', url: '/assets/textures/ui/icon-heal.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-stealth', name: 'Stealth', type: 'texture', url: '/assets/textures/ui/icon-stealth.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-energy', name: 'Energy', type: 'texture', url: '/assets/textures/ui/icon-energy.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-reload', name: 'Reload', type: 'texture', url: '/assets/textures/ui/icon-reload.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-target', name: 'Target', type: 'texture', url: '/assets/textures/ui/icon-target.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-crosshair', name: 'Crosshair', type: 'texture', url: '/assets/textures/ui/icon-crosshair.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-map', name: 'Map', type: 'texture', url: '/assets/textures/ui/icon-map.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-settings', name: 'Settings', type: 'texture', url: '/assets/textures/ui/icon-settings.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-help', name: 'Help', type: 'texture', url: '/assets/textures/ui/icon-help.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-pause', name: 'Pause', type: 'texture', url: '/assets/textures/ui/icon-pause.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-play', name: 'Play', type: 'texture', url: '/assets/textures/ui/icon-play.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-resume', name: 'Resume', type: 'texture', url: '/assets/textures/ui/icon-resume.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-restart', name: 'Restart', type: 'texture', url: '/assets/textures/ui/icon-restart.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-exit', name: 'Exit', type: 'texture', url: '/assets/textures/ui/icon-exit.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-next', name: 'Next', type: 'texture', url: '/assets/textures/ui/icon-next.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-prev', name: 'Prev', type: 'texture', url: '/assets/textures/ui/icon-prev.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-upgrade', name: 'Upgrade', type: 'texture', url: '/assets/textures/ui/icon-upgrade.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-unlock', name: 'Unlock', type: 'texture', url: '/assets/textures/ui/icon-unlock.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-achieve', name: 'Achievement', type: 'texture', url: '/assets/textures/ui/icon-achieve.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-challenge', name: 'Challenge', type: 'texture', url: '/assets/textures/ui/icon-challenge.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-event', name: 'Event', type: 'texture', url: '/assets/textures/ui/icon-event.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-shop', name: 'Shop', type: 'texture', url: '/assets/textures/ui/icon-shop.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-inventory', name: 'Inventory', type: 'texture', url: '/assets/textures/ui/icon-inventory.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-character', name: 'Character', type: 'texture', url: '/assets/textures/ui/icon-character.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-skills', name: 'Skills', type: 'texture', url: '/assets/textures/ui/icon-skills.png', size: 0, format: 'png', tags: ['ui', 'icon'] },
        { id: 'icon-equipment', name: 'Equipment', type: 'texture', url: '/assets/textures/ui/icon-equipment.png', size: 0, format: 'png', tags: ['ui', 'icon'] }
      ],
      totalSize: 0
    },
    {
      id: 'textures-effects',
      name: 'Effect Textures',
      description: '特效贴图',
      assets: [
        { id: 'effect-explosion-01', name: 'Explosion 01', type: 'texture', url: '/assets/textures/effects/effect-explosion-01.png', size: 0, format: 'png', tags: ['effect', 'particle'] },
        { id: 'effect-explosion-02', name: 'Explosion 02', type: 'texture', url: '/assets/textures/effects/effect-explosion-02.png', size: 0, format: 'png', tags: ['effect', 'particle'] },
        { id: 'effect-fire-01', name: 'Fire 01', type: 'texture', url: '/assets/textures/effects/effect-fire-01.png', size: 0, format: 'png', tags: ['effect', 'particle'] },
        { id: 'effect-smoke-01', name: 'Smoke 01', type: 'texture', url: '/assets/textures/effects/effect-smoke-01.png', size: 0, format: 'png', tags: ['effect', 'particle'] },
        { id: 'effect-spark-01', name: 'Spark 01', type: 'texture', url: '/assets/textures/effects/effect-spark-01.png', size: 0, format: 'png', tags: ['effect', 'particle'] },
        { id: 'effect-laser-01', name: 'Laser 01', type: 'texture', url: '/assets/textures/effects/effect-laser-01.png', size: 0, format: 'png', tags: ['effect', 'particle'] },
        { id: 'effect-energyball-01', name: 'Energy Ball 01', type: 'texture', url: '/assets/textures/effects/effect-energyball-01.png', size: 0, format: 'png', tags: ['effect', 'particle'] },
        { id: 'effect-shockwave-01', name: 'Shockwave 01', type: 'texture', url: '/assets/textures/effects/effect-shockwave-01.png', size: 0, format: 'png', tags: ['effect', 'particle'] },
        { id: 'effect-trail-01', name: 'Trail 01', type: 'texture', url: '/assets/textures/effects/effect-trail-01.png', size: 0, format: 'png', tags: ['effect', 'particle'] },
        { id: 'effect-damage-01', name: 'Damage 01', type: 'texture', url: '/assets/textures/effects/effect-damage-01.png', size: 0, format: 'png', tags: ['effect', 'particle'] }
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
    },
    {
      id: 'weapons',
      name: 'Weapons',
      description: '武器配置',
      assets: [
        { id: 'weapon-laser', name: 'Laser Cannon', type: 'config', url: '/assets/weapons/weapon-laser.json', size: 0, format: 'json', tags: ['weapon'] },
        { id: 'weapon-missile', name: 'Missile Launcher', type: 'config', url: '/assets/weapons/weapon-missile.json', size: 0, format: 'json', tags: ['weapon'] },
        { id: 'weapon-plasma', name: 'Plasma Rifle', type: 'config', url: '/assets/weapons/weapon-plasma.json', size: 0, format: 'json', tags: ['weapon'] },
        { id: 'weapon-bomb', name: 'Cluster Bomb', type: 'config', url: '/assets/weapons/weapon-bomb.json', size: 0, format: 'json', tags: ['weapon'] },
        { id: 'weapon-sniper', name: 'Sniper Rifle', type: 'config', url: '/assets/weapons/weapon-sniper.json', size: 0, format: 'json', tags: ['weapon'] },
        { id: 'weapon-shotgun', name: 'Shotgun', type: 'config', url: '/assets/weapons/weapon-shotgun.json', size: 0, format: 'json', tags: ['weapon'] },
        { id: 'weapon-turret', name: 'Auto Turret', type: 'config', url: '/assets/weapons/weapon-turret.json', size: 0, format: 'json', tags: ['weapon'] },
        { id: 'weapon-gravity', name: 'Gravity Gun', type: 'config', url: '/assets/weapons/weapon-gravity.json', size: 0, format: 'json', tags: ['weapon'] },
        { id: 'weapon-blackhole', name: 'Black Hole Generator', type: 'config', url: '/assets/weapons/weapon-blackhole.json', size: 0, format: 'json', tags: ['weapon'] },
        { id: 'weapon-nuke', name: 'Nuclear Missile', type: 'config', url: '/assets/weapons/weapon-nuke.json', size: 0, format: 'json', tags: ['weapon'] }
      ],
      totalSize: 0
    },
    {
      id: 'skills',
      name: 'Skills',
      description: '技能配置',
      assets: [
        { id: 'skill-shield', name: 'Energy Shield', type: 'config', url: '/assets/skills/skill-shield.json', size: 0, format: 'json', tags: ['skill'] },
        { id: 'skill-speed', name: 'Afterburner', type: 'config', url: '/assets/skills/skill-speed.json', size: 0, format: 'json', tags: ['skill'] },
        { id: 'skill-heal', name: 'Nanobot Repair', type: 'config', url: '/assets/skills/skill-heal.json', size: 0, format: 'json', tags: ['skill'] },
        { id: 'skill-stealth', name: 'Cloaking Device', type: 'config', url: '/assets/skills/skill-stealth.json', size: 0, format: 'json', tags: ['skill'] },
        { id: 'skill-damage', name: 'Overcharge', type: 'config', url: '/assets/skills/skill-damage.json', size: 0, format: 'json', tags: ['skill'] },
        { id: 'skill-reload', name: 'Rapid Reload', type: 'config', url: '/assets/skills/skill-reload.json', size: 0, format: 'json', tags: ['skill'] },
        { id: 'skill-energy', name: 'Energy Surge', type: 'config', url: '/assets/skills/skill-energy.json', size: 0, format: 'json', tags: ['skill'] },
        { id: 'skill-time', name: 'Time Warp', type: 'config', url: '/assets/skills/skill-time.json', size: 0, format: 'json', tags: ['skill'] },
        { id: 'skill-rebirth', name: 'Emergency Protocol', type: 'config', url: '/assets/skills/skill-rebirth.json', size: 0, format: 'json', tags: ['skill'] },
        { id: 'skill-blackhole', name: 'Gravity Well', type: 'config', url: '/assets/skills/skill-blackhole.json', size: 0, format: 'json', tags: ['skill'] }
      ],
      totalSize: 0
    },
    {
      id: 'powerups',
      name: 'Powerups',
      description: '道具配置',
      assets: [
        { id: 'powerup-health', name: 'Health Pack', type: 'config', url: '/assets/powerups/powerup-health.json', size: 0, format: 'json', tags: ['powerup'] },
        { id: 'powerup-shield', name: 'Shield Battery', type: 'config', url: '/assets/powerups/powerup-shield.json', size: 0, format: 'json', tags: ['powerup'] },
        { id: 'powerup-energy', name: 'Energy Cell', type: 'config', url: '/assets/powerups/powerup-energy.json', size: 0, format: 'json', tags: ['powerup'] },
        { id: 'powerup-damage', name: 'Damage Boost', type: 'config', url: '/assets/powerups/powerup-damage.json', size: 0, format: 'json', tags: ['powerup'] },
        { id: 'powerup-speed', name: 'Speed Boost', type: 'config', url: '/assets/powerups/powerup-speed.json', size: 0, format: 'json', tags: ['powerup'] },
        { id: 'powerup-defense', name: 'Defense Matrix', type: 'config', url: '/assets/powerups/powerup-defense.json', size: 0, format: 'json', tags: ['powerup'] },
        { id: 'powerup-experience', name: 'XP Crystal', type: 'config', url: '/assets/powerups/powerup-experience.json', size: 0, format: 'json', tags: ['powerup'] },
        { id: 'powerup-credits', name: 'Credit Cache', type: 'config', url: '/assets/powerups/powerup-credits.json', size: 0, format: 'json', tags: ['powerup'] },
        { id: 'powerup-invincible', name: 'Invincibility', type: 'config', url: '/assets/powerups/powerup-invincible.json', size: 0, format: 'json', tags: ['powerup'] },
        { id: 'powerup-nuke', name: 'Emergency Nuke', type: 'config', url: '/assets/powerups/powerup-nuke.json', size: 0, format: 'json', tags: ['powerup'] }
      ],
      totalSize: 0
    },
    {
      id: 'ships',
      name: 'Ships',
      description: '飞船配置',
      assets: [
        { id: 'ship-fighter', name: 'Fighter', type: 'config', url: '/assets/ships/ship-fighter.json', size: 0, format: 'json', tags: ['ship', 'player'] },
        { id: 'ship-bomber', name: 'Bomber', type: 'config', url: '/assets/ships/ship-bomber.json', size: 0, format: 'json', tags: ['ship', 'player'] },
        { id: 'ship-cruiser', name: 'Cruiser', type: 'config', url: '/assets/ships/ship-cruiser.json', size: 0, format: 'json', tags: ['ship', 'player'] },
        { id: 'ship-stealth', name: 'Stealth', type: 'config', url: '/assets/ships/ship-stealth.json', size: 0, format: 'json', tags: ['ship', 'player'] },
        { id: 'ship-corvette', name: 'Corvette', type: 'config', url: '/assets/ships/ship-corvette.json', size: 0, format: 'json', tags: ['ship', 'player'] },
        { id: 'ship-dreadnought', name: 'Dreadnought', type: 'config', url: '/assets/ships/ship-dreadnought.json', size: 0, format: 'json', tags: ['ship', 'player'] }
      ],
      totalSize: 0
    },
    {
      id: 'enemies',
      name: 'Enemies',
      description: '敌人配置',
      assets: [
        { id: 'enemy-scout', name: 'Scout', type: 'config', url: '/assets/enemies/enemy-scout.json', size: 0, format: 'json', tags: ['enemy'] },
        { id: 'enemy-fighter', name: 'Fighter', type: 'config', url: '/assets/enemies/enemy-fighter.json', size: 0, format: 'json', tags: ['enemy'] },
        { id: 'enemy-bomber', name: 'Bomber', type: 'config', url: '/assets/enemies/enemy-bomber.json', size: 0, format: 'json', tags: ['enemy'] },
        { id: 'enemy-tank', name: 'Tank', type: 'config', url: '/assets/enemies/enemy-tank.json', size: 0, format: 'json', tags: ['enemy'] },
        { id: 'enemy-assassin', name: 'Assassin', type: 'config', url: '/assets/enemies/enemy-assassin.json', size: 0, format: 'json', tags: ['enemy'] },
        { id: 'enemy-drone', name: 'Drone', type: 'config', url: '/assets/enemies/enemy-drone.json', size: 0, format: 'json', tags: ['enemy'] },
        { id: 'enemy-corvette', name: 'Corvette', type: 'config', url: '/assets/enemies/enemy-corvette.json', size: 0, format: 'json', tags: ['enemy'] },
        { id: 'enemy-destroyer', name: 'Destroyer', type: 'config', url: '/assets/enemies/enemy-destroyer.json', size: 0, format: 'json', tags: ['enemy'] },
        { id: 'boss-sentinel', name: 'Sentinel', type: 'config', url: '/assets/enemies/boss-sentinel.json', size: 0, format: 'json', tags: ['enemy', 'boss'] },
        { id: 'boss-overlord', name: 'Overlord', type: 'config', url: '/assets/enemies/boss-overlord.json', size: 0, format: 'json', tags: ['enemy', 'boss'] }
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
  console.log('=== Generating Extended Game Assets ===\n');
  
  createDirIfNotExists(ASSETS_DIR);
  
  generateEnvironmentTextures();
  generatePBRTextures();
  generateHullTextures();
  generateUIIcons();
  generateEffectTextures();
  generateLevelConfigs();
  generateWeaponConfigs();
  generateSkillConfigs();
  generatePowerupConfigs();
  generateShipConfigs();
  generateEnemyConfigs();
  generateAssetManifest();
  
  console.log('\n=== Extended Asset Generation Complete ===');
  
  const totalSize = fs.statSync(ASSETS_DIR).size;
  console.log(`\nTotal assets size: ${(totalSize / 1024).toFixed(2)} KB`);
}

main();