// 元进度闭环验证：**在商店里花钱买的东西，下一局真的生效**。
//
// 背景：这条链此前是断的 ——
//   · `ShopPanel` 扣完信用点只写 `localStorage.purchasedItems`，而该字段的**唯一
//     读取方就是 ShopPanel 自己**（只够把按钮变成「已购买 ✓」）；
//   · `shop-item-*.json` 里的 `attributes`（生命/护盾/速度/火力）无人消费；
//   · 全仓搜 `selectShip` / `currentShip` = 0 处 ——「换船」在代码里不存在。
//   结果：打通全战役攒到的信用点，买下最便宜那艘 15000 的船，下一局什么也不发生。
//
// 本脚本验证修复后的整条链，**每一段都读生产路径上的真实对象**：
//   商店购买 → OwnedItems 落库（属性快照）→ GameScene 开局折算 → 合并进
//   PlayerShip / WeaponSystem 的内部状态（`__skillDebug.getEffective()`）
//
// 断言链：
//   A. 清档 → 商店「已购 0 件 / 暂无永久加成」
//   B. 买「伤害强化模块」（10000，初始信用点刚好够）→ 加成条显示「伤害 +10%」
//      → 进第 1 关：WeaponSystem.damageMultiplier = 1.1（生命/护盾不受影响）
//   C. 模拟攒钱（直接写 credits）→ 买「重型巡洋舰」+「红色涂装」
//      → 进第 1 关：生命 300（100+200）、护盾 150（50+100）、伤害 1.43（1.1×1.3）、
//        速度倍率 1.5、舰体主色 = 红
//   D. 旧 key 迁移：预置 `purchasedItems` → 重载后商店仍显示「已购买」，且旧 key 被清掉
//
// 用法：先起 dev server（`npx vite --port 5177 --strictPort`），再
//   NO_PROXY=localhost,127.0.0.1 VERIFY_URL=http://localhost:5177/ node scripts/verify-meta-progression.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VERIFY_URL || 'http://localhost:5177/';
const EXE =
  process.env.CHROME_PATH ||
  path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe');

const OUT_DIR = path.join(process.cwd(), 'docs', 'verify');
fs.mkdirSync(OUT_DIR, { recursive: true });

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
const metaLogs = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') errors.push(t);
  if (t.includes('[GameScene] 元进度')) metaLogs.push(t);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const results = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  results.push({ label, actual, expected, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}: 实得=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`);
};
const checkNear = (label, actual, expected, tol = 0.001) => {
  const pass = typeof actual === 'number' && Math.abs(actual - expected) <= tol;
  results.push({ label, actual, expected, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}: 实得=${actual} 期望≈${expected}`);
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

