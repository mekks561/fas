/**
 * 敌机 AI 的 Lua 接线验证（真实 Lua 运行时 + enemy-ai.lua 接管 + TS/Lua A/B）
 *
 * 背景（本轮查实）：
 *  - `LuaEngine` 找的是 wasmoon 1.12 以前的 `wasmoon.factory`，而依赖是 1.16（只有 `LuaFactory`）
 *    → 初始化**恒定落到 stub**，`doString` 是空函数，`src/lua/**\/*.lua` 从未被执行过。
 *  - 于是 `enemy-ai.lua`（457 行）以及"Lua 波次/道具/统计/技能"其实都是宿主 JS 复刻在跑。
 *  本轮接通真实 Lua 运行时，并把 enemy-ai.lua 接成第一个真实消费者。
 *
 * 断言：
 *  A. 运行时（真实 Lua 而非 stub）
 *   1. __aiDebug.runtime().mode === 'lua'（自检通过，桥可用）
 *   2. version 以 'Lua ' 开头
 *   3. 可 require 的 .lua 模块数 >= 5（源码注册表进了构建产物）
 *   4. __aiDebug.getMode() === 'lua'
 *  B. 接线（Lua 真的在驱动敌机）
 *   5. 场上每架敌机 brainActive === true
 *   6. Lua 接管帧数 > 0（不是挂了个空壳）
 *   7. 桥接 steps > 0 且 errors === 0
 *   8. registrySize === 场上存活敌机数（句柄与实体一一对应）
 *   9. 每架敌机的 Lua AI 类型都在模块的四种之内
 *  10. 敌人位置在移动（行为真的作用到实体上）
 *  C. 兜底（Lua 挂了游戏不能跟着挂）
 *  11. forceLuaError 后 fallbacks > 0
 *  12. 兜底后敌机 brainActive === false 但**仍在移动**（回落 TS 行为）
 *  D. 不泄漏 + 玩法不回归
 *  13. 敌人被清场后 registrySize 归零
 *  14. lua 模式下波次仍能推进（打完第 1 波进入第 2 波）
 *  E. A/B 对照（ts 模式）
 *  15. ?ai=ts 下 brainActive === false 且 spawned === 0（不创建 Lua 句柄）
 *  16. ts 模式敌机同样在移动
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VERIFY_URL || 'http://localhost:5177/';
const results = [];
let failed = false;

const check = (name, actual, expect) => {
  const ok = actual === expect;
  if (!ok) failed = true;
  results.push(
    `${ok ? '✅' : '❌'} ${name}: ${JSON.stringify(actual)}${ok ? '' : ` (期望 ${JSON.stringify(expect)})`}`,
  );
};

const checkTrue = (name, condition, detail) => {
  if (!condition) failed = true;
  results.push(`${condition ? '✅' : '❌'} ${name}: ${JSON.stringify(detail)}`);
};

const EXE = path.join(
  process.env.LOCALAPPDATA || '',
  'ms-playwright',
  'chromium-1228',
  'chrome-win64',
  'chrome.exe',
);

const browser = await chromium.launch({
  executablePath: fs.existsSync(EXE) ? EXE : undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});

const errors = [];

/** 进入指定 URL 的战斗（含剧情对话推进） */
const enterBattle = async (page, url, levelCardText = '初次接触') => {
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page
    .locator('button', { hasText: /开始游戏/ })
    .first()
    .click({ timeout: 15000 });
  await page.locator('p.line-clamp-2').first().waitFor({ timeout: 40000 });
  await page.waitForTimeout(800);
  await page.locator('h3', { hasText: levelCardText }).first().click({ timeout: 15000 });
  await page.waitForTimeout(10000);
  for (let i = 0; i < 12; i++) {
    const dlg = page.locator('text=点击继续').first();
    const end = page.locator('text=点击结束').first();
    if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
    await page.mouse.click(640, 560);
    await page.waitForTimeout(700);
  }
  await page
    .waitForFunction(() => typeof window.__aiDebug === 'object', { timeout: 20000 })
    .catch(() => {});
  await page.evaluate(() => window.__waveDebug?.godMode?.(true)).catch(() => {});
  await page.waitForTimeout(800);
};

/** 等场上出现敌人（最多 30s） */
const waitForEnemies = async (page, timeoutMs = 30000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const alive = await page.evaluate(
      () => window.__waveDebug?.getState?.()?.aliveEnemies ?? 0,
    );
    if (alive > 0) return alive;
    await page.waitForTimeout(600);
  }
  return 0;
};

