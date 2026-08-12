/**
 * chrome.storage.local 封装与扩展配置管理
 */
import {
  DEFAULT_BACKEND_ID,
  DEFAULT_CHAIN,
  DEFAULT_TRANSLATION_MODE,
  DEFAULT_LLM_CONFIG
} from './constants.js';

const CONFIG_KEY = 'mistranslationConfig';

const DEFAULT_CONFIG = {
  defaultBackendId: DEFAULT_BACKEND_ID,
  translationMode: DEFAULT_TRANSLATION_MODE,
  backendConfig: {
    baidu: { appId: '', apiKey: '' },
    deepl: { apiKey: '' },
    openai: { ...DEFAULT_LLM_CONFIG },
    deepLx: { endpoint: '' },
  },
  chain: DEFAULT_CHAIN,
};

export const Storage = {
  get(key, defaultValue = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] ?? defaultValue);
      });
    });
  },
  set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }
};

async function loadLegacyBaiduConfig() {
  const result = await new Promise((resolve) => {
    chrome.storage.local.get(['baidu_appid', 'baidu_key'], resolve);
  });
  if (result.baidu_appid && result.baidu_key) {
    return { appId: result.baidu_appid, apiKey: result.baidu_key };
  }
  return null;
}

export async function getConfig() {
  const stored = await Storage.get(CONFIG_KEY, {});
  const merged = {
    ...DEFAULT_CONFIG,
    ...stored,
    backendConfig: {
      ...DEFAULT_CONFIG.backendConfig,
      ...(stored.backendConfig || {}),
    },
    chain: stored.chain || DEFAULT_CONFIG.chain,
    translationMode: stored.translationMode || DEFAULT_CONFIG.translationMode,
  };

  const legacyBaidu = await loadLegacyBaiduConfig();
  if (legacyBaidu && !merged.backendConfig.baidu.appId && !merged.backendConfig.baidu.apiKey) {
    merged.backendConfig.baidu = { ...legacyBaidu };
  }

  return merged;
}

export async function setConfig(config) {
  await Storage.set(CONFIG_KEY, config);
}

export async function getBackendConfig(backendId) {
  const config = await getConfig();
  return config.backendConfig[backendId] || {};
}
