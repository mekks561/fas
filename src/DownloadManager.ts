export interface DownloadProgress {
    url: string;
    progress: number;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    bytesLoaded: number;
    bytesTotal: number;
    error?: string;
}

export interface DownloadOptions {
    timeout?: number;
    retries?: number;
    cache?: boolean;
    headers?: Record<string, string>;
}

export class DownloadManager {
    private downloads: Map<string, DownloadProgress> = new Map();
    private activeDownloads: Set<string> = new Set();
    private maxConcurrentDownloads: number = 5;
    private downloadQueue: Array<{ url: string; options: DownloadOptions; callback: (data: ArrayBuffer) => void; errorCallback: (error: Error) => void }> = [];
    private cache: Map<string, ArrayBuffer> = new Map();

    constructor(maxConcurrentDownloads: number = 5) {
        this.maxConcurrentDownloads = maxConcurrentDownloads;
    }

    public async download(
        url: string,
        options: DownloadOptions = {}
    ): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const defaultOptions: DownloadOptions = {
                timeout: 30000,
                retries: 3,
                cache: true,
                headers: {}
            };

            const mergedOptions = { ...defaultOptions, ...options };

            if (mergedOptions.cache && this.cache.has(url)) {
                resolve(this.cache.get(url)!);
                return;
            }

            if (this.activeDownloads.size >= this.maxConcurrentDownloads) {
                this.downloadQueue.push({
                    url,
                    options: mergedOptions,
                    callback: resolve,
                    errorCallback: reject
                });
                return;
            }

            this.startDownload(url, mergedOptions, resolve, reject);
        });
    }

    private async startDownload(
        url: string,
        options: DownloadOptions,
        resolve: (data: ArrayBuffer) => void,
        reject: (error: Error) => void
    ): Promise<void> {
        this.activeDownloads.add(url);
        this.downloads.set(url, {
            url,
            progress: 0,
            status: 'downloading',
            bytesLoaded: 0,
            bytesTotal: 0
        });

        let attempts = 0;
        const maxAttempts = options.retries || 3;

        const attemptDownload = async (): Promise<void> => {
            attempts++;

            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => {
                    controller.abort();
                }, options.timeout || 30000);

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: options.headers
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const contentLength = response.headers.get('content-length');
                const bytesTotal = contentLength ? parseInt(contentLength, 10) : 0;

                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error('No response body');
                }

                const chunks: Uint8Array[] = [];
                let bytesLoaded = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) break;
                    if (value) {
                        chunks.push(value);
                        bytesLoaded += value.length;
                        
                        const progress = bytesTotal > 0 ? (bytesLoaded / bytesTotal) * 100 : 0;
                        this.downloads.set(url, {
                            url,
                            progress,
                            status: 'downloading',
                            bytesLoaded,
                            bytesTotal
                        });
                    }
                }

                const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                const result = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    result.set(chunk, offset);
                    offset += chunk.length;
                }

                const arrayBuffer = result.buffer;

                if (options.cache) {
                    this.cache.set(url, arrayBuffer);
                }

                this.downloads.set(url, {
                    url,
                    progress: 100,
                    status: 'completed',
                    bytesLoaded: totalLength,
                    bytesTotal: totalLength
                });

                this.activeDownloads.delete(url);

                resolve(arrayBuffer);

                this.processNextDownload();
            } catch (error) {
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                    await attemptDownload();
                } else {
                    this.downloads.set(url, {
                        url,
                        progress: 0,
                        status: 'failed',
                        bytesLoaded: 0,
                        bytesTotal: 0,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    this.activeDownloads.delete(url);
                    reject(error instanceof Error ? error : new Error('Unknown error'));
                    this.processNextDownload();
                }
            }
        };

        await attemptDownload();
    }

    private processNextDownload(): void {
        if (this.downloadQueue.length > 0 && this.activeDownloads.size < this.maxConcurrentDownloads) {
            const next = this.downloadQueue.shift();
            if (next) {
                this.startDownload(next.url, next.options, next.callback, next.errorCallback);
            }
        }
    }

    public getDownloadProgress(url: string): DownloadProgress | undefined {
        return this.downloads.get(url);
    }

    public getAllDownloadProgresses(): DownloadProgress[] {
        return Array.from(this.downloads.values());
    }

    public cancelDownload(url: string): void {
        this.activeDownloads.delete(url);
        const index = this.downloadQueue.findIndex(item => item.url === url);
        if (index !== -1) {
            this.downloadQueue.splice(index, 1);
        }
    }

    public clearCache(): void {
        this.cache.clear();
    }
}