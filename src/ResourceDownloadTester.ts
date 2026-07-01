import { GameResourceManager } from './GameResourceManager';
import { GAME_RESOURCES } from './GameResources';
import { DownloadTestResult } from './types/resource-types';

export class ResourceDownloadTester {
    private resourceManager: GameResourceManager;
    private testResults: Map<string, DownloadTestResult[]> = new Map();

    constructor() {
        this.resourceManager = new GameResourceManager();
        this.resourceManager.setManifest(GAME_RESOURCES);
    }

    public async runAllTests(): Promise<void> {
        console.log('='.repeat(50));
        console.log('开始资源下载系统全面测试');
        console.log('='.repeat(50));

        await this.testNormalNetwork();
        await this.testSlowNetwork();
        await this.testInterruptionRecovery();
        await this.testCorruptionDetection();
        await this.testNetworkQualityMeasurement();
        await this.testConcurrentDownloads();
        await this.testCacheSystem();
        
        this.printTestSummary();
    }

    private async testNormalNetwork(): Promise<void> {
        console.log('\n[测试1] 正常网络环境下载测试');
        console.log('-'.repeat(50));

        const resource = GAME_RESOURCES.resources[0];
        
        const result = await this.resourceManager.testDownloadScenario(resource, 'normal');
        
        this.recordTest('normal', result);
        
        console.log(`状态: ${result.success ? '✅ 通过' : '❌ 失败'}`);
        console.log(`耗时: ${result.duration}ms`);
        console.log(`速度: ${result.speed.toFixed(2)} bytes/s`);
        console.log(`数据完整性: ${result.dataIntegrity ? '✅' : '❌'}`);
    }

    private async testSlowNetwork(): Promise<void> {
        console.log('\n[测试2] 弱网络环境下载测试');
        console.log('-'.repeat(50));

        const resource = GAME_RESOURCES.resources[1];
        
        const result = await this.resourceManager.testDownloadScenario(resource, 'slow');
        
        this.recordTest('slow', result);
        
        console.log(`状态: ${result.success ? '✅ 通过' : '❌ 失败'}`);
        console.log(`耗时: ${result.duration}ms`);
        console.log(`速度: ${result.speed.toFixed(2)} bytes/s`);
        console.log(`错误次数: ${result.errorCount}`);
    }

    private async testInterruptionRecovery(): Promise<void> {
        console.log('\n[测试3] 网络中断恢复测试');
        console.log('-'.repeat(50));

        const resource = GAME_RESOURCES.resources[2];
        
        const result = await this.resourceManager.testDownloadScenario(resource, 'interrupted');
        
        this.recordTest('interrupted', result);
        
        console.log(`状态: ${result.success ? '✅ 通过' : '❌ 失败'}`);
        console.log(`从错误中恢复: ${result.recoveredFromError ? '✅ 是' : '❌ 否'}`);
        console.log(`错误次数: ${result.errorCount}`);
        console.log(`最终成功: ${result.dataIntegrity ? '✅ 是' : '❌ 否'}`);
    }

    private async testCorruptionDetection(): Promise<void> {
        console.log('\n[测试4] 资源文件损坏检测测试');
        console.log('-'.repeat(50));

        const resource = GAME_RESOURCES.resources[3];
        
        const result = await this.resourceManager.testDownloadScenario(resource, 'corrupted');
        
        this.recordTest('corrupted', result);
        
        console.log(`状态: ${!result.dataIntegrity ? '✅ 通过' : '❌ 失败'}`);
        console.log(`正确检测到损坏: ${!result.dataIntegrity ? '✅' : '❌'}`);
    }

    private async testNetworkQualityMeasurement(): Promise<void> {
        console.log('\n[测试5] 网络质量测量测试');
        console.log('-'.repeat(50));

        const quality = await this.resourceManager.measureNetworkQuality();
        
        console.log(`网络类型: ${this.getNetworkTypeName(quality.type)}`);
        console.log(`延迟: ${quality.latency}ms`);
        console.log(`带宽估计: ${quality.bandwidth} Mbps`);
        console.log(`丢包率: ${quality.packetLoss}%`);
    }

    private async testConcurrentDownloads(): Promise<void> {
        console.log('\n[测试6] 并发下载测试');
        console.log('-'.repeat(50));

        const testResources = GAME_RESOURCES.resources.slice(0, 3);
        let successCount = 0;
        let totalTime = 0;

        const startTime = Date.now();

        const downloadPromises = testResources.map(async (resource) => {
            const success = await this.resourceManager.downloadResource(resource);
            if (success) successCount++;
            return success;
        });

        const _results = await Promise.all(downloadPromises);

        totalTime = Date.now() - startTime;

        console.log(`总资源数: ${testResources.length}`);
        console.log(`成功数: ${successCount}`);
        console.log(`失败数: ${testResources.length - successCount}`);
        console.log(`总耗时: ${totalTime}ms`);
        console.log(`平均速度: ${(testResources.reduce((sum, r) => sum + r.size, 0) / (totalTime / 1000)).toFixed(2)} bytes/s`);
        console.log(`并发状态: ${successCount === testResources.length ? '✅ 全部成功' : '⚠️ 部分失败'}`);
    }

    private async testCacheSystem(): Promise<void> {
        console.log('\n[测试7] 缓存系统测试');
        console.log('-'.repeat(50));

        const resource = GAME_RESOURCES.resources[0];

        console.log('第一次下载...');
        const firstDownload = await this.resourceManager.downloadResource(resource);
        console.log(`首次下载: ${firstDownload ? '✅ 成功' : '❌ 失败'}`);

        console.log('第二次获取（应从缓存读取）...');
        const cached = await this.resourceManager.getResource(resource.filename);
        console.log(`缓存读取: ${cached ? '✅ 成功' : '❌ 失败'}`);

        const isCached = cached !== null;
        this.recordTest('cache', {
            scenario: 'normal',
            success: firstDownload && isCached,
            duration: 0,
            speed: 0,
            errorCount: 0,
            recoveredFromError: false,
            dataIntegrity: isCached
        });

        console.log(`缓存系统: ${isCached ? '✅ 工作正常' : '❌ 需要检查'}`);
    }

    private recordTest(scenario: string, result: DownloadTestResult): void {
        if (!this.testResults.has(scenario)) {
            this.testResults.set(scenario, []);
        }
        const results = this.testResults.get(scenario);
        if (results) {
            results.push(result);
        }
    }

    private printTestSummary(): void {
        console.log('\n' + '='.repeat(50));
        console.log('测试总结');
        console.log('='.repeat(50));

        let totalTests = 0;
        let passedTests = 0;

        this.testResults.forEach((results, scenario) => {
            const passed = results.filter(r => r.success || r.dataIntegrity).length;
            const total = results.length;
            
            console.log(`\n${scenario}:`);
            console.log(`  通过: ${passed}/${total}`);
            console.log(`  成功率: ${((passed / total) * 100).toFixed(1)}%`);

            totalTests += total;
            passedTests += passed;
        });

        console.log('\n' + '='.repeat(50));
        console.log(`总计: ${passedTests}/${totalTests} 测试通过`);
        console.log(`总体成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        console.log('='.repeat(50));
    }

    private getNetworkTypeName(type: string): string {
        const names: Record<string, string> = {
            'excellent': '优秀',
            'good': '良好',
            'poor': '较差',
            'offline': '离线'
        };
        return names[type] || type;
    }

    public getResourceManager(): GameResourceManager {
        return this.resourceManager;
    }
}

export async function runResourceTests(): Promise<void> {
    const tester = new ResourceDownloadTester();
    await tester.runAllTests();
}
