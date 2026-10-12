import React, { useCallback, useMemo, useState } from 'react';
import { Button } from './ui/shadcn';
import { globalAudio } from '../engine/GlobalAudio';
import {
  HULL_DEFS,
  HULL_ORDER,
  getUnlockLevel,
  getUnlockSnapshot,
  hullUnlockId,
  type HullId,
} from '../engine/UnlockRegistry';
import { DEFAULT_HULL_ID, getSelectedHull, setSelectedHull } from '../engine/SelectedHull';

interface HangarPanelProps {
  onBack: () => void;
}

/**
 * 机库：选择出厂舰体。
 *
 * 这是 `rewards.unlocks` 里 6 条 `ship-*` 的**唯一落地出口**。
 * 接线前 `PlayerShip.config.shipModel` 全仓零调用方，玩家永远开同一艘船，
 * 「通关第 5 关解锁重型巡洋舰」纯粹是一句日志。
 *
 * 边界要说清楚：**舰体只改外观，不改属性**。属性那条链路在商店
 * （`shop-item-01/02/03` 各带一套加成 → `OwnedItems` → `MetaBonuses` → 每局开局合并），
 * 已经通了。若这里再挂一套属性，同一个名字（巡洋舰 / 隐形战机 / 无畏舰）
 * 就会有两个来源，界面必然会开始自相矛盾。
 *
 * 可用性判定与 `SkillSystem` 的技能门控同源：都读 `getUnlockSnapshot()`。
 */
export const HangarPanel: React.FC<HangarPanelProps> = ({ onBack }) => {
  /**
   * 面板内只读一次快照。解锁进度在别处（关卡结算）变化，而通关会让 GameScene 卸载、
   * 玩家必然经过主菜单，所以这里不需要订阅式刷新。
   */
  const snapshot = useMemo(() => getUnlockSnapshot(), []);
  const granted = snapshot.granted;

  const [selected, setSelected] = useState<HullId>(() => getSelectedHull(granted));

  const handleSelect = useCallback(
    (hull: HullId) => {
      const effective = setSelectedHull(hull, granted);
      setSelected(effective);
      globalAudio.playCue(effective === hull ? 'uiClick' : 'uiSelect');
    },
    [granted],
  );

  const unlockedCount = snapshot.hulls.length;

  return (
    <div
      className="min-h-screen flex flex-col items-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-4 md:p-8"
      data-testid="hangar-panel"
    >
      <div className="w-full max-w-5xl">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <Button variant="outline" onClick={onBack} data-testid="hangar-back">
            ← 返回
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            机库
          </h1>
          <div className="text-sm text-slate-400 whitespace-nowrap" data-testid="hangar-progress">
            已解锁 <span className="text-cyan-300 font-bold">{unlockedCount}</span> /{' '}
            {HULL_ORDER.length}
          </div>
        </div>

        {/* 口径说明 —— 免得玩家以为换船能改属性 */}
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          出厂舰体决定你的<strong className="text-slate-400">外观</strong>
          ；属性加成来自商店购买的舰船与模块，
          买完自动带入下一局。舰体通过通关解锁，也在商店买下同名舰船时一并获得。
        </p>

        {/* 舰体卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HULL_ORDER.map((hull) => {
            const def = HULL_DEFS[hull];
            const unlockId = hullUnlockId(hull);
            const available = granted.has(unlockId);
            const isSelected = selected === hull;
            const unlockLevel = getUnlockLevel(unlockId);

            return (
              <div
                key={hull}
                data-testid={`hangar-hull-${hull}`}
                data-hull-id={hull}
                data-available={available ? 'true' : 'false'}
                data-selected={isSelected ? 'true' : 'false'}
                className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-500/10 ring-1 ring-cyan-400/40'
                    : available
                      ? 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
                      : 'border-slate-800 bg-slate-900/30 border-dashed'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-base font-bold ${
                      available ? 'text-slate-100' : 'text-slate-600'
                    }`}
                  >
                    {def.name}
                  </span>
                  {def.starter && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 whitespace-nowrap">
                      初始
                    </span>
                  )}
                </div>

                <p
                  className={`text-xs leading-relaxed flex-1 ${
                    available ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {available ? def.description : '尚未解锁。'}
                </p>

                {/* 解锁 id 小字：机库与 UnlockRegistry 的对应关系是排障关键，
                    把 id 摆在卡片上，验证脚本与控制台对不上时一眼能看到是哪一条。 */}
                <code className="text-[10px] text-slate-600 font-mono truncate">{unlockId}</code>

                <div className="flex items-center justify-between gap-2">
                  {available ? (
                    <Button
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className="w-full"
                      data-testid={`hangar-select-${hull}`}
                      disabled={isSelected}
                      onClick={() => handleSelect(hull)}
                    >
                      {isSelected ? '当前舰体 ✓' : '选择'}
                    </Button>
                  ) : (
                    <span
                      className="text-xs text-slate-500 w-full text-center py-1.5 rounded-md bg-slate-800/60"
                      data-testid={`hangar-locked-${hull}`}
                    >
                      🔒 通关第 {unlockLevel} 关解锁
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 待解锁清单：把「还差什么」一次说全，免得玩家逐个猜 */}
        {snapshot.pending.length > 0 && (
          <div className="mt-8" data-testid="hangar-pending">
            <h2 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">
              尚未解锁
            </h2>
            <div className="flex flex-wrap gap-2">
              {snapshot.pending.map((p) => (
                <span
                  key={p.id}
                  data-testid="hangar-pending-item"
                  className="text-xs px-3 py-1 rounded-full bg-slate-800/70 text-slate-400 border border-slate-700"
                >
                  {p.kind === 'hull' ? '🚀' : '⚡'} {p.name}
                  <span className="text-slate-600"> · 第 {p.level} 关</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-8 text-[11px] text-slate-600">
          当前舰体：<code className="font-mono text-slate-500">{selected}</code>
          {selected === DEFAULT_HULL_ID && '（初始舰体）'}
        </p>
      </div>
    </div>
  );
};
