import * as pc from 'playcanvas';

export interface PluginContext {
  app: pc.Application;
  engine: unknown;
  container: Map<string, unknown>;
}

export interface Plugin {
  name: string;
  version: string;
  dependencies?: string[];
  init(context: PluginContext): void | Promise<void>;
  destroy?(): void | Promise<void>;
  onUpdate?(dt: number): void;
  onFixedUpdate?(dt: number): void;
  [key: string]: unknown;
}

export interface PluginConfig {
  enabled?: boolean;
  [key: string]: unknown;
}

export class PluginSystem {
  private plugins: Map<string, Plugin> = new Map();
  private loadedPlugins: Set<string> = new Set();
  private configs: Map<string, PluginConfig> = new Map();
  private context: PluginContext;
  private updateListeners: Set<(dt: number) => void> = new Set();
  private fixedUpdateListeners: Set<(dt: number) => void> = new Set();

  constructor(app: pc.Application, engine: unknown) {
    this.context = {
      app,
      engine,
      container: new Map(),
    };
  }

  public register(plugin: Plugin, config: PluginConfig = {}): boolean {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin "${plugin.name}" already registered`);
      return false;
    }

    this.plugins.set(plugin.name, plugin);
    this.configs.set(plugin.name, { enabled: true, ...config });
    return true;
  }

  public unregister(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      console.warn(`Plugin "${name}" not found`);
      return false;
    }

    if (this.loadedPlugins.has(name)) {
      this.unload(name);
    }

    this.plugins.delete(name);
    this.configs.delete(name);
    return true;
  }

  public async load(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      console.warn(`Plugin "${name}" not registered`);
      return false;
    }

    if (this.loadedPlugins.has(name)) {
      return true;
    }

    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.loadedPlugins.has(dep)) {
          const loaded = await this.load(dep);
          if (!loaded) {
            console.warn(`Failed to load dependency "${dep}" for plugin "${name}"`);
            return false;
          }
        }
      }
    }

    try {
      await plugin.init(this.context);
      this.loadedPlugins.add(name);

      if (plugin.onUpdate) {
        this.updateListeners.add(plugin.onUpdate.bind(plugin));
      }

      if (plugin.onFixedUpdate) {
        this.fixedUpdateListeners.add(plugin.onFixedUpdate.bind(plugin));
      }

      console.log(`[PluginSystem] Loaded plugin: ${plugin.name} v${plugin.version}`);
      return true;
    } catch (error) {
      console.error(`[PluginSystem] Failed to load plugin "${name}":`, error);
      return false;
    }
  }

  public async unload(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      console.warn(`Plugin "${name}" not registered`);
      return false;
    }

    if (!this.loadedPlugins.has(name)) {
      return true;
    }

    try {
      if (plugin.onUpdate) {
        this.updateListeners.delete(plugin.onUpdate.bind(plugin));
      }

      if (plugin.onFixedUpdate) {
        this.fixedUpdateListeners.delete(plugin.onFixedUpdate.bind(plugin));
      }

      if (plugin.destroy) {
        await plugin.destroy();
      }

      this.loadedPlugins.delete(name);
      console.log(`[PluginSystem] Unloaded plugin: ${plugin.name}`);
      return true;
    } catch (error) {
      console.error(`[PluginSystem] Failed to unload plugin "${name}":`, error);
      return false;
    }
  }

  public async loadAll(): Promise<void> {
    for (const [name] of this.plugins) {
      await this.load(name);
    }
  }

  public async unloadAll(): Promise<void> {
    for (const name of this.loadedPlugins) {
      await this.unload(name);
    }
  }

  public update(dt: number): void {
    this.updateListeners.forEach((listener) => listener(dt));
  }

  public fixedUpdate(dt: number): void {
    this.fixedUpdateListeners.forEach((listener) => listener(dt));
  }

  public getPlugin<T extends Plugin = Plugin>(name: string): T | undefined {
    const plugin = this.plugins.get(name);
    if (!plugin || !this.loadedPlugins.has(name)) {
      return undefined;
    }
    return plugin as T;
  }

  public isLoaded(name: string): boolean {
    return this.loadedPlugins.has(name);
  }

  public getLoadedPlugins(): string[] {
    return Array.from(this.loadedPlugins);
  }

  public getAllPlugins(): { name: string; version: string; loaded: boolean }[] {
    const result: { name: string; version: string; loaded: boolean }[] = [];
    this.plugins.forEach((plugin, name) => {
      result.push({
        name,
        version: plugin.version,
        loaded: this.loadedPlugins.has(name),
      });
    });
    return result;
  }

  public getConfig(name: string): PluginConfig | undefined {
    return this.configs.get(name);
  }

  public setConfig(name: string, config: Partial<PluginConfig>): void {
    const existing = this.configs.get(name);
    if (existing) {
      this.configs.set(name, { ...existing, ...config });
    }
  }

  public getContainer(): Map<string, unknown> {
    return this.context.container;
  }

  public setContainerValue(key: string, value: unknown): void {
    this.context.container.set(key, value);
  }

  public getContainerValue<T = unknown>(key: string): T | undefined {
    return this.context.container.get(key) as T;
  }
}