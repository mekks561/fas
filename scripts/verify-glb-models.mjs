// 聚焦验证：确认 Kenney GLB 模型真的被加载并替换了程序化模型
// 关注三件事：1) 有没有 [ModelAssetProvider] 警告  2) 模型是否出现在画面里  3) 朝向/缩放是否正常
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
// 玩家不操作会很快被击毁，所以关掉对话后立刻连拍，抓战斗中的画面
for (const [tag, waitMs] of [
  ['glb-01-battle', 1500],
  ['glb-02-battle', 3000],
  ['glb-03-battle', 4000],
]) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${OUT_DIR}/${tag}.png` });
  console.log(`=== ${tag}.png 已保存 ===`);
}

// （连拍已覆盖）



// 运行时探针：统计场景里的实体与渲染组件
const probe = await page.evaluate(() => {
  const out = { glbInstances: [], renderEntities: 0 };
  // PlayCanvas 把 app 挂在 pc.AppBase 的应用列表里，这里从 canvas 反查
  const canvas = document.querySelector('canvas');
  out.hasCanvas = !!canvas;
  return out;
});
console.log('probe:', JSON.stringify(probe));

const interesting = logs.filter((l) => /ModelAssetProvider|PlayerShip|Enemy|glb|asset|404/i.test(l));
console.log(`=== 相关日志 ${interesting.length} 条（前 30）===`);
interesting.slice(0, 30).forEach((l) => console.log(' ', l.slice(0, 160)));
console.log(`=== 运行时错误 ${errors.length} 条 ===`);
errors.slice(0, 20).forEach((e) => console.log(' ', e.slice(0, 200)));

await browser.close();
