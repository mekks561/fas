#!/usr/bin/env node
/**
 * 一键部署到 NAS（OMV + nginx:alpine 容器）。
 *
 * 为什么需要脚本而不是「scp 一下」：
 *   1. 产物是 5.3 万个小文件（496MB）。**逐个 scp 会跑几十分钟**，必须打成单流 tar.gz
 *      （实测 307MB / 6 秒）。本脚本走 `ssh "cat > file"` + 本地文件描述符作 stdin，
 *      不依赖 shell 重定向，Windows Git Bash 下同样可靠。
 *   2. 静态站的 bind mount 指的是**目录 inode**。直接 `mv 新目录 旧目录` 后容器仍读旧 inode，
 *      表现为「部署成功但页面没变」。所以这里换完目录必须 `docker restart` 重新解析挂载。
 *   3. 覆盖式解压会让带 hash 的旧资源无限堆积。本脚本解压到 `site.new` 再整体切换，
 *      并保留 `site.bak` 供回滚。
 *
 * 用法：
 *   node scripts/deploy-nas.mjs              # 构建 + 传输 + 切换 + 验证
 *   node scripts/deploy-nas.mjs --no-build   # 复用现有 dist/
 *   node scripts/deploy-nas.mjs --dry-run    # 只构建打包看体积，不碰 NAS
 *
 * 环境变量覆盖：NAS_HOST / NAS_DIR / NAS_URL / NAS_CONTAINER / KEEP_BACKUP=0
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const NAS_HOST = process.env.NAS_HOST || 'nas';
const NAS_DIR =
  process.env.NAS_DIR ||
  '/srv/dev-disk-by-uuid-8d43c6ec-3d38-4665-b552-dd1287a5501c/l4d2/docker/fighter-game';
const NAS_URL = process.env.NAS_URL || 'http://192.168.1.45:8095/';
const CONTAINER = process.env.NAS_CONTAINER || 'fighter-game';
const KEEP_BACKUP = process.env.KEEP_BACKUP !== '0';

const argv = process.argv.slice(2);
const doBuild = !argv.includes('--no-build');
const dryRun = argv.includes('--dry-run');

let stepNo = 0;
const step = (msg) => console.log(`\n[${++stepNo}] ${msg}`);
const info = (msg) => console.log(`    ${msg}`);
const die = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

/** 跑外部命令，失败即中止（部署链任何一步失败都不该继续往下切目录）。 */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
  if (r.error) die(`执行 ${cmd} 失败：${r.error.message}`);
  if (r.status !== 0) die(`${cmd} 退出码 ${r.status}`);
}

/** 跑命令并取 stdout（用于远端校验与探测）。 */
function capture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts });
  if (r.error) die(`执行 ${cmd} 失败：${r.error.message}`);
  if (r.status !== 0) die(`${cmd} 退出码 ${r.status}\n${r.stderr || ''}`);
  return (r.stdout || '').trim();
}

/** 把本地脚本/数据通过 fd 直连 ssh 的 stdin —— 绕开 shell 重定向。 */
function pipeFileToRemote(localFile, remoteCmd, mode) {
  const fd = fs.openSync(localFile, mode);
  try {
    const r = spawnSync('ssh', [NAS_HOST, remoteCmd], { stdio: [fd, 'inherit', 'inherit'] });
    if (r.error) die(`ssh 失败：${r.error.message}`);
    if (r.status !== 0) die(`远端命令退出码 ${r.status}`);
  } finally {
    fs.closeSync(fd);
  }
}

// ───────────────────────── 1. 构建 ─────────────────────────
step('生产构建');
if (doBuild) {
  // Vite 的 emptyOutDir 删 45 万文件要 20 分钟，远不如先 POSIX 删除（14 秒）。
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
  info('dist/ 已清空（POSIX 删除，避免 Vite emptyOutDir 卡住）');
  run('npx', ['vite', 'build'], { shell: process.platform === 'win32' });
} else {
  info('跳过构建（--no-build）');
}
if (!fs.existsSync(path.join(DIST, 'index.html'))) die('dist/index.html 不存在，构建没产出产物');

