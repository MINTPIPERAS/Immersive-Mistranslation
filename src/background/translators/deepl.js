/**
 * DeepL 翻译后端占位
 */
import { TranslatorBackend } from './translator-backend.js';

export class DeepLBackend extends TranslatorBackend {
  get id() { return 'deepl'; }
  get name() { return 'DeepL'; }
  get requiresApiKey() { return true; }
  get defaultConfig() { return { apiKey: '' }; }
  get maxTextLength() { return 5000; }

  async translate() {
    throw new Error('DeepL 后端尚未实现');
  }
}
