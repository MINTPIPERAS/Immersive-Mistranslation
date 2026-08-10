/**
 * 沉浸式乱翻译 - 内容脚本入口（模块化）
 *
 * 默认翻译链路：中文（zh-CN） → 英文（en） → 芬兰语（fi） → 越南语（vi） → 中文（zh-CN）
 */
import { Translator } from './translator.js';
import { restoreAll, hasBackup } from './dom-patcher.js';
import { showProgress, hideProgress } from './progress-ui.js';
import { updatePopupStatus } from '../shared/message-bus.js';

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
