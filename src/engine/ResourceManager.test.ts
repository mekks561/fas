import { ResourceManager, ResourceDescriptor } from './ResourceManager';

describe('ResourceManager', () => {
  let manager: ResourceManager;

  beforeEach(() => {
    manager = new ResourceManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Priority Queue System', () => {
    it('should sort queue by priority', () => {
      const resources: ResourceDescriptor[] = [
        { id: 'low-priority', type: 'json', url: '/test/low.json', priority: 1 },
        { id: 'high-priority', type: 'json', url: '/test/high.json', priority: 10 },
        { id: 'medium-priority', type: 'json', url: '/test/medium.json', priority: 5 },
      ];

      manager.registerResources(resources);

      const queue = (manager as any)['loadQueue'];
      const sortQueue = (manager as any)['sortQueue'].bind(manager);

      queue.push(
        {
          descriptor: resources[0],
          resolve: () => {},
          reject: () => {},
          priority: 1,
          timestamp: 100,
        },
        {
          descriptor: resources[1],
          resolve: () => {},
          reject: () => {},
          priority: 10,
          timestamp: 200,
        },
        {
          descriptor: resources[2],
          resolve: () => {},
          reject: () => {},
          priority: 5,
          timestamp: 300,
        },
      );

      sortQueue();

      expect(queue[0].descriptor.id).toBe('high-priority');
      expect(queue[1].descriptor.id).toBe('medium-priority');
      expect(queue[2].descriptor.id).toBe('low-priority');
    });

    it('should maintain FIFO order for same priority', () => {
      const resources: ResourceDescriptor[] = [
        { id: 'first', type: 'json', url: '/test/first.json', priority: 5 },
        { id: 'second', type: 'json', url: '/test/second.json', priority: 5 },
        { id: 'third', type: 'json', url: '/test/third.json', priority: 5 },
      ];

      manager.registerResources(resources);

      const queue = (manager as any)['loadQueue'];
      const sortQueue = (manager as any)['sortQueue'].bind(manager);

      queue.push(
        {
          descriptor: resources[0],
          resolve: () => {},
          reject: () => {},
          priority: 5,
          timestamp: 100,
        },
        {
          descriptor: resources[1],
          resolve: () => {},
          reject: () => {},
          priority: 5,
          timestamp: 200,
        },
        {
          descriptor: resources[2],
          resolve: () => {},
          reject: () => {},
          priority: 5,
          timestamp: 300,
        },
      );

      sortQueue();

      expect(queue[0].descriptor.id).toBe('first');
      expect(queue[1].descriptor.id).toBe('second');
      expect(queue[2].descriptor.id).toBe('third');
    });
  });

  describe('Chunk Loading', () => {
    it('should register resources to chunks', () => {
      const resources: ResourceDescriptor[] = [
        { id: 'chunk1-res1', type: 'json', url: '/test/chunk1/res1.json', chunk: 'level-01' },
        { id: 'chunk1-res2', type: 'json', url: '/test/chunk1/res2.json', chunk: 'level-01' },
        { id: 'chunk2-res1', type: 'json', url: '/test/chunk2/res1.json', chunk: 'level-02' },
      ];

      manager.registerResources(resources);

      const chunks = manager.getAvailableChunks();
      expect(chunks).toContain('level-01');
      expect(chunks).toContain('level-02');
    });

    it('should load all resources in a chunk', async () => {
      const resources: ResourceDescriptor[] = [
        { id: 'chunk-res1', type: 'json', url: '/test/chunk/res1.json', chunk: 'test-chunk' },
        { id: 'chunk-res2', type: 'json', url: '/test/chunk/res2.json', chunk: 'test-chunk' },
        { id: 'chunk-res3', type: 'json', url: '/test/chunk/res3.json', chunk: 'test-chunk' },
      ];

      manager.registerResources(resources);

      (manager as any)['loadJson'] = async (url: string) => ({ url });

      await manager.loadChunk('test-chunk');

      expect(manager.isResourceLoaded('chunk-res1')).toBe(true);
      expect(manager.isResourceLoaded('chunk-res2')).toBe(true);
      expect(manager.isResourceLoaded('chunk-res3')).toBe(true);
    });

    it('should unload all resources in a chunk', async () => {
      const resources: ResourceDescriptor[] = [
        { id: 'chunk-res1', type: 'json', url: '/test/chunk/res1.json', chunk: 'test-chunk' },
        { id: 'chunk-res2', type: 'json', url: '/test/chunk/res2.json', chunk: 'test-chunk' },
      ];

      manager.registerResources(resources);
      (manager as any)['loadJson'] = async (url: string) => ({ url });

      await manager.loadChunk('test-chunk');
      manager.unloadChunk('test-chunk');

      expect(manager.isResourceLoaded('chunk-res1')).toBe(false);
      expect(manager.isResourceLoaded('chunk-res2')).toBe(false);
    });

    it('should return chunk progress', async () => {
      const resources: ResourceDescriptor[] = [
        {
          id: 'progress-res1',
          type: 'json',
          url: '/test/progress/res1.json',
          chunk: 'progress-chunk',
        },
        {
          id: 'progress-res2',
          type: 'json',
          url: '/test/progress/res2.json',
          chunk: 'progress-chunk',
        },
        {
          id: 'progress-res3',
          type: 'json',
          url: '/test/progress/res3.json',
          chunk: 'progress-chunk',
        },
      ];

      manager.registerResources(resources);

      const progress = manager.getChunkProgress('progress-chunk');
      expect(progress.total).toBe(3);
      expect(progress.loaded).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('should handle non-existent chunk', async () => {
      await expect(manager.loadChunk('non-existent')).rejects.toThrow(
        'Chunk not found: non-existent',
      );
    });

    it('should not load chunk that is already loading', async () => {
      const resources: ResourceDescriptor[] = [
        { id: 'loading-res', type: 'json', url: '/test/loading/res.json', chunk: 'loading-chunk' },
      ];

      manager.registerResources(resources);
      (manager as any)['loadJson'] = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {};
      };

      const loadPromise1 = manager.loadChunk('loading-chunk');
      const isLoading = manager.isChunkLoading('loading-chunk');
      expect(isLoading).toBe(true);

      void manager.loadChunk('loading-chunk');

      await loadPromise1;
      expect(manager.isChunkLoading('loading-chunk')).toBe(false);
    });
  });

  describe('Group Loading', () => {
    it('should register resources to groups', () => {
      const resources: ResourceDescriptor[] = [
        { id: 'group1-res1', type: 'json', url: '/test/group1/res1.json', group: 'ui' },
        { id: 'group1-res2', type: 'json', url: '/test/group1/res2.json', group: 'ui' },
        { id: 'group2-res1', type: 'json', url: '/test/group2/res1.json', group: 'gameplay' },
      ];

      manager.registerResources(resources);

      const groups = manager.getAvailableGroups();
      expect(groups).toContain('ui');
      expect(groups).toContain('gameplay');
    });

    it('should load all resources in a group', async () => {
      const resources: ResourceDescriptor[] = [
        { id: 'group-res1', type: 'json', url: '/test/group/res1.json', group: 'test-group' },
        { id: 'group-res2', type: 'json', url: '/test/group/res2.json', group: 'test-group' },
      ];

      manager.registerResources(resources);
      (manager as any)['loadJson'] = async (url: string) => ({ url });

      await manager.loadGroup('test-group');

      expect(manager.isResourceLoaded('group-res1')).toBe(true);
      expect(manager.isResourceLoaded('group-res2')).toBe(true);
    });

    it('should unload all resources in a group', async () => {
      const resources: ResourceDescriptor[] = [
        { id: 'group-res1', type: 'json', url: '/test/group/res1.json', group: 'test-group' },
        { id: 'group-res2', type: 'json', url: '/test/group/res2.json', group: 'test-group' },
      ];

      manager.registerResources(resources);
      (manager as any)['loadJson'] = async (url: string) => ({ url });

      await manager.loadGroup('test-group');
      manager.unloadGroup('test-group');

      expect(manager.isResourceLoaded('group-res1')).toBe(false);
      expect(manager.isResourceLoaded('group-res2')).toBe(false);
    });

    it('should handle non-existent group', async () => {
      await expect(manager.loadGroup('non-existent')).rejects.toThrow(
        'Group not found: non-existent',
      );
    });
  });

  describe('Preload System', () => {
    it('should add preload resources to queue', () => {
      const resources: ResourceDescriptor[] = [
        { id: 'preload-res1', type: 'json', url: '/test/preload/res1.json', preload: true },
        { id: 'preload-res2', type: 'json', url: '/test/preload/res2.json', preload: true },
        { id: 'normal-res', type: 'json', url: '/test/normal/res.json', preload: false },
      ];

      manager.registerResources(resources);

      expect(manager.getPreloadQueueSize()).toBe(2);
    });

    it('should preload resources up to max size', async () => {
      const resources: ResourceDescriptor[] = [
        { id: 'preload-res1', type: 'json', url: '/test/preload/res1.json', preload: true },
        { id: 'preload-res2', type: 'json', url: '/test/preload/res2.json', preload: true },
        { id: 'preload-res3', type: 'json', url: '/test/preload/res3.json', preload: true },
      ];

      manager.registerResources(resources);
      (manager as any)['loadJson'] = async (url: string) => ({ url });

      await manager.startPreload();

      expect(manager.isPreloading()).toBe(false);
    });

    it('should not start preload if already in progress', async () => {
      const resources: ResourceDescriptor[] = [
        { id: 'preload-res', type: 'json', url: '/test/preload/res.json', preload: true },
      ];

      manager.registerResources(resources);
      (manager as any)['loadJson'] = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {};
      };

      const preloadPromise = manager.startPreload();
      const isPreloading = manager.isPreloading();
      expect(isPreloading).toBe(true);

      void manager.startPreload();

      await preloadPromise;
      expect(manager.isPreloading()).toBe(false);
    });

    it('should set max preload size', () => {
      manager.setMaxPreloadSize(5 * 1024 * 1024);
    });
  });

  describe('Resource Registration', () => {
    it('should register resource with chunk and group', () => {
      const resource: ResourceDescriptor = {
        id: 'multi-tag-res',
        type: 'json',
        url: '/test/multi/res.json',
        chunk: 'level-01',
        group: 'ui',
        priority: 5,
        preload: true,
      };

      manager.registerResource(resource);

      expect(manager.isResourceRegistered('multi-tag-res')).toBe(true);
      expect(manager.getAvailableChunks()).toContain('level-01');
      expect(manager.getAvailableGroups()).toContain('ui');
      expect(manager.getPreloadQueueSize()).toBe(1);
    });
  });

  describe('Destroy', () => {
    it('should clean up all data structures', () => {
      const resources: ResourceDescriptor[] = [
        {
          id: 'destroy-res',
          type: 'json',
          url: '/test/destroy/res.json',
          chunk: 'test-chunk',
          group: 'test-group',
          preload: true,
        },
      ];

      manager.registerResources(resources);
      manager.destroy();

      expect(manager.getResourceCount()).toBe(0);
      expect(manager.getAvailableChunks()).toHaveLength(0);
      expect(manager.getAvailableGroups()).toHaveLength(0);
      expect(manager.getPreloadQueueSize()).toBe(0);
      expect(manager.isPreloading()).toBe(false);
    });
  });
});
