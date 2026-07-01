import { level01Config } from './level-01';
import { level02Config } from './level-02';
import { level03Config } from './level-03';
import { level04Config } from './level-04';
import { level05Config } from './level-05';
import { level06Config } from './level-06';
import { level07Config } from './level-07';
import { level08Config } from './level-08';
import { level09Config } from './level-09';
import { level10Config } from './level-10';

export { level01Config } from './level-01';
export { level02Config } from './level-02';
export { level03Config } from './level-03';
export { level04Config } from './level-04';
export { level05Config } from './level-05';
export { level06Config } from './level-06';
export { level07Config } from './level-07';
export { level08Config } from './level-08';
export { level09Config } from './level-09';
export { level10Config } from './level-10';

export type LevelConfig = typeof level01Config;

export const getAllLevels = (): LevelConfig[] => [
  level01Config,
  level02Config,
  level03Config,
  level04Config,
  level05Config,
  level06Config,
  level07Config,
  level08Config,
  level09Config,
  level10Config
];

export const getLevelById = (id: string): LevelConfig | undefined => {
  return getAllLevels().find(level => level.id === id);
};

export const getLevelByIndex = (index: number): LevelConfig | undefined => {
  return getAllLevels()[index];
};
