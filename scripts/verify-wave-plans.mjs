/**
 * 波次计划接线验证（关卡显式波次表 → WaveManager 计划模式）。
 *
 * 背景：
 *  - 此前战役波次的敌人数量/类型由 Lua 公式生成（5×1.1^(n-1)×难度），
 *    关卡配置里的显式波次表（enemy-scout×3 等）从未被消费，且配置词表
 *    （enemy- 前缀 / boss-sentinel 连字符）EnemySystem 根本不认识；
 *  - boss 波判定 = wave % 5 == 0，而战役波数常 < 5 → 末波永不是 boss。
 *
 * 断言：
 *  A. level-01（3 波，计划 3/5/6 敌人，公式会给 4/4/4）
 *   1. __levelDebug: wavePlans === 3（计划已注入）、maxWaves === 3
 *   2. 第 1 波 remaining === 3（计划，非公式 4）
 *   3. 第 2 波 remaining === 5（计划，非公式 4）
 *   4. 第 3 波 remaining === 6（计划 4 scout + 2 fighter，非公式 4）
 *   5. 打完全部 3 波 → levelCompleteFired
 *  B. level-05（?level=5 深链，末波 = boss_sentinel×1）
 *   6. 第 3 波 waveState.isBossWave === true（数据驱动，非 %5 公式）
 *   7. remaining === 1 且场上生成 1 个敌人
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

const enterBattle = async (url, levelCardText, clearedUpTo = 0) => {
  // 需要解锁指定关时，注入「前面的关已通关」的存档（LevelSelect 解锁 = 上一关已通关）
  if (clearedUpTo > 1) {
    await page.addInitScript((n) => {
      const progress = {};
      for (let i = 1; i < n; i++) progress[i] = { cleared: true, stars: 3 };
      localStorage.setItem('levelProgress', JSON.stringify(progress));
    }, clearedUpTo);
  }
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
  // 剧情对话推进
  for (let i = 0; i < 12; i++) {
    const dlg = page.locator('text=点击继续').first();
    const end = page.locator('text=点击结束').first();
    if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
  }
  await page
    .waitForFunction(() => typeof window.__waveDebug === 'object', { timeout: 20000 })
    .catch(() => {});
  await page.evaluate(() => window.__waveDebug?.godMode?.(true)).catch(() => {});
  await page.waitForTimeout(800);
};

/** 清场 → 等下一波开始（处理强化弹窗），返回新波的 remaining */
const advanceToWave = async (targetWave, maxSteps = 60) => {
  for (let step = 0; step < maxSteps; step++) {
    const s = await page.evaluate(() => window.__waveDebug.getState());
    if (s.levelCompleteFired) return { complete: true, wave: s.wave, remaining: s.remaining };
    if (s.wave >= targetWave) {
      return { complete: false, wave: s.wave, remaining: s.remaining, alive: s.aliveEnemies };
    }
    if (s.upgradeVisible) {
      const card = page.locator('.upgrade-card').first();
      if ((await card.count()) > 0) await card.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      continue;
    }
    if (s.aliveEnemies > 0) {
      await page.evaluate(() => window.__waveDebug.killAll());
      await page.waitForTimeout(450);
      continue;
    }
    await page.waitForTimeout(900);
  }
  return { complete: false, wave: -1, remaining: -1 };
};

// ---------------------------------------------------------------------------
console.log('\n===== A. level-01：显式波次表驱动 =====');
await enterBattle(BASE, '初次接触');

const summary = await page.evaluate(() => window.__levelDebug.summary());
check('wavePlans（计划已注入）', summary.wavePlans, 3);
check('maxWaves（配置波数）', summary.maxWaves, 3);

const w1 = await page.evaluate(() => window.__waveDebug.getState());
check('第 1 波 remaining（计划 3，公式是 4）', w1.remaining, 3);
check('第 1 波 waveNumber', w1.wave, 1);

const w2 = await advanceToWave(2);
check('推进到第 2 波', w2.wave, 2);
check('第 2 波 remaining（计划 5，公式是 4）', w2.remaining, 5);

const w3 = await advanceToWave(3);
check('推进到第 3 波', w3.wave, 3);
check('第 3 波 remaining（计划 6 = 4 scout + 2 fighter，公式是 4）', w3.remaining, 6);

// 打完末波 → 关卡完成（顺带证明计划模式下波次闭环/结算没有被破坏）
const fin = await advanceToWave(99, 90);
check('打完 3 波触发关卡完成', fin.complete, true);

// ---------------------------------------------------------------------------
console.log('\n===== B. level-05（?level=5）：末波 boss 由数据决定 =====');
await enterBattle(`${BASE}?level=5`, '精英中队', 5);

const summary5 = await page.evaluate(() => window.__levelDebug.summary());
check('levelId', summary5.levelId, 'level-05');
check('wavePlans（计划已注入）', summary5.wavePlans, 3);
check('maxWaves（注入计划时同步为计划波数）', summary5.maxWaves, 3);

// 直接跳末波（第 3 波 = boss_sentinel×1）
await page.evaluate(() => window.__waveDebug.startWave(3));
// boss 生成间隔 2500ms，留足余量
await page.waitForTimeout(4000);
const boss = await page.evaluate(() => window.__waveDebug.getState());
check('第 3 波 isBossWave（数据驱动，公式 3%5≠0 恒 false）', boss.waveState?.isBossWave, true);
check('末波生成队列（计划 boss×1，已实际生成）', boss.waveState?.enemiesSpawned, 1);
check('末波 remaining（boss×1）', boss.remaining, 1);

// 打掉末波（含场上残留敌人，计划模式会拒绝已完成波的重复结算）→ 关卡完成
let bossComplete = false;
for (let i = 0; i < 40 && !bossComplete; i++) {
  const s = await page.evaluate(() => window.__waveDebug.getState());
  if (s.levelCompleteFired) {
    bossComplete = true;
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
  await page.waitForTimeout(900);
}
check('末波 boss 击杀触发关卡完成', bossComplete, true);

check('无运行时错误', errors.length, 0);

await page
  .screenshot({ path: 'docs/verify/wave-plans-boss.png' })
  .catch((e) => console.log('截图跳过:', e.code));

console.log(results.join('\n'));
console.log(`\n${failed ? '❌ 有断言失败' : '✅ 全部通过'}`);
if (errors.length) console.log('运行时错误:', errors.join('\n'));
await browser.close();
process.exit(failed ? 1 : 0);
