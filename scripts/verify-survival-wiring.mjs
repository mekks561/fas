// 生存模式接线验证：断言「主菜单入口 → 面板 → 开局 → 无尽波次 → 统计 → 阵亡结算入榜」。
//
// 背景：生存模式此前是又一个「做完没接」的半成品——
//   · SurvivalModeManager（437 行 + 374 行测试）没有任何生产代码调用它的
//     update(dt) / recordEnemyDefeat，状态机永远停在 menu；
//   · SurvivalModeUI（253 行）零引用，玩家没有入口；
//   · 面板连 CSS 都没有（零引用组件从未配过样式）；
//   · 第 186 行还在 `if (state === 'gameOver')` 分支体内调 useEffect（条件 Hook，
//     状态一切换就会抛 "Rendered more hooks than during the previous render"）。
//
// 接线设计（本脚本验证的就是它）：敌人只有 WaveManager 一个真源，
// SurvivalModeManager 交出波次生成权（setExternalControl(true)），只保留
// 「计时 + 统计 + 状态机」；GameScene 做桥接 —— 检出它的 currentWave 前进，
// 就让 EnemySystem 启动对应波次。
//
// 断言链：
//   主菜单有入口 → 面板渲染（有样式）→ 开始 → 开局流程
//   → 倒计时走完 → **真实战斗波次被桥接启动**（combatWave=1、场上有敌人）
//   → 清波 → 波号前进 + 分数/击杀上涨 → 第 3 波是精英波
//   → 阵亡 → 状态机 gameOver + 面板渲染结算 → 提交名字入榜 → 再来一局
//
// 用法：先起 dev server（`npx vite --port 5176`），再
//   VERIFY_URL=http://127.0.0.1:5176/ node scripts/verify-survival-wiring.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VERIFY_URL || 'http://localhost:5176/';
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

const surv = () =>
  page
    .evaluate(() => window.__survivalDebug?.getState?.() ?? null)
    .catch(() => null);

// 波次完成会弹「三选一强化」并暂停游戏；不点掉的话波间倒计时不会推进
// （同步逻辑刻意放在「非暂停」分支里，因为暂停正是玩家操作的窗口）。
const closeUpgradeIfAny = async () => {
  const card = page.locator('.upgrade-card').first();
  if ((await card.count()) > 0) {
    await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
  }
};

/** 反复清空场上敌人，直到生存波号达到 targetWave。 */
const clearToWave = async (targetWave, ms = 60000) => {
  const deadline = Date.now() + ms;
  let last = null;
  while (Date.now() < deadline) {
    await closeUpgradeIfAny();
    await page.evaluate(() => window.__waveDebug?.killAll?.());
    await page.waitForTimeout(900);
    last = await surv();
    if ((last?.wave ?? 0) >= targetWave) return last;
  }
  return last;
};

// ───────────────────────── 0. 清档 ─────────────────────────
console.log('\n===== 0. 清档（最高分榜会持久化，必须先清） =====');
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(() => {
  // 生存管理器是模块级单例，加载时就读过 localStorage，清完必须重载页面
  localStorage.clear();
});
await page.reload({ waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

// ───────────────────────── 1. 主菜单入口 ─────────────────────────
console.log('\n===== 1. 主菜单「生存模式」入口 =====');
const entry = await click([/生存模式/, /Survival/i]);
check('主菜单有「生存模式」入口', entry, true);
await page.waitForTimeout(3000);

const menuCount = await page.locator('.survival-menu').count();
check('生存模式面板已打开（.survival-menu 渲染）', menuCount > 0, true);
const startCount = await page.locator('.survival-start-btn').count();
check('面板有「开始」按钮', startCount > 0, true);

// 样式断言：面板此前零引用、从未配过 CSS，这里确认接入后真的有样式
const menuStyled = await page
  .locator('.survival-menu')
  .first()
  .evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      hasBackground: cs.backgroundImage !== 'none' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)',
    };
  })
  .catch(() => null);
checkTrue('面板容器有布局样式（flex）', menuStyled?.display === 'flex', `display=${menuStyled?.display}`);
checkTrue('面板容器有背景样式', menuStyled?.hasBackground === true);

await page.screenshot({ path: path.join(OUT_DIR, 'survival-01-menu.png') });

// ───────────────────────── 2. 开始一局 ─────────────────────────
console.log('\n===== 2. 开始一局 → 进入战斗 =====');
await page.locator('.survival-start-btn').click();

const hasHooks = await page
  .waitForFunction(
    () => typeof window.__survivalDebug === 'object' && typeof window.__waveDebug === 'object',
    { timeout: 35000 },
  )
  .then(() => true)
  .catch(() => false);
check('战斗场景与调试钩子就绪', hasHooks, true);
if (!hasHooks) {
  await page.screenshot({ path: path.join(OUT_DIR, 'survival-99-fail.png') });
  await browser.close();
  process.exit(1);
}

