export interface ResourceInfo {
  id: string;
  url: string;
  filename: string;
  size: number;
  md5: string;
  type: 'texture' | 'model' | 'audio' | 'data' | 'font';
  version: string;
  required: boolean;
  description?: string;
}

export interface ResourceManifest {
  version: string;
  lastUpdated: string;
  resources: ResourceInfo[];
}

export interface ResourceDownloadStatus {
  resourceId: string;
  status: 'pending' | 'downloading' | 'verifying' | 'completed' | 'failed' | 'corrupted';
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  error?: string;
  downloadSpeed?: number;
  retryCount: number;
  startTime?: number;
  endTime?: number;
}

export interface NetworkQuality {
  type: 'excellent' | 'good' | 'poor' | 'offline';
  latency: number;
  bandwidth: number;
  packetLoss: number;
}

export interface DownloadTestResult {
  scenario: 'normal' | 'slow' | 'interrupted' | 'corrupted';
  success: boolean;
  duration: number;
  speed: number;
  errorCount: number;
  recoveredFromError: boolean;
  dataIntegrity: boolean;
}
