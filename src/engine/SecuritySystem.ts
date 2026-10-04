export interface SecurityConfig {
  enableEncryption: boolean;
  encryptionKey: string;
  enableInputSanitization: boolean;
  enableCheatDetection: boolean;
  maxScorePerSecond: number;
  maxWavePerMinute: number;
}

const DEFAULT_CONFIG: SecurityConfig = {
  enableEncryption: true,
  // 生产环境必须通过 VITE_SECURITY_KEY 配置;此回退值仅用于本地开发
  encryptionKey: import.meta.env.VITE_SECURITY_KEY ?? 'dev-only-fallback-key-CHANGE-IN-PRODUCTION',
  enableInputSanitization: true,
  enableCheatDetection: true,
  maxScorePerSecond: 1000,
  maxWavePerMinute: 10,
};

export class SecuritySystem {
  private config: SecurityConfig;
  private gameStartTime: number = 0;
  private lastScoreReport: { score: number; time: number } | null = null;
  private lastWaveReport: { wave: number; time: number } | null = null;
  private cheatReports: Array<{ type: string; data: unknown; time: number }> = [];
  private cachedKey: CryptoKey | null = null;
  private cachedKeySource: string = '';

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public async encryptData<T>(data: T): Promise<string> {
    if (!this.config.enableEncryption) {
      return JSON.stringify(data);
    }

    const jsonString = JSON.stringify(data);
    const key = await this.getDerivedKey();
    // AES-GCM 推荐 12 字节 nonce
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(jsonString),
    );

