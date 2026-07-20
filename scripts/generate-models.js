const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '../public/assets/models');
const TEXTURES_DIR = path.join(__dirname, '../public/assets/textures/pbr');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createTextureData(width, height, type, color) {
  const pixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r, g, b, a = 255;
      
      if (type === 'metal') {
        const noise = (Math.sin(x * 0.1) * Math.cos(y * 0.1) + 1) * 0.5;
        const base = color || [180, 180, 200];
        r = Math.floor(base[0] * (0.7 + noise * 0.3));
        g = Math.floor(base[1] * (0.7 + noise * 0.3));
        b = Math.floor(base[2] * (0.7 + noise * 0.3));
      } else if (type === 'carbon') {
        const gridX = Math.floor(x / 4) % 2;
        const gridY = Math.floor(y / 4) % 2;
        if ((gridX + gridY) % 2 === 0) {
          r = 30; g = 30; b = 35;
        } else {
          r = 50; g = 50; b = 55;
        }
        const noise = Math.random() * 20;
        r += noise; g += noise; b += noise;
      } else if (type === 'energy') {
        const cx = width / 2, cy = height / 2;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const maxDist = Math.min(width, height) / 2;
        const factor = Math.max(0, 1 - dist / maxDist);
        const ec = color || [100, 200, 255];
        r = Math.floor(ec[0] * factor);
        g = Math.floor(ec[1] * factor);
        b = Math.floor(ec[2] * factor);
        a = Math.floor(255 * factor);
      } else if (type === 'hull') {
        const noise = (Math.sin(x * 0.05 + y * 0.07) + Math.cos(x * 0.08)) * 0.5 + 0.5;
        const base = color || [60, 60, 70];
        r = Math.floor(base[0] + noise * 30);
        g = Math.floor(base[1] + noise * 30);
        b = Math.floor(base[2] + noise * 30);
      } else {
        r = color ? color[0] : 128;
        g = color ? color[1] : 128;
        b = color ? color[2] : 128;
      }
      
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      
      pixels.push(r, g, b, a);
    }
  }
  return Buffer.from(pixels);
}

function createPNG(width, height, pixels) {
  const PNG = require('pngjs').PNG;
  const png = new PNG({ width, height });
  for (let i = 0; i < pixels.length; i++) {
    png.data[i] = pixels[i];
  }
  return PNG.sync.write(png);
}

function generateTextures() {
  ensureDir(TEXTURES_DIR);
  
  const textures = [
    { name: 'tex-hull-blue', type: 'hull', color: [50, 80, 120] },
    { name: 'tex-hull-red', type: 'hull', color: [120, 50, 50] },
    { name: 'tex-hull-green', type: 'hull', color: [50, 100, 70] },
    { name: 'tex-hull-white', type: 'hull', color: [180, 180, 190] },
    { name: 'tex-hull-black', type: 'hull', color: [30, 30, 35] },
    { name: 'tex-hull-purple', type: 'hull', color: [80, 50, 120] },
    { name: 'tex-hull-orange', type: 'hull', color: [150, 80, 30] },
    { name: 'tex-metal-chrome', type: 'metal', color: [220, 220, 230] },
    { name: 'tex-metal-gold', type: 'metal', color: [200, 180, 100] },
    { name: 'tex-metal-dark', type: 'metal', color: [80, 80, 90] },
    { name: 'tex-carbon-fiber', type: 'carbon' },
    { name: 'tex-energy-blue', type: 'energy', color: [50, 150, 255] },
    { name: 'tex-energy-red', type: 'energy', color: [255, 50, 50] },
    { name: 'tex-energy-green', type: 'energy', color: [50, 200, 100] },
    { name: 'tex-energy-purple', type: 'energy', color: [150, 50, 200] },
    { name: 'tex-glass-cockpit', type: 'energy', color: [80, 120, 180] },
    { name: 'tex-rock-asteroid', type: 'hull', color: [70, 60, 50] },
    { name: 'tex-space-station', type: 'metal', color: [150, 150, 160] },
  ];
  
  textures.forEach(t => {
    const pixels = createTextureData(256, 256, t.type, t.color);
    const png = createPNG(256, 256, pixels);
    fs.writeFileSync(path.join(TEXTURES_DIR, `${t.name}.png`), png);
    console.log(`✅ Generated texture: ${t.name}.png`);
  });
  
  return textures.map(t => `${t.name}.png`);
}

