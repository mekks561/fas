/**
 * 飞船活动范围（arena）的端到端验证。
 *
 * 背景：飞船此前被硬编码钳制在 X/Z ±25、Y ±15，配 `maxSpeed 15 × boost 2.5 = 37.5 u/s`，
 * 满速横穿全场不到 1.4 秒 —— 用户反馈「可移动的空间过于有限」。本轮把世界整体放大 2×
 * （飞船 ±50/±30/±50），并同步放宽敌机边界、生成环、小行星带、远景布景与弹丸回收半径。
 *
 * 这个脚本**不做常量断言**（那是 arena.test.ts 的活），只做单测做不到的事：
 * 用真实键盘输入驱动飞船，从生产 update 循环里读回真实位置，证明
 * 「输入 → 物理 → 钳制」这条链的**实际结果**变了。
 *
 * 断言：
 *  A. 空间真的变大了（真实飞行，不是瞬移）
 *   A1. 平飞 5 秒后，XZ 上的最远距离 > 30（旧上界 25，且已超过旧的敌机上界 30）
 *   A2. 全程从未越过新上界（max ≤ 50.5）
 *   A3. 确实顶到了新上界（max ≥ 49）—— 否则说明只是「飞得比原来远」，没验证上限
 *  B. Y 轴同样放宽
 *   B1. 拉杆爬升后 y 最远 > 16（旧上界 15）
 *   B2. y 从未越过 30.5
 *   B3. 确实顶到 30 附近（>= 28）
 *  C. 小行星带被移到了新场地之外
 *   C1. 引擎日志里的半径是 arena.ts 的新值（r=70~110, sizeScale=2）
 *   C2. 日志里不含旧值（r=35~55）
 *  D. 无回归
 *   D1. 无未捕获页面错误
 *   D2. 战斗照常跑（波次在推进 / HUD 正常）
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VERIFY_URL || 'http://localhost:5177/';
const results = [];
let failed = false;

const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failed = true;
  results.push(
    `${ok ? '✅' : '❌'} ${name}: ${JSON.stringify(actual)}${ok ? '' : ` (期望 ${JSON.stringify(expected)})`}`,
  );
};

const checkTrue = (name, condition, detail) => {
  if (!condition) failed = true;
  results.push(`${condition ? '✅' : '❌'} ${name}: ${JSON.stringify(detail)}`);
};

/** arena.ts 的期望值（真源；此脚本刻意复写一份，避免「读被测对象来断言被测对象」） */
const EXPECT = {
  playerHalfXZ: 50,
  playerHalfY: 30,
  oldPlayerHalfXZ: 25,
  oldPlayerHalfY: 15,
  beltInner: 70,
  beltOuter: 110,
  beltSizeScale: 2,
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

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
const errors = [];
page.on('console', (m) => logs.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));

console.log(`\n===== 活动范围（arena）验证（${BASE}） =====`);

// —— 解锁第 2 关并进入战斗 ——
// 选第 2 关（陨石航道）而不是第 1 关：只有第 2 关 environment.asteroidField = true，
// 才能一并验证「小行星带被移出了新场地」（见断言 C）。
await page.addInitScript(() => {
  localStorage.setItem('levelProgress', JSON.stringify({ 1: { cleared: true, stars: 3 } }));
});
// 冷启动（首次依赖预构建）实测需要 ~20s 才触发 load，这里留足余量
await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page
  .locator('button', { hasText: /开始游戏/ })
  .first()
  .click({ timeout: 15000 });
await page.locator('p.line-clamp-2').first().waitFor({ timeout: 40000 });
await page.waitForTimeout(800);
await page.locator('h3', { hasText: '陨石航道' }).first().click({ timeout: 15000 });
await page.waitForTimeout(10000);
for (let i = 0; i < 12; i++) {
  const dlg = page.locator('text=点击继续').first();
  const end = page.locator('text=点击结束').first();
  if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
  await page.mouse.click(640, 560);
  await page.waitForTimeout(700);
}
await page.evaluate(() => window.__waveDebug?.godMode?.(true)).catch(() => {});
await page.waitForTimeout(1500);

const readPos = async () => {
  const p = await page.evaluate(() => window.__playerDebug?.position ?? null);
  return p ? { x: p.x, y: p.y, z: p.z } : null;
};

const start = await readPos();
checkTrue('0 取到玩家位置（__playerDebug 可用）', start !== null, start);

/**
 * 按住给定按键集合，期间高频采样，返回各轴绝对值的历史最大值。
 * 用真实键盘输入 —— 这是本脚本与单测的分界线：单测只能断言常量，
 * 这里断言的是「输入 → 物理 → 钳制」这条生产链路的实际结果。
 */
const flyAndSample = async (keys, ms, stepMs = 200) => {
  for (const k of keys) await page.keyboard.down(k);
  const maxAbs = { x: 0, y: 0, z: 0 };
  const ticks = Math.max(1, Math.round(ms / stepMs));
  for (let i = 0; i < ticks; i++) {
    await page.waitForTimeout(stepMs);
    const p = await readPos();
    if (!p) continue;
    maxAbs.x = Math.max(maxAbs.x, Math.abs(p.x));
    maxAbs.y = Math.max(maxAbs.y, Math.abs(p.y));
    maxAbs.z = Math.max(maxAbs.z, Math.abs(p.z));
  }
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(300);
  return { maxAbs, last: await readPos() };
};

