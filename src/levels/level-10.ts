export const level10Config = {
  id: 'level-10',
  name: 'Boss: Overlord',
  description: 'Face the ultimate challenge - the Overlord awaits.',
  difficulty: 'extreme',
  environment: {
    skybox: 'env-overlord-01',
    nebula: true,
    asteroidField: false,
    lighting: 'dramatic',
  },
  player: {
    health: 200,
    shield: 200,
    maxHealth: 200,
    maxShield: 200,
    startingPosition: { x: 0, y: 0, z: 20 },
  },
  waves: [
    {
      number: 1,
      enemies: [
        { type: 'enemy-fighter', count: 8, spawnDelay: 500 },
        { type: 'enemy-bomber', count: 4, spawnDelay: 1000 },
      ],
      objectives: ['Destroy all enemies'],
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-destroyer', count: 2, spawnDelay: 1500 },
        { type: 'enemy-tank', count: 4, spawnDelay: 1200 },
        { type: 'enemy-assassin', count: 6, spawnDelay: 600 },
      ],
      objectives: ['Destroy all enemies'],
    },
    {
      number: 3,
      enemies: [{ type: 'boss-overlord', count: 1, spawnDelay: 3000 }],
      objectives: ['Defeat the Overlord'],
    },
  ],
  rewards: {
    experience: 1000,
    credits: 5000,
    // 原为 `achievement-master` —— 成就表里没有这个 id（成就是 `skill_master` /
    // `mission_master` / `legendary_pilot`…），而 `ChapterRewards` 把
    // `unlocks: string[]` 与 `achievement?: string` 分成两个字段，说明 unlocks 本就不放
    // 成就 id。所以这是一条悬空奖励：玩家打完全部 10 关，什么也没解锁。
    // 改为授予无畏舰舰体，十关的奖励序列因此变得规整：
    //   1 fighter / 2 导弹 / 3 bomber / 4 护盾 / 5 cruiser / 6 时缓 / 7 stealth /
    //   8 过载 / 9 corvette / 10 dreadnought —— 舰体与技能交替，每题都有实得。
    unlocks: ['ship-dreadnought'],
  },
};
