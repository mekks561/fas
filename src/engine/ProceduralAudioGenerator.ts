export interface AudioConfig {
  type: 'engine' | 'weapon' | 'explosion' | 'ambient' | 'ui';
  duration: number;
  options?: AudioOptions;
}

export interface AudioOptions {
  frequency?: number;
  amplitude?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  filterType?: 'lowpass' | 'highpass' | 'bandpass';
  filterFrequency?: number;
  distortion?: number;
  reverb?: number;
}

export class ProceduralAudioGenerator {
  private audioContext: AudioContext;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  generate(config: AudioConfig): AudioBuffer {
    const { type, duration, options } = config;
    
    const sampleRate = this.audioContext.sampleRate;
    const length = duration * sampleRate;
    const buffer = this.audioContext.createBuffer(2, length, sampleRate);
    
    switch (type) {
      case 'engine':
        this.generateEngineSound(buffer, options);
        break;
      case 'weapon':
        this.generateWeaponSound(buffer, options);
        break;
      case 'explosion':
        this.generateExplosionSound(buffer, options);
        break;
      case 'ambient':
        this.generateAmbientSound(buffer, options);
        break;
      case 'ui':
        this.generateUISound(buffer, options);
        break;
    }

    return buffer;
  }

  private generateEngineSound(buffer: AudioBuffer, options: AudioOptions): void {
    const { frequency = 100, amplitude = 0.3, filterFrequency = 500 } = options || {};
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() * 2 - 1) * 0.5;
      const oscillator = Math.sin(2 * Math.PI * frequency * t);
      const modulator = Math.sin(2 * Math.PI * 2 * t);
      
      const sample = (noise + oscillator * (1 + modulator * 0.1)) * amplitude;
      leftData[i] = sample;
      rightData[i] = sample * (0.9 + Math.random() * 0.1);
    }

    this.applyLowpassFilter(buffer, filterFrequency);
  }

  private generateWeaponSound(buffer: AudioBuffer, options: AudioOptions): void {
    const { frequency = 800, amplitude = 0.5, attack = 0.01, decay = 0.1 } = options || {};
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let envelope = 0;
      
      if (t < attack) {
        envelope = t / attack;
      } else if (t < attack + decay) {
        envelope = 1 - (t - attack) / decay;
      }
      
      const noise = (Math.random() * 2 - 1);
      const oscillator = Math.sin(2 * Math.PI * frequency * t);
      
      const sample = (noise + oscillator) * amplitude * envelope;
      leftData[i] = sample;
      rightData[i] = sample;
    }
  }

  private generateExplosionSound(buffer: AudioBuffer, options: AudioOptions): void {
    const { amplitude = 0.8, attack = 0.05, decay = 0.5 } = options || {};
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let envelope = 0;
      
      if (t < attack) {
        envelope = (t / attack) ** 2;
      } else if (t < attack + decay) {
        envelope = Math.exp(-(t - attack) * 4);
      }
      
      const noise = (Math.random() * 2 - 1);
      const lowFreq = Math.sin(2 * Math.PI * 50 * t) * 0.5;
      
      const sample = (noise + lowFreq) * amplitude * envelope;
      leftData[i] = sample;
      rightData[i] = sample * (0.8 + Math.random() * 0.4);
    }

    this.applyLowpassFilter(buffer, 1000);
  }

  private generateAmbientSound(buffer: AudioBuffer, options: AudioOptions): void {
    const { amplitude = 0.1 } = options || {};
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() * 2 - 1) * 0.5;
      const lowOsc = Math.sin(2 * Math.PI * 20 * t) * 0.3;
      const medOsc = Math.sin(2 * Math.PI * 50 * t) * 0.2;
      
      const sample = (noise + lowOsc + medOsc) * amplitude;
      leftData[i] = sample;
      rightData[i] = sample * (0.95 + Math.random() * 0.1);
    }

    this.applyLowpassFilter(buffer, 200);
  }

  private generateUISound(buffer: AudioBuffer, options: AudioOptions): void {
    const { frequency = 880, amplitude = 0.3, attack = 0.005, decay = 0.1 } = options || {};
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let envelope = 0;
      
      if (t < attack) {
        envelope = t / attack;
      } else if (t < attack + decay) {
        envelope = Math.exp(-(t - attack) * 10);
      }
      
      const oscillator = Math.sin(2 * Math.PI * frequency * t);
      
      const sample = oscillator * amplitude * envelope;
      leftData[i] = sample;
      rightData[i] = sample;
    }
  }

  private applyLowpassFilter(buffer: AudioBuffer, cutoff: number): void {
    const sampleRate = buffer.sampleRate;
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / sampleRate;
    const alpha = dt / (rc + dt);
    
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    
    let lastLeft = 0;
    let lastRight = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      lastLeft = lastLeft + alpha * (leftData[i] - lastLeft);
      lastRight = lastRight + alpha * (rightData[i] - lastRight);
      leftData[i] = lastLeft;
      rightData[i] = lastRight;
    }
  }

  play(buffer: AudioBuffer): void {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  getAudioContext(): AudioContext {
    return this.audioContext;
  }

  resume(): void {
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}
