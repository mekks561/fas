/**
 * 生产构建下的 Lua 运行时冒烟验证（不依赖任何调试钩子）
 *
 * 为什么单独有此脚本：
 *  - `__aiDebug` / `__waveDebug` 这类钩子被 `import.meta.env.DEV` 包着，
 *    生产构建会被整体剔除（这是对的，不该把调试面发到线上）。
 *  - 于是 `verify-lua-ai.mjs` 只能在 dev server 上跑，**证明不了生产构建**。
 *  - 但「dev 绿、prod 炸」恰恰是本轮抓到的真实缺陷类别：
 *    取 .lua 源码的 5 处写法（`import.meta.glob as:'raw'` / `fetch('/src/lua/...')`）
 *    在 dev 都能跑，在生产构建下分别退化成「资源 URL 字符串」和「404」。
 *
 * 所以本脚本改用**纯 console 证据**：
 *  LuaEngine / EnemyAIManager 在装载成功时打的日志，其内容本身就来自真实 Lua
 *  （`v2.0.0` 是 `enemy-ai.lua` 里 `EnemyAI.VERSION` 经 `__aiProbe()` 读回来的），
 *  伪造不出来 —— 拿 URL 当源码 load 会直接抛语法错，落到「装载失败」分支。
 *
 * 断言：
 *  P1. 出现 `[LuaEngine] 真实 Lua 运行时已启用`
 *  P2. **没有**出现 `未启用真实 Lua 运行时`（stub 回落）
 *  P3. 出现 `[EnemyAIManager] 已接通 enemy-ai.lua v2.0.0（运行时 lua）`
 *  P4. **没有**出现 `enemy-ai.lua 装载失败`
 *  P5. **没有**出现 `Lua 源码注册表存在非法条目`
 *  P6. 无未捕获的页面错误
 *  P7. 战斗确实跑起来了（canvas 有内容 + HUD 出现波次/生命文案）
 *  P8. 元进度（商店已购物品 → 下一局属性）在生产构建下同样被折算
 *      —— 开局日志必须把预置的两件已购物品算成「生命 +200 / 伤害 +43%」
 *  P9. 成就面板在生产构建下读运行时真源（32 条 + 进度条 + 无 404）
 *      —— 本轮把面板从「fetch content JSON」改成「读说明表」，这类
 *      「资源取源」改动最容易 dev 绿、prod 404
 *
 * 用法：
 *   npx vite build && NO_PROXY=localhost,127.0.0.1 \
 *   VERIFY_URL=http://localhost:4180/ node scripts/verify-lua-runtime-prod.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VERIFY_URL || 'http://localhost:4173/';
const results = [];
let failed = false;

const checkTrue = (name, condition, detail) => {
  if (!condition) failed = true;
  results.push(`${condition ? '✅' : '❌'} ${name}: ${JSON.stringify(detail)}`);
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

// 预置「已购物品」，让生产构建下的元进度分支真的被走到。
// 购买只发生在菜单里（点按钮 → 写 OwnedItems），这里直接写存储，等价于玩家刚买完：
// 巡洋舰（生命 +200 / 护盾 +100 / 速度 +50% / 伤害 ×1.3）+ 伤害强化模块（×1.1）
await page.addInitScript(() => {
  try {
    localStorage.setItem(
      'ownedItems',
      JSON.stringify([
        {
          id: 'shop-item-01',
          name: '重型巡洋舰',
          type: 'ship',
          subtype: 'cruiser',
          price: 15000,
          attributes: { health: 200, shield: 100, speed: 50, damage: 30, weaponSlots: 4 },
          purchasedAt: 1,
        },
        {
          id: 'shop-item-17',
          name: '伤害强化模块',
          type: 'upgrade',
          subtype: 'damage',
          price: 10000,
          attributes: { damageBonus: 0.1, permanent: true },
          purchasedAt: 2,
        },
      ]),
    );
  } catch {
    /* about:blank 上写 localStorage 会抛，忽略 */
  }
});

