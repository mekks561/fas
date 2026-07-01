export const level10Config = {
  id: 'level-10',
  name: 'Boss: Overlord',
  description: 'Face the ultimate challenge - the Overlord awaits.',
  difficulty: 'extreme',
  environment: {
    skybox: 'env-nebula-01',
    nebula: true,
    asteroidField: false,
    lighting: 'dramatic'
  },
  player: {
    health: 200,
    shield: 200,
    maxHealth: 200,
    maxShield: 200,
    startingPosition: { x: 0, y: 0, z: 20 }
  },
  waves: [
    {
      number: 1,
      enemies: [
        { type: 'enemy-fighter', count: 8, spawnDelay: 500 },
        { type: 'enemy-bomber', count: 4, spawnDelay: 1000 }
      ],
      objectives: ['Destroy all enemies']
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-destroyer', count: 2, spawnDelay: 1500 },
        { type: 'enemy-tank', count: 4, spawnDelay: 1200 },
        { type: 'enemy-assassin', count: 6, spawnDelay: 600 }
      ],
      objectives: ['Destroy all enemies']
    },
    {
      number: 3,
      enemies: [
        { type: 'boss-overlord', count: 1, spawnDelay: 3000 }
      ],
      objectives: ['Defeat the Overlord']
    }
  ],
  rewards: {
    experience: 1000,
    credits: 5000,
    unlocks: ['achievement-master']
  }
};
