// 技能树接线验证：断言「打波次 → 升级 → 得天赋点 → 加点 → 战斗属性真的变化」。
//
// 背景：技能树此前是「两端全断」的半成品——
//   · 入口端：全项目没有任何生产代码调用 SkillTreeManager.setPlayerLevel，
//     玩家等级恒为 1，天赋点恒为 0，12 个天赋全部点不动；
//     连带后果是关卡选择里第 2~5 关（需等级 3/5/8/10）永远锁着。
//   · 出口端：getStats() 没有任何战斗代码消费，就算点上天赋也不影响手感。
//   · UI 端：SkillTreeUI 零引用，玩家没有入口。
// 本脚本验证这三段接通之后的真实行为。
//
// 断言链：
//   初始（清档）level=1 / points=0 / 高等级天赋锁着
//   → 清 3 波 → level=4、points=3（每波 +1，store 为唯一真源）
//   → 点 3 个天赋 → 天赋面板统计变化
//   → **实际生效**：PlayerShip.maxHealth 110 / maxShield 55，
//     WeaponSystem.damageMultiplier 1.05（读的是战斗系统内部状态，非技能树自述）
//   → UI 可达：主菜单「技能树」入口打开面板，点数与天赋卡片正确渲染
//
// 用法：先起 dev server（`npx vite --port 5175`），再
//   VERIFY_URL=http://localhost:5175/ node scripts/verify-skilltree-wiring.mjs
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
const checkNear = (label, actual, expected, tol = 0.001) => {
  const pass = Math.abs(actual - expected) <= tol;
  results.push({ label, actual, expected, pass });
  console.log(
    `  ${pass ? '✅' : '❌'} ${label}: 实得=${actual} 期望≈${expected}（容差 ${tol}）`,
  );
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

const skillMeta = () =>
  page
    .evaluate(() => window.__skillDebug?.getMeta?.() ?? null)
    .catch(() => null);
const skillNodes = () =>
  page
    .evaluate(() => window.__skillDebug?.nodes?.() ?? null)
    .catch(() => null);
const effective = () =>
  page
    .evaluate(() => window.__skillDebug?.getEffective?.() ?? null)
    .catch(() => null);

// ───────────────────────── 0. 清档，保证可重复 ─────────────────────────
console.log('\n===== 0. 清档（等级/技能树都会持久化，必须先清） =====');
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(() => {
  localStorage.clear();
  // 技能树单例在模块加载时就读过 localStorage，清完必须重载页面才会重新读取
});
await page.reload({ waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

// ───────────────────────── 1. 进入战斗 ─────────────────────────
console.log('\n===== 1. 主菜单 → 关卡选择 → 战斗 =====');
const hasMainMenu = await click([/开始游戏/, /Start Game/i]);
check('主菜单有「开始游戏」', hasMainMenu, true);
await page.waitForTimeout(2500);
// 关卡选择页的关卡是卡片（div），默认已选中第 1 关，点「开始挑战」即可进战斗
const entered = await click([/开始挑战/, /开始游戏/, /Start/i]);
check('关卡选择页可进入战斗', entered, true);
await page.waitForTimeout(10000);

const hasDebug = await page
  .waitForFunction(
    () => typeof window.__waveDebug === 'object' && typeof window.__skillDebug === 'object',
    { timeout: 20000 },
  )
  .then(() => true)
  .catch(() => false);
check('调试钩子可用（__waveDebug + __skillDebug）', hasDebug, true);
if (!hasDebug) {
  await browser.close();
  process.exit(1);
}

// 开无敌：验证的是技能树链路，不让玩家在驱动波次时被击杀
await page.evaluate(() => window.__waveDebug.godMode(true));

// ───────────────────────── 2. 初始状态 ─────────────────────────
console.log('\n===== 2. 初始状态（清档后） =====');
const meta0 = await skillMeta();
const eff0 = await effective();
console.log(`  等级=${meta0?.level} 天赋点=${meta0?.points} 生命上限=${eff0?.maxHealth} 护盾上限=${eff0?.maxShield} 伤害倍率=${eff0?.damageMultiplier}`);
check('初始等级 = 1', meta0?.level, 1);
check('初始天赋点 = 0', meta0?.points, 0);
checkNear('初始伤害倍率 = 1', eff0?.damageMultiplier, 1);
checkNear('初始生命上限 = 100', eff0?.maxHealth, 100);
checkNear('初始护盾上限 = 50', eff0?.maxShield, 50);

const nodes0 = await skillNodes();
check('天赋节点数 = 12', nodes0?.length, 12);
const lockedHigh = nodes0?.filter((n) => n.unlockLevel > 1).length ?? 0;
console.log(`  解锁门槛 > 1 级的天赋数：${lockedHigh}`);

// 波次完成后会弹出「三选一强化」并**暂停游戏**。不清掉它的话，下一波不会完整
// 生成敌人，波次也就无法再次完成。点第一张卡即关闭（会给 BuildSystem 加强化，
// 所以后面的属性断言一律用「相对变化」而不是绝对值）。
const closeUpgradeIfAny = async () => {
  const card = page.locator('.upgrade-card').first();
  if ((await card.count()) > 0) {
    await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
};

/** 启动指定波次并把它的敌人清空，直到该波被判定完成（等级因此 +1）。 */
const clearWave = async (waveNumber, levelBefore) => {
  await closeUpgradeIfAny();
  await page.evaluate((n) => window.__waveDebug.startWave(n), waveNumber);
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => window.__waveDebug.getState()).catch(() => null);
    if (s && s.aliveEnemies > 0) {
      await page.evaluate(() => window.__waveDebug.killAll());
    }
    const m = await skillMeta();
    if (m && m.level > levelBefore) {
      await closeUpgradeIfAny();
      return true;
    }
    await page.waitForTimeout(400);
  }
  return false;
};

// ───────────────────────── 3. 清 3 波 → 升级得点 ─────────────────────────
console.log('\n===== 3. 清 3 波 → 等级与天赋点应同步上涨 =====');
let clearedWaves = 0;
for (let w = 1; w <= 3; w++) {
  const before = (await skillMeta())?.level ?? 1;
  const ok = await clearWave(w, before);
  const m = await skillMeta();
  console.log(`  清第 ${w} 波：${ok ? '完成' : '超时'} → 等级=${m?.level} 天赋点=${m?.points}`);
  if (ok) clearedWaves++;
}

const meta1 = await skillMeta();
check('成功清空 3 波', clearedWaves, 3);
// 每波只应发 1 点：清 3 波 → 等级 1+3=4、点数 3
check('清 3 波后等级 = 4（每波 +1，不重复发）', meta1?.level, 4);
check('清 3 波后天赋点 = 3', meta1?.points, 3);

// 记录「加点前」的战斗属性作为相对断言的基准
const effBefore = await effective();
console.log(
  `  加点前基准：生命=${effBefore?.maxHealth} 护盾=${effBefore?.maxShield} 伤害倍率=${effBefore?.damageMultiplier}`,
);

// ───────────────────────── 4. 点天赋 ─────────────────────────
console.log('\n===== 4. 点天赋（3 点全用掉） =====');
const upOffensive = await page.evaluate(() =>
  window.__skillDebug.upgrade('offensive_mastery'),
);
const upDefensive = await page.evaluate(() =>
  window.__skillDebug.upgrade('defensive_mastery'),
);
const upShield = await page.evaluate(() => window.__skillDebug.upgrade('shield_expertise'));
console.log(`  攻击精通=${upOffensive} 防御精通=${upDefensive} 护盾专精=${upShield}`);
check('点「攻击精通」成功', upOffensive, true);
check('点「防御精通」成功', upDefensive, true);
check('点「护盾专精」成功（需前置于防御精通）', upShield, true);

const meta2 = await skillMeta();
check('天赋点已扣完 = 0', meta2?.points, 0);
check('伤害加成统计 = 5%', meta2?.stats?.damageBonus, 5);
check('生命加成统计 = 10%', meta2?.stats?.healthBonus, 10);
check('护盾加成统计 = 10%', meta2?.stats?.shieldBonus, 10);

// ───────────────────────── 5. 关键：加成是否真的走到战斗系统 ─────────────────────────
console.log('\n===== 5. 属性出口（读 PlayerShip / WeaponSystem 内部状态） =====');
// 等两帧，让 GameScene 的每帧同步把新修饰符推进去
await page.waitForTimeout(2000);
const eff1 = await effective();
console.log(
  `  加点后：生命=${eff1?.maxHealth} 护盾=${eff1?.maxShield} 伤害倍率=${eff1?.damageMultiplier} 射速倍率=${eff1?.fireRateMultiplier}`,
);
// 天赋 healthBonus=10% → maxHealthBonus += 基线100 × 10% = 10（绝对值增量，与局内强化无关）
checkNear(
  '生命上限增量 = +10（基线 100 × 10%）',
  (eff1?.maxHealth ?? 0) - (effBefore?.maxHealth ?? 0),
  10,
  0.01,
);
// 天赋 shieldBonus=10% → setMaxShield(基线50 × 1.1) = 55（绝对赋值）
checkNear('护盾上限 = 55（基线 50 × 1.1）', eff1?.maxShield, 55, 0.01);
// 天赋 damageBonus=5% → 伤害倍率相对提升 5%（除以加点前值，剔除局内强化的影响）
checkNear(
  '伤害倍率相对提升 5%',
  (eff1?.damageMultiplier ?? 0) / (effBefore?.damageMultiplier || 1),
  1.05,
  0.005,
);

await page.screenshot({ path: path.join(OUT_DIR, 'skilltree-01-battle.png') });

// ───────────────────────── 6. UI 可达性 ─────────────────────────
console.log('\n===== 6. 主菜单「技能树」入口与面板渲染 =====');
// 先清掉可能残留的强化弹窗，否则 Escape 会被它吃掉、退不出战斗
await closeUpgradeIfAny();
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
await click([/返回主菜单/, /主菜单/, /Main Menu/i]);
await page.waitForTimeout(2500);

const hasEntry = await click([/技能树/]);
check('主菜单有「技能树」入口', hasEntry, true);
await page.waitForTimeout(2500);

const panelTitle = await page
  .locator('h1', { hasText: /技能树|Skill Tree/i })
  .count()
  .catch(() => 0);
check('技能树面板已打开（标题可见）', panelTitle > 0, true);

// 面板上应显示等级 4 与天赋点 0；天赋卡片里应出现「攻击精通」
const bodyText = await page.locator('body').innerText().catch(() => '');
check('面板显示攻击精通卡片', bodyText.includes('攻击精通'), true);
check('面板显示防御精通卡片', bodyText.includes('防御精通'), true);
console.log(`  面板文本片段：${bodyText.replace(/\s+/g, ' ').slice(0, 180)}`);

await page.screenshot({ path: path.join(OUT_DIR, 'skilltree-02-panel.png') });

// ───────────────────────── 7. 重载后持久化 ─────────────────────────
console.log('\n===== 7. 重载后技能树持久化 =====');
await page.reload({ waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const metaAfterReload = await page
  .evaluate(() => {
    const raw = localStorage.getItem('skillTreeData');
    return raw ? JSON.parse(raw) : null;
  })
  .catch(() => null);
const persistedLevel = metaAfterReload?.playerLevel ?? -1;
const persistedPoints = metaAfterReload?.talentPoints ?? -1;
console.log(`  localStorage skillTreeData: 等级=${persistedLevel} 天赋点=${persistedPoints}`);
check('重载后技能树等级已持久化 = 4', persistedLevel, 4);
check('重载后天赋点已持久化 = 0', persistedPoints, 0);

// ───────────────────────── 结果 ─────────────────────────
console.log('\n================ 结果 ================');
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`  ${r.pass ? '✅' : '❌'} ${r.label}`));
console.log(`通过 ${results.length - failed.length}/${results.length}`);
console.log(`运行时错误: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log('  ', e.slice(0, 200)));

await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
