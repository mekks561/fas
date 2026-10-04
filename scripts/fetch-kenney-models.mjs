/**
 * 从 Kenney 素材库（CC0）抓取真实 3D 模型，替换 public/assets/models 下的占位模型。
 *
 * 背景：原先这批 .glb 由 scripts/generate-models.js 生成，存在两个致命问题：
 *   1) GLB 文件头写错 + 两个 chunk 头缺失 → 45/45 全部不是合法 GLB，任何加载器都拒收
 *   2) 每个模型只有 12–32 个三角面（一个立方体就是 12 面）→ 即使修好格式也无画质可言
 * 因此本脚本改为从外部 CC0 素材库拉真实模型，并逐个校验后再落盘。
 *
 * 用法：
 *   node scripts/fetch-kenney-models.mjs           # 抓取并校验
 *   node scripts/fetch-kenney-models.mjs --check   # 只校验已落盘的文件，不下载
 *
 * 素材来源：https://github.com/shorepine/kenney （Kenney 全套 CC0 素材的镜像，路径稳定）
 * 上游作者：Kenney — https://kenney.nl ｜ 许可：CC0 1.0 Universal（可商用、免署名）
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MODELS_DIR = path.join(ROOT, 'public/assets/models');

/** 钉死的 commit —— 保证任何时候跑都拿到同一批字节 */
const KENNEY_SHA = '3694c6879e487c108f55677be7dd2ca75b07cc3b';
const KENNEY_KIT = 'space';
const CDN = `https://cdn.jsdelivr.net/gh/shorepine/kenney@${KENNEY_SHA}/3d/${KENNEY_KIT}`;

/**
 * 映射表：游戏内目标文件 ← Kenney 源模型
 * 目标文件名沿用项目既有命名（<类别>/<id>.glb），因此不需要改动任何路径引用。
 *
 * 注意：Kenney space 套件只有 8 个飞船外壳（craft_*），而游戏需要 6 艘玩家舰 +
 * 8 种敌人。其中 3 种敌人复用了玩家舰的外壳，靠战斗配色（红系）与缩放区分。
 * 这是素材数量约束下的取舍，已在 CREDITS.md 中记录。
 */
const MAP = [
  // ---- 玩家舰（6）----
  ['ships/ship-fighter.glb', 'craft_speederA'],
  ['ships/ship-bomber.glb', 'craft_cargoA'],
  ['ships/ship-cruiser.glb', 'craft_cargoB'],
  ['ships/ship-stealth.glb', 'craft_speederC'],
  ['ships/ship-corvette.glb', 'craft_speederB'],
  ['ships/ship-dreadnought.glb', 'craft_miner'],

  // ---- 敌人（8）----
  ['enemies/enemy-scout.glb', 'craft_speederD'],
  ['enemies/enemy-fighter.glb', 'craft_racer'],
  ['enemies/enemy-bomber.glb', 'craft_cargoA'], // 复用玩家轰炸机外壳，红系配色
  ['enemies/enemy-tank.glb', 'turret_double'],
  ['enemies/enemy-assassin.glb', 'alien'],
  ['enemies/enemy-drone.glb', 'meteor_detailed'],
  ['enemies/enemy-corvette.glb', 'craft_speederA'], // 复用玩家战斗机外壳，红系配色
  ['enemies/enemy-destroyer.glb', 'craft_cargoB'], // 复用玩家巡洋舰外壳，红系配色

  // ---- Boss（2 个游戏中实际用到的模型类型）----
  ['bosses/boss-sentinel.glb', 'satelliteDish_large'],
  ['bosses/boss-overlord.glb', 'hangar_largeA'],

  // ---- 场景结构物（本轮新增）----
  // 小行星带是场景里数量最多的程序化物体（40 个），原先由 createAsteroid 用
  // 「球体 + 方盒」拼出来。这里引入 9 种岩石/陨石外壳，运行时随机分配，
  // 让环绕玩家的小行星带不再是一堆同款方块。
  ['structures/meteor.glb', 'meteor'],
  ['structures/meteor_detailed.glb', 'meteor_detailed'],
  ['structures/meteor_half.glb', 'meteor_half'],
  ['structures/rock_largeA.glb', 'rock_largeA'],
  ['structures/rock_largeB.glb', 'rock_largeB'],
  ['structures/rock_crystalsLargeA.glb', 'rock_crystalsLargeA'],
  ['structures/rock_crystalsLargeB.glb', 'rock_crystalsLargeB'],
  ['structures/rocks_smallA.glb', 'rocks_smallA'],
  ['structures/rocks_smallB.glb', 'rocks_smallB'],

  // 空间站与卫星：场景里的两个远景参照物（原先也是程序化图元拼装）。
  // Kenney space 套件没有整装空间站，用大型机库外壳代替；卫星用带细节的碟形天线。
  ['structures/station-hangar.glb', 'hangar_largeB'],
  ['structures/satellite-dish.glb', 'satelliteDish_detailed'],
];

// ============ GLB 结构校验 ============
const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'

