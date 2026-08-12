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
const modeSelect = document.getElementById('modeSelect');
const llmStatusEl = document.getElementById('llmStatus');

const TRANSLATION_MODES = {
  CHAIN: 'chain',
  LLM: 'llm'
};

let isTranslated = false;
let currentConfig = null;

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

function getChainLabel(chain) {
  return chain.map(s => `${s.from} → ${s.to}`).join(' → ');
}

async function loadConfig() {
  const config = await new Promise((resolve) => {
    chrome.storage.local.get(['mistranslationConfig'], (result) => {
      resolve(result.mistranslationConfig || {});
    });
  });
  currentConfig = config;
  const mode = config.translationMode || TRANSLATION_MODES.CHAIN;
  modeSelect.value = mode;
  renderModeInfo(mode);
}

function getLlmConfig(config) {
  return config?.backendConfig?.openai || {};
}

function renderModeInfo(mode) {
  if (mode === TRANSLATION_MODES.LLM) {
    chainInfoEl.classList.add('hidden');
    llmStatusEl.classList.remove('hidden');
    const llmCfg = getLlmConfig(currentConfig);
    const hasKey = !!(llmCfg.apiKey && llmCfg.model && llmCfg.apiBase);
    if (hasKey) {
      llmStatusEl.textContent = `大模型模式：${llmCfg.model} · ${llmCfg.maxRounds || 20} 轮乱译`;
      llmStatusEl.classList.remove('warning');
    } else {
      llmStatusEl.textContent = '大模型模式未配置：请在选项页设置 API Key / 模型 / API Base';
      llmStatusEl.classList.add('warning');
    }
  } else {
    chainInfoEl.classList.remove('hidden');
    llmStatusEl.classList.add('hidden');
    const chain = currentConfig?.chain || [];
    chainInfoEl.textContent = chain.length
      ? `当前链路：${getChainLabel(chain)}`
      : `当前链路：中 → 英 → 芬兰语 → 越南语 → 中`;
  }
}

modeSelect.addEventListener('change', async () => {
  const mode = modeSelect.value;
  currentConfig = currentConfig || {};
  currentConfig.translationMode = mode;
  await new Promise((resolve) => {
    chrome.storage.local.set({ mistranslationConfig: currentConfig }, resolve);
  });
  renderModeInfo(mode);
});

translateBtn.addEventListener('click', () => {
  const mode = modeSelect.value;
  if (mode === TRANSLATION_MODES.LLM) {
    const llmCfg = getLlmConfig(currentConfig);
    if (!llmCfg.apiKey || !llmCfg.model || !llmCfg.apiBase) {
      updateStatus('⚠️ 请先配置大模型 API');
      return;
    }
  }
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
loadConfig();
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
  chrome.storage.local.get(['baidu_appid', 'baidu_key', 'mistranslationConfig'], (result) => {
    if (result.baidu_appid) {
      baiduAppIdInput.value = result.baidu_appid;
    }
    if (result.baidu_key) {
      baiduKeyInput.value = result.baidu_key;
    }

    // 如果新配置中也有百度密钥，优先显示
    const baiduCfg = result.mistranslationConfig?.backendConfig?.baidu;
    if (baiduCfg?.appId && baiduCfg?.apiKey) {
      baiduAppIdInput.value = baiduCfg.appId;
      baiduKeyInput.value = baiduCfg.apiKey;
    }

    if (baiduAppIdInput.value && baiduKeyInput.value) {
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
