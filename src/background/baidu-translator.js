/**
 * 百度翻译 API 封装
 * 文档：https://fanyi-api.baidu.com/product/11
 */
import { md5 } from './md5.js';

const BAIDU_API_URL = 'https://fanyi-api.baidu.com/api/trans/vip/translate';

/**
 * 生成百度 API 签名
 */
function buildSign(appid, q, salt, key) {
  const raw = `${appid}${q}${salt}${key}`;
  return md5(raw);
}

/**
 * 单步翻译
 */
async function baiduTranslate(text, from, to, config) {
  const { appid, key } = config;
  if (!appid || !key) {
    throw new Error('BAIDU_CONFIG_MISSING: 未配置百度翻译 App ID / Secret Key');
  }

  const salt = Date.now() + Math.random().toString(16).slice(2, 8);
  const sign = buildSign(appid, text, salt, key);

  const params = new URLSearchParams();
  params.append('q', text);
  params.append('from', from);
  params.append('to', to);
  params.append('appid', appid);
  params.append('salt', salt);
  params.append('sign', sign);

  const url = `${BAIDU_API_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (data.error_code) {
      const errorMsg = data.error_msg || '百度翻译接口错误';
      let hint = '';
      if (data.error_code === '52003') {
        hint = '（请检查 App ID / Secret Key 是否正确，以及标准版翻译服务是否已开通）';
      } else if (data.error_code === '54001') {
        hint = '（签名错误，请检查 Secret Key 是否填写正确）';
      } else if (data.error_code === '54004') {
        hint = '（账户余额不足，请检查免费额度是否已用完）';
      }
      throw new Error(`BAIDU_API_${data.error_code}: ${errorMsg}${hint}`);
    }

    if (!data.trans_result || !Array.isArray(data.trans_result)) {
      throw new Error('BAIDU_INVALID_RESPONSE: 百度翻译返回格式异常');
    }

    return data.trans_result.map(part => part.dst).join('');
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`BAIDU_NETWORK_ERROR: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 链路映射：把通用语言代码转成百度代码
 */
function toBaiduCode(lang) {
  const map = {
    'zh-CN': 'zh',
    'zh-TW': 'cht',
    'zh': 'zh',
    'en': 'en',
    'ja': 'jp',
    'jp': 'jp',
    'fi': 'fin',
    'fin': 'fin',
    'vie': 'vie',
    'vi': 'vie',
    'ru': 'ru',
    'kor': 'kor',
    'ko': 'kor',
    'ara': 'ara',
    'ar': 'ara'
  };
  return map[lang] || lang;
}

export { baiduTranslate, toBaiduCode, BAIDU_API_URL };
