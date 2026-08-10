export { TranslatorBackend } from './translator-backend.js';
import { BaiduBackend } from './baidu.js';
import { GoogleBackend } from './google.js';
import { DeepLBackend } from './deepl.js';
import { OpenAIBackend } from './openai.js';
import { DeepLXBackend } from './deep-lx.js';

const BACKENDS = [
  new BaiduBackend(),
  new GoogleBackend(),
  new DeepLBackend(),
  new OpenAIBackend(),
  new DeepLXBackend(),
];

const BACKEND_MAP = Object.fromEntries(BACKENDS.map(b => [b.id, b]));

export function getBackend(id) {
  return BACKEND_MAP[id] || null;
}

export function listBackends() {
  return BACKENDS.map(b => ({
    id: b.id,
    name: b.name,
    requiresApiKey: b.requiresApiKey,
    defaultConfig: b.defaultConfig,
  }));
}

export async function translateWithBackend(id, text, fromLang, toLang, config) {
  const backend = getBackend(id);
  if (!backend) throw new Error(`未知后端: ${id}`);
  backend.validateConfig(config);
  return backend.translate(text, fromLang, toLang, config);
}
