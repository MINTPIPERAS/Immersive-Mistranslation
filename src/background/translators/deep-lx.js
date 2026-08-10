/**
 * DeepLX 翻译后端占位
 */
import { TranslatorBackend } from './translator-backend.js';

export class DeepLXBackend extends TranslatorBackend {
  get id() { return 'deepLx'; }
  get name() { return 'DeepLX'; }
  get requiresApiKey() { return false; }
  get defaultConfig() { return { endpoint: '' }; }
  get maxTextLength() { return 5000; }

  async translate() {
    throw new Error('DeepLX 后端尚未实现');
  }
}
