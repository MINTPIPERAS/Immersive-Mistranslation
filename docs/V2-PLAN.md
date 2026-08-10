# 沉浸式乱翻译 V2 开发计划

> 阶段目标：从 MVP 的“能跑”升级到 V2 的“可扩展、可配置、可维护”。
> 核心工作：引入 Vite 构建工具，建立可插拔翻译后端架构，新增 Options 设置页并支持可视化翻译链路编辑。

---

## 一、V2 总体目标

| 目标 | 说明 |
|------|------|
| 可维护的工程结构 | 用 Vite 替代手写构建脚本，恢复模块化拆分，支持热更新。 |
| 可插拔的翻译后端 | 百度、Google 作为首批实现；DeepL / DeepLX / OpenAI 等后续只需新增一个模块。 |
| 用户可配置 | 通过 Options 页选择后端、填写密钥、自定义翻译链路。 |
| 保留 MVP 功能 | 现有“中 → 英 → 芬兰语 → 越南语 → 中”链路在 V2 中仍作为默认链路可用。 |
| 不做的功能 | 站点黑白名单、梗词库、跨浏览器支持、商店上架放到 V3。 |

---

## 二、V2 范围

### 2.1 包含

- Vite 构建环境搭建（JavaScript，保留 JS 不引入 TS）
- 恢复模块化代码结构
- 可插拔后端接口与注册表
- 百度、Google 后端迁移为模块
- Options 设置页
- 翻译链路可视化编辑器
- 缓存管理（查看、清除）
- 配置持久化到 `chrome.storage.sync`（可选）或 `chrome.storage.local`

### 2.2 不包含（V3）

- 站点黑白名单
- 智能区域选择（仅翻译正文）
- 梗词库 / 本地破坏层
- DeepL / DeepLX / OpenAI 后端实现（仅预留接口和注册位）
- Firefox 支持
- Chrome Web Store 上架

---

## 三、V2 架构设计

### 3.1 目录结构

```
Immersive-Mistranslation/
├── src/
│   ├── manifest.json                 # 入口清单
│   ├── background/
│   │   ├── service-worker.js         # Service Worker 入口
│   │   ├── api-handler.js            # 消息监听与分发
│   │   ├── chain-translator.js       # 翻译链路编排
│   │   └── translators/
│   │       ├── index.js              # 后端注册表
│   │       ├── base.js               # 统一接口定义
│   │       ├── baidu.js              # 百度翻译 API
│   │       ├── google.js             # Google Translate API
│   │       ├── deepl.js              # 预留：DeepL 官方 API
│   │       ├── deeplx.js             # 预留：DeepLX 社区代理
│   │       └── openai.js             # 预留：OpenAI / DeepSeek 兼容 API
│   ├── content/
│   │   ├── content.js                # 内容脚本入口
│   │   ├── text-extractor.js         # 文本节点提取
│   │   ├── dom-patcher.js            # DOM 替换与恢复
│   │   ├── translator.js             # 页面级翻译调度
│   │   ├── progress-ui.js            # 页面内进度浮层
│   │   └── styles.css
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html              # 设置页
│   │   ├── options.js
│   │   └── options.css
│   ├── shared/
│   │   ├── constants.js                # 常量、默认配置
│   │   ├── storage.js                # storage 封装
│   │   └── message-bus.js            # 跨模块消息通信
│   └── icons/
├── tests/
│   ├── unit/
│   │   └── translators/              # 后端模块单元测试
│   └── e2e/                        # 可选：扩展加载端到端测试
├── docs/
│   ├── MVP-PLAN.md
│   └── V2-PLAN.md                   # 本文档
├── vite.config.js
├── package.json
├── scripts/
│   └── build.js                      # 旧 build.js，Vite 迁移后删除
├── README.md
└── LICENSE
```

### 3.2 后端统一接口

每个翻译后端实现一个类，暴露以下接口：

