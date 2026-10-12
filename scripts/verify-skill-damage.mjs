// 技能**伤害**验证：断言「导弹打击真的打到了人」，而不只是「技能放出来了」。
//
// 背景（这轮发现的第三个同类盲区）。接线前 `SkillSystem.ts` 全文 634 行里
// `damage` 这个词出现 **0 次**；敌人受伤的唯一入口 `Enemy.takeDamage()` 全仓
// 只有 `WeaponSystem.ts:511`（子弹）一个调用方。也就是说：
//   - 导弹打击：7 枚锥体飞出 + 爆炸粒子，**零伤害**（HUD 却写着"攻击前方敌人"）
//   - 时间减缓：`getTimeScale()` 全仓零调用方
//   - 过载驱动：`getSpeedMultiplier()` / `getFireRateMultiplier()` 全仓零调用方
// 而 `verify-skill-activation.mjs` 的 68 条断言**全在状态层**
// （冷却写入 / store 同步 / HUD 文案 / 技能名），一条都没碰效果 ——
// 于是「4 个技能里 3 个对战斗毫无影响」能一路绿灯。
//
// 本脚本补的就是**效果层**：
//   0. 清档 + 预置「已通关第 1~2 关」（第 2 关的奖励 = 导弹打击）
//   1. 进入第 1 关战斗
//   2. 技能真值：单发伤害 7.5 / 爆炸半径 12（从 SkillSystem 读，不在这里抄数字）
//   3. 几何：把敌人搬到导弹落点 → 爆炸真的命中（hits > 0）
//   4. 伤害：发放伤害 = 命中数 × 7.5，且敌人的**血量真的下降**
//   5. 一轮：7 枚导弹全部爆炸，且持续期内**不再补发幽灵第二轮**
//   6. 全程无控制台错误
//
// 用法：先起 dev server（`npx vite --port 5177 --strictPort`），再
//   NO_PROXY=localhost,127.0.0.1 VERIFY_URL=http://localhost:5177/ \
//     node scripts/verify-skill-damage.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { applyProgressSeed } from './lib/unlock-seed.mjs';

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
const pageErrorStacks = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => {
  errors.push(`[pageerror] ${e.message}`);
  const stack = (e.stack || '').split('\n').slice(0, 4).join('\n');
  if (!pageErrorStacks.some((s) => s.split('\n')[0] === stack.split('\n')[0])) {
    pageErrorStacks.push(stack);
  }
});

