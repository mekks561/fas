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
//   → 清 3 波 → level=4、points=3（经验 = 3 波 ×100 = 300，等级由经验推导）
//   → 点 3 个天赋 → 天赋面板统计变化
//   → **重新进一关**后断言实际生效值：PlayerShip.maxHealth 110 / maxShield 55、
//     WeaponSystem.damageMultiplier 1.05（读的是战斗系统内部状态，非技能树自述）
//   → UI 可达：主菜单「技能树」入口打开面板，点数与天赋卡片正确渲染
//
// ⚠ 为什么第 5 步必须「重新进一关」：
//   第 1 关只有 **3 波**。上面清完 3 波 = **直接通关** → GameScene 被 React 卸载
//   （canvas 消失、`__waveDiag.ticks` 冻结），`playerRef` 还握着**已经冻结的旧
//   PlayerShip**。在那个窗口里读属性，读到的永远是加点前的 100/50/1 —— 曾经据此
//   把「技能树加成没被消费」写进了 README 与长期记忆，**那是误判**：
//   真凶是脚本时序，不是产品缺陷。改为通关后重进第 1 关再断言，三项全达标。
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

/** 关掉可能挡住逃生菜单的「三选一强化」弹窗（它会把游戏暂停）。 */
const closeUpgradeIfAny = async () => {
  const card = page.locator('.upgrade-card').first();
  if ((await card.count()) > 0) {
    await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
};

/** 从战斗回到主菜单。 */
const backToMainMenu = async () => {
  await closeUpgradeIfAny();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  await click([/返回主菜单/, /主菜单/, /Main Menu/i]);
  await page.waitForTimeout(2500);
};

/**
 * 从主菜单进入第 1 关（关卡选择页默认已选中第 1 关）。
 * 重新进入会**重建** GameScene / PlayerShip，这正是第 5 步需要的「干净读数」。
 */
const enterLevelOne = async () => {
  await click([/开始游戏/, /Start Game/i]);
  await page.waitForTimeout(2500);
  const entered = await click([/开始挑战/, /开始游戏/, /Start/i]);
  await page.waitForTimeout(9000);
  // 剧情对话挡着时先点掉
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
  // 新场景要重新开无敌：这是验证加成链路，不是验证生存能力
  if (ready) await page.evaluate(() => window.__waveDebug.godMode(true));
  return { entered, ready };
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
// 关卡选择页的关卡是卡片（div），默认已选中第 1 关，点「开始挑战」即可进战斗
const firstEntry = await enterLevelOne();
check('关卡选择页可进入战斗', firstEntry.entered, true);
check('调试钩子可用（__waveDebug）', firstEntry.ready, true);
if (!firstEntry.ready) {
  await browser.close();
  process.exit(1);
}

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
// 生成敌人，波次也就无法再次完成。`closeUpgradeIfAny` 见文件上方。
//
// 注意它会给 BuildSystem 加一条局内强化 —— 所以第 5 步的绝对属性断言必须在
// **重新进一关**之后做（那时 BuildSystem 是全新的、没有局内强化污染基线）。

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
// 每波发 100 经验：清 3 波 = 300 经验 → 等级 4（曲线 1~4 级每级 100 点 = 1 波）
check('清 3 波后等级 = 4（300 经验，等级由经验推导）', meta1?.level, 4);
check('清 3 波后天赋点 = 3', meta1?.points, 3);
// 经验真源：store 里应记着 300（+ 通关奖励，见下），而不是「只涨等级不记经验」
const expAfterWaves = await page
  .evaluate(() => {
    const raw = localStorage.getItem('fighter-game-save');
    return raw ? (JSON.parse(raw)?.state?.player?.experience ?? -1) : -1;
  })
  .catch(() => -1);
console.log(`  store 持久化的累计经验 = ${expAfterWaves}`);
check('清 3 波 + 通关奖励后累计经验 = 400', expAfterWaves, 400);

// 此时第 1 关已经通关、GameScene 正在卸载 —— 读属性没有意义（见文件头说明），
// 唯一的用途是**证明这个陷阱真实存在**：这一读必然是加点前的旧值。
const effStale = await effective();
const staleDiag = await page
  .evaluate(() => window.__waveDiag?.ticks ?? -1)
  .catch(() => -1);
console.log(
  `  通关后残留读数（证明有陷阱）：生命=${effStale?.maxHealth} 护盾=${effStale?.maxShield} ` +
    `伤害倍率=${effStale?.damageMultiplier} __waveDiag.ticks=${staleDiag}`,
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
console.log('\n===== 5. 属性出口（通关后**重新进第 1 关**再读 PlayerShip / WeaponSystem） =====');
console.log('  说明：第 1 关只有 3 波，上面清完 3 波即通关、场景已卸载。');
console.log('        必须重进一关，否则读到的是冻结的旧 PlayerShip（上一轮据此误判过）。');

await backToMainMenu();
const reentry = await enterLevelOne();
check('通关后可重新进入第 1 关（用于读数）', reentry.entered && reentry.ready, true);

// 等两帧，让每帧同步把新修饰符推进去
await page.waitForTimeout(2500);
const eff1 = await effective();
console.log(
  `  重进后：生命=${eff1?.maxHealth} 护盾=${eff1?.maxShield} 伤害倍率=${eff1?.damageMultiplier} 射速倍率=${eff1?.fireRateMultiplier}`,
);
// 重进第 1 关 = 全新场景，BuildSystem 无局内强化，所以基线就是关卡基础值 100/50，
// 可以直接断言**绝对值**（比相对值更强：相对值无法区分「加成生效」与「基线变了」）。
checkNear('生命上限 = 110（基础 100 × 1.10）', eff1?.maxHealth, 110, 0.01);
checkNear('护盾上限 = 55（基础 50 × 1.10）', eff1?.maxShield, 55, 0.01);
checkNear('伤害倍率 = 1.05（+5%）', eff1?.damageMultiplier, 1.05, 0.005);
checkNear('射速倍率 = 1（未点射速天赋，不应被顺手改动）', eff1?.fireRateMultiplier, 1, 0.005);

await page.screenshot({ path: path.join(OUT_DIR, 'skilltree-01-battle.png') });

// ───────────────────────── 6. UI 可达性 ─────────────────────────
console.log('\n===== 6. 主菜单「技能树」入口与面板渲染 =====');
await backToMainMenu();

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
