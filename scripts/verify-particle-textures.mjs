// 粒子贴图接线验证：断言「开局预加载 7/7 就绪 → 常驻尾焰回填 → 战斗特效带贴图」。
//
// 背景：所有粒子系统（引擎尾焰/导弹尾焰/命中爆炸/敌机死亡爆炸/道具/技能）此前
// 都是零贴图的纯色光团——引擎默认 colorMap 是一个纯白小圆点。本轮从备用库
// Kenney Particle Pack 挑了 7 张白色发光形状贴图（512×512 透明 PNG，CC0），
// 颜色仍由各粒子系统的 colorGraph 染出。
//
// 断言链：
//   进战斗 → __particleDebug 报告 7/7 贴图就绪（开局预加载生效）
//   → 常驻引擎尾焰的 colorMap 已被回填（pending 补设路径生效——尾焰创建于
//     贴图就绪之前，若回填失效它将永远是白点）
//   → godMode + killAll 制造命中/死亡爆炸 → 截图确认视觉效果
//
// 用法：先起 dev server（`npx vite --port 5177`），再
//   VERIFY_URL=http://127.0.0.1:5177/ node scripts/verify-particle-textures.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VERIFY_URL || 'http://localhost:5177/';
const EXE =
  process.env.CHROME_PATH ||
  path.join(
    process.env.LOCALAPPDATA || '',
    'ms-playwright',
    'chromium-1228',
    'chrome-win64',
    'chrome.exe',
  );

const OUT_DIR = path.join(process.cwd(), 'docs', 'verify');
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: fs.existsSync(EXE) ? EXE : undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const results = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  results.push({ label, actual, expected, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}: 实得=${actual} 期望=${expected}`);
};
const checkTrue = (label, cond, hint = '') => {
  const pass = !!cond;
  results.push({ label, actual: pass, expected: true, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}${hint ? `（${hint}）` : ''}`);
};

const click = async (patterns) => {
  for (const p of patterns) {
    const btn = page.locator('button', { hasText: p }).first();
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 8000 }).catch(() => {});
      return true;
    }
  }
  return false;
};

const closeUpgradeIfAny = async () => {
  const card = page.locator('.upgrade-card').first();
  if ((await card.count()) > 0) {
    await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
  }
};

// ───────────────────────── 0. 清档 → 进战斗 ─────────────────────────
console.log('\n===== 0. 清档 → 进战斗 =====');
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load', timeout: 60000 });
// dev server 首次编译可能较慢，轮询等调试钩子出现（上限 40s）
await page
  .waitForFunction(() => typeof window.__particleDebug === 'object', null, { timeout: 40000 })
  .catch(() => {});

await click([/开始游戏/, /Start Game/i]);
await page.waitForTimeout(2500);
await click([/开始挑战/]);
console.log('  已进入关卡选择并开始挑战');

// ───────────────────────── 1. 预加载就绪 ─────────────────────────
console.log('\n===== 1. 粒子贴图预加载 =====');
await page
  .waitForFunction(() => window.__particleDebug?.readyCount?.() === 7, null, { timeout: 20000 })
  .catch(() => {});
const status = await page.evaluate(() => window.__particleDebug?.status?.() ?? []);
for (const s of status) {
  checkTrue(`贴图就绪：${s.url}`, s.ready);
}
const readyCount = await page.evaluate(() => window.__particleDebug?.readyCount?.() ?? 0);
check('7 张贴图全部就绪', readyCount, 7);

// ───────────────────────── 2. 常驻尾焰回填 ─────────────────────────
console.log('\n===== 2. 常驻引擎尾焰的 colorMap 回填 =====');
// 尾焰创建于贴图就绪之前——引擎必须在贴图 load 后把它补设上去
const trailSet = await page.evaluate(() => window.__particleDebug?.trailColorMapSet?.() ?? false);
checkTrue('引擎尾焰 colorMap 已回填（非默认白点）', trailSet);

// ───────────────────────── 3. 战斗特效视觉验证 ─────────────────────────
console.log('\n===== 3. 战斗特效（godMode + 清场制造爆炸） =====');
await page.evaluate(() => window.__waveDebug?.godMode?.(true));
// 开局有剧情对话（全屏遮罩 z-50，点击推进；首击只完成打字机效果），物理点击遮罩中部关掉
for (let i = 0; i < 10; i++) {
  const dlg = await page.locator('div.z-50').count();
  if (dlg === 0) break;
  await page.mouse.click(640, 330).catch(() => {});
  await page.waitForTimeout(700);
}
// 等第 1 波敌机飞进视野（开局从远处刷出）
await page.waitForTimeout(9000);
await closeUpgradeIfAny();
// 逐个击杀：killOne 不清空全场 ⇒ 不触发波次完成弹窗，爆炸在敌机原位清晰可见
await page.evaluate(() => window.__waveDebug?.killOne?.(0));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT_DIR, 'particle-01-battle.png') });
console.log('  已截图 docs/verify/particle-01-battle.png（爆炸瞬间）');
await page.evaluate(() => window.__waveDebug?.killOne?.(1));
await page.waitForTimeout(750);
await page.screenshot({ path: path.join(OUT_DIR, 'particle-02-aftermath.png') });
console.log('  已截图 docs/verify/particle-02-aftermath.png（爆炸扩散）');

// ───────────────────────── 汇总 ─────────────────────────
console.log('\n════════════════════ 汇总 ════════════════════');
const passed = results.filter((r) => r.pass).length;
console.log(`通过 ${passed}/${results.length}`);
const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.log('\n失败项：');
  for (const f of failed) console.log(`  ❌ ${f.label}`);
}
const realErrors = errors.filter(
  (e) =>
    !e.includes('favicon') &&
    !e.includes('DevTools') &&
    !e.includes('Webpack') &&
    !e.includes('Slow network') &&
    !e.includes('the server responded with a status'),
);
checkTrue('运行时错误为 0', realErrors.length === 0, realErrors[0] ?? '');
console.log(`\n运行时错误 ${realErrors.length} 条`);
if (realErrors.length > 0) console.log(realErrors.slice(0, 5).join('\n'));

await browser.close();
process.exit(passed === results.length ? 0 : 1);