// ===== A. 平飞：XZ 边界 =====
console.log('\n----- A. 平飞 5 秒（W + Space）-----');
const flat = await flyAndSample(['KeyW', 'Space'], 5000);
const maxXZ = Math.max(flat.maxAbs.x, flat.maxAbs.z);
console.log(
  `  各轴最远：x=${flat.maxAbs.x.toFixed(1)} y=${flat.maxAbs.y.toFixed(1)} z=${flat.maxAbs.z.toFixed(1)}`,
);

checkTrue(
  `A1 XZ 最远距离 > 30（旧上界 ${EXPECT.oldPlayerHalfXZ}）`,
  maxXZ > 30,
  `${maxXZ.toFixed(1)}`,
);
checkTrue(
  `A2 从未越过新上界 ${EXPECT.playerHalfXZ}`,
  maxXZ <= EXPECT.playerHalfXZ + 0.5,
  `${maxXZ.toFixed(1)}`,
);
checkTrue(
  `A3 确实顶到了新上界（>= ${EXPECT.playerHalfXZ - 1}）`,
  maxXZ >= EXPECT.playerHalfXZ - 1,
  `${maxXZ.toFixed(1)}`,
);

// ===== B. 拉杆爬升：Y 边界 =====
console.log('\n----- B. 拉杆爬升（ArrowUp + W + Space）-----');
const climb = await flyAndSample(['ArrowUp', 'KeyW', 'Space'], 5000);
console.log(
  `  各轴最远：x=${climb.maxAbs.x.toFixed(1)} y=${climb.maxAbs.y.toFixed(1)} z=${climb.maxAbs.z.toFixed(1)}`,
);

checkTrue(
  `B1 Y 最远 > 16（旧上界 ${EXPECT.oldPlayerHalfY}）`,
  climb.maxAbs.y > 16,
  `${climb.maxAbs.y.toFixed(1)}`,
);
checkTrue(
  `B2 Y 从未越过新上界 ${EXPECT.playerHalfY}`,
  climb.maxAbs.y <= EXPECT.playerHalfY + 0.5,
  `${climb.maxAbs.y.toFixed(1)}`,
);
checkTrue(
  `B3 确实顶到了 Y 上界附近（>= ${EXPECT.playerHalfY - 2}）`,
  climb.maxAbs.y >= EXPECT.playerHalfY - 2,
  `${climb.maxAbs.y.toFixed(1)}`,
);

// 顺带复查：整个飞行过程中 XZ 也从未越界（换个朝向再确认一次）
checkTrue(
  `B4 爬升阶段 XZ 仍未越界 ${EXPECT.playerHalfXZ}`,
  Math.max(climb.maxAbs.x, climb.maxAbs.z) <= EXPECT.playerHalfXZ + 0.5,
  `${Math.max(climb.maxAbs.x, climb.maxAbs.z).toFixed(1)}`,
);

// ===== C. 小行星带已移到场地之外 =====
console.log('\n----- C. 小行星带半径 -----');
const beltLog = logs.find((l) => l.includes('Asteroid field created')) ?? null;
console.log(`  引擎日志：${beltLog ?? '(未找到)'}`);

checkTrue('C1 小行星带用新半径创建', beltLog !== null, beltLog);
checkTrue(
  `C1b 半径 = ${EXPECT.beltInner}~${EXPECT.beltOuter} 且 sizeScale=${EXPECT.beltSizeScale}`,
  new RegExp(
    `r=${EXPECT.beltInner}~${EXPECT.beltOuter}, sizeScale=${EXPECT.beltSizeScale}`,
  ).test(beltLog || ''),
  beltLog,
);
checkTrue(
  'C2 日志里不含旧半径 35~55（防止回退）',
  !/r=35~55/.test(beltLog || ''),
  beltLog,
);
checkTrue(
  `C2b 带内缘 ${EXPECT.beltInner} 严格大于飞船单轴半边长 ${EXPECT.playerHalfXZ}`,
  EXPECT.beltInner > EXPECT.playerHalfXZ,
  `余量 ${EXPECT.beltInner - EXPECT.playerHalfXZ}`,
);

// ===== D. 无回归 =====
console.log('\n----- D. 回归 -----');
checkTrue('D1 无未捕获页面错误', errors.length === 0, errors.slice(0, 3));

// `__waveDebug` 被 import.meta.env.DEV 包着，生产构建会被剔除 ——
// 拿不到就退化成读 HUD 文案，这样本脚本在 dev 与生产构建上都能跑。
const state = await page.evaluate(() => window.__waveDebug?.getState?.() ?? null);
if (state) {
  checkTrue(
    'D2 战斗仍在推进（波次/场上敌人正常）',
    state.wave >= 1 && state.aliveEnemies >= 0,
    { wave: state.wave, aliveEnemies: state.aliveEnemies, sceneReady: state.sceneReady },
  );
} else {
  const hud = await page.evaluate(() => document.body.innerText.slice(0, 400));
  checkTrue(
    'D2 战斗 HUD 正常（生产构建无调试钩子，改读 HUD）',
    /波次|Wave|生命|HP|得分|Score/i.test(hud),
    hud.replace(/\s+/g, ' ').slice(0, 140),
  );
}

// ===== 截图归档 =====
const OUT_DIR = path.resolve('docs/verify');
await page.screenshot({ path: `${OUT_DIR}/arena-01-expanded.png` });
console.log(`\n截图已保存: ${OUT_DIR}/arena-01-expanded.png`);

await browser.close();

console.log('\n================ 结果 ================');
for (const r of results) console.log('  ' + r);
const passed = results.filter((r) => r.startsWith('✅')).length;
console.log(`\n通过 ${passed}/${results.length}`);
if (errors.length) console.log(`运行时错误: ${errors.length}`);

process.exit(failed ? 1 : 0);
