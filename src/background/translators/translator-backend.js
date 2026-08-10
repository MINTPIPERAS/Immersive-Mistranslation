/**
 * 翻译后端抽象基类
 */
export class TranslatorBackend {
  constructor() {
    if (new.target === TranslatorBackend) {
      throw new TypeError('Cannot instantiate TranslatorBackend directly');
    }
  }

  // 唯一标识，如 'baidu'、'google'
  get id() { throw new Error('not implemented'); }
  // 人类可读名称，如 '百度翻译'
  get name() { throw new Error('not implemented'); }
  // 是否需要 API Key
  get requiresApiKey() { return false; }
  // 默认配置字段
  get defaultConfig() { return {}; }
  // 单次最大文本长度
  get maxTextLength() { return 5000; }

  validateConfig(config) {
    if (this.requiresApiKey && !config?.apiKey) {
      throw new Error(`${this.name} 需要 API Key`);
    }
    return true;
  }

  async translate(text, fromLang, toLang, config) {
    throw new Error('not implemented');
  }
}