function createGLB(vertices, indices, normals, uvs, materialColor, textureName = null) {
  const positions = [];
  for (const v of vertices) {
    positions.push(v.x, v.y, v.z);
  }
  
  const normArr = [];
  for (const n of normals) {
    normArr.push(n.x, n.y, n.z);
  }
  
  const uvArr = [];
  for (const uv of uvs) {
    uvArr.push(uv.x, uv.y);
  }
  
  const posBuffer = Buffer.alloc(positions.length * 4);
  positions.forEach((v, i) => posBuffer.writeFloatLE(v, i * 4));
  
  const normBuffer = Buffer.alloc(normArr.length * 4);
  normArr.forEach((v, i) => normBuffer.writeFloatLE(v, i * 4));
  
  const uvBuffer = Buffer.alloc(uvArr.length * 4);
  uvArr.forEach((v, i) => uvBuffer.writeFloatLE(v, i * 4));
  
  const indexBuffer = Buffer.alloc(indices.length * 2);
  indices.forEach((v, i) => indexBuffer.writeUInt16LE(v, i * 2));
  
  const combinedBuffer = Buffer.concat([posBuffer, normBuffer, uvBuffer, indexBuffer]);
  
  const accessorCount = positions.length / 3;
  
  const materials = [];
  const textureUri = textureName ? `../textures/pbr/${textureName}` : null;
  
  if (textureName) {
    materials.push({
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0, texCoord: 0 },
        metallicFactor: 0.8,
        roughnessFactor: 0.2,
      },
      normalTexture: { index: 0, texCoord: 0 },
    });
  } else {
    materials.push({
      pbrMetallicRoughness: {
        baseColorFactor: materialColor,
        metallicFactor: 0.8,
        roughnessFactor: 0.2,
      },
    });
  }
  
  const images = textureUri ? [{ uri: textureUri }] : [];
  const textures = textureUri ? [{ source: 0 }] : [];
  
  const json = {
    asset: { version: '2.0', generator: 'FighterGame Model Generator v2' },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: {
          POSITION: 0,
          NORMAL: 1,
          TEXCOORD_0: 2,
        },
        indices: 3,
        material: 0,
      }],
    }],
    materials,
    textures,
    images,
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: accessorCount,
        type: 'VEC3',
        max: positions.slice(-3),
        min: positions.slice(0, 3),
      },
      {
        bufferView: 0,
        byteOffset: posBuffer.length,
        componentType: 5126,
        count: normArr.length / 3,
        type: 'VEC3',
        max: [1, 1, 1],
        min: [-1, -1, -1],
      },
      {
        bufferView: 0,
        byteOffset: posBuffer.length + normBuffer.length,
        componentType: 5126,
        count: uvArr.length / 2,
        type: 'VEC2',
        max: [1, 1],
        min: [0, 0],
      },
      {
        bufferView: 0,
        byteOffset: posBuffer.length + normBuffer.length + uvBuffer.length,
        componentType: 5123,
        count: indices.length,
        type: 'SCALAR',
      },
    ],
    bufferViews: [{
      buffer: 0,
      byteOffset: 0,
      byteLength: combinedBuffer.length,
      target: 34963,
    }],
    buffers: [{
      byteLength: combinedBuffer.length,
    }],
  };
  
  const jsonStr = JSON.stringify(json);
  const jsonBuffer = Buffer.from(jsonStr, 'utf8');
  
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0);
  header.writeUInt32LE(jsonBuffer.length, 4);
  header.writeUInt32LE(combinedBuffer.length, 8);
  
  return Buffer.concat([header, jsonBuffer, combinedBuffer]);
}

