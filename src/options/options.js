import { Storage } from '../shared/storage.js';
import {
  CACHE_KEY_PREFIX,
  DEFAULT_BACKEND_ID,
  DEFAULT_CHAIN,
  DEFAULT_LLM_CONFIG,
  TRANSLATION_MODES
} from '../shared/constants.js';

const CONFIG_KEY = 'mistranslationConfig';

const UNIMPLEMENTED_BACKENDS = new Set(['deepl', 'deepLx']);

const LANGUAGES = [
  { code: 'zh-CN', name: '中文' },
  { code: 'zh-TW', name: '繁体中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fi', name: '芬兰语' },
  { code: 'vi', name: '越南语' },
  { code: 'ru', name: '俄语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'es', name: '西班牙语' },
  { code: 'it', name: '意大利语' },
  { code: 'pt', name: '葡萄牙语' },
  { code: 'ar', name: '阿拉伯语' },
  { code: 'th', name: '泰语' },
  { code: 'nl', name: '荷兰语' },
  { code: 'pl', name: '波兰语' },
  { code: 'bg', name: '保加利亚语' },
  { code: 'ca', name: '加泰罗尼亚语' },
  { code: 'cs', name: '捷克语' },
  { code: 'da', name: '丹麦语' },
  { code: 'el', name: '希腊语' },
  { code: 'et', name: '爱沙尼亚语' },
  { code: 'hu', name: '匈牙利语' },
  { code: 'ro', name: '罗马尼亚语' },
  { code: 'sk', name: '斯洛伐克语' },
  { code: 'sl', name: '斯洛文尼亚语' },
  { code: 'sv', name: '瑞典语' },
];

const FALLBACK_BACKENDS = [
  { id: 'baidu', name: '百度翻译', requiresApiKey: true, defaultConfig: { appId: '', apiKey: '' } },
  { id: 'google', name: 'Google 翻译', requiresApiKey: false, defaultConfig: {} },
  { id: 'deepl', name: 'DeepL 翻译', requiresApiKey: true, defaultConfig: { apiKey: '' } },
  { id: 'openai', name: '大模型乱译 (OpenAI 兼容)', requiresApiKey: true, defaultConfig: { ...DEFAULT_LLM_CONFIG } },
  { id: 'deepLx', name: 'DeepLX', requiresApiKey: false, defaultConfig: { endpoint: '' } },
];

const DEFAULT_CONFIG = {
  defaultBackendId: DEFAULT_BACKEND_ID,
  translationMode: TRANSLATION_MODES.CHAIN,
  backendConfig: {
    baidu: { appId: '', apiKey: '' },
    deepl: { apiKey: '' },
    openai: { ...DEFAULT_LLM_CONFIG },
    deepLx: { endpoint: '' },
  },
  chain: DEFAULT_CHAIN,
};

let state = {
  ...DEFAULT_CONFIG,
  backendConfig: { ...DEFAULT_CONFIG.backendConfig },
  chain: DEFAULT_CONFIG.chain.map(s => ({ ...s }))
};
let backends = [];
let selectedBackendTab = null;

function loadBackends() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'listBackends' }, (response) => {
      if (response && response.success) {
        resolve(response.backends);
      } else {
        resolve(FALLBACK_BACKENDS);
      }
    });
  });
}

async function loadConfig() {
  const stored = await Storage.get(CONFIG_KEY, {});
  state.defaultBackendId = stored.defaultBackendId || DEFAULT_CONFIG.defaultBackendId;
  state.translationMode = stored.translationMode || DEFAULT_CONFIG.translationMode;
  state.backendConfig = {
    ...DEFAULT_CONFIG.backendConfig,
    ...(stored.backendConfig || {}),
  };
  state.chain = (stored.chain && stored.chain.length > 0) ? stored.chain.map(s => ({ ...s })) : DEFAULT_CONFIG.chain.map(s => ({ ...s }));

  for (const b of backends) {
    if (!state.backendConfig[b.id]) {
      state.backendConfig[b.id] = { ...b.defaultConfig };
    }
  }
}

