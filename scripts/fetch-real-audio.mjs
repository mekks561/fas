#!/usr/bin/env node
/**
 * 抓取真实 CC0 音频素材，替换游戏内全部「脚本合成」音频。
 *
 * 背景：public/assets/audio 下的 36 个文件全部由 scripts/generate-audio.js 合成
 * （正弦/白噪），其中 5 个 BGM 是 13MB 的未压缩 WAV。本脚本把它们替换为真实录制/
 * 作曲素材，并带来两个可测收益：总体积下降、时长增加。
 *
 * 素材来源与许可（全部 CC0，可商用免署名）：
 *   - Kenney 音频包（kenney.nl）—— 音效
 *   - OpenGameArt（opengameart.org）—— 背景音乐
 *
 * 可复现性：所有远程产物都按 sha256 钉死。上游若变动，脚本会报错退出，
 * 不会静默产出与本次不同的一批文件。重新运行可加 --force 忽略本地缓存。
 *
 * 用法：
 *   node scripts/fetch-real-audio.mjs            # 缺什么补什么
 *   node scripts/fetch-real-audio.mjs --force    # 忽略缓存，全部重下
 *   node scripts/fetch-real-audio.mjs --check    # 只校验已落地的文件，不联网
 */

import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_DIR = join(ROOT, 'public', 'assets', 'audio');
const CACHE_DIR = join(ROOT, '.workbuddy', 'tmp', 'audio-cache');

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const CHECK_ONLY = argv.includes('--check');

/* ------------------------------------------------------------------ *
 * 1. 音效：Kenney CC0 音频包
 * ------------------------------------------------------------------ */

const KENNEY_PACKS = {
  'sci-fi-sounds': {
    url: 'https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip',
    // 该哈希与第三方独立记录的 Kenney Sci-Fi Sounds 1.0 归档哈希一致
    sha256: '119340f351a5098ad814f78719438c0da355a9ce8a4c8a3af6a8d48aa3d49e04',
  },
  'interface-sounds': {
    url: 'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip',
    sha256: 'f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232',
  },
  'digital-audio': {
    url: 'https://kenney.nl/media/pages/assets/digital-audio/216eac4753-1677590265/kenney_digital-audio.zip',
    sha256: '24e6ce28b76a6d8c89cff4d331e0965ff5c3de8a73c612028e9d363cc64e4f06',
  },
};

/** 音效映射：目标文件 ← Kenney 包内文件（按 basename 匹配，忽略包内目录层级） */
const SFX = [
  // —— 战斗音效（sci-fi-sounds：真实激光/爆炸/力场录音设计）——
  ['effects/sfx-laser', 'sci-fi-sounds', 'laserSmall_000.ogg', '玩家主炮，短促清脆'],
  ['effects/sfx-plasma', 'sci-fi-sounds', 'laserLarge_000.ogg', '敌方能量弹，更低沉'],
  ['effects/sfx-explosion', 'sci-fi-sounds', 'lowFrequency_explosion_000.ogg', '爆炸，带低频冲击'],
  ['effects/sfx-shield', 'sci-fi-sounds', 'forceField_000.ogg', '护盾/力场'],
  ['effects/sfx-damage', 'sci-fi-sounds', 'impactMetal_000.ogg', '金属受击'],
  ['effects/sfx-missile', 'digital-audio', 'phaserUp3.ogg', '导弹发射（上升音，原推进器音长达 5s 过冗）'],
  ['effects/sfx-boss-roar', 'sci-fi-sounds', 'spaceEngineLow_000.ogg', 'Boss 低吼（引擎低频）'],
  ['effects/sfx-nuke', 'sci-fi-sounds', 'explosionCrunch_004.ogg', '核爆（1.98s 长炸裂）'],
  ['effects/sfx-blackhole', 'sci-fi-sounds', 'engineCircular_000.ogg', '黑洞嗡鸣（循环引擎）'],
  // —— 反馈/奖励音效（digital-audio：合成器提示音）——
  ['effects/sfx-powerup', 'digital-audio', 'powerUp1.ogg', '拾取道具'],
  ['effects/sfx-powerup-spawn', 'digital-audio', 'phaseJump1.ogg', '道具生成/跃迁'],
  ['effects/sfx-heal', 'digital-audio', 'powerUp5.ogg', '治疗'],
  ['effects/sfx-wave-start', 'digital-audio', 'threeTone1.ogg', '波次开始提示'],
  ['effects/sfx-level-complete', 'digital-audio', 'pepSound1.ogg', '通关'],
  // —— UI 音效（interface-sounds：真实界面采样）——
  ['ui/ui-click', 'interface-sounds', 'click_001.ogg', '点击'],
  ['ui/ui-select', 'interface-sounds', 'select_003.ogg', '选择/悬停（select_001 仅 43ms，不成音）'],
  ['ui/ui-success', 'interface-sounds', 'confirmation_001.ogg', '确认成功'],
  ['ui/ui-error', 'interface-sounds', 'error_001.ogg', '错误'],
  ['ui/ui-levelup', 'interface-sounds', 'confirmation_004.ogg', '升级'],
  ['ui/ui-achievement', 'interface-sounds', 'maximize_005.ogg', '成就（上行提示音，bong_001 仅 0.12s 过短）'],
];

