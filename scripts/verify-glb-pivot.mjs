// 视觉验证：GLB pivot 修复后的飞船位置与朝向。
// 1) 截玩家舰特写（第三人称相机正对玩家）——修复前模型悬在偏移位置
// 2) 截敌人入镜画面——确认敌舰也居中、机头朝向合理
// 3) 收集 [ModelAssetProvider] 替换日志与加载失败告警
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VERIFY_URL || 'http://localhost:5177/';
const EXE =
  process.env.CHROME_PATH ||
  path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe');
const OUT_DIR = 'docs/verify';
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: fs.existsSync(EXE) ? EXE : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const gotoWithRetry = async () => {
  for (let i = 1; i <= 3; i++) {
    try {
      await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
      return;
    } catch (e) {
      console.log(`goto 第 ${i} 次失败: ${e.message.split('\n')[0]}`);
      if (i === 3) throw e;
    }
  }
};

await gotoWithRetry();
await page.waitForTimeout(10000);

const click = async (patterns, tag) => {
  for (const p of patterns) {
    // 先 button，再按可见文本兜底（「开始挑战」是 div 而非 button）
    let el = page.getByRole('button', { name: p }).first();
    if ((await el.count()) === 0) el = page.getByText(p, { exact: true }).first();
    if ((await el.count()) > 0) {
      console.log(`[${tag}] 点击: ${(await el.innerText().catch(() => '')).replace(/\s+/g, ' ')}`);
      await el.click({ timeout: 8000 }).catch(() => {});
      return true;
    }
  }
  console.log(`[${tag}] 未找到按钮`);
  return false;
};

await click([/开始游戏/, /START/i, /PLAY/i], 'menu');
await page.waitForTimeout(3500);
await click([/开始挑战/, /挑战/, /^开始$/], 'level');
await page
  .waitForFunction(() => Boolean(window.__waveDebug?.godMode), null, { timeout: 30000 })
  .catch(() => console.log('[warn] __waveDebug 未注册'));
await page.evaluate(() => window.__waveDebug?.godMode(true)).catch(() => {});
await page.waitForTimeout(9000);

// 跳过剧情对话
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

// 等模型替换完成
await page
  .waitForFunction(
    () => document.querySelectorAll('[class*=task], [class*=mission]').length >= 0,
    null,
    { timeout: 1000 },
  )
  .catch(() => {});

for (const [tag, waitMs] of [
  ['pivot-01-battle', 2000],
  ['pivot-02-later', 4000],
]) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${OUT_DIR}/${tag}.png` });
  console.log(`=== ${tag}.png 已保存 ===`);
}

// 朝向验证：W 加速前进 + D 右转，连拍——机头应指向飞行方向
await page.keyboard.down('KeyW');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT_DIR}/pivot-03-forward-a.png` });
await page.keyboard.down('KeyD');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT_DIR}/pivot-04-forward-b.png` });
await page.keyboard.up('KeyD');
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT_DIR}/pivot-05-turn.png` });
await page.keyboard.up('KeyW');
console.log('=== 前进/转向连拍已保存 ===');

// 姿态实测：GLB 几何机头（局部 -Z）经世界矩阵变换后应与实体 forward 同向
await page.waitForTimeout(500);
const pose = await page.evaluate(() => window.__waveDebug?.getPlayerPose?.() ?? null);
if (!pose || !pose.nose) {
  console.log('⚠ 未取到玩家姿态（钩子未注册或模型未替换）');
  process.exitCode = 1;
} else {
  const dot = pose.forward.reduce((s, v, i) => s + v * pose.nose[i], 0);
  const fw = pose.forward.map((v) => v.toFixed(2)).join(',');
  const ns = pose.nose.map((v) => v.toFixed(2)).join(',');
  const pos = pose.pos.map((v) => v.toFixed(1)).join(',');
  console.log(`forward=(${fw})  机头=(${ns})  点积=${dot.toFixed(3)}  pos=(${pos})  speed=${pose.speed}`);
  if (dot > 0.9) {
    console.log('✓ 机头与前进方向同向（对齐）');
  } else {
    console.log(`✗ 机头与前进方向 ${dot > 0 ? '夹角过大' : '相反（倒飞）'}`);
    process.exitCode = 1;
  }
}

const modelLogs = logs.filter((l) => l.includes('ModelAssetProvider') || l.includes('pageerror'));
console.log('=== 模型相关日志 ===');
for (const l of modelLogs.slice(0, 20)) console.log(l);
const runtimeErrors = logs.filter((l) => l.includes('pageerror') || l.startsWith('[error]'));
console.log(`=== 运行时错误数: ${runtimeErrors.length} ===`);
for (const l of runtimeErrors.slice(0, 5)) console.log(l);

await browser.close();
