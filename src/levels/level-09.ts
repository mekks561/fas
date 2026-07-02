export const level09Config = {
  id: 'level-09',
  name: 'Final Approach',
  description: 'Make your final approach to the enemy stronghold.',
  difficulty: 'hard',
  environment: {
    skybox: 'env-space-01',
    nebula: false,
    asteroidField: false,
    lighting: 'bright',
  },
  player: {
    health: 180,
    shield: 180,
    maxHealth: 180,
    maxShield: 180,
    startingPosition: { x: 0, y: 0, z: 25 },
  },
  waves: [
    {
      number: 1,
      enemies: [
        { type: 'enemy-fighter', count: 6, spawnDelay: 600 },
        { type: 'enemy-assassin', count: 4, spawnDelay: 800 },
      ],
      objectives: ['Destroy all enemies'],
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-destroyer', count: 2, spawnDelay: 1800 },
        { type: 'enemy-tank', count: 4, spawnDelay: 1200 },
      ],
      objectives: ['Destroy all enemies'],
    },
    {
      number: 3,
      enemies: [
        { type: 'enemy-destroyer', count: 3, spawnDelay: 1500 },
        { type: 'enemy-corvette', count: 4, spawnDelay: 1000 },
        { type: 'enemy-bomber', count: 5, spawnDelay: 800 },
      ],
      objectives: ['Clear the path'],
    },
  ],
  rewards: {
    experience: 500,
    credits: 2500,
    unlocks: ['ship-corvette'],
  },
};
