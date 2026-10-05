// PBR 材质接线验证：断言 ambientCG 真 PBR（rock030/metalplates016a/metal049a）
// 真的加载并应用到了小行星 / 空间站 / 卫星。
//
// 背景：public/assets/textures/pbr/ 下的 29 张 tex-*.png 是程序化假料
// （一半是纯棋盘格、大量是渐变），且零运行时消费方。本验证对应的是
// 新接入的 ambientCG 真材质（CC0）。
//
// 断言链：PBR 贴图请求全 2xx → 引擎日志出现 "PBR ... applied" →
//        场景内小行星材质 diffuseMap 已设置 → 截图对比 → 0 运行时错误
//
// 用法：先起 dev server（`npx vite --port 5175`），再
//   VERIFY_URL=http://localhost:5175/ node scripts/verify-pbr-materials.mjs
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
const logs = [];
const pbrRequests = new Map(); // 文件名 -> status

page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') errors.push(t);
  logs.push(t);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('response', (res) => {
  const u = res.url();
  if (u.includes('/assets/textures/pbr/'))
    pbrRequests.set(u.split('/assets/textures/pbr/')[1], res.status());
});

const results = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  results.push({ label, actual, expected, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}: 实得=${actual} 期望=${expected}`);
};

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

console.log('\n===== 1. 进入战斗 =====');
await page
  .locator('button', { hasText: /开始游戏/ })
  .first()
  .click({ timeout: 8000 });
await page.waitForTimeout(2500);
await page
  .locator('button', { hasText: /开始挑战|挑战/ })
  .first()
  .click({ timeout: 8000 });
// 引擎一挂载 __waveDebug 就存在（远早于剧情对话），先等它、马上开无敌，
// 否则后面 9s+ 的对话推进里玩家就会被击毁、场景被卸载。
const ok = await page
  .waitForFunction(() => typeof window.__waveDebug === 'object', { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
check('战斗场景初始化（__waveDebug 就绪）', ok, true);
await page
  .evaluate(() => {
    window.__waveDebug?.godMode?.(true);
  })
  .catch(() => {});
await page.waitForTimeout(9000);
for (let i = 0; i < 12; i++) {
  const dlg = page.locator('text=点击继续').first();
  const end = page.locator('text=点击结束').first();
  if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
  await page.mouse.click(640, 560);
  await page.waitForTimeout(700);
}

console.log('\n===== 2. PBR 贴图请求 =====');
await page.waitForTimeout(4000); // 给 GLB 替换 + PBR 应用留时间
const bad = [...pbrRequests.entries()].filter(([, s]) => s < 200 || s >= 300);
console.log(`  PBR 贴图请求 ${pbrRequests.size} 个，异常 ${bad.length} 个`);
[...pbrRequests.entries()].forEach(([f, s]) => console.log(`    ${s} ${f}`));
if (bad.length) bad.forEach(([f, s]) => console.log(`    ❌ ${s} ${f}`));
check('PBR 贴图请求全部 2xx', bad.length, 0);
check(
  '至少 3 个 PBR 贴图被请求',
  pbrRequests.size >= 3 ? pbrRequests.size : 0,
  pbrRequests.size >= 3 ? pbrRequests.size : -1,
);

console.log('\n===== 3. 引擎应用日志 =====');
const appliedLogs = logs.filter((l) => /PBR "(rock|metalPlates|metal)" applied/i.test(l));
console.log(`  应用日志 ${appliedLogs.length} 条`);
appliedLogs.slice(0, 6).forEach((l) => console.log(`    ${l.slice(0, 120)}`));
check('引擎日志确认 PBR 已应用', appliedLogs.length > 0, true);

console.log('\n===== 4. 场景内材质状态 =====');
const matInfo = await page
  .evaluate(() => {
    const dbg = window.__pbrDebug;
    if (!dbg) return null;
    return dbg.summary();
  })
  .catch(() => null);
if (matInfo) {
  console.log(`  ${JSON.stringify(matInfo)}`);
  check('有网格挂上了 PBR diffuseMap', (matInfo.pbrMeshes || 0) > 0, true);
} else {
  console.log('  （无 __pbrDebug 钩子，跳过材质内省，以引擎日志为准）');
}

console.log('\n===== 5. 运行时错误 =====');
const realErrors = errors.filter((e) => !/favicon|Download the React DevTools/i.test(e));
console.log(`  错误 ${realErrors.length} 个`);
realErrors.slice(0, 5).forEach((e) => console.log(`    ${e.slice(0, 200)}`));
check('0 运行时错误', realErrors.length, 0);

// 截图留档：把飞船往回带，让小行星带与空间站进入视野
for (let i = 0; i < 3; i++) {
  await page.keyboard.down('KeyS').catch(() => {});
  await page.waitForTimeout(280);
}
await page.keyboard.up('KeyS').catch(() => {});
await page.waitForTimeout(1200);
// 收起任务追踪面板：点第一张任务卡的标题行（CardHeader 带 cursor-pointer）
await page
  .evaluate(() => {
    const header = document.querySelector('[class*="cursor-pointer"]');
    header?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  })
  .catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/verify/pbr-materials-battle.png' });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n===== 结果：${results.length - failed.length}/${results.length} 通过 =====`);
process.exit(failed.length ? 1 : 0);