async function loadCacheCount() {
  const all = await new Promise((resolve) => {
    chrome.storage.local.get(null, resolve);
  });
  const count = Object.keys(all).filter(k => k.startsWith(CACHE_KEY_PREFIX)).length;
  document.getElementById('cacheCount').textContent = count;
}

function renderDefaultBackend() {
  const select = document.getElementById('defaultBackend');
  select.innerHTML = '';
  for (const b of backends) {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name;
    if (b.id === state.defaultBackendId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    state.defaultBackendId = select.value;
  });
}

function getFieldType(fieldName) {
  if (fieldName === 'apiKey' || fieldName === 'appId') return 'password';
  if (fieldName === 'endpoint' || fieldName === 'apiBase') return 'url';
  if (fieldName === 'systemPrompt') return 'textarea';
  if (fieldName === 'temperature') return 'range';
  if (fieldName === 'maxRounds') return 'number';
  return 'text';
}

function getFieldLabel(fieldName) {
  const labels = {
    appId: 'App ID',
    apiKey: 'API Key',
    secretKey: 'Secret Key',
    model: '模型',
    apiBase: 'API Base URL',
    endpoint: '端点地址',
    systemPrompt: '系统提示词',
    temperature: '随机性 (temperature)',
    maxRounds: '模拟来回翻译次数'
  };
  return labels[fieldName] || fieldName;
}

function renderBackendTabs() {
  const tabsEl = document.getElementById('backendTabs');
  tabsEl.innerHTML = '';
  for (const b of backends) {
    const btn = document.createElement('button');
    btn.className = 'backend-tab';
    btn.textContent = b.name + (UNIMPLEMENTED_BACKENDS.has(b.id) ? ' (未实现)' : '');
    btn.dataset.backendId = b.id;
    btn.addEventListener('click', () => {
      selectBackendTab(b.id);
    });
    tabsEl.appendChild(btn);
  }
  if (backends.length > 0) {
    selectBackendTab(backends[0].id);
  }
}

function selectBackendTab(backendId) {
  selectedBackendTab = backendId;
  const tabs = document.querySelectorAll('.backend-tab');
  tabs.forEach(t => {
    t.classList.toggle('active', t.dataset.backendId === backendId);
  });
  renderBackendConfigForm(backendId);
}

