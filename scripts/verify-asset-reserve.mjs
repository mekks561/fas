#!/usr/bin/env node
/**
 * 备用素材库完整性校验（.workbuddy/asset-cache/）
 *
 * 校验内容：
 *   1. Kenney  —— 抽样 GLB 结构（magic/version/长度/chunk/JSON/三角面），覆盖游戏直接取材的套件
 *   2. Poly Haven —— 每张 .hdr 的 Radiance 魔数与大小，并与 manifest 逐条对账
 *   3. ambientCG —— 每套必须含 Color + NormalGL 贴图，并与 manifest 逐条对账
 *   4. manifest 总账自洽（各源合计 = totals）
 *
 * 用法：node scripts/verify-asset-reserve.mjs
 * 有任何失败项退出码为 1。
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.RESERVE_ROOT ? path.resolve(process.env.RESERVE_ROOT) : path.resolve(__dirname, '..');
const RESERVE = path.join(ROOT, '.workbuddy', 'asset-cache');

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'

let passed = 0;
let failed = 0;
const ok = (name) => {
  passed++;
  console.log(`  ✅ ${name}`);
};
const bad = (name, why) => {
  failed++;
  console.log(`  ❌ ${name}${why ? ` — ${why}` : ''}`);
};

/** 与 fetch-kenney-models.mjs 同款的 GLB 结构检查（保持两处判定一致） */
function inspectGlb(buf) {
  const problems = [];
  if (buf.length < 20) return ['文件不足 20 字节'];
  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  const declaredLength = buf.readUInt32LE(8);
  if (magic !== GLB_MAGIC) problems.push(`magic 不是 glTF (0x${magic.toString(16)})`);
  if (version !== 2) problems.push(`version 应为 2，实际 ${version}`);
  if (declaredLength !== buf.length) problems.push(`声明长度 ${declaredLength} ≠ 实际 ${buf.length}`);

  let json = null;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    if (dataStart + chunkLength > buf.length) {
      problems.push(`chunk@${offset} 越界`);
      break;
    }
    if (chunkType === CHUNK_JSON && json === null) {
      try {
        json = JSON.parse(buf.subarray(dataStart, dataStart + chunkLength).toString('utf8'));
      } catch (e) {
        problems.push(`JSON chunk 解析失败: ${e.message}`);
      }
    }
    offset = dataStart + chunkLength;
  }
  if (!json) problems.push('缺少可解析的 JSON chunk');
  const tri = json?.meshes?.reduce((a, m) => {
    for (const p of m.primitives || {}) {
      const acc = json.accessors?.[p.indices ?? -1];
      if (acc?.count) a += Math.floor(acc.count / 3);
    }
    return a;
  }, 0);
  // 注意：这里不设「三角面下限」。备用库是结构库，Kenney 模块化套件里的
  // 地板/斜面平板本来就只有 2-4 个三角形（template-floor-detail-a 等），
  // 属于正常几何而非占位假件。假件的判定靠上面的结构检查
  // （magic/version/长度/chunk/JSON），那才是 generate-models.js 假件的破绽。
  // 「面数过低」的门槛只适用于已接进渲染路径的游戏物件（见 fetch-kenney-models.mjs）。
  if (tri !== null && tri < 2) problems.push(`三角面数 ${tri}，连一个三角形都不到`);
  return problems;
}

async function walkFiles(dir, out = []) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walkFiles(full, out);
    else if (e.isFile() && e.name !== '.reserve-ok') out.push(full);
  }
  return out;
}

