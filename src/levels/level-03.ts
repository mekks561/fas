export const level03Config = {
  id: 'level-03',
  name: 'Station Defense',
  description: 'Defend the space station from enemy attack.',
  difficulty: 'medium',
  environment: {
    skybox: 'env-station-01',
    nebula: false,
    asteroidField: false,
    lighting: 'bright',
  },
  player: {
    health: 120,
    shield: 100,
    maxHealth: 120,
    maxShield: 100,
    startingPosition: { x: 0, y: 0, z: 10 },
  },
  waves: [
    {
      number: 1,
      enemies: [{ type: 'enemy-scout', count: 6, spawnDelay: 600 }],
      objectives: ['Destroy all enemies'],
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-fighter', count: 4, spawnDelay: 800 },
        { type: 'enemy-bomber', count: 2, spawnDelay: 1500 },
      ],
      objectives: ['Destroy all enemies', 'Protect the station'],
    },
    {
      number: 3,
      enemies: [
        { type: 'enemy-tank', count: 2, spawnDelay: 2000 },
        { type: 'enemy-fighter', count: 4, spawnDelay: 800 },
      ],
      objectives: ['Destroy all enemies'],
    },
  ],
  rewards: {
    experience: 200,
    credits: 1000,
    unlocks: ['ship-bomber'],
  },
};
