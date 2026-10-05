/**
 * 全局音乐与界面音效通道（不依赖 PlayCanvas 应用生命周期）
 *
 * 为什么需要它：
 * 音乐若挂在 GameScene 上（`AudioManager.playMusic`），结算/返回菜单时 GameScene 会被
 * React 卸载 → `PlayCanvasEngine` 销毁 → `pc.Application.destroy()` → `soundManager` 被销毁
 * → 正在播放的声音被立即掐断。也就是说「胜利音乐」「失败音乐」「主菜单音乐」这类
 * 必须**跨越界面切换**的声音，放在 GameScene 里等于没有。
 *
 * 因此职责这样切：
 * - **音乐（menu / game / boss / victory / defeat）+ 界面音效 + 结算音刺** → 本模块
 *   （HTMLAudioElement，活得比任何 React 组件都久）；
 * - **战斗内的空间音效**（开火、爆炸、命中、道具…）→ 仍走 `AudioManager` / `AudioSystem`，
 *   因为那些需要 3D 定位（`SoundInstance3d`）。
 *
 * 自动播放策略：浏览器要求先有用户手势才能出声。首次 `pointerdown` / `keydown` 时解锁，
 * 并补播解锁前请求过的那首曲子（`pendingTrack`）。
 */

export type MusicTrack = 'menu' | 'game' | 'boss' | 'victory' | 'defeat';

/** 一次性音效：界面反馈 + 会跨界面切换的结算音刺 */
export type CueName =
  | 'uiClick'
  | 'uiSelect'
  | 'uiHover'
  | 'uiSuccess'
  | 'uiError'
  | 'uiLevelUp'
  | 'uiAchievement'
  | 'levelComplete'
  | 'waveStart'
  | 'bossRoar'
  | 'playerExplosion';

const MUSIC_URLS: Record<MusicTrack, string> = {
  menu: '/assets/audio/bgm/bgm-mainmenu.ogg',
  game: '/assets/audio/bgm/bgm-gameplay.ogg',
  boss: '/assets/audio/bgm/bgm-boss.ogg',
  victory: '/assets/audio/bgm/bgm-victory.mp3',
  // bgm-story.ogg 在 AudioSystem 的键名即 defeatMusic（"Dark Intro"），沿用同一映射
  defeat: '/assets/audio/bgm/bgm-story.ogg',
};

const CUE_URLS: Record<CueName, string> = {
  uiClick: '/assets/audio/ui/ui-click.ogg',
  uiSelect: '/assets/audio/ui/ui-select.ogg',
  uiHover: '/assets/audio/ui/ui-select.ogg',
  uiSuccess: '/assets/audio/ui/ui-success.ogg',
  uiError: '/assets/audio/ui/ui-error.ogg',
  uiLevelUp: '/assets/audio/ui/ui-levelup.ogg',
  uiAchievement: '/assets/audio/ui/ui-achievement.ogg',
  levelComplete: '/assets/audio/effects/sfx-level-complete.ogg',
  waveStart: '/assets/audio/effects/sfx-wave-start.ogg',
  bossRoar: '/assets/audio/effects/sfx-boss-roar.ogg',
  // 阵亡爆炸：必须在 GameScene 卸载后仍能出声（见 GameScene 阵亡分支注释）
  playerExplosion: '/assets/audio/effects/sfx-explosion.ogg',
};

const DEFAULT_MUSIC_VOLUME = 0.6;
const DEFAULT_CUE_VOLUME = 0.8;

class GlobalAudioManager {
  private music = new Map<MusicTrack, HTMLAudioElement>();
  private cues = new Map<CueName, HTMLAudioElement>();
  private current: MusicTrack | null = null;
  private pendingTrack: MusicTrack | null = null;
  private unlocked = false;
  private muted = false;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private cueVolume = DEFAULT_CUE_VOLUME;
  /** 播放轨迹，DEV 下供自动化验证读取 */
  private history: MusicTrack[] = [];

  public constructor() {
    if (typeof window === 'undefined') return;

    // 首次用户手势时解锁（capture 阶段，保证任何按钮的处理器之前先解锁）
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true, once: true });
    window.addEventListener('keydown', unlock, { capture: true, once: true });

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>)['__audioDebug'] = {
        getCurrent: () => this.current,
        getHistory: () => [...this.history],
        isUnlocked: () => this.unlocked,
        /** 验证用：跳过自动播放限制，直接标记为已解锁 */
        forceUnlock: () => this.unlock(),
      };
    }
  }

  private unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    const pending = this.pendingTrack;
    this.pendingTrack = null;
    if (pending) this.playMusic(pending);
  }

  private getMusicElement(track: MusicTrack): HTMLAudioElement {
    const cached = this.music.get(track);
    if (cached) return cached;

    const el = new Audio(MUSIC_URLS[track]);
    el.loop = true;
    el.preload = 'auto';
    el.volume = this.effectiveMusicVolume();
    this.music.set(track, el);
    return el;
  }

  private getCueElement(name: CueName): HTMLAudioElement {
    const cached = this.cues.get(name);
    if (cached) return cached;

    const el = new Audio(CUE_URLS[name]);
    el.loop = false;
    el.preload = 'auto';
    el.volume = this.effectiveCueVolume();
    this.cues.set(name, el);
    return el;
  }

  private effectiveMusicVolume(): number {
    return this.muted ? 0 : this.musicVolume;
  }

  private effectiveCueVolume(): number {
    return this.muted ? 0 : this.cueVolume;
  }

  /** 播放背景音乐（幂等：同一首正在播时直接返回，不会重头开始） */
  public playMusic(track: MusicTrack): void {
    if (this.current === track) return;

    if (!this.unlocked) {
      this.pendingTrack = track;
      return;
    }

    this.stopMusic();

    const el = this.getMusicElement(track);
    el.volume = this.effectiveMusicVolume();
    el.currentTime = 0;

    const started = el.play();
    if (started && typeof started.catch === 'function') {
      started.catch(() => {
        // 仍被自动播放策略拦下：记下来，等下一次用户手势补播
        this.current = null;
        this.pendingTrack = track;
      });
    }

    this.current = track;
    this.history.push(track);
  }

  public stopMusic(): void {
    if (this.current) {
      const el = this.music.get(this.current);
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    }
    this.current = null;
  }

  /** 播放一次性音效（界面反馈 / 结算音刺）。静音时不发声但仍走流程。 */
  public playCue(name: CueName): void {
    if (this.muted) return;

    const el = this.getCueElement(name);
    el.volume = this.effectiveCueVolume();
    el.currentTime = 0;
    const started = el.play();
    if (started && typeof started.catch === 'function') {
      started.catch(() => {
        /* 自动播放被拦：界面音效不值得排队补播，静默忽略 */
      });
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    for (const el of this.music.values()) el.volume = this.effectiveMusicVolume();
    for (const el of this.cues.values()) el.volume = this.effectiveCueVolume();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMusicVolume(value: number): void {
    this.musicVolume = Math.max(0, Math.min(1, value));
    for (const el of this.music.values()) el.volume = this.effectiveMusicVolume();
  }

  public setCueVolume(value: number): void {
    this.cueVolume = Math.max(0, Math.min(1, value));
    for (const el of this.cues.values()) el.volume = this.effectiveCueVolume();
  }

  /** 当前正在播放的音乐（DEV 验证用） */
  public getCurrentMusic(): MusicTrack | null {
    return this.current;
  }
}

export const globalAudio = new GlobalAudioManager();
