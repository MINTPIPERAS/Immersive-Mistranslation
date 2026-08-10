/**
 * 后台 API 处理器：统一调用翻译 API
 * 优先使用已配置的百度翻译 API；未配置时回退到 Google Translate API
 */
import { baiduTranslate, toBaiduCode } from './baidu-translator.js';

const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 从 storage 读取百度翻译配置
 */
async function getBaiduConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['baidu_appid', 'baidu_key'], (result) => {
      if (result.baidu_appid && result.baidu_key) {
        resolve({ appid: result.baidu_appid, key: result.baidu_key });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Google 单步翻译
 */
async function googleTranslateStep(text, sourceLang, targetLang) {
  const url = new URL(GOOGLE_TRANSLATE_API);
  url.searchParams.append('client', 'gtx');
  url.searchParams.append('sl', sourceLang);
  url.searchParams.append('tl', targetLang);
  url.searchParams.append('dt', 't');
  url.searchParams.append('q', text);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data[0])) {
      throw new Error('Invalid response format');
    }

    return data[0].map(part => part[0]).join('');
  } catch (error) {
    const isNetworkError = error instanceof TypeError;
    const prefix = isNetworkError ? 'NETWORK_ERROR' : 'API_ERROR';
    const detail = `${prefix}: ${error.message}`;
    console.error('[乱翻译] Google 请求失败:', detail, '\nURL:', url.toString());
    throw new Error(detail);
  }
}

/**
 * 选择可用 API 进行回译，支持多条链路兜底
 */
async function chainTranslate(text, chains) {
  if (!Array.isArray(chains) || chains.length === 0) {
    throw new Error('NO_CHAIN: 未指定翻译链路');
  }

  const baiduConfig = await getBaiduConfig();
  let lastError = null;

  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i];
    const chainLabel = chain.map(s => `${s.source}->${s.target}`).join(' -> ');
    console.log(`[乱翻译] 尝试链路 ${i + 1}/${chains.length}: ${chainLabel}`);

    try {
      let current = text;
      for (const step of chain) {
        current = await translateStep(current, step.source, step.target, baiduConfig);
      }
      console.log('[乱翻译] 链路翻译成功');
      return current;
    } catch (error) {
      lastError = error;
      console.error(`[乱翻译] 链路 ${i + 1} 失败:`, error.message);
    }
  }

  throw new Error(`ALL_CHAINS_FAILED: 所有链路均失败。${lastError?.message || ''}`);
}

/**
 * 单步翻译：根据配置选择百度或 Google
 */
async function translateStep(text, sourceLang, targetLang, baiduConfig) {
  if (baiduConfig) {
    try {
      return await baiduTranslate(text, toBaiduCode(sourceLang), toBaiduCode(targetLang), baiduConfig);
    } catch (error) {
      console.error(`[乱翻译] 百度单步失败 ${sourceLang}->${targetLang}:`, error.message);
      // 继续尝试 Google
    }
  }

  try {
    return await googleTranslateStep(text, sourceLang, targetLang);
  } catch (error) {
    console.error(`[乱翻译] Google 单步失败 ${sourceLang}->${targetLang}:`, error.message);
    throw error;
  }
}

/**
 * 批量翻译：顺序处理，逐个返回结果
 */
async function translateBatch(texts, chains) {
  const results = [];
  for (const text of texts) {
    try {
      const result = await chainTranslate(text, chains);
      results.push(result);
    } catch (error) {
      console.error('[乱翻译] 批量中单条失败:', error.message);
      results.push({ error: error.message });
    }
    // QPS 保护：每处理完一段后稍等，避免触发百度频率限制
    await sleep(100);
  }
  return results;
}

export function initApiHandler() {
  // 保留 sendMessage 用于简单的 ping / popup 状态广播等短响应
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ ok: true, version: '1.0.0-connect' });
      return false;
    }
    return false;
  });

  // 使用长连接处理翻译等耗时任务，避免 MV3 Service Worker 响应丢失
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'immersive-mistranslation') return;

    console.log('[乱翻译] 建立长连接');

    port.onMessage.addListener(async (message) => {
      const { requestId, action } = message;
      if (!requestId) return;

      if (action === 'translateBatch') {
        const { texts, chains } = message;
        console.log('[乱翻译] 长连接收到批量翻译请求，文本数:', texts?.length, '链路数:', chains?.length);

        if (!Array.isArray(texts) || !Array.isArray(chains)) {
          port.postMessage({
            requestId,
            response: { success: false, error: 'Missing texts or chains' }
          });
          return;
        }

        try {
          const results = await translateBatch(texts, chains);
          const successCount = results.filter(r => typeof r === 'string').length;
          console.log('[乱翻译] 批量翻译完成，成功:', successCount, '/', texts.length);
          port.postMessage({
            requestId,
            response: { success: true, results }
          });
        } catch (error) {
          console.error('[乱翻译] 批量翻译失败:', error);
          port.postMessage({
            requestId,
            response: { success: false, error: error.message || 'Translation batch failed' }
          });
        }
        return;
      }

      // 未知 action
      port.postMessage({
        requestId,
        response: { success: false, error: `Unknown action: ${action}` }
      });
    });

    port.onDisconnect.addListener(() => {
      console.log('[乱翻译] 长连接断开');
    });
  });
}