/** 采样一段时间内的位移与统计 */
const sample = async (page, ms = 3000) => {
  const before = await page.evaluate(() => ({
    inspect: window.__waveDebug.inspectEnemies(),
    ai: window.__aiDebug.inspect(),
    stats: window.__aiDebug.stats(),
  }));
  await page.waitForTimeout(ms);
  const after = await page.evaluate(() => ({
    inspect: window.__waveDebug.inspectEnemies(),
    ai: window.__aiDebug.inspect(),
    stats: window.__aiDebug.stats(),
  }));

  const initial = new Map(before.inspect.map((e) => [e.i, e.pos]));
  const moved = after.inspect.filter((e) => {
    const prev = initial.get(e.i);
    if (!prev) return false;
    return Math.hypot(e.pos[0] - prev[0], e.pos[1] - prev[1], e.pos[2] - prev[2]) > 0.5;
  }).length;

  return { before, after, moved };
};

/**
 * 「AI 是否真的在驱动敌机」的**行为**断言：
 * 把敌机推到 26 单位外，看它们在一段时间内是否明显靠近玩家。
 *
 * 不能只看"位置有没有变"——敌机贴到玩家身上后位移只剩微幅抖动，会假阴性。
 */
const measureApproach = async (page, seconds = 4) => {
  const pushed = await page.evaluate(() => window.__aiDebug.pushEnemiesAway(26));
  await page.waitForTimeout(200);
  const dist = async () =>
    page.evaluate(() => window.__waveDebug.inspectEnemies().map((e) => Math.hypot(e.pos[0], e.pos[1], e.pos[2])));
  const before = await dist();
  await page.waitForTimeout(seconds * 1000);
  const after = await dist();
  const deltas = after.map((d, i) => (before[i] === undefined ? 0 : before[i] - d));
  return {
    pushed,
    before: before.map((v) => Math.round(v * 10) / 10),
    after: after.map((v) => Math.round(v * 10) / 10),
    minClosed: deltas.length ? Math.min(...deltas) : 0,
    closed: deltas.filter((d) => d > 3).length,
  };
};

// ---------------------------------------------------------------------------
console.log('\n===== A/B/C/D. ?ai=lua：真实 Lua 运行时 + enemy-ai.lua 接管 =====');
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

await enterBattle(page, `${BASE}?ai=lua`);

// A. 运行时
const runtime = await page.evaluate(() => window.__aiDebug.runtime());
check('A1 运行时模式（自检通过的才是真 lua）', runtime.mode, 'lua');
checkTrue('A2 版本号来自真实 Lua', String(runtime.version).startsWith('Lua '), runtime.version);
checkTrue('A3 .lua 源码已进产物（可 require）', runtime.availableLuaModules >= 5, runtime.availableLuaModules);
check(
  'A3b 源码注册表无退化条目（拿到 URL 而非源码 = 生产必炸）',
  (runtime.sourceRegistryErrors || []).length,
  0,
);
const mode = await page.evaluate(() => window.__aiDebug.getMode());
check('A4 当前 AI 后端', mode, 'lua');

// B. 接线
const alive = await waitForEnemies(page);
checkTrue('B0 场上出现敌人', alive > 0, alive);

