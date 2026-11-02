struct Component {
    position: vec3<f32>,
    health: f32,
    mass: f32,
    offset: vec3<f32>,
};

@group(0) @binding(0) var<storage, read_write> components: array<Component>;
@group(0) @binding(1) var<uniform> collision_force: vec3<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&components)) {
        return;
    }

    // 2026 Tech: WebGPU driven modular damage
    let dist = distance(components[index].position, collision_force);
    if (dist < 5.0) {
        let damage = (5.0 - dist) * length(collision_force) * 0.1;
        components[index].health -= damage;
        
        // Apply deformation offset
        components[index].offset += normalize(components[index].position - collision_force) * damage * 0.01;
    }
}
