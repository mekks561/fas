import React, { useEffect, useState } from 'react';
import { AssetLoadingProgress } from '../AssetPreloader';

interface ResourceDownloadUIProps {
    progress: AssetLoadingProgress;
    onComplete?: () => void;
    onRetry?: () => void;
    autoHideDelay?: number;
}

export const ResourceDownloadUI: React.FC<ResourceDownloadUIProps> = ({
    progress,
    onComplete,
    onRetry,
    autoHideDelay = 2000
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        if (progress.progress >= 100 && progress.errors.length === 0) {
            const timer = setTimeout(() => {
                setFadeOut(true);
                setTimeout(() => {
                    setIsVisible(false);
                    onComplete?.();
                }, autoHideDelay);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [progress.progress, progress.errors.length, autoHideDelay, onComplete]);

    if (!isVisible) return null;

    const getProgressColor = (): string => {
        if (progress.errors.length > 0) return 'bg-red-500';
        if (progress.progress < 30) return 'bg-blue-500';
        if (progress.progress < 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className={`fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
            <div className="max-w-lg w-full mx-4">
                {/* 主加载框 */}
                <div className="bg-gray-900/90 rounded-lg border border-gray-700 shadow-2xl overflow-hidden">
                    {/* 标题栏 */}
                    <div className="bg-gradient-to-r from-blue-900 to-purple-900 px-6 py-4 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <span className="text-2xl">🚀</span>
                            <span>资源加载中...</span>
                        </h2>
                    </div>

                    {/* 内容区 */}
                    <div className="p-6 space-y-6">
                        {/* 进度条 */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-300">
                                    {progress.currentAsset || '准备中...'}
                                </span>
                                <span className="text-white font-mono">
                                    {progress.progress.toFixed(0)}%
                                </span>
                            </div>
                            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${getProgressColor()}`}
                                    style={{ width: `${progress.progress}%` }}
                                />
                            </div>
                        </div>

                        {/* 统计信息 */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-gray-800/50 rounded-lg p-3">
                                <div className="text-2xl font-bold text-blue-400">
                                    {progress.loadedAssets}
                                </div>
                                <div className="text-xs text-gray-400">已加载</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-lg p-3">
                                <div className="text-2xl font-bold text-gray-400">
                                    {progress.totalAssets - progress.loadedAssets}
                                </div>
                                <div className="text-xs text-gray-400">剩余</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-lg p-3">
                                <div className="text-2xl font-bold text-red-400">
                                    {progress.errors.length}
                                </div>
                                <div className="text-xs text-gray-400">错误</div>
                            </div>
                        </div>

                        {/* 加载类型指示器 */}
                        <div className="flex items-center justify-center gap-2 text-gray-400">
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                                <span className="text-xs">纹理</span>
                            </div>
                            <div className="w-px h-4 bg-gray-600"></div>
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                                <span className="text-xs">模型</span>
                            </div>
                            <div className="w-px h-4 bg-gray-600"></div>
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                                <span className="text-xs">音频</span>
                            </div>
                        </div>

                        {/* 错误列表 */}
                        {progress.errors.length > 0 && (
                            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 space-y-2">
                                <h3 className="text-red-400 font-semibold flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>加载失败</span>
                                </h3>
                                <ul className="text-sm text-red-300 max-h-32 overflow-y-auto space-y-1">
                                    {progress.errors.map((error, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                            <span className="text-red-500">•</span>
                                            <span>{error}</span>
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={onRetry}
                                    className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors"
                                >
                                    重试
                                </button>
                            </div>
                        )}

                        {/* 提示信息 */}
                        <div className="text-center text-xs text-gray-500">
                            <p>首次加载可能需要一些时间</p>
                            <p>请保持网络连接稳定</p>
                        </div>
                    </div>

                    {/* 底部装饰 */}
                    <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                </div>

                {/* 背景动画 */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-1 h-1 bg-white rounded-full opacity-20"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animation: `twinkle ${2 + Math.random() * 2}s ease-in-out infinite`,
                                animationDelay: `${Math.random() * 2}s`
                            }}
                        />
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes twinkle {
                    0%, 100% { opacity: 0.2; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.5); }
                }
            `}</style>
        </div>
    );
};

export default ResourceDownloadUI;
