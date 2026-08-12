/**
 * 后台 API 处理器：基于可插拔后端注册表的翻译编排器
 */
import { translateWithBackend, listBackends, getBackend } from './translators/index.js';
import { Storage, getConfig, setConfig, getBackendConfig } from '../shared/storage.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function normalizeChain(chain) {
  if (!Array.isArray(chain) || chain.length === 0) {
    throw new Error('NO_CHAIN: 未指定翻译链路');
  }

  // 字符串数组：['zh-CN', 'en', 'fi'] -> [{from:'zh-CN',to:'en'}, {from:'en',to:'fi'}]
  if (chain.every(step => typeof step === 'string')) {
    return chain.slice(0, -1).map((from, i) => ({
      from,
      to: chain[i + 1]
    }));
  }

  return chain.map(step => {
    if (typeof step === 'string') {
      throw new Error('CHAIN_INVALID: 链路步骤格式异常');
    }
    return {
      from: step.from || step.source,
      to: step.to || step.target,
      backendId: step.backendId || null
    };
  });
}

async function resolveDefaultBackendId(config, backendConfig) {
  if (config?.defaultBackendId && getBackend(config.defaultBackendId)) {
    return config.defaultBackendId;
  }

  const baiduCfg = backendConfig?.baidu || {};
  if (baiduCfg.appId && baiduCfg.apiKey) {
    return 'baidu';
  }

  return 'google';
}

async function getTranslationConfig(payloadBackendConfig) {
  if (payloadBackendConfig && Object.keys(payloadBackendConfig).length > 0) {
    const config = await getConfig();
    return { config, backendConfig: payloadBackendConfig };
  }
  const config = await getConfig();
  return { config, backendConfig: config.backendConfig };
}

async function chainTranslate(text, chain, defaultBackendId, backendConfig) {
  const normalized = normalizeChain(chain);
  let current = text;

  for (const step of normalized) {
    const backendId = step.backendId || defaultBackendId;
    const config = backendConfig?.[backendId] || {};
    current = await translateWithBackend(backendId, current, step.from, step.to, config);
  }

  return current;
}

async function translateBatch(texts, chain, payloadBackendConfig, defaultBackendId) {
  const { config, backendConfig } = await getTranslationConfig(payloadBackendConfig);
  const resolvedDefault = defaultBackendId || await resolveDefaultBackendId(config, backendConfig);

  const results = [];
  for (const text of texts) {
    try {
      const result = await chainTranslate(text, chain, resolvedDefault, backendConfig);
      results.push(result);
    } catch (error) {
      console.error('[乱翻译] 单条批量翻译失败:', error.message);
      results.push({ error: error.message });
    }
    await sleep(100);
  }
  return results;
}

async function translateSingle(text, chain, payloadBackendConfig, defaultBackendId) {
  const { config, backendConfig } = await getTranslationConfig(payloadBackendConfig);
  const resolvedDefault = defaultBackendId || await resolveDefaultBackendId(config, backendConfig);
  return chainTranslate(text, chain, resolvedDefault, backendConfig);
}

export function initApiHandler() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ ok: true, version: '2.0.0-pluggable' });
      return false;
    }

    if (request.action === 'listBackends') {
      sendResponse({ success: true, backends: listBackends() });
      return false;
    }

    if (request.action === 'getBackendConfig') {
      (async () => {
        try {
          const config = await getBackendConfig(request.backendId);
          sendResponse({ success: true, config });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }

    if (request.action === 'setBackendConfig') {
      (async () => {
        try {
          const current = await getConfig();
          const merged = {
            ...current,
            backendConfig: {
              ...current.backendConfig,
              [request.backendId]: {
                ...(current.backendConfig[request.backendId] || {}),
                ...(request.config || {})
              }
            }
          };
          await setConfig(merged);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }

    return false;
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'immersive-mistranslation') return;

    console.log('[乱翻译] 建立长连接');

    port.onMessage.addListener(async (message) => {
      const { requestId, action } = message;
      if (!requestId) return;

      try {
        if (action === 'translateBatch') {
          const { texts, chain, backendConfig, defaultBackendId } = message;
          if (!Array.isArray(texts) || !Array.isArray(chain)) {
            port.postMessage({
              requestId,
              response: { success: false, error: 'Missing texts or chain' }
            });
            return;
          }

          const results = await translateBatch(texts, chain, backendConfig, defaultBackendId);
          const successCount = results.filter(r => typeof r === 'string').length;
          console.log('[乱翻译] 批量翻译完成，成功:', successCount, '/', texts.length);
          port.postMessage({
            requestId,
            response: { success: true, results }
          });
          return;
        }

        if (action === 'translate') {
          const { text, chain, backendConfig, defaultBackendId } = message;
          if (!text || !Array.isArray(chain)) {
            port.postMessage({
              requestId,
              response: { success: false, error: 'Missing text or chain' }
            });
            return;
          }

          const result = await translateSingle(text, chain, backendConfig, defaultBackendId);
          port.postMessage({
            requestId,
            response: { success: true, result }
          });
          return;
        }

        port.postMessage({
          requestId,
          response: { success: false, error: `Unknown action: ${action}` }
        });
      } catch (error) {
        console.error('[乱翻译] 长连接处理失败:', error);
        port.postMessage({
          requestId,
          response: { success: false, error: error.message || 'Translation failed' }
        });
      }
    });

    port.onDisconnect.addListener(() => {
      console.log('[乱翻译] 长连接断开');
    });
  });
}
