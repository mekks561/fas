/**
 * 环境光照（IBL）与色调映射接线验证。
 *
 * 背景：
 *  - 场景此前只有 ambientLight（常量色）+ 一盏平行光，金属材质没有可反射的环境：
 *    metalness=0.85 的空间站/卫星表面等于在反射「空气」；
 *  - public/assets/textures/hdr/ 的 10 张 Poly Haven HDR（80MB）零代码引用；
 *  - 色调映射一直是 PlayCanvas 默认的 TONEMAP_LINEAR（亮部直接切顶死白）。
 *
 * 断言（差分：不同关卡 → 不同 HDR + 不同曝光，证明配置驱动而非硬编码）：
 *  A. level-01（天幕 env-space-01 / 光照 normal）
 *   1. 环境贴图 url = rogland_clear_night_2k.hdr（ENV_HDRI 映射）
 *   2. status = ready（异步加载 + 预滤波真的跑完了）
 *   3. envAtlas = true 且 atlasSize = 512（贴图真生成，非空占位）
 *   4. toneMapping = 4（aces2，非默认 linear=0）
 *   5. exposure = 1.0（normal 档 ×1.0）
 *  B. level-02（天幕 env-nebula-01 / 光照 dim）——与 A 差分
 *   6. url 换成 qwantani_night_2k.hdr（天幕 id 真的换了环境贴图）
 *   7. exposure = 1.15（dim 档 ×1.15，非 A 的 1.0）
 *  C. level-04（天幕 env-space-01 / 光照 dark）
 *   8. exposure ≈ 1.35（dark 档补偿最高）
 *  D. 全流程 0 运行时错误
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VERIFY_URL || 'http://localhost:5177/';
const OUT_DIR = 'docs/verify';
const results = [];
let failed = false;
const check = (name, actual, expect) => {
  const ok = actual === expect;
  if (!ok) failed = true;
  results.push(
    `${ok ? '✅' : '❌'} ${name}: ${JSON.stringify(actual)}${ok ? '' : ` (期望 ${JSON.stringify(expect)})`}`,
  );
};
const checkClose = (name, actual, expect, tol = 0.001) => {
  const ok = typeof actual === 'number' && Math.abs(actual - expect) <= tol;
  if (!ok) failed = true;
  results.push(
    `${ok ? '✅' : '❌'} ${name}: ${JSON.stringify(actual)}${ok ? '' : ` (期望 ≈${expect})`}`,
  );
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
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

// 一次性注入「全部关卡已通关」存档（LevelSelect 解锁 = 上一关已通关）。
// 只加一次：addInitScript 会在每次导航时重复执行，多次添加会互相覆盖。
await page.addInitScript(() => {
  const progress = {};
  for (let i = 1; i <= 9; i++) progress[i] = { cleared: true, stars: 3 };
  localStorage.setItem('levelProgress', JSON.stringify(progress));
});

/** 进指定关卡并等到战斗可观测。 */
const enterLevel = async (levelIndex, levelCardText) => {
  await page.goto(`${BASE}?level=${levelIndex}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page
    .locator('button', { hasText: /开始游戏/ })
    .first()
    .click({ timeout: 15000 });
  await page.locator('p.line-clamp-2').first().waitFor({ timeout: 40000 });
  await page.waitForTimeout(800);
  await page.locator('h3', { hasText: levelCardText }).first().click({ timeout: 15000 });
  await page.waitForTimeout(10000);
  // 剧情对话推进（对话 UI 响应屏幕点击，不响应键盘 Enter）
  for (let i = 0; i < 16; i++) {
    const dlg = page.locator('text=点击继续').first();
    const end = page.locator('text=点击结束').first();
    if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
    await page.mouse.click(640, 560);
    await page.waitForTimeout(900);
  }
  await page
    .waitForFunction(() => typeof window.__levelDebug === 'object', { timeout: 25000 })
    .catch(() => {});
  await page.waitForTimeout(800);
};

/** 等环境光照异步生成结束（ready 或 failed）。软渲染下预滤波较慢，超时给宽。 */
const waitForEnv = async (timeoutMs = 120000) => {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    last = await page
      .evaluate(() => window.__levelDebug?.summary?.()?.environment ?? null)
      .catch(() => null);
    if (last && (last.status === 'ready' || last.status === 'failed')) return last;
    await page.waitForTimeout(700);
  }
  return last;
};

// ── A. level-01：normal 光照 / env-space-01 ────────────────────────────────
console.log('=== A. level-01（初次接触，normal / env-space-01）===');
await enterLevel(1, '初次接触');
const envA = await waitForEnv();
console.log('  environment =', JSON.stringify(envA));
check('A1 环境贴图 url', envA?.url, '/assets/textures/hdr/rogland_clear_night_2k.hdr');
check('A2 status', envA?.status, 'ready');
check('A3 envAtlas 已挂载', envA?.envAtlas, true);
check('A4 envAtlas 尺寸', envA?.atlasSize, 512);
check('A5 色调映射（aces2=4，非默认 linear=0）', envA?.toneMapping, 4);
checkClose('A6 曝光（normal ×1.0）', envA?.exposure, 1.0);
await page.screenshot({ path: `${OUT_DIR}/env-01-level01.png` });
console.log('  截图: env-01-level01.png');

// ── B. level-02：dim 光照 / env-nebula-01（与 A 差分）──────────────────────
console.log('=== B. level-02（陨石航道，dim / env-nebula-01）===');
await enterLevel(2, '陨石航道');
const envB = await waitForEnv();
console.log('  environment =', JSON.stringify(envB));
check('B1 环境贴图 url（换关卡换 HDR）', envB?.url, '/assets/textures/hdr/qwantani_night_2k.hdr');
check('B2 status', envB?.status, 'ready');
check('B3 envAtlas 已挂载', envB?.envAtlas, true);
checkClose('B4 曝光（dim ×1.15，≠ A 的 1.0）', envB?.exposure, 1.15);
await page.screenshot({ path: `${OUT_DIR}/env-02-level02.png` });

// ── C. level-04：dark 光照 / env-space-01 ────────────────────────────────
console.log('=== C. level-04（废弃空间站，dark / env-space-01）===');
await enterLevel(4, '废弃空间站');
const envC = await waitForEnv();
console.log('  environment =', JSON.stringify(envC));
check('C1 环境贴图 url', envC?.url, '/assets/textures/hdr/rogland_clear_night_2k.hdr');
check('C2 status', envC?.status, 'ready');
checkClose('C3 曝光（dark ×1.35，补偿最高）', envC?.exposure, 1.35);
await page.screenshot({ path: `${OUT_DIR}/env-03-level04.png` });

// ── D. 运行时错误 ────────────────────────────────────────────────────────
check('D1 运行时错误数', errors.length, 0);
if (errors.length) console.log('  错误详情:', errors.slice(0, 5));

console.log('\n===== 环境光照 / 色调映射验证 =====');
for (const r of results) console.log(r);
console.log(`\n${failed ? '❌ 有断言未通过' : `✅ 全部通过（${results.length} 项）`}`);
await browser.close();
process.exit(failed ? 1 : 0);
