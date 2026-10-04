import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceManager, LoadingProgress } from '../engine/ResourceManager';

interface ResourceLoadingProgressProps {
  resourceManager: ResourceManager;
  chunkId?: string;
  onComplete?: () => void;
}

export const ResourceLoadingProgress: React.FC<ResourceLoadingProgressProps> = React.memo(
  ({ resourceManager, chunkId, onComplete }) => {
    const { t } = useTranslation();
    const [progress, setProgress] = useState<LoadingProgress>({
      total: 0,
      loaded: 0,
      failed: 0,
      inProgress: 0,
      percentage: 0,
    });
    const [currentResource, setCurrentResource] = useState<string>('');
    const [status, setStatus] = useState<'loading' | 'complete' | 'error'>('loading');

    useEffect(() => {
      const updateProgress = () => {
        const currentProgress = chunkId
          ? resourceManager.getChunkProgress(chunkId)
          : resourceManager.getProgress();
        setProgress(currentProgress);
        setCurrentResource(currentProgress.currentResource || '');

        if (
          currentProgress.total > 0 &&
          currentProgress.loaded === currentProgress.total &&
          currentProgress.inProgress === 0
        ) {
          setStatus('complete');
          onComplete?.();
        }
      };

      const unsubscribe = resourceManager.onProgress((p) => {
        setProgress(p);
        setCurrentResource(p.currentResource || '');
      });

      updateProgress();

      const interval = setInterval(updateProgress, 100);

      return () => {
        unsubscribe();
        clearInterval(interval);
      };
    }, [resourceManager, chunkId, onComplete]);

    if (status === 'complete') {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="flex w-96 flex-col items-center gap-6 rounded-2xl border border-slate-700 bg-slate-900/95 p-8 shadow-2xl">
          <div className="text-xl font-bold text-white">{t('loading.title')}</div>

          <div className="w-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{t('loading.progress')}</span>
              <span className="text-sm font-medium text-white">
                {Math.round(progress.percentage)}%
              </span>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">{progress.loaded}</div>
                <div className="text-xs text-slate-500">{t('loading.loaded')}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-yellow-400">{progress.inProgress}</div>
                <div className="text-xs text-slate-500">{t('loading.inProgress')}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-400">{progress.failed}</div>
                <div className="text-xs text-slate-500">{t('loading.failed')}</div>
              </div>
            </div>
          </div>

          {currentResource && (
            <div className="w-full overflow-hidden rounded-lg bg-slate-800/50 px-4 py-2">
              <div className="text-xs text-slate-500">{t('loading.currentResource')}</div>
              <div className="truncate text-sm text-white">{currentResource}</div>
            </div>
          )}

          {chunkId && (
            <div className="text-xs text-slate-500">
              {t('loading.chunk')}: {chunkId}
            </div>
          )}
        </div>
      </div>
    );
  },
);

export default ResourceLoadingProgress;
