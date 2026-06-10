import React from 'react';

interface ErrorOverlayProps {
  message: string;
  onRetry: () => void;
}

export const ErrorOverlay: React.FC<ErrorOverlayProps> = React.memo(({ message, onRetry }) => (
  <div className="error-overlay">
    <div className="error-container">
      <div className="error-title">游戏加载失败</div>
      <div className="error-message">{message}</div>
      <button 
        className="restart-button" 
        onClick={onRetry}
      >
        重新开始
      </button>
    </div>
  </div>
));
