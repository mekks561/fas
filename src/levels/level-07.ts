export const level07Config = {
  id: 'level-07',
  name: 'Fleet Battle',
  description: 'Engage in a massive fleet battle.',
  difficulty: 'hard',
  environment: {
    skybox: 'env-space-01',
    nebula: true,
    asteroidField: false,
    lighting: 'normal',
  },
  player: {
    health: 150,
    shield: 150,
    maxHealth: 150,
    maxShield: 150,
    startingPosition: { x: 0, y: 0, z: 0 },
  },
  waves: [
    {
      number: 1,
      enemies: [
        { type: 'enemy-scout', count: 8, spawnDelay: 500 },
        { type: 'enemy-fighter', count: 4, spawnDelay: 800 },
      ],
      objectives: ['Destroy all enemies'],
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-bomber', count: 4, spawnDelay: 1000 },
        { type: 'enemy-tank', count: 3, spawnDelay: 1500 },
        { type: 'enemy-corvette', count: 2, spawnDelay: 1200 },
      ],
      objectives: ['Destroy all enemies'],
    },
    {
      number: 3,
      enemies: [
        { type: 'enemy-destroyer', count: 2, spawnDelay: 2000 },
        { type: 'enemy-assassin', count: 4, spawnDelay: 800 },
        { type: 'enemy-fighter', count: 6, spawnDelay: 600 },
      ],
      objectives: ['Destroy all enemies'],
    },
  ],
  rewards: {
    experience: 400,
    credits: 2000,
    unlocks: ['ship-stealth'],
  },
};
