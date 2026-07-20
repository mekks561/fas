export const importPlayCanvas = async (): Promise<typeof import('playcanvas')> => {
  return import('playcanvas');
};

export const importGameEngine = async (): Promise<{ PlayCanvasGameEngine: typeof import('../engine/PlayCanvasEngine').PlayCanvasGameEngine }> => {
  return import('../engine/PlayCanvasEngine');
};

export const importPlayerShip = async (): Promise<{ PlayerShip: typeof import('../engine/PlayerShip').PlayerShip }> => {
  return import('../engine/PlayerShip');
};

export const importEnemySystem = async (): Promise<{ EnemySystem: typeof import('../engine/EnemySystem').EnemySystem }> => {
  return import('../engine/EnemySystem');
};

export const importWeaponSystem = async (): Promise<{ WeaponSystem: typeof import('../engine/WeaponSystem').WeaponSystem }> => {
  return import('../engine/WeaponSystem');
};

export const importSkillSystem = async (): Promise<{ SkillSystem: typeof import('../engine/SkillSystem').SkillSystem; SkillType: typeof import('../engine/SkillSystem').SkillType }> => {
  return import('../engine/SkillSystem');
};

export const importStoryManager = async (): Promise<{ StoryMissionManager: typeof import('../engine/StoryMissionManager').StoryMissionManager }> => {
  return import('../engine/StoryMissionManager');
};

export const importAudioManager = async (): Promise<{ AudioManager: typeof import('../engine/AudioSystem').AudioManager }> => {
  return import('../engine/AudioSystem');
};
