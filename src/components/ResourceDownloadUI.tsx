import React, { useState, useEffect } from 'react';
import { GameResourceManager } from '../GameResourceManager';
import { GAME_RESOURCES } from '../GameResources';
import { ResourceDownloadStatus, NetworkQuality } from '../types/resource-types';

interface ResourceDownloadUIProps {
    resourceManager: GameResourceManager;
    onAllResourcesReady?: () => void;
}

export const ResourceDownloadUI: React.FC<ResourceDownloadUIProps> = ({
    resourceManager,
    onAllResourcesReady
}) => {
    const [statuses, setStatuses] = useState<ResourceDownloadStatus[]>([]);
    const [networkQuality, setNetworkQuality] = useState<NetworkQuality | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadComplete, setDownloadComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        resourceManager.onStatusChange((status) => {
            setStatuses(prev => {
                const index = prev.findIndex(s => s.resourceId === status.resourceId);
                if (index >= 0) {
                    const newStatuses = [...prev];
                    newStatuses[index] = status;
                    return newStatuses;
                }
                return [...prev, status];
            });
        });

        measureNetworkQuality();
    }, []);

    const measureNetworkQuality = async () => {
        const quality = await resourceManager.measureNetworkQuality();
        setNetworkQuality(quality);
    };

    const startDownload = async () => {
        setIsDownloading(true);
        setError(null);

        try {
            const result = await resourceManager.downloadAllResources();
            
            if (result.failed > 0) {
                setError(`下载完成，但有 ${result.failed} 个资源下载失败`);
            }
            
            setDownloadComplete(true);
            
            if (result.failed === 0 && onAllResourcesReady) {
                onAllResourcesReady();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '下载过程中发生错误');
        } finally {
            setIsDownloading(false);
        }
    };

    const getStatusColor = (status: ResourceDownloadStatus): string => {
        switch (status.status) {
            case 'completed': return 'text-green-500';
            case 'downloading': return 'text-blue-500';
            case 'verifying': return 'text-yellow-500';
            case 'failed': return 'text-red-500';
            case 'corrupted': return 'text-red-600';
            default: return 'text-gray-500';
        }
    };

    const getStatusIcon = (status: ResourceDownloadStatus): string => {
        switch (status.status) {
            case 'completed': return '✓';
            case 'downloading': return '↓';
            case 'verifying': return '⟳';
            case 'failed': return '✗';
            case 'corrupted': return '⚠';
            default: return '○';
        }
    };

    const completedCount = statuses.filter(s => s.status === 'completed').length;
    const totalCount = GAME_RESOURCES.resources.filter(r => r.required).length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
        <div className="resource-download-ui">
            <div className="bg-gray-800 text-white p-6 rounded-lg shadow-xl max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold mb-4">🎮 资源下载系统</h2>

                {/* 网络质量显示 */}
                {networkQuality && (
                    <div className="mb-4 p-3 bg-gray-700 rounded">
                        <div className="flex justify-between items-center">
                            <span>网络状态:</span>
                            <span className={`font-bold ${
                                networkQuality.type === 'excellent' ? 'text-green-400' :
                                networkQuality.type === 'good' ? 'text-blue-400' :
                                networkQuality.type === 'poor' ? 'text-yellow-400' :
                                'text-red-400'
                            }`}>
                                {networkQuality.type === 'excellent' ? '🌐 优秀' :
                                 networkQuality.type === 'good' ? '🌐 良好' :
                                 networkQuality.type === 'poor' ? '🌐 较差' :
                                 '❌ 离线'}
                            </span>
                        </div>
                        <div className="text-sm text-gray-300 mt-1">
                            延迟: {networkQuality.latency}ms | 
                            带宽: {networkQuality.bandwidth} Mbps
                        </div>
                    </div>
                )}

                {/* 下载进度条 */}
                <div className="mb-4">
                    <div className="flex justify-between mb-2">
                        <span>下载进度:</span>
                        <span>{completedCount}/{totalCount}</span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-3">
                        <div 
                            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* 资源列表 */}
                <div className="max-h-96 overflow-y-auto mb-4">
                    {GAME_RESOURCES.resources.filter(r => r.required).map(resource => {
                        const status = statuses.find(s => s.resourceId === resource.id);
                        return (
                            <div key={resource.id} className="p-3 bg-gray-700 rounded mb-2">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="font-medium">{resource.description}</span>
                                        <span className="text-gray-400 text-sm ml-2">
                                            ({resource.type})
                                        </span>
                                    </div>
                                    <span className={getStatusColor(status || { status: 'pending', resourceId: resource.id, progress: 0, bytesDownloaded: 0, totalBytes: 0, retryCount: 0 })}>
                                        {getStatusIcon(status || { status: 'pending', resourceId: resource.id, progress: 0, bytesDownloaded: 0, totalBytes: 0, retryCount: 0 })}
                                    </span>
                                </div>
                                
                                {status?.status === 'downloading' && (
                                    <div className="mt-2">
                                        <div className="w-full bg-gray-600 rounded-full h-2">
                                            <div 
                                                className="bg-blue-500 h-2 rounded-full"
                                                style={{ width: `${status.progress}%` }}
                                            />
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            {status.bytesDownloaded} / {status.totalBytes} bytes
                                            {status.retryCount > 0 && ` (重试 ${status.retryCount}次)`}
                                        </div>
                                    </div>
                                )}

                                {status?.error && (
                                    <div className="text-red-400 text-sm mt-1">
                                        错误: {status.error}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 错误显示 */}
                {error && (
                    <div className="mb-4 p-3 bg-red-900 rounded text-red-300">
                        {error}
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-4">
                    <button
                        onClick={startDownload}
                        disabled={isDownloading || downloadComplete}
                        className={`flex-1 py-3 px-6 rounded font-bold transition ${
                            isDownloading 
                                ? 'bg-gray-600 cursor-not-allowed' 
                                : downloadComplete 
                                    ? 'bg-green-600' 
                                    : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {isDownloading ? '下载中...' : 
                         downloadComplete ? '✅ 下载完成' : 
                         '▶ 开始下载'}
                    </button>

                    <button
                        onClick={measureNetworkQuality}
                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded font-bold"
                    >
                        🔄 检测网络
                    </button>
                </div>
            </div>
        </div>
    );
};