const logs = [];
const errors = [];
/** 生产构建下的失败请求（404/500）—— 「dev 绿、prod 炸」的典型信号 */
const notFound = [];
/** 对已删除的 content 层成就 JSON 的请求（面板不再依赖它们） */
const legacyAchRequests = [];
page.on('console', (m) => logs.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
page.on('response', (res) => {
  if (res.status() >= 400) notFound.push(`${res.status()} ${res.url()}`);
});
page.on('request', (req) => {
  if (req.url().includes('/assets/achievements/')) legacyAchRequests.push(req.url());
});

const hasLog = (needle) => logs.some((l) => l.includes(needle));

console.log(`\n===== 生产构建 Lua 运行时冒烟（${BASE}） =====`);

// —— 进入战斗（与 verify-lua-ai.mjs 同一路径，但不等调试钩子）——
await page.goto(`${BASE}?ai=lua`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page
  .locator('button', { hasText: /开始游戏/ })
  .first()
  .click({ timeout: 15000 });
await page.locator('p.line-clamp-2').first().waitFor({ timeout: 40000 });
await page.waitForTimeout(800);
await page.locator('h3', { hasText: '初次接触' }).first().click({ timeout: 15000 });
await page.waitForTimeout(12000);
for (let i = 0; i < 12; i++) {
  const dlg = page.locator('text=点击继续').first();
  const end = page.locator('text=点击结束').first();
  if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
  await page.mouse.click(640, 560);
  await page.waitForTimeout(700);
}
// 让真实 Lua 有完整的初始化与首次 step 窗口
await page.waitForTimeout(8000);

// —— P1 / P2：真实运行时 vs stub 回落 ——
const readyLog = logs.find((l) => l.includes('真实 Lua 运行时已启用')) ?? null;
checkTrue('P1 真实 Lua 运行时已启用', readyLog !== null, readyLog);
checkTrue(
  'P2 未回落到 stub（宿主 JS 实现）',
  !hasLog('未启用真实 Lua 运行时'),
  hasLog('未启用真实 Lua 运行时') ? '出现 stub 回落日志' : 'ok',
);

// —— P3 / P4：enemy-ai.lua 真的被 Lua 装载（版本号来自 Lua 侧读回）——
const bridgeLog = logs.find((l) => l.includes('已接通 enemy-ai.lua')) ?? null;
checkTrue('P3 enemy-ai.lua 已由真实 Lua 装载', bridgeLog !== null, bridgeLog);
checkTrue('P3b 装载出的是 v2.0.0（Lua 侧读回）', /v2\.0\.0/.test(bridgeLog || ''), bridgeLog);
checkTrue('P4 无 enemy-ai.lua 装载失败', !hasLog('enemy-ai.lua 装载失败'), 'ok');

// —— P5：源码注册表健康（拿到 URL 而非源码就会在这里暴露）——
checkTrue(
  'P5 源码注册表无退化条目',
  !hasLog('Lua 源码注册表存在非法条目'),
  logs.filter((l) => l.includes('luaSources')).join(' | ') || 'ok',
);

// —— P6：运行时错误 ——
checkTrue('P6 无未捕获页面错误', errors.length === 0, errors.slice(0, 3));

// —— P7：玩法确实在跑（非空白场景）——
const canvasOk = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return !!c && c.width > 0 && c.height > 0;
});
checkTrue('P7 战斗画布已渲染', canvasOk, canvasOk);
const hud = await page.evaluate(() => document.body.innerText.slice(0, 400));
checkTrue(
  'P7b HUD 出现战斗文案（波次/生命/得分 任一）',
  /波次|Wave|生命|HP|得分|Score/i.test(hud),
  hud.replace(/\s+/g, ' ').slice(0, 160),
);

// —— P8：元进度（商店已购物品 → 下一局生效）在生产构建下同样成立 ——
// 这行日志不在 `import.meta.env.DEV` 分支里，所以它是**生产可观测**的证据：
// 加成确实被折算出来了，且数量与预置的两件物品一致。
const metaLog = logs.find((l) => l.includes('[GameScene] 元进度')) ?? null;
checkTrue('P8 生产构建下元进度被折算（已购 2 件）', /已购 2 件/.test(metaLog || ''), metaLog);
checkTrue(
  'P8b 加成与换算表一致（生命 +200 / 护盾 +100 / 速度 +50% / 伤害 +43%）',
  /生命 \+200/.test(metaLog || '') &&
    /护盾 \+100/.test(metaLog || '') &&
    /速度 \+50%/.test(metaLog || '') &&
    /伤害 \+43%/.test(metaLog || ''),
  metaLog,
);

// —— P9：成就面板在生产构建下读的是运行时真源 ——
// 本轮把面板从「fetch /assets/achievements/*.json（15 条硬编码）+ 读一个无人写入的
// localStorage key」改成「读成就系统的定义表快照」，并删掉了那 15 个 JSON。
// 这正是「dev 绿、prod 404」最典型的改动形状，所以单独守一条：
// 面板能渲染出**完整条数**就说明取源在生产路径上成立（少一条都会立刻掉数字）。
console.log('\n===== P9 成就面板（生产构建） =====');
await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(7000);
const achBtn = page.locator('button', { hasText: /成就/ }).first();
const achOpened = (await achBtn.count()) > 0;
checkTrue('P9 主菜单有「成就」入口', achOpened, achOpened);
if (achOpened) {
  await achBtn.click({ timeout: 15000 }).catch(() => {});
  await page.waitForSelector('.achievement-card', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
}
const cards = await page
  .locator('.achievement-card')
  .count()
  .catch(() => 0);
const bars = await page
  .locator('.achievement-card-progress-text')
  .count()
  .catch(() => 0);
checkTrue('P9b 面板渲染出完整定义表（32 条）', cards === 32, `实得 ${cards}`);
checkTrue('P9c 每条成就都带真实进度条', bars === 32, `实得 ${bars}`);
checkTrue(
  'P9d 不再请求已删除的 content JSON',
  legacyAchRequests.length === 0,
  legacyAchRequests.slice(0, 3),
);
// 面板页自身的 404 单独看：全局 notFound 里可能有无关噪声，这里只看成就面板相关
const achRelated404 = notFound.filter((u) => /achievement|icons\//i.test(u));
checkTrue('P9e 面板无 404 资源（含图标）', achRelated404.length === 0, achRelated404.slice(0, 3));
await page.screenshot({ path: path.resolve('docs/verify/ach-prod-panel.png') }).catch(() => {});

// —— 产出截图（归档）——
const shot = path.resolve('docs/verify/lua-runtime-prod.png');
await page.screenshot({ path: shot });
console.log(`截图已保存: ${shot}`);

await browser.close();

console.log('\n================ 结果 ================');
for (const r of results) console.log('  ' + r);
const passed = results.filter((r) => r.startsWith('✅')).length;
console.log(`\n通过 ${passed}/${results.length}`);
if (errors.length) console.log(`运行时错误: ${errors.length}`);
if (notFound.length) {
  console.log(`失败请求（4xx/5xx）: ${notFound.length}`);
  notFound.slice(0, 8).forEach((u) => console.log('  ', u));
}

process.exit(failed ? 1 : 0);
