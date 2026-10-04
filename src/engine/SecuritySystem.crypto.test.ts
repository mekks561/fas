import { describe, it, expect } from 'vitest';
import { SecuritySystem } from './SecuritySystem';

// SecuritySystem AES-GCM 加密往返测试 - 替换 XOR 加密后的回归验证

describe('SecuritySystem AES-GCM 加密', () => {
  it('应能加密并解密还原对象数据', async () => {
    const security = new SecuritySystem();
    const data = { player: 'Alice', score: 9999, items: ['sword', 'shield'] };
    const encrypted = await security.encryptData(data);
    const decrypted = await security.decryptData<typeof data>(encrypted);
    expect(decrypted).toEqual(data);
  });

  it('应能处理基本类型数据', async () => {
    const security = new SecuritySystem();
    const encrypted = await security.encryptData(42);
    const decrypted = await security.decryptData<number>(encrypted);
    expect(decrypted).toBe(42);
  });

  it('enableEncryption=false 时应返回明文 JSON', async () => {
    const security = new SecuritySystem({ enableEncryption: false });
    const data = { hello: 'world' };
    const result = await security.encryptData(data);
    expect(result).toBe(JSON.stringify(data));
    const decrypted = await security.decryptData<typeof data>(result);
    expect(decrypted).toEqual(data);
  });

  it('损坏的密文应返回 null', async () => {
    const security = new SecuritySystem();
    const decrypted = await security.decryptData('not-a-valid-ciphertext');
    expect(decrypted).toBeNull();
  });

  it('格式错误的密文(无分隔符)应返回 null', async () => {
    const security = new SecuritySystem();
    const decrypted = await security.decryptData('noSeparatorHere');
    expect(decrypted).toBeNull();
  });

  it('相同数据多次加密应产生不同密文(IV 随机性)', async () => {
    const security = new SecuritySystem();
    const data = { score: 100 };
    const e1 = await security.encryptData(data);
    const e2 = await security.encryptData(data);
    expect(e1).not.toBe(e2);
    // 但都能正确解密
    expect(await security.decryptData(e1)).toEqual(data);
    expect(await security.decryptData(e2)).toEqual(data);
  });

  it('空对象应能正确加密解密', async () => {
    const security = new SecuritySystem();
    const encrypted = await security.encryptData({});
    const decrypted = await security.decryptData<Record<string, never>>(encrypted);
    expect(decrypted).toEqual({});
  });

  it('使用自定义密钥应能正确加解密', async () => {
    const security = new SecuritySystem({ encryptionKey: 'my-custom-secret-key-123' });
    const data = { level: 5, xp: 1500 };
    const encrypted = await security.encryptData(data);
    const decrypted = await security.decryptData<typeof data>(encrypted);
    expect(decrypted).toEqual(data);
  });

  it('密钥缓存不应影响多次加解密正确性', async () => {
    const security = new SecuritySystem();
    const datasets = [
      { a: 1 },
      { b: 'hello' },
      { c: [1, 2, 3] },
      { d: { nested: { deep: true } } },
    ];
    for (const data of datasets) {
      // eslint-disable-next-line no-await-in-loop -- 顺序验证缓存复用语义
      const encrypted = await security.encryptData(data);
      // eslint-disable-next-line no-await-in-loop -- 顺序验证缓存复用语义
      const decrypted = await security.decryptData<typeof data>(encrypted);
      expect(decrypted).toEqual(data);
    }
  });
});
