import React from 'react';

interface PauseOverlayProps {
  onResume: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = React.memo(({ onResume }) => (
  <div className="pause-overlay">
    <div className="pause-container">
      <div className="pause-title">游戏暂停</div>
      <button 
        className="resume-button" 
        onClick={onResume}
      >
        继续游戏
      </button>
    </div>
  </div>
));
