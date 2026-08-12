import { describe, it, expect } from 'vitest';
import { TranslatorBackend } from '../../../src/background/translators/translator-backend.js';

describe('TranslatorBackend base class', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new TranslatorBackend()).toThrow(TypeError);
  });

  it('defines default getters', () => {
    class DummyBackend extends TranslatorBackend {
      get id() { return 'dummy'; }
      get name() { return 'Dummy'; }
      async translate() { return 'ok'; }
    }

    const backend = new DummyBackend();
    expect(backend.requiresApiKey).toBe(false);
    expect(backend.defaultConfig).toEqual({});
    expect(backend.maxTextLength).toBe(5000);
  });

  it('validateConfig passes when no key required', () => {
    class DummyBackend extends TranslatorBackend {
      get id() { return 'dummy'; }
      get name() { return 'Dummy'; }
      async translate() { return 'ok'; }
    }

    const backend = new DummyBackend();
    expect(() => backend.validateConfig({})).not.toThrow();
  });

  it('validateConfig throws when key required but missing', () => {
    class KeyedBackend extends TranslatorBackend {
      get id() { return 'keyed'; }
      get name() { return 'Keyed'; }
      get requiresApiKey() { return true; }
      get defaultConfig() { return { apiKey: '' }; }
      async translate() { return 'ok'; }
    }

    const backend = new KeyedBackend();
    expect(() => backend.validateConfig({})).toThrow(/需要 API Key/);
    expect(() => backend.validateConfig({ apiKey: 'sk-xxx' })).not.toThrow();
  });
});