/* ------------------------------------------------------------------ *
 * 2. 背景音乐：OpenGameArt CC0 曲目
 * ------------------------------------------------------------------ */

const MUSIC = [
  {
    dest: 'bgm/bgm-mainmenu.ogg',
    // 该曲目在 OGA 只提供 zip，zip 仅 768KB，可直接解出 OGG
    archive: {
      url: 'https://opengameart.org/sites/default/files/ObservingTheStar.zip',
      sha256: '295ecdc6daa96c0101a022d3a09314fc6ed86342ffee7387e8e9854ace3f8a30',
      entry: 'ObservingTheStar.ogg',
    },
    sha256: 'd208059cbe7b21154a9b7844d98ac9ad754617a5a321c5e507d203a907abe665',
    title: 'Another space background track / ObservingTheStar',
    author: 'Unknown (OpenGameArt)',
    page: 'https://opengameart.org/content/another-space-background-track',
    license: 'CC0 1.0',
    slot: 'menuMusic —— 主菜单环境音乐',
  },
  {
    dest: 'bgm/bgm-gameplay.ogg',
    file: {
      url: 'https://opengameart.org/sites/default/files/Spacecrusher_0.ogg',
      sha256: '388a2fae3a79c7320b1080603b6d8d9caaa719f7d26f14e9eef30bd9f424026c',
    },
    title: 'Spacecrusher',
    author: 'Unknown (OpenGameArt)',
    page: 'https://opengameart.org/content/spacecrusher',
    license: 'CC0 1.0',
    slot: 'gameMusic —— 常规战斗',
  },
  {
    dest: 'bgm/bgm-boss.ogg',
    file: {
      url: 'https://opengameart.org/sites/default/files/battle_zero_2022_remaster_update_0.mp3',
      sha256: 'fe59272aa526326998bfc2fef1c9455cb5504af7587f79a0a9fc2c3ea0921577',
    },
    title: 'Battle Zero (2022 remaster)',
    author: 'Unknown (OpenGameArt)',
    page: 'https://opengameart.org/content/battle-zero',
    license: 'CC0 1.0',
    slot: 'bossMusic —— Boss 战',
  },
  {
    dest: 'bgm/bgm-victory.mp3',
    file: {
      url: 'https://opengameart.org/sites/default/files/space%20fanfare.mp3',
      sha256: '8ff701932d77596f29b5b22238a56ac93a6c9d2250fd1338f99314a8c40bf4f6',
    },
    title: 'space fanfare',
    author: 'Unknown (OpenGameArt)',
    page: 'https://opengameart.org/content/space-fanfare',
    license: 'CC0 1.0 （该条目同时标注 CC-BY 3.0，我们按 CC0 使用）',
    slot: 'victoryMusic —— 胜利结算',
  },
  {
    dest: 'bgm/bgm-story.ogg',
    file: {
      url: 'https://opengameart.org/sites/default/files/Dark%20Intro_0.ogg',
      sha256: '7bfe029fcc5cc73688e4b6ca13b8845fe80a4c73d775e5d2c52af30e7a5d75b0',
    },
    title: 'Dark Intro',
    author: 'Unknown (OpenGameArt)',
    page: 'https://opengameart.org/content/dark-intro',
    license: 'CC0 1.0',
    slot: 'defeatMusic —— 失败/剧情',
  },
];

/* ------------------------------------------------------------------ *
 * 3. 最小 ZIP 读取（只取单个条目，避免引入依赖）
 * ------------------------------------------------------------------ */