```js
// src/background/translators/base.js
export class TranslatorBackend {
  get id() { throw new Error('未实现 id'); }
  get name() { throw new Error('未实现 name'); }
  get isConfigurable() { return true; }
  get requiredFields() { return []; }      // 必填字段，如 ['appid', 'key']
  get optionalFields() { return []; }      // 选填字段，如 ['url', 'apiKey']

  // 校验配置是否足够使用该后端
  validate(config) { return true; }

  // 单步翻译
  async translate(text, from, to, config) { throw new Error('未实现 translate'); }

  // 将通用语言代码映射为该后端所需代码
  mapLanguageCode(lang) { return lang; }
}
```

### 3.3 后端注册表

```js
// src/background/translators/index.js
import { BaiduTranslator } from './baidu.js';
import { GoogleTranslator } from './google.js';
import { DeepLTranslator } from './deepl.js';
import { DeepLXTranslator } from './deeplx.js';
import { OpenAITranslator } from './openai.js';

export const TRANSLATORS = {
  baidu: new BaiduTranslator(),
  google: new GoogleTranslator(),
  // V2 预留注册位，默认不启用
  deepl: new DeepLTranslator(),
  deeplx: new DeepLXTranslator(),
  openai: new OpenAITranslator(),
};

export function getTranslator(id) {
  return TRANSLATORS[id];
}

export function getEnabledTranslators(config) {
  return Object.values(TRANSLATORS).filter(t => t.validate(config[t.id] || {}));
}
```

### 3.4 翻译链路配置

V2 中一条翻译链路是一个数组，每个步骤包含 `source`、`target`、`backend`：

```js
// 默认链路（兼容 MVP 效果）
const DEFAULT_CHAIN = {
  id: 'default-chaos',
  name: '默认乱译链路',
  steps: [
    { source: 'zh-CN', target: 'en', backend: 'baidu' },
    { source: 'en', target: 'fi', backend: 'baidu' },
    { source: 'fi', target: 'vi', backend: 'baidu' },
    { source: 'vi', target: 'zh-CN', backend: 'baidu' },
  ]
};
```

回退策略：
- 单步失败 → 尝试该步骤的 fallback backend（可配置）
- 整链失败 → 尝试下一条链路

### 3.5 配置持久化

存储结构：

```json
{
  "settings": {
    "defaultBackend": "baidu",
    "backends": {
      "baidu": { "appid": "xxx", "key": "yyy" },
      "google": { "enabled": true },
      "deepl": { "apiKey": "" },
      "deeplx": { "url": "", "apiKey": "" },
      "openai": { "url": "", "apiKey": "", "model": "gpt-3.5-turbo" }
    },
    "chains": [
      {
        "id": "default-chaos",
        "name": "默认乱译链路",
        "steps": [...]
      }
    ],
    "activeChainId": "default-chaos",
    "cacheEnabled": true
  }
}
```

---

## 四、Options 设置页设计

### 4.1 页面结构

```
沉浸式乱翻译 设置
├── 标签页：翻译后端
│   ├── 后端列表（百度 / Google / DeepL / DeepLX / OpenAI）
│   ├── 每个后端：启用开关 + 配置表单
│   └── 测试连接按钮
├── 标签页：翻译链路
│   ├── 预设链路选择
│   ├── 可视化链路编辑器
│   │   ├── 语言步骤卡片（源语言 → 目标语言 → 后端）
│   │   ├── 添加/删除/拖拽排序
│   │   └── 后端选择下拉框
│   └── 新建 / 删除自定义链路
└── 标签页：缓存
    ├── 缓存条目数
    └── 清空缓存按钮
```

### 4.2 翻译链路编辑器（核心交互）

- 每个步骤显示：
  - 源语言（下拉）
  - 目标语言（下拉）
  - 后端选择（下拉，只显示已启用且支持该语言对的后端）
  - 删除按钮
- 步骤之间用箭头连接
- 底部有「添加步骤」按钮
- 提供预设：
  - 默认乱译（中 → 英 → 芬兰语 → 越南语 → 中）
  - 保守链路（中 → 英 → 日 → 中）
  - 极简链路（中 → 英 → 中）

---

## 五、分阶段实施计划

### Phase 1：Vite 迁移与模块化恢复

**目标**：建立 V2 工程基础，恢复 MVP 功能但代码结构模块化。

