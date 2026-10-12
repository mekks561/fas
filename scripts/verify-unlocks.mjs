// 解锁链路验证：`rewards.unlocks` 是否**真的**解锁了东西。
//
// 接线前的事实（数据齐了、没有任何下游）：
//   10 个关卡逐条写着 `rewards.unlocks`，唯一读取方式是 GameScene 结算时的一句
//   `console.log`（把数组 join 出来打一遍）。三处「看起来能拦、其实都没拦」：
//     · SkillSystem 无条件注册 4 个技能 —— `skill-*` 无从生效
//     · PlayerShip 的 `config.shipModel` **全仓零调用方** —— 永远开初始机
//     · 商店卡片的「要求等级: N」只是渲染，handlePurchase 从不校验
//   外加 `level-10` 的 `achievement-master` 在成就表里根本不存在（悬空奖励）。
//
// 本脚本按「从零到有」的顺序走一遍，断言每一处都真的通了：
//
//   A. 全新存档：机库只有初始舰体可选、5 艘锁；商店舰船锁 + 等级门槛真判；
//      进关后 4 个技能槽全锁，**按 Q 无效**（不是"看起来锁着但键盘仍能放"）
//   B. **真打一局通关第 2 关**：断言"通关 → 落库 → 技能可用"这条链
//      （这是唯一不能用预置造假的一段：必须由 markLevelCleared 真的写进去）
//   C. 中间态（预置通关 1..5）：机库/技能/商店三处**同时**按同一份进度变化
//   D. 舰体真的换了模型（读 PlayerShip 的渲染侧真值，不是 UI 选中值）
//   E. 舰体回落：解锁没了之后不能再开着它（存档不可信）
//   F. 全程无「未知技能 id」告警、无未捕获异常
//
// 用法：先起 dev server（`npx vite --port 5177 --strictPort`），再
//   NO_PROXY=localhost,127.0.0.1 VERIFY_URL=http://localhost:5177/ \
//     node scripts/verify-unlocks.mjs
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
const warns = [];
const logs = [];
page.on('console', (m) => {
  const t = m.text();
  logs.push(t);
  if (m.type() === 'error') errors.push(t);
  if (m.type() === 'warning' && t.includes('[SkillSystem]')) warns.push(t);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

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

const skillsSnap = () =>
  page.evaluate(() => window.__skillDebug?.skills?.() ?? null).catch(() => null);
const hudSkills = () =>
  page.evaluate(() => window.__skillDebug?.hudSkills?.() ?? null).catch(() => null);
const unlocksSnap = () =>
  page.evaluate(() => window.__skillDebug?.unlocks?.() ?? null).catch(() => null);
const hullOfPlayer = () =>
  page.evaluate(() => window.__skillDebug?.hull?.() ?? null).catch(() => null);
const waveState = () =>
  page.evaluate(() => window.__waveDebug?.getState?.() ?? null).catch(() => null);

/** 机库所有卡片的可用/选中状态（读 DOM 的 data-*，与 UI 显示同一份事实）。 */
const hangarCards = async () => {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="hangar-hull-"]')).map((el) => ({
      hull: el.getAttribute('data-hull-id'),
      available: el.getAttribute('data-available') === 'true',
      selected: el.getAttribute('data-selected') === 'true',
      text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
    })),
  );
};

/** 商店某张卡片的门槛状态与文案。 */
const shopCard = async (id) => {
  const el = page.locator(`[data-testid="shop-card-${id}"]`).first();
  if ((await el.count()) === 0) return null;
  const req = el.locator(`[data-testid="shop-req-${id}"]`).first();
  return {
    locked: (await el.getAttribute('data-locked')) === 'true',
    requirement: (await req.count()) > 0 ? (await req.innerText()).trim() : '',
    text: (await el.innerText()).replace(/\s+/g, ' ').trim(),
    hasBuyButton: (await el.locator('button.shop-buy-btn').count()) > 0,
  };
};

const closeUpgradeIfAny = async () => {
  const card = page.locator('.upgrade-card').first();
  if ((await card.count()) > 0) {
    await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
  }
};

