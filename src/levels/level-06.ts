export const level06Config = {
  id: 'level-06',
  name: 'Hidden Base',
  description: 'Infiltrate the enemy hidden base.',
  difficulty: 'medium',
  environment: {
    skybox: 'env-space-01',
    nebula: false,
    asteroidField: true,
    lighting: 'dim'
  },
  player: {
    health: 130,
    shield: 120,
    maxHealth: 130,
    maxShield: 120,
    startingPosition: { x: 0, y: 0, z: 20 }
  },
  waves: [
    {
      number: 1,
      enemies: [
        { type: 'enemy-drone', count: 6, spawnDelay: 500 },
        { type: 'enemy-scout', count: 3, spawnDelay: 800 }
      ],
      objectives: ['Destroy all enemies']
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-assassin', count: 4, spawnDelay: 800 },
        { type: 'enemy-corvette', count: 2, spawnDelay: 1500 }
      ],
      objectives: ['Destroy all enemies']
    },
    {
      number: 3,
      enemies: [
        { type: 'enemy-destroyer', count: 1, spawnDelay: 2500 },
        { type: 'enemy-fighter', count: 4, spawnDelay: 600 }
      ],
      objectives: ['Destroy the destroyer', 'Eliminate all threats']
    }
  ],
  rewards: {
    experience: 300,
    credits: 1500,
    unlocks: ['skill-time-slow']
  }
};
