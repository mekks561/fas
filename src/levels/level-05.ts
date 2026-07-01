export const level05Config = {
  id: 'level-05',
  name: 'Boss: Sentinel',
  description: 'Face the Sentinel, the guardian of the enemy fleet.',
  difficulty: 'hard',
  environment: {
    skybox: 'env-nebula-01',
    nebula: true,
    asteroidField: false,
    lighting: 'dramatic'
  },
  player: {
    health: 150,
    shield: 150,
    maxHealth: 150,
    maxShield: 150,
    startingPosition: { x: 0, y: 0, z: 15 }
  },
  waves: [
    {
      number: 1,
      enemies: [
        { type: 'enemy-fighter', count: 5, spawnDelay: 800 }
      ],
      objectives: ['Destroy all enemies']
    },
    {
      number: 2,
      enemies: [
        { type: 'enemy-tank', count: 3, spawnDelay: 1500 },
        { type: 'enemy-bomber', count: 2, spawnDelay: 1200 }
      ],
      objectives: ['Destroy all enemies']
    },
    {
      number: 3,
      enemies: [
        { type: 'boss-sentinel', count: 1, spawnDelay: 3000 }
      ],
      objectives: ['Defeat the Sentinel']
    }
  ],
  rewards: {
    experience: 500,
    credits: 2500,
    unlocks: ['ship-cruiser']
  }
};
