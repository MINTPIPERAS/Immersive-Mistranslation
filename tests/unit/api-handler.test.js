import { describe, it, expect } from 'vitest';
import { normalizeChain } from '../../src/background/api-handler.js';

describe('normalizeChain', () => {
  it('normalizes string array to objects', () => {
    const result = normalizeChain(['zh-CN', 'en', 'fi']);
    expect(result).toEqual([
      { from: 'zh-CN', to: 'en' },
      { from: 'en', to: 'fi' }
    ]);
  });

  it('normalizes object array and keeps backendId', () => {
    const result = normalizeChain([
      { from: 'zh-CN', to: 'en', backendId: 'google' },
      { source: 'en', target: 'fi' }
    ]);
    expect(result).toEqual([
      { from: 'zh-CN', to: 'en', backendId: 'google' },
      { from: 'en', to: 'fi', backendId: null }
    ]);
  });

  it('throws on empty chain', () => {
    expect(() => normalizeChain([])).toThrow(/NO_CHAIN/);
  });

  it('throws on mixed string/object array', () => {
    expect(() => normalizeChain(['zh-CN', { from: 'en', to: 'fi' }])).toThrow(/CHAIN_INVALID/);
  });
});
