export const level02Config = {
  id: 'level-02',
  name: 'The Asteroid Field',
  description: 'Navigate through dangerous asteroid fields while fighting enemies.',
  difficulty: 'easy',
  environment: {
    skybox: 'env-nebula-01',
    nebula: true,
    asteroidField: true,
    lighting: 'dim',
  },
  player: {
    health: 100,
    shield: 75,
    maxHealth: 100,
    maxShield: 75,
    startingPosition: { x: 0, y: 0, z: -5 },
  },
  waves: [
    {
      number: 1,
      enemies: [{ type: 'enemy-drone', count: 4, spawnDelay: 600 }],
      objectives: ['Destroy all enemies'],
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-scout', count: 4, spawnDelay: 800 },
        { type: 'enemy-drone', count: 3, spawnDelay: 500 },
      ],
      objectives: ['Destroy all enemies'],
    },
    {
      number: 3,
      enemies: [
        { type: 'enemy-fighter', count: 3, spawnDelay: 1000 },
        { type: 'enemy-scout', count: 3, spawnDelay: 600 },
      ],
      objectives: ['Destroy all enemies', 'Avoid asteroid collisions'],
    },
  ],
  rewards: {
    experience: 150,
    credits: 750,
    unlocks: ['skill-missile-strike'],
  },
};
