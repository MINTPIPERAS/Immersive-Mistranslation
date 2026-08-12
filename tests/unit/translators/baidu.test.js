import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaiduBackend } from '../../../src/background/translators/baidu.js';

describe('BaiduBackend', () => {
  const backend = new BaiduBackend();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(backend.id).toBe('baidu');
    expect(backend.name).toBe('百度翻译');
    expect(backend.requiresApiKey).toBe(true);
  });

  it('throws when config is missing', () => {
    expect(() => backend.validateConfig({})).toThrow(/需要 API Key/);
  });

  it('returns translated text from response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({
        trans_result: [
          { dst: 'Hello' },
          { dst: ' world' }
        ]
      })
    });

    const result = await backend.translate('你好世界', 'zh-CN', 'en', {
      appId: '123',
      apiKey: 'secret'
    });

    expect(result).toBe('Hello world');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws on API error code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({
        error_code: '52003',
        error_msg: '未授权用户'
      })
    });

    await expect(backend.translate('x', 'zh-CN', 'en', {
      appId: '123',
      apiKey: 'secret'
    })).rejects.toThrow(/BAIDU_API_52003/);
  });

  it('throws on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(backend.translate('x', 'zh-CN', 'en', {
      appId: '123',
      apiKey: 'secret'
    })).rejects.toThrow(/BAIDU_NETWORK_ERROR/);
  });
});
