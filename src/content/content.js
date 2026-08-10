/**
 * 沉浸式乱翻译 - 内容脚本（单一内联文件）
 * 
 * 当前翻译链路（主链路）：
 *   中文（zh-CN） → 英文（en） → 芬兰语（fi） → 越南语（vi） → 中文（zh-CN）
 * 
 * 采用单一文件是为了兼容 content script 的加载稳定性。
 * 后续迁移 Vite 时可拆分为模块。
 */

// ===== 常量 =====
const TRANSLATION_CHAINS = [
  // 主链路：中 → 英 → 芬兰语 → 越南语 → 中（语言距离远，效果最乱）
  [
    { source: 'zh-CN', target: 'en' },
    { source: 'en', target: 'fi' },
    { source: 'fi', target: 'vi' },
    { source: 'vi', target: 'zh-CN' }
  ],
  // 兜底 1：中 → 英 → 芬兰语 → 日 → 中
  [
    { source: 'zh-CN', target: 'en' },
    { source: 'en', target: 'fi' },
    { source: 'fi', target: 'ja' },
    { source: 'ja', target: 'zh-CN' }
  ],
  // 兜底 2：中 → 英 → 俄 → 日 → 中
  [
    { source: 'zh-CN', target: 'en' },
    { source: 'en', target: 'ru' },
    { source: 'ru', target: 'ja' },
    { source: 'ja', target: 'zh-CN' }
  ],
  // 兜底 3：原链路 中 → 英 → 日 → 中
  [
    { source: 'zh-CN', target: 'en' },
    { source: 'en', target: 'ja' },
    { source: 'ja', target: 'zh-CN' }
  ]
];

const CACHE_KEY_PREFIX = 'mistranslation_cache_';
const MIN_TEXT_LENGTH = 1;
const IGNORED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'CODE', 'PRE'
]);

// 分块翻译配置
const CHUNK_SIZE = 8;
const CHUNK_RETRY_DELAY = 500;
const INTER_CHUNK_DELAY = 200;
const CHUNK_TIMEOUT = 60000;

// ===== Storage 封装 =====
const Storage = {
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

// ===== 工具函数 =====
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 消息通信（使用 chrome.runtime.connect 长连接，避免 MV3 Service Worker 响应丢失）=====
let backgroundPort = null;
const pendingRequests = new Map();

function ensurePort() {
  if (!backgroundPort) {
    try {
      backgroundPort = chrome.runtime.connect({ name: 'immersive-mistranslation' });

      backgroundPort.onMessage.addListener((message) => {
        const { requestId, response, error } = message;
        const pending = pendingRequests.get(requestId);
        if (!pending) return;

        pendingRequests.delete(requestId);
        clearTimeout(pending.timer);

        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(response);
        }
      });

      backgroundPort.onDisconnect.addListener(() => {
        const hasPending = pendingRequests.size > 0;
        const errorMsg = chrome.runtime.lastError?.message || '未知原因';

        if (hasPending) {
          console.error('[乱翻译] background port 异常断开:', errorMsg);
          for (const [requestId, pending] of pendingRequests) {
            pending.reject(new Error(`BACKGROUND_PORT_DISCONNECTED: ${errorMsg}`));
          }
          pendingRequests.clear();
        } else {
          console.log('[乱翻译] background port 空闲断开，下次使用会自动重建');
        }
        backgroundPort = null;
      });
    } catch (error) {
      console.error('[乱翻译] 创建 background port 失败:', error);
      backgroundPort = null;
    }
  }
  return backgroundPort;
}

function sendToBackground(action, payload = {}, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const port = ensurePort();

    if (!port) {
      reject(new Error('BACKGROUND_PORT_UNAVAILABLE: 无法连接到 background'));
      return;
    }

    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('BACKGROUND_TIMEOUT: background 响应超时'));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timer });

    try {
      port.postMessage({ requestId, action, ...payload });
    } catch (error) {
      clearTimeout(timer);
      pendingRequests.delete(requestId);
      reject(new Error('BACKGROUND_POST_FAILED: 无法发送消息到 background'));
    }
  });
}

function updatePopupStatus(message, progress = null) {
  // popup 状态更新仍使用 sendMessage，因为 popup 是临时页面，port 连接不便保持
  chrome.runtime.sendMessage({
    action: 'updateStatus',
    message,
    progress
  }).catch(() => {
    // popup 未打开时忽略
  });
}