const dismissStoryDialogs = async () => {
  for (let i = 0; i < 12; i++) {
    const dlg = page.locator('text=点击继续').first();
    const end = page.locator('text=点击结束').first();
    if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
    await page.mouse.click(640, 560);
    await page.waitForTimeout(500);
  }
};

const backToMainMenu = async () => {
  await closeUpgradeIfAny();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  await click([/返回主菜单/, /主菜单/, /Main Menu/i]);
  await page.waitForTimeout(2200);
};

const openHangar = async () => {
  const ok = await click([/^机库$/, /机库/]);
  await page.waitForTimeout(1500);
  return ok;
};

const openShop = async () => {
  const ok = await click([/^商店$/, /商店/]);
  await page.waitForTimeout(2500);
  return ok;
};

/** 深链到第 n 关并开始战斗。 */
const enterLevel = async (n) => {
  await page.goto(`${URL}${URL.includes('?') ? '&' : '?'}level=${n}`, {
    waitUntil: 'load',
    timeout: 180000,
  });
  await page.waitForTimeout(6000);
  await click([/开始游戏/, /Start Game/i]);
  await page.waitForTimeout(2500);
  await click([/开始挑战/, /开始游戏/, /Start/i]);
  await page.waitForTimeout(9000);
  await dismissStoryDialogs();
  const ready = await page
    .waitForFunction(() => typeof window.__waveDebug === 'object', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (ready) await page.evaluate(() => window.__waveDebug.godMode(true));
  return ready;
};

/** 本轮只做清场推进，**不手动 startWave**（会和引擎波间过渡抢排同一波）。 */
const playToLevelComplete = async (maxSteps = 400) => {
  for (let step = 0; step < maxSteps; step++) {
    const s = await waveState();
    if (!s) return { completed: true, steps: step, unmounted: true };
    if (s.levelCompleteFired) return { completed: true, steps: step, unmounted: false };
    if (s.upgradeVisible) {
      await closeUpgradeIfAny();
      continue;
    }
    if (s.aliveEnemies > 0) {
      await page.evaluate(() => window.__waveDebug.killAll());
      await page.waitForTimeout(420);
      continue;
    }
    await page.waitForTimeout(600);
  }
  return { completed: false, steps: maxSteps, unmounted: false };
};

const EXPECTED_HULLS = ['fighter', 'bomber', 'cruiser', 'stealth', 'corvette', 'dreadnought'];
const EXPECTED_TYPES = ['missileStrike', 'shieldBurst', 'timeSlow', 'overdrive'];

// ═══════════════════ A. 全新存档：什么都不该解锁 ═══════════════════
console.log('\n===== A. 全新存档（清档） =====');
await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load', timeout: 180000 });
await page.waitForTimeout(9000);

console.log('\n--- A1. 机库：只有初始舰体 ---');
checkTrue('主菜单有「机库」入口且能打开', await openHangar());
let cards = await hangarCards();
check('机库卡片数量 = 舰体总数', cards.length, EXPECTED_HULLS.length);
check(
  '可选舰体只有 fighter',
  cards.filter((c) => c.available).map((c) => c.hull).join(','),
  'fighter',
);
checkTrue('fighter 卡片标为「当前舰体」', cards.find((c) => c.hull === 'fighter')?.selected === true);
const lockedCard = cards.find((c) => c.hull === 'cruiser');
checkTrue('cruiser 卡片处于锁定态（含「通关第 5 关解锁」）', /通关第 5 关解锁/.test(lockedCard?.text ?? ''));
check(
  '待解锁清单 = 9 条（10 条解锁 - 初始舰体已授予）',
  await page.locator('[data-testid="hangar-pending-item"]').count(),
  9,
);
await page.screenshot({ path: path.join(OUT_DIR, 'unlocks-01-hangar-fresh.png') }).catch(() => {});
await click([/返回/]);
await page.waitForTimeout(1500);

console.log('\n--- A2. 商店：舰船门槛 = 通关解锁，等级门槛真判 ---');
checkTrue('商店可打开', await openShop());
const cruiserCard = await shopCard('shop-item-01');
checkTrue('重型巡洋舰被锁定', cruiserCard?.locked === true);
checkTrue('锁定文案是「通关第 5 关解锁」', /通关第 5 关解锁/.test(cruiserCard?.requirement ?? ''));
checkTrue('锁定商品没有购买按钮', cruiserCard?.hasBuyButton === false);
const stealthCard = await shopCard('shop-item-02');
checkTrue('隐形战机锁定文案是「通关第 7 关解锁」', /通关第 7 关解锁/.test(stealthCard?.requirement ?? ''));
const dmgCard = await shopCard('shop-item-17');
checkTrue('伤害强化模块按等级锁定（1 级 < 5 级）', dmgCard?.locked === true);
checkTrue('等级门槛文案含当前等级', /需要等级 5（当前 1）/.test(dmgCard?.requirement ?? ''));
const paintCard = await shopCard('shop-item-13');
checkTrue('无门槛商品（红色涂装 level 1）可买', paintCard?.locked === false && paintCard?.hasBuyButton === true);
await page.screenshot({ path: path.join(OUT_DIR, 'unlocks-02-shop-gated.png') }).catch(() => {});
await click([/返回/]);
await page.waitForTimeout(1500);

console.log('\n--- A3. 进关：4 个技能槽全锁，按 Q 无效 ---');
checkTrue('可进入战斗', await enterLevel(1));
const snapA = await skillsSnap();
check('技能快照 4 槽', snapA?.length, 4);
checkTrue('4 个槽位**全部未注册**到 SkillSystem', (snapA ?? []).every((s) => s.registered === false));
checkTrue('4 个槽位标记为未解锁', (snapA ?? []).every((s) => s.unlocked === false));
for (let i = 0; i < 4; i++) {
  const el = page.locator(`[data-testid="skill-slot-${i}"]`).first();
  check(`槽位 ${i} 的 HUD 按钮标记为锁定`, await el.getAttribute('data-locked'), 'true');
  // 锁定槽位仍要标出技能名（否则玩家只看到 4 个锁，不知道将来是什么）。
  // 名字与真源逐字比对，不在脚本里抄中文名。
  const nameEl = page.locator(`[data-testid="skill-name-${i}"]`).first();
  const shown = (await nameEl.count()) > 0 ? (await nameEl.innerText()).trim() : '(标签缺失)';
  check(`槽位 ${i} 锁定状态下仍显示技能名（与真源一致）`, shown, snapA?.[i]?.name);
  const hintEl = page.locator(`[data-testid="skill-unlock-${i}"]`).first();
  const hint = (await hintEl.count()) > 0 ? (await hintEl.innerText()).trim() : '';
  checkTrue(`槽位 ${i} 标明了「通关第 N 关解锁」`, /^通关第 \d+ 关解锁$/.test(hint));
}
const unlocksA = await unlocksSnap();
check('全新存档已解锁舰体 = fighter', unlocksA?.hulls?.map((h) => h.id).join(','), 'fighter');
check('全新存档已解锁技能 = 无', unlocksA?.skills?.length, 0);
// 键盘路径：锁定的技能连冷却都不该走
await page.keyboard.press('KeyQ');
await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
const hudA = await hudSkills();
checkTrue(
  '按 Q/E 后 store 冷却**仍为 0**（锁定的技能真的放不出来）',
  (hudA?.cooldowns?.skill1 ?? -1) === 0 && (hudA?.cooldowns?.skill2 ?? -1) === 0,
);
const snapA2 = await skillsSnap();
checkTrue('按 Q/E 后技能仍未进入激活态', (snapA2 ?? []).every((s) => s.isActive === false));

// ═══════════════════ B. 真打一局：通关第 2 关 → 导弹打击解锁 ═══════════════════
console.log('\n===== B. 真打一局：通关第 2 关 → 导弹打击应解锁 =====');
// 预置「第 1 关已通关」，让第 2 关可进；**不预置第 2 关**（要的就是它从无到有）
await applyProgressSeed(page, 1);
console.log('  （已预置：仅第 1 关通关）');
checkTrue('进入第 2 关', await enterLevel(2));
const snapB0 = await skillsSnap();
checkTrue('进第 2 关时导弹打击仍是锁的（证明下面那条是「打出来的」）', snapB0?.[0]?.unlocked === false);
const played = await playToLevelComplete();
console.log(`  清场结束：completed=${played.completed} steps=${played.steps} unmounted=${played.unmounted}`);
checkTrue('第 2 关已通关', played.completed);

// 通关写库这件事必须能在存档里验到
const progressAfter = await page.evaluate(() => {
  const raw = localStorage.getItem('levelProgress');
  return raw ? JSON.parse(raw) : null;
});
checkTrue('levelProgress["2"].cleared === true（通关真的落库了）', progressAfter?.['2']?.cleared === true);
checkTrue(
  '控制台打出了本关解锁内容（非「无」）',
  logs.some((l) => l.includes('解锁内容（落库后可立即使用）') && l.includes('skill-missile-strike')),
);
await page.screenshot({ path: path.join(OUT_DIR, 'unlocks-03-level2-clear.png') }).catch(() => {});

// 回到关卡里读**真实**的解锁结果（结算界面已卸载 GameScene，钩子不在）
await backToMainMenu();
checkTrue('重进第 2 关（新的 SkillSystem，应带上刚解锁的技能）', await enterLevel(2));
const snapB1 = await skillsSnap();
checkTrue('通关第 2 关后，导弹打击已解锁', snapB1?.[0]?.unlocked === true);
checkTrue('通关第 2 关后，导弹打击已注册到 SkillSystem', snapB1?.[0]?.registered === true);
checkTrue('其余 3 个技能仍锁着', snapB1?.slice(1).every((s) => s.unlocked === false));
await page.keyboard.press('KeyQ');
await page.waitForTimeout(900);
const hudB = await hudSkills();
checkTrue('按 Q 后导弹打击真的进入冷却（解锁 ≠ 只是标记）', (hudB?.cooldowns?.skill1 ?? 0) > 0);
const unlocksB = await unlocksSnap();
check('解锁技能列表 = 导弹打击', unlocksB?.skills?.map((s) => s.type).join(','), 'missileStrike');

// ═══════════════════ C. 中间态：三处按同一份进度同时变化 ═══════════════════
console.log('\n===== C. 预置通关 1..5：机库 / 技能 / 商店 三处应同时变化 =====');
await backToMainMenu();
await applyProgressSeed(page, 5);
await page.reload({ waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

console.log('\n--- C1. 机库：1/3/5 关的舰体应解锁 ---');
checkTrue('机库可打开', await openHangar());
cards = await hangarCards();
check(
  '已解锁舰体 = fighter / bomber / cruiser',
  cards.filter((c) => c.available).map((c) => c.hull).join(','),
  'fighter,bomber,cruiser',
);
checkTrue('corvette 仍锁（第 9 关）', cards.find((c) => c.hull === 'corvette')?.available === false);
checkTrue('dreadnought 仍锁（第 10 关）', cards.find((c) => c.hull === 'dreadnought')?.available === false);
const pendingCount = await page.locator('[data-testid="hangar-pending-item"]').count();
// 通关 1..5 → 已授予 fighter/bomber/cruiser + 导弹/护盾 = 5 条；10 - 5 = 5 条待解锁
check('待解锁清单 = 5 条（10 条解锁 - 已授予 5 条）', pendingCount, 5);

console.log('\n--- C2. 机库选中 cruiser ---');
await page.locator('[data-testid="hangar-select-cruiser"]').first().click({ timeout: 8000 });
await page.waitForTimeout(900);
cards = await hangarCards();
checkTrue('cruiser 变为当前舰体', cards.find((c) => c.hull === 'cruiser')?.selected === true);
await page.screenshot({ path: path.join(OUT_DIR, 'unlocks-04-hangar-partial.png') }).catch(() => {});
await click([/返回/]);
await page.waitForTimeout(1200);

console.log('\n--- C3. 商店：重型巡洋舰解锁，隐形战机仍锁 ---');
checkTrue('商店可打开', await openShop());
const cruiserC = await shopCard('shop-item-01');
checkTrue('重型巡洋舰已解锁（可买）', cruiserC?.locked === false && cruiserC?.hasBuyButton === true);
const stealthC = await shopCard('shop-item-02');
checkTrue('隐形战机仍锁（第 7 关）', stealthC?.locked === true);
await page.screenshot({ path: path.join(OUT_DIR, 'unlocks-05-shop-partial.png') }).catch(() => {});
await click([/返回/]);
await page.waitForTimeout(1500);

console.log('\n--- C4. 进第 5 关：技能 2/4 解锁，且舰体真的换成了 cruiser ---');
checkTrue('进入第 5 关', await enterLevel(5));
const snapC = await skillsSnap();
check(
  '已解锁技能 = 导弹打击 / 护盾爆发（第 2、4 关）',
  (snapC ?? []).filter((s) => s.unlocked).map((s) => s.type).join(','),
  'missileStrike,shieldBurst',
);
checkTrue('时间减缓仍锁（第 6 关）', snapC?.[2]?.unlocked === false);
await page.waitForTimeout(2000);
check('PlayerShip 实际使用的舰体 = cruiser（渲染侧真值）', await hullOfPlayer(), 'cruiser');
await page.screenshot({ path: path.join(OUT_DIR, 'unlocks-06-cruiser-ingame.png') }).catch(() => {});

// ═══════════════════ D. 落到游戏里：预置的对应资源真的存在 ═══════════════════
console.log('\n===== D. 每个舰体都有对应的 GLB（词表对齐不够，资源也要在） =====');
const modelStatus = await page.evaluate(async (hulls) => {
  const out = {};
  for (const h of hulls) {
    try {
      const r = await fetch(`/assets/models/ships/ship-${h}.glb`, { method: 'HEAD' });
      out[h] = r.status;
    } catch {
      out[h] = -1;
    }
  }
  return out;
}, EXPECTED_HULLS);
for (const h of EXPECTED_HULLS) {
  check(`ship-${h}.glb 可访问`, modelStatus[h], 200);
}

// ═══════════════════ E. 舰体回落：解锁没了就不能再开 ═══════════════════
console.log('\n===== E. 舰体回落（存档不可信：进度被清后不能再开 cruiser） =====');
await page.evaluate(() => localStorage.removeItem('levelProgress'));
await page.reload({ waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
checkTrue('机库可打开（进度已清空）', await openHangar());
cards = await hangarCards();
checkTrue('进度清空后只有 fighter 可用', cards.filter((c) => c.available).map((c) => c.hull).join(',') === 'fighter');
checkTrue(
  '当前舰体回落到 fighter（存档里存的 cruiser 已不可用）',
  cards.find((c) => c.hull === 'fighter')?.selected === true,
);
const storedHull = await page.evaluate(() => localStorage.getItem('selectedHull'));
console.log(`  存档里的 selectedHull = ${storedHull}（读取侧回落，不改写存档）`);
await click([/返回/]);
await page.waitForTimeout(1200);

// ═══════════════════ F. 控制台 ═══════════════════
console.log('\n===== F. 控制台 =====');
check('未出现「未知技能 id」告警（锁定 ≠ 词表错位）', warns.length, 0);
if (warns.length) console.log(warns.slice(0, 3).map((w) => `    ${w}`).join('\n'));
const ENGINE_NOISE = [
  'ASSERT FAILED',
  'wasm-instantiate',
  'still waiting on run dependencies',
  'dependency:',
  '(end of list)',
  '__aiProbe',
];
const engineRelated = (e) => ENGINE_NOISE.some((n) => e.includes(n));
const otherErrors = errors.filter(
  (e) => !engineRelated(e) && !e.includes('Failed to load resource') && !e.includes('favicon'),
);
console.log(
  `  控制台错误共 ${errors.length} 条：引擎噪声 ${errors.filter(engineRelated).length}，其它 ${otherErrors.length}`,
);
check('无其它未分类控制台错误', otherErrors.length, 0);
if (otherErrors.length) console.log(otherErrors.slice(0, 5).map((e) => `    ${e}`).join('\n'));

// ═══════════════════ 汇总 ═══════════════════
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
