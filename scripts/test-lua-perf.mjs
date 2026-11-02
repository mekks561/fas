
import { LuaFactory } from 'wasmoon';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

async function runPerfTest() {
  // 解决 wasmoon 在 Node 下的 Assertion failed 问题
  process.env = {};
  const factory = new LuaFactory();
  const lua = await factory.createEngine();

  // 1. 模拟 Lua 装载器
  const sources = {
    'ai/enemy-ai': fs.readFileSync(path.join(ROOT, 'src/lua/ai/enemy-ai.lua'), 'utf-8'),
    'utils': fs.readFileSync(path.join(ROOT, 'src/lua/utils.lua'), 'utf-8'),
  };

  lua.global.set('__luaSources', sources);
  lua.doString(`
    local __modCache = {}
    function require(name)
      if __modCache[name] then return __modCache[name] end
      local src = __luaSources[name]
      if not src then error("module " .. name .. " not found") end
      local chunk = load(src, "@" .. name)
      local mod = chunk()
      __modCache[name] = mod
      return mod
    end
  `);

  // 2. 注入桥接脚本
  const ENEMY_AI_BRIDGE = `
    local EnemyAI = require("ai/enemy-ai")
    local __registry = {}
    local __nextId = 0

    function spawn(typeKey, x, y, z)
      local r = EnemyAI.createEnemyAI(typeKey, x, y, z)
      __nextId = __nextId + 1
      __registry[__nextId] = r.enemy
      return __nextId
    end

    function step(id, px, py, pz, dt)
      local e = __registry[id]
      return EnemyAI.updateAI(e, px, py, pz, dt)
    end
  `;
  lua.doString(ENEMY_AI_BRIDGE);

  const spawn = lua.global.get('spawn');
  const step = lua.global.get('step');

  const ENEMY_COUNT = 100;
  const TEST_FRAMES = 60;
  const DT = 1/60;

  // 3. 生成敌人
  const handles = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    handles.push(spawn('SWARM', Math.random() * 100, 0, Math.random() * 100));
  }

  console.log(`Spawned ${handles.length} SWARM enemies.`);

  // 4. 运行测试
  const start = Date.now();
  for (let f = 0; f < TEST_FRAMES; f++) {
    for (const h of handles) {
      step(h, 0, 0, 0, DT);
    }
  }
  const end = Date.now();

  const totalTime = end - start;
  const avgFrameTime = totalTime / TEST_FRAMES;
  
  console.log(`Total time for ${TEST_FRAMES} frames: ${totalTime}ms`);
  console.log(`Average time per frame: ${avgFrameTime.toFixed(2)}ms`);
  console.log(`Average time per enemy step: ${(totalTime / (TEST_FRAMES * ENEMY_COUNT)).toFixed(4)}ms`);
}

runPerfTest().catch(console.error);