async function main() {
  console.log(`备用库：${path.relative(ROOT, RESERVE)}\n`);
  let manifest;
  try {
    manifest = JSON.parse(await fsp.readFile(path.join(RESERVE, 'manifest.json'), 'utf8'));
  } catch (e) {
    console.error(`❌ manifest.json 读取失败: ${e.message}`);
    process.exit(1);
  }

  // ---------- 1. Kenney：抽样 GLB ----------
  console.log('[1/4] Kenney GLB 结构抽样');
  const kenneyDir = path.join(RESERVE, 'kenney');
  const kits = ['3d/space', '3d/space-station', '3d/modular-space', '3d/weapon', '3d/prototype'];
  let glbChecked = 0;
  let glbBroken = 0;
  for (const kit of kits) {
    const dir = path.join(kenneyDir, ...kit.split('/'));
    const files = (await fsp.readdir(dir).catch(() => [])).filter((f) => f.endsWith('.glb'));
    if (files.length === 0) {
      bad(`${kit}`, '目录为空或不存在');
      continue;
    }
    // 每个套件最多抽 15 个，覆盖头尾
    const step = Math.max(1, Math.floor(files.length / 15));
    const sample = files.filter((_, i) => i % step === 0).slice(0, 15);
    for (const f of sample) {
      const buf = await fsp.readFile(path.join(dir, f));
      const problems = inspectGlb(buf);
      glbChecked++;
      if (problems.length) {
        glbBroken++;
        bad(`${kit}/${f}`, problems[0]);
      }
    }
    ok(`${kit} — ${files.length} 个 GLB，抽查 ${sample.length}`);
  }
  if (glbBroken === 0) ok(`GLB 抽样全部通过（${glbChecked} 个）`);
  console.log('');

  // ---------- 2. Poly Haven：.hdr 魔数 + manifest 对账 ----------
  console.log('[2/4] Poly Haven HDRI');
  const phDir = path.join(RESERVE, 'polyhaven');
  const hdrs = (await fsp.readdir(phDir).catch(() => [])).filter((f) => f.endsWith('.hdr'));
  let hdrBad = 0;
  for (const f of hdrs) {
    const full = path.join(phDir, f);
    const st = await fsp.stat(full);
    const head = Buffer.alloc(10);
    const fh = await fsp.open(full, 'r');
    await fh.read(head, 0, 10, 0);
    await fh.close();
    if (!head.toString('latin1').startsWith('#?RADIANCE')) {
      bad(f, 'Radiance 魔数不符');
      hdrBad++;
    } else if (st.size < 1024) {
      bad(f, `仅 ${st.size} 字节`);
      hdrBad++;
    }
  }
  if (hdrBad === 0) ok(`${hdrs.length} 张 .hdr 魔数与大小全部通过`);
  const phSrc = manifest.sources.find((s) => s.id === 'polyhaven');
  const phManifestFiles = (phSrc?.files ?? []).filter((f) => !f.failed && !f.missing);
  const missingOnDisk = phManifestFiles.filter((f) => !hdrs.includes(path.basename(f.path)));
  if (missingOnDisk.length === 0) ok(`manifest 的 ${phManifestFiles.length} 条记录与磁盘一致`);
  else missingOnDisk.forEach((f) => bad(`manifest 记录缺失: ${f.path}`));
  console.log('');

  // ---------- 3. ambientCG：每套 Color + NormalGL ----------
  console.log('[3/4] ambientCG PBR 材质');
  const acDir = path.join(RESERVE, 'ambientcg');
  const sets = await fsp.readdir(acDir).catch(() => []);
  let acBad = 0;
  for (const set of sets.filter((s) => !s.startsWith('.'))) {
    const files = await fsp.readdir(path.join(acDir, set)).catch(() => []);
    const hasColor = files.some((f) => f.includes('_Color'));
    const hasNormal = files.some((f) => f.includes('_NormalGL'));
    if (!files.length) {
      bad(set, '目录为空');
      acBad++;
    } else if (!hasColor || !hasNormal) {
      bad(set, `缺 ${!hasColor ? 'Color ' : ''}${!hasNormal ? 'NormalGL' : ''}`);
      acBad++;
    }
  }
  if (acBad === 0) ok(`${sets.filter((s) => !s.startsWith('.')).length} 套材质的 Color/NormalGL 齐全`);
  console.log('');

  // ---------- 4. manifest 总账 ----------
  console.log('[4/4] manifest 总账自洽');
  let sumFiles = 0;
  let sumBytes = 0;
  for (const s of manifest.sources) {
    if (typeof s.fileCount === 'number') sumFiles += s.fileCount;
    if (typeof s.totalBytes === 'number') sumBytes += s.totalBytes;
    for (const f of s.files ?? []) {
      sumFiles += f.fileCount ?? (f.bytes > 0 ? 1 : 0);
      sumBytes += f.bytes || 0;
    }
  }
  const totalsOk =
    sumFiles === manifest.totals.files && Math.abs(sumBytes - manifest.totals.bytes) < 1024;
  if (totalsOk) ok(`合计 ${manifest.totals.files} 个文件 / ${(manifest.totals.bytes / 1048576).toFixed(1)} MB 与分项一致`);
  else bad('totals 与分项不一致', `分项 ${sumFiles}/${(sumBytes / 1048576).toFixed(1)}MB vs 总账 ${manifest.totals.files}/${(manifest.totals.bytes / 1048576).toFixed(1)}MB`);

  console.log('\n================ 校验结果 ================');
  console.log(`  通过 ${passed} 项，失败 ${failed} 项`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('校验脚本异常:', e);
  process.exit(1);
});
