// 成就系统接线验证：**面板显示的是真实战果，解锁的奖励真的进了账**。
//
// 接线前的状况（两套并行真源）：
//   · 成就面板 `fetch('/assets/achievements/achievement-01..15.json')` —— 一套硬编码内容，
//     与运行时 `AchievementSystem` 的 22 条定义（不同 id、不同分类、不同奖励字段）毫无关系；
//   · 面板读 `localStorage.unlockedAchievements` —— 该 key **全仓没有任何写入方**，
//     唯一读它的就是面板自己。所以面板永远 0/15 全锁，哪怕玩家刚在战斗里解锁了三条；
//   · 运行时那 22 条虽然真的会解锁，但只发分数，JSON 里写着的 experience/credits 从未入账。
//
// 本脚本逐段验证修复后的链路，每一处都读**生产路径上的真实对象**：
//   A. 面板 = 运行时真源（条目数 = 定义数；不再请求那 15 个 JSON；预置死 key 也不受影响）
//   B. 战斗事件真的在喂统计（命中率统计此前**没有任何供给方**；技能使用次数同理）
//   C. 击杀 → 解锁 → 经验/信用点/分数真入账，且只发一次
//   D. 关卡结算按**本关真实记录**判定（无伤 / 最快用时），不是「结算这一帧看起来没掉血」
//   E. Boss 按**具体类型**统计（配置侧 boss-sentinel ↔ 运行时 boss_sentinel 两套词表）
//   F. 回到面板能看见真实解锁数与存储一致（DOM ↔ localStorage 交叉校对）
//
// 用法：先起 dev server（`npx vite --port 5177 --strictPort`），再
//   NO_PROXY=localhost,127.0.0.1 VERIFY_URL=http://localhost:5177/ node scripts/verify-achievements.mjs
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

