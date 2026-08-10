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