/** 按 glTF 2.0 规范解析并校验 GLB，返回结构报告 */
function inspectGlb(buf) {
  const problems = [];
  const head = { magic: null, version: null, declaredLength: null, chunks: [], triangles: null };

  if (buf.length < 20) {
    problems.push('文件不足 20 字节，连头部都不完整');
    return { problems, head };
  }

  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  const declaredLength = buf.readUInt32LE(8);
  head.magic = magic === GLB_MAGIC ? 'glTF' : `0x${magic.toString(16)}`;
  head.version = version;
  head.declaredLength = declaredLength;

  if (magic !== GLB_MAGIC) problems.push(`magic 不是 'glTF'，实际 ${head.magic}`);
  if (version !== 2) problems.push(`version 应为 2，实际 ${version}`);
  if (declaredLength !== buf.length) {
    problems.push(`头部声明总长 ${declaredLength} 与实际文件 ${buf.length} 不符`);
  }

  // 依次读取 chunk（必须是 长度4B + 类型4B + 数据）
  let offset = 12;
  let json = null;
  while (offset + 8 <= buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    if (dataStart + chunkLength > buf.length) {
      problems.push(`chunk@${offset} 声明长度 ${chunkLength} 超出文件末尾`);
      break;
    }
    const typeName =
      chunkType === CHUNK_JSON ? 'JSON' : chunkType === CHUNK_BIN ? 'BIN' : `0x${chunkType.toString(16)}`;
    head.chunks.push(`${typeName}(${chunkLength})`);
    if (chunkType === CHUNK_JSON && json === null) {
      try {
        json = JSON.parse(buf.subarray(dataStart, dataStart + chunkLength).toString('utf8'));
      } catch (e) {
        problems.push(`JSON chunk 解析失败: ${e.message}`);
      }
    }
    offset = dataStart + chunkLength;
  }

  if (head.chunks.length === 0) problems.push('不含任何 chunk（chunk 头缺失）');
  if (json) {
    // 规范要求：第 0 个 chunk 必须是 JSON，第 1 个（若有）必须是 BIN
    if (!head.chunks[0]?.startsWith('JSON')) problems.push('第一个 chunk 不是 JSON');
    if (head.chunks[1] && !head.chunks[1].startsWith('BIN')) problems.push('第二个 chunk 不是 BIN');

    let triangles = 0;
    for (const mesh of json.meshes ?? []) {
      for (const prim of mesh.primitives ?? []) {
        const acc = prim.indices != null ? json.accessors?.[prim.indices] : null;
        if (acc?.count) triangles += Math.floor(acc.count / 3);
      }
    }
    head.triangles = triangles;
    head.meshes = json.meshes?.length ?? 0;
    head.materials = json.materials?.length ?? 0;
    head.images = json.images?.length ?? 0;
    if (triangles === 0) problems.push('三角面数为 0');
  } else if (!problems.length) {
    problems.push('没有可解析的 JSON chunk');
  }

  return { problems, head };
}

/**
 * 低于这个三角面数就认为不是可用素材（一个立方体是 12 面，原先那批假模型是 12–32 面）。
 * 默认 100 —— 对玩家舰/敌人这类需要看见细节的主角模型适用。
 */
const DEFAULT_MIN_TRIANGLES = 100;

/**
 * 按目标路径前缀覆盖阈值。
 *
 * 场景装饰类（小行星）是远景低模：Kenney 的整块陨石只有 44–68 面，
 * 强行要求 100 面就只能全用 384 面的水晶岩，反而丢掉多样性；
 * 而且小行星带一次渲染 40 个实例，低面数是优点而非缺陷。
 * 但下限仍设在 40，高于假素材的 12–32 面 —— 阈值要拦的是「脚本烘出来的方块」，
 * 不是「面数少的真素材」。
 */
const MIN_TRIANGLES_OVERRIDE = [
  ['structures/', 40],
];

function minTrianglesFor(targetRel) {
  for (const [prefix, value] of MIN_TRIANGLES_OVERRIDE) {
    if (targetRel.startsWith(prefix)) return value;
  }
  return DEFAULT_MIN_TRIANGLES;
}

async function fetchOne(targetRel, sourceName) {
  const url = `${CDN}/${sourceName}.glb`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const report = [];
  let failed = 0;

  for (const [targetRel, sourceName] of MAP) {
    const targetAbs = path.join(MODELS_DIR, targetRel);
    let buf;

    if (checkOnly) {
      if (!existsSync(targetAbs)) {
        report.push([targetRel, '—', '—', ' MISSING']);
        failed++;
        continue;
      }
      buf = await readFile(targetAbs);
    } else {
      try {
        buf = await fetchOne(targetRel, sourceName);
      } catch (e) {
        report.push([targetRel, sourceName, '—', ` 下载失败: ${e.message}`]);
        failed++;
        continue;
      }
    }

    const { problems, head } = inspectGlb(buf);
    const minTriangles = minTrianglesFor(targetRel);
    const tooSimple = head.triangles !== null && head.triangles < minTriangles;
    if (tooSimple) problems.push(`三角面数 ${head.triangles} 低于阈值 ${minTriangles}`);

    if (problems.length === 0) {
      if (!checkOnly) {
        await mkdir(path.dirname(targetAbs), { recursive: true });
        await writeFile(targetAbs, buf);
      }
      report.push([targetRel, sourceName, `${head.triangles} 三角 / ${head.materials} 材质`, ' ✅']);
    } else {
      failed++;
      report.push([targetRel, sourceName, head.triangles ?? '—', ` ❌ ${problems.join('; ')}`]);
    }
  }

  // 输出报告
  const w = Math.max(...report.map((r) => r[0].length)) + 2;
  console.log(`\n${checkOnly ? '校验' : '抓取'} Kenney space 套件 @ ${KENNEY_SHA.slice(0, 8)}\n`);
  for (const [target, source, info, status] of report) {
    console.log(`  ${target.padEnd(w)} ← ${source.padEnd(22)} ${String(info).padEnd(20)}${status}`);
  }
  console.log(`\n合计 ${report.length} 个，失败 ${failed} 个`);

  if (failed > 0) {
    console.error('\n有文件未通过校验，请检查上方报告。');
    process.exit(1);
  }
  console.log('全部通过校验。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
