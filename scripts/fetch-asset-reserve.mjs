#!/usr/bin/env node
/**
 * 备用素材库预抓取（多源 CC0）
 *
 * 目的：把后续开发可能用到的 CC0 素材一次性预抓到本地，避免「想到要用时才去找源」。
 *
 * 与 fetch-kenney-models.mjs 的区别：
 *   - 后者只抓「已经接进渲染路径」的少数模型，产物进 public/assets/（会随构建发版）
 *   - 本脚本抓的是**备用库**，落在 .workbuddy/asset-cache/（.gitignore 已忽略），
 *     不进 public/、不参与构建、不进版本库。
 *     要用某个素材时，从库里挑出来复制到 public/assets/ 并登记到对应 CREDITS.md。
 *
 * 四个源（全部 CC0-1.0，可商用、无需署名）：
 *   1. Kenney     —— 全库（钉 commit），游戏素材的事实标准
 *   2. Poly Haven —— HDRI 环境贴图（天空盒 / IBL 打光）
 *   3. ambientCG  —— PBR 材质贴图（金属装甲板 / 太阳能板 / 岩石）
 *   4. Quaternius —— 高模飞船/科幻套件（GLTF，经 Google Drive，需代理）
 *
 * 用法：
 *   node scripts/fetch-asset-reserve.mjs                # 抓取（已存在且校验通过则跳过）
 *   node scripts/fetch-asset-reserve.mjs --check        # 只校验，不下载
 *   node scripts/fetch-asset-reserve.mjs --list         # 只列出本次会抓什么
 *   node scripts/fetch-asset-reserve.mjs --keep-archives # 保留压缩包（便于复验）
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.RESERVE_ROOT ? path.resolve(process.env.RESERVE_ROOT) : path.resolve(__dirname, '..');
const RESERVE = process.env.RESERVE_DIR || path.join(ROOT, '.workbuddy', 'asset-cache');
const ARCHIVES = path.join(RESERVE, '_archives');

const ARGS = new Set(process.argv.slice(2));
const CHECK_ONLY = ARGS.has('--check');
const LIST_ONLY = ARGS.has('--list');
const KEEP_ARCHIVES = ARGS.has('--keep-archives');

// ---------------------------------------------------------------------------
// 抓取清单
// ---------------------------------------------------------------------------

/** 源 1：Kenney 全库。commit 与 fetch-kenney-models.mjs 保持一致，两者可互相印证。 */
const KENNEY = {
  id: 'kenney',
  license: 'CC0-1.0',
  homepage: 'https://kenney.nl',
  note: '镜像 shorepine/kenney，含 2d / 3d / ui / icons 全部套件（该镜像不含音频）',
  commit: '3694c6879e487c108f55677be7dd2ca75b07cc3b',
};
KENNEY.url = `https://codeload.github.com/shorepine/kenney/tar.gz/${KENNEY.commit}`;
KENNEY.archive = `kenney-${KENNEY.commit.slice(0, 7)}.tar.gz`;

/**
 * 源 2：Poly Haven HDRI。
 * 按「分类 → 分辨率」批量取，另加手工点名的 slug。
 * 1k ≈1.4MB / 2k ≈5.1MB / 4k ≈18-26MB
 */
const POLYHAVEN = {
  id: 'polyhaven',
  license: 'CC0-1.0',
  homepage: 'https://polyhaven.com',
  note: 'HDRI 环境贴图，可作天空盒或 IBL 打光；.hdr 需 Radiance 解码',
  byCategory: [
    // 天光渐变（59 张）——干净的全天球天空，适合天空盒/菜单背景
    // 2026-10-11 扩容：1k → 2k（1k 版本已在盘上，两档共存；2k 作主力备份）
    { category: 'pure skies', res: '2k' },
    // 夜空（约 30 张）——星空/银河/月夜，太空题材天空盒的核心储备
    { category: 'night', res: '2k' },
    // 月面实验室——Poly Haven 唯一的太空站环境
    { category: 'moon', res: '4k' },
  ],
  bySlug: [
    // 暗夜净空，适合做太空感天空盒
    { slug: 'rogland_clear_night', res: '2k' },
    { slug: 'rogland_moonlit_night', res: '2k' },
    { slug: 'qwantani_moonrise', res: '2k' },
    { slug: 'qwantani_moon_noon', res: '2k' },
    { slug: 'qwantani_night', res: '2k' },
    { slug: 'satara_night_no_lamps', res: '2k' },
    { slug: 'moonless_golf', res: '2k' },
    { slug: 'solitude_night', res: '2k' },
    // 摄影棚环境，用于模型预览 / 立绘打光
    { slug: 'neon_photostudio', res: '1k' },
    { slug: 'monochrome_studio_02', res: '1k' },
    { slug: 'studio_small_03', res: '1k' },
    { slug: 'studio_small_08', res: '1k' },
    { slug: 'white_studio_02', res: '1k' },
  ],
};