| 任务 | 产出 |
|------|------|
| 1.1 初始化 Vite 项目 | `package.json`、`vite.config.js` |
| 1.2 配置 `vite-plugin-web-extension` | 支持 background / content / popup / options 多入口 |
| 1.3 按 V2 目录结构迁移 MVP 文件 | `src/background/`、`src/content/`、`src/popup/`、`src/shared/` |
| 1.4 拆分 `content.js` 为模块 | `text-extractor.js`、`dom-patcher.js`、`translator.js`、`progress-ui.js` |
| 1.5 将 `content_scripts` 改为 ES Module | `manifest.json` 中 `"type": "module"` |
| 1.6 恢复 `shared/storage.js` 和 `shared/message-bus.js` | 被删除的共享工具模块回归 |
| 1.7 验证 MVP 功能在 Vite 构建后仍可用 | 扩展可加载、翻译/恢复正常 |

**Phase 1 验收标准：**
- `npm run build` 能成功生成 `dist/`。
- 在 Chrome/Edge 中加载 `dist/` 后，MVP 的翻译功能正常。
- 文件结构符合 3.1 中的目录规划。

### Phase 2：可插拔后端架构

**目标**：把百度和 Google 封装成标准后端模块，建立注册表，支持后续扩展。

| 任务 | 产出 |
|------|------|
| 2.1 定义 `TranslatorBackend` 基类 | `src/background/translators/base.js` |
| 2.2 迁移百度翻译为 `baidu.js` | 封装签名、请求、错误处理 |
| 2.3 迁移 Google 翻译为 `google.js` | 封装 `translate.googleapis.com` 请求 |
| 2.4 创建后端注册表 `translators/index.js` | 统一注册百度、Google、预留位 |
| 2.5 实现 `chain-translator.js` | 按链路步骤调度后端 |
| 2.6 替换 `api-handler.js` 中的硬编码逻辑 | 改为调用 `chain-translator.js` |
| 2.7 单元测试百度、Google 后端的语言代码映射 | `tests/unit/translators/` |

**Phase 2 验收标准：**
- 后端可以通过 `TRANSLATORS[id]` 获取。
- 新增一个后端只需新建文件 + 注册到 `index.js`。
- 翻译链路中每个步骤可指定不同后端。

### Phase 3：Options 设置页

**目标**：提供用户可访问的配置界面，支持后端配置和链路编辑。

| 任务 | 产出 |
|------|------|
| 3.1 创建 `options.html` / `options.css` / `options.js` | 完整设置页 |
| 3.2 在 `manifest.json` 中声明 `options_page` | `options/options.html` |
| 3.3 实现「翻译后端」标签页 | 启用开关 + 配置表单 |
| 3.4 实现「翻译链路」标签页 | 预设选择 + 步骤编辑器 |
| 3.5 实现「缓存」标签页 | 缓存统计与清空 |
| 3.6 配置持久化到 `chrome.storage` | 读写封装 |
| 3.7 链路配置下发到 content / background | 启动翻译时读取配置 |

**Phase 3 验收标准：**
- 在扩展详情页点击「扩展选项」可打开设置页。
- 修改后端配置后，翻译流程使用新配置。
- 自定义链路可保存并生效。

### Phase 4：配置迁移与兼容性

**目标**：确保从 MVP 升级到 V2 不丢失用户配置。

| 任务 | 产出 |
|------|------|
| 4.1 读取 MVP 遗留的 `baidu_appid` / `baidu_key` | 迁移到新配置结构 |
| 4.2 首次启动时创建默认配置 | 默认使用百度 + 默认乱译链路 |
| 4.3 配置版本号管理 | 便于后续 V3 迁移 |
| 4.4 删除旧 `scripts/build.js` | Vite 完全接管构建 |

**Phase 4 验收标准：**
- 已安装 MVP 的用户升级到 V2 后，百度密钥仍然有效。
- 无配置的新用户首次使用时有默认配置。

### Phase 5：测试与文档

**目标**：确保 V2 稳定可用，文档同步更新。

