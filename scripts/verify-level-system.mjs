/**
 * 关卡系统接线验证（src/levels 从死数据变为唯一真源）。
 *
 * 背景：
 *  - 此前 LevelSelect 自带 5 关硬编码列表，与 levels/*.ts 的 10 关配置平行；
 *  - 选中的关卡 id 传到 App 就断了，GameScene 从不读关卡配置 ——
 *    天幕 / 光照 / 小行星带 / 玩家初始属性 / 波次上限全部与策划无关。
 *
 * 断言：
 *  A. 选关界面（数据源）
 *   1. 关卡数为 10（来自 levels，不再是硬编码的 5）
 *   2. 显示 levels 的中文名（「初次接触」「星际帝王」）
 *  B. 战斗运行时（配置驱动）
 *   3. __levelDebug 就绪
 *   4. levelId === 'level-01'
 *   5. playerMaxHealth === 100（配置 player.health，而非 store 残留值）
 *   6. maxWaves === 3（配置波数，而非 Lua 默认 10）
 *   7. asteroidCount === 0（本关 asteroidField: false，而非原硬编码 40）
 *   8. skybox === 'env-space-01' 且 skyboxUrl 为 space 贴图
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VERIFY_URL || 'http://localhost:5177/';
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
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

console.log('\n===== A. 选关界面（数据源 = src/levels）=====');
await page
  .locator('button', { hasText: /开始游戏/ })
  .first()
  .click({ timeout: 10000 });
// LevelSelect 是 lazy chunk：dev 首次编译较慢，显式等关卡卡片出现
await page.locator('p.line-clamp-2').first().waitFor({ timeout: 40000 });
await page.waitForTimeout(800);

const sel = await page.evaluate(() => {
  const body = document.body.innerText;
  const descs = document.querySelectorAll('p.line-clamp-2');
  return {
    levelCount: descs.length,
    hasFirst: body.includes('初次接触'),
    hasLast: body.includes('星际帝王'),
  };
});
check('选关界面关卡数（来自 levels）', sel.levelCount, 10);
check('显示 levels 中文名（初次接触）', sel.hasFirst, true);
check('显示 levels 中文名（星际帝王）', sel.hasLast, true);

console.log('\n===== B. 战斗运行时（关卡配置驱动）=====');
await page.locator('h3', { hasText: '初次接触' }).first().click({ timeout: 15000 });
await page.waitForTimeout(10000);
// 剧情对话推进（点击继续 / Enter）
for (let i = 0; i < 12; i++) {
  const dlg = page.locator('text=点击继续').first();
  const end = page.locator('text=点击结束').first();
  if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
}

const ready = await page
  .waitForFunction(() => typeof window.__levelDebug === 'object', { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
check('__levelDebug 就绪', ready, true);

// 立刻无敌，避免后续等待中阵亡
await page.evaluate(() => window.__waveDebug?.godMode?.(true)).catch(() => {});
await page.waitForTimeout(1200);

const s = await page.evaluate(() => window.__levelDebug.summary());
check('levelId', s.levelId, 'level-01');
check('playerMaxHealth（配置 player.health）', s.playerMaxHealth, 100);
check('maxWaves（配置波数，非 Lua 默认 10）', s.maxWaves, 3);
check('asteroidCount（本关无小行星带）', s.asteroidCount, 0);
check('skybox id', s.skybox, 'env-space-01');
check('skyboxUrl 映射', s.skyboxUrl, '/assets/textures/skybox-space.png');

console.log('\n===== C. 关卡进度与解锁（差分）=====');
// 注入「第 1 关已通关」的存档（模拟真实通关后的写入），刷新后第 2 关应解锁
await page.evaluate(() => {
  localStorage.setItem('levelProgress', JSON.stringify({ 1: { cleared: true, stars: 2 } }));
});
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page
  .locator('button', { hasText: /开始游戏/ })
  .first()
  .click({ timeout: 10000 });
await page.locator('p.line-clamp-2').first().waitFor({ timeout: 40000 });
await page.waitForTimeout(800);

// 第 1 关应显示注入的 2 星（进度 → 界面的单向验证）
const stars = await page.evaluate(() => {
  const h = [...document.querySelectorAll('h3')].find((x) => x.textContent?.includes('初次接触'));
  const card = h?.closest('div');
  return card ? card.querySelectorAll('svg.fill-yellow-400').length : -1;
});
check('第 1 关显示已通关星级（进度写入→界面）', stars, 2);

// 第 2 关已解锁：点击应直接进入战斗（而非停在选关界面）
await page.locator('h3', { hasText: '陨石航道' }).first().click({ timeout: 15000 });
await page.waitForTimeout(10000);
for (let i = 0; i < 12; i++) {
  const dlg = page.locator('text=点击继续').first();
  if ((await dlg.count()) === 0) break;
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
}
const ready2 = await page
  .waitForFunction(() => typeof window.__levelDebug === 'object', { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
check('第 2 关可进入（上一关通关即解锁）', ready2, true);
if (ready2) {
  await page.evaluate(() => window.__waveDebug?.godMode?.(true)).catch(() => {});
  await page.waitForTimeout(1000);
  const s2 = await page.evaluate(() => window.__levelDebug.summary());
  // 与第 1 关的差分：小行星带 / 护盾 / 天幕 / 光照档位全部不同
  check('levelId（第 2 关）', s2.levelId, 'level-02');
  check('asteroidCount（本关有行星带，≠ 第 1 关的 0）', s2.asteroidCount, 40);
  check('playerMaxShield（本关 75，≠ 第 1 关的 50）', s2.playerMaxShield, 75);
  check('skybox id（本关星云，≠ 第 1 关的太空）', s2.skybox, 'env-nebula-01');
  check('lighting 档位（本关 dim，≠ 第 1 关的 normal）', s2.lighting, 'dim');
}

check('无运行时错误', errors.length, 0);

await page
  .screenshot({ path: 'docs/verify/level-system-battle.png' })
  .catch((e) => console.log('截图跳过:', e.code));

console.log(results.join('\n'));
console.log(`\n${failed ? '❌ 有断言失败' : '✅ 全部通过'}`);
if (errors.length) console.log('运行时错误:', errors.join('\n'));
await browser.close();
process.exit(failed ? 1 : 0);
