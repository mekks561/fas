import * as pc from 'playcanvas';

export type SoundType = 'music' | 'sfx' | 'voice';

export interface AudioConfig {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  mute: boolean;
  spatialAudio: boolean;
}

export interface SoundDefinition {
  name: string;
  type: SoundType;
  url: string;
  loop: boolean;
  volume: number;
  spatial: boolean;
  maxDistance?: number;
}

const DEFAULT_CONFIG: AudioConfig = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  voiceVolume: 0.7,
  mute: false,
  spatialAudio: true,
};

// 注意：这里**只有音效**，没有音乐。
// 音乐（menu / game / boss / victory / defeat）统一由 `src/engine/GlobalAudio.ts` 负责：
// 它基于 HTMLAudioElement，不依赖 pc.Application，因此能活过界面切换；
// 而本模块的声音挂在 app.soundManager 上，GameScene 卸载（结算/返回菜单）时会随之销毁。
// 早前 5 首 BGM 同时在这里定义，结果是它们被 PlayCanvas 预载解码一遍、又没人播放，
// 纯属双份开销 —— 已移除以确立单一所有权。
const SOUND_DEFINITIONS: SoundDefinition[] = [
  {
    name: 'playerShoot',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-laser.ogg',
    loop: false,
    volume: 0.4,
    spatial: true,
  },
  {
    name: 'playerHit',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-damage.ogg',
    loop: false,
    volume: 0.6,
    spatial: true,
  },
  {
    name: 'playerBoost',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-shield.ogg',
    loop: true,
    volume: 0.5,
    spatial: true,
  },
  {
    name: 'playerExplosion',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-explosion.ogg',
    loop: false,
    volume: 0.8,
    spatial: true,
  },
  {
    name: 'enemyShoot',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-plasma.ogg',
    loop: false,
    volume: 0.3,
    spatial: true,
  },
  {
    name: 'enemyHit',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-damage.ogg',
    loop: false,
    volume: 0.5,
    spatial: true,
  },
  {
    name: 'enemyExplosion',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-explosion.ogg',
    loop: false,
    volume: 0.7,
    spatial: true,
  },
  {
    name: 'powerup',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-powerup.ogg',
    loop: false,
    volume: 0.6,
    spatial: true,
  },
  {
    name: 'weaponUpgrade',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-powerup-spawn.ogg',
    loop: false,
    volume: 0.5,
    spatial: true,
  },
  {
    name: 'shieldActivate',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-shield.ogg',
    loop: false,
    volume: 0.4,
    spatial: true,
  },
  {
    name: 'waveComplete',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-wave-start.ogg',
    loop: false,
    volume: 0.6,
    spatial: false,
  },
  {
    name: 'levelComplete',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-level-complete.ogg',
    loop: false,
    volume: 0.7,
    spatial: false,
  },
  {
    name: 'uiClick',
    type: 'sfx',
    url: '/assets/audio/ui/ui-click.ogg',
    loop: false,
    volume: 0.3,
    spatial: false,
  },
  {
    name: 'uiHover',
    type: 'sfx',
    url: '/assets/audio/ui/ui-select.ogg',
    loop: false,
    volume: 0.2,
    spatial: false,
  },
  {
    name: 'uiSelect',
    type: 'sfx',
    url: '/assets/audio/ui/ui-select.ogg',
    loop: false,
    volume: 0.4,
    spatial: false,
  },
  {
    name: 'uiSuccess',
    type: 'sfx',
    url: '/assets/audio/ui/ui-success.ogg',
    loop: false,
    volume: 0.5,
    spatial: false,
  },
  {
    name: 'uiError',
    type: 'sfx',
    url: '/assets/audio/ui/ui-error.ogg',
    loop: false,
    volume: 0.4,
    spatial: false,
  },
  {
    name: 'uiLevelUp',
    type: 'sfx',
    url: '/assets/audio/ui/ui-levelup.ogg',
    loop: false,
    volume: 0.6,
    spatial: false,
  },
  {
    name: 'uiAchievement',
    type: 'sfx',
    url: '/assets/audio/ui/ui-achievement.ogg',
    loop: false,
    volume: 0.7,
    spatial: false,
  },
  {
    name: 'missile',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-missile.ogg',
    loop: false,
    volume: 0.5,
    spatial: true,
  },
  {
    name: 'heal',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-heal.ogg',
    loop: false,
    volume: 0.5,
    spatial: true,
  },
  {
    name: 'bossRoar',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-boss-roar.ogg',
    loop: false,
    volume: 0.8,
    spatial: true,
  },
  {
    name: 'nuke',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-nuke.ogg',
    loop: false,
    volume: 0.9,
    spatial: true,
  },
  {
    name: 'blackhole',
    type: 'sfx',
    url: '/assets/audio/effects/sfx-blackhole.ogg',
    loop: false,
    volume: 0.7,
    spatial: true,
  },
];

export class AudioSystem {
  private app: pc.Application;
  private config: AudioConfig;
  private sounds: Map<string, pc.Asset> = new Map();
  private playingSounds: Map<string, pc.SoundInstance> = new Map();
  private currentMusic: pc.SoundInstance | null = null;
  private currentMusicName: string = '';

