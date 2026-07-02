export const level08Config = {
  id: 'level-08',
  name: 'The Maelstrom',
  description: 'Survive the chaotic maelstrom of enemy forces.',
  difficulty: 'hard',
  environment: {
    skybox: 'env-nebula-01',
    nebula: true,
    asteroidField: true,
    lighting: 'dramatic',
  },
  player: {
    health: 160,
    shield: 160,
    maxHealth: 160,
    maxShield: 160,
    startingPosition: { x: 0, y: 0, z: 0 },
  },
  waves: [
    {
      number: 1,
      enemies: [
        { type: 'enemy-drone', count: 10, spawnDelay: 400 },
        { type: 'enemy-scout', count: 5, spawnDelay: 600 },
      ],
      objectives: ['Survive the onslaught'],
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-assassin', count: 6, spawnDelay: 600 },
        { type: 'enemy-bomber', count: 4, spawnDelay: 1000 },
      ],
      objectives: ['Destroy all enemies'],
    },
    {
      number: 3,
      enemies: [
        { type: 'enemy-tank', count: 4, spawnDelay: 1200 },
        { type: 'enemy-corvette', count: 3, spawnDelay: 1500 },
        { type: 'enemy-fighter', count: 8, spawnDelay: 500 },
      ],
      objectives: ['Destroy all enemies', 'Avoid asteroids'],
    },
  ],
  rewards: {
    experience: 450,
    credits: 2250,
    unlocks: ['skill-overdrive'],
  },
};
