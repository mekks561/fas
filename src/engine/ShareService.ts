export interface ShareOptions {
  title: string;
  text: string;
  url?: string;
  image?: string;
}

export type SharePlatform = 'wechat' | 'weibo' | 'qq' | 'link' | 'image';

export interface ShareResult {
  success: boolean;
  platform: SharePlatform;
  message?: string;
}

export class ShareService {
  private readonly shareUrl: string;

  constructor(baseUrl: string = window.location.origin) {
    this.shareUrl = baseUrl;
  }

  async share(options: ShareOptions, platform: SharePlatform): Promise<ShareResult> {
    try {
      switch (platform) {
        case 'wechat':
          return this.shareToWeChat(options);
        case 'weibo':
          return this.shareToWeibo(options);
        case 'qq':
          return this.shareToQQ(options);
        case 'link':
          return this.copyLink(options);
        case 'image':
          return this.shareAsImage(options);
        default:
          return { success: false, platform, message: '未知平台' };
      }
    } catch (error) {
      return {
        success: false,
        platform,
        message: error instanceof Error ? error.message : '分享失败',
      };
    }
  }

  private async shareToWeChat(options: ShareOptions): Promise<ShareResult> {
    const shareText = `${options.title}\n${options.text}\n${options.url || this.shareUrl}`;
    
    if (navigator.share) {
      await navigator.share({
        title: options.title,
        text: shareText,
        url: options.url || this.shareUrl,
      });
      return { success: true, platform: 'wechat' };
    }

    await this.copyToClipboard(shareText);
    return { success: true, platform: 'wechat', message: '链接已复制，请粘贴到微信分享' };
  }

  private async shareToWeibo(options: ShareOptions): Promise<ShareResult> {
    const params = new URLSearchParams({
      title: options.title,
      url: options.url || this.shareUrl,
      content: 'utf-8',
      source: options.title,
    });
    
    const weiboUrl = `https://service.weibo.com/share/share.php?${params.toString()}`;
    this.openShareWindow(weiboUrl, '微博分享', 600, 500);
    
    return { success: true, platform: 'weibo' };
  }

  private async shareToQQ(options: ShareOptions): Promise<ShareResult> {
    const shareText = `${options.title}\n${options.text}\n${options.url || this.shareUrl}`;
    
    if (navigator.share) {
      await navigator.share({
        title: options.title,
        text: shareText,
        url: options.url || this.shareUrl,
      });
      return { success: true, platform: 'qq' };
    }

    await this.copyToClipboard(shareText);
    return { success: true, platform: 'qq', message: '链接已复制，请粘贴到QQ分享' };
  }

  private async copyLink(options: ShareOptions): Promise<ShareResult> {
    const shareText = `${options.title}\n${options.text}\n${options.url || this.shareUrl}`;
    await this.copyToClipboard(shareText);
    return { success: true, platform: 'link', message: '链接已复制到剪贴板' };
  }

  private async shareAsImage(options: ShareOptions): Promise<ShareResult> {
    if (options.image) {
      const link = document.createElement('a');
      link.href = options.image;
      link.download = `${options.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true, platform: 'image', message: '图片已下载' };
    }

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return { success: false, platform: 'image', message: '无法创建画布' };
    }

    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#4a9eff');
    gradient.addColorStop(1, '#a855f7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, 4);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(options.title, canvas.width / 2, 80);

    ctx.fillStyle = '#b0c0d0';
    ctx.font = '16px Arial';
    const textLines = this.wrapText(ctx, options.text, 500);
    textLines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, 130 + index * 24);
    });

    ctx.fillStyle = '#4a9eff';
    ctx.font = '14px Arial';
    ctx.fillText(options.url || this.shareUrl, canvas.width / 2, canvas.height - 30);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${options.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return { success: true, platform: 'image', message: '分享图片已下载' };
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(`${currentLine} ${word}`).width;
      if (width < maxWidth) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  private async copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  private openShareWindow(url: string, title: string, width: number, height: number): void {
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.open(url, title, `width=${width},height=${height},left=${left},top=${top}`);
  }

  generateAchievementShareText(achievement: {
    name: string;
    description: string;
    icon: string;
    rarity: string;
  }): ShareOptions {
    return {
      title: `我解锁了成就！${achievement.icon} ${achievement.name}`,
      text: `${achievement.description}\n稀有度: ${achievement.rarity}`,
      url: this.shareUrl,
    };
  }

  generateScoreShareText(score: number, wave: number, kills: number): ShareOptions {
    return {
      title: `我的太空战机得分：${score.toLocaleString()}`,
      text: `波次: ${wave} | 击杀: ${kills}`,
      url: this.shareUrl,
    };
  }

  getAvailablePlatforms(): SharePlatform[] {
    return ['wechat', 'weibo', 'qq', 'link', 'image'];
  }

  getPlatformLabel(platform: SharePlatform): string {
    const labels: Record<SharePlatform, string> = {
      wechat: '微信',
      weibo: '微博',
      qq: 'QQ',
      link: '复制链接',
      image: '分享图片',
    };
    return labels[platform];
  }
}