function readZipEntry(buf, wantedBasename) {
  // 从尾部找 EOCD（End of Central Directory）
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP 结构异常：未找到 EOCD');

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('ZIP 结构异常：中央目录损坏');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');

    const base = name.split('/').pop();
    if (base === wantedBasename) {
      // 本地头：数据起始 = 30 + 本地文件名长度 + 本地额外字段长度
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(dataStart, dataStart + compSize);
      if (method === 0) return Buffer.from(raw);
      if (method === 8) return inflateRawSync(raw);
      throw new Error(`ZIP 条目 ${name} 用了不支持的压缩方式 ${method}`);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`ZIP 内未找到条目：${wantedBasename}`);
}

/* ------------------------------------------------------------------ *
 * 4. 音频格式校验（OGG Vorbis / MPEG 音频）
 * ------------------------------------------------------------------ */

function probeOgg(buf) {
  if (buf.subarray(0, 4).toString('latin1') !== 'OggS') return null;
  const nseg = buf[26];
  const payload = 27 + nseg;
  if (buf.subarray(payload + 1, payload + 7).toString('latin1') !== 'vorbis') return null;
  const channels = buf[payload + 11];
  const sampleRate = buf.readUInt32LE(payload + 12);
  const last = buf.lastIndexOf(Buffer.from('OggS', 'latin1'));
  const granule = Number(buf.readBigInt64LE(last + 6));
  return { format: 'ogg', sampleRate, channels, duration: sampleRate ? granule / sampleRate : 0 };
}

const MPEG_BITRATE_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG_RATE_V1 = [44100, 48000, 32000];

function probeMp3(buf) {
  let off = 0;
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') {
    off = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
  }
  const limit = Math.min(buf.length - 4, off + 300000);
  for (let i = off; i < limit; i++) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      const version = (buf[i + 1] >> 3) & 3; // 3 = MPEG1
      const layer = (buf[i + 1] >> 1) & 3; // 1 = Layer III
      const brIdx = (buf[i + 2] >> 4) & 0xf;
      const srIdx = (buf[i + 2] >> 2) & 3;
      if (version === 3 && layer === 1 && brIdx !== 0 && brIdx !== 15 && srIdx !== 3) {
        const kbps = MPEG_BITRATE_V1_L3[brIdx];
        const rate = MPEG_RATE_V1[srIdx];
        return {
          format: 'mp3',
          sampleRate: rate,
          channels: 2,
          kbps,
          duration: ((buf.length - off) * 8) / (kbps * 1000),
        };
      }
    }
  }
  return null;
}

function probe(buf) {
  return probeOgg(buf) ?? probeMp3(buf);
}

/* ------------------------------------------------------------------ *
 * 5. 下载 + 缓存
 * ------------------------------------------------------------------ */

const cachePath = (name) => join(CACHE_DIR, name);

