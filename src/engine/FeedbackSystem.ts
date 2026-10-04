export type FeedbackType = 'hit' | 'damage' | 'heal' | 'shield' | 'explosion' | 'boost' | 'levelUp';

export interface FeedbackConfig {
  type: FeedbackType;
  intensity: number;
  duration: number;
  position?: { x: number; y: number };
}

export class FeedbackSystem {
  private audioContext: AudioContext | null = null;
  private isEnabled = true;
  private vibrationEnabled = true;

  private feedbackQueue: FeedbackConfig[] = [];
  private maxQueueSize = 20;

  private audioCache: Map<string, AudioBuffer> = new Map();

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    if (typeof AudioContext !== 'undefined') {
      this.audioContext = new AudioContext();
    }
  }

  public triggerFeedback(config: FeedbackConfig): void {
    if (!this.isEnabled) return;

    if (this.feedbackQueue.length >= this.maxQueueSize) {
      this.feedbackQueue.shift();
    }
    this.feedbackQueue.push(config);

    this.playSound(config);
    this.triggerVibration(config);
    this.showVisualEffect(config);
  }

  private playSound(config: FeedbackConfig): void {
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      const now = this.audioContext.currentTime;

      switch (config.type) {
        case 'hit':
          oscillator.frequency.setValueAtTime(400, now);
          oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.1);
          gainNode.gain.setValueAtTime(0.3 * config.intensity, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;

        case 'damage':
          oscillator.frequency.setValueAtTime(150, now);
          oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
          gainNode.gain.setValueAtTime(0.5 * config.intensity, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          oscillator.start(now);
          oscillator.stop(now + 0.2);
          break;

        case 'heal':
          oscillator.frequency.setValueAtTime(300, now);
          oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.3);
          gainNode.gain.setValueAtTime(0.2 * config.intensity, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          oscillator.start(now);
          oscillator.stop(now + 0.3);
          break;

        case 'shield':
          oscillator.frequency.setValueAtTime(800, now);
          oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
          gainNode.gain.setValueAtTime(0.25 * config.intensity, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          oscillator.start(now);
          oscillator.stop(now + 0.15);
          break;

        case 'explosion':
          oscillator.frequency.setValueAtTime(200, now);
          oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.3);
          gainNode.gain.setValueAtTime(0.6 * config.intensity, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          oscillator.start(now);
          oscillator.stop(now + 0.3);
          break;

        case 'boost':
          oscillator.frequency.setValueAtTime(200, now);
          oscillator.frequency.exponentialRampToValueAtTime(500, now + 0.2);
          gainNode.gain.setValueAtTime(0.3 * config.intensity, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          oscillator.start(now);
          oscillator.stop(now + 0.2);
          break;

        case 'levelUp':
          oscillator.frequency.setValueAtTime(400, now);
          oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.1);
          oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
          gainNode.gain.setValueAtTime(0.3 * config.intensity, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          oscillator.start(now);
          oscillator.stop(now + 0.3);
          break;
      }
    } catch {}
  }

  private triggerVibration(config: FeedbackConfig): void {
    if (!this.vibrationEnabled || typeof navigator.vibrate !== 'function') return;

    switch (config.type) {
      case 'hit':
        navigator.vibrate(10);
        break;

      case 'damage':
        navigator.vibrate([20, 10, 20]);
        break;

      case 'heal':
        navigator.vibrate(15);
        break;

      case 'shield':
        navigator.vibrate(5);
        break;

      case 'explosion':
        navigator.vibrate([30, 20, 30, 20, 50]);
        break;

      case 'boost':
        navigator.vibrate([5, 5, 5]);
        break;

      case 'levelUp':
        navigator.vibrate([50, 30, 50, 30, 100]);
        break;
    }
  }

  private showVisualEffect(config: FeedbackConfig): void {
    const element = document.createElement('div');
    element.style.position = 'fixed';
    element.style.left = '50%';
    element.style.top = '50%';
    element.style.transform = 'translate(-50%, -50%)';
    element.style.pointerEvents = 'none';
    element.style.zIndex = '9999';
    element.style.transition = `all ${config.duration}ms ease-out`;

    let text = '';
    let color = '';

    switch (config.type) {
      case 'hit':
        text = 'HIT!';
        color = '#ff6b6b';
        break;

      case 'damage':
        text = `- ${Math.round(config.intensity * 100)}`;
        color = '#ff0000';
        break;

      case 'heal':
        text = `+ ${Math.round(config.intensity * 100)}`;
        color = '#4ecdc4';
        break;

      case 'shield':
        text = 'SHIELD';
        color = '#45b7d1';
        break;

      case 'explosion':
        text = 'BOOM!';
        color = '#f9ca24';
        break;

      case 'boost':
        text = 'BOOST!';
        color = '#a55eea';
        break;

      case 'levelUp':
        text = 'LEVEL UP!';
        color = '#ff9ff3';
        break;
    }

    element.textContent = text;
    element.style.color = color;
    element.style.fontSize = '24px';
    element.style.fontWeight = 'bold';
    element.style.textShadow = `0 0 10px ${color}`;

    if (config.position) {
      element.style.left = `${config.position.x}px`;
      element.style.top = `${config.position.y}px`;
    }

    document.body.appendChild(element);

    requestAnimationFrame(() => {
      element.style.opacity = '0';
      element.style.transform = config.position
        ? `translate(-50%, -100px)`
        : 'translate(-50%, -150%)';
    });

    setTimeout(() => {
      element.remove();
    }, config.duration);
  }

  public hit(): void {
    this.triggerFeedback({ type: 'hit', intensity: 1, duration: 200 });
  }

  public damage(amount: number): void {
    const intensity = Math.min(amount / 100, 1);
    this.triggerFeedback({ type: 'damage', intensity, duration: 300 });
  }

  public heal(amount: number): void {
    const intensity = Math.min(amount / 100, 1);
    this.triggerFeedback({ type: 'heal', intensity, duration: 400 });
  }

  public shield(): void {
    this.triggerFeedback({ type: 'shield', intensity: 1, duration: 200 });
  }

  public explosion(): void {
    this.triggerFeedback({ type: 'explosion', intensity: 1, duration: 500 });
  }

  public boost(): void {
    this.triggerFeedback({ type: 'boost', intensity: 1, duration: 300 });
  }

  public levelUp(): void {
    this.triggerFeedback({ type: 'levelUp', intensity: 1, duration: 800 });
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public enableVibration(enabled: boolean): void {
    this.vibrationEnabled = enabled;
  }

  public isVibrationEnabled(): boolean {
    return this.vibrationEnabled;
  }

  public setAudioVolume(volume: number): void {
    if (this.audioContext) {
      const masterGain = this.audioContext.createGain();
      masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  public getFeedbackQueue(): FeedbackConfig[] {
    return [...this.feedbackQueue];
  }

  public clearFeedbackQueue(): void {
    this.feedbackQueue = [];
  }

  public destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.audioCache.clear();
    this.feedbackQueue = [];
  }
}
