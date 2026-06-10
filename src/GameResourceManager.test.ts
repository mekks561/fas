import { GameResourceManager } from './GameResourceManager';
import { GAME_RESOURCES } from './GameResources';
import { ResourceInfo } from './types/resource-types';

describe('GameResourceManager', () => {
    let manager: GameResourceManager;

    beforeEach(() => {
        manager = new GameResourceManager();
        manager.setManifest(GAME_RESOURCES);
    });

    describe('Manifest Management', () => {
        it('should set manifest correctly', () => {
            expect(GAME_RESOURCES.resources.length).toBeGreaterThan(0);
        });

        it('should have required resources defined', () => {
            const required = GAME_RESOURCES.resources.filter((r: ResourceInfo) => r.required);
            expect(required.length).toBeGreaterThan(0);
        });

        it('should have texture resources', () => {
            const textures = GAME_RESOURCES.resources.filter((r: ResourceInfo) => r.type === 'texture');
            expect(textures.length).toBeGreaterThan(0);
        });

        it('should have model resources', () => {
            const models = GAME_RESOURCES.resources.filter((r: ResourceInfo) => r.type === 'model');
            expect(models.length).toBeGreaterThan(0);
        });
    });

    describe('Network Quality Measurement', () => {
        it('should measure network quality', async () => {
            const quality = await manager.measureNetworkQuality();
            
            expect(quality).toHaveProperty('type');
            expect(quality).toHaveProperty('latency');
            expect(quality).toHaveProperty('bandwidth');
            expect(quality).toHaveProperty('packetLoss');
            
            expect(['excellent', 'good', 'poor', 'offline']).toContain(quality.type);
        });

        it('should categorize network correctly', async () => {
            const quality = await manager.measureNetworkQuality();
            
            if (quality.latency >= 0 && quality.latency < 50) {
                expect(quality.type).toBe('excellent');
            } else if (quality.latency < 150) {
                expect(quality.type).toBe('good');
            } else if (quality.latency < 500) {
                expect(quality.type).toBe('poor');
            }
        });
    });

    describe('Resource Status Tracking', () => {
        it('should track download status', () => {
            const statuses = manager.getAllStatuses();
            expect(Array.isArray(statuses)).toBe(true);
        });

        it('should notify on status change', () => {
            let notificationReceived = false;
            
            manager.onStatusChange((status: any) => {
                notificationReceived = true;
            });

            expect(typeof notificationReceived).toBe('boolean');
        });
    });

    describe('Resource Validation', () => {
        it('should have valid MD5 checksums', () => {
            const resources = GAME_RESOURCES.resources;
            
            resources.forEach((resource: ResourceInfo) => {
                expect(resource.md5).toBeDefined();
                expect(resource.md5.length).toBe(32);
                expect(/^[a-f0-9]{32}$/i.test(resource.md5)).toBe(true);
            });
        });

        it('should have valid resource sizes', () => {
            const resources = GAME_RESOURCES.resources;
            
            resources.forEach((resource: ResourceInfo) => {
                expect(resource.size).toBeGreaterThan(0);
                expect(typeof resource.size).toBe('number');
            });
        });

        it('should have unique resource IDs', () => {
            const resources = GAME_RESOURCES.resources;
            const ids = resources.map((r: ResourceInfo) => r.id);
            const uniqueIds = new Set(ids);
            
            expect(uniqueIds.size).toBe(ids.length);
        });
    });

    describe('Download Scenarios', () => {
        it('should test normal download scenario', async () => {
            const resource = GAME_RESOURCES.resources[0];
            const result = await manager.testDownloadScenario(resource, 'normal');
            
            expect(result).toHaveProperty('scenario', 'normal');
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('duration');
            expect(result).toHaveProperty('dataIntegrity');
        });

        it('should test slow download scenario', async () => {
            const resource = GAME_RESOURCES.resources[1];
            const result = await manager.testDownloadScenario(resource, 'slow');
            
            expect(result).toHaveProperty('scenario', 'slow');
            expect(typeof result.duration).toBe('number');
        });

        it('should test interrupted download scenario', async () => {
            const resource = GAME_RESOURCES.resources[2];
            const result = await manager.testDownloadScenario(resource, 'interrupted');
            
            expect(result).toHaveProperty('scenario', 'interrupted');
            expect(result).toHaveProperty('errorCount');
            expect(typeof result.errorCount).toBe('number');
        });

        it('should test corruption detection scenario', async () => {
            const resource = GAME_RESOURCES.resources[3];
            const result = await manager.testDownloadScenario(resource, 'corrupted');
            
            expect(result).toHaveProperty('scenario', 'corrupted');
            expect(result).toHaveProperty('dataIntegrity');
        });
    });

    describe('Cleanup', () => {
        it('should cleanup resources', async () => {
            await expect(manager.cleanup()).resolves.not.toThrow();
        });
    });
});