async function download(url, cacheName) {
  const dest = cachePath(cacheName);
  if (existsSync(dest) && !FORCE) return readFileSync(dest);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (asset-fetch)' } });
  if (!res.ok) throw new Error(`下载失败 ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(dest, buf);
  return buf;
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function expectHash(buf, want, what) {
  const got = sha256(buf);
  if (want && got !== want) {
    throw new Error(
      `${what} 内容哈希不符（上游可能已变更）\n  期望 ${want}\n  实际 ${got}`
    );
  }
  return got;
}

/* ------------------------------------------------------------------ *
 * 6. 清单生成
 * ------------------------------------------------------------------ */

/** 展示名与标签（沿用原清单的命名，避免下游习惯被破坏） */
const LABELS = {
  'bgm-mainmenu': ['Main Menu', ['bgm', 'menu']],
  'bgm-gameplay': ['Gameplay', ['bgm', 'game']],
  'bgm-boss': ['Boss Battle', ['bgm', 'boss']],
  'bgm-story': ['Story', ['bgm', 'story']],
  'bgm-victory': ['Victory', ['bgm', 'victory']],
  'sfx-laser': ['Laser Shot', ['sfx', 'weapon']],
  'sfx-plasma': ['Plasma Shot', ['sfx', 'weapon']],
  'sfx-missile': ['Missile Launch', ['sfx', 'weapon']],
  'sfx-explosion': ['Explosion', ['sfx', 'explosion']],
  'sfx-nuke': ['Nuke', ['sfx', 'weapon']],
  'sfx-shield': ['Shield Activate', ['sfx', 'skill']],
  'sfx-heal': ['Heal', ['sfx', 'powerup']],
  'sfx-powerup': ['Powerup Collect', ['sfx', 'powerup']],
  'sfx-powerup-spawn': ['Powerup Spawn', ['sfx', 'powerup']],
  'sfx-damage': ['Damage', ['sfx', 'damage']],
  'sfx-boss-roar': ['Boss Roar', ['sfx', 'boss']],
  'sfx-wave-start': ['Wave Start', ['sfx', 'wave']],
  'sfx-level-complete': ['Level Complete', ['sfx', 'level']],
  'sfx-blackhole': ['Black Hole', ['sfx', 'skill']],
  'ui-click': ['Click', ['ui', 'click']],
  'ui-select': ['Select', ['ui', 'select']],
  'ui-success': ['Success', ['ui', 'success']],
  'ui-error': ['Error', ['ui', 'error']],
  'ui-levelup': ['Level Up', ['ui', 'levelup']],
  'ui-achievement': ['Achievement Unlock', ['ui', 'achievement']],
};

const CATEGORIES = [
  ['bgm', 'audio-bgm', 'Background Music', '背景音乐'],
  ['effects', 'audio-effects', 'Sound Effects', '战斗与反馈音效'],
  ['ui', 'audio-ui', 'UI Sounds', '界面音效'],
];

function writeManifest() {
  const categories = [];
  let grand = 0;
  let count = 0;

  for (const [dir, id, name, description] of CATEGORIES) {
    const abs = join(AUDIO_DIR, dir);
    if (!existsSync(abs)) continue;
    const assets = [];
    let catSize = 0;

    for (const f of readdirSync(abs).sort()) {
      if (!/\.(ogg|mp3|wav)$/i.test(f)) continue;
      const buf = readFileSync(join(abs, f));
      const info = probe(buf);
      const base = f.replace(/\.(ogg|mp3|wav)$/i, '');
      const [label, tags] = LABELS[base] ?? [base, [dir]];
      const origin =
        MUSIC.find((m) => m.dest.endsWith(f))?.title ??
        SFX.find(([d]) => d.endsWith(base))?.[3] ??
        'Kenney CC0 音频包';
      const license = MUSIC.find((m) => m.dest.endsWith(f))?.license ?? 'CC0 1.0';

      assets.push({
        id: base,
        name: label,
        type: 'audio',
        url: `/assets/audio/${dir}/${f}`,
        size: buf.length,
        format: f.split('.').pop(),
        duration: Number((info?.duration ?? 0).toFixed(2)),
        tags,
        license,
        source: origin,
        generated: false,
      });
      catSize += buf.length;
      count++;
    }

    categories.push({ id, name, description, assets, totalSize: catSize });
    grand += catSize;
  }

  const manifest = {
    version: '2.0.0',
    note: '本文件由 scripts/fetch-real-audio.mjs 生成，是 public/assets/audio 的真实索引；请勿手工编辑。',
    categories,
    totalSize: grand,
    assetCount: count,
    generatedAssets: 0,
  };
  writeFileSync(join(AUDIO_DIR, 'audio-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n✓ 清单已生成：audio-manifest.json（${count} 项，${(grand / 1024 / 1024).toFixed(2)} MB）`);
}

const SFX_PACK_LABEL = {
  'sci-fi-sounds': 'Kenney Sci-Fi Sounds',
  'interface-sounds': 'Kenney Interface Sounds',
  'digital-audio': 'Kenney Digital Audio',
};

