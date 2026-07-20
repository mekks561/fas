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

const SOUND_DEFINITIONS: SoundDefinition[] = [
  { name: 'menuMusic', type: 'music', url: '/assets/audio/bgm/bgm-mainmenu.wav', loop: true, volume: 0.6, spatial: false },
  { name: 'gameMusic', type: 'music', url: '/assets/audio/bgm/bgm-gameplay.wav', loop: true, volume: 0.5, spatial: false },
  { name: 'victoryMusic', type: 'music', url: '/assets/audio/bgm/bgm-victory.wav', loop: false, volume: 0.7, spatial: false },
  { name: 'defeatMusic', type: 'music', url: '/assets/audio/bgm/bgm-story.wav', loop: false, volume: 0.5, spatial: false },
  { name: 'bossMusic', type: 'music', url: '/assets/audio/bgm/bgm-boss.wav', loop: true, volume: 0.6, spatial: false },
  { name: 'playerShoot', type: 'sfx', url: '/assets/audio/effects/sfx-laser.wav', loop: false, volume: 0.4, spatial: true },
  { name: 'playerHit', type: 'sfx', url: '/assets/audio/effects/sfx-damage.wav', loop: false, volume: 0.6, spatial: true },
  { name: 'playerBoost', type: 'sfx', url: '/assets/audio/effects/sfx-shield.wav', loop: true, volume: 0.5, spatial: true },
  { name: 'playerExplosion', type: 'sfx', url: '/assets/audio/effects/sfx-explosion.wav', loop: false, volume: 0.8, spatial: true },
  { name: 'enemyShoot', type: 'sfx', url: '/assets/audio/effects/sfx-plasma.wav', loop: false, volume: 0.3, spatial: true },
  { name: 'enemyHit', type: 'sfx', url: '/assets/audio/effects/sfx-damage.wav', loop: false, volume: 0.5, spatial: true },
  { name: 'enemyExplosion', type: 'sfx', url: '/assets/audio/effects/sfx-explosion.wav', loop: false, volume: 0.7, spatial: true },
  { name: 'powerup', type: 'sfx', url: '/assets/audio/effects/sfx-powerup.wav', loop: false, volume: 0.6, spatial: true },
  { name: 'weaponUpgrade', type: 'sfx', url: '/assets/audio/effects/sfx-powerup-spawn.wav', loop: false, volume: 0.5, spatial: true },
  { name: 'shieldActivate', type: 'sfx', url: '/assets/audio/effects/sfx-shield.wav', loop: false, volume: 0.4, spatial: true },
  { name: 'waveComplete', type: 'sfx', url: '/assets/audio/effects/sfx-wave-start.wav', loop: false, volume: 0.6, spatial: false },
  { name: 'levelComplete', type: 'sfx', url: '/assets/audio/effects/sfx-level-complete.wav', loop: false, volume: 0.7, spatial: false },
  { name: 'uiClick', type: 'sfx', url: '/assets/audio/ui/ui-click.wav', loop: false, volume: 0.3, spatial: false },
  { name: 'uiHover', type: 'sfx', url: '/assets/audio/ui/ui-select.wav', loop: false, volume: 0.2, spatial: false },
  { name: 'uiSelect', type: 'sfx', url: '/assets/audio/ui/ui-select.wav', loop: false, volume: 0.4, spatial: false },
  { name: 'uiSuccess', type: 'sfx', url: '/assets/audio/ui/ui-success.wav', loop: false, volume: 0.5, spatial: false },
  { name: 'uiError', type: 'sfx', url: '/assets/audio/ui/ui-error.wav', loop: false, volume: 0.4, spatial: false },
  { name: 'uiLevelUp', type: 'sfx', url: '/assets/audio/ui/ui-levelup.wav', loop: false, volume: 0.6, spatial: false },
  { name: 'uiAchievement', type: 'sfx', url: '/assets/audio/ui/ui-achievement.wav', loop: false, volume: 0.7, spatial: false },
  { name: 'missile', type: 'sfx', url: '/assets/audio/effects/sfx-missile.wav', loop: false, volume: 0.5, spatial: true },
  { name: 'heal', type: 'sfx', url: '/assets/audio/effects/sfx-heal.wav', loop: false, volume: 0.5, spatial: true },
  { name: 'bossRoar', type: 'sfx', url: '/assets/audio/effects/sfx-boss-roar.wav', loop: false, volume: 0.8, spatial: true },
  { name: 'nuke', type: 'sfx', url: '/assets/audio/effects/sfx-nuke.wav', loop: false, volume: 0.9, spatial: true },
  { name: 'blackhole', type: 'sfx', url: '/assets/audio/effects/sfx-blackhole.wav', loop: false, volume: 0.7, spatial: true },
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

    const options = {
      volume,
      loop: def.loop,
      spatialBlend: def.spatial && position ? 1 : 0,
      maxDistance: def.maxDistance || 30,
    };

    const soundAsset = asset.resource as unknown as { play: (opts: unknown) => pc.SoundInstance };
    const instance = soundAsset.play(options);

    if (position && def.spatial) {
      instance.setPosition(position);
    }

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
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioSystem(app);
    }
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
