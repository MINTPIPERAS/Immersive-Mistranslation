import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIBackend } from '../../../src/background/translators/openai.js';
import { DEFAULT_LLM_SYSTEM_PROMPT } from '../../../src/shared/constants.js';

describe('OpenAIBackend', () => {
  const backend = new OpenAIBackend();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(backend.id).toBe('openai');
    expect(backend.name).toBe('大模型乱译 (OpenAI 兼容)');
    expect(backend.requiresApiKey).toBe(true);
  });

  it('throws when api key is missing', () => {
    expect(() => backend.validateConfig({})).toThrow(/未配置大模型 API Key/);
  });

  it('builds system prompt with maxRounds placeholder', () => {
    const prompt = backend.buildSystemPrompt({ maxRounds: 42, systemPrompt: DEFAULT_LLM_SYSTEM_PROMPT });
    expect(prompt).toContain('42');
    expect(prompt).not.toContain('{maxRounds}');
  });

  it('returns content from chat completion', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({
        choices: [{
          message: {
            content: '  荒诞结果  '
          }
        }]
      })
    });

    const result = await backend.translate('原文', 'zh-CN', 'zh-CN', {
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      apiBase: 'https://api.test.com/v1',
      systemPrompt: DEFAULT_LLM_SYSTEM_PROMPT,
      temperature: 0.9,
      maxRounds: 20
    });

    expect(result).toBe('荒诞结果');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/chat/completions');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toBe('原文');
  });

  it('throws on http error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: { message: 'Invalid key' } })
    });

    await expect(backend.translate('x', 'zh-CN', 'zh-CN', {
      apiKey: 'bad',
      model: 'gpt-4o-mini',
      apiBase: 'https://api.test.com/v1',
      systemPrompt: DEFAULT_LLM_SYSTEM_PROMPT,
      temperature: 0.9,
      maxRounds: 20
    })).rejects.toThrow(/OPENAI_HTTP_401/);
  });

  it('throws on empty response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({
        choices: [{ message: { content: '   ' } }]
      })
    });

    await expect(backend.translate('x', 'zh-CN', 'zh-CN', {
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      apiBase: 'https://api.test.com/v1',
      systemPrompt: DEFAULT_LLM_SYSTEM_PROMPT,
      temperature: 0.9,
      maxRounds: 20
    })).rejects.toThrow(/OPENAI_EMPTY_RESPONSE/);
  });
});