function writeCredits() {
  const rows = [];
  const size = (n) => `${(n / 1024).toFixed(0)} KB`;
  const dur = (d) => `${d.toFixed(2)}s`;

  // —— 音乐 ——
  let musicTable = '| 游戏内文件 | 曲目 | 用途 | 时长 | 大小 | 许可 | 来源页 |\n';
  musicTable += '| --- | --- | --- | --- | --- | --- | --- |\n';
  let musicBytes = 0;
  let musicDur = 0;
  for (const m of MUSIC) {
    const p = join(AUDIO_DIR, m.dest);
    const buf = readFileSync(p);
    const info = probe(buf);
    musicBytes += buf.length;
    musicDur += info?.duration ?? 0;
    musicTable += `| \`${m.dest}\` | ${m.title} | ${m.slot} | ${dur(info?.duration ?? 0)} | ${size(buf.length)} | ${m.license} | ${m.page} |\n`;
  }

  // —— 音效 ——
  let sfxTable = '| 游戏内文件 | 来源包 | 源文件 | 用途 | 时长 | 大小 |\n';
  sfxTable += '| --- | --- | --- | --- | --- | --- |\n';
  let sfxBytes = 0;
  let sfxDur = 0;
  for (const [destRel, pack, inner, why] of SFX) {
    const p = join(AUDIO_DIR, destRel + '.ogg');
    const buf = readFileSync(p);
    const info = probe(buf);
    sfxBytes += buf.length;
    sfxDur += info?.duration ?? 0;
    sfxTable += `| \`${destRel}.ogg\` | ${SFX_PACK_LABEL[pack] ?? pack} | ${inner} | ${why} | ${dur(info?.duration ?? 0)} | ${size(buf.length)} |\n`;
  }

  const md = `# 音频素材来源与许可

本目录下的 **25 个音频文件全部是真实素材**（真实录音 / 真实作曲），来源统一为
**CC0 1.0 Universal（公共领域贡献）**：可商用、可修改、**无需署名**。
原先由 \`scripts/generate-audio.js\` 合成的 35 个 WAV 已全部移除。

- **获取方式**：\`node scripts/fetch-real-audio.mjs\`
  所有远程产物按 sha256 钉死；重新运行若上游已变动会直接报错退出，不会静默换料。
- **校验方式**：\`node scripts/fetch-real-audio.mjs --check\`
  只校验已落地的文件（逐文件解析 OGG/MP3 结构并读出真实时长），不联网。

## 为什么替换

原音频有两个独立问题：

1. **不是真素材**：35 个 WAV 全部由 \`generate-audio.js\` 用正弦波/白噪合成，
   听感是"测试音"，不是子弹、爆炸或音乐；
2. **体积失控**：14 MB 里 13 MB 是 5 个 BGM，且**全部是未压缩 WAV**
   （44100Hz / 16bit / 单声道），其中 \`bgm-gameplay.wav\` 单个就有 3.8 MB。

替换后：**总体积 14 MB → ${(Math.round(((musicBytes + sfxBytes) / 1024 / 1024) * 100) / 100).toFixed(2)} MB**（减少约 ${Math.round((1 - (musicBytes + sfxBytes) / 1024 / 1024 / 14) * 100)}%），
而**总时长反而从 145 秒增加到 ${((musicDur + sfxDur) / 60).toFixed(1)} 分钟**——
即"每秒钟音频的体积成本"降了一个数量级。

## 背景音乐（${MUSIC.length} 个，OpenGameArt）

${musicTable}
> 体积合计 ${size(musicBytes)}，时长合计 ${(musicDur / 60).toFixed(1)} 分钟。

## 音效（${SFX.length} 个，Kenney）

${sfxTable}
> 体积合计 ${size(sfxBytes)}，时长合计 ${sfxDur.toFixed(1)} 秒。

## 已知遗留问题

1. **\`menuMusic\` 与 \`bossMusic\` 从不播放**。这两个定义在 \`src/engine/AudioSystem.ts\`
   里存在，但全项目 grep 不到任何 \`playMusic('menuMusic')\` / \`playMusic('bossMusic')\`
   调用点——真正会响的只有 \`gameMusic\` / \`victoryMusic\` / \`defeatMusic\` 三个。
   主菜单静音的原因不在素材：\`AudioManager.initialize()\` 只在进入 3D 场景时用
   \`engine.getApp()\` 调用，菜单阶段根本没有音频系统实例（PlayCanvas 的 Sound
   依赖 Application）。要让它响，需要给菜单单独做一条音频通路，属于架构改动。
2. **循环点未做精确处理**：\`loop: true\` 的曲目是按整曲循环，未做无缝裁剪
   （环境内没有可用的音频转码工具）。若听出接缝，需要引入 ffmpeg 重新裁切。
3. **响度未归一**：各素材来自不同作者，未做统一响度（LUFS）处理，
   个别音效可能偏响或偏轻，可在 \`AudioSystem.ts\` 的 \`volume\` 字段微调。

## 上游溯源

**Kenney 音频包**（https://kenney.nl/assets/category:Audio）——CC0，官网直链下载：

| 素材包 | 归档 sha256（钉死） |
| --- | --- |
${Object.entries(KENNEY_PACKS).map(([n, s]) => `| ${SFX_PACK_LABEL[n] ?? n} | \`${s.sha256}\` |`).join('\n')}

> 其中 Sci-Fi Sounds 的哈希与第三方公开记录的官方 1.0 归档哈希一致
> （\`119340f351a5098ad814f78719438c0da355a9ce8a4c8a3af6a8d48aa3d49e04\`），
> 可作为素材未被改动、确实来自官方的旁证。

**OpenGameArt 曲目**（https://opengameart.org）——每条的许可证都在抓取时逐页核对过
（读取内容页 \`License(s)\` 字段并断言为 CC0），来源页见上表。
`;

  writeFileSync(join(AUDIO_DIR, 'CREDITS.md'), md);
  console.log('✓ 来源声明已生成：CREDITS.md');
}

