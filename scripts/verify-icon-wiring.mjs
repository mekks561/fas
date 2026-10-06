/**
 * 真 UI 图标接线验证。
 *
 * 背景：textures/ui/ 根下 40 个 icon-*.png 是 64×64 纯色方块（假料），
 * 已用 Kenney 真图形（ui/icons/ 下 14 张）替换消费链路：
 * ShopPanel / AchievementPanel 经 AssetIcon 组件按 config 的 icon 字段拼 URL。
 *
 * 断言（5 项）：
 *  1. 商店面板渲染了 ≥1 张真图标 img
 *  2. 商店图标全部加载成功（naturalWidth > 0）
 *  3. 成就面板渲染了 ≥1 张真图标 img
 *  4. 成就图标全部加载成功
 *  5. 无 404 资源请求（icons 目录内）
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VERIFY_URL || 'http://localhost:5177/';
const results = [];
let failed = false;
const check = (name, actual, expect) => {
  const ok = actual === expect || (expect === true && Boolean(actual));
  if (!ok) failed = true;
  results.push(`${ok ? '✅' : '❌'} ${name}: ${JSON.stringify(actual)}`);
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
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const badRequests = [];
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().includes('/icons/'))
    badRequests.push(`${r.status()} ${r.url()}`);
});

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

// ---- 商店面板 ----
await page.locator('button', { hasText: /商店/ }).first().click({ timeout: 10000 });
await page.waitForTimeout(6000); // lazy chunk 冷加载，放宽
const shop = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('.shop-card-icon img')];
  return { total: imgs.length, loaded: imgs.filter((i) => i.naturalWidth > 0).length };
});
check('商店面板渲染了真图标 img', shop.total > 0, true);
check('商店图标全部加载成功', shop.loaded, shop.total);
await page
  .screenshot({ path: 'docs/verify/icon-wiring-shop.png' })
  .catch((e) => console.log('商店截图跳过:', e.code));

// 回主菜单（商店自带「← 返回」按钮，Escape 无效）→ 成就面板
await page.locator('button', { hasText: /返回/ }).first().click({ timeout: 10000 });
await page.waitForTimeout(2000);
await page.locator('button', { hasText: /成就/ }).first().click({ timeout: 10000 });
await page.waitForTimeout(6000);
const ach = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('.achievement-card-icon img')];
  return { total: imgs.length, loaded: imgs.filter((i) => i.naturalWidth > 0).length };
});
check('成就面板渲染了真图标 img', ach.total > 0, true);
check('成就图标全部加载成功', ach.loaded, ach.total);
await page
  .screenshot({ path: 'docs/verify/icon-wiring-achievements.png' })
  .catch((e) => console.log('成就截图跳过:', e.code));

check('icons 目录无 404', badRequests.length, 0);

console.log(results.join('\n'));
console.log(`\n${failed ? '❌ 有断言失败' : '✅ 全部通过'}`);
if (badRequests.length) console.log('404 明细:', badRequests.join('\n'));
await browser.close();
process.exit(failed ? 1 : 0);
