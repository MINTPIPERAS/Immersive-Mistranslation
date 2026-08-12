import { describe, it, expect } from 'vitest';
import { getBackend, listBackends, translateWithBackend } from '../../../src/background/translators/index.js';

describe('Translator registry', () => {
  it('lists all backends', () => {
    const backends = listBackends();
    expect(backends.length).toBeGreaterThan(0);
    expect(backends.map(b => b.id).sort()).toContain('google');
    expect(backends.map(b => b.id).sort()).toContain('baidu');
    expect(backends.map(b => b.id).sort()).toContain('openai');
  });

  it('returns backend by id', () => {
    const google = getBackend('google');
    expect(google).not.toBeNull();
    expect(google.id).toBe('google');
  });

  it('returns null for unknown backend', () => {
    expect(getBackend('not-exist')).toBeNull();
  });

  it('throws for unknown backend in translateWithBackend', async () => {
    await expect(translateWithBackend('not-exist', 'x', 'zh-CN', 'en', {})).rejects.toThrow(/未知后端/);
  });
});
