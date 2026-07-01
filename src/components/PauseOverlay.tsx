import React from 'react';
import { Button } from './ui/shadcn';

interface PauseOverlayProps {
  onResume: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = React.memo(({ onResume }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/95 p-8 shadow-2xl">
      <div className="text-xl font-bold text-white">游戏暂停</div>
      <Button variant="default" size="lg" onClick={onResume}>
        继续游戏
      </Button>
    </div>
  </div>
));