    // 输出格式: base64(iv) + '.' + base64(ciphertext)
    return `${this.toBase64(iv)}.${this.toBase64(new Uint8Array(ciphertext))}`;
  }

  public async decryptData<T>(encryptedData: string): Promise<T | null> {
    if (!this.config.enableEncryption) {
      try {
        return JSON.parse(encryptedData) as T;
      } catch {
        return null;
      }
    }

    try {
      const parts = encryptedData.split('.');
      if (parts.length !== 2) {
        return null;
      }

      const iv = this.fromBase64(parts[0]);
      const ciphertext = this.fromBase64(parts[1]);
      const key = await this.getDerivedKey();

      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

      return JSON.parse(new TextDecoder().decode(decrypted)) as T;
    } catch {
      return null;
    }
  }

  /**
   * 使用 PBKDF2 从配置密钥派生 AES-GCM 256 位密钥,并缓存以避免重复派生。
   * 替代原先"100 轮 sha256"的非标准密钥派生。
   */
  private async getDerivedKey(): Promise<CryptoKey> {
    if (this.cachedKey && this.cachedKeySource === this.config.encryptionKey) {
      return this.cachedKey;
    }

    // 固定应用级 salt(不保密,仅防预计算);从应用标识派生
    const saltBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('fighter-game-security-salt-v1'),
    );
    const salt = new Uint8Array(saltBuffer).slice(0, 16);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.config.encryptionKey),
      'PBKDF2',
      false,
      ['deriveKey'],
    );

    const derivedKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );

    this.cachedKey = derivedKey;
    this.cachedKeySource = this.config.encryptionKey;
    return derivedKey;
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private fromBase64(b64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  public sanitizeInput(input: string): string {
    if (!this.config.enableInputSanitization) {
      return input;
    }

    let sanitized = input;

    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '_on=');
    sanitized = sanitized.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    sanitized = sanitized.replace(/&amp;/g, '&');

    const allowedTags = ['b', 'i', 'u', 'em', 'strong'];
    const tagPattern = /<(\/?)(\w+)([^>]*)>/gi;
    sanitized = sanitized.replace(tagPattern, (_match, closing, tag, attrs) => {
      if (allowedTags.includes(tag.toLowerCase())) {
        return `<${closing}${tag}${attrs}>`;
      }
      return '';
    });

    const maxLength = 5000;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    const blacklist = [
      'eval(',
      'document.cookie',
      'document.write',
      'window.location',
      'alert(',
      'confirm(',
      'prompt(',
      'new Function(',
      'XMLHttpRequest',
      'fetch(',
      'localStorage',
      'sessionStorage',
    ];

    blacklist.forEach((term) => {
      sanitized = sanitized.replace(new RegExp(term, 'gi'), '[REDACTED]');
    });

    return sanitized.trim();
  }

  public validateUsername(username: string): { valid: boolean; error?: string } {
    if (!username || username.length === 0) {
      return { valid: false, error: '用户名不能为空' };
    }

    if (username.length < 3) {
      return { valid: false, error: '用户名至少3个字符' };
    }

    if (username.length > 20) {
      return { valid: false, error: '用户名最多20个字符' };
    }

    const regex = /^[a-zA-Z0-9_]+$/;
    if (!regex.test(username)) {
      return { valid: false, error: '用户名只能包含字母、数字和下划线' };
    }

    const sanitized = this.sanitizeInput(username);
    if (sanitized !== username) {
      return { valid: false, error: '用户名包含非法字符' };
    }

    return { valid: true };
  }

  public validateEmail(email: string): { valid: boolean; error?: string } {
    if (!email || email.length === 0) {
      return { valid: false, error: '邮箱不能为空' };
    }

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) {
      return { valid: false, error: '邮箱格式不正确' };
    }

    if (email.length > 255) {
      return { valid: false, error: '邮箱地址过长' };
    }

    return { valid: true };
  }

  public validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password || password.length === 0) {
      return { valid: false, error: '密码不能为空' };
    }

    if (password.length < 6) {
      return { valid: false, error: '密码至少6个字符' };
    }

    if (password.length > 100) {
      return { valid: false, error: '密码最多100个字符' };
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLetter || !hasNumber) {
      return { valid: false, error: '密码必须包含字母和数字' };
    }

    return { valid: true };
  }

  public startGameSession(): void {
    this.gameStartTime = Date.now();
    this.lastScoreReport = null;
    this.lastWaveReport = null;
    this.cheatReports = [];
  }

  public getGameDuration(): number {
    return Date.now() - this.gameStartTime;
  }

  public validateScore(
    score: number,
    gameDuration: number,
  ): { valid: boolean; cheat?: boolean; reason?: string } {
    if (!this.config.enableCheatDetection) {
      return { valid: true };
    }

    if (score < 0) {
      return { valid: false, cheat: true, reason: '分数不能为负数' };
    }

    if (score > 10000000) {
      return { valid: false, cheat: true, reason: '分数超出合理范围' };
    }

    const timeInSeconds = gameDuration / 1000;
    if (timeInSeconds > 0) {
      const scorePerSecond = score / timeInSeconds;
      if (scorePerSecond > this.config.maxScorePerSecond) {
        this.reportCheat('score_rate', { score, time: timeInSeconds, rate: scorePerSecond });
        return {
          valid: false,
          cheat: true,
          reason: `得分速度异常 (${scorePerSecond.toFixed(2)}/秒 > ${this.config.maxScorePerSecond}/秒)`,
        };
      }
    }

    if (this.lastScoreReport) {
      const timeDiff = Date.now() - this.lastScoreReport.time;
      const scoreDiff = score - this.lastScoreReport.score;

      if (timeDiff > 0 && scoreDiff > 0) {
        const rate = scoreDiff / (timeDiff / 1000);
        if (rate > this.config.maxScorePerSecond * 2) {
          this.reportCheat('score_spike', {
            score,
            previousScore: this.lastScoreReport.score,
            timeDiff,
          });
          return {
            valid: false,
            cheat: true,
            reason: '分数增长异常',
          };
        }
      }
    }

    this.lastScoreReport = { score, time: Date.now() };
    return { valid: true };
  }

  public validateWave(
    wave: number,
    gameDuration: number,
  ): { valid: boolean; cheat?: boolean; reason?: string } {
    if (!this.config.enableCheatDetection) {
      return { valid: true };
    }

    if (wave < 1) {
      return { valid: false, cheat: true, reason: '波次至少为1' };
    }

    if (wave > 100) {
      return { valid: false, cheat: true, reason: '波次超出合理范围' };
    }

    const timeInMinutes = gameDuration / 60000;
    if (timeInMinutes > 0) {
      const wavesPerMinute = wave / timeInMinutes;
      if (wavesPerMinute > this.config.maxWavePerMinute) {
        this.reportCheat('wave_rate', { wave, time: timeInMinutes, rate: wavesPerMinute });
        return {
          valid: false,
          cheat: true,
          reason: `波次推进过快 (${wavesPerMinute.toFixed(2)}/分钟 > ${this.config.maxWavePerMinute}/分钟)`,
        };
      }
    }

    if (this.lastWaveReport && wave > this.lastWaveReport.wave) {
      const timeDiff = Date.now() - this.lastWaveReport.time;
      if (timeDiff < 5000) {
        this.reportCheat('wave_spike', { wave, previousWave: this.lastWaveReport.wave, timeDiff });
        return {
          valid: false,
          cheat: true,
          reason: '波次切换过快',
        };
      }
    }

    this.lastWaveReport = { wave, time: Date.now() };
    return { valid: true };
  }

  public validateKills(
    kills: number,
    wave: number,
  ): { valid: boolean; cheat?: boolean; reason?: string } {
    if (!this.config.enableCheatDetection) {
      return { valid: true };
    }

    if (kills < 0) {
      return { valid: false, cheat: true, reason: '击杀数不能为负数' };
    }

    if (kills > wave * 100) {
      return { valid: false, cheat: true, reason: '击杀数与波次不匹配' };
    }

    return { valid: true };
  }

  private reportCheat(type: string, data: unknown): void {
    this.cheatReports.push({
      type,
      data,
      time: Date.now(),
    });

    if (this.cheatReports.length > 100) {
      this.cheatReports.shift();
    }

    console.warn(`[SecuritySystem] Cheat detected: ${type}`, data);
  }

  public getCheatReports(): Array<{ type: string; data: unknown; time: number }> {
    return [...this.cheatReports];
  }

  public hasCheatReports(): boolean {
    return this.cheatReports.length > 0;
  }

  public getConfig(): SecurityConfig {
    return { ...this.config };
  }

  public setConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public isEncryptionEnabled(): boolean {
    return this.config.enableEncryption;
  }

  public isInputSanitizationEnabled(): boolean {
    return this.config.enableInputSanitization;
  }

  public isCheatDetectionEnabled(): boolean {
    return this.config.enableCheatDetection;
  }
}
