const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const ASSETS_DIR = path.join(__dirname, '../public/assets');

function createDirIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateNebulaTexture(width, height, colors, name) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, width, height);
  
  for (let layer = 0; layer < 5; layer++) {
    const color = colors[layer % colors.length];
    const radius = Math.min(width, height) * (0.3 + layer * 0.1);
    const x = width * (0.3 + Math.random() * 0.4);
    const y = height * (0.3 + Math.random() * 0.4);
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, hexToRgba(color, 0.8 * (1 - layer * 0.15)));
    gradient.addColorStop(0.5, hexToRgba(color, 0.3 * (1 - layer * 0.15)));
    gradient.addColorStop(1, hexToRgba(color, 0));
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  addNoise(ctx, width, height, 0.3);
  
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(ASSETS_DIR, `textures/environment/${name}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${(buffer.length / 1024).toFixed(2)} KB)`);
}

function generatePBRTexture(width, height, type, name) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  if (type === 'metal') {
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, 0, width, height);
    
    const metalGradient = ctx.createLinearGradient(0, 0, width, height);
    metalGradient.addColorStop(0, 'rgba(255,255,255,0.1)');
    metalGradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    metalGradient.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = metalGradient;
    ctx.fillRect(0, 0, width, height);
    
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(60,60,60,${Math.random() * 0.3})`;
      ctx.fill();
    }
  } else if (type === 'carbon') {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = 'rgba(30,30,30,0.5)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * (height / 20));
      ctx.lineTo(width, i * (height / 20));
      ctx.stroke();
    }
    
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.moveTo(i * (width / 40), 0);
      ctx.lineTo(i * (width / 40), height);
      ctx.stroke();
    }
  } else if (type === 'glass') {
    ctx.fillStyle = 'rgba(100, 150, 200, 0.3)';
    ctx.fillRect(0, 0, width, height);
    
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (type === 'energy') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    for (let i = 0; i < 10; i++) {
      const y = height / 2 + (Math.random() - 0.5) * height * 0.5;
      const gradient = ctx.createLinearGradient(0, y - 20, 0, y + 20);
      gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
      gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.5)');
      gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y - 20, width, 40);
    }
  } else if (type === 'rock') {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, width, height);
    
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 8 + 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${50 + Math.random() * 50}, ${40 + Math.random() * 40}, ${30 + Math.random() * 30}, ${Math.random() * 0.5 + 0.3})`;
      ctx.fill();
    }
  }
  
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(ASSETS_DIR, `textures/pbr/${name}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${(buffer.length / 1024).toFixed(2)} KB)`);
}

function generateUIIcon(width, height, type, name) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, width, height);
  
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  if (type === 'missile') {
    ctx.beginPath();
    ctx.moveTo(width / 2, height * 0.2);
    ctx.lineTo(width / 2, height * 0.8);
    ctx.moveTo(width / 2, height * 0.6);
    ctx.lineTo(width * 0.3, height * 0.8);
    ctx.moveTo(width / 2, height * 0.6);
    ctx.lineTo(width * 0.7, height * 0.8);
    ctx.stroke();
  } else if (type === 'shield') {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, width * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width * 0.3, height * 0.5);
    ctx.lineTo(width * 0.7, height * 0.5);
    ctx.moveTo(width * 0.5, height * 0.3);
    ctx.lineTo(width * 0.5, height * 0.7);
    ctx.stroke();
  } else if (type === 'clock') {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, width * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width / 2, height / 2);
    ctx.lineTo(width / 2, height * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width / 2, height / 2);
    ctx.lineTo(width * 0.6, height / 2);
    ctx.stroke();
  } else if (type === 'zap') {
    ctx.beginPath();
    ctx.moveTo(width * 0.3, height * 0.3);
    ctx.lineTo(width * 0.5, height * 0.5);
    ctx.lineTo(width * 0.3, height * 0.7);
    ctx.lineTo(width * 0.7, height * 0.5);
    ctx.lineTo(width * 0.5, height * 0.3);
    ctx.lineTo(width * 0.7, height * 0.7);
    ctx.stroke();
  }
  
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(ASSETS_DIR, `textures/ui/${name}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${(buffer.length / 1024).toFixed(2)} KB)`);
}

function generateStarfield(width, height, name) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  
  const starCount = 500;
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 3 + 0.5;
    const alpha = Math.random() * 0.8 + 0.2;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();
  }
  
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(ASSETS_DIR, `textures/environment/${name}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${(buffer.length / 1024).toFixed(2)} KB)`);
}

function generateExplosionTexture(width, height, name) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, width, height);
  
  const colors = ['#ffffff', '#ffff00', '#ff8800', '#ff4400', '#ff0000'];
  
  for (let i = 0; i < 5; i++) {
    const radius = (width / 2) * (1 - i * 0.15);
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius);
    gradient.addColorStop(0, colors[i]);
    gradient.addColorStop(0.3, colors[i]);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(ASSETS_DIR, `textures/effects/${name}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${(buffer.length / 1024).toFixed(2)} KB)`);
}

