struct PCGParams {
    seed: f32,
    count: f32,
    innerRadius: f32,
    outerRadius: f32,
    arenaScale: f32,
};

struct InstanceData {
    pos: vec3<f32>,
    scale: f32,
    rot: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: PCGParams;
@group(0) @binding(1) var<storage, read_write> output: array<InstanceData>;

// 2026 Tech: 基于 GPU 的高效伪随机生成器
fn hash(n: f32) -> f32 {
    return fract(sin(n) * 43758.5453123);
}

fn rand(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= u32(params.count)) {
        return;
    }

    let i_f = f32(index);
    let seed = params.seed + i_f * 0.1337;

    // 1. 生成球面分布
    let theta = rand(vec2<f32>(seed, 1.0)) * 6.28318;
    let phi = acos(2.0 * rand(vec2<f32>(seed, 2.0)) - 1.0);
    let radius = params.innerRadius + rand(vec2<f32>(seed, 3.0)) * (params.outerRadius - params.innerRadius);
    
    let x = radius * sin(phi) * cos(theta) * params.arenaScale;
    let y = (rand(vec2<f32>(seed, 4.0)) - 0.5) * 60.0 * params.arenaScale;
    let z = radius * sin(phi) * sin(theta) * params.arenaScale;

    // 2. 生成缩放与旋转
    let scale = (0.5 + rand(vec2<f32>(seed, 5.0)) * 2.0) * params.arenaScale;
    let rx = rand(vec2<f32>(seed, 6.0));
    let ry = rand(vec2<f32>(seed, 7.0));
    let rz = rand(vec2<f32>(seed, 8.0));
    let rw = rand(vec2<f32>(seed, 9.0));

    // 输出到 Storage Buffer
    output[index].pos = vec3<f32>(x, y, z);
    output[index].scale = scale;
    output[index].rot = normalize(vec4<f32>(rx, ry, rz, rw));
}