function createBox(halfSize, color, textureName) {
  const hs = halfSize;
  const vertices = [
    { x: -hs, y: -hs, z: -hs }, { x: hs, y: -hs, z: -hs },
    { x: hs, y: hs, z: -hs }, { x: -hs, y: hs, z: -hs },
    { x: -hs, y: -hs, z: hs }, { x: hs, y: -hs, z: hs },
    { x: hs, y: hs, z: hs }, { x: -hs, y: hs, z: hs },
  ];
  
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 0, 3, 4, 3, 7,
    5, 4, 7, 5, 7, 6,
    1, 5, 6, 1, 6, 2,
    3, 2, 6, 3, 6, 7,
    4, 5, 1, 4, 1, 0,
  ];
  
  const normals = [
    { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 },
    { x: -1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 0, y: -1, z: 0 }, { x: 0, y: -1, z: 0 },
  ];
  
  const uvs = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  ];
  
  return createGLB(vertices, indices, normals, uvs, color, textureName);
}

function createSphere(radius, color, textureName) {
  const vertices = [];
  const indices = [];
  const normals = [];
  const uvs = [];
  
  const latBands = 24;
  const longBands = 24;
  
  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    
    for (let lon = 0; lon <= longBands; lon++) {
      const phi = (lon * 2 * Math.PI) / longBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      
      const x = cosPhi * sinTheta * radius;
      const y = cosTheta * radius;
      const z = sinPhi * sinTheta * radius;
      
      vertices.push({ x, y, z });
      normals.push({ x: x / radius, y: y / radius, z: z / radius });
      uvs.push({ x: lon / longBands, y: 1 - lat / latBands });
    }
  }
  
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < longBands; lon++) {
      const a = lat * (longBands + 1) + lon;
      const b = a + longBands + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }
  
  return createGLB(vertices, indices, normals, uvs, color, textureName);
}

function createCone(radius, height, color, textureName) {
  const vertices = [];
  const indices = [];
  const normals = [];
  const uvs = [];
  
  const segments = 16;
  const tip = { x: 0, y: height / 2, z: 0 };
  const baseCenter = { x: 0, y: -height / 2, z: 0 };
  
  vertices.push(tip);
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    vertices.push({ x, y: -height / 2, z });
  }
  
  for (let i = 0; i < segments; i++) {
    indices.push(0, i + 1, i + 2);
    indices.push(i + 1, i + 2, segments + 2);
  }
  
  const coneNormal = { x: 0, y: -1, z: 0 };
  for (let i = 0; i <= segments + 1; i++) {
    normals.push(coneNormal);
    uvs.push({ x: Math.random(), y: Math.random() });
  }
  
  return createGLB(vertices, indices, normals, uvs, color, textureName);
}

function createCylinder(radius, height, color, textureName) {
  const vertices = [];
  const indices = [];
  const normals = [];
  const uvs = [];
  
  const segments = 16;
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    vertices.push({ x, y: height / 2, z });
    vertices.push({ x, y: -height / 2, z });
  }
  
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = b + 2;
    indices.push(a, c, d);
    indices.push(a, d, b);
  }
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    normals.push({ x: Math.cos(angle), y: 0, z: Math.sin(angle) });
    normals.push({ x: Math.cos(angle), y: 0, z: Math.sin(angle) });
    uvs.push({ x: i / segments, y: 0 });
    uvs.push({ x: i / segments, y: 1 });
  }
  
  return createGLB(vertices, indices, normals, uvs, color, textureName);
}