// 验证波次链路时不让玩家被敌人打死
await page.evaluate(() => window.__waveDebug.godMode(true));

const s1 = await surv();
console.log(`  钩子就绪时 state=${s1?.state} wave=${s1?.wave}`);
checkTrue(
  '开局进入生存流程（preparing 倒计时 / playing）',
  s1?.state === 'preparing' || s1?.state === 'playing',
  `state=${s1?.state}`,
);

// ───────────────────────── 3. 倒计时 → 桥接启动真实波次 ─────────────────────────
console.log('\n===== 3. 倒计时走完 → 桥接启动真实战斗波次 =====');
await page.evaluate(() => window.__survivalDebug.skipCountdown());
await page.waitForTimeout(3000);
const s2 = await surv();
console.log(
  `  state=${s2?.state} 生存波号=${s2?.wave} 战斗波号=${s2?.combatWave} 场上敌人=${s2?.aliveEnemies}`,
);
check('倒计时结束后进入 playing', s2?.state, 'playing');
check('生存波号 = 1', s2?.wave, 1);
check('真实战斗波次已被桥接启动（combatWave = 1）', s2?.combatWave, 1);
checkTrue('场上已有敌人（桥接真的把敌人放出来了）', (s2?.aliveEnemies ?? 0) > 0);

// ───────────────────────── 4. 清波 → 统计上涨 ─────────────────────────
console.log('\n===== 4. 清一波 → 波号前进 + 分数/击杀上涨 =====');
const before = await surv();
const s3 = await clearToWave(2);
console.log(
  `  清波后：波号=${s3?.wave} 分数=${s3?.score} 击杀=${s3?.kills}（清之前 分数=${before?.score} 击杀=${before?.kills}）`,
);
checkTrue('生存波号前进到 2', (s3?.wave ?? 0) >= 2, `wave=${s3?.wave}`);
checkTrue('分数上涨', (s3?.score ?? 0) > (before?.score ?? 0), `${before?.score} → ${s3?.score}`);
checkTrue('击杀数上涨', (s3?.kills ?? 0) > (before?.kills ?? 0), `${before?.kills} → ${s3?.kills}`);
checkTrue('战斗波次跟着前进（combatWave >= 2）', (s3?.combatWave ?? 0) >= 2, `combatWave=${s3?.combatWave}`);

// ───────────────────────── 5. 精英波标记 ─────────────────────────
console.log('\n===== 5. 第 3 波：精英波标记 =====');
const s4 = await clearToWave(3);
console.log(`  第 ${s4?.wave} 波：isEliteWave=${s4?.isEliteWave} isBossWave=${s4?.isBossWave}`);
checkTrue('第 3 波被标记为精英波', s4?.isEliteWave === true, `wave=${s4?.wave}`);

await page.screenshot({ path: path.join(OUT_DIR, 'survival-02-battle.png') });

// ───────────────────────── 6. HUD 渲染 ─────────────────────────
console.log('\n===== 6. 战斗中 HUD =====');
const hudCount = await page.locator('.survival-hud').count();
check('战斗 HUD 已渲染（.survival-hud）', hudCount > 0, true);
const hudText = await page
  .locator('.survival-hud')
  .innerText()
  .catch(() => '');
console.log(`  HUD 文本：${hudText.replace(/\s+/g, ' ').slice(0, 120)}`);
checkTrue('HUD 显示波次信息', /波|Wave/i.test(hudText));
checkTrue('HUD 显示分数', /\d/.test(hudText));

// ───────────────────────── 7. 阵亡 → 结算 → 入榜 ─────────────────────────
console.log('\n===== 7. 阵亡 → 结算界面 → 提交名字入榜 =====');
// 波次完成会弹「三选一强化」并暂停游戏，而阵亡判定在「非暂停」分支里
// （战场上暂停时敌人本就不动，所以那是正确行为，不是 bug）——
// 验证阵亡前必须先关掉弹窗，否则伤害生效了但结束流程不会触发。
await closeUpgradeIfAny();
await page.waitForTimeout(600);
const beforeDeath = await surv();
await page.evaluate(() => window.__survivalDebug.killPlayer());
await page.waitForTimeout(4000);

const sDead = await surv();
console.log(`  阵亡后 state=${sDead?.state}（本局分数=${beforeDeath?.score}）`);
check('阵亡后状态机进入 gameOver', sDead?.state, 'gameOver');

const overCount = await page.locator('.survival-gameover').count();
check('生存面板渲染出结算界面（.survival-gameover）', overCount > 0, true);

const bodyText = await page.locator('body').innerText().catch(() => '');
checkTrue('结算界面显示最终得分', /最终得分|Final Score/.test(bodyText));
// 结算界面的成绩明细用的是 .stat-value，直接读出来比正则更可靠
const statValues = await page
  .locator('.survival-gameover .stat-value')
  .allInnerTexts()
  .catch(() => []);
