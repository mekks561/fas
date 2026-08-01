import { beforeAll, afterEach, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TRPCProvider } from '../TRPCProvider';
import { MockProvider } from '../MockProvider';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  localStorage.clear();
});
afterAll(() => server.close());

describe('TRPCProvider - Rule 1: 空URL或kind非trpc直用MockProvider', () => {
  it('空 trpcUrl 直接构造 fallback MockProvider', async () => {
    const p = new TRPCProvider('');
    expect(p.kind).toBe('trpc');
    const list = await p.list({ limit: 50, filter: 'all' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(5);
  });
});

describe('TRPCProvider - Rule 2&3: 网络错误/5xx 降级', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('fetch 抛网络错误 → 降级 MockProvider list 不抛', async () => {
    server.use(
      http.post('http://bad-url.test/trpc/leaderboard.list', () => {
        return HttpResponse.error();
      }),
    );
    const p = new TRPCProvider('http://bad-url.test');
    const list = await p.list({ limit: 20, filter: 'all' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('HTTP 500 → 降级 MockProvider list 不抛', async () => {
    server.use(
      http.post('http://down.test/trpc/leaderboard.list', () => {
        return new HttpResponse('server crash', { status: 500 });
      }),
    );
    const p = new TRPCProvider('http://down.test');
    const list = await p.list({ limit: 20, filter: 'all' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});

describe('TRPCProvider - Rule 4: Zod 400 BAD_REQUEST 不降级向上抛', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('zod BAD_REQUEST → submit 抛错（不降级）', async () => {
    server.use(
      http.post('http://zod-err.test/trpc/leaderboard.submit', async () => {
        return HttpResponse.json(
          {
            error: {
              code: 'BAD_REQUEST',
              json: { issues: [{ code: 'too_small', path: ['playerId'] }] },
            },
          },
          { status: 400 },
        );
      }),
    );
    const p = new TRPCProvider('http://zod-err.test');
    await expect(
      p.submit({ playerId: '', playerName: 'X', score: 100, wave: 1, kills: 0 }),
    ).rejects.toThrow();
  });
});

describe('TRPCProvider - filter=friends 时 Omit filter 转发', () => {
  it('请求体不含 filter 字段（POC listInput 无 filter）', async () => {
    let capturedBody: any = null;
    server.use(
      http.get('http://ok.test/trpc/leaderboard.list', ({ request }) => {
        const url = new URL(request.url);
        capturedBody = { searchParams: Object.fromEntries(url.searchParams), bodyText: '' };
        return HttpResponse.json({ result: { data: { json: [] } } });
      }),
    );
    const p = new TRPCProvider('http://ok.test');
    await p.list({ limit: 50, filter: 'friends' });

    expect(capturedBody).not.toBeNull();
    const combined = capturedBody.searchParams.batch + ' ' + capturedBody.bodyText;
    expect(combined).not.toContain('friends');
  });
});

describe('TRPCProvider - fallbackOrThrow 内部机制 (list 成功路径)', () => {
  it('成功响应 → 返回服务端数据，不降级，timestamp Date 正确', async () => {
    const nowIso = new Date('2026-08-02T12:00:00Z').toISOString();
    server.use(
      http.get('http://ok.test/trpc/leaderboard.list', () => {
        return HttpResponse.json({
          result: {
            data: {
              json: [
                {
                  playerId: 'srv_1',
                  playerName: 'ServerPlayer',
                  score: 1_000_000,
                  wave: 100,
                  kills: 9999,
                  timestamp: nowIso,
                  rank: 1,
                },
              ],
            },
          },
        });
      }),
    );
    const p = new TRPCProvider('http://ok.test');
    const list = await p.list({ limit: 50, filter: 'all' });
    expect(list.length).toBe(1);
    expect(list[0].playerId).toBe('srv_1');
    expect(list[0].timestamp).toBeInstanceOf(Date);
    expect(list[0].timestamp.getTime()).toBe(new Date(nowIso).getTime());
  });

  it('friends filter 后处理切片 (索引 10-25)', async () => {
    const seed = Array.from({ length: 100 }, (_, i) => ({
      playerId: `p_${i}`,
      playerName: `P${i}`,
      score: 100_000 - i * 100,
      wave: 50,
      kills: 100,
      timestamp: new Date().toISOString(),
      rank: i + 1,
    }));
    server.use(
      http.get('http://ok.test/trpc/leaderboard.list', () =>
        HttpResponse.json({ result: { data: { json: seed } } }),
      ),
    );
    const p = new TRPCProvider('http://ok.test');
    const friends = await p.list({ limit: 200, filter: 'friends' });
    expect(friends.length).toBe(16);
    expect(friends[0].playerId).toBe('p_10');
    expect(friends[friends.length - 1].playerId).toBe('p_25');
  });
});
