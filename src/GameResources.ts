import { ResourceManifest } from './types/resource-types';

export const GAME_RESOURCES: ResourceManifest = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    resources: [
        {
            id: 'texture_metal',
            url: 'https://assets.babylonjs.com/textures/metal.jpg',
            filename: 'metal.jpg',
            size: 256000,
            md5: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '金属纹理贴图'
        },
        {
            id: 'texture_carbon',
            url: 'https://assets.babylonjs.com/textures/carbon.jpg',
            filename: 'carbon.jpg',
            size: 128000,
            md5: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '碳纤维纹理贴图'
        },
        {
            id: 'texture_glass',
            url: 'https://assets.babylonjs.com/textures/glass.jpg',
            filename: 'glass.jpg',
            size: 64000,
            md5: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '玻璃纹理贴图'
        },
        {
            id: 'texture_rock',
            url: 'https://assets.babylonjs.com/textures/rock.jpg',
            filename: 'rock.jpg',
            size: 320000,
            md5: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '岩石纹理贴图'
        },
        {
            id: 'texture_flare',
            url: 'https://assets.babylonjs.com/textures/flare.png',
            filename: 'flare.png',
            size: 16000,
            md5: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '光晕纹理贴图'
        },
        {
            id: 'texture_grid',
            url: 'https://assets.babylonjs.com/textures/grid.png',
            filename: 'grid.png',
            size: 8000,
            md5: 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '网格纹理贴图'
        },
        {
            id: 'texture_earth',
            url: 'https://assets.babylonjs.com/textures/earth.jpg',
            filename: 'earth.jpg',
            size: 512000,
            md5: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d5',
            type: 'texture',
            version: '1.0.0',
            required: false,
            description: '地球纹理贴图'
        },
        {
            id: 'texture_metal_scratched',
            url: 'https://assets.babylonjs.com/textures/metalScratched.jpg',
            filename: 'metalScratched.jpg',
            size: 192000,
            md5: 'b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4',
            type: 'texture',
            version: '1.0.0',
            required: true,
            description: '划痕金属纹理贴图'
        },
        {
            id: 'model_player_ship',
            url: 'https://assets.babylonjs.com/meshes/playerShip.glb',
            filename: 'playerShip.glb',
            size: 1024000,
            md5: 'c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '玩家飞船模型'
        },
        {
            id: 'model_enemy_ship',
            url: 'https://assets.babylonjs.com/meshes/enemyShip.glb',
            filename: 'enemyShip.glb',
            size: 768000,
            md5: 'd3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6',
            type: 'model',
            version: '1.0.0',
            required: true,
            description: '敌飞船模型'
        },
        {
            id: 'audio_explosion',
            url: 'https://assets.babylonjs.com/audio/explosion.wav',
            filename: 'explosion.wav',
            size: 48000,
            md5: 'e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1',
            type: 'audio',
            version: '1.0.0',
            required: false,
            description: '爆炸音效'
        },
        {
            id: 'audio_fire_weapon',
            url: 'https://assets.babylonjs.com/audio/fireWeapon.wav',
            filename: 'fireWeapon.wav',
            size: 32000,
            md5: 'f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2',
            type: 'audio',
            version: '1.0.0',
            required: false,
            description: '武器开火音效'
        }
    ]
};