console.log(`  成绩明细：${statValues.join(' / ')}`);
checkTrue(
  '成绩明细里含本局分数',
  statValues.some((v) => v.replace(/[,\s]/g, '').includes(String(beforeDeath?.score ?? -1))),
  `分数=${beforeDeath?.score}`,
);

// 本地榜为空 → 必然是新最高分 → 应弹出名字输入框
const nameInput = page.locator('.survival-gameover .name-input');
const hasNameInput = (await nameInput.count()) > 0;
check('新最高分 → 弹出名字输入框', hasNameInput, true);

if (hasNameInput) {
  await nameInput.fill('VERIFIER');
  await page.locator('.survival-gameover .submit-name-btn').click();
  await page.waitForTimeout(1500);
  const sAfter = await surv();
  console.log(`  入榜后 highScoreCount=${sAfter?.highScoreCount} highScore=${sAfter?.highScore}`);
  check('提交后榜单记录数 = 1', sAfter?.highScoreCount, 1);
  checkTrue(
    '最高分等于本局分数',
    (sAfter?.highScore ?? 0) === (beforeDeath?.score ?? -1),
    `${sAfter?.highScore} vs ${beforeDeath?.score}`,
  );
}

await page.screenshot({ path: path.join(OUT_DIR, 'survival-03-gameover.png') });

// 结算界面提供「再来一局」；此处不点它，改走「返回菜单」路径 ——
// 顺便验证成绩确实落了盘、并且榜单把它渲染了出来（入库 → 展示的闭环）。
check('结算界面有「再来一局」按钮', (await page.locator('.survival-restart-btn').count()) > 0, true);

// ───────────────────────── 8. 返回菜单 → 重开面板看榜单 ─────────────────────────
console.log('\n===== 8. 返回菜单 → 重开面板 → 榜单展示已入榜成绩 =====');
const backBtn = page.locator('.survival-back-btn').first();
check('结算界面有「返回菜单」按钮', (await backBtn.count()) > 0, true);
await backBtn.click();
await page.waitForTimeout(2500);
// 「返回菜单」走的是主菜单，生存面板随之卸载 —— 这是预期的路由行为，
// 所以要重新从主菜单进面板才能看到榜单。
check(
  '已回到主菜单（生存面板卸载）',
  (await page.locator('.survival-menu').count()) === 0 &&
    (await page.locator('button', { hasText: /开始游戏/ }).count()) > 0,
  true,
);

const reEntry = await click([/生存模式/, /Survival/i]);
check('可从主菜单再次进入生存模式', reEntry, true);
await page.waitForTimeout(3000);
check(
  '生存模式菜单已打开（.survival-menu）',
  (await page.locator('.survival-menu').count()) > 0,
  true,
);

const listText = await page
  .locator('.survival-leaderboard')
  .innerText()
  .catch(() => '');
console.log(`  榜单文本：${listText.replace(/\s+/g, ' ').slice(0, 140)}`);
checkTrue('榜单里出现刚提交的名字', listText.includes('VERIFIER'));
checkTrue(
  '榜单里显示该局分数',
  listText.replace(/[,\s]/g, '').includes(String(beforeDeath?.score ?? -1)),
  `分数=${beforeDeath?.score}`,
);

// ───────────────────────── 9. 从菜单再开一局 ─────────────────────────
console.log('\n===== 9. 从菜单再开一局（验证可重复开局） =====');
await page.locator('.survival-start-btn').click();
const backInGame = await page
  .waitForFunction(() => typeof window.__survivalDebug === 'object', { timeout: 35000 })
  .then(() => true)
  .catch(() => false);
check('重新进入战斗', backInGame, true);
if (backInGame) {
  await page.evaluate(() => window.__waveDebug.godMode(true));
  await page.waitForTimeout(1500);
  const s5 = await surv();
  console.log(`  重开后 state=${s5?.state} 分数=${s5?.score} 波号=${s5?.wave}`);
  checkTrue('重开后进入新的生存流程', s5?.state === 'preparing' || s5?.state === 'playing');
  check('重开后分数归零', s5?.score, 0);
}

// ───────────────────────── 汇总 ─────────────────────────
const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n===== 结果：${passed}/${results.length} 通过 =====`);
if (failed.length) {
  console.log('失败项：');
  failed.forEach((f) => console.log(`  ❌ ${f.label}（实得=${f.actual} 期望=${f.expected}）`));
}
console.log(`运行时错误：${errors.length} 条`);
errors.slice(0, 8).forEach((e) => console.log(`  ⚠️  ${e.slice(0, 200)}`));

await browser.close();
process.exitCode = failed.length || errors.length ? 1 : 0;
