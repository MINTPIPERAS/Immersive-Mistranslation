/**
 * 页面内翻译调度器
 */
import {
  DEFAULT_CHAIN,
  DEFAULT_LLM_CHAIN,
  TRANSLATION_MODES,
  CACHE_KEY_PREFIX,
  CHUNK_SIZE,
  CHUNK_RETRY_DELAY,
  INTER_CHUNK_DELAY,
  CHUNK_TIMEOUT
} from '../shared/constants.js';
import { Storage } from '../shared/storage.js';
import { sendToBackground } from '../shared/message-bus.js';
import { extractTextNodes } from './text-extractor.js';
import { backup, apply, originalTexts } from './dom-patcher.js';

async function getActiveChain() {
  const config = await Storage.get('mistranslationConfig', {});
  if (config.translationMode === TRANSLATION_MODES.LLM) {
    return DEFAULT_LLM_CHAIN;
  }
  return DEFAULT_CHAIN;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getCacheKey(text) {
  return CACHE_KEY_PREFIX + text;
}

export async function translateBatch(texts, timeoutMs = CHUNK_TIMEOUT) {
  if (texts.length === 0) return [];

  const chain = await getActiveChain();

  console.log('[乱翻译] 发送批量翻译请求，文本数:', texts.length);
  const response = await sendToBackground('translateBatch', {
    texts,
    chain
  }, timeoutMs);

  console.log('[乱翻译] background 批量响应:', response);

  if (!response) {
    throw new Error('BACKGROUND_NO_RESPONSE: background 未返回数据，请尝试重新加载扩展或重启浏览器');
  }

  if (!response.success) {
    throw new Error(response.error || 'Translation batch failed');
  }

  if (!Array.isArray(response.results) || response.results.length !== texts.length) {
    throw new Error('BATCH_RESPONSE_MISMATCH: 批量翻译返回结果数量不匹配');
  }

  return response.results;
}

export async function translateChunk(items) {
  const texts = items.map(item => item.text);
  const results = await translateBatch(texts);

  results.forEach((result, index) => {
    const item = items[index];
    if (result && typeof result === 'string') {
      Storage.set(getCacheKey(item.text), result).catch(() => {});
      item.nodes.forEach(node => apply(node, result));
    }
  });

  return results;
}

export async function translateItemsInChunks(items, onStatus, startingCount, totalCount) {
  let successCount = 0;
  let failureCount = 0;
  const errors = new Set();
  let processed = 0;
  const totalChunks = Math.ceil(items.length / CHUNK_SIZE);

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    const currentDone = startingCount + processed;
    const progress = totalCount > 0 ? Math.round((currentDone / totalCount) * 100) : 0;

    onStatus(`翻译中 (${currentDone}/${totalCount})`, progress);

    try {
      const results = await translateChunk(chunk);
      results.forEach((result) => {
        if (result && typeof result === 'string') {
          successCount++;
        } else {
          failureCount++;
          if (result && result.error) errors.add(result.error);
        }
      });
    } catch (error) {
      console.error(`[乱翻译] chunk ${chunkIndex}/${totalChunks} 失败:`, error.message);

      // 拆半重试
      if (chunk.length > 1) {
        console.log('[乱翻译] 尝试拆半重试...');
        await sleep(CHUNK_RETRY_DELAY);
        const mid = Math.ceil(chunk.length / 2);
        const retryItems = chunk.slice(0, mid);
        retryItems.push(...chunk.slice(mid));
        const retryResult = await translateItemsInChunks(retryItems, () => {}, currentDone, totalCount);
        successCount += retryResult.successCount;
        failureCount += retryResult.failureCount;
        retryResult.errors.forEach(e => errors.add(e));
      } else {
        failureCount += chunk.length;
        errors.add(error.message);
      }
    }

    processed += chunk.length;

    if (i + CHUNK_SIZE < items.length) {
      await sleep(INTER_CHUNK_DELAY);
    }
  }

  return { successCount, failureCount, errors: Array.from(errors) };
}

export function deduplicate(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const text = node.textContent.trim();
    if (!map.has(text)) {
      map.set(text, []);
    }
    map.get(text).push(node);
  }
  return Array.from(map.entries()).map(([text, nodes]) => ({ text, nodes }));
}

export const Translator = {
  async translatePage(onStatus = () => {}) {
    onStatus('提取文本中...', 10);
    const nodes = extractTextNodes(document.body);
    nodes.forEach(node => backup(node));

    const items = deduplicate(nodes);
    if (items.length === 0) {
      return { successCount: 0, failureCount: 0, errors: [], empty: true };
    }

    onStatus(`发现 ${items.length} 段待翻译文本...`, 20);

    // 先查缓存
    const uncachedItems = [];
    let successCount = 0;
    for (const item of items) {
      const cached = await Storage.get(getCacheKey(item.text));
      if (cached) {
        item.nodes.forEach(node => apply(node, cached));
        successCount++;
      } else {
        uncachedItems.push(item);
      }
    }

    if (uncachedItems.length === 0) {
      onStatus('全部从缓存恢复', 100);
      return { successCount, failureCount: 0, errors: [], empty: false };
    }

    const totalChunks = Math.ceil(uncachedItems.length / CHUNK_SIZE);
    onStatus(`准备分批翻译：${uncachedItems.length} 段 / ${totalChunks} 批...`, 30);

    const chunkResult = await translateItemsInChunks(uncachedItems, onStatus, successCount, items.length);
    successCount += chunkResult.successCount;
    const failureCount = chunkResult.failureCount;
    const errors = chunkResult.errors;

    onStatus('应用翻译结果...', 95);

    return {
      successCount,
      failureCount,
      errors: errors.slice(0, 3),
      empty: false
    };
  }
};