const assetsDir = path.join(DIST, 'assets');
const wasm = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).filter((f) => f.endsWith('.wasm'))
  : [];
if (wasm.length === 0) {
  // 这是 2026-10-12 修过的缺陷：wasmoon 不带 wasm 就会去 unpkg 取，断网即整条 Lua 静默死掉。
  die('dist/assets 里没有 .wasm —— Lua 运行时的 wasm 没随包发布，部署上去等于 Lua 全废');
}
info(`wasm 随包发布：${wasm.join(', ')}`);

// ───────────────────────── 2. 打包 ─────────────────────────
step('打包单流 tar.gz');
// 归档名必须走**相对路径**：GNU tar 会把 `C:\...` 当成 `host:path`（远程归档语法），
// 报 "Cannot connect to C: resolve failed"。`-C` 同理，用相对名 + cwd=ROOT。
const tarName = `.deploy-dist-${Date.now()}.tar.gz`;
const tarPath = path.join(ROOT, tarName);
run('tar', ['-czf', tarName, '-C', 'dist', '.']);
const tarMB = (fs.statSync(tarPath).size / 1024 / 1024).toFixed(1);
const fileCount = fs
  .readdirSync(DIST, { recursive: true })
  .filter((f) => fs.statSync(path.join(DIST, f)).isFile()).length;
info(`dist → ${tarMB}MB / ${fileCount} 个文件`);

const localMd5 = capture('md5sum', [tarName]).split(/\s+/)[0];
info(`md5 ${localMd5}`);

if (dryRun) {
  step('--dry-run：跳过传输与切换');
  fs.rmSync(tarPath, { force: true });
  console.log('\n✓ dry-run 完成，NAS 未改动');
  process.exit(0);
}

// ───────────────────────── 3. 传输 ─────────────────────────
step(`传输到 ${NAS_HOST}`);
const remoteTar = `${NAS_DIR}/.deploy-${Date.now()}.tar.gz`;
const t0 = Date.now();
pipeFileToRemote(tarPath, `cat > '${remoteTar}'`, 'r');
const secs = ((Date.now() - t0) / 1000).toFixed(1);
fs.rmSync(tarPath, { force: true });
info(`单流传输完成 ${secs}s（${(Number(tarMB) / Number(secs)).toFixed(1)}MB/s）`);

// ───────────────────────── 4. 远端切换 ─────────────────────────
step('远端校验 + 解压 + 切换目录');
const remoteScript = `set -euo pipefail
D='${NAS_DIR}'
T='${remoteTar}'
cd "$D"

# 4.1 校验完整性 —— 传输截断必须在这里挡住，不能切上去才发现
echo "${localMd5}  $T" | md5sum -c - >/dev/null
echo "    md5 双端一致"

# 4.2 解压到新目录（不动现网，失败也不影响线上）
rm -rf site.new
mkdir -p site.new
tar -xzf "$T" -C site.new
rm -f "$T"

# 4.3 产物自检：入口 + 带 hash 的 assets + wasm
test -f site.new/index.html || { echo "    ✗ 新产物缺 index.html"; exit 1; }
test -d site.new/assets  || { echo "    ✗ 新产物缺 assets/"; exit 1; }
NEWF=$(find site.new -type f | wc -l)
NEWW=$(find site.new -name '*.wasm' | wc -l)
test "$NEWW" -ge 1 || { echo "    ✗ 新产物缺 wasm"; exit 1; }
echo "    新产物 $NEWF 个文件，wasm $NEWW 个"

# 4.4 切换。注意：容器的 bind mount 绑的是目录 inode，mv 之后必须重启容器
#     重新解析挂载，否则 nginx 仍然读旧 inode（表现为"部署成功页面没变"）。
if [ -d site ]; then
  rm -rf site.bak
  mv site site.bak
  echo "    旧版保留在 site.bak"
fi
mv site.new site
echo "    新产物已就位"

docker restart '${CONTAINER}' >/dev/null
echo "    容器 ${CONTAINER} 已重启（重新解析挂载）"

# 4.5 等待容器起来并自检
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8095/ || true)
  if [ "$code" = "200" ]; then echo "    容器自检 http=$code"; break; fi
  sleep 1
  if [ "$i" = "30" ]; then echo "    ✗ 容器 30 秒内未就绪（http=$code）"; exit 1; fi
done

if [ '${KEEP_BACKUP ? '1' : '0'}' = '0' ]; then rm -rf site.bak; echo "    已按 KEEP_BACKUP=0 删除备份"; fi
`;

