/**
 * 共享常量与默认配置
 */

// 默认翻译后端与回退顺序
export const DEFAULT_BACKEND_ID = 'google';
export const BACKEND_FALLBACK_ORDER = ['google', 'baidu'];

// 新版默认单链路（中 -> 英 -> 芬兰语 -> 越南语 -> 中）
export const DEFAULT_CHAIN = [
  { from: 'zh-CN', to: 'en', backendId: 'google' },
  { from: 'en', to: 'fi', backendId: 'google' },
  { from: 'fi', to: 'vi', backendId: 'google' },
  { from: 'vi', to: 'zh-CN', backendId: 'google' },
];

// 旧版多链路兜底（保留兼容，内容脚本已改用 DEFAULT_CHAIN）
export const TRANSLATION_CHAINS = [
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

export const CACHE_KEY_PREFIX = 'mistranslation_cache_';
export const MIN_TEXT_LENGTH = 1;

// 翻译模式
export const TRANSLATION_MODES = {
  CHAIN: 'chain',
  LLM: 'llm'
};
export const DEFAULT_TRANSLATION_MODE = TRANSLATION_MODES.CHAIN;

// 大模型默认配置（OpenAI 兼容接口）
export const DEFAULT_LLM_SYSTEM_PROMPT = `你是一个“无厘头乱译引擎”。用户会给你一段文本，你要把它模拟经过 {maxRounds} 次不同语言之间的随机来回翻译。

规则：
1. 每次转换都要故意偏离原意一点，允许：词义替换、夸大、缩略、断章取义、加入网络梗、改变语序。
2. 经过 {maxRounds} 轮随机语言转换后，最终用中文输出。
3. 只输出最终的中文结果，不要解释，不要输出中间过程，不要添加额外说明，不要加引号。`;

export const DEFAULT_LLM_CONFIG = {
  apiKey: '',
  model: 'gpt-4o-mini',
  apiBase: 'https://api.openai.com/v1',
  systemPrompt: DEFAULT_LLM_SYSTEM_PROMPT,
  temperature: 0.9,
  maxRounds: 20
};

// 大模型模式下的默认链路（单步：直接交给 OpenAI 后端内部模拟多次回译）
export const DEFAULT_LLM_CHAIN = [
  { from: 'zh-CN', to: 'zh-CN', backendId: 'openai' }
];
export const IGNORED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'CODE', 'PRE'
]);

// 分块翻译配置
export const CHUNK_SIZE = 5;
export const CHUNK_RETRY_DELAY = 500;
export const INTER_CHUNK_DELAY = 200;
export const CHUNK_TIMEOUT = 60000;

// 页面内进度浮层 ID
export const CONTAINER_ID = 'immersive-mistranslation-progress';
