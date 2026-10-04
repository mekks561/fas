// 音频素材验证：在真实浏览器里逐个「取回 + 解码」，而不是只看文件头。
// 判据三件事：
//   1) 每个音频 URL 是否 HTTP 200（路径/扩展名与代码一致）
//   2) 浏览器 AudioContext.decodeAudioData 能否解出真实时长/采样率（证明文件真的能播）
//   3) 进入战斗后，PlayCanvas 侧加载音频时有没有 404 / 解码错误
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL_TARGET = process.env.VERIFY_URL || 'http://localhost:5175/';
const EXE =
  process.env.CHROME_PATH ||
  path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe');

// 从磁盘读出应存在的音频清单，避免与代码脱节
function collectAudioFiles() {
  const base = 'public/assets/audio';
  const out = [];
  for (const dir of ['bgm', 'effects', 'ui']) {
    const abs = path.join(base, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).sort()) {
      if (!/\.(ogg|mp3|wav)$/i.test(f)) continue;
      out.push(`/assets/audio/${dir}/${f}`);
    }
  }
  return out;
}

const AUDIO = collectAudioFiles();
const errors = [];
const audioRequests = [];

const browser = await chromium.launch({
  executablePath: fs.existsSync(EXE) ? EXE : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('response', (r) => {
  if (r.url().includes('/assets/audio/')) {
    audioRequests.push({ url: new URL(r.url()).pathname, status: r.status() });
  }
});

await page.goto(URL_TARGET, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(6000);

// ---- 第 1、2 项：逐个取回并解码 ----
const decoded = await page.evaluate(async (urls) => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const results = [];
  for (const u of urls) {
    const rec = { url: u, http: 0, ok: false, duration: 0, sampleRate: 0, channels: 0, error: '' };
    try {
      const res = await fetch(u);
      rec.http = res.status;
      if (!res.ok) {
        rec.error = `HTTP ${res.status}`;
      } else {
        const buf = await res.arrayBuffer();
        const audio = await ctx.decodeAudioData(buf);
        rec.ok = true;
        rec.duration = Math.round(audio.duration * 100) / 100;
        rec.sampleRate = audio.sampleRate;
        rec.channels = audio.numberOfChannels;
      }
    } catch (e) {
      rec.error = String(e && e.message ? e.message : e);
    }
    results.push(rec);
  }
  await ctx.close();
  return results;
}, AUDIO);

// ---- 第 3 项：进入战斗，看 PlayCanvas 加载音频是否报错 ----
const clickByText = async (patterns) => {
  for (const p of patterns) {
    const btn = page.locator('button', { hasText: p }).first();
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 8000 }).catch(() => {});
      return true;
    }
  }
  return false;
};
await clickByText([/开始游戏/, /START/i, /PLAY/i]);
await page.waitForTimeout(3000);
await clickByText([/开始挑战/, /第一关/, /关卡 1/, /LEVEL 1/i]);
await page.waitForTimeout(9000);

// ---- 报告 ----
console.log('\n' + '─'.repeat(88));
console.log(`${'音频文件'.padEnd(38)} ${'HTTP'.padStart(5)} ${'解码'.padStart(5)} ${'时长'.padStart(9)} ${'采样率'.padStart(8)}  声道`);
console.log('─'.repeat(88));

let fail = 0;
for (const r of decoded) {
  const okMark = r.ok ? '✓' : '✗';
  if (!r.ok) fail++;
  console.log(
    `${r.url.replace('/assets/audio/', '').padEnd(38)} ${String(r.http).padStart(5)} ` +
      `${okMark.padStart(6)} ${(r.ok ? r.duration + 's' : r.error.slice(0, 16)).padStart(9)} ` +
      `${(r.ok ? r.sampleRate : '').toString().padStart(8)}  ${r.ok ? r.channels : ''}`
  );
}
console.log('─'.repeat(88));
console.log(`共 ${decoded.length} 个文件，解码失败 ${fail} 个`);

const nonOk = audioRequests.filter((r) => r.status !== 200);
console.log(`\n游戏运行期间对 /assets/audio/ 的请求：${audioRequests.length} 次（非 200：${nonOk.length} 次）`);
for (const r of nonOk.slice(0, 10)) console.log(`  ✗ ${r.status} ${r.url}`);

const audioErrors = errors.filter((e) => /audio|decode|sound|404|Failed to load/i.test(e));
console.log(`\n运行时错误总数：${errors.length}（其中与音频相关：${audioErrors.length}）`);
for (const e of errors.slice(0, 8)) console.log('  ' + e.slice(0, 150));

await browser.close();

const passed = fail === 0 && nonOk.length === 0 && audioErrors.length === 0;
console.log(`\n${passed ? '✓ 全部音频通过：可下载、可解码、运行期无音频报错' : '✗ 存在未通过项'}`);
process.exit(passed ? 0 : 1);