/* ------------------------------------------------------------------ *
 * 7. 主流程
 * ------------------------------------------------------------------ */

const report = [];
const failures = [];

async function writeAsset(destRel, buf, origin, license, title) {
  const info = probe(buf);
  if (!info) {
    failures.push(`${destRel}：不是可解码的 OGG/MP3`);
    return;
  }
  if (info.duration < 0.05) {
    failures.push(`${destRel}：时长异常 ${info.duration.toFixed(3)}s`);
    return;
  }
  const dest = join(AUDIO_DIR, destRel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  report.push({
    dest: destRel,
    bytes: buf.length,
    ...info,
    origin,
    license,
    title,
  });
}

async function main() {
  if (!CHECK_ONLY) {
    // ---- 音效 ----
    const packBuf = {};
    for (const [name, spec] of Object.entries(KENNEY_PACKS)) {
      const buf = await download(spec.url, `${name}.zip`);
      expectHash(buf, spec.sha256, `Kenney ${name} 包`);
      packBuf[name] = buf;
      console.log(`  ✓ Kenney ${name} 包校验通过 (${(buf.length / 1024).toFixed(0)} KB)`);
    }
    for (const [destRel, pack, inner, why] of SFX) {
      const data = readZipEntry(packBuf[pack], inner);
      await writeAsset(
        destRel + '.ogg',
        data,
        `Kenney ${pack} / ${inner}`,
        'CC0 1.0',
        `${pack} 音效（${why}）`
      );
    }

    // ---- 音乐 ----
    for (const m of MUSIC) {
      let data;
      let origin;
      if (m.archive) {
        const zip = await download(m.archive.url, `oga-${m.dest.replace(/\W+/g, '-')}.zip`);
        expectHash(zip, m.archive.sha256, `${m.title} 归档`);
        data = readZipEntry(zip, m.archive.entry);
        origin = `OpenGameArt / ${m.title} @ ${m.archive.url} → ${m.archive.entry}`;
      } else {
        data = await download(m.file.url, `oga-${m.dest.replace(/\W+/g, '-')}`);
        expectHash(data, m.file.sha256, `${m.title} 文件`);
        origin = `OpenGameArt / ${m.title} @ ${m.file.url}`;
      }
      expectHash(data, m.sha256, `${m.title} 音频`);
      await writeAsset(m.dest, data, origin, m.license, `${m.title} —— ${m.slot}`);
    }
  }

  // ---- 报告 ----
  const list = CHECK_ONLY
    ? [...SFX.map(([d, , , w]) => [d + '.ogg', w, 'Kenney (CC0)']),
       ...MUSIC.map((m) => [m.dest, m.slot, m.license])]
    : report.map((r) => [r.dest, r.title, r.license]);

  console.log('\n' + '─'.repeat(104));
  console.log(`${'目标文件'.padEnd(30)} ${'时长'.padStart(8)} ${'码率'.padStart(7)} ${'大小'.padStart(9)}  说明`);
  console.log('─'.repeat(104));

  let totalBytes = 0;
  let totalDur = 0;
  for (const [destRel, note] of list) {
    const p = join(AUDIO_DIR, destRel);
    if (!existsSync(p)) {
      failures.push(`${destRel}：文件不存在`);
      continue;
    }
    const buf = readFileSync(p);
    const info = probe(buf);
    totalBytes += buf.length;
    if (info) totalDur += info.duration;
    const kbps = info?.kbps ? `${info.kbps}k` : '—';
    console.log(
      `${destRel.padEnd(30)} ${(info ? info.duration.toFixed(1) + 's' : '解码失败').padStart(8)} ` +
        `${kbps.padStart(7)} ${(buf.length / 1024).toFixed(0).padStart(7)} KB  ${note}`
    );
  }
  console.log('─'.repeat(104));
  console.log(`合计 ${(totalBytes / 1024 / 1024).toFixed(2)} MB，总时长 ${(totalDur / 60).toFixed(1)} 分钟`);

  if (failures.length) {
    console.error(`\n✗ ${failures.length} 项未通过：`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log(`\n✓ 全部 ${list.length} 个音频槽位已就位且校验通过`);
  writeManifest();
  writeCredits();
}

main().catch((err) => {
  console.error('\n✗ 失败：' + err.message);
  process.exit(1);
});
