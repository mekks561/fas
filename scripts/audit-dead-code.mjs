#!/usr/bin/env node
/**
 * 源码死簇审计 —— 从真实入口做 import 图可达性分析。
 *
 * 为什么需要这个脚本：
 *   scripts/audit-asset-usage.mjs 只覆盖 public/assets（资源文件），
 *   「源码实现了但没有任何入口引用」是它的盲区。上一轮死链清理据此漏掉了
 *   Enhanced* 死簇（5 个文件 / 2105 行，只被彼此 import）。
 *
 * 判定口径：
 *   1. 生产入口 = src/main.tsx（index.html 里唯一的 module script）。
 *      从入口做 BFS，能走到的文件 = 活代码（LIVE）。
 *   2. *.test.ts / *.test.tsx 单列为「测试入口」，不作为生产可达的证明。
 *      未被生产入口可达、但被测试引用的文件 → TESTONLY（仅测试使用）。
 *   3. 未被生产可达且无测试引用 → DEAD（死代码）。
 *   4. import(变量) 这类非字面量动态加载单列 DYN，避免把它误判为死代码。
 *      命中 DYN 的文件会同时标 ⚠，需人工确认。
 *
 * 用法：
 *   node scripts/audit-dead-code.mjs            # 摘要
 *   node scripts/audit-dead-code.mjs --list     # 附完整清单
 *   node scripts/audit-dead-code.mjs --json     # 机器可读
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const ENTRY = 'src/main.tsx';

/**
 * 测试基础设施入口：不由任何 .test.ts import，而是被配置直接加载。
 * 漏了它会把 setupTests.ts（及其独占依赖）误判成 DEAD。
 * 来源：vitest.config.ts 的 test.setupFiles。
 */
function collectTestSetupEntries() {
  const out = [];
  const cfgPath = path.join(ROOT, 'vitest.config.ts');
  if (fs.existsSync(cfgPath)) {
    const cfg = fs.readFileSync(cfgPath, 'utf8');
    const m = /setupFiles\s*:\s*(\[[^\]]*\]|['"][^'"]+['"])/s.exec(cfg);
    if (m) {
      for (const s of m[1].matchAll(/['"]([^'"]+)['"]/g)) {
        const abs = path.resolve(ROOT, s[1]);
        if (fs.existsSync(abs)) out.push(rel(abs));
      }
    }
  }
  return out;
}

const argv = process.argv.slice(2);
const FLAG_LIST = argv.includes('--list');
const FLAG_JSON = argv.includes('--json');

/** 递归收集 src 下所有 ts/tsx。 */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const FROM_RE = /\bfrom\s*['"]([^'"]+)['"]/g;
const SIDE_EFFECT_RE = /\bimport\s*['"]([^'"]+)['"]/g;
const DYNAMIC_LITERAL_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
/** import( 后面直接跟非引号字符 = 运行时拼路径，静态分析看不到。 */
const DYNAMIC_OPAQUE_RE = /\bimport\s*\(\s*([^'")\s][^)]*)\)/g;

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

/**
 * 剥离注释——不加这步，文件头「用法示例」里的
 * `* import { X } from './x'` 会被当成真实依赖边，把死文件误判成 LIVE
 * （方向保守：只会漏报，不会误删，但会严重低估问题规模）。
 * 字符串字面量一并跳过，避免 `'https://…'` 里的 // 被当成行注释。
 */
function stripComments(src) {
  let out = '';
  let state = 'code'; // code | line | block | sq | dq | tpl
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const c2 = src[i + 1];
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line'; i++; continue; }
      if (c === '/' && c2 === '*') { state = 'block'; i++; continue; }
      if (c === "'") state = 'sq';
      else if (c === '"') state = 'dq';
      else if (c === '`') state = 'tpl';
      out += c;
    } else if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; }
    } else if (state === 'block') {
      if (c === '*' && c2 === '/') { state = 'code'; i++; }
    } else {
      const q = state === 'sq' ? "'" : state === 'dq' ? '"' : '`';
      if (c === '\\') { out += c + (c2 ?? ''); i++; continue; }
      if (c === q) state = 'code';
      out += c;
    }
  }
  return out;
}

/** 模块说明符 → 仓库内文件（相对 / @ 别名）。外部包返回 null。 */
function resolveSpec(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC_DIR, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // 外部包（react / playcanvas / ...）

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

const files = walk(SRC_DIR);
const deps = new Map(); // rel -> Set<rel>
const opaqueDynamic = []; // { file, expr }
const unresolved = []; // { file, spec }

for (const abs of files) {
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  const key = rel(abs);
  const set = new Set();

  for (const re of [FROM_RE, SIDE_EFFECT_RE, DYNAMIC_LITERAL_RE, REQUIRE_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const target = resolveSpec(m[1], abs);
      if (target) set.add(rel(target));
      else if (m[1].startsWith('.') || m[1].startsWith('@/')) {
        unresolved.push({ file: key, spec: m[1] });
      }
    }
  }

  DYNAMIC_OPAQUE_RE.lastIndex = 0;
  let dm;
  while ((dm = DYNAMIC_OPAQUE_RE.exec(src)) !== null) {
    // 过滤误报：import( 后紧跟注释、换行等
    const expr = dm[1].trim();
    if (expr.startsWith('//') || expr.startsWith('/*')) continue;
    opaqueDynamic.push({ file: key, expr: expr.slice(0, 60) });
  }

  deps.set(key, set);
}

const isTest = (f) => /\.test\.tsx?$/.test(f);

/** BFS 可达闭包。 */
function reachable(entry, allowedPredicate) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const cur = queue.pop();
    if (seen.has(cur) || !deps.has(cur)) continue;
    if (cur !== entry && !allowedPredicate(cur)) continue;
    seen.add(cur);
    for (const next of deps.get(cur)) queue.push(next);
  }
  return seen;
}