/**
 * 源 3：ambientCG PBR 材质。1K 包 ≈4.7-9.7MB。
 * 2026-10-11 扩容：`ids` 是手工点名的优先项（保证必到）；
 * `queries` 按 API 关键词检索补量，合并去重后截到 `maxTotal` 套。
 * API: /api/v2/full_json?q=…&type=Material → foundAssets[].assetId
 */
const AMBIENTCG = {
  id: 'ambientcg',
  license: 'CC0-1.0',
  homepage: 'https://ambientcg.com',
  note: 'PBR 材质包（Color/Normal/Roughness/AO/Displacement），解压后每套约 8-12 张贴图',
  res: '1K',
  maxTotal: 160,
  queries: [
    // 关键词 → 该词下取多少套（太空舰体/地面场景相关优先）
    { q: 'MetalPlates', limit: 60 },
    { q: 'Metal', limit: 60 },
    { q: 'Rock', limit: 40 },
    { q: 'Ground', limit: 40 },
    { q: 'Concrete', limit: 30 },
    { q: 'Gravel', limit: 20 },
    { q: 'Fabric', limit: 15 },
    { q: 'Plastic', limit: 15 },
    { q: 'CorrugatedSteel', limit: 10 },
    { q: 'Foil', limit: 10 },
  ],
  ids: [
    // 太阳能板——空间站外层最显眼的部件
    'SolarPanel001',
    'SolarPanel002',
    'SolarPanel003',
    'SolarPanel004',
    // 科幻金属装甲板——舰体 / 舱段外壳
    'MetalPlates015A',
    'MetalPlates015B',
    'MetalPlates016A',
    'MetalPlates016B',
    'MetalPlates017A',
    'MetalPlates017B',
    // 岩石——小行星表面
    'Rock030',
    'Rock051',
    'Rock058',
    'Rock064',
    // 地面/风化层——行星地表
    'Ground068',
    'Ground111',
    // 通用金属
    'Metal063',
    'Metal049A',
  ],
};
AMBIENTCG.zipUrl = (id) => `https://ambientcg.com/get?file=${id}_${AMBIENTCG.res}-JPG.zip`;

/**
 * 源 4：Quaternius 科幻模型包（CC0-1.0，比 Kenney 高一档的高模）。
 * 官网下载全部走 Google Drive 文件夹 → 用 gdown 拉（受管 venv 里 pip install gdown）。
 * Drive 在国内网络不可直达，需代理：优先 QUATERNIUS_PROXY 环境变量，
 * 其次自动探测本机常见代理端口（FlClash 7890 / Clash 7890 / 常见混入端口）。
 * 每个包解压/下载完成后落 .reserve-ok 标记，重跑跳过。
 * 文件夹 ID 从各包页面抓取钉死（2026-10-11）：
 *   quaternius.com/packs/<pack>.html 里 grep drive.google.com/drive/folders/
 */
const QUATERNIUS = {
  id: 'quaternius',
  license: 'CC0-1.0',
  homepage: 'https://quaternius.com',
  note: '高模飞船/太空套件/科幻枪械/机甲异形（GLTF+FBX+OBJ），Kenney 低模的升级备选',
  gdownModule: 'gdown', // python -m gdown
  packs: [
    { pack: 'ultimatespaceships', folderId: '1NpfT3wqe2k3Jwue2xryi7tzxP4bWzETu' },
    { pack: 'spaceships', folderId: '1ZxWZ-KuSOA-9s53PA1B1-O0txRJvne2i' },
    { pack: 'ultimatespacekit', folderId: '17F8HlI2zPTlo32aieW5YPPwOk78xo-2m' },
    { pack: 'ultimatemodularscifi', folderId: '1zpr6HxVa-sCV93IHubN3A1d8HhF2wGbM' },
    { pack: 'scifimodularguns', folderId: '1P5j8xZyIEmZGHjGYmIgYCev9SVmB-IHC' },
    { pack: 'scifigun', folderId: '1jaszGQ7QN2KIWFFoOVYy8y8qFe27yVL2' },
    { pack: 'animatedmech', folderId: '1sueV_4CGMpZC8y30mWfgKK9UaT3mkHBX' },
    { pack: 'animatedalien', folderId: '1ADdETHqjSIEUhjKjhLB9hQjeppXEqcvL' },
    { pack: 'animatedrobot', folderId: '18MU0RtRu9G6SU6uSZ_zMQFmVkRlB4zH5' },
    { pack: 'cyberpunkgamekit', folderId: '1GyKLypoBxrpLN6GERF9U610Wiub48v9y' },
  ],
};

