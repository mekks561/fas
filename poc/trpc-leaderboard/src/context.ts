// ===================================================================
// tRPC Context - 每次请求创建，传递用户身份等信息
// POC 简化：仅演示 API Key 鉴权写入 context
// ===================================================================

export interface CreateContextOptions {
  apiKey?: string;
}

export interface AppContext {
  apiKey?: string;
  isAuthenticated: boolean;
}

export function createContextInner(opts: CreateContextOptions): AppContext {
  const expectedKey = process.env['API_KEY'] ?? 'poc-dev-key-change-me';
  return {
    apiKey: opts.apiKey,
    isAuthenticated: opts.apiKey === expectedKey,
  };
}

// 适配 standalone http 的 context 工厂
export function createContext(): AppContext {
  // POC 简化：不强制鉴权（查询公开，提交可由 procedure 内部校验）
  return createContextInner({});
}

export type Context = AppContext;
