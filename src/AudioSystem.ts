import { Scene } from '@babylonjs/core';
import { Sound, AudioEngine } from '@babylonjs/core/Audio';

export enum SoundType {
    FIRE_WEAPON,
    EXPLOSION,
    HIT,
    ENEMY_FIRE,
    ENGINE,
    MENU_SELECT,
    GAME_OVER,
    BOOST,
    POWERUP,
    DAMAGE,
    SHIELD
}

export class AudioSystem {
    private scene: Scene;
    private sounds: Map<SoundType, Sound> = new Map();
    private music: Sound | null = null;
    private musicVolume: number = 0.5;
    private sfxVolume: number = 0.8;
    private isMuted: boolean = false;
    private audioContext: AudioContext | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
        
        // 初始化音频引擎
        this.initializeAudio();
        
        // 预加载常用音效
        this.preloadSounds();
    }

    private initializeAudio(): void {
        const audioEngine = this.scene.getEngine() as any;
        if (audioEngine && audioEngine.audioEngine) {
            audioEngine.audioEngine.setGlobalVolume(1);
        }
        
        // 创建Web Audio Context用于生成音效
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported, falling back to Babylon.js sounds');
        }
    }

    private generateTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.1): AudioBuffer {
        if (!this.audioContext) {
            throw new Error('AudioContext not available');
        }
        
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const time = i / sampleRate;
            const envelope = 1 - time / duration;
            data[i] = Math.sin(2 * Math.PI * frequency * time) * envelope * volume;
        }
        
        return buffer;
    }

    private generateNoise(duration: number, volume: number = 0.1): AudioBuffer {
        if (!this.audioContext) {
            throw new Error('AudioContext not available');
        }
        
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const time = i / sampleRate;
            const envelope = 1 - time / duration;
            data[i] = (Math.random() * 2 - 1) * envelope * volume;
        }
        
        return buffer;
    }

    private createGeneratedSound(name: string, type: SoundType): Sound | null {
        if (!this.audioContext) return null;
        
        let buffer: AudioBuffer;
        
        try {
            switch (type) {
                case SoundType.FIRE_WEAPON:
                    buffer = this.generateTone(800, 0.1, 'square', 0.15);
                    break;
                case SoundType.EXPLOSION:
                    buffer = this.generateNoise(0.4, 0.2);
                    break;
                case SoundType.HIT:
                    buffer = this.generateTone(200, 0.15, 'sawtooth', 0.1);
                    break;
                case SoundType.ENEMY_FIRE:
                    buffer = this.generateTone(600, 0.08, 'square', 0.1);
                    break;
                case SoundType.ENGINE:
                    buffer = this.generateNoise(2, 0.05);
                    break;
                case SoundType.MENU_SELECT:
                    buffer = this.generateTone(523, 0.1, 'sine', 0.08);
                    break;
                case SoundType.GAME_OVER:
                    buffer = this.generateTone(150, 0.5, 'triangle', 0.1);
                    break;
                case SoundType.BOOST:
                    buffer = this.generateTone(400, 0.3, 'sawtooth', 0.12);
                    break;
                case SoundType.POWERUP:
                    buffer = this.generateTone(880, 0.2, 'sine', 0.1);
                    break;
                case SoundType.DAMAGE:
                    buffer = this.generateTone(100, 0.2, 'sawtooth', 0.15);
                    break;
                case SoundType.SHIELD:
                    buffer = this.generateTone(1200, 0.25, 'sine', 0.08);
                    break;
                default:
                    buffer = this.generateTone(440, 0.1, 'sine', 0.1);
            }
            
            const blob = new Blob([buffer.getChannelData(0)], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            
            return new Sound(name, url, this.scene, null, {
                loop: type === SoundType.ENGINE,
                volume: this.sfxVolume,
                autoplay: false
            });
        } catch (error) {
            console.warn('Failed to generate sound:', error);
            return null;
        }
    }

    private preloadSounds(): void {
        const soundPaths: Record<SoundType, string> = {
            [SoundType.FIRE_WEAPON]: '/audio/shot.wav',
            [SoundType.EXPLOSION]: '/audio/explosion.wav',
            [SoundType.HIT]: '/audio/hit.wav',
            [SoundType.ENEMY_FIRE]: '/audio/enemy_shot.wav',
            [SoundType.ENGINE]: '/audio/engine.wav',
            [SoundType.MENU_SELECT]: '/audio/menu.wav',
            [SoundType.GAME_OVER]: '/audio/gameover.wav',
            [SoundType.BOOST]: '/audio/boost.wav',
            [SoundType.POWERUP]: '/audio/powerup.wav',
            [SoundType.DAMAGE]: '/audio/damage.wav',
            [SoundType.SHIELD]: '/audio/shield.wav'
        };

        for (const [type, path] of Object.entries(soundPaths)) {
            const soundType = parseInt(type) as SoundType;
            
            const sound = this.createSoundWithFallback(
                SoundType[soundType],
                path,
                { loop: soundType === SoundType.ENGINE, volume: this.sfxVolume }
            );
            
            if (sound) {
                this.sounds.set(soundType, sound);
            }
        }
    }

    private createSoundWithFallback(name: string, url: string, options: any): Sound | null {
        try {
            const sound = new Sound(
                name,
                url,
                this.scene,
                () => {
                    console.log(`Loaded sound: ${name}`);
                },
                {
                    loop: options.loop || false,
                    volume: options.volume || this.sfxVolume,
                    autoplay: false
                }
            );
            return sound;
        } catch (error) {
            console.warn(`Error creating sound ${name}:`, error);
            const fallbackType = this.getSoundTypeByName(name);
            if (fallbackType !== null) {
                return this.createGeneratedSound(name + '_fallback', fallbackType);
            }
            return null;
        }
    }

    private getSoundTypeByName(name: string): SoundType | null {
        const typeName = name.toUpperCase();
        for (const [key, value] of Object.entries(SoundType)) {
            if (typeof value === 'string' && value.toUpperCase() === typeName) {
                return parseInt(key);
            }
        }
        return null;
    }

    private createSound(name: string, url: string, options: any): Sound {
        return new Sound(
            name,
            url,
            this.scene,
            null,
            {
                loop: options.loop || false,
                volume: options.volume || this.sfxVolume,
                autoplay: false,
                spatialSound: options.spatial || false,
                maxDistance: options.maxDistance || 1000
            }
        );
    }

    public playSound(type: SoundType, position?: any): void {
        if (this.isMuted) return;

        const sound = this.sounds.get(type);
        if (sound) {
            if (position) {
                sound.setPosition(position);
            }
            sound.play();
        }
    }

    public stopSound(type: SoundType): void {
        const sound = this.sounds.get(type);
        if (sound) {
            sound.stop();
        }
    }

    public loopSound(type: SoundType, loop: boolean): void {
        const sound = this.sounds.get(type);
        if (sound) {
            sound.loop = loop;
        }
    }

    public playMusic(url: string = 'https://assets.babylonjs.com/sounds/music.wav'): void {
        if (this.isMuted) return;

        // 停止当前音乐
        if (this.music) {
            this.music.stop();
            this.music.dispose();
        }

        // 创建并播放新音乐
        this.music = new Sound(
            'backgroundMusic',
            url,
            this.scene,
            () => {
                // 音乐加载完成回调
                this.music?.play();
            },
            { loop: true, volume: this.musicVolume, autoplay: false }
        );
    }

    public stopMusic(): void {
        if (this.music) {
            this.music.stop();
        }
    }

    public pauseMusic(): void {
        if (this.music) {
            this.music.pause();
        }
    }

    public resumeMusic(): void {
        if (this.music && !this.isMuted) {
            this.music.play();
        }
    }

    public setMusicVolume(volume: number): void {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        
        if (this.music) {
            this.music.setVolume(this.musicVolume);
        }
    }

    public setSFXVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        
        // 更新所有音效的音量
        for (const [type, sound] of this.sounds) {
            sound.setVolume(this.sfxVolume);
        }
    }

    public setMuted(muted: boolean): void {
        this.isMuted = muted;
        
        // 更新所有音效的静音状态
        for (const [type, sound] of this.sounds) {
            if (muted) {
                sound.setVolume(0);
            } else {
                sound.setVolume(this.sfxVolume);
            }
        }
        
        // 更新音乐的静音状态
        if (this.music) {
            if (muted) {
                this.music.setVolume(0);
            } else {
                this.music.setVolume(this.musicVolume);
            }
        }
    }

    public getMusicVolume(): number {
        return this.musicVolume;
    }

    public getSFXVolume(): number {
        return this.sfxVolume;
    }

    public isMutedState(): boolean {
        return this.isMuted;
    }

    public addCustomSound(id: string, url: string, options: any): Sound {
        const sound = new Sound(id, url, this.scene, null, {
            loop: options.loop || false,
            volume: options.volume || this.sfxVolume,
            autoplay: options.autoplay || false,
            spatialSound: options.spatial || false
        });
        
        return sound;
    }

    public dispose(): void {
        // 清理所有音效
        for (const [type, sound] of this.sounds) {
            if (sound && typeof sound.dispose === 'function') {
                try {
                    sound.dispose();
                } catch (error) {
                    console.warn('Error disposing sound:', error);
                }
            }
        }
        this.sounds.clear();
        
        // 清理音乐
        if (this.music && typeof this.music.dispose === 'function') {
            try {
                this.music.dispose();
                this.music = null;
            } catch (error) {
                console.warn('Error disposing music:', error);
                this.music = null;
            }
        }
    }
}