/**
 * 音频资源生成器
 * 用于生成游戏中需要的各种音频
 * 注意：由于Web Audio API的限制，这里提供的是音频配置和生成逻辑
 * 实际音频文件需要通过AudioContext来创建或从外部加载
 */
export class AudioGenerator {
  private audioContext: AudioContext | null = null;

  constructor() {
    // 尝试初始化AudioContext
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        this.audioContext = new AudioContext();
      } catch (error) {
        console.warn('AudioContext initialization failed:', error);
      }
    }
  }

  /**
   * 获取AudioContext实例
   */
  public getAudioContext(): AudioContext | null {
    if (!this.audioContext && typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        this.audioContext = new AudioContext();
      } catch (error) {
        console.warn('AudioContext initialization failed:', error);
      }
    }
    return this.audioContext;
  }

  /**
   * 生成爆炸音效
   */
  public generateExplosionSound(): OscillatorNode | null {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0.8, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);

    return oscillator;
  }

  /**
   * 生成射击音效
   */
  public generateShootSound(): OscillatorNode | null {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);

    return oscillator;
  }

  /**
   * 生成导弹发射音效
   */
  public generateMissileSound(): OscillatorNode | null {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
    oscillator.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.6);

    gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);

    return oscillator;
  }

  /**
   * 生成命中音效
   */
  public generateHitSound(): OscillatorNode | null {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.15);

    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);

    return oscillator;
  }

  /**
   * 生成道具获取音效
   */
  public generatePowerUpSound(): OscillatorNode | null {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.frequency.setValueAtTime(554, ctx.currentTime + 0.1); // C#
    oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.2); // E

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime + 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);

    return oscillator;
  }

  /**
   * 生成引擎循环音效（返回用于持续播放的节点）
   */
  public createEngineLoopSound(): { oscillator: OscillatorNode; gainNode: GainNode } | null {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(80, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.05, ctx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    return { oscillator, gainNode };
  }

  /**
   * 播放爆炸音效
   */
  public playExplosion(): void {
    this.generateExplosionSound();
  }

  /**
   * 播放射击音效
   */
  public playShoot(): void {
    this.generateShootSound();
  }

  /**
   * 播放导弹发射音效
   */
  public playMissile(): void {
    this.generateMissileSound();
  }

  /**
   * 播放命中音效
   */
  public playHit(): void {
    this.generateHitSound();
  }

  /**
   * 播放道具获取音效
   */
  public playPowerUp(): void {
    this.generatePowerUpSound();
  }

  /**
   * 创建背景音乐生成器
   * 这是一个简单的程序化背景音乐生成
   */
  public createBackgroundMusic(duration: number = 60): AudioBufferSourceNode | null {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    const sampleRate = ctx.sampleRate;
    const bufferSize = duration * sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, sampleRate);

    // 左右声道
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);

    // 简单的程序化音乐生成
    const bpm = 120;
    const beatDuration = 60 / bpm;
    const samplesPerBeat = Math.floor(beatDuration * sampleRate);

    for (let i = 0; i < bufferSize; i++) {
      const beatIndex = Math.floor(i / samplesPerBeat);
      const beatProgress = (i % samplesPerBeat) / samplesPerBeat;

      // 低音
      const bassFreq = 55; // A1
      const bassValue = Math.sin((2 * Math.PI * bassFreq * i) / sampleRate) * 0.3;

      // 中音
      const midFreq = 220; // A3
      const midValue = Math.sin((2 * Math.PI * midFreq * i) / sampleRate) * 0.15;

      // 高音（简单的旋律）
      const melodyFreq = this.getMelodyNote(beatIndex) * 2;
      const melodyValue = Math.sin((2 * Math.PI * melodyFreq * i) / sampleRate) * 0.1;

      // 包络
      const envelope =
        beatProgress < 0.1 ? beatProgress * 10 : beatProgress > 0.9 ? (1 - beatProgress) * 10 : 1;

      const sample = (bassValue + midValue + melodyValue) * envelope * 0.5;

      leftChannel[i] = sample;
      rightChannel[i] = sample * 0.9;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    return source;
  }

  /**
   * 获取旋律音符频率
   */
  private getMelodyNote(beatIndex: number): number {
    const scale = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25]; // C大调音阶
    const pattern = [0, 2, 4, 5, 4, 2, 0, 4, 2, 0, 4, 5, 7, 5, 4, 2];
    return scale[pattern[beatIndex % pattern.length]];
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// 导出音效类型
export type SoundType = 'explosion' | 'shoot' | 'missile' | 'hit' | 'powerup';

// 音效配置
export const SOUND_CONFIGS = {
  explosion: {
    duration: 0.5,
    volume: 0.8,
    type: 'sawtooth' as OscillatorType,
  },
  shoot: {
    duration: 0.1,
    volume: 0.3,
    type: 'square' as OscillatorType,
  },
  missile: {
    duration: 0.6,
    volume: 0.4,
    type: 'sawtooth' as OscillatorType,
  },
  hit: {
    duration: 0.15,
    volume: 0.5,
    type: 'triangle' as OscillatorType,
  },
  powerup: {
    duration: 0.4,
    volume: 0.3,
    type: 'sine' as OscillatorType,
  },
};
