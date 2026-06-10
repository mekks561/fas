import React, { useState } from 'react';
import { GameScene } from './GameScene';
import './App.css';

export const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);

  const handleStartGame = () => {
    setGameStarted(true);
  };

  return (
    <div className="app-container">
      {!gameStarted ? (
        <div className="menu-container">
          <h1 className="game-title">3D战斗机游戏</h1>
          <button className="start-button" onClick={handleStartGame}>
            开始游戏
          </button>
          <div className="instructions">
            <h3>游戏说明：</h3>
            <p>使用 WASD 键控制飞机移动</p>
            <p>使用鼠标控制方向</p>
            <p>按空格键发射子弹</p>
            <p>按 Shift 键使用加速</p>
          </div>
        </div>
      ) : (
        <GameScene />
      )}
    </div>
  );
};
