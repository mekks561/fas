import React from 'react';

interface LoadingOverlayProps {
  progress: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = React.memo(({ progress }) => (
  <div className="loading-overlay">
    <div className="loading-container">
      <div className="loading-text">加载中...</div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="loading-percentage">{progress}%</div>
    </div>
  </div>
));
