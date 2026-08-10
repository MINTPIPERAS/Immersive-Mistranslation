const translateBtn = document.getElementById('translateBtn');
const restoreBtn = document.getElementById('restoreBtn');
const statusEl = document.getElementById('status');
const progressBarEl = document.getElementById('progressBar');

const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const baiduAppIdInput = document.getElementById('baiduAppId');
const baiduKeyInput = document.getElementById('baiduKey');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const clearSettingsBtn = document.getElementById('clearSettingsBtn');
const settingsStatusEl = document.getElementById('settingsStatus');
const chainInfoEl = document.getElementById('chainInfo');

let isTranslated = false;

// 当前翻译链路展示（需与 src/content/content.js 中的 TRANSLATION_CHAINS 主链路保持一致）
const CURRENT_CHAIN_LABEL = '中 → 英 → 芬兰语 → 越南语 → 中';

function updateStatus(message, progress = null) {
  statusEl.textContent = message;
  if (progress !== null && progress >= 0) {
    progressBarEl.style.width = `${progress}%`;
  }
}

function updateUI(translated) {
  isTranslated = translated;
  if (isTranslated) {
    translateBtn.textContent = '已乱翻译';
    translateBtn.disabled = true;
    restoreBtn.disabled = false;
    updateStatus('当前页面已乱翻译');
  } else {
    translateBtn.textContent = '开始乱翻译';
    translateBtn.disabled = false;
    restoreBtn.disabled = true;
    updateStatus('准备就绪');
  }
}

function sendToActiveTab(action, payload = {}, callback = () => {}) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      updateStatus('未找到活动标签页');
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { action, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus('无法与页面通信，请刷新后重试');
        return;
      }
      callback(response);
    });
  });
}

translateBtn.addEventListener('click', () => {
  updateStatus('翻译中...', 0);
  sendToActiveTab('startTranslation');
});

restoreBtn.addEventListener('click', () => {
  updateStatus('恢复中...');
  sendToActiveTab('restorePage');
});

// 监听来自 content script 的状态更新
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStatus') {
    updateStatus(request.message, request.progress ?? null);
    if (request.message && request.message.includes('翻译完成')) {
      updateUI(true);
    } else if (request.message && request.message.includes('已恢复原文')) {
      updateUI(false);
    }
  }
  sendResponse();
  return true;
});

// 打开 popup 时查询当前页面状态
sendToActiveTab('getStatus', {}, (response) => {
  if (response && typeof response.translated === 'boolean') {
    updateUI(response.translated);
  }
});

// ===== 设置面板 =====

function showSettingsStatus(message, isError = false) {
  settingsStatusEl.textContent = message;
  settingsStatusEl.className = 'settings-status ' + (isError ? 'error' : 'success');
}

function loadSettings() {
  chrome.storage.local.get(['baidu_appid', 'baidu_key'], (result) => {
    if (result.baidu_appid) {
      baiduAppIdInput.value = result.baidu_appid;
    }
    if (result.baidu_key) {
      baiduKeyInput.value = result.baidu_key;
    }

    if (result.baidu_appid && result.baidu_key) {
      showSettingsStatus('已配置百度翻译 API');
    } else {
      showSettingsStatus('尚未配置百度翻译 API', true);
    }
  });
}

function saveSettings() {
  const appid = baiduAppIdInput.value.trim();
  const key = baiduKeyInput.value.trim();

  if (!appid || !key) {
    showSettingsStatus('请输入 App ID 和 Secret Key', true);
    return;
  }

  chrome.storage.local.set({ baidu_appid: appid, baidu_key: key }, () => {
    showSettingsStatus('保存成功');
  });
}

function clearSettings() {
  chrome.storage.local.remove(['baidu_appid', 'baidu_key'], () => {
    baiduAppIdInput.value = '';
    baiduKeyInput.value = '';
    showSettingsStatus('已清除配置', true);
  });
}

toggleSettingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
  toggleSettingsBtn.textContent = settingsPanel.classList.contains('hidden')
    ? '翻译设置'
    : '收起设置';
});

saveSettingsBtn.addEventListener('click', saveSettings);
clearSettingsBtn.addEventListener('click', clearSettings);

function pingBackground(callback = () => {}) {
  chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
    if (chrome.runtime.lastError) {
      updateStatus('后台通信异常，请重新加载扩展');
      callback(false);
      return;
    }
    console.log('[乱翻译] ping background:', response);
    callback(true, response);
  });
}

// 打开 popup 时先 ping 后台
pingBackground((ok, response) => {
  if (ok) {
    console.log('[乱翻译] 后台通信正常');
  }
});

// 初始化
chainInfoEl.textContent = `当前链路：${CURRENT_CHAIN_LABEL}`;
loadSettings();