if (alive > 0) {
  const first = await sample(page, 3200);
  const aiList = first.after.ai;
  const stats = first.after.stats;

  checkTrue(
    'B5 每架敌机都挂着 Lua 大脑',
    aiList.length > 0 && aiList.every((e) => e.brainActive === true),
    aiList.map((e) => `${e.type}:${e.brainActive}`).join(','),
  );
  checkTrue(
    'B6 Lua 接管帧数 > 0（不是空壳）',
    aiList.length > 0 && aiList.every((e) => e.brainFrames > 0),
    aiList.map((e) => e.brainFrames).join(','),
  );
  checkTrue('B7 桥接步进 > 0 且无跨边界错误', stats.steps > 0 && stats.errors === 0, {
    steps: stats.steps,
    errors: stats.errors,
    lastError: stats.lastError,
  });
  checkTrue('B8 Lua 注册表 = 存活敌机数', stats.registrySize === stats.aliveEnemies, {
    registrySize: stats.registrySize,
    aliveEnemies: stats.aliveEnemies,
  });
  const validTypes = ['PATROL', 'AGGRESSIVE', 'SNIPER', 'BOSS'];
  checkTrue(
    'B9 每架敌机的 Lua AI 类型都来自 enemy-ai.lua 的四种',
    aiList.every((e) => e.lua && validTypes.includes(e.lua.type)),
    aiList.map((e) => e.lua?.type).join(','),
  );

  // 行为断言：推远 → 看 Lua 决策是否把敌机带回来
  const approach = await measureApproach(page, 4);
  checkTrue('B10 Lua 决策真的驱动了实体追击（推远 26 单位后被带回）', approach.closed > 0, approach);

  // C. 兜底：强制 Lua 抛错
  await page.evaluate(() => window.__aiDebug.forceLuaError(true));
  await page.waitForTimeout(700);
  const fallenBack = await page.evaluate(() => window.__aiDebug.stats());
  checkTrue('C11 强制 Lua 报错后出现兜底计数', fallenBack.fallbacks > 0, {
    fallbacks: fallenBack.fallbacks,
    lastFallbackReason: fallenBack.lastFallbackReason,
  });

  const fallbackSample = await sample(page, 3200);
  const fallbackApproach = await measureApproach(page, 4);
  checkTrue(
    'C12 兜底后敌机摘掉 Lua 大脑但仍在追击（回落 TS 行为）',
    fallbackSample.after.ai.length > 0 &&
      fallbackSample.after.ai.every((e) => e.brainActive === false) &&
      fallbackApproach.closed > 0,
    {
      stillActive: fallbackSample.after.ai.filter((e) => e.brainActive).length,
      approach: fallbackApproach,
    },
  );
  await page.evaluate(() => window.__aiDebug.forceLuaError(false));

  // D13. 阵亡后注册表不泄漏
  await page.evaluate(() => window.__waveDebug.killAll());
  await page.waitForTimeout(1500);
  const afterCleanup = await page.evaluate(() => ({
    stats: window.__aiDebug.stats(),
    alive: window.__waveDebug.getState().aliveEnemies,
  }));
  checkTrue('D13 敌人清空后 Lua 注册表归零（无句柄泄漏）', afterCleanup.stats.registrySize === 0, {
    registrySize: afterCleanup.stats.registrySize,
    aliveEnemies: afterCleanup.alive,
  });
}

// D14. 波次仍能推进
let advancedTo = -1;
for (let step = 0; step < 40; step++) {
  const s = await page.evaluate(() => window.__waveDebug.getState());
  if (s.wave >= 2) {
    advancedTo = s.wave;
    break;
  }
  if (s.upgradeVisible) {
    const card = page.locator('.upgrade-card').first();
    if ((await card.count()) > 0) await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    continue;
  }
  if (s.aliveEnemies > 0) {
    await page.evaluate(() => window.__waveDebug.killAll());
    await page.waitForTimeout(500);
    continue;
  }
  await page.waitForTimeout(800);
}
checkTrue('D14 lua 模式下波次仍能推进到第 2 波', advancedTo >= 2, advancedTo);

await page
  .screenshot({ path: 'docs/verify/lua-ai-battle.png' })
  .catch((e) => console.log('截图跳过:', e.code));
await page.close();

// ---------------------------------------------------------------------------
console.log('\n===== E. ?ai=ts：A/B 对照（原生 TS 行为，不建 Lua 句柄）=====');
const tsPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
tsPage.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

await enterBattle(tsPage, `${BASE}?ai=ts`);

const tsRuntime = await tsPage.evaluate(() => window.__aiDebug.runtime());
checkTrue('E15a ts 模式下真实 Lua 运行时仍在（模块已加载，只是没被敌机使用）', 
  tsRuntime.mode === 'lua' && tsRuntime.availableLuaModules >= 5, tsRuntime);

const tsAlive = await waitForEnemies(tsPage);
checkTrue('E15b 场上出现敌人', tsAlive > 0, tsAlive);

if (tsAlive > 0) {
  const tsSample = await sample(tsPage, 3200);
  checkTrue(
    'E15c ts 模式下没有敌机挂 Lua 大脑',
    tsSample.after.ai.every((e) => e.brainActive === false),
    tsSample.after.ai.map((e) => e.brainActive).join(','),
  );
  checkTrue('E15d ts 模式不创建 Lua 句柄', tsSample.after.stats.spawned === 0, {
    spawned: tsSample.after.stats.spawned,
    registrySize: tsSample.after.stats.registrySize,
  });
  const tsApproach = await measureApproach(tsPage, 4);
  checkTrue('E16 原生 TS 行为同样把推远的敌机带回来（A/B 可比）', tsApproach.closed > 0, tsApproach);
}

await tsPage.close();

// ---------------------------------------------------------------------------
check('F 无运行时错误', errors.length, 0);
console.log(results.join('\n'));
console.log(`\n${failed ? '❌ 有断言失败' : '✅ 全部通过'}`);
if (errors.length) console.log('运行时错误:', errors.join('\n'));
await browser.close();
process.exit(failed ? 1 : 0);