  constructor(app: pc.Application) {
    this.app = app;
    this.config = { ...DEFAULT_CONFIG };
    this.loadSounds();
  }

  private loadSounds(): void {
    SOUND_DEFINITIONS.forEach((def) => {
      if (def.url) {
        const asset = new pc.Asset(def.name, 'audio', { url: def.url });
        this.app.assets.add(asset);
        this.app.assets.load(asset);
        this.sounds.set(def.name, asset);
      }
    });
  }

  private getVolume(type: SoundType): number {
    if (this.config.mute) return 0;

    let volume = this.config.masterVolume;

    switch (type) {
      case 'music':
        volume *= this.config.musicVolume;
        break;
      case 'sfx':
        volume *= this.config.sfxVolume;
        break;
      case 'voice':
        volume *= this.config.voiceVolume;
        break;
    }

    return Math.max(0, Math.min(1, volume));
  }

  public playSound(name: string, position?: pc.Vec3): pc.SoundInstance | null {
    const def = SOUND_DEFINITIONS.find((d) => d.name === name);
    if (!def) {
      console.warn(`Sound '${name}' not found`);
      return null;
    }

    const asset = this.sounds.get(name);
    if (!asset || !asset.resource) {
      return this.playGeneratedSound(def);
    }

    const volume = this.getVolume(def.type) * def.volume;

    // Engine 2：Sound.play() 已移除，播放统一走 new SoundInstance(...).play()。
    // 旧的 spatialBlend / maxDistance 选项已不存在 —— 空间音效改用 SoundInstance3d。
    // 注意：这里不能再用 `as unknown as { play }` 强转，那会让引擎 API 变更绕过类型检查
    // （本次迁移中该写法直接导致了运行时 509 条 `soundAsset.play is not a function`）。
    const sound = asset.resource as pc.Sound;
    const instance: pc.SoundInstance =
      def.spatial && position
        ? new pc.SoundInstance3d(this.app.soundManager, sound, {
            volume,
            loop: def.loop,
            position,
            maxDistance: def.maxDistance || 30,
          })
        : new pc.SoundInstance(this.app.soundManager, sound, {
            volume,
            loop: def.loop,
          });

    instance.play();

    this.playingSounds.set(name, instance);

    if (!def.loop) {
      instance.on('end', () => {
        this.playingSounds.delete(name);
      });
    }

    return instance;
  }

  private playGeneratedSound(def: SoundDefinition): pc.SoundInstance | null {
    const appAudio = (this.app as unknown as { audio?: { context: AudioContext } }).audio;
    if (!appAudio) return null;
    const audioContext = appAudio.context;
    if (!audioContext) return null;

    const volume = this.getVolume(def.type) * def.volume;

    let buffer: AudioBuffer;

    switch (def.name) {
      case 'playerShoot':
        buffer = this.generateShootSound(audioContext);
        break;
      case 'playerHit':
        buffer = this.generateHitSound(audioContext);
        break;
      case 'playerExplosion':
        buffer = this.generateExplosionSound(audioContext);
        break;
      case 'enemyExplosion':
        buffer = this.generateExplosionSound(audioContext, 0.5);
        break;
      case 'powerup':
        buffer = this.generatePowerupSound(audioContext);
        break;
      case 'weaponUpgrade':
        buffer = this.generateUpgradeSound(audioContext);
        break;
      case 'uiClick':
        buffer = this.generateClickSound(audioContext);
        break;
      case 'uiHover':
        buffer = this.generateHoverSound(audioContext);
        break;
      case 'uiSelect':
        buffer = this.generateSelectSound(audioContext);
        break;
      case 'waveComplete':
        buffer = this.generateWaveCompleteSound(audioContext);
        break;
      default:
        return null;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start();

    return null;
  }

  private generateShootSound(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 30) * Math.sin(t * 8000);
    }

