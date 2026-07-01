import { ResourceManifest } from './types/resource-types';

export const GAME_RESOURCES: ResourceManifest = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    resources: [
        // === 纹理资源 ===
        {
            id: 'texture_metal',
            url: './textures/metal.jpg',
            filename: 'metal.jpg',
            size: 256000,
            md5: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '金属纹理贴图 - 用于飞船机身'
        },
        {
            id: 'texture_carbon',
            url: './textures/carbon.jpg',
            filename: 'carbon.jpg',
            size: 128000,
            md5: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '碳纤维纹理贴图 - 用于机翼'
        },
        {
            id: 'texture_glass',
            url: './textures/glass.jpg',
            filename: 'glass.jpg',
            size: 64000,
            md5: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '玻璃纹理贴图 - 用于驾驶舱'
        },
        {
            id: 'texture_rock',
            url: './textures/rock.jpg',
            filename: 'rock.jpg',
            size: 320000,
            md5: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '岩石纹理贴图 - 用于陨石和环境'
        },
        {
            id: 'texture_flare',
            url: './textures/flare.png',
            filename: 'flare.png',
            size: 16000,
            md5: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '光晕纹理贴图 - 用于引擎火焰和粒子效果'
        },
        {
            id: 'texture_grid',
            url: './textures/grid.png',
            filename: 'grid.png',
            size: 8000,
            md5: 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
            type: 'texture',
            version: '1.0.0',
            required: false,
            description: '网格纹理贴图 - 用于UI背景'
        },
        {
            id: 'texture_earth',
            url: './textures/earth.jpg',
            filename: 'earth.jpg',
            size: 512000,
            md5: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d5',
            type: 'texture',
            version: '1.0.0',
            required: false,
            description: '地球纹理贴图 - 用于背景球体'
        },
        {
            id: 'texture_metal_scratched',
            url: './textures/metalScratched.jpg',
            filename: 'metalScratched.jpg',
            size: 192000,
            md5: 'b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '划痕金属纹理贴图 - 用于引擎'
        },
        
        // === 动态生成的纹理 ===
        {
            id: 'texture_player_ship_diffuse',
            url: 'generated:player_ship_diffuse',
            filename: 'player_ship_diffuse.png',
            size: 512000,
            md5: 'c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '玩家飞船漫反射纹理 - 蓝银配色'
        },
        {
            id: 'texture_enemy_ship_diffuse',
            url: 'generated:enemy_ship_diffuse',
            filename: 'enemy_ship_diffuse.png',
            size: 512000,
            md5: 'd2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '敌飞船漫反射纹理 - 红黑配色'
        },
        {
            id: 'texture_boss_diffuse',
            url: 'generated:boss_diffuse',
            filename: 'boss_diffuse.png',
            size: 1024000,
            md5: 'e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: 'Boss飞船漫反射纹理 - 紫色金属'
        },
        {
            id: 'texture_projectile_blue',
            url: 'generated:projectile_blue',
            filename: 'projectile_blue.png',
            size: 64000,
            md5: 'f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '蓝色子弹纹理 - 能量弹'
        },
        {
            id: 'texture_projectile_red',
            url: 'generated:projectile_red',
            filename: 'projectile_red.png',
            size: 64000,
            md5: 'a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '红色子弹纹理 - 敌人子弹'
        },
        {
            id: 'texture_explosion',
            url: 'generated:explosion',
            filename: 'explosion.png',
            size: 256000,
            md5: 'b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '爆炸粒子纹理 - 火焰渐变'
        },
        {
            id: 'texture_shield',
            url: 'generated:shield',
            filename: 'shield.png',
            size: 128000,
            md5: 'c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '护盾纹理 - 能量护盾效果'
        },
        {
            id: 'texture_engine_glow',
            url: 'generated:engine_glow',
            filename: 'engine_glow.png',
            size: 128000,
            md5: 'd2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '引擎发光纹理 - 推进器火焰'
        },
        {
            id: 'texture_spark',
            url: 'generated:spark',
            filename: 'spark.png',
            size: 32000,
            md5: 'e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '火花纹理 - 武器碰撞效果'
        },
        {
            id: 'texture_powerup_health',
            url: 'generated:powerup_health',
            filename: 'powerup_health.png',
            size: 64000,
            md5: 'f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '生命道具纹理 - 绿色加号'
        },
        {
            id: 'texture_powerup_shield',
            url: 'generated:powerup_shield',
            filename: 'powerup_shield.png',
            size: 64000,
            md5: 'a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '护盾道具纹理 - 蓝色盾牌'
        },
        {
            id: 'texture_powerup_speed',
            url: 'generated:powerup_speed',
            filename: 'powerup_speed.png',
            size: 64000,
            md5: 'b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '速度道具纹理 - 黄色闪电'
        },
        {
            id: 'texture_powerup_weapon',
            url: 'generated:powerup_weapon',
            filename: 'powerup_weapon.png',
            size: 64000,
            md5: 'c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '武器道具纹理 - 红色五角星'
        },
        
        // === 模型资源（程序化生成） ===
        {
            id: 'model_player_ship',
            url: 'generated:player_ship',
            filename: 'player_ship.glb',
            size: 512000,
            md5: 'd3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '玩家飞船模型 - 程序化生成'
        },
        {
            id: 'model_enemy_scout',
            url: 'generated:enemy_scout',
            filename: 'enemy_scout.glb',
            size: 256000,
            md5: 'e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '侦察机模型 - 小型快速敌人'
        },
        {
            id: 'model_enemy_fighter',
            url: 'generated:enemy_fighter',
            filename: 'enemy_fighter.glb',
            size: 384000,
            md5: 'f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '战斗机模型 - 中型战斗单位'
        },
        {
            id: 'model_enemy_tank',
            url: 'generated:enemy_tank',
            filename: 'enemy_tank.glb',
            size: 512000,
            md5: 'a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '坦克模型 - 重型装甲单位'
        },
        {
            id: 'model_enemy_assaulter',
            url: 'generated:enemy_assaulter',
            filename: 'enemy_assaulter.glb',
            size: 384000,
            md5: 'b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '突击者模型 - 近距离攻击单位'
        },
        {
            id: 'model_enemy_elite',
            url: 'generated:enemy_elite',
            filename: 'enemy_elite.glb',
            size: 512000,
            md5: 'c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '精英模型 - 高性能战斗单位'
        },
        {
            id: 'model_boss_1',
            url: 'generated:boss_1',
            filename: 'boss_1.glb',
            size: 1024000,
            md5: 'd3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: 'Boss模型 - 第一关Boss'
        },
        {
            id: 'model_bullet_player',
            url: 'generated:bullet_player',
            filename: 'bullet_player.glb',
            size: 32000,
            md5: 'e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '玩家子弹模型 - 能量弹'
        },
        {
            id: 'model_bullet_enemy',
            url: 'generated:bullet_enemy',
            filename: 'bullet_enemy.glb',
            size: 32000,
            md5: 'f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '敌人子弹模型 - 红色能量弹'
        },
        {
            id: 'model_missile',
            url: 'generated:missile',
            filename: 'missile.glb',
            size: 64000,
            md5: 'a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '导弹模型 - 制导武器'
        },
        {
            id: 'model_asteroid_small',
            url: 'generated:asteroid_small',
            filename: 'asteroid_small.glb',
            size: 128000,
            md5: 'b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4',
            type: 'model',
            version: '1.0.0',
            required: false,
            description: '小行星模型 - 小型障碍物'
        },
        {
            id: 'model_asteroid_large',
            url: 'generated:asteroid_large',
            filename: 'asteroid_large.glb',
            size: 256000,
            md5: 'c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5',
            type: 'model',
            version: '1.0.0',
            required: false,
            description: '大型小行星模型 - 大型障碍物'
        },
        {
            id: 'model_planet',
            url: 'generated:planet',
            filename: 'planet.glb',
            size: 512000,
            md5: 'd3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6',
            type: 'model',
            version: '1.0.0',
            required: false,
            description: '行星模型 - 背景装饰'
        },
        {
            id: 'model_nebula',
            url: 'generated:nebula',
            filename: 'nebula.glb',
            size: 384000,
            md5: 'e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1',
            type: 'model',
            version: '1.0.0',
            required: false,
            description: '星云模型 - 背景装饰'
        },
        
        // === 音频资源 ===
        {
            id: 'audio_explosion',
            url: 'generated:explosion',
            filename: 'explosion.wav',
            size: 48000,
            md5: 'f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2',
            type: 'audio',
            version: '1.0.0',
            required: false,
            description: '爆炸音效 - 飞船爆炸'
        },
        {
            id: 'audio_fire_weapon',
            url: 'generated:fire_weapon',
            filename: 'fire_weapon.wav',
            size: 32000,
            md5: 'a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3',
            type: 'audio',
            version: '1.0.0',
            required: false,
            description: '武器开火音效 - 激光射击'
        },
        {
            id: 'audio_missile_launch',
            url: 'generated:missile_launch',
            filename: 'missile_launch.wav',
            size: 64000,
            md5: 'b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4',
            type: 'audio',
            version: '1.0.0',
            required: false,
            description: '导弹发射音效'
        },
        {
            id: 'audio_hit',
            url: 'generated:hit',
            filename: 'hit.wav',
            size: 24000,
            md5: 'c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5',
            type: 'audio',
            version: '1.0.0',
            required: false,
            description: '命中音效 - 碰撞反馈'
        },
        {
            id: 'audio_powerup',
            url: 'generated:powerup',
            filename: 'powerup.wav',
            size: 32000,
            md5: 'd3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6',
            type: 'audio',
            version: '1.0.0',
            required: false,
            description: '道具获取音效'
        },
        {
            id: 'audio_engine_loop',
            url: 'generated:engine_loop',
            filename: 'engine_loop.wav',
            size: 128000,
            md5: 'e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1',
            type: 'audio',
            version: '1.0.0',
            required: false,
            description: '引擎循环音效 - 飞船引擎声'
        },
        {
            id: 'audio_bg_music_1',
            url: 'generated:bg_music_1',
            filename: 'bg_music_1.mp3',
            size: 2560000,
            md5: 'f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2',
            type: 'audio',
            version: '1.0.0',
            required: false,
            description: '背景音乐1 - 战斗风格'
        },
        {
            id: 'audio_bg_music_2',
            url: 'generated:bg_music_2',
            filename: 'bg_music_2.mp3',
            size: 2560000,
            md5: 'a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3',
            type: 'audio',
            version: '1.0.0',
            required: false,
            description: '背景音乐2 - Boss战'
        },
        
        // === 数据资源 ===
        {
            id: 'data_levels',
            url: 'generated:levels',
            filename: 'levels.json',
            size: 32000,
            md5: 'b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4',
            type: 'data',
            version: '1.0.0',
            required: true,
            description: '关卡配置数据'
        },
        {
            id: 'data_enemies',
            url: 'generated:enemies',
            filename: 'enemies.json',
            size: 48000,
            md5: 'c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5',
            type: 'data',
            version: '1.0.0',
            required: true,
            description: '敌人配置数据'
        },
        {
            id: 'data_powerups',
            url: 'generated:powerups',
            filename: 'powerups.json',
            size: 16000,
            md5: 'd3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6',
            type: 'data',
            version: '1.0.0',
            required: true,
            description: '道具配置数据'
        }
    ]
};

