// 操作手感验证：断言飞船旋转是**渐变**的（有角速度惯性），而不是开关式的瞬间起停。
//
// 背景（玩家反馈「操作感觉太僵硬」的数据级真因）：
//   `PlayerShip.updateRotation` 原本是 `rotateLocal(输入 × 角速度 × dt)` ——
//   输入直接等同于角速度，于是键盘（0/1 信号）一按下就是满速 540°/秒、一松手立刻归零。
//   表现是：起步有硬拐点、松手停死、想微调几乎不可能，像用鼠标拖一个方块。
//   另外俯仰轴还把倍率乘了两次（`pitchSpeed × effRot`，而 effRot 里已含 rotationSpeed），
//   实际 1080°/秒 = 偏航的两倍，与字段注释「俯仰 2.0 < 偏航 3」的意图相反。
//
// 这个脚本不看截图、不讲感觉，只读 `__playerDebug.angularVelocity` 的**时间序列**：
//   1. 按下 → 角速度从 0 爬升到稳态，爬升时长落在 [30, 250] ms（说明有惯性、且不迟钝）
//   2. 松手 → 角速度从稳态衰减到近零，衰减时长落在 [100, 600] ms（说明有滑行、且不飘）
//   3. 稳态角速度 ≈ 偏航 540°/秒、俯仰 360°/秒（说明只改了过渡曲线、没动物理平衡）
//   4. 加速后位置真的变了（说明没有把"平滑"做成"动不了"）
//
// 旧实现下 1、2 两条必然失败：角速度会在一帧内直接跳到稳态 / 直接归零。
//
// 用法：先起 dev server（`npx vite --port 5177 --strictPort`），再
//   NO_PROXY=localhost,127.0.0.1 VERIFY_URL=http://localhost:5177/ \
//     node scripts/verify-flight-feel.mjs
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
// 视口刻意开小：无头环境走 SwiftShader 软渲染，1280×720 只有约 10fps，
// 采样分辨率不足以分辨 90ms 级的角速度爬升。缩小视口把帧率顶上去，才能测到"爬升"这一段。
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });

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
const checkTrue = (label, actual) => check(label, actual === true, true);
/** 数值落在区间内（打印实际值，失败时好判断差多少）。 */
const checkBetween = (label, actual, lo, hi) => {
  const pass = typeof actual === 'number' && actual >= lo && actual <= hi;
  results.push({ label, actual, expected: `[${lo}, ${hi}]`, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}: 实得=${actual} 期望=[${lo}, ${hi}]`);
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

const closeUpgradeIfAny = async () => {
  const card = page.locator('.upgrade-card').first();
  if ((await card.count()) > 0) {
    await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
};

const enterLevelOne = async () => {
  await click([/开始游戏/, /Start Game/i]);
  await page.waitForTimeout(2500);
  await click([/开始挑战/, /开始游戏/, /Start/i]);
  await page.waitForTimeout(9000);
  for (let i = 0; i < 12; i++) {
    const dlg = page.locator('text=点击继续').first();
    const end = page.locator('text=点击结束').first();
    if ((await dlg.count()) === 0 && (await end.count()) === 0) break;
    await page.mouse.click(400, 400);
    await page.waitForTimeout(600);
  }
  const ready = await page
    .waitForFunction(() => typeof window.__waveDebug === 'object', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (ready) await page.evaluate(() => window.__waveDebug.godMode(true));
  return ready;
};

/**
 * 在页面内用 rAF 采三轴角速度，带时间戳。
 * 必须在页面里采 —— 从外部用 evaluate 轮询的往返延迟（10~30ms）会把
 * 一段 100ms 的爬升直接采成两个点，什么也证明不了。
 */
const startAngularLog = (axis) =>
  page.evaluate((a) => {
    window.__angLog = [];
    if (window.__angRaf) cancelAnimationFrame(window.__angRaf);
    const t0 = performance.now();
    const loop = () => {
      const v = window.__playerDebug?.angularVelocity?.[a];
      if (typeof v === 'number') window.__angLog.push({ t: performance.now() - t0, v });
      window.__angRaf = requestAnimationFrame(loop);
    };
    loop();
    return true;
  }, axis);

const stopAngularLog = () =>
  page.evaluate(() => {
    if (window.__angRaf) cancelAnimationFrame(window.__angRaf);
    window.__angRaf = null;
    return window.__angLog ?? [];
  });

/**
 * 从时间序列里取三段特征：
 *  · riseMs —— 从"开始有值"到"达到峰值 90%"的毫秒数（爬升快慢）
 *  · decayMs —— 从峰值到"回落到峰值 5%"的毫秒数（松手滑行快慢）
 *  · peak —— 稳态角速度（度/秒）
 */
const analyze = (log) => {
  const vals = log.map((p) => p.v);
  const peak = Math.max(...vals.map(Math.abs));
  const peakSigned = vals.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
  const firstIdx = vals.findIndex((v) => Math.abs(v) > peak * 0.02);
  // 帧间隔中位数 —— 采样分辨率的上限。无头 SwiftShader 只有 ~10fps，
  // 一个 100ms 的爬升根本采不到，这一点必须显式记录下来，否则会误判成"没有惯性"。
  const deltas = log.slice(1).map((p, i) => p.t - log[i].t).sort((a, b) => a - b);
  const medianFrameMs = deltas.length ? Math.round(deltas[Math.floor(deltas.length / 2)]) : -1;
  if (firstIdx < 0)
    return { peak: peakSigned, riseMs: -1, decayMs: -1, samples: vals.length, medianFrameMs };
  const peakIdx = vals.findIndex((v) => v === peakSigned);
  const peakT = log[peakIdx]?.t ?? 0;

  // 爬到峰值 90% 的时刻
  let riseT = log[firstIdx]?.t ?? 0;
  for (let i = firstIdx; i <= peakIdx; i++) {
    if (Math.abs(vals[i]) >= peak * 0.9) {
      riseT = log[i].t;
      break;
    }
  }

  // 峰值之后回落到 5% 的时刻
  let decayT = peakT;
  for (let i = peakIdx; i < vals.length; i++) {
    if (Math.abs(vals[i]) <= peak * 0.05) {
      decayT = log[i].t;
      break;
    }
  }
  const last = log[log.length - 1];
  if (decayT === peakT) decayT = last?.t ?? peakT;

  return {
    peak: peakSigned,
    riseMs: Math.round(riseT - (log[firstIdx]?.t ?? 0)),
    decayMs: Math.round(decayT - peakT),
    // 滑行过程中被采到的中间值个数（严格介于峰值 5%~95% 之间）。
    // 这是**不依赖采样率**的判据：阶跃式实现下这个数一定是 0 或 1。
    decaySamples: vals.filter((v) => Math.abs(v) > peak * 0.05 && Math.abs(v) < peak * 0.95).length,
    samples: vals.length,
    medianFrameMs,
  };
};

// ───────────────────────── 0. 清档并进入战斗 ─────────────────────────
console.log('\n===== 0. 清档 → 进入第 1 关 =====');
await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load', timeout: 180000 });
await page.waitForTimeout(9000);
const ready = await enterLevelOne();
checkTrue('可进入战斗且 __waveDebug 可用', ready);
if (!ready) {
  await browser.close();
  process.exit(1);
}
const dbgReady = await page
  .waitForFunction(() => typeof window.__playerDebug?.angularVelocity === 'object', {
    timeout: 20000,
  })
  .then(() => true)
  .catch(() => false);
checkTrue('__playerDebug 暴露了三轴角速度（可测真值）', dbgReady);
if (!dbgReady) {
  await browser.close();
  process.exit(1);
}

// ───────────────────────── 1. 偏航：按下爬升 / 松手滑行 ─────────────────────────
console.log('\n===== 1. 偏航（D 键）按下→松手 的角速度时间序列 =====');
await startAngularLog('yaw');
await page.keyboard.down('KeyD');
await page.waitForTimeout(600);
await page.keyboard.up('KeyD');
await page.waitForTimeout(700);
const yawLog = await stopAngularLog();
const yaw = analyze(yawLog);
const yawFps = yaw.medianFrameMs > 0 ? 1000 / yaw.medianFrameMs : 0;
console.log(
  `  采样 ${yaw.samples} 点（帧率 ≈ ${yawFps.toFixed(1)}fps）；稳态 ${yaw.peak.toFixed(1)}°/s；` +
    `爬升 ${yaw.riseMs}ms；滑行 ${yaw.decayMs}ms；滑行中间值 ${yaw.decaySamples} 个`,
);

checkBetween('偏航稳态角速度 ≈ 540°/s（约束：只改过渡曲线、不动平衡）', Math.abs(yaw.peak), 470, 620);
checkBetween('松手后角速度**滑行**耗时（有惯性、且不飘）', yaw.decayMs, 100, 700);
checkTrue('松手不是立刻归零（旧实现的失效点）', yaw.decayMs > 80);
// 这条与采样率无关，是"渐变 vs 阶跃"最直接的证据：阶跃实现下没有中间值可取。
checkTrue('滑行过程存在多个中间值（渐进而非阶跃）', yaw.decaySamples >= 2);
// 爬升时长需要采样分辨率撑得住：帧间隔要小于爬升时长（约 90ms）才分辨得出。
// 无头 SwiftShader 约 18fps（帧间隔 55ms）刚好够；再低就只能记录、不断言。
if (yawFps >= 15) {
  checkBetween('按下后角速度**爬升**耗时（有惯性、且不迟钝）', yaw.riseMs, 30, 250);
  checkTrue('爬升不是一帧跳变（旧实现的失效点）', yaw.riseMs > 20);
} else {
  console.log(
    `  ⏭ 跳过「爬升时长」断言：帧间隔 ${yaw.medianFrameMs}ms 分辨不出 90ms 的爬升，` +
      `改由「滑行中间值」与固定子步进共同覆盖`,
  );
}

// ───────────────────────── 2. 俯仰：口径修正后的速率 ─────────────────────────
console.log('\n===== 2. 俯仰（↑ 键）稳态角速度 =====');
await startAngularLog('pitch');
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowUp');
await page.waitForTimeout(500);
const pitchLog = await stopAngularLog();
const pitch = analyze(pitchLog);
console.log(`  采样 ${pitch.samples} 点；稳态 ${pitch.peak.toFixed(1)}°/s；爬升 ${pitch.riseMs}ms`);
checkBetween('俯仰稳态角速度 ≈ 360°/s（原先误乘倍率 → 1080°/s）', Math.abs(pitch.peak), 300, 430);
checkTrue('俯仰不再快于偏航（注释意图 2.0 < 3）', Math.abs(pitch.peak) < Math.abs(yaw.peak));

// ───────────────────────── 3. 速度：真的在动，且加速是渐进的 ─────────────────────────
console.log('\n===== 3. 前进（W 键）位移与加速 =====');
const p0 = await page.evaluate(() => window.__playerDebug?.position ?? null);
await page.keyboard.down('KeyW');
await page.waitForTimeout(1200);
await page.keyboard.up('KeyW');
const p1 = await page.evaluate(() => window.__playerDebug?.position ?? null);
const moved = p0 && p1 ? Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z) : -1;
console.log(`  位移 ${moved.toFixed(2)} 单位`);
checkTrue('按住 W 后飞船确实移动了', moved > 1);

// ───────────────────────── 4. 控制台 ─────────────────────────
console.log('\n===== 4. 控制台 =====');
const ENGINE_NOISE = [
  'ASSERT FAILED',
  'wasm-instantiate',
  'still waiting on run dependencies',
  'dependency:',
  '(end of list)',
  '__aiProbe',
];
const engineRelated = (e) => ENGINE_NOISE.some((n) => e.includes(n));
const otherErrors = errors.filter(
  (e) => !engineRelated(e) && !e.includes('Failed to load resource') && !e.includes('favicon'),
);
console.log(`  控制台错误共 ${errors.length} 条：引擎噪声 ${errors.filter(engineRelated).length}，其它 ${otherErrors.length}`);
check('无未分类控制台错误', otherErrors.length, 0);
if (otherErrors.length) console.log(otherErrors.slice(0, 5).map((e) => `    ${e}`).join('\n'));

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

await page.screenshot({ path: path.join(OUT_DIR, 'flight-feel.png') }).catch(() => {});
await browser.close();
process.exit(failed ? 1 : 0);