const closeUpgradeIfAny = async () => {
  const card = page.locator('.upgrade-card').first();
  if ((await card.count()) > 0) {
    await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
};

/**
 * 回到主菜单。要同时覆盖两种场面：
 * - 战斗中：Escape 打开暂停菜单 → 「返回主菜单」
 * - 面板中（商店等）：面板自己的返回键文案是「← 返回」
 * 所以最后一个兜底 pattern 是 `/返回/`。
 */
const backToMainMenu = async () => {
  await closeUpgradeIfAny();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  for (let i = 0; i < 3; i++) {
    const onMenu = await page
      .locator('button', { hasText: /开始游戏|Start Game/i })
      .first()
      .count()
      .catch(() => 0);
    if (onMenu > 0) return true;
    const stepped = await click([/返回主菜单/, /主菜单/, /Main Menu/i, /返回/]);
    if (!stepped) break;
    await page.waitForTimeout(2000);
  }
  return (
    (await page
      .locator('button', { hasText: /开始游戏|Start Game/i })
      .first()
      .count()
      .catch(() => 0)) > 0
  );
};

const openShop = async () => {
  const opened = await click([/商店/]);
  // 商店是懒加载分包 + 逐个 fetch 20 个 json，等卡片出现
  const ready = await page
    .waitForSelector('.shop-card', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  return opened && ready;
};

/** 在商店里买下指定名称的商品（点它卡片上的购买按钮）。 */
const buyItem = async (name) => {
  const card = page.locator('.shop-card', { hasText: name }).first();
  if ((await card.count()) === 0) return false;
  const btn = card.locator('button.shop-buy-btn').first();
  if ((await btn.count()) === 0) return false;
  await btn.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  return true;
};

const shopBonusText = () =>
  page.locator('[data-testid="shop-bonus-strip"]').innerText().catch(() => '');

const enterLevelOne = async () => {
  const started = await click([/开始游戏/, /Start Game/i]);
  // 等选关页出现
  const atSelect = await page
    .locator('button', { hasText: /开始挑战|挑战/ })
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  const entered = atSelect && (await click([/开始挑战/, /开始游戏/, /Start/i]));
  console.log(`  [enterLevelOne] 点开始游戏=${started} 到选关页=${atSelect} 进入战斗=${entered}`);
  await page.waitForTimeout(9000);
  for (let i = 0; i < 12; i++) {
    const dlg = page.locator('text=点击继续').first();
    const end = page.locator('text=点击结束').first();
    if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
    await page.mouse.click(640, 560);
    await page.waitForTimeout(600);
  }
  const ready = await page
    .waitForFunction(
      () => typeof window.__waveDebug === 'object' && typeof window.__metaDebug === 'object',
      { timeout: 30000 },
    )
    .then(() => true)
    .catch(() => false);
  if (ready) await page.evaluate(() => window.__waveDebug.godMode(true));
  // 等两帧，让每帧的属性同步跑一遍
  await page.waitForTimeout(2000);
  return { entered, ready };
};

const effective = () =>
  page.evaluate(() => window.__skillDebug?.getEffective?.() ?? null).catch(() => null);
const metaBonuses = () =>
  page.evaluate(() => window.__metaDebug?.bonuses?.() ?? null).catch(() => null);
const ownedItems = () =>
  page.evaluate(() => window.__metaDebug?.owned?.() ?? null).catch(() => null);

// ───────────────────────── 0. 清档 ─────────────────────────
console.log('\n===== 0. 清档（信用点/已购物品都会持久化） =====');
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

// ───────────────────────── A. 空商店 ─────────────────────────
console.log('\n===== A. 空手进商店：应无任何加成 =====');
check('主菜单可打开商店', await openShop(), true);
const stripA = await shopBonusText();
console.log(`  加成条：${stripA.replace(/\s+/g, ' ').trim()}`);
check('商店显示「已购 0 件」', stripA.includes('已购 0 件'), true);
check('空手时不显示任何加成项', stripA.includes('暂无永久加成'), true);
await page.screenshot({ path: path.join(OUT_DIR, 'meta-01-shop-empty.png') });

// 消耗品不应可买（没有背包系统 → 不给假按钮）
const consumableText = await page
  .locator('.shop-card', { hasText: '生命包' })
  .first()
  .innerText()
  .catch(() => '');
check('消耗品标为「即将开放」且不给购买按钮', consumableText.includes('即将开放'), true);

// ───────────────────────── B. 买一件升级模块 ─────────────────────────
console.log('\n===== B. 买「伤害强化模块」（10000）→ 下一局伤害应 ×1.1 =====');
check('购买成功', await buyItem('伤害强化模块'), true);
const stripB = await shopBonusText();
console.log(`  加成条：${stripB.replace(/\s+/g, ' ').trim()}`);
check('加成条显示已购 1 件', stripB.includes('已购 1 件'), true);
check('加成条显示「伤害 +10%」', stripB.includes('伤害 +10%'), true);

const storedB = await page.evaluate(() => localStorage.getItem('ownedItems'));
const storedListB = storedB ? JSON.parse(storedB) : [];
check('落库到 ownedItems（而不是旧的 purchasedItems）', storedListB.length, 1);
check('落库记录带属性快照', !!storedListB[0]?.attributes?.damageBonus, true);
check('旧 key 未被写入', await page.evaluate(() => localStorage.getItem('purchasedItems')), null);

await page.screenshot({ path: path.join(OUT_DIR, 'meta-02-shop-bought.png') });

await backToMainMenu();
const runB = await enterLevelOne();
check('可进入第 1 关', runB.entered && runB.ready, true);
const effB = await effective();
const metaB = await metaBonuses();
console.log(`  局内：伤害倍率=${effB?.damageMultiplier} 生命=${effB?.maxHealth} 护盾=${effB?.maxShield}`);
checkNear('开局 ref 里的元加成 damageMultiplier = 1.1', metaB?.damageMultiplier, 1.1, 1e-6);
checkNear('WeaponSystem 实际伤害倍率 = 1.1', effB?.damageMultiplier, 1.1, 0.005);
checkNear('生命上限不受影响 = 100', effB?.maxHealth, 100, 0.01);
checkNear('护盾上限不受影响 = 50', effB?.maxShield, 50, 0.01);

// ───────────────────────── C. 买船 + 涂装 ─────────────────────────
console.log('\n===== C. 买「重型巡洋舰」+「红色涂装」→ 下一局舰体/伤害/速度全变 =====');
await backToMainMenu();
// 模拟「已经打了几关攒够钱」：信用点是独立真源，直接写
await page.evaluate(() => localStorage.setItem('credits', '100000'));
await page.reload({ waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);
check('商店可再次打开', await openShop(), true);
check('买下重型巡洋舰', await buyItem('重型巡洋舰'), true);
check('买下红色涂装', await buyItem('红色涂装'), true);
const stripC = await shopBonusText();
console.log(`  加成条：${stripC.replace(/\s+/g, ' ').trim()}`);
check('加成条显示已购 3 件', stripC.includes('已购 3 件'), true);
check('加成条显示「生命 +200」', stripC.includes('生命 +200'), true);
check('加成条显示「护盾 +100」', stripC.includes('护盾 +100'), true);
check('加成条显示「速度 +50%」', stripC.includes('速度 +50%'), true);
check('加成条显示涂装色', stripC.includes('涂装'), true);
await page.screenshot({ path: path.join(OUT_DIR, 'meta-03-shop-ship.png') });

await backToMainMenu();
const runC = await enterLevelOne();
check('可进入第 1 关（第二次）', runC.entered && runC.ready, true);
const effC = await effective();
const metaC = await metaBonuses();
const ownedC = await ownedItems();
console.log(
  `  局内：生命=${effC?.maxHealth} 护盾=${effC?.maxShield} 伤害倍率=${effC?.damageMultiplier} ` +
    `速度倍率=${effC?.maxSpeedMultiplier} 涂装=${JSON.stringify(effC?.hullTint)}`,
);
check('已购物品读回 3 件', ownedC?.length, 3);
checkNear('生命上限 = 300（基础 100 + 舰体 200）', effC?.maxHealth, 300, 0.01);
checkNear('护盾上限 = 150（基础 50 + 舰体 100）', effC?.maxShield, 150, 0.01);
checkNear('伤害倍率 = 1.43（模块 1.1 × 舰体 1.3）', effC?.damageMultiplier, 1.43, 0.005);
checkNear('速度倍率 = 1.5（舰体 speed 50 → +50%）', effC?.maxSpeedMultiplier, 1.5, 1e-6);
checkNear('伤害倍率确实是两条乘区相乘', (metaC?.damageMultiplier ?? 0), 1.43, 1e-6);
const tint = effC?.hullTint ?? [];
check('舰体主色已换成红色涂装', tint[0] > 0.6 && tint[0] > tint[2], true);

// HUD（玩家唯一看得见的「属性条」）：上限必须跟着变。
// 曾经 store 的 maxHealth/maxShield 恒为默认 100/50，而 updatePlayerHealth/Shield
// 会按它夹取 —— 结果是买了船、真值 300/150，HUD 却还显示 100/100、50/50。
const hudC = await page.evaluate(() => document.body.innerText);
console.log(`  HUD：${(hudC.match(/HP[^\n]*/) || [''])[0]} | ${(hudC.match(/Shield[^\n]*/) || [''])[0]}`);
check('HUD 显示生命上限 300', /HP\s*300\/300/.test(hudC), true);
check('HUD 显示护盾上限 150', /Shield\s*\d+\/150/.test(hudC), true);
await page.screenshot({ path: path.join(OUT_DIR, 'meta-04-battle-buffed.png') });

// 生产路径可见的证据：这条 console 不在 DEV 分支里（生产构建同样会打印）
check('GameScene 打印了元进度加成行（生产也会打印）', metaLogs.length > 0, true);
console.log(`  日志样例：${metaLogs[metaLogs.length - 1] ?? '（无）'}`);

// ───────────────────────── D. 旧存档迁移 ─────────────────────────
console.log('\n===== D. 旧存档迁移：purchasedItems → ownedItems =====');
await backToMainMenu();
await page.evaluate(() => {
  // 模拟「旧版本的存档」：只有 purchasedItems，没有 ownedItems
  localStorage.removeItem('ownedItems');
  localStorage.setItem('purchasedItems', JSON.stringify(['shop-item-13']));
});
await page.reload({ waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);
check('迁移后商店仍可打开', await openShop(), true);
const stripD = await shopBonusText();
console.log(`  加成条：${stripD.replace(/\s+/g, ' ').trim()}`);
check('旧存档的购买记录仍显示为「已购 1 件」', stripD.includes('已购 1 件'), true);
check('旧 key 已被清掉（只剩一个真源）', await page.evaluate(() => localStorage.getItem('purchasedItems')), null);
// 迁移来的记录没有属性快照 → 不凭空发属性
const migCard = await page.locator('.shop-card', { hasText: '红色涂装' }).first().innerText().catch(() => '');
check('迁移记录不假装已生效（不显示加成项）', stripD.includes('暂无永久加成'), true);
console.log(`  红色涂装卡片状态：${migCard.replace(/\s+/g, ' ').trim().slice(0, 60)}`);

// ───────────────────────── 结果 ─────────────────────────
console.log('\n================ 结果 ================');
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`  ${r.pass ? '✅' : '❌'} ${r.label}`));
console.log(`通过 ${results.length - failed.length}/${results.length}`);
console.log(`运行时错误: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log('  ', e.slice(0, 200)));

await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