function createFighterShip(color, textureName) {
  const vertices = [
    { x: 0, y: 0, z: 1.5 },
    { x: 0.7, y: 0, z: 0 },
    { x: 0.5, y: 0.3, z: -0.8 },
    { x: 0.5, y: -0.3, z: -0.8 },
    { x: -0.7, y: 0, z: 0 },
    { x: -0.5, y: 0.3, z: -0.8 },
    { x: -0.5, y: -0.3, z: -0.8 },
    { x: 0, y: 0, z: -1.2 },
    { x: 1.1, y: 0, z: -0.4 },
    { x: -1.1, y: 0, z: -0.4 },
    { x: 0.25, y: 0, z: 0.8 },
    { x: -0.25, y: 0, z: 0.8 },
    { x: 0, y: 0.15, z: 0.6 },
    { x: 0, y: -0.15, z: 0.6 },
    { x: 0.15, y: 0.08, z: 0.3 },
    { x: -0.15, y: 0.08, z: 0.3 },
    { x: 0.15, y: -0.08, z: 0.3 },
    { x: -0.15, y: -0.08, z: 0.3 },
  ];
  
  const indices = [
    0, 1, 2, 0, 2, 7, 0, 7, 3, 0, 3, 1,
    0, 4, 5, 0, 5, 7, 0, 7, 6, 0, 6, 4,
    1, 3, 8, 3, 7, 8, 8, 7, 9, 7, 6, 9,
    9, 6, 4, 4, 6, 5, 2, 1, 8, 6, 2, 7,
    5, 4, 9, 2, 14, 3, 3, 14, 7, 5, 15, 6,
    12, 13, 14, 12, 14, 16, 13, 17, 14, 17, 16, 14,
    10, 11, 12, 10, 12, 14, 11, 17, 13, 11, 13, 15,
  ];
  
  const normals = [];
  const uvs = [];
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    normals.push(len > 0 ? { x: v.x / len, y: v.y / len, z: v.z / len } : { x: 0, y: 0, z: 1 });
    uvs.push({ x: (v.x + 1) / 2, y: (v.z + 1) / 2 });
  }
  
  return createGLB(vertices, indices, normals, uvs, color, textureName);
}

function createEnemyShip(color, textureName) {
  const vertices = [
    { x: 0, y: 0, z: -1.2 },
    { x: 0.6, y: 0, z: 0 },
    { x: 0.4, y: 0.25, z: 0.8 },
    { x: 0.4, y: -0.25, z: 0.8 },
    { x: -0.6, y: 0, z: 0 },
    { x: -0.4, y: 0.25, z: 0.8 },
    { x: -0.4, y: -0.25, z: 0.8 },
    { x: 0, y: 0, z: 1 },
    { x: 0.9, y: 0, z: 0.4 },
    { x: -0.9, y: 0, z: 0.4 },
    { x: 0, y: 0.35, z: 0 },
    { x: 0, y: -0.35, z: 0 },
    { x: 0.3, y: 0.15, z: -0.5 },
    { x: -0.3, y: 0.15, z: -0.5 },
    { x: 0.3, y: -0.15, z: -0.5 },
    { x: -0.3, y: -0.15, z: -0.5 },
  ];
  
  const indices = [
    0, 1, 2, 0, 2, 7, 0, 7, 3, 0, 3, 1,
    0, 4, 5, 0, 5, 7, 0, 7, 6, 0, 6, 4,
    1, 3, 8, 3, 7, 8, 8, 7, 9, 7, 6, 9,
    9, 6, 4, 4, 6, 5, 2, 1, 8, 6, 2, 7,
    5, 4, 9, 2, 10, 3, 3, 10, 7, 5, 11, 6,
    10, 11, 12, 10, 12, 14, 11, 15, 12, 11, 12, 13,
  ];
  
  const normals = [];
  const uvs = [];
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    normals.push(len > 0 ? { x: -v.x / len, y: v.y / len, z: -v.z / len } : { x: 0, y: 0, z: -1 });
    uvs.push({ x: (v.x + 1) / 2, y: (v.z + 1) / 2 });
  }
  
  return createGLB(vertices, indices, normals, uvs, color, textureName);
}

function createAsteroid(color, textureName) {
  const vertices = [];
  const indices = [];
  const normals = [];
  const uvs = [];
  
  const radius = 1;
  const latBands = 16;
  const longBands = 16;
  
  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    for (let lon = 0; lon <= longBands; lon++) {
      const phi = (lon * 2 * Math.PI) / longBands;
      
      const noise = 0.15 * (Math.sin(lat * 0.5) + Math.cos(lon * 0.7) + Math.sin(lat * lon * 0.02)) + 0.1 * (Math.random() - 0.5);
      const r = radius + noise;
      
      const x = Math.cos(phi) * Math.sin(theta) * r;
      const y = Math.cos(theta) * r;
      const z = Math.sin(phi) * Math.sin(theta) * r;
      
      vertices.push({ x, y, z });
      normals.push({ x: x / r, y: y / r, z: z / r });
      uvs.push({ x: lon / longBands, y: 1 - lat / latBands });
    }
  }
  
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < longBands; lon++) {
      const a = lat * (longBands + 1) + lon;
      const b = a + longBands + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }
  
  return createGLB(vertices, indices, normals, uvs, color, textureName);
}

