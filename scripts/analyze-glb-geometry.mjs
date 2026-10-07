// 诊断 GLB 模型的几何中心与机身朝向。
// 输出每个模型的世界包围盒（考虑节点变换）：
//   - center 偏离原点 → 实例化后模型「错位」的根源
//   - 最长轴 = 机身方向（glTF 约定 +Z 为前方；Kenney 素材常是 -Z 机头）
// 用法：node scripts/analyze-glb-geometry.mjs [ships|enemies|bosses]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'ships';
const root = path.join(process.cwd(), 'public/assets/models', dir);

function readGlb(file) {
  const buf = fs.readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  // bin chunk
  const off = 20 + jsonLen;
  const binLen = buf.readUInt32LE(off);
  const bin = buf.subarray(off + 8, off + 8 + binLen);
  return { json, bin };
}

function matFromNode(n) {
  if (n.matrix) return n.matrix; // column-major 16
  let m = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const t = n.translation || [0, 0, 0];
  const r = n.rotation || [0, 0, 0, 1]; // xyzw
  const s = n.scale || [1, 1, 1];
  // R from quaternion (column-major)
  const [x, y, z, w] = r;
  const R = [
    1-2*(y*y+z*z), 2*(x*y+z*w),   2*(x*z-y*w),   0,
    2*(x*y-z*w),   1-2*(x*x+z*z), 2*(y*z+x*w),   0,
    2*(x*z+y*w),   2*(y*z-x*w),   1-2*(x*x+y*y), 0,
    0,             0,             0,             1,
  ];
  // T * R * S (column-major multiply)
  const mul = (a, b) => {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r2 = 0; r2 < 4; r2++)
      for (let k = 0; k < 4; k++) o[c*4+r2] += a[k*4+r2] * b[c*4+k];
    return o;
  };
  const S = [s[0],0,0,0, 0,s[1],0,0, 0,0,s[2],0, 0,0,0,1];
  const T = [1,0,0,0, 0,1,0,0, 0,0,1,0, t[0],t[1],t[2],1];
  m = mul(mul(T, mul(R, S)), m);
  return m;
}

function applyMat(m, p) {
  return [
    m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12],
    m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13],
    m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14],
  ];
}

for (const file of fs.readdirSync(root).filter((f) => f.endsWith('.glb'))) {
  try {
    const { json, bin } = readGlb(path.join(root, file));
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    // 遍历场景节点树，累积世界矩阵
    const walk = (nodeIdx, parentM) => {
      const n = json.nodes[nodeIdx];
      const m = (() => {
        const local = matFromNode(n);
        const mul = (a, b) => {
          const o = new Array(16).fill(0);
          for (let c = 0; c < 4; c++) for (let r2 = 0; r2 < 4; r2++)
            for (let k = 0; k < 4; k++) o[c*4+r2] += a[k*4+r2] * b[c*4+k];
          return o;
        };
        return mul(parentM, local);
      })();
      if (n.mesh !== undefined) {
        const mesh = json.meshes[n.mesh];
        for (const prim of mesh.primitives) {
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
    const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    for (const s of json.scenes[json.scene ?? 0].nodes) walk(s, identity);

    const size = max.map((v, i) => +(v - min[i]).toFixed(2));
    const center = max.map((v, i) => +((v + min[i]) / 2).toFixed(2));
    const axis = ['X', 'Y', 'Z'][size.indexOf(Math.max(...size))];
    // POSITION accessor 是否有 min/max（决定加载器能否正确算包围球）
    const hasMinMax = json.meshes.every((m) =>
      m.primitives.every((p) => json.accessors[p.attributes.POSITION].min != null),
    );
    console.log(
      `${file.padEnd(28)} size(XYZ)=${size.join(',').padEnd(16)} center=${center.join(',').padEnd(18)} 主轴=${axis}${hasMinMax ? '' : '  ⚠POSITION 缺 min/max'}`,
    );
  } catch (e) {
    console.log(`${file.padEnd(28)} 解析失败: ${e.message}`);
  }
}
