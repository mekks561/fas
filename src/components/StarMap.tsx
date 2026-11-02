import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useTranslation } from 'react-i18next';
import { LucideCompass, LucideTarget, LucideShield, LucideZap, LucideX } from 'lucide-react';
import { SectorManager } from '../engine/SectorManager';
import './StarMap.css';

const StarMap: React.FC = () => {
  const { t } = useTranslation();
  const isVisible = useGameStore((state) => state.isStarMapVisible);
  const setVisible = useGameStore((state) => state.setStarMapVisible);
  const setGamePaused = useGameStore((state) => state.setGamePaused);

  // 2026 Tech: 优先从 Store 获取数据以支持主菜单预览
  const storeGalacticStatus = useGameStore((state) => state.galacticStatus);
  const currentSectorId = storeGalacticStatus.currentSectorId;

  const [nodes, setNodes] = useState<any[]>(storeGalacticStatus.nodes || []);
  const [strategicEvents, setStrategicEvents] = useState<any[]>(storeGalacticStatus.events || []);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom] = useState(1);

  useEffect(() => {
    let interval: any;

    if (isVisible) {
      console.log('[StarMap] Visible, refreshing map...');
      const refreshMap = () => {
        const sectorManager = SectorManager.getInstance();
        setIsEngineReady(sectorManager.isInitialized());

        // 尝试从引擎实例中获取最新的 GalaxyManager 数据
        const engine = (window as any)['gameEngine'];
        const galaxyManager = engine?.getPlugin('GalaxyManager');

        if (galaxyManager) {
          console.log('[StarMap] Found galaxyManager, syncing nodes...');
          const freshNodes = [...galaxyManager.getAllNodes()];
          const freshEvents = [...galaxyManager.getActiveStrategicEvents()];
          const current = galaxyManager.getCurrentSector();

          setNodes(freshNodes);
          setStrategicEvents(freshEvents);

          if (!selectedNode && current) {
            setSelectedNode(current);
            setOffset({ x: -current.coords.x, y: -current.coords.y });
          }
        } else if (storeGalacticStatus.nodes.length > 0) {
          // 2026 Tech: 如果引擎未就绪，使用 Store 中的缓存数据
          if (nodes.length === 0) {
            console.log('[StarMap] Engine not ready, using store nodes...');
            setNodes(storeGalacticStatus.nodes);
            setStrategicEvents(storeGalacticStatus.events);
          }

          if (!selectedNode) {
            console.log('[StarMap] Setting initial selected node from store...');
            const initial = storeGalacticStatus.nodes[0];
            setSelectedNode(initial);
            setOffset({ x: -initial.coords.x, y: -initial.coords.y });
          }
        }
      };

      refreshMap();
      // 2026 Tech: 实时战略刷新 (更短的轮询间隔以提升响应性)
      interval = setInterval(refreshMap, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVisible, selectedNode, storeGalacticStatus, nodes.length]);

  console.log('[StarMap] Rendering StarMap, isVisible:', isVisible);

  if (!isVisible) return null;

  const handleClose = () => {
    setVisible(false);
    setGamePaused(false);
  };

  const handleJump = async (node: any) => {
    const sectorManager = SectorManager.getInstance();

    console.log(`[StarMap] handleJump called for node: ${node.id}`);

    if (!sectorManager.isInitialized()) {
      console.warn('[StarMap] Jump failed: Engine/SectorManager not initialized.');
      // 检查具体哪个环节没过
      const engine = (window as any)['gameEngine'];
      console.log('[StarMap] Diagnostic - Engine exists:', !!engine);
      console.log(
        '[StarMap] Diagnostic - GalaxyManager plugin exists:',
        !!engine?.getPlugin('GalaxyManager'),
      );
      return;
    }

    const isCurrent = node.id === currentSectorId;
    const currentNode = nodes.find((n) => n.id === currentSectorId);
    const isConnected = currentNode?.connections?.includes(node.id);

    console.log(
      `[StarMap] Attempting jump to ${node.id}. isCurrent=${isCurrent}, isConnected=${isConnected}, isDiscovered=${node.isDiscovered}`,
    );

    if (!isCurrent && !node.isDiscovered && !isConnected) {
      console.warn('[StarMap] Cannot jump: Sector is not connected or discovered.');
      return;
    }

    try {
      // 2026 Tech: 执行跃迁逻辑
      handleClose(); // 先关闭星图 UI
      await sectorManager.jumpToSector(node.id);
    } catch (err) {
      console.error('[StarMap] Error during jump sequence:', err);
    }
  };

  const getFactionColor = (factionId: string) => {
    const colors: Record<string, string> = {
      trade_union: '#3b82f6',
      scavengers: '#f59e0b',
      imperial_guard: '#ef4444',
      void_cult: '#a855f7',
      neutral: '#94a3b8',
    };
    return colors[factionId] || colors.neutral;
  };

  return (
    <div className="star-map-overlay">
      <div className="star-map-header">
        <div className="flex items-center gap-2">
          <LucideCompass className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold tracking-widest text-white uppercase">银河拓扑星图</h2>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <LucideX className="w-6 h-6 text-white/50" />
        </button>
      </div>

      <div className="star-map-container" ref={mapRef}>
        <div
          className="star-map-content"
          style={{
            transform: `translate(${offset.x * zoom + 400}px, ${offset.y * zoom + 300}px) scale(${zoom})`,
          }}
        >
          {/* 绘制势力影响力背景 (2026 Tech: Dynamic Borders) */}
          <svg className="star-map-borders">
            <defs>
              {Object.keys(
                nodes.reduce((acc, n) => ({ ...acc, [n.dominantFactionId]: true }), {}),
              ).map((fId) => (
                <radialGradient id={`grad-${fId}`} key={fId}>
                  <stop offset="0%" stopColor={getFactionColor(fId)} stopOpacity="0.2" />
                  <stop offset="70%" stopColor={getFactionColor(fId)} stopOpacity="0.05" />
                  <stop offset="100%" stopColor={getFactionColor(fId)} stopOpacity="0" />
                </radialGradient>
              ))}
            </defs>
            {nodes.map((node) => (
              <circle
                key={`border-${node.id}`}
                cx={node.coords.x}
                cy={node.coords.y}
                r={60}
                fill={`url(#grad-${node.dominantFactionId})`}
                className="faction-influence-aura"
              />
            ))}
          </svg>

          {/* 绘制连接线 */}
          <svg className="star-map-links">
            {nodes.map((node) =>
              node.connections.map((connId: string) => {
                const target = nodes.find((n) => n.id === connId);
                if (!target || node.id > target.id) return null; // 避免重复绘制
                return (
                  <line
                    key={`${node.id}-${target.id}`}
                    x1={node.coords.x}
                    y1={node.coords.y}
                    x2={target.coords.x}
                    y2={target.coords.y}
                    className={`link ${node.isDiscovered && target.isDiscovered ? 'discovered' : ''}`}
                  />
                );
              }),
            )}

            {/* 绘制战略侵略矢量 */}
            {strategicEvents.map((event) => {
              const origin = nodes.find((n) => n.id === event.originSectorId);
              const target = nodes.find((n) => n.id === event.targetSectorId);
              if (!origin || !target) return null;
              return (
                <g key={event.id} className="invasion-vector">
                  <line
                    x1={origin.coords.x}
                    y1={origin.coords.y}
                    x2={target.coords.x}
                    y2={target.coords.y}
                    style={{
                      stroke: getFactionColor(event.factionId),
                      strokeWidth: 3,
                      strokeDasharray: '5,5',
                    }}
                  />
                  <circle
                    cx={origin.coords.x + (target.coords.x - origin.coords.x) * event.progress}
                    cy={origin.coords.y + (target.coords.y - origin.coords.y) * event.progress}
                    r={4}
                    fill={getFactionColor(event.factionId)}
                  >
                    <animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}
          </svg>

          {/* 绘制星区节点 */}
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`star-node ${selectedNode?.id === node.id ? 'active' : ''} ${node.isDiscovered ? 'discovered' : 'hidden-node'}`}
              style={
                {
                  left: `${node.coords.x}px`,
                  top: `${node.coords.y}px`,
                  '--faction-color': getFactionColor(node.dominantFactionId),
                } as any
              }
              onClick={() => setSelectedNode(node)}
            >
              <div className="node-core" />
              <div className="node-label">{node.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 侧边信息面板 */}
      {selectedNode && (
        <div className="star-map-info-panel">
          <div className="p-6">
            <h3 className="text-2xl font-bold text-white mb-1">{selectedNode.name}</h3>
            <p className="text-sm text-white/40 mb-4 uppercase tracking-tighter">
              ID: {selectedNode.id} | 类型: {selectedNode.type}
            </p>

            <div className="space-y-4">
              {/* 战略状态警报 */}
              {strategicEvents.find((e) => e.targetSectorId === selectedNode.id) && (
                <div className="bg-red-500/20 border border-red-500/50 p-3 rounded-lg animate-pulse">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase">
                    <LucideTarget className="w-4 h-4" />
                    战区警报: 入侵进行中
                  </div>
                  <div className="text-[10px] text-red-300/70 mt-1">
                    来自{' '}
                    {
                      nodes.find(
                        (n) =>
                          n.id ===
                          strategicEvents.find((e) => e.targetSectorId === selectedNode.id)
                            .originSectorId,
                      )?.name
                    }{' '}
                    的攻击
                  </div>
                </div>
              )}

              <div className="info-row">
                <LucideShield className="w-4 h-4 text-blue-400" />
                <span>统治势力:</span>
                <span style={{ color: getFactionColor(selectedNode.dominantFactionId) }}>
                  {t(`factions.${selectedNode.dominantFactionId}`)}
                </span>
              </div>

              <div className="info-row">
                <LucideZap className="w-4 h-4 text-yellow-400" />
                <span>威胁等级:</span>
                <span className="text-red-400">Level {selectedNode.difficulty}</span>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <h4 className="text-xs font-bold text-white/50 uppercase mb-3">势力影响力分布</h4>
                {Object.entries(selectedNode.influence).map(
                  ([fId, inf]: [any, any]) =>
                    inf > 0 && (
                      <div key={fId} className="mb-2">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span>{t(`factions.${fId}`)}</span>
                          <span>{Math.round(inf)}%</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-500"
                            style={{ width: `${inf}%`, backgroundColor: getFactionColor(fId) }}
                          />
                        </div>
                      </div>
                    ),
                )}
              </div>

              {(() => {
                const currentNode = nodes.find((n) => n.id === currentSectorId);
                const isConnected = currentNode?.connections?.includes(selectedNode.id);
                const isCurrent = selectedNode.id === currentSectorId;
                const canJump =
                  isEngineReady && (isCurrent || selectedNode.isDiscovered || isConnected);

                return (
                  <button
                    className={`jump-button ${!canJump ? 'disabled' : ''}`}
                    onClick={() => canJump && handleJump(selectedNode)}
                  >
                    {!isEngineReady
                      ? '引擎初始化中...'
                      : isCurrent
                        ? '进入星区'
                        : selectedNode.isDiscovered
                          ? '启动跃迁'
                          : '启动跃迁引擎'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 2026 Tech: 实时战略情报流 (Real-time Intel Feed) */}
      <div className="star-map-intel-feed">
        <div className="flex items-center gap-2 mb-3 border-b border-blue-500/30 pb-2">
          <LucideTarget className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="text-xs font-bold text-blue-100 uppercase tracking-widest">
            战略情报流
          </span>
        </div>
        <div className="space-y-2 overflow-y-auto max-h-[120px] custom-scrollbar">
          {storeGalacticStatus.intelligenceFeed.map((msg, idx) => (
            <div
              key={`${idx}-${msg.substring(0, 10)}`}
              className={`text-[10px] py-1 border-l-2 pl-2 transition-all duration-300 ${
                msg.includes('[TACTICAL]')
                  ? 'border-yellow-500 text-yellow-200 bg-yellow-500/5'
                  : msg.includes('[WARNING]')
                    ? 'border-orange-500 text-orange-200 bg-orange-500/5'
                    : msg.includes('[DANGER]')
                      ? 'border-red-500 text-red-200 bg-red-500/10 animate-pulse'
                      : 'border-blue-500/30 text-blue-200/60'
              }`}
            >
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StarMap;