function renderBackendConfigForm(backendId) {
  const b = backends.find(b => b.id === backendId);
  if (!b) return;
  const cfg = state.backendConfig[backendId] || {};
  const configEl = document.getElementById('backendConfig');
  configEl.innerHTML = '';

  if (UNIMPLEMENTED_BACKENDS.has(backendId)) {
    const notice = document.createElement('div');
    notice.className = 'notice-bar';
    notice.textContent = '该后端尚未实现，配置将保存以备用。';
    configEl.appendChild(notice);
  }

  const fields = Object.keys(b.defaultConfig);
  if (fields.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-config';
    empty.textContent = '此后端无需额外配置';
    configEl.appendChild(empty);
    return;
  }

  const fieldsDiv = document.createElement('div');
  fieldsDiv.className = 'config-fields';

  for (const fieldName of fields) {
    const group = document.createElement('div');
    group.className = 'field-group';

    const label = document.createElement('label');
    label.textContent = getFieldLabel(fieldName);
    group.appendChild(label);

    const fieldType = getFieldType(fieldName);

    if (fieldType === 'password') {
      const wrapper = document.createElement('div');
      wrapper.className = 'input-wrapper';

      const input = document.createElement('input');
      input.type = 'password';
      input.value = cfg[fieldName] || '';
      input.dataset.backendId = backendId;
      input.dataset.field = fieldName;
      input.addEventListener('input', () => {
        if (!state.backendConfig[backendId]) {
          state.backendConfig[backendId] = {};
        }
        state.backendConfig[backendId][fieldName] = input.value;
      });
      wrapper.appendChild(input);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'toggle-password';
      toggle.textContent = '👁';
      toggle.title = '显示/隐藏';
      toggle.addEventListener('click', () => {
        if (input.type === 'password') {
          input.type = 'text';
          toggle.textContent = '🙈';
        } else {
          input.type = 'password';
          toggle.textContent = '👁';
        }
      });
      wrapper.appendChild(toggle);
      group.appendChild(wrapper);
    } else if (fieldType === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.rows = 8;
      textarea.value = cfg[fieldName] || '';
      textarea.dataset.backendId = backendId;
      textarea.dataset.field = fieldName;
      textarea.addEventListener('input', () => {
        if (!state.backendConfig[backendId]) {
          state.backendConfig[backendId] = {};
        }
        state.backendConfig[backendId][fieldName] = textarea.value;
      });
      group.appendChild(textarea);
    } else if (fieldType === 'range') {
      const rangeWrapper = document.createElement('div');
      rangeWrapper.className = 'range-wrapper';

      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '2';
      input.step = '0.1';
      input.value = typeof cfg[fieldName] === 'number' ? cfg[fieldName] : 0.9;
      input.dataset.backendId = backendId;
      input.dataset.field = fieldName;

      const valueLabel = document.createElement('span');
      valueLabel.className = 'range-value';
      valueLabel.textContent = input.value;

      input.addEventListener('input', () => {
        valueLabel.textContent = input.value;
        if (!state.backendConfig[backendId]) {
          state.backendConfig[backendId] = {};
        }
        state.backendConfig[backendId][fieldName] = parseFloat(input.value);
      });

      rangeWrapper.appendChild(input);
      rangeWrapper.appendChild(valueLabel);
      group.appendChild(rangeWrapper);
    } else if (fieldType === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = '100';
      input.value = typeof cfg[fieldName] === 'number' ? cfg[fieldName] : 20;
      input.dataset.backendId = backendId;
      input.dataset.field = fieldName;
      input.addEventListener('input', () => {
        if (!state.backendConfig[backendId]) {
          state.backendConfig[backendId] = {};
        }
        state.backendConfig[backendId][fieldName] = parseInt(input.value, 10) || 0;
      });
      group.appendChild(input);
    } else {
      const input = document.createElement('input');
      input.type = fieldType;
      input.value = cfg[fieldName] || '';
      input.dataset.backendId = backendId;
      input.dataset.field = fieldName;
      input.addEventListener('input', () => {
        if (!state.backendConfig[backendId]) {
          state.backendConfig[backendId] = {};
        }
        state.backendConfig[backendId][fieldName] = input.value;
      });
      group.appendChild(input);
    }

    fieldsDiv.appendChild(group);
  }

  configEl.appendChild(fieldsDiv);
}

function makeSelect(options, selectedValue, onChange) {
  const select = document.createElement('select');
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    if (opt.value === selectedValue) {
      el.selected = true;
    }
    select.appendChild(el);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function renderChainEditor() {
  const editor = document.getElementById('chainEditor');
  editor.innerHTML = '';

  const langOptions = LANGUAGES.map(l => ({ value: l.code, label: `${l.name} (${l.code})` }));
  const backendOptions = [
    { value: '', label: '默认后端' },
    ...backends.map(b => ({ value: b.id, label: b.name })),
  ];

  state.chain.forEach((step, index) => {
    const row = document.createElement('div');
    row.className = 'chain-step';

    const fromSelect = makeSelect(langOptions, step.from, (val) => {
      state.chain[index].from = val;
    });
    row.appendChild(fromSelect);

    const arrow = document.createElement('span');
    arrow.className = 'chain-arrow';
    arrow.textContent = '→';
    row.appendChild(arrow);

    const toSelect = makeSelect(langOptions, step.to, (val) => {
      state.chain[index].to = val;
    });
    row.appendChild(toSelect);

    const backendSelect = makeSelect(backendOptions, step.backendId || '', (val) => {
      state.chain[index].backendId = val || '';
    });
    row.appendChild(backendSelect);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-icon';
    removeBtn.textContent = '✕';
    removeBtn.title = '移除此步骤';
    removeBtn.disabled = state.chain.length <= 2;
    removeBtn.addEventListener('click', () => {
      if (state.chain.length <= 2) return;
      state.chain.splice(index, 1);
      renderChainEditor();
    });
    row.appendChild(removeBtn);

    editor.appendChild(row);
  });
}

function updateModeUI() {
  const chainCard = document.getElementById('chainCard');
  const modeHint = document.getElementById('modeHint');
  const addStepBtn = document.getElementById('addStepBtn');

  if (!chainCard || !modeHint) return;

  if (state.translationMode === TRANSLATION_MODES.LLM) {
    chainCard.classList.add('dimmed');
    modeHint.textContent = '大模型乱译模式下，翻译链路由单条 LLM prompt 完成，链路编辑器仅作备用';
    if (addStepBtn) addStepBtn.disabled = true;
  } else {
    chainCard.classList.remove('dimmed');
    modeHint.textContent = '链式回译模式下，每步按翻译链路执行';
    if (addStepBtn) addStepBtn.disabled = false;
  }
}

function renderModeSelector() {
  const radios = document.querySelectorAll('input[name="translationMode"]');
  radios.forEach(radio => {
    radio.checked = radio.value === state.translationMode;
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.translationMode = radio.value;
        updateModeUI();
      }
    });
  });
  updateModeUI();
}

