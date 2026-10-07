// 判定 GLB 模型的机头方向：沿机身轴（Z）切片，统计每片的 X 宽度分布。
// speeder/fighter 类模型机头窄、机尾翼展宽 → 宽度最小的一端就是机头。
// 用法：node scripts/analyze-glb-nose.mjs [ships|enemies|bosses]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'ships';
const root = path.join(process.cwd(), 'public/assets/models', dir);

function readGlb(file) {
  const buf = fs.readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const off = 20 + jsonLen;
  const binLen = buf.readUInt32LE(off);
  const bin = buf.subarray(off + 8, off + 8 + binLen);
  return { json, bin };
}

const COMP = { 5120: [1, 'b'], 5121: [1, 'B'], 5122: [2, 'h'], 5123: [2, 'H'], 5125: [4, 'I'], 5126: [4, 'f'] };

function readPositions(json, bin, accIdx) {
  const acc = json.accessors[accIdx];
  const bv = json.bufferViews[acc.bufferView];
  const [bytes, fmt] = COMP[acc.componentType];
  const stride = bv.byteStride || bytes * 3;
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0) + i * stride;
    out.push([
      bin[`read${fmt === 'f' ? 'Float' : 'Int'}LE`](base) ?? bin.readInt8(base),
      0,
      0,
    ]);
  }
  // 直接用 DataView 免去 Buffer 方法名分派
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let i = 0; i < acc.count; i++) {
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0) + i * stride;
    out[i] = [dv[fmt === 'f' ? 'getFloat32' : 'getInt16'](base, true), 0, dv[fmt === 'f' ? 'getFloat32' : 'getInt16'](base + bytes * 2, true)];
    out[i][1] = dv[fmt === 'f' ? 'getFloat32' : 'getInt16'](base + bytes, true);
  }
  return out;
}

for (const file of fs.readdirSync(root).filter((f) => f.endsWith('.glb'))) {
  const { json, bin } = readGlb(path.join(root, file));
  const pts = [];
  for (const mesh of json.meshes)
    for (const prim of mesh.primitives) pts.push(...readPositions(json, bin, prim.attributes.POSITION));

  // 全局 Z 范围（几何已中心化）
  let zmin = Infinity, zmax = -Infinity;
  for (const p of pts) { zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]); }
  const N = 12;
  const slices = Array.from({ length: N }, () => ({ xmin: Infinity, xmax: -Infinity, n: 0 }));
  for (const p of pts) {
    const s = Math.min(N - 1, Math.floor(((p[2] - zmin) / (zmax - zmin)) * N));
    const sl = slices[s];
    sl.xmin = Math.min(sl.xmin, p[0]); sl.xmax = Math.max(sl.xmax, p[0]); sl.n++;
  }
  const width = slices.map((s) => +(s.xmax - s.xmin).toFixed(2));
  const noseNarrow = width[0] <= width[N - 1];
  console.log(
    `${file.padEnd(26)} Z ${zmin.toFixed(2)}→${zmax.toFixed(2)}  切片X宽度: ${width.join(' ')}  → 机头在 ${noseNarrow ? '-Z（zmin 端窄）' : '+Z（zmax 端窄）'}`,
  );
}