    return buffer;
  }

  private generateHitSound(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 15) * Math.sin(t * 300 + t * t * 1000);
    }

    return buffer;
  }

  private generateExplosionSound(ctx: AudioContext, duration: number = 0.8): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const envelope = Math.exp(-t * 3);
      const noise = Math.random() * 2 - 1;
      const lowFreq = Math.sin(t * 100);
      data[i] = (noise * 0.8 + lowFreq * 0.2) * envelope;
    }

    return buffer;
  }

  private generatePowerupSound(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const freq = 440 + t * 880;
      data[i] = Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * 4);
    }

    return buffer;
  }

  private generateUpgradeSound(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const freq = 220 * Math.pow(2, Math.floor(t * 4));
      data[i] = Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * 3);
    }

    return buffer;
  }

  private generateClickSound(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = Math.sin(t * 2000 * Math.PI * 2) * Math.exp(-t * 50);
    }

    return buffer;
  }

  private generateHoverSound(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = Math.sin(t * 3000 * Math.PI * 2) * Math.exp(-t * 80);
    }

    return buffer;
  }

  private generateSelectSound(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const freq = 660 + t * 440;
      data[i] = Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * 20);
    }

    return buffer;
  }

  private generateWaveCompleteSound(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const note = Math.floor(t * 3);
      const freq = 440 * Math.pow(2, note / 12);
      data[i] = Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * 2) * (1 - note * 0.2);
    }

    return buffer;
  }

  public playMusic(name: string): void {
    if (this.currentMusicName === name) return;

    this.stopMusic();

    const def = SOUND_DEFINITIONS.find((d) => d.name === name && d.type === 'music');
    if (!def) return;

    this.currentMusicName = name;
    this.playSound(name);
  }

  public stopMusic(): void {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic = null;
    }

    const musicInstance = this.playingSounds.get(this.currentMusicName);
    if (musicInstance) {
      musicInstance.stop();
      this.playingSounds.delete(this.currentMusicName);
    }

    this.currentMusicName = '';
  }

  public pauseMusic(): void {
    const musicInstance = this.playingSounds.get(this.currentMusicName);
    if (musicInstance) {
      musicInstance.pause();
    }
  }

  public resumeMusic(): void {
    const musicInstance = this.playingSounds.get(this.currentMusicName);
    if (musicInstance) {
      musicInstance.play();
    }
  }

  public stopSound(name: string): void {
    const instance = this.playingSounds.get(name);
    if (instance) {
      instance.stop();
      this.playingSounds.delete(name);
    }
  }

  public stopAllSounds(): void {
    this.playingSounds.forEach((instance) => instance.stop());
    this.playingSounds.clear();
  }

  public setConfig(config: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateVolumes();
  }

  private updateVolumes(): void {
    this.playingSounds.forEach((instance, name) => {
      const def = SOUND_DEFINITIONS.find((d) => d.name === name);
      if (def) {
        const volume = this.getVolume(def.type) * def.volume;
        instance.volume = volume;
      }
    });
  }

  public getConfig(): AudioConfig {
    return { ...this.config };
  }

  public toggleMute(): boolean {
    this.config.mute = !this.config.mute;
    this.updateVolumes();
    return this.config.mute;
  }

  public setMasterVolume(value: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, value));
    this.updateVolumes();
  }

  public setMusicVolume(value: number): void {
    this.config.musicVolume = Math.max(0, Math.min(1, value));
    this.updateVolumes();
  }

  public setSfxVolume(value: number): void {
    this.config.sfxVolume = Math.max(0, Math.min(1, value));
    this.updateVolumes();
  }

  public setVoiceVolume(value: number): void {
    this.config.voiceVolume = Math.max(0, Math.min(1, value));
    this.updateVolumes();
  }

  public isMuted(): boolean {
    return this.config.mute;
  }

  /** 供 AudioManager 判断底层 pc.Application 是否已被替换（GameScene 重挂载） */
  public getApp(): pc.Application {
    return this.app;
  }

  /** 当前背景音乐名（键名，如 'bossMusic'） */
  public getCurrentMusic(): string {
    return this.currentMusicName;
  }

  public isPlaying(name: string): boolean {
    return this.playingSounds.has(name);
  }

  public getPlayingSounds(): string[] {
    return Array.from(this.playingSounds.keys());
  }

  public destroy(): void {
    this.stopAllSounds();
    this.sounds.clear();
  }
}

export class AudioManager {
  private static instance: AudioSystem | null = null;

  public static initialize(app: pc.Application): void {
    const existing = AudioManager.instance;
    if (existing) {
      // GameScene 每次挂载都会 new 一个 pc.Application；旧的会被 destroy，
      // 其 soundManager / assets 随即失效。若这里仍然沿用旧实例，重开一局后
      // 所有音效都会「静默失效」（调用不报错，但没有任何声音）。
      // 因此换 app 时必须重建实例并重新加载音频资源。
      if (existing.getApp() === app) return;
      existing.destroy();
      AudioManager.instance = null;
    }
    AudioManager.instance = new AudioSystem(app);
  }

  public static isInitialized(): boolean {
    return AudioManager.instance !== null;
  }

  public static get(): AudioSystem {
    if (!AudioManager.instance) {
      throw new Error('AudioManager not initialized');
    }
    return AudioManager.instance;
  }

  public static playSound(name: string, position?: pc.Vec3): pc.SoundInstance | null {
    return AudioManager.get().playSound(name, position);
  }

  public static playMusic(name: string): void {
    AudioManager.get().playMusic(name);
  }

  public static stopMusic(): void {
    AudioManager.get().stopMusic();
  }

  public static pauseMusic(): void {
    AudioManager.get().pauseMusic();
  }

  public static resumeMusic(): void {
    AudioManager.get().resumeMusic();
  }

  public static toggleMute(): boolean {
    return AudioManager.get().toggleMute();
  }

  public static setVolume(type: SoundType, value: number): void {
    const audio = AudioManager.get();
    switch (type) {
      case 'music':
        audio.setMusicVolume(value);
        break;
      case 'sfx':
        audio.setSfxVolume(value);
        break;
      case 'voice':
        audio.setVoiceVolume(value);
        break;
    }
  }

  public static destroy(): void {
    if (AudioManager.instance) {
      AudioManager.instance.destroy();
      AudioManager.instance = null;
    }
  }
}
