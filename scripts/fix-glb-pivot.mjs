// 修复 Kenney GLB 的根节点残留平移：把每个模型的几何中心挪到原点。
//
// 问题：Kenney 官方 GLB 的根节点（如 craft_speederA）带 translation=[2,0,1.5]
// （Blender 导出时模型摆在场景 (2,0,1.5) 处）。PlayCanvas 的
// instantiateRenderEntity() 以根节点为 pivot，于是模型实例整体悬在
// 偏移位置——玩家舰不在逻辑位置上、与尾焰粒子脱节，看起来「模型错位」。
// 另外 Kenney 模型以底部为原点（min.y=0），中心修正一并解决 Y 偏移。
//
// 做法：算出世界 AABB 中心 c，把根节点 translation 从 t 改为 t - c
// （根节点 rotation=identity、scale=1，所以直接在 translation 上减）。
// 只重写 JSON chunk，bin chunk 原样保留。
//
// 用法：node scripts/fix-glb-pivot.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOTS = ['ships', 'enemies', 'bosses'];

function readGlb(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binOff = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binOff);
  const bin = buf.subarray(binOff + 8, binOff + 8 + binLen);
  return { json, bin };
}

function matMul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function matFromNode(n) {
  if (n.matrix) return n.matrix;
  let m = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const t = n.translation || [0, 0, 0];
  const r = n.rotation || [0, 0, 0, 1];
  const s = n.scale || [1, 1, 1];
  const [x, y, z, w] = r;
  const R = [
    1-2*(y*y+z*z), 2*(x*y+z*w),   2*(x*z-y*w),   0,
    2*(x*y-z*w),   1-2*(x*x+z*z), 2*(y*z+x*w),   0,
    2*(x*z+y*w),   2*(y*z-x*w),   1-2*(x*x+y*y), 0,
    0,             0,             0,             1,
  ];
  const S = [s[0],0,0,0, 0,s[1],0,0, 0,0,s[2],0, 0,0,0,1];
  const T = [1,0,0,0, 0,1,0,0, 0,0,1,0, t[0],t[1],t[2],1];
  return matMul(matMul(T, matMul(R, S)), m);
}

function applyMat(m, p) {
  return [
    m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12],
    m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13],
    m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14],
  ];
}

/** 世界 AABB 中心（遍历节点树，与 analyze-glb-geometry.mjs 同一套算法） */
function aabbCenter(json, bin) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const walk = (idx, parentM) => {
    const n = json.nodes[idx];
    const m = matMul(parentM, matFromNode(n));
    if (n.mesh !== undefined) {
      for (const prim of json.meshes[n.mesh].primitives) {
        const acc = json.accessors[prim.attributes.POSITION];
        if (!acc?.min || !acc?.max) continue;
        for (const x of [acc.min[0], acc.max[0]])
          for (const y of [acc.min[1], acc.max[1]])
            for (const z of [acc.min[2], acc.max[2]]) {
              const w = applyMat(m, [x, y, z]);
              for (let i = 0; i < 3; i++) {
                min[i] = Math.min(min[i], w[i]);
                max[i] = Math.max(max[i], w[i]);
              }
            }
      }
    }
    for (const c of n.children ?? []) walk(c, m);
  };
  const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  for (const s of json.scenes[json.scene ?? 0].nodes) walk(s, I);
  return min[0] === Infinity ? null : max.map((v, i) => (v + min[i]) / 2);
}

let fixed = 0;
for (const dir of ROOTS) {
  const root = path.join(process.cwd(), 'public/assets/models', dir);
  for (const file of fs.readdirSync(root).filter((f) => f.endsWith('.glb'))) {
    const p = path.join(root, file);
    const buf = fs.readFileSync(p);
    const { json, bin } = readGlb(buf);
    const center = aabbCenter(json, bin);
    if (!center) {
      console.log(`${dir}/${file}  无 POSITION 数据，跳过`);
      continue;
    }
    if (center.every((v) => Math.abs(v) < 1e-4)) {
      console.log(`${dir}/${file}  中心已在原点，跳过`);
      continue;
    }
    // 只修正「rotation=identity 且 scale=1」的根节点，此时世界位移 == translation
    const sceneRoots = json.scenes[json.scene ?? 0].nodes;
    let patched = 0;
    for (const ri of sceneRoots) {
      const n = json.nodes[ri];
      const r = n.rotation || [0, 0, 0, 1];
      const s = n.scale || [1, 1, 1];
      const identR = Math.abs(r[0]) + Math.abs(r[1]) + Math.abs(r[2]) < 1e-9 && Math.abs(r[3] - 1) < 1e-9;
      const identS = s.every((v) => Math.abs(v - 1) < 1e-9);
      if (!identR || !identS) {
        console.log(`${dir}/${file}  ⚠根节点带旋转/缩放，无法安全修正，跳过`);
        continue;
      }
      const t = n.translation || [0, 0, 0];
      n.translation = [t[0] - center[0], t[1] - center[1], t[2] - center[2]];
      patched++;
    }
    if (!patched) continue;

    if (DRY) {
      console.log(`${dir}/${file}  [dry] 将平移 (${center.map((v) => -v.toFixed(3)).join(', ')})`);
      continue;
    }
    // 重写 GLB：JSON chunk 4 字节对齐（空格填充），bin chunk 原样
    let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
    const pad = (4 - (jsonBuf.length % 4)) % 4;
    if (pad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad, 0x20)]);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0); // magic 'glTF'
    header.writeUInt32LE(2, 4); // version
    header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonBuf.length, 0);
    jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(bin.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN'
    fs.writeFileSync(p, Buffer.concat([header, jsonHeader, jsonBuf, binHeader, bin]));
    fixed++;
    console.log(`${dir}/${file}  已平移 (${center.map((v) => -v.toFixed(3)).join(', ')})，几何中心 → 原点`);
  }
}
console.log(`\n完成：${fixed} 个文件已修正${DRY ? '（dry run，未写入）' : ''}`);