/** 找一个能连 Google 的代理：QUATERNIUS_PROXY 显式指定 → 否则默认 FlClash/Clash 的 7890。 */
function resolveQuaterniusProxy() {
  return process.env.QUATERNIUS_PROXY || 'http://127.0.0.1:7890';
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
const log = (...a) => console.log(...a);

/**
 * Windows 路径 → MSYS/Git-Bash 风格（F:\a\b → /f/a/b）。
 * /usr/bin 下的 tar、unzip 是 MSYS 程序：直接喂 `F:\…` 会被当成 `主机:路径`
 * （tar 报 "Cannot connect to F: resolve failed"），加 --force-local 后又会把
 * 反斜杠转义成 `F\:\\…` 而找不到目录。转成 POSIX 路径是唯一稳的做法。
 */
function msysPath(p) {
  const abs = path.resolve(p).replace(/\\/g, '/');
  const m = /^([A-Za-z]):\/(.*)$/.exec(abs);
  return m ? `/${m[1].toLowerCase()}/${m[2]}` : abs;
}

/** gzip 完整性预检，用于判断已下载的压缩包能否直接复用 */
function gzipOk(p) {
  try {
    execFileSync('gzip', ['-t', msysPath(p)], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function sha256File(p) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(p)) h.update(chunk);
  return h.digest('hex');
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

/** 下载到内存再落盘；带退避重试与单次超时（不设超时的话，连接挂起会永远等）。 */
async function download(url, dest, { retries = 3, timeoutMs = 120_000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.writeFile(dest, buf);
      return { bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  throw new Error(`${url} → ${String(lastErr?.message ?? lastErr).slice(0, 80)}`);
}

/** 受限并发 */
async function pool(items, limit, worker) {
  const out = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return out;
}

/**
 * 尽力而为删除。
 * 本环境的 fs.rm 被安全层接管后走回收站（genie-trash），对大文件/大目录会 ETIMEDOUT。
 * 所以删除必须可失败：失败时保留文件并提示手动清理，绝不能让抓取流程中断。
 */
async function rmSoft(p, label) {
  try {
    await fsp.rm(p, { recursive: true, force: true });
  } catch (e) {
    log(`⚠ 未能删除 ${label ?? p}（保留待手动清理）：${String(e.message).slice(0, 90)}`);
  }
}

/** 完成标记：子目录里落一个 .reserve-ok，重跑时据此跳过已完成的耗时段 */
async function writeMarker(dir, data) {
  await fsp.writeFile(path.join(dir, '.reserve-ok'), JSON.stringify(data));
}
async function readMarker(dir) {
  try {
    return JSON.parse(await fsp.readFile(path.join(dir, '.reserve-ok'), 'utf8'));
  } catch {
    return null;
  }
}

/** 递归统计目录：文件数、总字节、按前两段路径聚合 */
async function walkTree(dir) {
  const byTop = new Map();
  let files = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = await fsp.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile()) {
        files++;
        let sz = 0;
        try {
          sz = (await fsp.stat(full)).size;
        } catch {
          /* ignore */
        }
        bytes += sz;
        const rel = path.relative(dir, full).split(path.sep);
        const key = rel.length > 1 ? rel.slice(0, 2).join('/') : rel[0];
        const cur2 = byTop.get(key) || { files: 0, bytes: 0 };
        cur2.files++;
        cur2.bytes += sz;
        byTop.set(key, cur2);
      }
    }
  }
  return { files, bytes, byTop };
}

// ---------------------------------------------------------------------------
// 各源的抓取
// ---------------------------------------------------------------------------

async function fetchKenney() {
  const dest = path.join(RESERVE, 'kenney');
  const archivePath = path.join(ARCHIVES, KENNEY.archive);
  const source = { ...KENNEY, extractedTo: 'kenney' };

  if (LIST_ONLY) {
    log(`\n[Kenney] ${KENNEY.url}`);
    log(`  解压后 → ${path.relative(ROOT, dest)}/  （该快照约 252 MB）`);
    return { ...source, totalBytes: 0, fileCount: 0 };
  }

  if (CHECK_ONLY) {
    if (!(await exists(dest))) return { ...source, ok: false, reason: '未抓取' };
    const t = await walkTree(dest);
    return { ...source, ok: true, fileCount: t.files, totalBytes: t.bytes, archiveSha256: null };
  }

  // 已解压过则直接跳过（.reserve-ok 标记），有标记时**不做全量遍历**——
  // 5 万+ 文件的 stat 在本环境会被安全层整进程杀掉（SIGTERM，无任何日志）。
  // 标记里同时存 byTop 套件清单，跳过时索引照样有分套件统计。
  let marker = await readMarker(dest);
  let t = { files: 0, bytes: 0, byTop: new Map() };
  if (marker && marker.commit === KENNEY.commit) {
    t.files = marker.fileCount;
    t.bytes = marker.bytes;
    t.byTop = new Map(Object.entries(marker.byTop ?? {}));
    log(`[Kenney] 已就绪（${t.files} 个文件 / ${mb(t.bytes)}），跳过下载与解压`);
  } else {
    t = await walkTree(dest);
    if (t.files > 1000) {
      // 兼容「解压成功但未来得及写标记就崩溃」的目录：文件数过千即视为已完成
      marker = {
        commit: KENNEY.commit,
        fileCount: t.files,
        bytes: t.bytes,
        byTop: Object.fromEntries(t.byTop),
      };
      log(`[Kenney] 已就绪（${t.files} 个文件 / ${mb(t.bytes)}），跳过下载与解压`);
    } else {
      if (t.files > 0) {
        log(`[Kenney] 发现 ${t.files} 个残留文件（上次中断），清理后重新解压`);
        await rmSoft(dest, '不完整的 kenney 目录');
      }
      await fsp.mkdir(dest, { recursive: true });
      // 压缩包复用：128MB 没必要反复下；先做 gzip 完整性预检再决定是否重下
      let dl;
      if ((await exists(archivePath)) && gzipOk(archivePath)) {
        dl = { bytes: (await fsp.stat(archivePath)).size, sha256: await sha256File(archivePath) };
        log(`[Kenney] 复用已存在的压缩包 ${mb(dl.bytes)}  sha256=${dl.sha256.slice(0, 16)}…`);
      } else {
        log(`\n[Kenney] 下载全库快照 @ ${KENNEY.commit.slice(0, 7)} …`);
        dl = await download(KENNEY.url, archivePath);
        log(`[Kenney] 压缩包 ${mb(dl.bytes)}  sha256=${dl.sha256.slice(0, 16)}…`);
      }
      source.archiveBytes = dl.bytes;
      source.archiveSha256 = dl.sha256;

      log('[Kenney] 解压（5 万余文件，稍候）…');
      execFileSync(
        'tar',
        ['-xzf', msysPath(archivePath), '-C', msysPath(dest), '--strip-components=1'],
        { stdio: 'inherit' },
      );
      t = await walkTree(dest);
      marker = {
        commit: KENNEY.commit,
        fileCount: t.files,
        bytes: t.bytes,
        byTop: Object.fromEntries(t.byTop),
      };
      log(`[Kenney] 落盘 ${t.files} 个文件 / ${mb(t.bytes)}`);
    }
  }
  await writeMarker(dest, marker);
  if (!KEEP_ARCHIVES) await rmSoft(archivePath, 'Kenney 压缩包');

  source.fileCount = t.files;
  source.totalBytes = t.bytes;
  source.byTop = Object.fromEntries([...t.byTop.entries()].sort((a, b) => b[1].bytes - a[1].bytes));
  return source;
}

async function fetchPolyHaven() {
  const dest = path.join(RESERVE, 'polyhaven');
  const source = { ...POLYHAVEN, extractedTo: 'polyhaven', files: [] };
  delete source.byCategory;
  delete source.bySlug;

  log('\n[PolyHaven] 查询素材清单 …');
  // 离线兜底：清单接口查不到时，从磁盘上已下载的文件名反推（slug_res.hdr），
  // 保证断网状态下也能重建 manifest、不丢已抓到的内容。
  let jobs;
  try {
    const all = await (await fetch('https://api.polyhaven.com/assets?t=hdris')).json();

    // 展开选择规则
    const wanted = new Map(); // slug -> res（后面的显式 slug 覆盖分类规则）
    for (const rule of POLYHAVEN.byCategory) {
      const hits = Object.keys(all).filter((s) =>
        (all[s].categories || []).some((c) => c.includes(rule.category)),
      );
      for (const s of hits) wanted.set(s, rule.res);
      log(`[PolyHaven] 分类「${rule.category}」→ ${hits.length} 张 @ ${rule.res}`);
    }
    for (const rule of POLYHAVEN.bySlug) {
      if (!all[rule.slug]) {
        log(`[PolyHaven] ⚠ 未找到 ${rule.slug}，跳过`);
        continue;
      }
      wanted.set(rule.slug, rule.res);
    }

    if (LIST_ONLY) {
      for (const [s, r] of wanted) log(`  ${r}  ${s}`);
      return source;
    }

    jobs = [...wanted.entries()].map(([slug, res]) => ({ slug, res }));
  } catch (e) {
    log(`[PolyHaven] ⚠ 清单查询失败（${String(e.message).slice(0, 60)}），改为从磁盘已下载文件推导`);
    if (LIST_ONLY) return source;
    const existing = await fsp.readdir(dest).catch(() => []);
    jobs = existing
      .map((f) => /^(.*)_(1k|2k|4k|8k|16k)\.hdr$/.exec(f))
      .filter(Boolean)
      .map((m) => ({ slug: m[1], res: m[2] }));
  }
  log(`[PolyHaven] 共 ${jobs.length} 个 HDRI，开始下载 …`);

  await pool(jobs, 6, async ({ slug, res }, idx) => {
    const outPath = path.join(dest, `${slug}_${res}.hdr`);
    try {
      if (await exists(outPath)) {
        const st = await fsp.stat(outPath);
        if (st.size > 1024) {
          source.files.push({ path: `polyhaven/${slug}_${res}.hdr`, bytes: st.size, res, slug });
          return;
        }
      }
      if (CHECK_ONLY) {
        source.files.push({ path: `polyhaven/${slug}_${res}.hdr`, bytes: 0, missing: true, res, slug });
        return;
      }
      const info = await (await fetch(`https://api.polyhaven.com/files/${slug}`)).json();
      const entry = (info.hdri || {})[res]?.hdr;
      if (!entry) throw new Error(`无 ${res} 档 hdr`);
      const got = await download(entry.url, outPath);
      source.files.push({
        path: `polyhaven/${slug}_${res}.hdr`,
        bytes: got.bytes,
        sha256: got.sha256,
        md5: entry.md5,
        url: entry.url,
        res,
        slug,
      });
      if ((idx + 1) % 10 === 0) log(`[PolyHaven] ${idx + 1}/${jobs.length} …`);
    } catch (e) {
      // 离线兜底：只要文件已经在盘上且大小正常，就当作已就绪记录
      let recovered = null;
      try {
        const st = await fsp.stat(outPath);
        if (st.size > 1024) recovered = st.size;
      } catch {
        /* 文件不在盘上 */
      }
      if (recovered) {
        source.files.push({
          path: `polyhaven/${slug}_${res}.hdr`,
          bytes: recovered,
          res,
          slug,
          note: '从磁盘恢复（本次未联网校验）',
        });
      } else {
        log(`[PolyHaven] ⚠ ${slug} (${res}) 失败: ${e.message}`);
        source.files.push({
          path: `polyhaven/${slug}_${res}.hdr`,
          bytes: 0,
          failed: e.message,
          res,
          slug,
        });
      }
    }
  });

  return source;
}

/** 按 queries 关键词调 API 检索 assetId，与手工 ids 合并去重后截到 maxTotal。 */
async function resolveAmbientCGIds() {
  const merged = [...AMBIENTCG.ids];
  const seen = new Set(merged);
  for (const { q, limit } of AMBIENTCG.queries ?? []) {
    try {
      const res = await fetch(
        `https://ambientcg.com/api/v2/full_json?q=${encodeURIComponent(q)}&type=Material&limit=100`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const ids = (data.foundAssets ?? []).map((a) => a.assetId).filter(Boolean).slice(0, limit);
      let added = 0;
      for (const id of ids) {
        if (merged.length >= AMBIENTCG.maxTotal) break;
        if (!seen.has(id)) {
          seen.add(id);
          merged.push(id);
          added++;
        }
      }
      log(`[ambientCG] 检索「${q}」→ ${ids.length} 命中，补 ${added} 套`);
    } catch (e) {
      log(`[ambientCG] ⚠ 检索「${q}」失败（${String(e.message).slice(0, 60)}），跳过该词`);
    }
    if (merged.length >= AMBIENTCG.maxTotal) break;
  }
  return merged;
}

async function fetchAmbientCG() {
  const dest = path.join(RESERVE, 'ambientcg');
  const source = {
    id: AMBIENTCG.id,
    license: AMBIENTCG.license,
    homepage: AMBIENTCG.homepage,
    note: AMBIENTCG.note,
    resolution: AMBIENTCG.res,
    extractedTo: 'ambientcg',
    files: [],
  };

  if (LIST_ONLY) {
    const ids = CHECK_ONLY ? AMBIENTCG.ids : await resolveAmbientCGIds();
    ids.forEach((id) => log(`  ${AMBIENTCG.res}  ${id}  ${AMBIENTCG.zipUrl(id)}`));
    return source;
  }

  const ids = await resolveAmbientCGIds();
  log(`\n[ambientCG] 共 ${ids.length} 套材质 @ ${AMBIENTCG.res}，开始下载 …`);
  await pool(ids, 4, async (id, idx) => {
    const zipName = `${id}_${AMBIENTCG.res}-JPG.zip`;
    const zipPath = path.join(ARCHIVES, 'ambientcg', zipName);
    const outDir = path.join(dest, id);
    try {
      if (!CHECK_ONLY) {
        // 已解压过则跳过（.reserve-ok 标记），重跑不再重复下载
        const marker = await readMarker(outDir);
        if (marker && marker.id === id && marker.res === AMBIENTCG.res && (await exists(outDir))) {
          source.files.push({
            id,
            path: `ambientcg/${id}`,
            bytes: marker.bytes,
            fileCount: marker.fileCount,
          });
          log(`[ambientCG] ${idx + 1}/${AMBIENTCG.ids.length} ${id} 已就绪，跳过`);
          return;
        }
        const got = await download(AMBIENTCG.zipUrl(id), zipPath);
        await rmSoft(outDir, id + ' 旧目录');
        await fsp.mkdir(outDir, { recursive: true });
        execFileSync('unzip', ['-q', '-o', msysPath(zipPath), '-d', msysPath(outDir)], {
          stdio: 'inherit',
        });
        if (!KEEP_ARCHIVES) await rmSoft(zipPath, id + ' 压缩包');
        const t = await walkTree(outDir);
        await writeMarker(outDir, { id, res: AMBIENTCG.res, fileCount: t.files, bytes: t.bytes });
        source.files.push({
          id,
          path: `ambientcg/${id}`,
          bytes: t.bytes,
          fileCount: t.files,
          archiveSha256: got.sha256,
          url: AMBIENTCG.zipUrl(id),
        });
        log(`[ambientCG] ${idx + 1}/${AMBIENTCG.ids.length} ${id} → ${t.files} 张贴图 / ${mb(t.bytes)}`);
      } else if (await exists(outDir)) {
        const t = await walkTree(outDir);
        source.files.push({ id, path: `ambientcg/${id}`, bytes: t.bytes, fileCount: t.files });
      } else {
        source.files.push({ id, path: `ambientcg/${id}`, bytes: 0, missing: true });
      }
    } catch (e) {
      // 离线/断流兜底：已解压出文件就按磁盘现状记录，不让单套失败拖垮清单
      let recovered = null;
      try {
        const t = await walkTree(outDir);
        if (t.files > 0) recovered = t;
      } catch {
        /* 目录不可读 */
      }
      if (recovered) {
        source.files.push({
          id,
          path: `ambientcg/${id}`,
          bytes: recovered.bytes,
          fileCount: recovered.files,
          note: '从磁盘恢复（本次未联网校验）',
        });
      } else {
        log(`[ambientCG] ⚠ ${id} 失败: ${e.message}`);
        source.files.push({ id, path: `ambientcg/${id}`, bytes: 0, failed: e.message });
      }
    }
  });

  return source;
}

/** Quaternius：gdown 按 Drive 文件夹拉 zip（zip 只解 GLTF 包，其余格式留压缩包备用）。 */
async function fetchQuaternius() {
  const dest = path.join(RESERVE, 'quaternius');
  const source = {
    ...QUATERNIUS,
    extractedTo: 'quaternius',
    packs: undefined,
    folders: QUATERNIUS.packs.map((p) => p.pack),
    files: [],
  };

  if (LIST_ONLY) {
    log('\n[Quaternius] 计划抓取的 Drive 文件夹：');
    for (const p of QUATERNIUS.packs) log(`  ${p.pack.padEnd(22)} https://drive.google.com/drive/folders/${p.folderId}`);
    return source;
  }

  // 依赖自检：gdown 必须在受管 venv 里（可用 QUATERNIUS_PYTHON 覆盖）
  const pyCandidates = [
    process.env.QUATERNIUS_PYTHON,
    'C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe',
  ].filter(Boolean);
  let py = null;
  for (const c of pyCandidates) {
    if (await exists(c)) {
      py = c;
      break;
    }
  }
  if (!py) {
    log('[Quaternius] ⚠ 未找到受管 python，跳过本源（手动装 gdown 后重跑可补）');
    source.skipped = 'no-python';
    return source;
  }

  const proxy = resolveQuaterniusProxy();
  log(`\n[Quaternius] ${QUATERNIUS.packs.length} 个包，gdown 代理 = ${proxy}`);

  for (const { pack, folderId } of QUATERNIUS.packs) {
    const packDir = path.join(dest, pack);
    const marker = await readMarker(packDir);
    if (marker && marker.folderId === folderId && (await exists(packDir))) {
      source.files.push({
        pack,
        path: `quaternius/${pack}`,
        bytes: marker.bytes,
        fileCount: marker.fileCount,
      });
      log(`[Quaternius] ${pack} 已就绪（${marker.fileCount} 个文件 / ${mb(marker.bytes)}），跳过`);
      continue;
    }
    try {
      await fsp.mkdir(packDir, { recursive: true });
      // 关键：必须清掉 env 里的 http_proxy 等变量 —— 本机 env 里钉着一个已失效的
      // 127.0.0.1:5301，gdown 内部有一段请求不接收 --proxy、回落 env → 502。
      // 清干净后统一走 --proxy 指定的端口。
      const cleanEnv = { ...process.env };
      for (const k of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY']) {
        delete cleanEnv[k];
      }
      execFileSync(
        py,
        [
          '-m', 'gdown',
          '--folder', `https://drive.google.com/drive/folders/${folderId}`,
          '-O', packDir,
          '--proxy', proxy,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'], timeout: 600_000, env: cleanEnv },
      );
      const t = await walkTree(packDir);
      if (t.files === 0) throw new Error('下载后目录为空');
      await writeMarker(packDir, { pack, folderId, fileCount: t.files, bytes: t.bytes });
      source.files.push({ pack, path: `quaternius/${pack}`, bytes: t.bytes, fileCount: t.files });
      log(`[Quaternius] ${pack} → ${t.files} 个文件 / ${mb(t.bytes)}`);
    } catch (e) {
      const msg = String(e.message ?? e).slice(0, 100);
      log(`[Quaternius] ⚠ ${pack} 失败: ${msg}`);
      source.files.push({ pack, path: `quaternius/${pack}`, bytes: 0, failed: msg });
    }
  }

  return source;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function writeIndex(manifest) {
  const L = [];
  L.push('# 备用素材库索引（.workbuddy/asset-cache/）');
  L.push('');
  L.push('> 本目录**不进版本库、不进 public/、不参与构建**（`.gitignore` 已忽略）。');
  L.push('> 由 `node scripts/fetch-asset-reserve.mjs` 生成，可重复执行（幂等）。');
  L.push('> 要用某个素材时：从库里挑出来 → 复制到 `public/assets/` → 登记到对应 `CREDITS.md`。');
  L.push('');
  L.push(`生成时间：${manifest.generatedAt}`);
  L.push('');
  L.push(`**总计 ${manifest.totals.files} 个文件 / ${mb(manifest.totals.bytes)}**`);
  L.push('');
  L.push('## 源');
  L.push('');
  L.push('| 源 | 许可 | 体积 | 说明 |');
  L.push('| -- | ---- | ---- | ---- |');
  for (const s of manifest.sources) {
    const size = s.totalBytes ?? (s.files || []).reduce((a, f) => a + (f.bytes || 0), 0);
    L.push(`| \`${s.id}\` | ${s.license} | ${mb(size)} | ${s.note || ''} |`);
  }
  L.push('');

  const kenney = manifest.sources.find((s) => s.id === 'kenney');
  if (kenney && kenney.byTop) {
    L.push('## Kenney 全库（按套件）');
    L.push('');
    L.push('本游戏**高相关**的套件已用 ✅ 标出。');
    L.push('');
    L.push('| 套件 | 文件 | 体积 | 备注 |');
    L.push('| ---- | ---- | ---- | ---- |');
    const HIGHLIGHT = {
      '3d/space': '✅ 已在用（舰/敌/Boss/结构物来源）',
      '3d/space-station': '✅ 空间站模块，尚未接入',
      '3d/modular-space': '✅ 太空站走廊/舱段/gate，尚未接入',
      '3d/weapon': '✅ 武器模型，尚未接入',
      '3d/prototype': '▲ 灰盒，适合关卡搭景',
      '2d/Skyboxes': '✅ 天空盒',
      '2d/Planets': '✅ 行星球体贴图',
      '2d/Particle Pack': '✅ 粒子/特效贴图',
      '2d/Smoke Particles': '✅ 烟尘序列帧',
      '2d/Explosion Pack': '✅ 爆炸序列帧',
      '2d/Light Masks': '✅ 光罩/加色叠加贴图',
      'ui/UI Pack - Sci-fi': '✅ 科幻风 HUD 素材',
      'icons/Input Prompts': '✅ 键位提示图标',
    };
    for (const [k, v] of Object.entries(kenney.byTop).slice(0, 200)) {
      L.push(`| \`${k}\` | ${v.files} | ${mb(v.bytes)} | ${HIGHLIGHT[k] || ''} |`);
    }
    L.push('');
  }

  const ph = manifest.sources.find((s) => s.id === 'polyhaven');
  if (ph) {
    L.push('## Poly Haven HDRI');
    L.push('');
    L.push(`共 ${(ph.files || []).length} 张。分辨率 1k≈1.4MB / 2k≈5.1MB / 4k≈18-26MB。`);
    L.push(`其中 \`moon_lab_4k.hdr\` 是唯一太空站环境，\`*_puresky_1k.hdr\` 是天光渐变（${(ph.files || []).filter((f) => f.slug && f.slug.includes('puresky')).length} 张）。`);
    L.push('');
  }

  const ac = manifest.sources.find((s) => s.id === 'ambientcg');
  if (ac) {
    L.push('## ambientCG 材质');
    L.push('');
    L.push(`共 ${(ac.files || []).length} 套 @ ${ac.resolution}。每套含 Color / Normal / Roughness / AO / Displacement 等贴图。`);
    L.push('');
    L.push('| 套件 | 贴图 | 体积 |');
    L.push('| ---- | ---- | ---- |');
    for (const f of ac.files || []) L.push(`| \`${f.id}\` | ${f.fileCount ?? '-'} | ${mb(f.bytes || 0)} |`);
    L.push('');
  }

  const qt = manifest.sources.find((s) => s.id === 'quaternius');
  if (qt) {
    L.push('## Quaternius 模型包');
    L.push('');
    L.push(`共 ${(qt.files || []).filter((f) => !f.failed).length}/${(qt.files || []).length} 个包。高模 GLTF/FBX/OBJ，Kenney 低模的升级备选（第三批「模型材质」的素材来源）。`);
    L.push('');
    L.push('| 包 | 文件 | 体积 |');
    L.push('| -- | ---- | ---- |');
    for (const f of qt.files || []) {
      L.push(`| \`${f.pack}\` | ${f.fileCount ?? '-'} | ${f.failed ? `⚠ ${f.failed}` : mb(f.bytes || 0)} |`);
    }
    L.push('');
  }

  L.push('## 复验');
  L.push('');
  L.push('```bash');
  L.push('node scripts/fetch-asset-reserve.mjs --check   # 只校验，不下载');
  L.push('node scripts/fetch-asset-reserve.mjs --list    # 列出抓取清单');
  L.push('```');
  L.push('');
  return L.join('\n');
}

async function main() {
  await fsp.mkdir(RESERVE, { recursive: true });
  log(`备用库目录：${path.relative(ROOT, RESERVE)}`);
  if (LIST_ONLY) log('（--list：只列清单，不下载）');

  const sources = [];
  // 单源失败不拖垮全局：备用库的价值在「已抓到的部分」，清单照常产出
  for (const fetcher of [fetchKenney, fetchPolyHaven, fetchAmbientCG, fetchQuaternius]) {
    try {
      sources.push(await fetcher());
    } catch (e) {
      log(`⚠ 源 ${fetcher.name} 整体失败（保留其余结果）: ${String(e.message).slice(0, 90)}`);
    }
  }

  // 汇总
  let files = 0;
  let bytes = 0;
  for (const s of sources) {
    if (typeof s.fileCount === 'number') files += s.fileCount;
    if (typeof s.totalBytes === 'number') bytes += s.totalBytes;
    for (const f of s.files || []) {
      files += f.fileCount ?? (f.bytes > 0 ? 1 : 0);
      bytes += f.bytes || 0;
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    note: '备用素材库（多源 CC0）。不进版本库、不进 public/、不参与构建。',
    reserveDir: path.relative(ROOT, RESERVE),
    sources,
    totals: { files, bytes },
  };
  await fsp.writeFile(path.join(RESERVE, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fsp.writeFile(path.join(RESERVE, 'INDEX.md'), writeIndex(manifest));

  log('\n================ 汇总 ================');
  for (const s of sources) {
    const size = s.totalBytes ?? (s.files || []).reduce((a, f) => a + (f.bytes || 0), 0);
    const bad = (s.files || []).filter((f) => f.failed || f.missing).length;
    log(`  ${s.id.padEnd(12)} ${mb(size).padStart(10)}  ${bad ? `⚠ ${bad} 项异常` : 'ok'}`);
  }
  log(`  ${'总计'.padEnd(11)} ${mb(bytes).padStart(10)}  ${files} 个文件`);
  log(`\n索引：${path.relative(ROOT, RESERVE)}/INDEX.md`);
  log(`清单：${path.relative(ROOT, RESERVE)}/manifest.json`);
}

main().catch((e) => {
  console.error('抓取失败:', e);
  process.exit(1);
});