const results = [];
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ label, actual, expected, pass });
  console.log(
    `  ${pass ? '✅' : '❌'} ${label}: 实得=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`,
  );
};
const checkTrue = (label, actual) => check(label, !!actual, true);
const checkGE = (label, actual, floor) => {
  const pass = typeof actual === 'number' && actual >= floor;
  results.push({ label, actual, expected: `>=${floor}`, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}: 实得=${actual} 期望>=${floor}`);
};

// ── 页面 A：主面板 + 完整战斗链（一个 context，localStorage 连续） ──
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const achievementLogs = [];
/** 记录所有对旧成就 JSON 的请求 —— 用来证明面板不再依赖它们 */
const legacyJsonRequests = [];
page.on('request', (req) => {
  if (req.url().includes('/assets/achievements/')) legacyJsonRequests.push(req.url());
});
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') errors.push(t);
  if (t.includes('[Achievement]')) achievementLogs.push(t);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

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

const backToMainMenu = async () => {
  await closeUpgradeIfAny();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  for (let i = 0; i < 4; i++) {
    const onMenu =
      (await page
        .locator('button', { hasText: /开始游戏|Start Game/i })
        .first()
        .count()
        .catch(() => 0)) > 0;
    if (onMenu) return true;
    await click([/返回主菜单/, /主菜单/, /Main Menu/i, /返回/]);
    await page.waitForTimeout(1800);
  }
  return false;
};

const openAchievements = async () => {
  const opened = await click([/成就/]);
  const ready = await page
    .waitForSelector('.achievement-card', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  return opened && ready;
};

const panelCardCount = () => page.locator('.achievement-card').count();
const panelProgressCount = () => page.locator('.achievement-card-progress-text').count();
const panelHeaderText = () =>
  page
    .locator('.achievement-stats-bar')
    .innerText()
    .then((t) => t.replace(/\s+/g, ' ').trim())
    .catch(() => '');
const panelNames = () =>
  page
    .locator('.achievement-card-name')
    .allInnerTexts()
    .catch(() => []);
/** 面板上「已解锁」的卡片数（DOM 侧真值，用于和 localStorage 交叉校对） */
const panelUnlockedCount = () =>
  page
    .locator('.achievement-card.unlocked')
    .count()
    .catch(() => -1);

const readProg = () =>
  page
    .evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('achievementProgress') || 'null');
      } catch {
        return null;
      }
    })
    .catch(() => null);
/** 存储里的成就表 → { id: progress } */
const progMap = (data) => (data?.achievements ? Object.fromEntries(data.achievements) : {});
const storedUnlockedCount = (data) =>
  Object.values(progMap(data)).filter((p) => p?.isUnlocked).length;

const enterLevel = async ({ deepLink = '', levelCardText = null, clearedUpTo = 0 } = {}) => {
  if (clearedUpTo > 1) {
    // 解锁前置关（addInitScript 只能加一次，所以只在建页时用一次）
    await page.addInitScript((n) => {
      const progress = {};
      for (let i = 1; i < n; i++) progress[i] = { cleared: true, stars: 3 };
      localStorage.setItem('levelProgress', JSON.stringify(progress));
    }, clearedUpTo);
  }
  await page.goto(deepLink ? `${URL}${deepLink}` : URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(9000);
  await click([/开始游戏/, /Start Game/i]);
  await page.waitForTimeout(2500);
  if (levelCardText) {
    const card = page.locator('h3', { hasText: levelCardText }).first();
    if ((await card.count()) > 0) {
      await card.click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
  const entered = await click([/开始挑战/, /挑战/, /^开始$/]);
  // 关键顺序：**先拿钩子开无敌，再推进剧情对话**。
  // 反过来的话，引擎启动到开无敌之间会挨敌机的接触伤害（实测 30 点），
  // 那会让「无伤通关」断言假失败 —— 挨打是验证脚手架的窗口，不是产品行为。
  const ready = await page
    .waitForFunction(
      () => typeof window.__waveDebug === 'object' && typeof window.__achieveDebug === 'object',
      { timeout: 60000 },
    )
    .then(() => true)
    .catch(() => false);
  if (ready) await page.evaluate(() => window.__waveDebug.godMode(true));
  // 剧情对话响应屏幕点击（不响应 Enter）
  for (let i = 0; i < 12; i++) {
    const dlg = page.locator('text=点击继续').first();
    const end = page.locator('text=点击结束').first();
    if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
    await page.mouse.click(640, 560);
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1800);
  return { entered, ready };
};

const achStats = () => page.evaluate(() => window.__achieveDebug.getStats()).catch(() => null);
const achAcc = () => page.evaluate(() => window.__achieveDebug.getAccuracy()).catch(() => null);
const achOne = (id) => page.evaluate((i) => window.__achieveDebug.getOne(i), id).catch(() => null);
const achSnap = () => page.evaluate(() => window.__achieveDebug.getSnapshot()).catch(() => null);
const waveState = () =>
  page.evaluate(() => window.__waveDebug?.getState?.() ?? null).catch(() => null);

// ───────────────────────── 0. 清档 + 预置「死 key」 ─────────────────────────
console.log('\n===== 0. 清档，并故意预置旧的死 key 看它是否还被读取 =====');
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.evaluate(() => {
  localStorage.clear();
  // 旧面板读的就是这个 key，但全仓没有任何代码写过它。
  // 故意塞进去：若面板还读它，就会显示 2 条已解锁 —— 那就是回归。
  localStorage.setItem(
    'unlockedAchievements',
    JSON.stringify(['achievement-01', 'achievement-08']),
  );
});
legacyJsonRequests.length = 0;
await page.reload({ waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

// ───────────────────────── A. 面板 = 运行时真源 ─────────────────────────
console.log('\n===== A. 面板读的是运行时真源（不再是那 15 个 JSON） =====');
checkTrue('主菜单可打开成就面板', await openAchievements());
await page.waitForTimeout(1200);

const cardCount = await panelCardCount();
check('面板条目数 = 运行时定义数（32）', cardCount, 32);
check('每条卡片都渲染了真实进度条', await panelProgressCount(), 32);
check('预置的死 key 被忽略（仍显示 0 条已解锁）', await panelUnlockedCount(), 0);
check('不再请求 /assets/achievements/*.json', legacyJsonRequests.length, 0);
const names = await panelNames();
checkTrue('卡片显示真实成就名（而不是 ??? 遮蔽）', names.includes('初出茅庐'));
checkTrue('未解锁条目也显示达成条件文案', names.includes('歼灭者'));
console.log(`  头部统计：${await panelHeaderText()}`);
await page.screenshot({ path: path.join(OUT_DIR, 'ach-01-panel-locked.png') });
await click([/返回/]);
await page.waitForTimeout(1500);

// ───────────────────────── B+C. 战斗事件 → 统计 → 解锁 → 奖励 ─────────────────────────
console.log('\n===== B. 战斗事件真的在喂统计（命中率/技能此前都没有供给方） =====');
const entered = await enterLevel();
checkTrue('进入第 1 关战斗', entered.ready);
if (!entered.ready) {
  console.log('❌ __achieveDebug 不可用，后续无法验证');
  await browser.close();
  process.exit(1);
}

const stats0 = await achStats();
check('开局击杀数为 0', stats0?.totalKills, 0);
check('开局命中率统计为 0（此前恒为 0 因为没有供给方）', stats0?.shotsFired, 0);
const creditsBefore = await page.evaluate(() => Number(localStorage.getItem('credits') ?? '0'));

// 按住 J 射击
await page.keyboard.down('KeyJ');
await page.waitForTimeout(1800);
await page.keyboard.up('KeyJ');
await page.waitForTimeout(600);
const acc1 = await achAcc();
checkGE('按下开火键后 WeaponSystem 记到了发射数', acc1?.shotsFired ?? 0, 1);

// 按 Q 放导弹技能（KeyQ = MISSILE_STRIKE）
await page.keyboard.press('KeyQ');
await page.waitForTimeout(900);
const statsAfterSkill = await achStats();
checkGE(
  '技能激活计数上报到成就系统（skillsUsed.missileStrike）',
  statsAfterSkill?.skillsUsed?.missileStrike ?? 0,
  1,
);

console.log('\n===== C. 击杀 → 解锁 → 经验/信用点/分数真入账 =====');
const snap0 = await achSnap();
check(
  '击杀数上报前，first_blood 未解锁',
  snap0?.entries?.find((e) => e.id === 'first_blood')?.progress?.isUnlocked,
  false,
);

// 清空场上敌人（走正常击杀结算路径）
for (let i = 0; i < 12; i++) {
  const s = await waveState();
  if (s?.aliveEnemies > 0) await page.evaluate(() => window.__waveDebug.killAll());
  const st = await achStats();
  if ((st?.totalKills ?? 0) >= 1) break;
  await page.waitForTimeout(600);
}

const one = await achOne('first_blood');
check('击杀后 first_blood 解锁', one?.isUnlocked, true);
checkGE('存储里 first_blood 记了 paid 凭证（奖励已结算）', one?.paid ? 1 : 0, 1);
const snap1 = await achSnap();
checkGE('已获得经验 > 0（成就奖励真入账）', snap1?.earnedExperience ?? 0, 20);
checkGE('已获得信用点 >= 100（first_blood 的 100）', snap1?.earnedCredits ?? 0, 100);
const creditsAfterAch = await page.evaluate(() => Number(localStorage.getItem('credits') ?? '0'));
checkGE('商店信用点余额同步增加', creditsAfterAch - creditsBefore, 100);
await page.screenshot({ path: path.join(OUT_DIR, 'ach-02-battle-unlocked.png') });

// ───────────────────────── D. 关卡结算按本关真实记录判定 ─────────────────────────
console.log('\n===== D. 关卡结算：无伤 / 最快用时按真实记录判定 =====');
const fin0 = await waveState();
const totalWaves = fin0?.totalWaves ?? -1;
checkTrue('读到本关总波数', totalWaves > 1);
const damageAtStart = await page
  .evaluate(() => window.__achieveDebug.getDamageTaken())
  .catch(() => -1);
console.log(`  清波开始前的本关受伤累计（应为 0，除非脚手架窗口里挨过撞）：${damageAtStart}`);
check('清波开始前本关未受伤', damageAtStart, 0);

// 顺着波次自然推进到末波 —— **不跳波**。
// 跳波（startWave(末波)）会与「上一波完成 → 波间过渡启动下一波」的状态机打架，
// 实测会让末波被重启、Boss 统计落空（已用 scripts/_probe-boss.mjs 对照确认）。
let completeFired = false;
for (let step = 0; step < 400; step++) {
  const s = await waveState();
  if (!s) break;
  if (s.levelCompleteFired) {
    completeFired = true;
    break;
  }
  if (s.upgradeVisible) {
    await closeUpgradeIfAny();
    continue;
  }
  if (s.aliveEnemies > 0) {
    await page.evaluate(() => window.__waveDebug.killAll());
    await page.waitForTimeout(420);
    continue;
  }
  await page.waitForTimeout(500);
}
check('关卡完成被触发', completeFired, true);
await page.waitForTimeout(2500);

// GameScene 已卸载（这是正常路径），所以读持久化的真源
const progAfterClear = await readProg();
const statsAfterClear = progAfterClear?.stats ?? {};
checkGE(
  '存储记录：无伤通关数 >= 1（godMode 下确实没受伤）',
  statsAfterClear.noDamageClears ?? 0,
  1,
);
checkGE(
  '存储记录：最快通关用时 > 0（未通关保持 0，不能当成 0 秒）',
  statsAfterClear.fastestClearSeconds ?? 0,
  1,
);
const unlockedAfterClear = Object.entries(progMap(progAfterClear))
  .filter(([, p]) => p?.isUnlocked)
  .map(([id]) => id);
console.log(`  结算后已解锁：${unlockedAfterClear.join(', ')}`);
checkTrue('「不死之身」按真实受伤记录解锁', unlockedAfterClear.includes('flawless'));
checkTrue('「速度狂魔」按真实用时解锁', unlockedAfterClear.includes('speedrun'));
checkTrue('结算界面为「胜利」', (await page.locator('text=胜利').count()) > 0);

// ───────────────────────── F. 面板与存储交叉校对 ─────────────────────────
console.log('\n===== F. 回到面板：DOM 显示的解锁数与存储一致 =====');
checkTrue('可从结算界面回主菜单', await backToMainMenu());
checkTrue('可再次打开成就面板', await openAchievements());
await page.waitForTimeout(1000);
const panelUnlocked = await panelUnlockedCount();
const storedUnlocked = storedUnlockedCount(await readProg());
check('面板已解锁数 == 存储已解锁数', panelUnlocked, storedUnlocked);
checkGE('面板已解锁数 > 0（不再永远全锁）', panelUnlocked, 1);
console.log(`  头部统计：${await panelHeaderText()}`);
await page.screenshot({ path: path.join(OUT_DIR, 'ach-03-panel-unlocked.png') });

// ───────────────────────── E. Boss 按具体类型统计（独立 context） ─────────────────────────
console.log('\n===== E. Boss 按具体类型统计（?level=5 深链，末波 = boss_sentinel） =====');
const bossPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const bossErrors = [];
bossPage.on('pageerror', (e) => bossErrors.push(String(e).slice(0, 160)));
await bossPage.addInitScript(() => {
  const progress = {};
  for (let i = 1; i < 5; i++) progress[i] = { cleared: true, stars: 3 };
  localStorage.setItem('levelProgress', JSON.stringify(progress));
});
await bossPage.goto(`${URL}?level=5`, { waitUntil: 'load', timeout: 120000 });
await bossPage.waitForTimeout(9000);
const bossClick = async (patterns) => {
  for (const p of patterns) {
    const btn = bossPage.locator('button', { hasText: p }).first();
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 8000 }).catch(() => {});
      return true;
    }
  }
  return false;
};
await bossClick([/开始游戏/, /Start Game/i]);
await page.waitForTimeout(2500);
await bossClick([/开始挑战/, /挑战/, /^开始$/]);
// 同 enterLevel：先开无敌再推进对话，免得脚手架窗口里挨撞
const bossReady = await bossPage
  .waitForFunction(
    () => typeof window.__waveDebug === 'object' && typeof window.__achieveDebug === 'object',
    { timeout: 60000 },
  )
  .then(() => true)
  .catch(() => false);
checkTrue('?level=5 深链进入战斗', bossReady);
if (bossReady) {
  await bossPage.evaluate(() => window.__waveDebug.godMode(true));
  for (let i = 0; i < 12; i++) {
    const dlg = bossPage.locator('text=点击继续').first();
    if ((await dlg.count()) === 0) break;
    await bossPage.mouse.click(640, 560);
    await bossPage.waitForTimeout(600);
  }
  await bossPage.waitForTimeout(1500);

  const bState = () =>
    bossPage.evaluate(() => window.__waveDebug?.getState?.() ?? null).catch(() => null);
  const bStats = () =>
    bossPage.evaluate(() => window.__achieveDebug?.getStats?.() ?? null).catch(() => null);

  const b0 = await bState();
  check('第 5 关总波数 = 3（末波为 boss 波）', b0?.totalWaves, 3);

  // 顺着波次自然推进到末波（不跳波，理由同 D 段）
  for (let step = 0; step < 400; step++) {
    const s = await bState();
    if (!s) break;
    if (s.levelCompleteFired) break;
    if (s.upgradeVisible) {
      const card = bossPage.locator('.upgrade-card').first();
      if ((await card.count()) > 0) await card.click({ timeout: 3000 }).catch(() => {});
      await bossPage.waitForTimeout(400);
      continue;
    }
    if (s.aliveEnemies > 0) {
      await bossPage.evaluate(() => window.__waveDebug.killAll());
      await bossPage.waitForTimeout(420);
      continue;
    }
    const st = await bStats();
    if ((st?.bossKillsByType?.boss_sentinel ?? 0) >= 1) break;
    await bossPage.waitForTimeout(500);
  }

  const bFinal = await bStats();
  console.log(
    `  enemiesKilledByType = ${JSON.stringify(bFinal?.enemiesKilledByType)} / bossKillsByType = ${JSON.stringify(bFinal?.bossKillsByType)}`,
  );
  checkGE('按运行时词表记到了 boss_sentinel 击杀', bFinal?.bossKillsByType?.boss_sentinel ?? 0, 1);
  check('boss 折叠键仍然计数（boss 累计语义未被破坏）', bFinal?.enemiesKilledByType?.boss ?? 0, 1);
  const bOne = await bossPage.evaluate(() => window.__achieveDebug.getOne('boss_sentinel'));
  check(
    '「哨兵终结者」解锁（配置侧 boss-sentinel ↔ 运行时 boss_sentinel 换算正确）',
    bOne?.isUnlocked,
    true,
  );
  const bSnap = await bossPage.evaluate(() => window.__achieveDebug.getSnapshot());
  checkGE('Boss 成就奖励也真入账', bSnap?.earnedCredits ?? 0, 3000);
  checkGE('最高分未被按「累加」语义膨胀（7810 量级而非几十万）', bFinal?.highestScore ?? 0, 1);
  checkTrue(
    '最高分处于合理区间（< 100000，否则分数成就被白送）',
    (bFinal?.highestScore ?? 0) < 100000,
  );
  await bossPage
    .screenshot({ path: path.join(OUT_DIR, 'ach-04-boss-unlocked.png') })
    .catch(() => {});
}

// ───────────────────────── 汇总 ─────────────────────────
console.log('\n================ 结果 ================');
console.log(`成就日志（前 12 条）：`);
achievementLogs.slice(0, 12).forEach((l) => console.log(`  ${l.slice(0, 170)}`));
console.log(`页面错误：${errors.length + bossErrors.length}`);
[...errors, ...bossErrors].slice(0, 8).forEach((e) => console.log('  ', e.slice(0, 200)));

const failed = results.filter((r) => !r.pass);
console.log(`通过 ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log('失败项：');
  failed.forEach((f) => console.log(`  ❌ ${f.label}（实得 ${JSON.stringify(f.actual)}）`));
}
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
