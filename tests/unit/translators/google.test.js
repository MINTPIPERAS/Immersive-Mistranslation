import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleBackend } from '../../../src/background/translators/google.js';

describe('GoogleBackend', () => {
  const backend = new GoogleBackend();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(backend.id).toBe('google');
    expect(backend.name).toBe('Google 翻译');
    expect(backend.requiresApiKey).toBe(false);
  });

  it('returns translated text from google response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve([
        [
          ['Hello', 'source', null, null, 3, null, null, [[]]],
          [' world', 'source', null, null, 3, null, null, [[]]]
        ],
        null,
        'en'
      ])
    });

    const result = await backend.translate('你好世界', 'zh-CN', 'en', {});
    expect(result).toBe('Hello world');
  });

  it('maps zh-CN to zh for google endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve([[['结果', 'source']], null, 'zh'])
    });

    await backend.translate('result', 'en', 'zh-CN', {});
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('tl=zh');
  });

  it('throws on invalid response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve([null])
    });

    await expect(backend.translate('x', 'zh-CN', 'en', {})).rejects.toThrow(/GOOGLE_INVALID_RESPONSE/);
  });
});
