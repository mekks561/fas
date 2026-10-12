// 技能激活验证：断言 HUD 点击 / 触屏按钮 / 键盘 Q E T G 三条输入路径**都能真的开出技能**。
//
// 背景（这是一个真缺陷，此前从没人发现）：
//   `SkillType` 的枚举值是 camelCase（`missileStrike` / `shieldBurst` / `timeSlow`），
//   而 `GameScene` 的**触屏按钮与 HUD 技能条**传的是 snake_case 字符串
//   （`'missile_strike'` …）并用 `as SkillType` 强转**绕过类型检查**。
//   → `SkillSystem.activateSkill()` 里 `skills.get(type)` 恒 miss、**静默**返回 false。
//   → 4 个技能里有 3 个点了没反应；键盘路径写的是枚举，所以只有点按钮 / 触屏的人中招。
//   配套问题：`setSkillCooldown` 无条件调用（没激活也走冷却条），且秒数写死 8/10/15/20
//   而技能真实冷却是 15/20/30/25（冷却环提前转完，玩家以为可以按了）。
//
// 断言链：
//   0. 清档
//   1. 主菜单 → 第 1 关战斗
//   2. 槽位真源快照：4 槽已注册 / 槽位键对齐 / 冷却真值 15,20,30,25 / HUD 分母与真值一致
//   2b. 技能条名称标注：HUD 显示的名字 === 真源名字（槽位原本只有图标，四个长得一样）
//   3. **HUD 点击路径**：逐个点 4 个技能按钮 → 冷却 + 激活态 + store.active 同步 + 按钮高亮
//      （「激活中」这条线此前是断的：HUD 的 isActive 写死 false，黄框高亮代码永远不会跑）
//   4. 重进第 1 关（拿一套全新的 SkillSystem，冷却归零）
//   5. **键盘路径**：按 Q E T G → 对应槽位真的开
//   6. 冷却中的重复按键不得重置冷却（证明确实是"只在真激活时写冷却"）
//   7. 全程无控制台错误
//
// 用法：先起 dev server（`npx vite --port 5177 --strictPort`），再
//   NO_PROXY=localhost,127.0.0.1 VERIFY_URL=http://localhost:5177/ \
//     node scripts/verify-skill-activation.mjs
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
const warns = [];
const pageErrorStacks = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') errors.push(t);
  if (m.type() === 'warning' && t.includes('[SkillSystem]')) warns.push(t);
});
page.on('pageerror', (e) => {
  errors.push(`[pageerror] ${e.message}`);
  // 保留前 3 行堆栈用于定位（去重后在末尾统一打印）
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

const skillsSnap = () =>
  page.evaluate(() => window.__skillDebug?.skills?.() ?? null).catch(() => null);
const hudSkills = () =>
  page.evaluate(() => window.__skillDebug?.hudSkills?.() ?? null).catch(() => null);

/** 轮询到该槽位出现"已激活"迹象（isActive 为真，或冷却已被写入）。 */
const waitActivated = async (index, timeout = 2500) => {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    last = await skillsSnap();
    const s = last?.[index];
    if (s && (s.isActive || s.cooldownRemaining > 0)) return { snap: last, sawActive: !!s.isActive };
    await page.waitForTimeout(60);
  }
  return { snap: last, sawActive: false };
};

/** 轮询到 store 里该槽位被标记为「激活中」（HUD 高亮读的就是这个字段）。 */
const waitStoreActive = async (slotKey, timeout = 2000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const h = await hudSkills();
    if (h?.active?.[slotKey] === true) return true;
    await page.waitForTimeout(50);
  }
  return false;
};

