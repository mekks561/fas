// 音频接线验证：断言「哪个界面在放哪首曲子」，并确认音乐能活过界面切换。
//
// 背景：音乐此前挂在 GameScene 上（AudioManager.playMusic），而结算/返回菜单时
// GameScene 会被 React 卸载 → pc.Application.destroy() → soundManager 销毁 →
// 声音当场被掐断。因此胜利/失败/主菜单音乐实际听不到。
// 本脚本验证改走 globalAudio（HTMLAudioElement 独立通道）之后的真实行为。
//
// 断言链：菜单=menu → 战斗=game → 末波=boss → 通关=victory（且卸载后仍在播）
//        → 重新开始=game（同时验证「重新开始」按钮此前点了没反应的 bug）
//        → 返回菜单=menu
//
// 用法：先起 dev server（`npx vite --port 5175`），再
//   VERIFY_URL=http://localhost:5175/ node scripts/verify-audio-wiring.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VERIFY_URL || 'http://localhost:5175/';
const EXE =
  process.env.CHROME_PATH ||
  path.join(
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
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
const audioRequests = new Map(); // url -> status

page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  const t = m.text();
  if (/Wave \d+ started|Level complete|Cleanup|destroy/i.test(t))
    console.log(`  [console] ${t.slice(0, 150)}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('response', (res) => {
  const u = res.url();
  if (u.includes('/assets/audio/')) audioRequests.set(u.split('/assets/audio/')[1], res.status());
});

const music = () =>
  page
    .evaluate(() => {
      const d = window.__audioDebug;
      if (!d) return { current: null, unlocked: false, history: [] };
      return { current: d.getCurrent(), unlocked: d.isUnlocked(), history: d.getHistory() };
    })
    .catch(() => ({ current: null, unlocked: false, history: [] }));

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

const results = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  results.push({ label, actual, expected, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}: 实得=${actual} 期望=${expected}`);
};

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

console.log('\n===== 1. 主菜单 =====');
// 浏览器自动播放策略：首次用户手势之前不允许出声，此时为空是**正确行为**。
// 解锁由任意 pointerdown / keydown 触发，解锁后补播此前请求过的曲子。
const beforeGesture = await music();
console.log(
  `  首次手势前: current=${beforeGesture.current} unlocked=${beforeGesture.unlocked}（应为 null/false）`,
);
await page.keyboard.press('ArrowDown'); // 任意按键即用户手势 → 触发解锁
await page.waitForTimeout(1200);
check('主菜单音乐（首次手势后）', (await music()).current, 'menu');
// 悬停触发界面音效（uiSelect）
await page.locator('button', { hasText: /开始游戏|START/i }).first().hover().catch(() => {});
await page.waitForTimeout(600);

console.log('\n===== 2. 进入战斗 =====');
await click([/开始游戏/, /START/i, /PLAY/i]);
await page.waitForTimeout(2200);
await click([/开始挑战/, /挑战/, /^开始$/]);
await page.waitForTimeout(9000);
for (let i = 0; i < 12; i++) {
  const dlg = page.locator('text=点击继续').first();
  const end = page.locator('text=点击结束').first();
  if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
  await page.mouse.click(640, 560);
  await page.waitForTimeout(700);
}
const ok = await page
  .waitForFunction(() => typeof window.__waveDebug === 'object', { timeout: 15000 })
  .then(() => true)
  .catch(() => false);
if (!ok) {
  console.log('❌ __waveDebug 不可用，无法继续');
  await browser.close();
  process.exit(1);
}
await page.evaluate(() => window.__waveDebug.godMode(true));
await page.waitForTimeout(1200);
check('战斗音乐', (await music()).current, 'game');

console.log('\n===== 3. 末波（Boss 波）=====');
await page.evaluate(() => window.__waveDebug.startWave(10));
await page.waitForTimeout(1800);
check('Boss 波音乐', (await music()).current, 'boss');

console.log('\n===== 4. 打完末波 → 通关 =====');
let levelComplete = false;
for (let step = 0; step < 400; step++) {
  const s = await page.evaluate(() => window.__waveDebug.getState()).catch(() => null);
  if (!s) break;
  if (s.levelCompleteFired) {
    levelComplete = true;
    console.log(`  关卡完成触发于 step=${step}（末波生成 ${s.waveState?.enemiesSpawned} 个敌人）`);
    break;
  }
  if (s.upgradeVisible) {
    const card = page.locator('.upgrade-card').first();
    if ((await card.count()) > 0) await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    continue;
  }
  if (s.aliveEnemies > 0) {
    await page.evaluate(() => window.__waveDebug.killAll());
    await page.waitForTimeout(420);
    continue;
  }
  await page.waitForTimeout(600);
}
check('关卡完成', levelComplete, true);

// 硬证据：结算界面上 canvas 必须已消失（GameScene 卸载、引擎销毁）
await page.waitForTimeout(1500);
const canvasGone = (await page.locator('canvas').count()) === 0;
check('GameScene 已卸载（canvas 消失）', canvasGone, true);
await page.waitForTimeout(2500);
const victory = (await page.locator('text=胜利').count()) > 0;
console.log(`  结算界面为「胜利」: ${victory}`);
check('通关音乐（关键：卸载后仍在播）', (await music()).current, 'victory');
fs.mkdirSync('docs/verify', { recursive: true });
await page.screenshot({ path: 'docs/verify/audio-victory.png' }).catch(() => {});

console.log('\n===== 5. 重新开始（验证此前点了没反应的 bug）=====');
const restarted = await click([/重新开始/]);
await page.waitForTimeout(9000);
const backInGame = await page
  .waitForFunction(() => typeof window.__waveDebug === 'object', { timeout: 15000 })
  .then(() => true)
  .catch(() => false);
check('点「重新开始」后回到战斗中', restarted && backInGame, true);
check('重开后的音乐', (await music()).current, 'game');

console.log('\n===== 6. 返回主菜单 =====');
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
await click([/返回主菜单/, /主菜单/, /Main Menu/i]);
await page.waitForTimeout(2000);
check('返回菜单后的音乐', (await music()).current, 'menu');

console.log('\n================ 音频请求 ================');
// 注意：HTMLAudioElement 走 Range 请求，dev server 会返回 206 Partial Content ——
// 206 是成功状态，不能按非 200 判失败。
const okStatus = (s) => s >= 200 && s < 300;
const missing = [];
for (const [file, status] of [...audioRequests.entries()].sort()) {
  console.log(`  ${okStatus(status) ? '✅' : '❌'} ${status}  ${file}`);
  if (!okStatus(status)) missing.push(`${file}(${status})`);
}
console.log(`\n请求到的音频文件数: ${audioRequests.size}`);

const finalMusic = await music();
console.log(`音乐播放轨迹: ${finalMusic.history.join(' → ')}`);

console.log('\n================ 结果 ================');
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`  ${r.pass ? '✅' : '❌'} ${r.label}`));
console.log(`通过 ${results.length - failed.length}/${results.length}`);
console.log(`非 2xx 的音频请求: ${missing.length === 0 ? '无 ✅' : missing.join(', ')}`);
console.log(`运行时错误: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log('  ', e.slice(0, 200)));

await browser.close();
process.exit(failed.length === 0 && missing.length === 0 ? 0 : 1);
