// 聚焦验证：确认 Kenney GLB 模型真的被加载并替换了程序化模型。
// 覆盖三类资产：玩家舰/敌人（上轮）、场景结构物（小行星带 / 空间站 / 卫星，本轮）。
// 关注四件事：1) 有没有 [ModelAssetProvider] 警告（加载失败）2) 替换日志是否齐全
//            3) /assets/models/ 的网络请求状态   4) 运行时错误
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VERIFY_URL || 'http://localhost:5175/';
const EXE =
  process.env.CHROME_PATH ||
  path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe');
const OUT_DIR = 'docs/verify';
fs.mkdirSync(OUT_DIR, { recursive: true });

const errors = [];
const logs = [];
/** 模型文件请求记录：url -> { status, bytes } */
const modelRequests = new Map();

const browser = await chromium.launch({
  executablePath: fs.existsSync(EXE) ? EXE : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  const line = `[${m.type()}] ${m.text()}`;
  logs.push(line);
  if (m.type() === 'error') errors.push(line);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('response', async (res) => {
  const url = res.url();
  if (!url.includes('/assets/models/')) return;
  let bytes = 0;
  try {
    const len = res.headers()['content-length'];
    bytes = len ? Number(len) : (await res.body().catch(() => Buffer.alloc(0))).length;
  } catch {
    bytes = 0;
  }
  modelRequests.set(url.replace(/^https?:\/\/[^/]+/, ''), { status: res.status(), bytes });
});
page.on('requestfailed', (req) => {
  if (req.url().includes('/assets/models/')) {
    errors.push(`[requestfailed] ${req.url()} — ${req.failure()?.errorText}`);
  }
});

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const click = async (patterns, tag) => {
  for (const p of patterns) {
    const btn = page.locator('button', { hasText: p }).first();
    if ((await btn.count()) > 0) {
      console.log(`[${tag}] 点击: ${(await btn.innerText()).replace(/\s+/g, ' ')}`);
      await btn.click({ timeout: 8000 }).catch(() => {});
      return true;
    }
  }
  console.log(`[${tag}] 未找到按钮`);
  return false;
};

await click([/开始游戏/, /START/i, /PLAY/i], 'menu');
await page.waitForTimeout(3500);
await click([/开始挑战/, /挑战/, /^开始$/], 'level');
// 场景一就绪就开无敌：玩家在剧情对话期间就会被敌方火力击毁，
// 等对话跳完再开 godMode 就来不及了（结算界面都出来了）。
// __waveDebug 由 GameScene 在初始化完成后注册，轮询等待它出现。
await page
  .waitForFunction(() => Boolean(window.__waveDebug?.godMode), null, { timeout: 30000 })
  .catch(() => console.log('[warn] __waveDebug 未注册（非 DEV 构建？）'));
await page.evaluate(() => window.__waveDebug?.godMode(true)).catch(() => {});
await page.waitForTimeout(9000);

// 跳过剧情对话：「点击继续」会推进，「点击结束」会关闭，两种都要处理
for (let i = 0; i < 12; i++) {
  const dlg = page.locator('text=点击继续').first();
  const end = page.locator('text=点击结束').first();
  if ((await end.count()) > 0) {
    await page.mouse.click(640, 560);
    await page.waitForTimeout(900);
    continue;
  }
  if ((await dlg.count()) === 0) break;
  await page.mouse.click(640, 560);
  await page.waitForTimeout(900);
}
// 玩家不操作会很快被击毁（GameScene 一卸载 canvas 就没了）。
// DEV 构建下用 __waveDebug.godMode 开无敌，从容抓战斗画面。
await page.evaluate(() => {
  window.__waveDebug?.godMode?.();
}).catch(() => {});
for (const [tag, waitMs] of [
  ['glb-01-battle', 1500],
  ['glb-02-battle', 3000],
  ['glb-03-battle', 4000],
]) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${OUT_DIR}/${tag}.png` });
  console.log(`=== ${tag}.png 已保存 ===`);
}

// 把飞船往回带一段，让小行星带与远处结构物进入视野
for (let i = 0; i < 6; i++) {
  await page.keyboard.down('KeyS').catch(() => {});
  await page.waitForTimeout(280);
}
await page.keyboard.up('KeyS').catch(() => {});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT_DIR}/glb-structures-wide.png` });
console.log('=== glb-structures-wide.png 已保存 ===');

// ---------- 断言 ----------
console.log('\n========== 模型加载实证 ==========');

const replaced = (prefix) =>
  logs
    .filter((l) => l.includes('[ModelAssetProvider]') && l.includes(`${prefix}/`) && l.includes('已替换程序化模型'))
    .map((l) => l.match(/\[ModelAssetProvider\] (\S+?)\.glb 已替换/)?.[1])
    .filter(Boolean);

const shipReplaced = replaced('ships');
const enemyReplaced = replaced('enemies');
const bossReplaced = replaced('bosses');
const structReplaced = replaced('structures');

const entityCount = (list) => list.length;
const distinctCount = (list) => new Set(list).size;

console.log(`玩家舰     : ${entityCount(shipReplaced)} 个实体替换，${distinctCount(shipReplaced)} 种模型`);
console.log(`敌人       : ${entityCount(enemyReplaced)} 个实体替换，${distinctCount(enemyReplaced)} 种模型`);
console.log(`Boss       : ${entityCount(bossReplaced)} 个实体替换，${distinctCount(bossReplaced)} 种模型`);
console.log(`场景结构物 : ${entityCount(structReplaced)} 个实体替换，${distinctCount(structReplaced)} 种模型`);
if (structReplaced.length > 0) {
  const byFile = {};
  for (const f of structReplaced) byFile[f] = (byFile[f] || 0) + 1;
  console.log('  结构物明细:', JSON.stringify(byFile, null, 0));
}

console.log('\n========== 模型文件网络请求 ==========');
const sorted = [...modelRequests.entries()].sort();
let totalBytes = 0;
for (const [url, info] of sorted) {
  totalBytes += info.bytes;
  console.log(`  ${String(info.status).padEnd(4)} ${(info.bytes / 1024).toFixed(1).padStart(8)} KB  ${url}`);
}
console.log(`  共 ${sorted.length} 个文件，${(totalBytes / 1024).toFixed(1)} KB`);

const structRequests = sorted.filter(([u]) => u.includes('/structures/'));
console.log(`  其中结构物 ${structRequests.length} 个`);

const failures = logs.filter((l) => l.includes('[ModelAssetProvider]') && /警告|失败/.test(l));
console.log(`\n========== 加载失败警告 ${failures.length} 条 ==========`);
failures.slice(0, 10).forEach((l) => console.log(' ', l.slice(0, 180)));

console.log(`\n========== 运行时错误 ${errors.length} 条 ==========`);
errors.slice(0, 20).forEach((e) => console.log(' ', e.slice(0, 220)));

// ---------- 结论 ----------
const ok =
  structReplaced.length > 0 &&
  structRequests.length > 0 &&
  structRequests.every(([_, i]) => i.status === 200) &&
  failures.length === 0 &&
  errors.length === 0;
console.log(`\n结论：${ok ? '✅ 通过' : '❌ 未通过'}`);

await browser.close();
process.exit(ok ? 0 : 1);
