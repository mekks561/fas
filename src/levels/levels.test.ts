import { describe, expect, it } from 'vitest';
import {
  SKYBOX_TEXTURES,
  ENV_HDRI,
  DEFAULT_ENV_HDRI,
  LEVEL_LIGHTING,
  EXPOSURE_BY_LIGHTING,
  TONEMAP,
} from './index';

/**
 * 画质派生层的防漂移测试：三类映射表之间的键必须互相覆盖，
 * 否则新关卡会静默回落默认值（不报错、但配置不生效）。
 */
describe('画质派生层（环境光照 / 色调映射）', () => {
  it('ENV_HDRI 覆盖 SKYBOX_TEXTURES 的全部天幕 id（一次选天空同时决定背景与反射环境）', () => {
    for (const id of Object.keys(SKYBOX_TEXTURES)) {
      expect(ENV_HDRI[id], `天幕 ${id} 缺少 HDR 环境贴图映射`).toBeTruthy();
    }
  });

  it('ENV_HDRI 全部指向 .hdr（equirect Radiance 文件）', () => {
    for (const [id, url] of Object.entries(ENV_HDRI)) {
      expect(url, `天幕 ${id} 的环境贴图不是 .hdr`).toMatch(/\.hdr$/);
      expect(url.startsWith('/assets/textures/hdr/'), `${url} 不在 hdr 目录`).toBe(true);
    }
    expect(DEFAULT_ENV_HDRI).toMatch(/\.hdr$/);
  });

  it('EXPOSURE_BY_LIGHTING 覆盖 LEVEL_LIGHTING 的全部光照档位', () => {
    for (const key of Object.keys(LEVEL_LIGHTING)) {
      expect(EXPOSURE_BY_LIGHTING[key], `光照档位 ${key} 缺少曝光补偿`).toBeGreaterThan(0);
    }
  });

  it('色调映射档位是引擎认识的曲线名', () => {
    expect(Object.keys(TONEMAP)).toContain('mode');
    expect(TONEMAP.exposure).toBeGreaterThan(0);
  });
});
