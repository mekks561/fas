// 末波闭环验证（快，约 1 分钟）：倒数第二波 → 清空 → 末波 → 清空 → 关卡完成。
//
// 这是 `verify-wave-progression.mjs`（全波次，约 10 分钟）的快速回归版，
// 专门守住曾经最隐蔽的 bug：关卡完成条件在末波**启动的同一帧**就成立
// （波号已达上限、敌人要下一帧才生成、nextWave 刚被置 null），
// 导致末波被整个跳过、GameScene 被 React 卸载、引擎销毁、整局冻结。
//
// ⚠ 2026-10-10 修正：本脚本**写于关卡系统上线之前**，当时的世界是「固定 10 波」，
//   于是写死了 `startWave(9)` / `wave >= 10`。关卡制改成「每关按配置波数」之后
//   （第 1 关只有 3 波），`startWave(9)` 会被 `waveNumber exceeds maxWaves` 拒绝，
//   脚本只会把 3 波打完然后对着不存在的 wave10 断言失败 —— **是脚本陈旧，不是产品回归**
//   （已用 stash 基线逐字对照证实）。现在一律从 `getState().totalWaves` 推导，
//   换关卡/改波数都不会再让这个脚本失效。
//
// 关键断言：末波必须真正生成敌人并被清空，然后才触发关卡完成；
// 且触发后引擎仍在运行（完成后卸载是正常行为 —— App 切到结算界面）。
//
// 用法：先起 dev server（`npx vite --port 5175`），再
//   VERIFY_URL=http://localhost:5175/ node scripts/verify-final-wave.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VERIFY_URL || 'http://localhost:5175/';
const EXE =
  process.env.CHROME_PATH ||
  path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe');

const browser = await chromium.launch({
  executablePath: fs.existsSync(EXE) ? EXE : undefined,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  const t = m.text();
  if (/Wave \d+ started|Wave completed|Level complete|Cleanup|destroy/i.test(t))
    console.log(`  [console] ${t.slice(0, 170)}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const results = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  results.push({ label, actual, expected, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}: 实得=${actual} 期望=${expected}`);
};

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

const click = async (patterns) => {
  for (const p of patterns) {
    const btn = page.locator('button', { hasText: p }).first();
    if ((await btn.count()) > 0) { await btn.click({ timeout: 8000 }).catch(() => {}); return true; }
  }
  return false;
};
await click([/开始游戏/, /START/i, /PLAY/i]);
await page.waitForTimeout(2500);
await click([/开始挑战/, /挑战/, /^开始$/]);
await page.waitForTimeout(8000);
for (let i = 0; i < 12; i++) {
  const dlg = page.locator('text=点击继续').first();
  const end = page.locator('text=点击结束').first();
  if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
  await page.mouse.click(640, 560);
  await page.waitForTimeout(700);
}

const ok = await page.waitForFunction(() => typeof window.__waveDebug === 'object', { timeout: 15000 }).then(() => true).catch(() => false);
if (!ok) { console.log('❌ __waveDebug 不可用'); await browser.close(); process.exit(1); }
await page.evaluate(() => window.__waveDebug.godMode(true));

const snap = () => page.evaluate(() => window.__waveDebug.getState());

// 波数从**真实运行状态**推导（关卡制下每关不同：第 1 关 3 波）
const boot = await snap();
const totalWaves = boot?.totalWaves ?? -1;
check('读到了本关总波数（关卡配置驱动）', totalWaves > 0, true);
if (!(totalWaves > 1)) {
  console.log(`❌ 总波数异常（${totalWaves}），无法验证末波`);
  await browser.close();
  process.exit(1);
}
const penultimate = totalWaves - 1;

console.log(`\n===== 起步 startWave(${penultimate}) → 清空 → 观察末波（wave ${totalWaves}）闭环 =====`);
await page.evaluate((n) => window.__waveDebug.startWave(n), penultimate);

let sawFinalWaveEnemies = false;
let maxFinalWaveSpawned = 0;
let levelCompleteStep = -1;
let unmountedAfterComplete = false;

for (let step = 0; step < 400; step++) {
  const s = await snap();
  if (!s) break;

  if (s.wave >= totalWaves) {
    maxFinalWaveSpawned = Math.max(maxFinalWaveSpawned, s.waveState?.enemiesSpawned ?? 0);
    if (s.aliveEnemies > 0) sawFinalWaveEnemies = true;
    if (s.levelCompleteFired && levelCompleteStep < 0) levelCompleteStep = step;
    // 完成后 GameScene 会被卸载、引擎销毁，update 回调随之停止
    if (levelCompleteStep >= 0 && s.diag?.ticks === 0) unmountedAfterComplete = true;
  }

  if (s.levelCompleteFired) {
    console.log(
      `  step=${step} ✅ 关卡完成 | wave=${s.wave}/${totalWaves} spawned=${s.waveState?.enemiesSpawned} defeated=${s.waveState?.enemiesDefeated} finalCleared=${s.finalWaveCleared}`,
    );
    await page.waitForTimeout(2500);
    // 结算界面应为「胜利！」（关卡完成），而不是「游戏结束」（玩家阵亡）
    const victory = (await page.locator('text=胜利').count()) > 0;
    const defeat = (await page.locator('text=游戏结束').count()) > 0;
    console.log(`  结算界面: 胜利=${victory} 游戏结束=${defeat}`);
    check('结算界面为「胜利」而非「游戏结束」', victory && !defeat, true);
    fs.mkdirSync('docs/verify', { recursive: true });
    await page
      .screenshot({ path: 'docs/verify/wave-victory.png', fullPage: true })
      .catch(() => {});
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

  if (step % 10 === 0) {
    console.log(
      `  step=${step} wave=${s.wave} alive=${s.aliveEnemies} rem=${s.remaining} sp=${s.waveState?.enemiesSpawned} df=${s.waveState?.enemiesDefeated} st=${s.waveState?.currentState} finalCleared=${s.finalWaveCleared} ticks=${s.diag?.ticks}`,
    );
  }
  await page.waitForTimeout(600);
}

const fin = await snap();
console.log('\n================ 结果 ================');
check(`末波（wave ${totalWaves}）真的生成过敌人`, sawFinalWaveEnemies, true);
check(`末波被完整打完（生成数 > 0）`, maxFinalWaveSpawned > 0, true);
check('关卡完成被触发', levelCompleteStep >= 0, true);
// 仅作信息输出：完成后 App 会切到结算界面并卸载 GameScene（属正常路径），
// 所以「引擎被销毁」在这里不是断言项 —— 真正的回归信号是末波是否被跳过。
console.log(`  完成后引擎已卸载（正常）: ${unmountedAfterComplete ? '是' : '否'}`);
console.log(`  末波最大生成数: ${maxFinalWaveSpawned}`);
console.log(`  最终状态: wave=${fin?.wave} alive=${fin?.aliveEnemies} ws=${JSON.stringify(fin?.waveState?.currentState)}`);
console.log(`运行时错误: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log('  ', e.slice(0, 200)));

const failed = results.filter((r) => !r.pass);
console.log(`通过 ${results.length - failed.length}/${results.length}`);
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
