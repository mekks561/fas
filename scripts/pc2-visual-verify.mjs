// PlayCanvas 2 迁移后的画面验证脚本（临时工具）
// 用途：真实加载游戏，抓运行时异常，并截图供人工/多模态核对画面。
// 注意：WebGL canvas 不能用 drawImage 取样（preserveDrawingBuffer 默认关闭），
//      因此画面判定一律以截图为准。
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
  if (m.type() === 'error') errors.push(line);
  logs.push(line);
});
page.on('pageerror', (e) =>
  errors.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`),
);

console.log('打开:', URL);
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(12000);

const snap = async (tag) => {
  const info = await page.evaluate(() => {
    const cs = Array.from(document.querySelectorAll('canvas'));
    return {
      title: document.title,
      canvasCount: cs.length,
      canvasSizes: cs.map((c) => `${c.width}x${c.height}`),
      bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
      buttons: Array.from(document.querySelectorAll('button'))
        .map((b) => b.innerText.trim())
        .filter(Boolean)
        .slice(0, 24),
    };
  });
  await page.screenshot({ path: `${OUT_DIR}/${tag}.png` });
  console.log(`=== ${tag} ===`);
  console.log(JSON.stringify(info, null, 2));
  return info;
};

const initial = await snap('01-initial');

// 进入游戏：主菜单 -> 关卡选择 -> 开始挑战 -> 3D 场景
const clickByText = async (patterns, tag) => {
  for (const p of patterns) {
    const btn = page.locator('button', { hasText: p }).first();
    if ((await btn.count()) > 0) {
      const label = await btn.innerText().catch(() => '');
      console.log(`[${tag}] 点击: ${label.replace(/\s+/g, ' ')}`);
      await btn.click({ timeout: 8000 }).catch((e) => console.log('点击失败:', e.message));
      return true;
    }
  }
  console.log(`[${tag}] 未找到匹配按钮`);
  return false;
};

await clickByText([/开始游戏/, /START/i, /PLAY/i, /新游戏/i], 'menu');
await page.waitForTimeout(4000);
await snap('02-level-select');

await clickByText([/开始挑战/, /挑战/, /START/i, /^开始$/], 'level');
await page.waitForTimeout(15000);
await snap('03-gameplay');
await page.waitForTimeout(12000);
await snap('04-gameplay-later');

console.log(`=== 运行时错误 ${errors.length} 条 ===`);
errors.slice(0, 40).forEach((e) => console.log(e));
console.log('=== 控制台尾部 35 行 ===');
logs.slice(-35).forEach((l) => console.log(l));

await browser.close();
