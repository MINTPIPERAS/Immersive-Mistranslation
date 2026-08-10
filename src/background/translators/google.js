/**
 * Google 翻译后端（免费端点）
 */
import { TranslatorBackend } from './translator-backend.js';

const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';

function toGoogleCode(lang) {
  if (lang === 'zh-CN' || lang === 'zh-TW') return 'zh';
  return lang;
}

export class GoogleBackend extends TranslatorBackend {
  get id() { return 'google'; }
  get name() { return 'Google 翻译'; }
  get requiresApiKey() { return false; }
  get defaultConfig() { return {}; }
  get maxTextLength() { return 5000; }

  async translate(text, fromLang, toLang, config) {
    const sl = toGoogleCode(fromLang);
    const tl = toGoogleCode(toLang);
    const url = `${GOOGLE_TRANSLATE_API}?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`GOOGLE_HTTP_${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data || !Array.isArray(data[0])) {
        throw new Error('GOOGLE_INVALID_RESPONSE: Google 翻译返回格式异常');
      }

      return data[0].map(part => part[0]).join('');
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`GOOGLE_NETWORK_ERROR: ${error.message}`);
      }
      throw error;
    }
  }
}
