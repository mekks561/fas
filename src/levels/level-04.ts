export const level04Config = {
  id: 'level-04',
  name: 'Deep Space',
  description: 'Face the enemy in the depths of space.',
  difficulty: 'medium',
  environment: {
    skybox: 'env-space-01',
    nebula: true,
    asteroidField: false,
    lighting: 'dark'
  },
  player: {
    health: 120,
    shield: 100,
    maxHealth: 120,
    maxShield: 100,
    startingPosition: { x: 0, y: 0, z: 0 }
  },
  waves: [
    {
      number: 1,
      enemies: [
        { type: 'enemy-assassin', count: 2, spawnDelay: 1000 },
        { type: 'enemy-scout', count: 4, spawnDelay: 800 }
      ],
      objectives: ['Destroy all enemies']
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-bomber', count: 3, spawnDelay: 1200 },
        { type: 'enemy-fighter', count: 3, spawnDelay: 800 }
      ],
      objectives: ['Destroy all enemies']
    },
    {
      number: 3,
      enemies: [
        { type: 'enemy-corvette', count: 2, spawnDelay: 2000 },
        { type: 'enemy-assassin', count: 3, spawnDelay: 1000 }
      ],
      objectives: ['Destroy all enemies']
    }
  ],
  rewards: {
    experience: 250,
    credits: 1250,
    unlocks: ['skill-shield-burst']
  }
};
