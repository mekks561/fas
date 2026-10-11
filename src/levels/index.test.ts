import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ENV_HDRI, DEFAULT_SKYBOX, ENV_HDRI, SKYBOX_TEXTURES, getAllLevels } from './index';

/**
 * 关卡环境配置的护栏。
 *
 * 这一组测试防的是**静默退化**：id 拼错 / 漏登记 / 关卡改回共用同一张贴图，
 * 这些都不会报错，只会让画面「不知不觉变回每关一样」，看代码看不出来。
 */
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

/** 把 `/assets/...` 形式的 URL 落到 public 目录，检查文件是否真实存在。 */
const assetExists = (url: string): boolean =>
  fs.existsSync(path.join(PUBLIC_DIR, url.replace(/^\//, '')));

describe('关卡环境配置（天幕 + 环境光照）', () => {
  it('两张表的键集合一致（同一个 id 必须同时能取到天幕与环境）', () => {
    expect(Object.keys(ENV_HDRI).sort()).toEqual(Object.keys(SKYBOX_TEXTURES).sort());
  });

  it('每个关卡引用的 skybox id 都已登记（拼错会静默回落默认天幕）', () => {
    for (const level of getAllLevels()) {
      const id = level.environment.skybox;
      expect(ENV_HDRI[id], `${level.id} 的 ${id} 缺环境贴图`).toBeTruthy();
      expect(SKYBOX_TEXTURES[id], `${level.id} 的 ${id} 缺天幕贴图`).toBeTruthy();
    }
  });

  it('十关的环境贴图两两不同（「关卡氛围差异化」护栏 —— 这是刻意设计，不是巧合）', () => {
    const urls = getAllLevels().map((l) => ENV_HDRI[l.environment.skybox]);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('引用的天幕与环境贴图文件都真实存在于 public/', () => {
    for (const url of Object.values(SKYBOX_TEXTURES)) {
      expect(assetExists(url), `天幕贴图缺失：${url}`).toBe(true);
    }
    for (const url of Object.values(ENV_HDRI)) {
      expect(assetExists(url), `环境贴图缺失：${url}`).toBe(true);
    }
  });

  it('默认回落值也在各自的表里（回落不该指向一个表外的路径）', () => {
    expect(Object.values(SKYBOX_TEXTURES)).toContain(DEFAULT_SKYBOX);
    expect(Object.values(ENV_HDRI)).toContain(DEFAULT_ENV_HDRI);
  });
});