const scriptFile = path.join(os.tmpdir(), `fighter-game-deploy-${Date.now()}.sh`);
fs.writeFileSync(scriptFile, remoteScript.replace(/\r\n/g, '\n'));
try {
  pipeFileToRemote(scriptFile, 'bash -s', 'r');
} finally {
  fs.rmSync(scriptFile, { force: true });
}

// ───────────────────────── 5. 外部验证 ─────────────────────────
step(`浏览器侧验证 ${NAS_URL}`);
const probeFile = path.join(ROOT, `.tmp-probe-${Date.now()}.mjs`);
fs.writeFileSync(
  probeFile,
  // Playwright 包版本与已下载的浏览器 build 号常常错位（包要 chromium-1234、
  // 本机只有 chromium-1228），直接 launch 会报 "Executable doesn't exist"。
  // 全部 verify 脚本都固定 executablePath 兜这个，这里保持一致。
  `import { chromium } from 'playwright';\n` +
    `import fs from 'node:fs';\n` +
    `import path from 'node:path';\n` +
    `const URL = '${NAS_URL}';\n` +
    `const EXE = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe');\n` +
    `const b = await chromium.launch({ executablePath: fs.existsSync(EXE) ? EXE : undefined });\n` +
    `const p = await b.newPage({ viewport: { width: 1280, height: 720 } });\n` +
    `const errs = [];\n` +
    `p.on('pageerror', (e) => errs.push(e.message));\n` +
    `const bad = [];\n` +
    `p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });\n` +
    // 必须真的 goto：about:blank 上 fetch 跨源会被 CORS 挡，读不到 HTML。
    `let status = 0;\n` +
    `try { status = (await p.goto(URL, { waitUntil: 'load', timeout: 120000 })).status(); } catch (e) { console.log(JSON.stringify({ fatal: e.message.split('\\n')[0] })); await b.close(); process.exit(0); }\n` +
    `const entry = await p.evaluate(() => { const s = document.querySelector('script[type=module]'); return s ? s.getAttribute('src') : null; });\n` +
    `const title = await p.title();\n` +
    `console.log(JSON.stringify({ status, entry, title, pageErrors: errs.slice(0, 3), bad: bad.slice(0, 5) }));\n` +
    `await b.close();\n`,
);
let probeOut = '';
try {
  probeOut = capture('node', [probeFile], {
    cwd: ROOT,
    env: { ...process.env, NO_PROXY: 'localhost,127.0.0.1,192.168.1.45' },
  });
} finally {
  fs.rmSync(probeFile, { force: true });
}
const rawLine = probeOut.split('\n').filter((l) => l.trim().startsWith('{')).pop() || '';
const res = JSON.parse(rawLine);
if (res.fatal) die(`线上访问失败：${res.fatal}`);
if (res.status !== 200) die(`index.html 返回 ${res.status}`);
if (!res.entry) die('index.html 里找不到入口 module script');
if (res.bad?.length) die(`线上有 4xx/5xx 资源：\n    ${res.bad.join('\n    ')}`);
if (res.pageErrors?.length) die(`线上有未捕获异常：\n    ${res.pageErrors.join('\n    ')}`);
info(`index.html http=${res.status}「${res.title}」，入口 ${res.entry}，无失败资源`);

console.log(`\n✓ 部署完成 —— ${NAS_URL}`);
console.log('  更严格的一条链（真实 Lua 运行时 + 元进度折算）：');
console.log(`    NO_PROXY=localhost,127.0.0.1,192.168.1.45 VERIFY_URL=${NAS_URL} \\`);
console.log('      node scripts/verify-lua-runtime-prod.mjs');
if (KEEP_BACKUP) {
  console.log(`  回滚：ssh ${NAS_HOST} "cd '${NAS_DIR}' && rm -rf site && mv site.bak site && docker restart ${CONTAINER}"`);
}