// ===== 文本提取 =====
function isIgnoredElement(element) {
  if (!element) return true;
  // 排除插件自己的进度浮层及其内部元素
  if (element.closest && element.closest('#immersive-mistranslation-progress')) {
    return true;
  }
  const tag = element.tagName;
  if (IGNORED_TAGS.has(tag)) return true;
  if (element.isContentEditable) return true;
  const inputTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
  if (inputTags.includes(tag)) return true;
  return false;
}

function isVisibleElement(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  return true;
}

function extractTextNodes(root = document.body) {
  const nodes = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.textContent;
        if (!text || !text.trim() || text.trim().length < MIN_TEXT_LENGTH) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }
        if (isIgnoredElement(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!isVisibleElement(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let current;
  while ((current = walker.nextNode())) {
    nodes.push(current);
  }
  return nodes;
}

// ===== DOM 补丁 =====
const originalTexts = new Map();

function backup(node) {
  if (!originalTexts.has(node)) {
    originalTexts.set(node, node.textContent);
  }
  return originalTexts.get(node);
}

function apply(node, text) {
  if (node && node.textContent !== text) {
    node.textContent = text;
  }
}

function restoreAll() {
  for (const [node, original] of originalTexts) {
    if (node && node.parentNode) {
      node.textContent = original;
    }
  }
  originalTexts.clear();
}

function hasBackup() {
  return originalTexts.size > 0;
}

// ===== 翻译调度 =====
function getCacheKey(text) {
  return CACHE_KEY_PREFIX + text;
}

async function translateBatch(texts, timeoutMs = CHUNK_TIMEOUT) {
  if (texts.length === 0) return [];

  console.log('[乱翻译] 发送批量翻译请求，文本数:', texts.length);
  const response = await sendToBackground('translateBatch', {
    texts,
    chains: TRANSLATION_CHAINS
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

async function translateChunk(items) {
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

async function translateItemsInChunks(items, onStatus, startingCount, totalCount) {
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

function deduplicate(nodes) {
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

const Translator = {
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

// ===== 页面内进度浮层 =====
const CONTAINER_ID = 'immersive-mistranslation-progress';

function createProgressContainer() {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.className = 'immersive-mt-progress';
    el.innerHTML = `
      <div class="immersive-mt-bar"></div>
      <span class="immersive-mt-text">准备就绪</span>
    `;
    document.body.appendChild(el);
  }
  return el;
}

function showProgress(message, progress = null) {
  const el = createProgressContainer();
  const textEl = el.querySelector('.immersive-mt-text');
  const barEl = el.querySelector('.immersive-mt-bar');
  textEl.textContent = message;
  if (progress !== null && progress >= 0) {
    barEl.style.width = `${progress}%`;
  }
  el.style.display = 'block';
}

function hideProgress() {
  const el = document.getElementById(CONTAINER_ID);
  if (el) {
    el.style.display = 'none';
  }
}

// ===== 入口 =====
let isTranslating = false;

function updateStatus(message, progress = null) {
  updatePopupStatus(message, progress);
  showProgress(message, progress);
}

async function startTranslation() {
  if (isTranslating) return;
  isTranslating = true;

  try {
    const result = await Translator.translatePage((message, progress) => {
      updateStatus(message, progress);
    });

    if (result.empty) {
      updateStatus('⚠️ 未找到可翻译文本');
    } else if (result.failureCount === 0) {
      updateStatus('✅ 翻译完成！', 100);
    } else if (result.successCount === 0) {
      const errorInfo = result.errors.join('; ') || 'API 请求失败';
      updateStatus(`❌ 全部翻译失败: ${errorInfo}`);
    } else {
      updateStatus(`⚠️ 部分成功 (${result.successCount}/${result.successCount + result.failureCount})`);
    }
  } catch (error) {
    console.error('翻译流程出错:', error);
    updateStatus(`❌ 翻译失败: ${error.message}`);
  } finally {
    isTranslating = false;
  }
}

function restorePage() {
  restoreAll();
  updateStatus('↩️ 已恢复原文', 0);
  setTimeout(() => hideProgress(), 1500);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startTranslation') {
    startTranslation();
    sendResponse({ ok: true });
  } else if (request.action === 'restorePage') {
    restorePage();
    sendResponse({ ok: true });
  } else if (request.action === 'getStatus') {
    sendResponse({ translated: hasBackup(), isTranslating });
  }
  return true;
});