const results = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  results.push({ label, actual, expected, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}: 实得=${actual} 期望=${expected}`);
};
const checkTrue = (label, actual) => check(label, actual === true, true);

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

/**
 * 等主菜单真正可交互。
 *
 * 不能用固定 sleep：**首次访问 Vite 要预打包整个模块图**（实测首页都要 1 分钟以上），
 * 此时 `page.goto` 早就 load 完了，但 React 还没 mount、菜单按钮还不存在 ——
 * 于是 `click()` 静默地什么也没点到，整段脚本从第 1 步就开始失败。
 */
const waitForMenu = async (timeout = 150000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const n = await page.locator('button', { hasText: /开始游戏|Start Game/i }).count();
    if (n > 0) return true;
    await page.waitForTimeout(500);
  }
  return false;
};

/** 当前可见按钮文本（失败时用来定位卡在哪一步）。 */
const visibleButtons = () =>
  page
    .evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter((b) => b.offsetParent !== null)
        .map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 20)),
    )
    .catch(() => []);

const closeUpgradeIfAny = async () => {
  const card = page.locator('.upgrade-card').first();
  if ((await card.count()) > 0) {
    await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
};

/** 主菜单 → 关卡选择 → 第 1 关战斗。 */
const enterLevelOne = async () => {
  if (!(await waitForMenu())) {
    console.log(`  ⚠ 主菜单未出现，当前按钮：${(await visibleButtons()).join(' | ')}`);
    return false;
  }
  await click([/开始游戏/, /Start Game/i]);
  await page.waitForTimeout(2500);
  await click([/开始挑战/, /Start/i]);
  await page.waitForTimeout(9000);
  for (let i = 0; i < 12; i++) {
    const dlg = page.locator('text=点击继续').first();
    const end = page.locator('text=点击结束').first();
    if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
    await page.mouse.click(640, 560);
    await page.waitForTimeout(600);
  }
  const ready = await page
    .waitForFunction(() => typeof window.__waveDebug === 'object', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) console.log(`  ⚠ 未进关，当前按钮：${(await visibleButtons()).join(' | ')}`);
  if (ready) await page.evaluate(() => window.__waveDebug.godMode(true));
  return ready;
};

/** 导弹技能的效果层真值快照。 */
const missileStats = () =>
  page.evaluate(() => window.__skillDebug?.missile?.() ?? null).catch(() => null);

/** 槽位真值（用来确认技能真的进了冷却 = 真的放出来了）。 */
const slotZero = () =>
  page.evaluate(() => window.__skillDebug?.skills?.()?.[0] ?? null).catch(() => null);

/**
 * 导弹落点采样位置（玩家前方 N 个世界单位）。
 *
 * 为什么是一串而不是一个点：`MissileStrikeSkill.createMissile` 的落点写在玩家前方 50，
 * 但导弹以 30 单位/秒只飞 1.5 秒（≈45 单位），实际爆点在前方 45 上下浮动；
 * 而且 `dt` 单帧钳到 0.1s，极端掉帧时会略微少飞。把 3 个敌人铺成 38 / 44 / 50，
 * 无论爆点落在区间哪一处都有敌人在 12 的爆炸半径里 —— 比赌一个精确值稳得多。
 */
const LANDING_OFFSETS = [38, 44, 50];

/**
 * 一次操作里同时完成三件事：把敌人按到飞行路径上 + 读技能效果统计 + 读路径血量。
 *
 * 合并成**一次** `page.evaluate` 是为了采样密度：无头环境下每次 evaluate 要
 * 100~600ms，拆成三次调用时 1.9s 的窗口里只剩 2~3 个采样点，而
 * 「1.7s 后场上是否还有导弹在飞」是时序断言 —— 采不到点它就只能报"未采样"（实测踩过）。
 */
const placeAndProbe = () =>
  page
    .evaluate((offsets) => {
      const pose = window.__waveDebug?.getPlayerPose?.();
      const stats = window.__skillDebug?.missile?.() ?? null;
      if (!pose) return { stats, path: { count: 0, total: 0, detail: [] } };

      const [px, py, pz] = pose.pos;
      offsets.forEach((dz, i) => window.__waveDebug.placeEnemy(i, px, py, pz - dz));

      const list = window.__waveDebug?.inspectEnemies?.() ?? [];
      const picked = [];
      for (const dz of offsets) {
        let best = null;
        let bestD = Infinity;
        const lz = pz - dz;
        for (const e of list) {
          const d = Math.hypot(e.pos[0] - px, e.pos[1] - py, e.pos[2] - lz);
          if (d < bestD) {
            bestD = d;
            best = e;
          }
        }
        // `inspectEnemies` 的坐标取整，容差给 10
        if (best && bestD <= 10) {
          picked.push({ health: best.health, d: Math.round(bestD * 10) / 10 });
        }
      }
      return {
        stats,
        path: {
          count: picked.length,
          total: picked.reduce((s, e) => s + e.health, 0),
          detail: picked,
        },
      };
    }, LANDING_OFFSETS)
    .catch(() => ({ stats: null, path: { count: 0, total: 0, detail: [] } }));

/** 场上全部敌人的原始快照（诊断用）。 */
const allEnemies = () =>
  page.evaluate(() => window.__waveDebug?.inspectEnemies?.() ?? []).catch(() => []);

/** 已发射的子弹命中数（用来把「敌人掉血」归因到导弹还是子弹）。 */
const shotsHit = () =>
  page
    .evaluate(() => window.__achieveDebug?.getAccuracy?.()?.shotsHit ?? -1)
    .catch(() => -1);

// ───────────────────────── 0. 清档 ─────────────────────────
console.log('\n===== 0. 清档 + 预置已通关第 1~2 关 =====');
// 首次访问要等 Vite 预打包整个模块图，60s 不够（实测超时）。给到 180s。
await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
await page.evaluate(() => localStorage.clear());
/**
 * 技能现在按通关进度解锁（`rewards.unlocks` 接了真链，见 UnlockRegistry）：
 * 全新存档里 4 个技能全锁。第 2 关的奖励就是「导弹打击」，所以预置通关 1~2 关。
 * 本脚本验证的是伤害，不是解锁时机 —— 后者归 `verify-unlocks.mjs`。
 */
await applyProgressSeed(page, 2);
// 用深链进第 1 关：少一步「关卡选择」的 UI 交互，少一个会失败的地方。
await page.goto(`${URL}${URL.includes('?') ? '&' : '?'}level=1`, {
  waitUntil: 'load',
  timeout: 180000,
});
await page.waitForTimeout(6000);

// ───────────────────────── 1. 进入战斗 ─────────────────────────
console.log('\n===== 1. 主菜单 → 关卡选择 → 战斗 =====');
const ready = await enterLevelOne();
checkTrue('可进入战斗且 __waveDebug 可用', ready);
if (!ready) {
  await browser.close();
  process.exit(1);
}

const snap = await slotZero();
check('槽位 0 = 导弹打击', snap?.type, 'missileStrike');
checkTrue('导弹打击已注册（预置通关第 2 关后）', snap?.registered === true);

// ───────────────────────── 2. 伤害真值 ─────────────────────────
console.log('\n===== 2. 技能真值（从 SkillSystem 读，不在这里抄数字） =====');
let stats = await missileStats();
checkTrue('__skillDebug.missile() 可用（效果层观测口已暴露）', stats !== null);
check('单发爆炸伤害', stats?.explosionDamage, 7.5);
check('爆炸半径', stats?.explosionRadius, 12);
check('初始爆炸次数为 0（还没放过）', stats?.explosions, 0);
check('初始命中数为 0', stats?.hits, 0);

// ───────────────────────── 3. 等敌人出现 ─────────────────────────
console.log('\n===== 3. 等第 1 波敌人刷出 =====');
let enemyCount = 0;
for (let i = 0; i < 90; i++) {
  enemyCount = await page.evaluate(() => window.__waveDebug.inspectEnemies().length);
  if (enemyCount >= 3) break;
  await page.waitForTimeout(1000);
}
checkTrue(`场上至少有 3 个敌人（实得 ${enemyCount} 个，要铺满飞行路径）`, enemyCount >= 3);
if (enemyCount < 3) {
  await browser.close();
  process.exit(1);
}

// ───────────────────────── 4. 释放导弹并结算伤害 ─────────────────────────
console.log('\n===== 4. 释放导弹打击，验证真伤害 =====');
// 先把敌人摆到飞行路径上，并多摆几次让位置稳定（敌机 AI 每帧都在朝玩家飞）
for (let i = 0; i < 6; i++) {
  await placeAndProbe();
  await page.waitForTimeout(60);
}
const beforeProbe = await placeAndProbe();
const beforePath = beforeProbe.path;
const beforeAll = await allEnemies();
checkTrue(
  `飞行路径上已就位 ${beforePath.count} 个敌人（血量合计 ${beforePath.total}，采样 ${JSON.stringify(beforePath.detail)}）`,
  beforePath.count >= 3,
);
const hitsBefore = await shotsHit();

await closeUpgradeIfAny();
await page.keyboard.press('q');
await page.waitForTimeout(200);
const afterActivate = await slotZero();
checkTrue('导弹打击真的开出来了（冷却已被写入）', (afterActivate?.cooldownRemaining ?? 0) > 0);

// 持续把敌人按在飞行路径上，直到导弹全部爆炸（1.5s）后再多跟一会儿
const midFlightSamples = [];
let lastPath = beforePath;
const start = Date.now();
while (Date.now() - start < 1900) {
  const { stats: s, path } = await placeAndProbe();
  lastPath = path;
  // 记录 1.6s 之后的"在飞导弹数"：旧实现在此时会冒出一整轮幽灵导弹（7 枚）
  if (Date.now() - start >= 1600) midFlightSamples.push(s?.missilesInFlight ?? -1);
  await page.waitForTimeout(30);
}

await page.waitForTimeout(250);
stats = await missileStats();
const afterPath = lastPath;
const hitsAfter = await shotsHit();

console.log(
  `  效果层读数：爆炸 ${stats?.explosions} 次 / 命中 ${stats?.hits} 次 / 发放伤害 ${stats?.damage}`,
);
console.log(
  `  飞行路径敌人血量合计：${beforePath.total} → ${afterPath.total}` +
    `（个数 ${beforePath.count} → ${afterPath.count}）　子弹命中数：${hitsBefore} → ${hitsAfter}`,
);
console.log(`  [diag] before 全部敌人：${JSON.stringify(beforeAll)}`);
console.log(`  [diag] after  全部敌人：${JSON.stringify(await allEnemies())}`);

check('7 枚导弹全部爆炸（level 1 = 5 + 1×2）', stats?.explosions, 7);
checkTrue('爆炸真的命中了敌人（hits > 0）', (stats?.hits ?? 0) > 0);
check('发放伤害 === 命中数 × 7.5', stats?.damage, (stats?.hits ?? 0) * 7.5);

// 掉血断言。脚本全程不给任何输入 → 玩家不开火 → 用「窗口内子弹命中数没变」
// 就能把归因锁死在技能身上：血量下降只可能来自导弹。
const attribution =
  hitsAfter === hitsBefore
    ? `窗口内子弹命中数未变 ${hitsBefore}`
    : `子弹也在命中(${hitsBefore}→${hitsAfter})，掉血至少包含导弹那一份`;
checkTrue(
  `敌人的血量真的下降了（合计 ${beforePath.total} → ${afterPath.total}，${attribution}）`,
  afterPath.total < beforePath.total || afterPath.count < beforePath.count,
);

// ───────────────────────── 5. 一次施放只发一轮 ─────────────────────────
// 旧实现：导弹 1.5s 全爆后数组清空，而持续期还有 0.5s → 下一帧补发 7 枚幽灵导弹，
// 它们飞 0.5s 后随 endSkill() 被销毁，既不爆炸也不造成伤害。判据就是
// 「1.7s 之后场上仍有导弹在飞」—— 新实现恒为 0。
console.log('\n===== 5. 持续期内不得补发幽灵第二轮 =====');
const maxInFlight = midFlightSamples.length ? Math.max(...midFlightSamples) : -1;
check(`1.6s 后仍在飞的导弹数（采样 ${midFlightSamples.length} 次）`, maxInFlight, 0);

await page.screenshot({ path: path.join(OUT_DIR, 'skill-damage-01-explosion.png') }).catch(() => {});

// ───────────────────────── 6. 控制台 ─────────────────────────
console.log('\n===== 6. 控制台 =====');
const ENGINE_NOISE = [
  'ASSERT FAILED',
  'wasm-instantiate',
  'still waiting on run dependencies',
  'dependency:',
  '(end of list)',
  '__aiProbe',
];
const engineRelated = (e) => ENGINE_NOISE.some((n) => e.includes(n));
const skillRelated = errors.filter((e) => /skill/i.test(e));
const otherErrors = errors.filter(
  (e) => !engineRelated(e) && !e.includes('Failed to load resource') && !e.includes('favicon'),
);
console.log(
  `  控制台错误共 ${errors.length} 条：引擎噪声 ${errors.filter(engineRelated).length}，` +
    `技能相关 ${skillRelated.length}，其它 ${otherErrors.length}`,
);
check('无技能相关控制台错误', skillRelated.length, 0);
check('无其它未分类控制台错误', otherErrors.length, 0);
if (otherErrors.length) console.log(otherErrors.slice(0, 5).map((e) => `    ${e}`).join('\n'));
if (pageErrorStacks.length) {
  console.log('  未捕获异常的堆栈（去重）：');
  for (const s of pageErrorStacks) console.log(s.split('\n').map((l) => `    ${l}`).join('\n'));
}

// ───────────────────────── 汇总 ─────────────────────────
const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
console.log(`\n===== 汇总：${passed}/${results.length} 通过${failed ? `，${failed} 失败` : ''} =====`);
if (failed) {
  console.log('失败项：');
  for (const r of results.filter((x) => !x.pass)) {
    console.log(`  ❌ ${r.label}: 实得=${r.actual} 期望=${r.expected}`);
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
