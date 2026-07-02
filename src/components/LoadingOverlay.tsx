import React from 'react';
import { useTranslation } from 'react-i18next';
import { Progress } from './ui/shadcn';

interface LoadingOverlayProps {
  progress: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = React.memo(({ progress }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex w-80 flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/95 p-8 shadow-2xl">
        <div className="text-lg font-semibold text-white">{t('loading.title')}</div>
        <Progress value={progress} className="h-2" />
        <div className="text-sm text-slate-400">{progress}%</div>
      </div>
    </div>
  );
});