function createSpaceStation(color, textureName) {
  const vertices = [];
  const indices = [];
  const normals = [];
  const uvs = [];
  
  const baseVertices = [];
  const stationRadius = 2;
  const segments = 24;
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * stationRadius;
    const z = Math.sin(angle) * stationRadius;
    
    baseVertices.push({ x, y: 0, z });
    baseVertices.push({ x, y: 0.2, z });
    baseVertices.push({ x, y: 0.5, z });
    baseVertices.push({ x, y: 0.8, z });
    
    if (i > 0) {
      const idx = (i - 1) * 4;
      indices.push(idx, idx + 4, idx + 5);
      indices.push(idx, idx + 5, idx + 1);
      indices.push(idx + 1, idx + 5, idx + 6);
      indices.push(idx + 1, idx + 6, idx + 2);
      indices.push(idx + 2, idx + 6, idx + 7);
      indices.push(idx + 2, idx + 7, idx + 3);
    }
  }
  
  const centerHeight = 3;
  for (let i = -1; i <= 1; i++) {
    baseVertices.push({ x: 0, y: i * centerHeight / 2, z: 0 });
    baseVertices.push({ x: 0.8, y: i * centerHeight / 2, z: 0 });
    baseVertices.push({ x: 0, y: i * centerHeight / 2, z: 0.8 });
  }
  
  vertices.push(...baseVertices);
  
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    normals.push({ x: v.x / len, y: v.y / len, z: v.z / len });
    uvs.push({ x: (v.x + stationRadius) / (stationRadius * 2), y: (v.y + centerHeight) / (centerHeight * 2) });
  }
  
  return createGLB(vertices, indices, normals, uvs, color, textureName);
}

