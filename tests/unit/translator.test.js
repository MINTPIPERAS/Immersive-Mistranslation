import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Storage } from '../../src/shared/storage.js';
import { TRANSLATION_MODES, DEFAULT_CHAIN, DEFAULT_LLM_CHAIN } from '../../src/shared/constants.js';
import { getActiveChain } from '../../src/content/translator.js';

describe('getActiveChain', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns DEFAULT_CHAIN in chain mode', async () => {
    vi.spyOn(Storage, 'get').mockResolvedValue({
      translationMode: TRANSLATION_MODES.CHAIN,
      chain: undefined
    });

    const chain = await getActiveChain();
    expect(chain).toEqual(DEFAULT_CHAIN);
  });

  it('returns saved chain when available', async () => {
    const customChain = [
      { from: 'zh-CN', to: 'en', backendId: 'baidu' },
      { from: 'en', to: 'zh-CN', backendId: 'baidu' }
    ];
    vi.spyOn(Storage, 'get').mockResolvedValue({
      translationMode: TRANSLATION_MODES.CHAIN,
      chain: customChain
    });

    const chain = await getActiveChain();
    expect(chain).toEqual(customChain);
  });

  it('returns DEFAULT_LLM_CHAIN in LLM mode', async () => {
    vi.spyOn(Storage, 'get').mockResolvedValue({
      translationMode: TRANSLATION_MODES.LLM,
      chain: undefined
    });

    const chain = await getActiveChain();
    expect(chain).toEqual(DEFAULT_LLM_CHAIN);
  });

  it('falls back to DEFAULT_CHAIN when storage is empty', async () => {
    vi.spyOn(Storage, 'get').mockResolvedValue({});

    const chain = await getActiveChain();
    expect(chain).toEqual(DEFAULT_CHAIN);
  });
});
