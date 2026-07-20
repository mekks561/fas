import React, { useState } from 'react';
import { X, Share2, MessageCircle, AtSign, Copy, Image, CheckCircle } from 'lucide-react';
import { ShareService, SharePlatform, ShareOptions, ShareResult } from '../engine/ShareService';
import './ShareModal.css';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareOptions: ShareOptions;
  service: ShareService;
}

const platformIcons: Record<SharePlatform, React.ReactNode> = {
  wechat: <MessageCircle size={24} />,
  weibo: <AtSign size={24} />,
  qq: <MessageCircle size={24} />,
  link: <Copy size={24} />,
  image: <Image size={24} />,
};

export const ShareModal: React.FC<ShareModalProps> = React.memo(({ isOpen, onClose, shareOptions, service }) => {
  const [sharing, setSharing] = useState<SharePlatform | null>(null);
  const [result, setResult] = useState<ShareResult | null>(null);

  const handleShare = async (platform: SharePlatform) => {
    setSharing(platform);
    setResult(null);
    
    try {
      const res = await service.share(shareOptions, platform);
      setResult(res);
    } finally {
      setSharing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <div className="share-modal-icon">
            <Share2 size={24} />
          </div>
          <h2 className="share-modal-title">分享成就</h2>
          <button className="share-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="share-modal-preview">
          <div className="preview-title">{shareOptions.title}</div>
          <div className="preview-text">{shareOptions.text}</div>
        </div>

        {result && (
          <div className={`share-modal-result ${result.success ? 'success' : 'error'}`}>
            <CheckCircle size={18} />
            <span>{result.message || (result.success ? '分享成功' : '分享失败')}</span>
          </div>
        )}

        <div className="share-modal-platforms">
          {service.getAvailablePlatforms().map((platform) => (
            <button
              key={platform}
              className={`share-platform-btn ${sharing === platform ? 'loading' : ''}`}
              onClick={() => handleShare(platform)}
              disabled={sharing !== null}
            >
              <span className="platform-icon">{platformIcons[platform]}</span>
              <span className="platform-label">{service.getPlatformLabel(platform)}</span>
              {sharing === platform && (
                <span className="platform-loader">分享中...</span>
              )}
            </button>
          ))}
        </div>

        <button className="share-modal-cancel" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  );
});