const live = reachable(ENTRY, () => true);
const testSetupEntries = collectTestSetupEntries();
const testRoots = [...deps.keys()].filter(isTest);
const testReached = new Set();
for (const t of [...testRoots, ...testSetupEntries]) for (const r of reachable(t, () => true)) testReached.add(r);
// 测试入口自身也算「被测试使用」
for (const t of testRoots) testReached.add(t);
for (const t of testSetupEntries) testReached.add(t);

const opaqueFiles = new Set(opaqueDynamic.map((o) => o.file));

const dead = [];
const testOnly = [];
for (const key of deps.keys()) {
  if (live.has(key)) continue;
  if (isTest(key)) continue; // 测试文件本身单列它处，不进任何一类
  if (testReached.has(key)) testOnly.push(key);
  else dead.push(key);
}

function lineCount(f) {
  try {
    return fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').length;
  } catch {
    return 0;
  }
}

/** 抽取「这个文件自称是什么」——首个导出声明 + 头部注释首句，供人工分类。 */
function describe(f) {
  let src = '';
  try {
    src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  } catch {
    return { decl: '', doc: '' };
  }
  const lines = src.split('\n');
  let decl = '';
  for (const l of lines) {
    const m = /^export\s+(?:default\s+)?(?:abstract\s+)?(class|function|const|interface|type|enum)\s+([A-Za-z0-9_$]+)/.exec(l);
    if (m) {
      decl = `${m[1]} ${m[2]}`;
      break;
    }
  }
  let doc = '';
  for (const l of lines.slice(0, 40)) {
    const t = l.replace(/^\s*(\/\*\*?|\*|\/\/)\s*/, '').trim();
    if (t && !t.startsWith('*/') && t.length > 6 && !t.startsWith('@')) {
      doc = t;
      break;
    }
  }
  return { decl, doc: doc.slice(0, 100) };
}

const enrich = (list) =>
  list
    .map((f) => ({ file: f, lines: lineCount(f), opaque: opaqueFiles.has(f), ...describe(f) }))
    .sort((a, b) => b.lines - a.lines);

const deadInfo = enrich(dead);
const testOnlyInfo = enrich(testOnly);

const report = {
  total: deps.size,
  entry: ENTRY,
  live: live.size,
  dead: deadInfo,
  testOnly: testOnlyInfo,
  deadLines: deadInfo.reduce((s, d) => s + d.lines, 0),
  opaqueDynamic,
  unresolved,
};

if (FLAG_JSON) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log('=== 源码可达性审计（入口：%s）===', ENTRY);
console.log(`src 下模块总数        : ${report.total}`);
console.log(`生产可达（LIVE）      : ${report.live}`);
console.log(`死代码（DEAD）        : ${deadInfo.length} 个 / ${report.deadLines} 行`);
console.log(`仅测试使用（TESTONLY）: ${testOnlyInfo.length} 个`);
console.log(`非字面量动态 import   : ${opaqueDynamic.length} 处（需人工确认，见下）`);

const fmt = (list, n = FLAG_LIST ? list.length : 12) =>
  list
    .slice(0, n)
    .map((d) => {
      const flag = d.opaque ? '  ⚠有动态import' : '';
      const detail =
        FLAG_LIST && (d.decl || d.doc) ? `\n          → ${d.decl}${d.decl && d.doc ? ' · ' : ''}${d.doc}` : '';
      return `    ${String(d.lines).padStart(5)} 行  ${d.file}${flag}${detail}`;
    })
    .join('\n');

if (deadInfo.length) {
  console.log(`\n--- DEAD（无生产入口可达，且无测试引用）${FLAG_LIST ? '' : `（前 12 / 共 ${deadInfo.length}）`} ---`);
  console.log(fmt(deadInfo));
}
if (testOnlyInfo.length) {
  console.log(`\n--- TESTONLY（仅被测试引用，生产不可达）${FLAG_LIST ? '' : `（前 12 / 共 ${testOnlyInfo.length}）`} ---`);
  console.log(fmt(testOnlyInfo));
}
if (opaqueDynamic.length) {
  console.log('\n--- 非字面量动态 import（静态分析盲区，勿据此判死）---');
  for (const o of opaqueDynamic.slice(0, 20)) console.log(`    ${o.file}: import(${o.expr})`);
}
if (unresolved.length) {
  console.log(`\n--- 无法解析的模块说明符（${unresolved.length}）---`);
  for (const u of unresolved.slice(0, 20)) console.log(`    ${u.file} -> ${u.spec}`);
}