const MODELS = [
  { id: 'ship-fighter', category: 'ships', type: 'fighter', color: [0.2, 0.5, 0.9, 1], texture: 'tex-hull-blue.png' },
  { id: 'ship-bomber', category: 'ships', type: 'box', color: [0.6, 0.2, 0.6, 1], size: 1.2, texture: 'tex-hull-purple.png' },
  { id: 'ship-cruiser', category: 'ships', type: 'fighter', color: [0.8, 0.8, 0.8, 1], texture: 'tex-hull-white.png' },
  { id: 'ship-stealth', category: 'ships', type: 'fighter', color: [0.15, 0.15, 0.2, 1], texture: 'tex-hull-black.png' },
  { id: 'ship-corvette', category: 'ships', type: 'fighter', color: [0.3, 0.6, 0.3, 1], texture: 'tex-hull-green.png' },
  { id: 'ship-dreadnought', category: 'ships', type: 'box', color: [0.8, 0.6, 0.2, 1], size: 1.5, texture: 'tex-metal-gold.png' },
  
  { id: 'enemy-scout', category: 'enemies', type: 'sphere', color: [0.5, 0.5, 0.5, 1], radius: 0.3, texture: 'tex-metal-dark.png' },
  { id: 'enemy-fighter', category: 'enemies', type: 'enemy', color: [0.8, 0.2, 0.2, 1], texture: 'tex-hull-red.png' },
  { id: 'enemy-bomber', category: 'enemies', type: 'box', color: [0.6, 0.3, 0.1, 1], size: 0.8, texture: 'tex-hull-orange.png' },
  { id: 'enemy-tank', category: 'enemies', type: 'box', color: [0.3, 0.3, 0.4, 1], size: 0.9, texture: 'tex-metal-dark.png' },
  { id: 'enemy-assassin', category: 'enemies', type: 'enemy', color: [0.3, 0.1, 0.3, 1], texture: 'tex-hull-purple.png' },
  { id: 'enemy-drone', category: 'enemies', type: 'sphere', color: [0.4, 0.4, 0.4, 1], radius: 0.2, texture: 'tex-metal-dark.png' },
  { id: 'enemy-corvette', category: 'enemies', type: 'enemy', color: [0.2, 0.4, 0.6, 1], texture: 'tex-hull-blue.png' },
  { id: 'enemy-destroyer', category: 'enemies', type: 'box', color: [0.5, 0.2, 0.3, 1], size: 1.0, texture: 'tex-hull-red.png' },
  
  { id: 'boss-sentinel', category: 'bosses', type: 'box', color: [0.7, 0.7, 0.1, 1], size: 2.0, texture: 'tex-energy-green.png' },
  { id: 'boss-overlord', category: 'bosses', type: 'sphere', color: [0.1, 0.1, 0.3, 1], radius: 1.8, texture: 'tex-energy-purple.png' },
  { id: 'boss-collector', category: 'bosses', type: 'sphere', color: [0.9, 0.5, 0.1, 1], radius: 1.5, texture: 'tex-energy-red.png' },
  { id: 'boss-tyrant', category: 'bosses', type: 'box', color: [0.6, 0.1, 0.1, 1], size: 2.2, texture: 'tex-hull-red.png' },
  
  { id: 'structure-space-station', category: 'structures', type: 'station', color: [0.7, 0.7, 0.8, 1], texture: 'tex-space-station.png' },
  { id: 'structure-asteroid-small', category: 'structures', type: 'asteroid', color: [0.5, 0.4, 0.3, 1], texture: 'tex-rock-asteroid.png' },
  { id: 'structure-asteroid-large', category: 'structures', type: 'asteroid', color: [0.4, 0.35, 0.25, 1], texture: 'tex-rock-asteroid.png' },
  { id: 'structure-debris', category: 'structures', type: 'box', color: [0.3, 0.3, 0.3, 1], size: 0.5, texture: 'tex-metal-dark.png' },
  { id: 'structure-satellite', category: 'structures', type: 'sphere', color: [0.6, 0.6, 0.6, 1], radius: 0.4, texture: 'tex-metal-chrome.png' },
  { id: 'structure-mining-rig', category: 'structures', type: 'box', color: [0.5, 0.4, 0.2, 1], size: 1.5, texture: 'tex-metal-dark.png' },
  { id: 'structure-defense-platform', category: 'structures', type: 'box', color: [0.2, 0.5, 0.8, 1], size: 1.8, texture: 'tex-hull-blue.png' },
  { id: 'structure-planet', category: 'structures', type: 'sphere', color: [0.2, 0.4, 0.8, 1], radius: 3.0, texture: 'tex-energy-blue.png' },
  { id: 'structure-moon', category: 'structures', type: 'sphere', color: [0.7, 0.7, 0.7, 1], radius: 1.0, texture: 'tex-metal-chrome.png' },
  { id: 'structure-nebula', category: 'structures', type: 'sphere', color: [0.5, 0.3, 0.7, 1], radius: 2.0, texture: 'tex-energy-purple.png' },
  
  { id: 'projectile-laser', category: 'projectiles', type: 'cylinder', color: [0.1, 0.8, 0.1, 1], radius: 0.08, height: 0.5, texture: 'tex-energy-green.png' },
  { id: 'projectile-missile', category: 'projectiles', type: 'box', color: [0.6, 0.6, 0.6, 1], size: 0.2, texture: 'tex-metal-dark.png' },
  { id: 'projectile-plasma', category: 'projectiles', type: 'sphere', color: [0.8, 0.2, 0.8, 1], radius: 0.2, texture: 'tex-energy-purple.png' },
  { id: 'projectile-bomb', category: 'projectiles', type: 'box', color: [0.3, 0.3, 0.3, 1], size: 0.3, texture: 'tex-metal-dark.png' },
  { id: 'projectile-sniper', category: 'projectiles', type: 'cylinder', color: [0.9, 0.9, 0.9, 1], radius: 0.05, height: 0.4, texture: 'tex-metal-chrome.png' },
  { id: 'projectile-shotgun', category: 'projectiles', type: 'sphere', color: [0.7, 0.5, 0.2, 1], radius: 0.15, texture: 'tex-energy-red.png' },
  { id: 'projectile-nuke', category: 'projectiles', type: 'box', color: [0.8, 0.1, 0.1, 1], size: 0.4, texture: 'tex-energy-red.png' },
  { id: 'projectile-blackhole', category: 'projectiles', type: 'sphere', color: [0, 0, 0, 1], radius: 0.3, texture: 'tex-energy-purple.png' },
  { id: 'projectile-gravity', category: 'projectiles', type: 'sphere', color: [0.3, 0.3, 0.8, 1], radius: 0.25, texture: 'tex-energy-blue.png' },
  
  { id: 'effect-explosion', category: 'effects', type: 'sphere', color: [1, 0.5, 0, 1], radius: 0.5, texture: 'tex-energy-red.png' },
  { id: 'effect-shield', category: 'effects', type: 'sphere', color: [0.2, 0.6, 1, 0.5], radius: 1.0, texture: 'tex-energy-blue.png' },
  { id: 'effect-heal', category: 'effects', type: 'sphere', color: [0.2, 1, 0.4, 0.5], radius: 0.4, texture: 'tex-energy-green.png' },
  { id: 'effect-powerup', category: 'effects', type: 'sphere', color: [1, 0.8, 0.2, 1], radius: 0.3, texture: 'tex-energy-green.png' },
  { id: 'effect-trail', category: 'effects', type: 'cylinder', color: [0.5, 0.5, 0.5, 0.5], radius: 0.1, height: 0.6, texture: 'tex-energy-blue.png' },
  { id: 'effect-damage', category: 'effects', type: 'sphere', color: [1, 0, 0, 0.5], radius: 0.3, texture: 'tex-energy-red.png' },
  { id: 'effect-victory', category: 'effects', type: 'sphere', color: [1, 1, 0, 1], radius: 0.6, texture: 'tex-energy-green.png' },
  { id: 'effect-death', category: 'effects', type: 'sphere', color: [0.5, 0.5, 0.5, 0.5], radius: 0.5, texture: 'tex-metal-dark.png' },
];

