import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Swords, Trophy, Users2, Zap, Play, RefreshCw } from 'lucide-react';
import { MultiplayerClient, GameMode, RoomPlayer } from '../engine/MultiplayerClient';
import './MultiplayerPanel.css';

interface MultiplayerPanelProps {
  onBack: () => void;
  onStartMultiplayerGame: (roomId: string) => void;
}

type PanelState = 'menu' | 'matchmaking' | 'room' | 'countdown';

const gameModes: { id: GameMode; name: string; description: string; icon: React.ReactNode }[] = [
  { id: 'deathmatch', name: '死亡竞赛', description: '1v1 对战模式，击败对手获胜', icon: <Swords size={32} /> },
  { id: 'team_deathmatch', name: '团队竞技', description: '2v2 团队对战，合作取胜', icon: <Users2 size={32} /> },
  { id: 'coop', name: '合作模式', description: '组队共同对抗敌人波次', icon: <Users size={32} /> },
];

export const MultiplayerPanel: React.FC<MultiplayerPanelProps> = React.memo(({ onBack, onStartMultiplayerGame }) => {
  const [panelState, setPanelState] = useState<PanelState>('menu');
  const [selectedMode, setSelectedMode] = useState<GameMode>('deathmatch');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [matchmakingPosition, setMatchmakingPosition] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const client = useMemo(() => {
    return new MultiplayerClient(process.env['NODE_ENV'] === 'production' ? '' : 'http://localhost:3001');
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      await client.connect();
      setIsConnecting(false);
    } catch {
      setIsConnecting(false);
      setConnectionError('无法连接到服务器，请稍后重试');
    }
  }, [client]);

  const handleStartMatchmaking = useCallback(async () => {
    if (!client.isConnectedValue) {
      await handleConnect();
      if (!client.isConnectedValue) return;
    }

    setIsMatching(true);
    setPanelState('matchmaking');

    client.on('matchmaking:queued', (data: { gameMode: string; position: number }) => {
      setMatchmakingPosition(data.position);
    });

    client.on('matchmaking:matched', (data: { roomId: string; roomName: string; players: Array<{ userId: string; username: string; avatar: string }> }) => {
      setCurrentRoomId(data.roomId);
      setRoomName(data.roomName);
      setPlayers(data.players.map((p: { userId: string; username: string; avatar: string }, i: number) => ({ ...p, socketId: p.userId || `player_${i}`, ready: false, score: 0, kills: 0, wave: 1 })));
      setIsMatching(false);
      setIsReady(false);
      setPanelState('room');
    });

    await client.joinMatchmaking(selectedMode, {
      userId: localStorage.getItem('userId') || 'guest',
      username: localStorage.getItem('username') || 'Player',
      avatar: '👤',
    });
  }, [selectedMode, client, handleConnect]);

  const handleCancelMatchmaking = useCallback(async () => {
    if (client.currentGameMode) {
      await client.leaveMatchmaking(client.currentGameMode);
    }
    setIsMatching(false);
    setMatchmakingPosition(0);
    setPanelState('menu');
  }, [client]);

  const handleToggleReady = useCallback(async () => {
    const newReady = !isReady;
    setIsReady(newReady);
    await client.setReady(newReady);
  }, [isReady, client]);

  const handleLeaveRoom = useCallback(async () => {
    await client.leaveRoom();
    setCurrentRoomId(null);
    setRoomName('');
    setPlayers([]);
    setIsReady(false);
    setPanelState('menu');
  }, [client]);

  useEffect(() => {
    if (panelState === 'room') {
      const unsub1 = client.on('room:player_joined', (player: RoomPlayer) => {
        setPlayers((prev) => [...prev, player]);
      });

      const unsub2 = client.on('room:player_left', (data: { socketId: string; userId: string }) => {
        setPlayers((prev) => prev.filter((p) => p.socketId !== data.socketId));
      });

      const unsub3 = client.on('room:player_ready', (data: { socketId: string; ready: boolean }) => {
        setPlayers((prev) =>
          prev.map((p) => (p.socketId === data.socketId ? { ...p, ready: data.ready } : p)),
        );
      });

      const unsub4 = client.on('room:starting', (data: { countdown: number }) => {
        setCountdown(data.countdown);
        setPanelState('countdown');
      });

      const unsub5 = client.on('room:countdown', (count: number) => {
        setCountdown(count);
      });

      const unsub6 = client.on('room:started', () => {
        if (currentRoomId) {
          onStartMultiplayerGame(currentRoomId);
        }
      });

      return () => {
        unsub1();
        unsub2();
        unsub3();
        unsub4();
        unsub5();
        unsub6();
      };
    }
  }, [panelState, client, currentRoomId, onStartMultiplayerGame]);

  useEffect(() => {
    return () => {
      client.disconnect();
    };
  }, [client]);

  const renderMenu = () => (
    <div className="multiplayer-panel">
      <div className="multiplayer-header">
        <button className="multiplayer-back-btn" onClick={onBack}>← 返回</button>
        <h1 className="multiplayer-title">多人游戏</h1>
        <div className={`connection-status ${client.isConnectedValue ? 'connected' : 'disconnected'}`}>
          <Zap size={14} />
          {client.isConnectedValue ? '已连接' : '未连接'}
        </div>
      </div>

      {connectionError && (
        <div className="multiplayer-error">{connectionError}</div>
      )}

      <div className="multiplayer-stats">
        <div className="stat-card">
          <Users className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">在线</span>
            <span className="stat-label">实时玩家</span>
          </div>
        </div>
        <div className="stat-card">
          <Trophy className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">进行中</span>
            <span className="stat-label">游戏房间</span>
          </div>
        </div>
      </div>

      <div className="multiplayer-modes">
        <h2 className="multiplayer-section-title">选择游戏模式</h2>
        {gameModes.map((mode) => (
          <button
            key={mode.id}
            className={`mode-card ${selectedMode === mode.id ? 'selected' : ''}`}
            onClick={() => setSelectedMode(mode.id)}
          >
            <div className="mode-icon">{mode.icon}</div>
            <div className="mode-info">
              <div className="mode-name">{mode.name}</div>
              <div className="mode-description">{mode.description}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="multiplayer-actions">
        {!client.isConnectedValue ? (
          <button className="multiplayer-action-btn" onClick={handleConnect} disabled={isConnecting}>
            <RefreshCw size={18} />
            {isConnecting ? '连接中...' : '连接服务器'}
          </button>
        ) : (
          <button className="multiplayer-action-btn primary" onClick={handleStartMatchmaking} disabled={isMatching}>
            <Play size={18} />
            {isMatching ? '匹配中...' : '开始匹配'}
          </button>
        )}
      </div>
    </div>
  );

  const renderMatchmaking = () => (
    <div className="multiplayer-panel">
      <div className="multiplayer-header">
        <button className="multiplayer-back-btn" onClick={handleCancelMatchmaking}>← 取消</button>
        <h1 className="multiplayer-title">匹配中...</h1>
        <div />
      </div>

      <div className="matchmaking-container">
        <div className="matchmaking-icon">
          <Users size={64} />
        </div>
        <div className="matchmaking-text">正在寻找对手</div>
        <div className="matchmaking-position">队列位置: {matchmakingPosition}</div>

        <div className="matchmaking-game-mode">
          <span className="mode-badge">{gameModes.find((m) => m.id === selectedMode)?.name}</span>
        </div>

        <div className="matchmaking-dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>

        <button className="matchmaking-cancel-btn" onClick={handleCancelMatchmaking}>
          取消匹配
        </button>
      </div>
    </div>
  );

  const renderRoom = () => (
    <div className="multiplayer-panel">
      <div className="multiplayer-header">
        <button className="multiplayer-back-btn" onClick={handleLeaveRoom}>← 离开</button>
        <h1 className="multiplayer-title">{roomName}</h1>
        <div className="room-status">等待中</div>
      </div>

      <div className="room-container">
        <div className="room-info">
          <span className="room-mode">{gameModes.find((m) => m.id === selectedMode)?.name}</span>
          <span className="room-players">{players.length}/{2}</span>
        </div>

        <div className="room-players">
          <h3 className="room-section-title">玩家列表</h3>
          {players.map((player) => (
            <div key={player.socketId} className="room-player">
              <div className="player-avatar">{player.avatar}</div>
              <div className="player-info">
                <div className="player-name">{player.username}</div>
                <div className={`player-status ${player.ready ? 'ready' : 'not-ready'}`}>
                  {player.ready ? '✓ 已准备' : '等待中'}
                </div>
              </div>
              <div className={`player-ready-badge ${player.ready ? 'active' : ''}`}>
                {player.ready ? '✓' : '○'}
              </div>
            </div>
          ))}
        </div>

        <div className="room-actions">
          <button className={`room-action-btn ${isReady ? 'ready' : ''}`} onClick={handleToggleReady}>
            {isReady ? '取消准备' : '准备'}
          </button>
        </div>

        <div className="room-tips">
          <span>当所有玩家准备后游戏自动开始</span>
        </div>
      </div>
    </div>
  );

  const renderCountdown = () => (
    <div className="multiplayer-panel">
      <div className="countdown-container">
        <div className="countdown-text">游戏即将开始</div>
        <div className="countdown-number">{countdown}</div>
        <div className="countdown-dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      </div>
    </div>
  );

  switch (panelState) {
    case 'menu':
      return renderMenu();
    case 'matchmaking':
      return renderMatchmaking();
    case 'room':
      return renderRoom();
    case 'countdown':
      return renderCountdown();
    default:
      return renderMenu();
  }
});