| 任务 | 产出 |
|------|------|
| 5.1 后端模块单元测试 | `tests/unit/translators/*.test.js` |
| 5.2 链路编排器单元测试 | `tests/unit/chain-translator.test.js` |
| 5.3 手动回归测试 | 多个中文网站测试翻译/恢复 |
| 5.4 更新 README.md | 安装、配置、开发说明 |
| 5.5 更新 MVP-PLAN.md | 标记 V2 已取代 MVP |
| 5.6 整理 V2-PLAN.md | 根据实际实现修正细节 |

**Phase 5 验收标准：**
- `npm run test` 通过。
- README 与 V2 架构一致。

---

## 六、V2 默认翻译链路

保留 MVP 的默认链路，作为 V2 的默认配置：

```
中文（zh-CN） → 英文（en） → 芬兰语（fi） → 越南语（vi） → 中文（zh-CN）
```

用户可在 Options 中修改为：
- 保守链路：中 → 英 → 日 → 中
- 极简链路：中 → 英 → 中
- 自定义链路：任意步骤组合

---

## 七、后端扩展指南（预留）

V2 为 DeepL / DeepLX / OpenAI 预留了注册位，但**不实现具体逻辑**。后续添加新后端时，只需：

1. 在 `src/background/translators/` 下新建 `xxx.js`
2. 继承 `TranslatorBackend` 基类
3. 实现 `id`、`name`、`requiredFields`、`validate()`、`translate()`、`mapLanguageCode()`
4. 在 `translators/index.js` 中注册

示例（伪代码）：

```js
// src/background/translators/deeplx.js
import { TranslatorBackend } from './base.js';

export class DeepLXTranslator extends TranslatorBackend {
  get id() { return 'deeplx'; }
  get name() { return 'DeepLX'; }
  get requiredFields() { return ['url']; }
  get optionalFields() { return ['apiKey']; }

  validate(config) {
    return !!config.url;
  }

  mapLanguageCode(lang) {
    const map = { 'zh-CN': 'ZH', 'en': 'EN', 'fi': 'FI', 'vi': 'VI', 'ja': 'JA' };
    return map[lang] || lang.toUpperCase();
  }

  async translate(text, from, to, config) {
    const res = await fetch(`${config.url}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        source_lang: this.mapLanguageCode(from),
        target_lang: this.mapLanguageCode(to),
      })
    });
    const data = await res.json();
    return data.data || data.result;
  }
}
```

---

## 八、技术选型

| 项目 | 选型 | 说明 |
|------|------|------|
| 构建工具 | Vite | 轻量、支持多入口、HMR |
| 扩展插件 | `vite-plugin-web-extension` | 比 `@crxjs/vite-plugin` 更稳定 |
| 语言 | JavaScript | 按你要求，V2 不引入 TypeScript |
| 测试 | Vitest | 与 Vite 生态一致 |
| 包管理 | npm | 普通 Node 项目 |

---

## 九、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| Vite 与 content script ES Module 兼容性 | content 脚本无法加载 | 选择成熟的 `vite-plugin-web-extension`，并在 Chrome/Edge 中验证。 |
| 模块化后 MV3 响应丢失 | 大页面翻译失败 | 保留 MVP 的 `chrome.runtime.connect` 长连接方案。 |
| 配置迁移失败 | 老用户密钥丢失 | 启动时检测旧 key，自动迁移到新结构。 |
| Options 页交互复杂 | 开发周期长 | 先做核心功能（后端配置 + 链路编辑），再迭代 UI。 |
| 后端接口抽象不足 | 后续加 API 困难 | Phase 2 严格定义接口，Review 后再进入 Phase 3。 |

---

## 十、当前状态

- [ ] Phase 1：Vite 迁移与模块化恢复
- [ ] Phase 2：可插拔后端架构
- [ ] Phase 3：Options 设置页
- [ ] Phase 4：配置迁移与兼容性
- [ ] Phase 5：测试与文档

---

## 十一、下一步

确认本计划后，从 **Phase 1：Vite 迁移与模块化恢复** 开始执行。

Phase 1 完成后应先验证 MVP 功能无损，再进入 Phase 2。
