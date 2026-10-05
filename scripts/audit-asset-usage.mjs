#!/usr/bin/env node
/**
 * 资源库利用率审计 v2
 *
 * 判定分级（从严到宽）：
 *   LIVE      运行时源码引用（真正会进玩家眼睛/耳朵）
 *   VERIFY    仅被 scripts/verify-* 或 tests/ 引用（有活接线，但只在测试里跑）
 *   DATA      仅被 public/assets/**\/*.json 配置引用
 *   PRODUCED  仅被生成器/抓取脚本提到（= 自己造的自己列，无消费方）
 *   ORPHAN    全仓库无人提及
 *
 * 关键：生成脚本与死代码文件不算消费方。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_ROOT = path.join(ROOT, 'public');

// 已确认零引用的死代码（不构成消费方）
const DEAD_SOURCE_FILES = [
  'src/engine/AssetManifest.ts',
  'src/GameResources.ts',
  'src/GameResourceManager.ts',
  'src/ResourceDownloadTester.ts',
  'src/GameResourceManager.test.ts',
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const SKIP_EXT = new Set(['.md']);
const allAssets = walk(ASSET_ROOT).filter((f) => !SKIP_EXT.has(path.extname(f).toLowerCase()));

function collect(dir, exts) {
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (['node_modules', 'dist', 'dist-verify', 'dev-dist', '.git'].includes(e.name)) continue;
        stack.push(p);
      } else if (exts.has(path.extname(e.name).toLowerCase())) files.push(p);
    }
  }
  return files;
}

const codeExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const relToRoot = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const isDead = (f) => DEAD_SOURCE_FILES.includes(relToRoot(f));

const srcAll = collect(path.join(ROOT, 'src'), codeExts).filter((f) => !isDead(f));
const scriptAll = collect(path.join(ROOT, 'scripts'), codeExts);
const testAll = collect(path.join(ROOT, 'tests'), codeExts);

const PRODUCER_RE = /(^|\/)(generate-|fetch-|download-)/;
const VERIFY_RE = /(^|\/)(verify-|pc2-visual-verify|typecheck-)/;

const srcFiles = srcAll;
const verifyFiles = [...scriptAll, ...testAll].filter((f) => VERIFY_RE.test(relToRoot(f)));
const producerFiles = scriptAll.filter((f) => PRODUCER_RE.test(relToRoot(f)));

const read = (f) => {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};
const join = (fs_) => fs_.map(read).join('\n');

const srcText = join(srcFiles);
const verifyText = join(verifyFiles);
const producerText = join(producerFiles);
const dataText = join(allAssets.filter((f) => f.toLowerCase().endsWith('.json')));

// ---------- 动态前缀：fetch(`/assets/xxx/${id}.json`) 这类模板拼接 ----------
// 只有"活着的"源文件里出现的动态前缀才算数（死代码里的不算）
function dynamicPrefixes(text) {
  const out = new Set();
  const re = /\/assets\/([A-Za-z0-9_\-/]*?)\/\$\{/g;
  let m;
  while ((m = re.exec(text))) out.add('assets/' + m[1] + '/');
  return out;
}
const srcDynPrefixes = dynamicPrefixes(srcText);
const verifyDynPrefixes = dynamicPrefixes(verifyText);
const prodDynPrefixes = dynamicPrefixes(producerText);

// 前缀 -> 拥有它的源文件（备用：判断字段是否被消费）
const prefixOwner = new Map();
for (const f of srcFiles) {
  const body = read(f);
  for (const p of dynamicPrefixes(body))
    if (!prefixOwner.has(p)) prefixOwner.set(p, { file: f, body });
}
// FIELD-GAP 判定用的辅助（在 hitCache/rows 构建后调用）

function tokensFor(rel) {
  const base = path.basename(rel);
  const noExt = base.replace(/\.[^.]+$/, '');
  const ext = path.extname(base).toLowerCase();
  const t = new Set([rel, '/assets/' + rel, './assets/' + rel]);
  if (['.ogg', '.mp3', '.wav', '.glb', '.png', '.jpg'].includes(ext)) {
    t.add(base);
    if (noExt.length >= 4) t.add(noExt);
  }
  return [...t];
}

// ---------- 第一遍：直接命中 ----------
const hitCache = new Map();
const rows = [];
for (const abs of allAssets) {
  const rel = path.relative(ASSET_ROOT, abs).split(path.sep).join('/');
  const toks = tokensFor(rel);
  const hit = (text) => toks.filter((t) => text.includes(t));

  const dyn = (set) => [...set].some((p) => rel.startsWith(p));
  const inSrc = hit(srcText);
  const inVerify = hit(verifyText);
  const inProd = hit(producerText);
  const inData = hit(dataText);

  const dynSrc = dyn(srcDynPrefixes);
  const dynVerify = dyn(verifyDynPrefixes);
  const dynProd = dyn(prodDynPrefixes);

  hitCache.set(rel, { inSrc, inVerify, inProd, inData, dynSrc, dynVerify, dynProd });

  let status = 'ORPHAN';
  let via = [];
  if (inSrc.length || dynSrc) {
    status = 'LIVE';
    via = inSrc.length ? inSrc : ['(动态拼接)'];
  } else if (inVerify.length || dynVerify) {
    status = 'VERIFY';
    via = inVerify.length ? inVerify : ['(动态拼接)'];
  } else if (inData.length) {
    status = 'DATA';
    via = inData;
  } else if (inProd.length || dynProd) {
    status = 'PRODUCED';
    via = inProd.length ? inProd : ['(动态拼接)'];
  }
  rows.push({ rel, status, bytes: fs.statSync(abs).size, via: via.slice(0, 3) });
}

// ---------- 第二遍：传递存活（把 DATA 里"引它的 json 自己也没人用"的降级为 DANGLING）----------
const jsonAssets = allAssets.filter((f) => f.toLowerCase().endsWith('.json'));
const relOf = (abs) => path.relative(ASSET_ROOT, abs).split(path.sep).join('/');

// 每个 json 文本中被它提到的其它资源 rel 集合
const jsonBody = new Map();
for (const j of jsonAssets) jsonBody.set(relOf(j), read(j));

// 种子：被 src 或 verify 直接引用的 json
const liveJson = new Set();
const queue = [];
for (const j of jsonAssets) {
  const rel = relOf(j);
  const c = hitCache.get(rel);
  if (c && (c.inSrc.length || c.inVerify.length || c.dynSrc || c.dynVerify)) {
    liveJson.add(rel);
    queue.push(rel);
  }
}
// 传递闭包
while (queue.length) {
  const cur = queue.pop();
  const body = jsonBody.get(cur) || '';
  for (const j of jsonAssets) {
    const rel = relOf(j);
    if (liveJson.has(rel)) continue;
    const base = path.basename(rel);
    if (body.includes(rel) || body.includes('/assets/' + rel) || body.includes(base)) {
      liveJson.add(rel);
      queue.push(rel);
    }
  }
}

// json 是否能"授权"它引用的资源
function liveJsonCiting(targetRel) {
  const out = [];
  for (const cur of liveJson) {
    const body = jsonBody.get(cur) || '';
    if (!body) continue;
    const toks = tokensFor(targetRel);
    if (toks.some((t) => body.includes(t))) {
      out.push(cur);
      break;
    }
  }
  return out;
}

// FIELD-GAP 判定：
// json 里存的是裸 id（如 "icon-achieve"），若活代码里没有任何地方把该 id 拼成路径、
// 也没有动态前缀覆盖它所在目录，则该文件永远拿不到 URL —— "配置提到但加载不出来"。
function pathResolvable(rel) {
  const c = hitCache.get(rel);
  if (!c) return false;
  return Boolean(c.inSrc.length || c.dynSrc);
}

for (const r of rows) {
  if (r.status !== 'DATA') continue;
  const citing = liveJsonCiting(r.rel);
  if (!citing.length) {
    r.status = 'DANGLING';
    r.via = ['(仅被无人加载的 json 引用)'];
  } else if (!pathResolvable(r.rel)) {
    r.status = 'FIELDGAP';
    r.via = [`${citing[0]} 里以裸 id 引用，活代码无路径拼接 → 加载不出来`];
  } else {
    r.via = citing;
  }
}

// ---------- 聚合 ----------
const ORDER = ['LIVE', 'VERIFY', 'DATA', 'FIELDGAP', 'DANGLING', 'PRODUCED', 'ORPHAN'];
const byDir = new Map();
for (const r of rows) {
  const top = r.rel.split('/').slice(0, 2).join('/');
  if (!byDir.has(top)) byDir.set(top, { total: 0, bytes: 0, counts: {}, obytes: 0 });
  const d = byDir.get(top);
  d.total++;
  d.bytes += r.bytes;
  d.counts[r.status] = (d.counts[r.status] || 0) + 1;
  if (['ORPHAN', 'PRODUCED', 'DANGLING', 'FIELDGAP'].includes(r.status)) d.obytes += r.bytes;
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rows, byDir: Object.fromEntries(byDir) }, null, 2));
} else {
  const pct = (n, t) => (t ? ((n / t) * 100).toFixed(0) + '%' : '-');
  const KB = (b) => (b / 1024).toFixed(0) + 'K';
  console.log('资源库利用率审计 v2');
  console.log('='.repeat(94));
  console.log(
    '目录'.padEnd(26) +
      '总数'.padStart(5) +
      '运行时'.padStart(7) +
      '仅验证'.padStart(7) +
      '字段未通'.padStart(7) +
      '悬空'.padStart(6) +
      '自产'.padStart(6) +
      '孤儿'.padStart(6) +
      '有效'.padStart(7),
  );
  console.log('-'.repeat(101));
  const sorted = [...byDir.entries()].sort((a, b) => b[1].total - a[1].total);
  const T = { total: 0, bytes: 0, obytes: 0, counts: {} };
  for (const [k, v] of sorted) {
    for (const s of ORDER) T.counts[s] = (T.counts[s] || 0) + (v.counts[s] || 0);
    T.total += v.total;
    T.bytes += v.bytes;
    T.obytes += v.obytes;
    const live = v.counts.LIVE || 0;
    console.log(
      k.slice(0, 25).padEnd(26) +
        String(v.total).padStart(5) +
        String(live).padStart(7) +
        String(v.counts.VERIFY || 0).padStart(7) +
        String(v.counts.FIELDGAP || 0).padStart(7) +
        String(v.counts.DANGLING || 0).padStart(6) +
        String(v.counts.PRODUCED || 0).padStart(6) +
        String(v.counts.ORPHAN || 0).padStart(6) +
        pct(live, v.total).padStart(7),
    );
  }
  console.log('-'.repeat(101));
  console.log(
    '合计'.padEnd(26) +
      String(T.total).padStart(5) +
      String(T.counts.LIVE || 0).padStart(7) +
      String(T.counts.VERIFY || 0).padStart(7) +
      String(T.counts.FIELDGAP || 0).padStart(7) +
      String(T.counts.DANGLING || 0).padStart(6) +
      String(T.counts.PRODUCED || 0).padStart(6) +
      String(T.counts.ORPHAN || 0).padStart(6) +
      pct(T.counts.LIVE || 0, T.total).padStart(7),
  );
  console.log('');
  console.log(
    `体积 ${(T.bytes / 1048576).toFixed(2)}MB ｜ 无消费方 ${(T.obytes / 1048576).toFixed(2)}MB`,
  );
  console.log('');
  for (const s of ['ORPHAN', 'PRODUCED', 'DANGLING', 'FIELDGAP', 'DATA', 'VERIFY']) {
    const list = rows.filter((r) => r.status === s).sort((a, b) => b.bytes - a.bytes);
    if (!list.length) continue;
    console.log(`【${s}】${list.length} 个`);
    list
      .slice(0, 25)
      .forEach((r) =>
        console.log(`   ${KB(r.bytes).padStart(7)}  ${r.rel}    via=${r.via[0] ?? '-'}`),
      );
    if (list.length > 25) console.log(`   ... 另 ${list.length - 25} 个`);
    console.log('');
  }
}