function setStatus(msg, type) {
  const el = document.getElementById('saveStatus');
  el.textContent = msg;
  el.className = type || '';
  if (type) {
    setTimeout(() => {
      el.textContent = '';
      el.className = '';
    }, 3000);
  }
}

async function saveConfig() {
  try {
    const config = {
      defaultBackendId: state.defaultBackendId,
      translationMode: state.translationMode,
      backendConfig: state.backendConfig,
      chain: state.chain,
    };

    await Storage.set(CONFIG_KEY, config);

    for (const [backendId, cfg] of Object.entries(state.backendConfig)) {
      chrome.runtime.sendMessage({
        action: 'setBackendConfig',
        backendId,
        config: cfg,
      });
    }

    setStatus('保存成功', 'success');
  } catch (err) {
    console.error('保存失败:', err);
    setStatus('保存失败', 'error');
  }
}

async function resetConfig() {
  state.defaultBackendId = DEFAULT_CONFIG.defaultBackendId;
  state.translationMode = DEFAULT_CONFIG.translationMode;
  state.backendConfig = { ...DEFAULT_CONFIG.backendConfig };
  state.chain = DEFAULT_CONFIG.chain.map(s => ({ ...s }));

  renderDefaultBackend();
  renderModeSelector();
  selectBackendTab(selectedBackendTab || (backends[0] && backends[0].id));
  renderChainEditor();
  setStatus('已恢复默认', 'success');

  try {
    await Storage.set(CONFIG_KEY, DEFAULT_CONFIG);
    for (const [backendId, cfg] of Object.entries(DEFAULT_CONFIG.backendConfig)) {
      chrome.runtime.sendMessage({
        action: 'setBackendConfig',
        backendId,
        config: cfg,
      });
    }
  } catch (err) {
    console.error('重置失败:', err);
  }
}

async function clearCache() {
  const all = await new Promise((resolve) => {
    chrome.storage.local.get(null, resolve);
  });
  const keys = Object.keys(all).filter(k => k.startsWith(CACHE_KEY_PREFIX));
  if (keys.length > 0) {
    await new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve);
    });
  }
  await loadCacheCount();
  setStatus('缓存已清空', 'success');
}

async function init() {
  backends = await loadBackends();
  await loadConfig();
  await loadCacheCount();

  renderDefaultBackend();
  renderModeSelector();
  renderBackendTabs();
  renderChainEditor();

  document.getElementById('addStepBtn').addEventListener('click', () => {
    state.chain.push({ from: 'en', to: 'zh-CN', backendId: '' });
    renderChainEditor();
  });

  document.getElementById('saveBtn').addEventListener('click', saveConfig);
  document.getElementById('resetBtn').addEventListener('click', resetConfig);
  document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
}

document.addEventListener('DOMContentLoaded', init);