/** 关掉可能挡住菜单的「三选一强化」弹窗。 */
const closeUpgradeIfAny = async () => {
  const card = page.locator('.upgrade-card').first();
  if ((await card.count()) > 0) {
    await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
};

const backToMainMenu = async () => {
  await closeUpgradeIfAny();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  await click([/返回主菜单/, /主菜单/, /Main Menu/i]);
  await page.waitForTimeout(2500);
};

/** 主菜单 → 关卡选择 → 第 1 关战斗（每次进入都会重建 SkillSystem，冷却归零）。 */
const enterLevelOne = async () => {
  await click([/开始游戏/, /Start Game/i]);
  await page.waitForTimeout(2500);
  await click([/开始挑战/, /开始游戏/, /Start/i]);
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
  if (ready) await page.evaluate(() => window.__waveDebug.godMode(true));
  return ready;
};

const EXPECTED_TYPES = ['missileStrike', 'shieldBurst', 'timeSlow', 'overdrive'];
const EXPECTED_SLOTS = ['skill1', 'skill2', 'skill3', 'skill4'];
const EXPECTED_COOLDOWNS = [15, 20, 30, 25];

// ───────────────────────── 0. 清档 ─────────────────────────
console.log('\n===== 0. 清档（保证可重复） =====');
// 首次访问要等 Vite 预打包整个模块图，60s 不够（实测超时）。给到 180s。
await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load', timeout: 180000 });
await page.waitForTimeout(9000);

// ───────────────────────── 1. 进入战斗 ─────────────────────────
console.log('\n===== 1. 主菜单 → 关卡选择 → 战斗 =====');
const ready1 = await enterLevelOne();
checkTrue('可进入战斗且 __waveDebug 可用', ready1);
if (!ready1) {
  await browser.close();
  process.exit(1);
}
checkTrue('__skillDebug 已暴露技能快照', (await skillsSnap()) !== null);

// ───────────────────────── 2. 槽位真源快照 ─────────────────────────
console.log('\n===== 2. 槽位真源与 HUD 分母是否一致 =====');
let snap = await skillsSnap();
check('槽位数量 = 4', snap?.length, 4);
checkTrue('4 个槽位全部已注册到 SkillSystem', (snap ?? []).every((s) => s.registered === true));
for (let i = 0; i < 4; i++) {
  check(`槽位 ${i} 的 store 键`, snap?.[i]?.slot, EXPECTED_SLOTS[i]);
  check(`槽位 ${i} 的技能 id（camelCase）`, snap?.[i]?.type, EXPECTED_TYPES[i]);
  check(`槽位 ${i} 的真实冷却秒数`, snap?.[i]?.cooldownTotal, EXPECTED_COOLDOWNS[i]);
}
checkTrue('初始 4 个槽位都处于 ready', (snap ?? []).every((s) => s.ready === true));

// 这条是"冷却环提前转完"那个缺陷的直接防线：HUD 的分母必须等于技能真值
let hud = await hudSkills();
for (let i = 0; i < 4; i++) {
  check(`HUD 冷却分母[${EXPECTED_SLOTS[i]}] === 技能真值`, hud?.maxCooldowns?.[EXPECTED_SLOTS[i]], EXPECTED_COOLDOWNS[i]);
}

// ───────────────────────── 2b. 技能条必须标出技能名 ─────────────────────────
// 槽位里原本只有图标 + 键位字母，四个按钮长得一模一样（冷却中一起变灰时更分不出），
// 玩家没法知道哪个槽位是哪个技能。这里断言 HUD 上的名字与 SkillSystem 真源逐字一致 ——
// 不硬编码中文名，避免"脚本里抄一份"变成第三个会漂移的地方。
console.log('\n===== 2b. 技能条名称标注 =====');
for (let i = 0; i < 4; i++) {
  const el = page.locator(`[data-testid="skill-name-${i}"]`).first();
  const shown = (await el.count()) > 0 ? (await el.innerText()).trim() : '(标签缺失)';
  checkTrue(`槽位 ${i} 标出了技能名（非空）`, shown.length > 0 && shown !== '(标签缺失)');
  check(`槽位 ${i} 的 HUD 技能名 === 真源名字`, shown, snap?.[i]?.name);
}
console.log(`  HUD 技能名：${(snap ?? []).map((s) => s.name).join(' / ')}`);

// ───────────────────────── 3. HUD 点击路径（原先 3/4 失效） ─────────────────────────
console.log('\n===== 3. HUD 技能条点击（原缺陷路径：4 个里 3 个静默失效） =====');
const hudStats = [];
for (let i = 0; i < 4; i++) {
  const btn = page.locator(`[data-testid="skill-slot-${i}"]`).first();
  const count = await btn.count();
  if (count === 0) {
    checkTrue(`槽位 ${i} 的 HUD 按钮存在`, false);
    continue;
  }
  await btn.click({ timeout: 8000 }).catch(() => {});
  // 先等 store 的 active 同步（HUD 高亮就吃这个字段），再等引擎侧真值。
  const storeActive = await waitStoreActive(EXPECTED_SLOTS[i]);
  const cls = ((await btn.getAttribute('class')) || '').trim();
  const { snap: after, sawActive } = await waitActivated(i);
  const s = after?.[i];
  hudStats.push({ i, cooldownRemaining: s?.cooldownRemaining, isActive: sawActive, storeActive });
  checkTrue(`点击槽位 ${i} 后技能真的进入冷却`, typeof s?.cooldownRemaining === 'number' && s.cooldownRemaining > 0);
  checkTrue(`点击槽位 ${i} 后技能进入激活态`, sawActive);
  // 「激活中」这条线此前是断的：HUD 的 isActive 写死 false，黄框高亮代码永远不会跑。
  checkTrue(`点击槽位 ${i} 后 store.active 同步为真`, storeActive);
  checkTrue(`点击槽位 ${i} 后 HUD 按钮进入高亮态`, cls.includes('border-yellow-400'));
  const h = await hudSkills();
  checkTrue(`点击槽位 ${i} 后 store 冷却被写入`, typeof h?.cooldowns?.[EXPECTED_SLOTS[i]] === 'number' && h.cooldowns[EXPECTED_SLOTS[i]] > 0);
  checkTrue(`点击槽位 ${i} 后 HUD 按钮变为不可点`, (await btn.isDisabled()) === true);
}
console.log(`  HUD 路径记录：${JSON.stringify(hudStats)}`);

// ───────────────────────── 4. 重进关卡（新的 SkillSystem） ─────────────────────────
console.log('\n===== 4. 退到主菜单 → 重进第 1 关（冷却归零，测键盘路径） =====');
await backToMainMenu();
const ready2 = await enterLevelOne();
checkTrue('重新进入战斗成功', ready2);
if (!ready2) {
  await browser.close();
  process.exit(1);
}
snap = await skillsSnap();
checkTrue('新场景 4 个槽位冷却已归零（ready）', (snap ?? []).every((s) => s.ready === true));

// ───────────────────────── 5. 键盘路径 ─────────────────────────
console.log('\n===== 5. 键盘 Q / E / T / G =====');
const KEY_TO_SLOT = [
  ['KeyQ', 0],
  ['KeyE', 1],
  ['KeyT', 2],
  ['KeyG', 3],
];
for (const [key, index] of KEY_TO_SLOT) {
  await page.keyboard.press(key);
  const { snap: after, sawActive } = await waitActivated(index);
  const s = after?.[index];
  checkTrue(`按 ${key} 后槽位 ${index} 真的进入冷却`, typeof s?.cooldownRemaining === 'number' && s.cooldownRemaining > 0);
  checkTrue(`按 ${key} 后槽位 ${index} 进入激活态`, sawActive);
}

// ───────────────────────── 6. 冷却中重复按键不得重置冷却 ─────────────────────────
console.log('\n===== 6. 冷却中连按 Q 不得重置冷却（证明"只在真激活时写冷却"） =====');
const beforeRepeat = (await skillsSnap())?.[0]?.cooldownRemaining ?? -1;
await page.waitForTimeout(400);
await page.keyboard.press('KeyQ');
await page.keyboard.press('KeyQ');
await page.keyboard.press('KeyQ');
const afterRepeat = (await skillsSnap())?.[0]?.cooldownRemaining ?? -1;
console.log(`  连按前 ${beforeRepeat}s → 连按后 ${afterRepeat}s`);
checkTrue('冷却仍在递减，没有被重置回 15s', afterRepeat > 0 && afterRepeat < beforeRepeat);
checkTrue('重复按键期间的冷却 <= 技能冷却总长', afterRepeat <= EXPECTED_COOLDOWNS[0]);

// ───────────────────────── 7. 控制台 ─────────────────────────
console.log('\n===== 7. 控制台 =====');
const skillWarns = warns.length;
check('未出现未知技能 id 的告警（词表没错位）', skillWarns, 0);
/**
 * 已知与本次改动无关的噪声（都在引擎/资源层，本脚本不碰 SkillSystem 之外的代码）：
 *   · `ASSERT FAILED: Could not find current application` —— 退场时 GameScene 先卸载、
 *     PlayCanvas 资源随后销毁的固定顺序问题，dev 下必现，与本轮无关；
 *   · `still waiting on run dependencies: wasm-instantiate` —— wasmoon 在 dev 下的加载日志；
 *   · `[LuaEngine] Function __aiProbe not found` —— 敌机 AI 走后端 ts 时没有对应 Lua 探针。
 * 后两条在 dev 下会被 Chromium 拆成多行分发（`still waiting on run dependencies:` /
 * `dependency: …` / `(end of list)`），所以按前缀成组过滤，而不是只匹配首行。
 * 把它们单列，既不掩盖、也不让本脚本因非技能因素长期红着。
 */
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

await page.screenshot({ path: path.join(OUT_DIR, 'skill-activation.png') }).catch(() => {});
await browser.close();
process.exit(failed ? 1 : 0);
