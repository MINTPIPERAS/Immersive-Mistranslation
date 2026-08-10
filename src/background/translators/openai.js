/**
 * OpenAI 翻译后端占位
 */
import { TranslatorBackend } from './translator-backend.js';

export class OpenAIBackend extends TranslatorBackend {
  get id() { return 'openai'; }
  get name() { return 'OpenAI'; }
  get requiresApiKey() { return true; }
  get defaultConfig() { return { apiKey: '', model: 'gpt-4o-mini', apiBase: 'https://api.openai.com/v1' }; }
  get maxTextLength() { return 5000; }

  async translate() {
    throw new Error('OpenAI 后端尚未实现');
  }
}
