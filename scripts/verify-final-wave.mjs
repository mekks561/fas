// 末波闭环验证（快，约 1 分钟）：wave 9 → 清空 → wave 10 → 清空 → 关卡完成。
//
// 这是 `verify-wave-progression.mjs`（全 10 波，约 10 分钟）的快速回归版，
// 专门守住曾经最隐蔽的 bug：关卡完成条件在末波**启动的同一帧**就成立
// （波号已达上限、敌人要下一帧才生成、nextWave 刚被置 null），
// 导致第 10 波被整个跳过、GameScene 被 React 卸载、引擎销毁、整局冻结。
//
// 关键断言：wave 10 必须真正生成敌人并被清空，然后才触发关卡完成；
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

console.log('\n===== 起步 startWave(9) → 清空 → 观察末波闭环 =====');
await page.evaluate(() => window.__waveDebug.startWave(9));

let sawWave10Enemies = false;
let maxWave10Spawned = 0;
let levelCompleteStep = -1;
let unmountedAfterComplete = false;
let frozen = false;

for (let step = 0; step < 400; step++) {
  const s = await snap();
  if (!s) break;

  if (s.wave >= 10) {
    maxWave10Spawned = Math.max(maxWave10Spawned, s.waveState?.enemiesSpawned ?? 0);
    if (s.aliveEnemies > 0) sawWave10Enemies = true;
    if (!frozen && s.diag?.ticks === 0 && step > 5) frozen = true;
    if (s.levelCompleteFired && levelCompleteStep < 0) levelCompleteStep = step;
    if (levelCompleteStep >= 0 && s.diag?.ticks === 0) unmountedAfterComplete = true;
  }

  if (s.levelCompleteFired) {
    console.log(
      `  step=${step} ✅ 关卡完成 | wave=${s.wave} spawned=${s.waveState?.enemiesSpawned} defeated=${s.waveState?.enemiesDefeated} finalCleared=${s.finalWaveCleared}`,
    );
    await page.waitForTimeout(2500);
    // 结算界面应为「胜利！」（关卡完成），而不是「游戏结束」（玩家阵亡）
    const victory = (await page.locator('text=胜利').count()) > 0;
    const defeat = (await page.locator('text=游戏结束').count()) > 0;
    console.log(`  结算界面: 胜利=${victory} 游戏结束=${defeat}`);
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
console.log(`末波(wave10)真的生成过敌人: ${sawWave10Enemies ? '✅' : '❌'}`);
console.log(`末波最大生成数: ${maxWave10Spawned}（应接近 20，说明末波被完整打完而非被跳过）`);
console.log(`关卡完成触发: ${levelCompleteStep >= 0 ? '✅' : '❌'}`);
console.log(`完成后引擎被卸载(异常): ${unmountedAfterComplete ? '是 ❌' : '否 ✅'}`);
console.log(`最终状态: wave=${fin?.wave} alive=${fin?.aliveEnemies} ws=${JSON.stringify(fin?.waveState?.currentState)}`);
console.log(`运行时错误: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log('  ', e.slice(0, 200)));
await browser.close();
