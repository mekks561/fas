const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const MODELS_DIR = path.join(__dirname, '../public/assets/models');

const MODEL_SOURCES = [
  {
    id: 'ship-fighter',
    name: 'Interceptor Fighter',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
    category: 'ships',
    fallbackUrl: null
  },
  {
    id: 'ship-bomber',
    name: 'Heavy Bomber',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb',
    category: 'ships',
    fallbackUrl: null
  },
  {
    id: 'enemy-fighter',
    name: 'Enemy Fighter',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb',
    category: 'enemies',
    fallbackUrl: null
  },
  {
    id: 'enemy-scout',
    name: 'Scout Drone',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Sphere/glTF-Binary/Sphere.glb',
    category: 'enemies',
    fallbackUrl: null
  },
  {
    id: 'structure-asteroid-small',
    name: 'Small Asteroid',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Cylinder/glTF-Binary/Cylinder.glb',
    category: 'structures',
    fallbackUrl: null
  },
  {
    id: 'structure-space-station',
    name: 'Space Station',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/TriangleWithoutIndices/glTF-Binary/TriangleWithoutIndices.glb',
    category: 'structures',
    fallbackUrl: null
  },
  {
    id: 'projectile-laser',
    name: 'Laser Bolt',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Cube/glTF-Binary/Cube.glb',
    category: 'projectiles',
    fallbackUrl: null
  },
  {
    id: 'effect-explosion',
    name: 'Explosion',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/UVTest/glTF-Binary/UVTest.glb',
    category: 'effects',
    fallbackUrl: null
  }
];

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP error! status: ${response.statusCode}`));
        return;
      }
      
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(() => {
          resolve(destination);
        });
      });
      
      file.on('error', (err) => {
        fs.unlink(destination, () => {});
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function downloadModel(model) {
  const categoryDir = path.join(MODELS_DIR, model.category);
  const filePath = path.join(categoryDir, `${model.id}.glb`);
  
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }
  
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${model.name} already exists`);
    return true;
  }
  
  console.log(`⬇️  Downloading ${model.name}...`);
  
  try {
    await downloadFile(model.url, filePath);
    const stats = fs.statSync(filePath);
    console.log(`✅ ${model.name} downloaded (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    return true;
  } catch (err) {
    console.log(`❌ Failed to download ${model.name}: ${err.message}`);
    if (model.fallbackUrl) {
      console.log(`   Trying fallback URL...`);
      try {
        await downloadFile(model.fallbackUrl, filePath);
        const stats = fs.statSync(filePath);
        console.log(`✅ ${model.name} downloaded from fallback (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      } catch (fallbackErr) {
        console.log(`❌ Fallback also failed: ${fallbackErr.message}`);
      }
    }
    return false;
  }
}

async function generatePlaceholderModel(outputPath) {
  const placeholderGlb = Buffer.from([
    0x47, 0x4C, 0x42, 0x00,
    0x02, 0x00, 0x00, 0x00,
    0x5A, 0x00, 0x00, 0x00,
    0x4A, 0x00, 0x00, 0x00,
    0x4A, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x6A, 0x73, 0x6F, 0x6E,
    0x7B, 0x22, 0x63, 0x73,
    0x63, 0x22, 0x3A, 0x5B,
    0x7B, 0x22, 0x70, 0x72,
    0x6F, 0x70, 0x65, 0x72,
    0x74, 0x69, 0x65, 0x73,
    0x22, 0x3A, 0x7B, 0x22,
    0x6D, 0x65, 0x73, 0x68,
    0x49, 0x6E, 0x64, 0x65,
    0x78, 0x22, 0x3A, 0x30,
    0x7D, 0x7D, 0x5D, 0x2C,
    0x22, 0x6D, 0x65, 0x73,
    0x68, 0x65, 0x73, 0x22,
    0x3A, 0x5B, 0x7B, 0x22,
    0x70, 0x72, 0x69, 0x6D,
    0x69, 0x74, 0x69, 0x76,
    0x65, 0x3A, 0x30, 0x7D,
    0x5D, 0x2C, 0x22, 0x6E,
    0x6F, 0x64, 0x65, 0x73,
    0x22, 0x3A, 0x5B, 0x7B,
    0x22, 0x6D, 0x65, 0x73,
    0x68, 0x49, 0x6E, 0x64,
    0x65, 0x78, 0x22, 0x3A,
    0x30, 0x7D, 0x5D, 0x7D,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00
  ]);
  
  fs.writeFileSync(outputPath, placeholderGlb);
  console.log(`   Generated placeholder file`);
}

async function main() {
  console.log('========================================');
  console.log('GLB Model Downloader');
  console.log('========================================\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const model of MODEL_SOURCES) {
    const result = await downloadModel(model);
    if (result) {
      successCount++;
    } else {
      failCount++;
      const categoryDir = path.join(MODELS_DIR, model.category);
      const filePath = path.join(categoryDir, `${model.id}.glb`);
      await generatePlaceholderModel(filePath);
    }
    console.log('');
  }
  
  console.log('========================================');
  console.log(`Results: ${successCount} downloaded, ${failCount} placeholders`);
  console.log('========================================');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});