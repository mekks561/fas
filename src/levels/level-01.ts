export const level01Config = {
  id: 'level-01',
  name: 'First Contact',
  description: 'Your first mission. Prove yourself against enemy scouts.',
  difficulty: 'easy',
  environment: {
    skybox: 'env-space-01',
    nebula: true,
    asteroidField: false,
    lighting: 'normal'
  },
  player: {
    health: 100,
    shield: 50,
    maxHealth: 100,
    maxShield: 50,
    startingPosition: { x: 0, y: 0, z: 0 }
  },
  waves: [
    {
      number: 1,
      enemies: [
        { type: 'enemy-scout', count: 3, spawnDelay: 1000 }
      ],
      objectives: ['Destroy all enemies']
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-scout', count: 5, spawnDelay: 800 }
      ],
      objectives: ['Destroy all enemies']
    },
    {
      number: 3,
      enemies: [
        { type: 'enemy-scout', count: 4, spawnDelay: 600 },
        { type: 'enemy-fighter', count: 2, spawnDelay: 1500 }
      ],
      objectives: ['Destroy all enemies']
    }
  ],
  rewards: {
    experience: 100,
    credits: 500,
    unlocks: ['ship-fighter']
  }
};
