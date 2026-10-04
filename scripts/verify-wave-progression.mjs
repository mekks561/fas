// 闭环验证（决定性版）：用 dev 调试钩子 __waveDebug 驱动完整波次流转。
//
// 此前两次尝试让"真实玩家"打通波次，都因为玩家生存/命中率问题失败
// （15 秒内被射死、0 命中）。波次推进逻辑本身不应被枪法卡住，
// 所以改为：进战斗后用 killAll() 清空每一波，观察波号是否 1→2→…→10，
// 以及最后一波清空后是否触发关卡完成结算。
//
// 验证点：
//  1. 波次能推进（wave 1 → 2 → …），证明闭环断点已修复
//  2. 强化选择弹窗出现且能被关闭（自动倒计时或点击）
//  3. 最后一波清空后触发关卡完成（isGamePaused + 结算界面）
//  4. 运行时错误 0
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
const OUT_DIR = 'docs/verify';
fs.mkdirSync(OUT_DIR, { recursive: true });

const logs = [];
const errors = [];
const browser = await chromium.launch({
  executablePath: fs.existsSync(EXE) ? EXE : undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    // 防止窗口后台化时 rAF 被节流（游戏冻结的干扰因素之一）
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// rAF 计数：引擎若被销毁（GameScene 卸载），rAF 会彻底停止
await page.addInitScript(() => {
  let n = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    orig((t) => {
      n++;
      cb(t);
    });
  window.__rafProbeCount = () => n;
});

page.on('console', (m) => {
  const text = m.text();
  if (text.includes('[LuaEngine stub]') || text.includes('[GameHUD] Player stats')) return;
  logs.push(`[${m.type()}] ${text}`);
  if (m.type() === 'error') errors.push(text);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

const click = async (patterns, tag) => {
  for (const p of patterns) {
    const btn = page.locator('button', { hasText: p }).first();
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 8000 }).catch(() => {});
      return true;
    }
  }
  console.log(`[${tag}] 未找到按钮`);
  return false;
};

await click([/开始游戏/, /START/i, /PLAY/i], 'menu');
await page.waitForTimeout(3000);
await click([/开始挑战/, /挑战/, /^开始$/], 'level');
await page.waitForTimeout(8000);

for (let i = 0; i < 12; i++) {
  const end = page.locator('text=点击结束').first();
  const dlg = page.locator('text=点击继续').first();
  if ((await end.count()) > 0) {
    await page.mouse.click(640, 560);
    await page.waitForTimeout(700);
    continue;
  }
  if ((await dlg.count()) === 0) break;
  await page.mouse.click(640, 560);
  await page.waitForTimeout(700);
}

// 等调试钩子可用
const hasDebug = await page
  .waitForFunction(() => typeof window.__waveDebug === 'object', { timeout: 15000 })
  .then(() => true)
  .catch(() => false);
if (!hasDebug) {
  console.log('❌ __waveDebug 不可用（可能是生产构建或初始化失败）');
  await browser.close();
  process.exit(1);
}

const getState = () =>
  page.evaluate(() => window.__waveDebug.getState()).catch(() => null);

// 开无敌：验证的是波次推进逻辑，不让玩家生存问题（15 秒内被射死）掩盖结论
await page.evaluate(() => window.__waveDebug.godMode(true));

console.log('=== 开始驱动波次流转 ===');
const waveTrail = [];
let levelCompleted = false;
let playerDied = false;
let lastWaveSamples = 0;

for (let step = 0; step < 600; step++) {
  const s = await getState();
  if (!s) break;

  // 前 30 步：密集采样敌人状态，抓「敌人凭空消失」的过程
  if (step < 30) {
    const enemies = await page.evaluate(() => window.__waveDebug.inspectEnemies());
    const raf = await page.evaluate(() => window.__rafProbeCount || -1);
    console.log(
      `step=${step} alive=${s.aliveEnemies} spawned=${s.waveState?.enemiesSpawned} defeated=${s.waveState?.enemiesDefeated} elapsed=${s.waveState?.elapsedTime?.toFixed(0)} enemies=[${enemies.map((e) => `${e.i}:hp${e.health}${e.isDying ? 'D' : ''}`).join(' ')}]`,
    );
    void raf;
  }

  // 达到最后一波后逐步打印存活诊断
  if (s.wave >= s.totalWaves) {
    lastWaveSamples++;
    if (lastWaveSamples <= 20 || lastWaveSamples % 20 === 0) {
      const d = s.diag || {};
      const ei = s.enemyInternals || {};
      console.log(
        `[W${s.wave} #${lastWaveSamples}] active=${s.waveActive} alive=${s.aliveEnemies} rem=${s.remaining} spawned=${s.waveState?.enemiesSpawned} defeated=${s.waveState?.enemiesDefeated} elapsed=${s.waveState?.elapsedTime?.toFixed(1)} state=${s.waveState?.currentState} | finalCleared=${s.finalWaveCleared} lvlDone=${s.levelCompleteFired} | ready=${s.sceneReady} ticks=${d.ticks} eUpd=${d.enemyUpdates}`,
      );
    }
  }

  // 关卡完成信号（末波真正打完）→ 已触发结算，本次验证成功
  if (s.levelCompleteFired) {
    levelCompleted = true;
    console.log(`  step=${step} 关卡完成已触发（末波 finalWaveCleared=${s.finalWaveCleared}）`);
    await page.waitForTimeout(2500);
    break;
  }

  // 玩家死亡检测：结算界面出现
  const over = await page.locator('text=游戏结束').count();
  if (over > 0) {
    playerDied = true;
    console.log(`  step=${step} 玩家死亡，提前结束`);
    break;
  }

  // 强化选择弹窗：点第一张卡（倒计时也会自动选，点了更快）
  if (s.upgradeVisible) {
    const card = page.locator('.upgrade-card').first();
    if ((await card.count()) > 0) {
      await card.click({ timeout: 3000 }).catch(() => {});
      waveTrail.push(`W${s.wave}:强化选择`);
    }
    await page.waitForTimeout(500);
    continue;
  }

  // 有敌人（已生成）→ 清空；波次生成器会继续放剩下的，循环会再清
  if (s.aliveEnemies > 0) {
    await page.evaluate(() => window.__waveDebug.killAll());
    await page.waitForTimeout(450);
    continue;
  }

  // 场上无敌人：波次完成结算 + 波间过渡需要一点时间
  waveTrail.push(`W${s.wave}(alive=0,rem=${s.remaining},${s.waveActive ? 'active' : 'idle'})`);
  await page.waitForTimeout(900);
}

await page.screenshot({ path: `${OUT_DIR}/wave-final.png` }).catch(() => {});
const finalState = await getState();
const gameOverShown = (await page.locator('text=游戏结束').count()) > 0;
const victoryShown =
  (await page.locator('text=胜利').count()) > 0 ||
  (await page.locator('text=通关').count()) > 0;

console.log('\n================ 结果 ================');
console.log(`波次轨迹: ${waveTrail.join(' → ') || '(空)'}`);
const advancedWaves = new Set(waveTrail.map((t) => Number(t.match(/W(\d+)/)?.[1] || 0)));
console.log(`到达过的波次: ${[...advancedWaves].sort((a, b) => a - b).join(', ')}`);
console.log(`最终状态: ${JSON.stringify(finalState)}`);
console.log(`关卡完成: ${levelCompleted ? '✅' : '❌'}  结算界面: ${gameOverShown ? '出现' : '未出现'}  胜利文案: ${victoryShown ? '出现' : '未出现'}  玩家死亡: ${playerDied ? '是' : '否'}`);
console.log(`运行时错误: ${errors.length} 条`);
errors.slice(0, 10).forEach((e) => console.log('  ', e.slice(0, 180)));

const waveLogs = logs.filter((l) => /Wave \d+ started|Wave completed|波次|关卡完成/.test(l));
console.log(`\n波次相关日志 ${waveLogs.length} 条:`);
waveLogs.slice(0, 20).forEach((l) => console.log('  ', l.slice(0, 140)));

await browser.close();