function generateModel(model) {
  let glbBuffer;
  
  switch (model.type) {
    case 'fighter':
      glbBuffer = createFighterShip(model.color, model.texture);
      break;
    case 'enemy':
      glbBuffer = createEnemyShip(model.color, model.texture);
      break;
    case 'sphere':
      glbBuffer = createSphere(model.radius || 0.5, model.color, model.texture);
      break;
    case 'box':
      glbBuffer = createBox(model.size || 0.5, model.color, model.texture);
      break;
    case 'cylinder':
      glbBuffer = createCylinder(model.radius || 0.1, model.height || 0.5, model.color, model.texture);
      break;
    case 'cone':
      glbBuffer = createCone(model.radius || 0.5, model.height || 1, model.color, model.texture);
      break;
    case 'asteroid':
      glbBuffer = createAsteroid(model.color, model.texture);
      break;
    case 'station':
      glbBuffer = createSpaceStation(model.color, model.texture);
      break;
    default:
      glbBuffer = createBox(0.5, model.color, model.texture);
  }
  
  return glbBuffer;
}

function main() {
  console.log('========================================');
  console.log('GLB Model Generator v2 - Enhanced');
  console.log('========================================\n');
  
  console.log('[1/2] Generating PBR textures...');
  generateTextures();
  console.log('\n');
  
  console.log('[2/2] Generating GLB models...');
  let count = 0;
  
  for (const model of MODELS) {
    const categoryDir = path.join(MODELS_DIR, model.category);
    const filePath = path.join(categoryDir, `${model.id}.glb`);
    
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }
    
    const glbBuffer = generateModel(model);
    fs.writeFileSync(filePath, glbBuffer);
    
    count++;
    console.log(`✅ Generated ${model.id} (${(glbBuffer.length / 1024).toFixed(2)} KB) ${model.texture ? `[${model.texture}]` : ''}`);
  }
  
  console.log('\n========================================');
  console.log(`Generated ${count} GLB models with textures`);
  console.log('========================================');
}

main();
