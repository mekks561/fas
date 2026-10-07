/**
 * 真实 Lua 模块源码注册表（构建期内联，dev / 生产构建都可用）
 *
 * 背景：`src/lua/**\/*.lua` 在 2026-10-07 之前**从未被执行过**——LuaEngine 找的是
 * wasmoon 1.12 以前的 `wasmoon.factory` 单例，而项目装的是 1.16（只导出 `LuaFactory`），
 * 于是每次初始化都静默落到 stub（宿主 JS 复刻实现），`doString` 是个空函数。
 *
 * 这个注册表是「真实 Lua 运行时」的取源处：Lua 侧的 require 装载器按名字取出源码，
 * 用 `load(src, name)` 编译执行，把返回值当模块表缓存。
 *
 * 用 `?raw` 内联而不是 `fetch('/src/lua/...')`：后者在 dev 能跑、生产构建必然 404，
 * 会静默退化成兜底实现（等于「假接线」）。
 */

// 测试脚本（tests/*.lua）不进运行时注册表，避免打包进产物。
//
// 必须用 `query: '?raw', import: 'default'`（现代写法）。
// **不要**写回旧的 `as: 'raw'`：Vite 8（rolldown）下该选项已失效且不报错，构建产物会
// 变成 `'/assets/enemy-ai-xxxx.lua'` 这样的**资源 URL 字符串**——dev 下正常、
// 生产下 `load()` 必然语法失败。这类「dev 绿、prod 炸」正是本项目要根除的假接线。
const luaSourceModules = import.meta.glob(['./**/*.lua', '!./**/tests/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** 'ai/enemy-ai.lua' → { 'ai/enemy-ai': '(源码)', 'enemy-ai': '(源码)' } */
const sourceByName = new Map<string, string>();
/** basename 重名检测：重名时不接受短名，避免误命中 */
const basenameConflicts = new Set<string>();
/** 源注册损坏的条目（拿到 URL 而非源码 = 构建配置退化），供自检与诊断暴露 */
const invalidEntries: string[] = [];

/**
 * 判定拿到的到底是不是「Lua 源码」。
 *
 * 被 `?raw` 内联时值一定含换行；被当成资源 URL 时值是 `/assets/xxx.lua` 这种单行路径。
 * 这个判定存在的意义：让「配置退化」变成**显式可见**的错误，而不是让 Lua 侧
 * 拿 URL 去 load 然后抛一句看不懂的语法错。
 */
function looksLikeSourcePath(value: string): boolean {
  return !value.includes('\n') && value.trim().endsWith('.lua');
}

for (const [key, source] of Object.entries(luaSourceModules)) {
  const fullName = key.replace(/^\.\//, '').replace(/\.lua$/, '');

  if (typeof source !== 'string' || looksLikeSourcePath(source)) {
    invalidEntries.push(
      `${fullName}（取到的是资源路径而非源码，请检查 import.meta.glob 的 query 选项）`,
    );
    continue;
  }

  sourceByName.set(fullName, source);

  const shortName = fullName.split('/').pop() as string;
  if (shortName !== fullName) {
    if (sourceByName.has(shortName)) {
      basenameConflicts.add(shortName);
    } else {
      sourceByName.set(shortName, source);
    }
  }
}

for (const conflicted of basenameConflicts) {
  sourceByName.delete(conflicted);
}

if (invalidEntries.length > 0) {
  console.error('[luaSources] Lua 源码注册表存在非法条目：', invalidEntries);
}

/**
 * 按 require 名称取 Lua 源码。
 * 支持全路径名（'ai/enemy-ai'）与不冲突的短名（'enemy-ai'）。
 */
export function getLuaSource(name: string): string | null {
  return sourceByName.get(name) ?? null;
}

/** 全部可用模块名（用于诊断与装载器预热） */
export function listLuaModuleNames(): string[] {
  return [...sourceByName.keys()].sort();
}

/** 以 { name: source } 形式导出，供注入 Lua 装载器 */
export function getLuaSourceMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [name, source] of sourceByName) {
    map[name] = source;
  }
  return map;
}

/** 源码注册表的健康度（自检用）：非空即代表构建配置退化，真实 Lua 会装载失败 */
export function getLuaSourceRegistryErrors(): string[] {
  return [...invalidEntries];
}