// 获取所有必需资源
export const getRequiredResources = () => {
    return GAME_RESOURCES.resources.filter(r => r.required);
};

// 获取可选资源
export const getOptionalResources = () => {
    return GAME_RESOURCES.resources.filter(r => !r.required);
};

// 获取按类型分组的资源
export const getResourcesByType = (type: string) => {
    return GAME_RESOURCES.resources.filter(r => r.type === type);
};

// 获取资源统计
export const getResourceStats = () => {
    const textures = GAME_RESOURCES.resources.filter(r => r.type === 'texture');
    const models = GAME_RESOURCES.resources.filter(r => r.type === 'model');
    const audio = GAME_RESOURCES.resources.filter(r => r.type === 'audio');
    const data = GAME_RESOURCES.resources.filter(r => r.type === 'data');
    
    return {
        total: GAME_RESOURCES.resources.length,
        required: GAME_RESOURCES.resources.filter(r => r.required).length,
        optional: GAME_RESOURCES.resources.filter(r => !r.required).length,
        textures: {
            count: textures.length,
            size: textures.reduce((acc, r) => acc + r.size, 0)
        },
        models: {
            count: models.length,
            size: models.reduce((acc, r) => acc + r.size, 0)
        },
        audio: {
            count: audio.length,
            size: audio.reduce((acc, r) => acc + r.size, 0)
        },
        data: {
            count: data.length,
            size: data.reduce((acc, r) => acc + r.size, 0)
        },
        totalSize: GAME_RESOURCES.resources.reduce((acc, r) => acc + r.size, 0)
    };
};
