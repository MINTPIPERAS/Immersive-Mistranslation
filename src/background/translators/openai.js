/**
 * 大模型乱译后端（OpenAI 兼容接口）
 *
 * 通过单条 prompt 让模型模拟多次随机语言来回翻译，制造无厘头效果。
 * 支持 OpenAI、DeepSeek、本地反代等任意 /chat/completions 兼容接口。
 */
import { TranslatorBackend } from './translator-backend.js';
import { DEFAULT_LLM_SYSTEM_PROMPT } from '../../shared/constants.js';

export class OpenAIBackend extends TranslatorBackend {
  get id() { return 'openai'; }
  get name() { return '大模型乱译 (OpenAI 兼容)'; }
  get requiresApiKey() { return true; }
  get defaultConfig() {
    return {
      apiKey: '',
      model: 'gpt-4o-mini',
      apiBase: 'https://api.openai.com/v1',
      systemPrompt: DEFAULT_LLM_SYSTEM_PROMPT,
      temperature: 0.9,
      maxRounds: 20
    };
  }
  get maxTextLength() { return 4000; }

  validateConfig(config) {
    if (!config?.apiKey) {
      throw new Error('OPENAI_CONFIG_MISSING: 未配置大模型 API Key');
    }
    if (!config?.model) {
      throw new Error('OPENAI_CONFIG_MISSING: 未配置模型名称');
    }
    if (!config?.apiBase) {
      throw new Error('OPENAI_CONFIG_MISSING: 未配置 API Base URL');
    }
    return true;
  }

  buildSystemPrompt(config) {
    const rawPrompt = config.systemPrompt || DEFAULT_LLM_SYSTEM_PROMPT;
    const maxRounds = Number.isFinite(config.maxRounds) ? config.maxRounds : 20;
    return rawPrompt.replace(/\{maxRounds\}/g, String(maxRounds));
  }

  async translate(text, fromLang, toLang, config) {
    this.validateConfig(config);

    const apiBase = (config.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const url = `${apiBase}/chat/completions`;
    const systemContent = this.buildSystemPrompt(config);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: text }
          ],
          temperature: typeof config.temperature === 'number' ? config.temperature : 0.9,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || JSON.stringify(errorData.error) || response.statusText;
        } catch {
          // ignore parse error
        }
        throw new Error(`OPENAI_HTTP_${response.status}: ${errorMessage}`);
      }

      const data = await response.json();

      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('OPENAI_INVALID_RESPONSE: 大模型返回格式异常');
      }

      const content = data.choices[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('OPENAI_EMPTY_RESPONSE: 大模型返回为空');
      }

      return content.trim();
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`OPENAI_NETWORK_ERROR: ${error.message}`);
      }
      throw error;
    }
  }
}