function generateHullTexture(width, height, color, stripeColor, name) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  
  const stripeCount = 3;
  const stripeSpacing = height / (stripeCount + 1);
  for (let i = 1; i <= stripeCount; i++) {
    const y = stripeSpacing * i;
    const gradient = ctx.createLinearGradient(0, y - 5, 0, y + 5);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, stripeColor);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y - 5, width, 10);
  }
  
  const metalGradient = ctx.createLinearGradient(0, 0, width, height);
  metalGradient.addColorStop(0, 'rgba(255,255,255,0.05)');
  metalGradient.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  metalGradient.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = metalGradient;
  ctx.fillRect(0, 0, width, height);
  
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(ASSETS_DIR, `textures/pbr/${name}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${(buffer.length / 1024).toFixed(2)} KB)`);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function addNoise(ctx, width, height, intensity) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 255 * intensity;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  
  ctx.putImageData(imageData, 0, 0);
}

function generateLevelConfig(index, name, difficulty) {
  const config = {
    id: `level-${String(index).padStart(2, '0')}`,
    name,
    description: `Level ${index}: ${name}`,
    difficulty,
    environment: {
      skybox: index % 2 === 0 ? 'env-space-01' : 'env-nebula-01',
      nebula: index % 2 !== 0,
      asteroidField: index % 3 === 0,
      lighting: index === 5 || index === 10 ? 'dramatic' : 'normal'
    },
    player: {
      health: 100 + (index - 1) * 10,
      shield: 50 + (index - 1) * 8,
      maxHealth: 100 + (index - 1) * 10,
      maxShield: 50 + (index - 1) * 8,
      startingPosition: { x: 0, y: 0, z: 0 }
    },
    waves: [
      {
        number: 1,
        enemies: [
          { type: 'enemy-scout', count: 3 + index, spawnDelay: 1000 }
        ],
        objectives: ['Destroy all enemies']
      },
      {
        number: 2,
        enemies: [
          { type: 'enemy-fighter', count: 2 + Math.floor(index / 2), spawnDelay: 800 }
        ],
        objectives: ['Destroy all enemies']
      }
    ],
    rewards: {
      experience: 100 + (index - 1) * 50,
      credits: 500 + (index - 1) * 250,
      unlocks: []
    }
  };
  
  if (index === 5 || index === 10) {
    config.waves.push({
      number: 3,
      enemies: [
        { type: index === 5 ? 'boss-sentinel' : 'boss-overlord', count: 1, spawnDelay: 3000 }
      ],
      objectives: ['Defeat the boss']
    });
  }
  
  const filePath = path.join(ASSETS_DIR, `levels/level-${String(index).padStart(2, '0')}.json`);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  console.log(`Generated: ${filePath}`);
}

function main() {
  console.log('=== Generating Game Assets ===\n');
  
  createDirIfNotExists(path.join(ASSETS_DIR, 'textures/environment'));
  createDirIfNotExists(path.join(ASSETS_DIR, 'textures/pbr'));
  createDirIfNotExists(path.join(ASSETS_DIR, 'textures/ui'));
  createDirIfNotExists(path.join(ASSETS_DIR, 'textures/effects'));
  createDirIfNotExists(path.join(ASSETS_DIR, 'levels'));
  
  console.log('--- Environment Textures ---\n');
  generateNebulaTexture(2048, 1024, ['#ff6b6b', '#4ecdc4', '#45b7d1'], 'env-nebula-01');
  generateNebulaTexture(2048, 1024, ['#9b59b6', '#3498db', '#e74c3c'], 'env-nebula-02');
  generateStarfield(2048, 1024, 'env-space-01');
  generateStarfield(2048, 1024, 'env-space-02');
  
  console.log('\n--- PBR Textures ---\n');
  generatePBRTexture(1024, 1024, 'metal', 'tex-metal-01');
  generatePBRTexture(1024, 1024, 'metal', 'tex-metal-02');
  generatePBRTexture(1024, 1024, 'carbon', 'tex-carbon-01');
  generatePBRTexture(1024, 1024, 'glass', 'tex-glass-01');
  generatePBRTexture(1024, 1024, 'rock', 'tex-rock-01');
  generatePBRTexture(1024, 1024, 'energy', 'tex-energy-01');
  
  console.log('\n--- Hull Textures ---\n');
  generateHullTexture(1024, 1024, '#333333', '#ff6b6b', 'tex-hull-red');
  generateHullTexture(1024, 1024, '#2c3e50', '#3498db', 'tex-hull-blue');
  generateHullTexture(1024, 1024, '#1a1a2e', '#9b59b6', 'tex-hull-purple');
  generateHullTexture(1024, 1024, '#2d3436', '#00b894', 'tex-hull-green');
  
  console.log('\n--- UI Icons ---\n');
  generateUIIcon(64, 64, 'missile', 'icon-missile');
  generateUIIcon(64, 64, 'shield', 'icon-shield');
  generateUIIcon(64, 64, 'clock', 'icon-clock');
  generateUIIcon(64, 64, 'zap', 'icon-zap');
  
  console.log('\n--- Effect Textures ---\n');
  generateExplosionTexture(512, 512, 'effect-explosion-01');
  generateExplosionTexture(512, 512, 'effect-explosion-02');
  
  console.log('\n--- Level Configs ---\n');
  const levelNames = [
    'First Contact', 'The Asteroid Field', 'Station Defense', 'Deep Space', 'Boss: Sentinel',
    'Hidden Base', 'Fleet Battle', 'The Maelstrom', 'Final Approach', 'Boss: Overlord'
  ];
  const difficulties = ['easy', 'easy', 'medium', 'medium', 'hard', 'medium', 'hard', 'hard', 'hard', 'extreme'];
  
  levelNames.forEach((name, index) => {
    generateLevelConfig(index + 1, name, difficulties[index]);
  });
  
  console.log('\n=== Asset Generation Complete ===');
}

main();
