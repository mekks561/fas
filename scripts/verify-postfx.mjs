// 后处理（bloom / 暗角 / 色彩校正）接线验证。
//
// 背景：VisualEffectSystem（953 行后处理系统）此前整段被注释在 GameScene 的渲染
// 路径外，理由是「可能破坏渲染管线」。真实原因是它按 PlayCanvas 1.x 的 API 写的，
// 迁到 2.x 后有三处致命错（PostEffectQueue 构造签名、只读的 postEffects 属性、
// PostEffect 不再接受 shader）。本脚本验证修复后它确实接管了渲染并且画面正常。
//
// 断言链：
//   进战斗 → 队列已启用 / 效果数 = 3（cinematic: bloom+暗角+色彩校正）
//   → 相机的 renderTarget 已切到离屏缓冲（= 后处理真的在跑，而不是只建了对象）
//   → 画面非黑（游戏区域内采样）
//   → 暗角差分：关掉暗角后四角变亮（结构性验证，排除「场景本来就角落暗」）
//   → bloom 差分：强度 0 vs 3，亮部像素显著增多（排除「建了对象但没画」）
//   → 后处理开启下游戏逻辑仍正常（击杀结算）
//
// 用法：先起 dev server（`npx vite --port 5178`），再
//   VERIFY_URL=http://127.0.0.1:5178/ node scripts/verify-postfx.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VERIFY_URL || 'http://localhost:5178/';
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
const checkTrue = (label, cond, hint = '') => {
  const pass = !!cond;
  results.push({ label, actual: pass, expected: true, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}${hint ? `（${hint}）` : ''}`);
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

// 全屏采样（含 HUD）。太空场景本身很暗，固定小区域容易采到纯黑区，
// 所以亮度统计一律取全屏，再配合「差分对比」排除 UI/场景内容的干扰。
const analyze = async (file) => {
  const buf = await page.screenshot();
  if (file) fs.writeFileSync(path.join(OUT_DIR, file), buf);
  const b64 = buf.toString('base64');
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data: px } = ctx.getImageData(0, 0, c.width, c.height);
    const lum = (i) => (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
    let sum = 0;
    let n = 0;
    let mid = 0; // v > 0.45：中间调
    let content = 0; // v > 0.3：真实画面内容（星星/舰船/HUD），纯 clearColor 不会有
    let glow = 0; // 0.10 ≤ v < 0.45：辉光带——bloom 把亮物周围的暗太空抬进这个区间
    for (let i = 0; i < px.length; i += 4 * 5) {
      const v = lum(i);
      sum += v;
      n++;
      if (v > 0.45) mid++;
      if (v > 0.3) content++;
      if (v >= 0.1 && v < 0.45) glow++;
    }
    return { avg: sum / n, mid, content, glow };
  }, b64);
};

// ───────────────────────── 0. 清档 → 进战斗 ─────────────────────────
console.log('\n===== 0. 清档 → 进战斗 =====');
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load', timeout: 60000 });
await click([/开始游戏/, /Start Game/i]);
await page.waitForTimeout(2500);
await click([/开始挑战/]);
console.log('  已进入战斗，等待引擎与后处理初始化…');
// GameScene 挂载后才初始化引擎与后处理——所以要在进战斗之后等钩子
await page
  .waitForFunction(() => typeof window.__vfxDebug === 'object', null, { timeout: 45000 })
  .catch(() => {});

// ───────────────────────── 1. 队列接管渲染 ─────────────────────────
console.log('\n===== 1. 后处理队列是否真的接管了渲染 =====');
const active = await page.evaluate(() => window.__vfxDebug?.active?.() ?? false);
checkTrue('后处理队列已启用且效果非空', active);

const effectCount = await page.evaluate(() => window.__vfxDebug?.effectCount?.() ?? 0);
check('cinematic 预设入队 3 个效果（bloom+暗角+色彩校正）', effectCount, 3);

const camPost = await page.evaluate(() => window.__vfxDebug?.cameraPostProcessed?.() ?? false);
checkTrue('相机渲染目标已切到离屏缓冲（后处理真的在跑）', camPost);

const cfg = await page.evaluate(() => window.__vfxDebug?.config?.() ?? null);
console.log(
  `  配置：bloom=${cfg?.bloomEnabled} 阈值=${cfg?.bloomThreshold} 强度=${cfg?.bloomStrength} 暗角=${cfg?.vignetteIntensity} 对比=${cfg?.colorCorrectionContrast}`,
);
checkTrue('cinematic 已应用（bloom 阈值 0.7）', cfg?.bloomThreshold === 0.7);
checkTrue('cinematic 已应用（暗角强度 0.8）', cfg?.vignetteIntensity === 0.8);

// ───────────────────────── 2. 关掉剧情遮罩（键盘推进，比猜坐标可靠） ────
console.log('\n===== 2. 关掉剧情对话 =====');
// 对话遮罩监听 Enter/Space/→ 推进；打字机阶段第一击只补完文本。
// 注意对话是在进战斗后**异步**弹出的，所以要先等它出现，再推进到消失且不再出现。
const dialogueGone = async () =>
  (await page.getByText('点击继续').count()) === 0 &&
  (await page.getByText('点击结束').count()) === 0;
const dismissDialogue = async (label) => {
  await page
    .getByText('点击继续')
    .first()
    .waitFor({ state: 'visible', timeout: 20000 })
    .catch(() => {});
  for (let i = 0; i < 24; i++) {
    if (await dialogueGone()) {
      await page.waitForTimeout(2000);
      if (await dialogueGone()) {
        console.log(`  ${label}：对话已全部关闭（第 ${i} 次按键后）`);
        return true;
      }
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(450);
  }
  return false;
};
const dismissed = await dismissDialogue('进战斗后');
check('剧情对话已全部关闭', dismissed, true);

await page.evaluate(() => window.__waveDebug?.godMode?.(true));
await page.waitForTimeout(8000);
// 对话可能有多段，测量前再兜底清一次
if (!(await dialogueGone())) await dismissDialogue('测量前');

// ───────────────────────── 3. 画面非黑 + 暗角差分 ─────────────────────────
console.log('\n===== 3. 画面非黑 + 暗角差分 =====');
const withVignette = await analyze('postfx-01-all-on.png');
console.log(
  `  全开：平均=${withVignette.avg.toFixed(4)} 内容像素=${withVignette.content} 中间调=${withVignette.mid}`,
);
checkTrue(
  '画面有真实内容（>0.3 亮度的像素 > 400，纯 clearColor 不会有）',
  withVignette.content > 400,
  `content=${withVignette.content}`,
);

await page.evaluate(() => window.__vfxDebug?.setVignette?.(false));
await page.waitForTimeout(2500);
const noVignette = await analyze('postfx-02-no-vignette.png');
console.log(`  关暗角：平均=${noVignette.avg.toFixed(4)} 内容像素=${noVignette.content}`);
checkTrue(
  '暗角生效：关掉后整体变亮（差分）',
  noVignette.avg > withVignette.avg,
  `${withVignette.avg.toFixed(4)} → ${noVignette.avg.toFixed(4)}`,
);
await page.evaluate(() => window.__vfxDebug?.setVignette?.(true));
await page.waitForTimeout(1200);

// ───────────────────────── 4. bloom 差分（低阈值 + 强度 0 vs 3） ───────────────
console.log('\n===== 4. bloom 差分（验证亮部提取→模糊→合成管线真的在画） =====');
// cinematic 的阈值 0.7 在暗太空场景里几乎没有像素达标（只有零星的星星），
// bloom 效果被稀释到测不出来。差分时把阈值临时降到 0.25，让岩石/星云都参与
// 亮部提取——这测的是同一条管线，只是参数放大到可测量的程度。
await page.evaluate(() => window.__vfxDebug?.setBloomThreshold?.(0.25));
await page.evaluate(() => window.__vfxDebug?.setBloomStrength?.(0));
await page.waitForTimeout(2500);
const noBloom = await analyze('postfx-03-bloom-strength-0.png');
await page.evaluate(() => window.__vfxDebug?.setBloomStrength?.(3));
await page.waitForTimeout(2500);
const strongBloom = await analyze('postfx-04-bloom-strength-3.png');
console.log(
  `  强度0：平均=${noBloom.avg.toFixed(4)} 中间调=${noBloom.mid} 辉光带=${noBloom.glow} ｜ 强度3：平均=${strongBloom.avg.toFixed(4)} 中间调=${strongBloom.mid} 辉光带=${strongBloom.glow}`,
);
checkTrue(
  'bloom 确实在画（辉光带像素增多：亮物周围的暗太空被抬亮）',
  strongBloom.glow > noBloom.glow,
  `0→${noBloom.glow} 3→${strongBloom.glow}`,
);
checkTrue(
  'bloom 只增不减（强度 3 时平均亮度更高）',
  strongBloom.avg > noBloom.avg,
  `${noBloom.avg.toFixed(4)} → ${strongBloom.avg.toFixed(4)}`,
);
await page.evaluate(() => window.__vfxDebug?.setBloomThreshold?.(0.7));
await page.evaluate(() => window.__vfxDebug?.setBloomStrength?.(0.5));
await page.waitForTimeout(1000);

// ───────────────────────── 5. 游戏逻辑仍正常 ─────────────────────────
console.log('\n===== 5. 后处理开启下游戏逻辑仍正常 =====');
const aliveBefore = await page.evaluate(() => window.__waveDebug?.getState?.()?.aliveEnemies ?? -1);
await page.evaluate(() => window.__waveDebug?.killOne?.(0));
await page.waitForTimeout(2500);
const stateAfter = await page.evaluate(() => window.__waveDebug?.getState?.() ?? null);
console.log(
  `  存活敌机：${aliveBefore} → ${stateAfter?.aliveEnemies}（波次 ${stateAfter?.wave}）`,
);
checkTrue(
  '击杀结算仍正常（存活敌机减少）',
  stateAfter !== null && stateAfter.aliveEnemies < aliveBefore,
  `${aliveBefore} → ${stateAfter?.aliveEnemies}`,
);

const finalActive = await page.evaluate(() => window.__vfxDebug?.active?.() ?? false);
checkTrue('全流程结束后后处理仍处于启用状态', finalActive);
await analyze('postfx-05-final.png');

// ───────────────────────── 汇总 ─────────────────────────
console.log('\n════════════════════ 汇总 ════════════════════');
const passed = results.filter((r) => r.pass).length;
console.log(`通过 ${passed}/${results.length}`);
const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.log('\n失败项：');
  for (const f of failed) console.log(`  ❌ ${f.label}`);
}
const realErrors = errors.filter(
  (e) =>
    !e.includes('favicon') &&
    !e.includes('DevTools') &&
    !e.includes('Webpack') &&
    !e.includes('Slow network') &&
    !e.includes('the server responded with a status'),
);
checkTrue('运行时错误为 0（含着色器/纹理回落告警）', realErrors.length === 0, realErrors[0] ?? '');
console.log(`\n运行时错误 ${realErrors.length} 条`);
if (realErrors.length > 0) console.log(realErrors.slice(0, 5).join('\n'));

await browser.close();
process.exit(passed === results.length ? 0 : 1);
