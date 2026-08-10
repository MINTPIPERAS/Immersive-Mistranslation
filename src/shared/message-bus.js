/**
 * 跨模块消息通信封装
 *
 * content script 使用 chrome.runtime.connect 长连接与 background 通信，
 * 避免 MV3 Service Worker 响应丢失；popup 状态仍使用 sendMessage 短消息。
 */

export let backgroundPort = null;
export const pendingRequests = new Map();

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

export function sendToBackground(action, payload = {}, timeoutMs = 60000) {
  async function attempt() {
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const port = ensurePort();

    if (!port) {
      throw new Error('BACKGROUND_PORT_UNAVAILABLE: 无法连接到 background');
    }

    return new Promise((resolve, reject) => {
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

  return attempt().catch(err => {
    if (err.message && err.message.includes('BACKGROUND_PORT_DISCONNECTED')) {
      console.log('[乱翻译] port 断开，首次自动重试...');
      return attempt();
    }
    throw err;
  });
}

export function updatePopupStatus(message, progress = null) {
  // popup 状态更新仍使用 sendMessage，因为 popup 是临时页面，port 连接不便保持
  chrome.runtime.sendMessage({
    action: 'updateStatus',
    message,
    progress
  }).catch(() => {
    // popup 未打开时忽略
  });
}
