# 沉浸式乱翻译插件开发计划（MVP 归档）

> **⚠️ 本计划为 MVP 阶段归档。当前项目已推进到 V2，详见 `V2-PLAN.md`。**
> 
> 项目目标：打造一款浏览器扩展，通过「中 → 英 → 日 → 中」的回译链路，把网页文字翻译得面目全非，制造沉浸式“乱翻译”效果。
> 
> 本计划面向 **MVP（最小可用版）**，优先完成核心乱翻译功能与可维护的工程结构，进阶功能后置。

---

## 一、项目定位与范围

### 1.1 产品定位
- 浏览器扩展，支持 Chrome / Edge。
- 娱乐向插件：让用户在浏览中文网页时一键开启“乱翻译”模式，随后可一键恢复原文。
- 核心价值：简单、快速、好玩。

### 1.2 MVP 边界
| 范围 | 说明 |
|------|------|
| 浏览器 | 仅 Chrome / Edge（Manifest V3）。 |
| 翻译链路 | 默认固定 `zh-CN → en → ja → zh-CN`，暂不支持自定义。 |
| 翻译后端 | 默认使用 Google 免费翻译 API；AI 后端配置功能后置。 |
| 设置页 | MVP 暂不实现 `options.html`，全部交互集中在 popup。 |
| 上架 | 当前不上架 Chrome Web Store，先验证本地可用性。 |
| 图标 | 先使用占位图标，后续再设计正式图标。 |

### 1.3 非目标（MVP 不做）
- 自定义语言链。
- AI / DeepL / 用户 API Key 配置。
- 设置页（options）。
- 跨浏览器支持（Firefox）。
- 白名单 / 黑名单站点管理。
- 梗词库替换。
- 单元测试与 CI（仅保留可测试的代码结构）。

---

## 二、MVP 阶段计划

### 阶段 1：基础骨架与迁移
**目标：建立清晰目录，补齐缺失文件，让扩展能正常被 Chrome 加载。**

| 步骤 | 任务 | 产出文件 |
|------|------|----------|
| 1.1 | 创建模块化目录结构 | `src/background/`、`src/content/`、`src/popup/`、`src/shared/`、`src/icons/`、`scripts/` |
| 1.2 | 迁移 `manifest.json` 到 `src/` 目录 | `src/manifest.json` |
| 1.3 | 迁移并重写 `popup.html` | `src/popup/popup.html` |
| 1.4 | 迁移 `popup.js` | `src/popup/popup.js` |
| 1.5 | 拆分原有 `content.js` 到多个模块 | `src/content/content.js`、`text-extractor.js`、`translator.js`、`dom-patcher.js` 等 |
| 1.6 | 生成占位图标 | `src/icons/icon16.png`、`icon32.png`、`icon48.png`、`icon128.png` |
| 1.7 | 更新 `manifest.json`：修正路径、权限、host_permissions、icons、background | `src/manifest.json` |
| 1.8 | 本地加载验证：在 Chrome 扩展页选择 `src/` 目录，确认无报错 | - |

**阶段 1 验收标准：**
- 扩展可在 Chrome 中成功加载。
- 点击扩展图标能正常弹出 popup。
- popup 中的按钮点击后能与 content script 通信。

---

### 阶段 2：核心乱翻译引擎重构
**目标：把原有单一 `content.js` 中的翻译逻辑拆分为独立模块，解决跨域限制，提升稳定性。**

| 步骤 | 模块 | 任务 | 产出文件 |
|------|------|------|----------|
| 2.1 | 常量模块 | 定义默认翻译链路、并发数、缓存 key、API 基础地址 | `src/shared/constants.js` |
| 2.2 | 存储模块 | 封装 `chrome.storage.local`，提供 get/set/clear 接口 | `src/shared/storage.js` |
| 2.3 | 文本提取器 | 优化文本节点提取：过滤 script/style/code/pre、空白节点、过短文本 | `src/content/text-extractor.js` |
| 2.4 | DOM 补丁器 | 提供原文备份、翻译替换、全文恢复能力 | `src/content/dom-patcher.js` |
| 2.5 | 翻译器 | 实现分批调度、并发控制、进度上报、缓存命中 | `src/content/translator.js` |
| 2.6 | 后台 API 处理器 | 在 service worker 中统一调用 Google Translate API，解决 content 直接跨域问题 | `src/background/api-handler.js` |
| 2.7 | 后台入口 | 注册 service worker 和消息监听 | `src/background/service-worker.js` |
| 2.8 | 内容脚本入口 | 监听 popup 消息，协调 extractor / translator / patcher 完成翻译/恢复 | `src/content/content.js` |
| 2.9 | 错误处理 | 单段失败保留原文，不影响整体流程；完成/失败状态统一上报 | 各模块 |

**阶段 2 验收标准：**
- 在中文网页点击“开始乱翻译”，页面可见文字被逐步替换为回译后的文本。
- 翻译过程中有进度反馈。
- 点击“恢复原文”后，页面恢复到初始状态。
- 翻译失败时保留原文，不阻塞其他段落。

---

### 阶段 3：UI/UX 与状态同步
**目标：美化 popup，增加页面内进度反馈，确保三方状态一致。**

| 步骤 | 模块 | 任务 | 产出文件 |
|------|------|------|----------|
| 3.1 | popup 样式 | 设计简洁弹窗 UI：标题、按钮、状态、进度条 | `src/popup/popup.css` |
| 3.2 | popup 逻辑 | 绑定按钮、发送消息、监听进度状态、更新界面 | `src/popup/popup.js` |
| 3.3 | 页面内进度 | 在页面右下角注入悬浮进度提示 | `src/content/progress-ui.js` |
| 3.4 | 内容脚本样式 | 为进度浮层提供基础样式 | `src/content/styles.css` |
| 3.5 | 消息总线 | 统一 popup / content / background 之间的 action 命名和通信方式 | `src/shared/message-bus.js` |
| 3.6 | 状态一致性 | popup 打开时主动查询当前页面是否已翻译，按钮文案智能切换 | `src/popup/popup.js` |

**阶段 3 验收标准：**
- popup 界面美观、按钮状态明确。
- 页面右下角显示翻译进度。
- popup 关闭后再打开，能正确显示当前页面状态（未翻译 / 已翻译）。

---

### 阶段 4：验证与文档
**目标：确保 MVP 可用，留下后续扩展空间。**

| 步骤 | 任务 | 产出 |
|------|------|------|
| 4.1 | 手动测试多个中文网站（新闻、博客、电商等） | 测试记录 / bug 修复 |
| 4.2 | 整理 README.md：安装方式、使用说明、MVP 范围、后续规划 | `README.md` |
| 4.3 | 编写构建脚本：把 `src/` 输出到 `dist/` | `scripts/build.js` |
| 4.4 | 补充文档：本计划文件、开发说明 | `docs/PLAN.md` |

**阶段 4 验收标准：**
- 在 3-5 个不同中文站点上翻译/恢复均正常。
- README 包含完整的安装与使用说明。
- `node scripts/build.js` 能生成 `dist/` 目录，结构与 `src/` 对应。

---

## 三、MVP 文件结构

```
Immersive-Mistranslation/
├── src/                           # 扩展源码
│   ├── manifest.json              # 扩展清单（Manifest V3）
│   ├── icons/                     # 占位图标
│   │   ├── icon16.png
│   │   ├── icon32.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   ├── background/                # 后台脚本
│   │   ├── service-worker.js      # Service Worker 入口
│   │   └── api-handler.js         # 统一翻译 API 调用
│   ├── content/                   # 内容脚本
│   │   ├── content.js             # 内容脚本入口
│   │   ├── text-extractor.js      # 文本节点提取
│   │   ├── translator.js          # 翻译调度器
│   │   ├── dom-patcher.js         # DOM 替换与恢复
│   │   ├── progress-ui.js         # 页面内进度浮层
│   │   └── styles.css             # 内容脚本样式
│   ├── popup/                     # 弹窗界面
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── shared/                    # 共享模块
│       ├── constants.js           # 常量与默认配置
│       ├── storage.js             # chrome.storage 封装
│       └── message-bus.js         # 消息通信封装
├── scripts/
│   └── build.js                   # 构建脚本（src → dist）
├── docs/
│   └── PLAN.md                    # 本计划文档
├── README.md
└── LICENSE
```

---

## 四、模块职责说明

| 模块 | 职责 |
|------|------|
| `src/manifest.json` | 定义扩展元数据、权限、脚本入口、图标。 |
| `src/background/service-worker.js` | Service Worker 入口，注册消息监听。 |
| `src/background/api-handler.js` | 接收翻译请求，调用 Google Translate API，返回结果。 |
| `src/content/content.js` | 内容脚本入口，监听 popup 指令，协调翻译/恢复流程。 |
| `src/content/text-extractor.js` | 从 `document.body` 中提取可翻译文本节点，过滤不可见/无效节点。 |
| `src/content/translator.js` | 管理翻译队列、分批、并发、缓存、进度上报。 |
| `src/content/dom-patcher.js` | 备份原文、替换节点文本、恢复原文。 |
| `src/content/progress-ui.js` | 在页面右下角渲染悬浮进度提示。 |
| `src/popup/popup.js` | 处理弹窗交互、发送指令、接收状态更新。 |
| `src/popup/popup.css` | 弹窗样式。 |
| `src/shared/constants.js` | 默认翻译链路、并发配置、缓存 key 等常量。 |
| `src/shared/storage.js` | 封装 `chrome.storage.local`，提供缓存读写。 |
| `src/shared/message-bus.js` | 统一 action 名称和跨模块消息格式。 |

---

## 五、翻译流程设计

```
用户点击 popup「开始乱翻译」
        │
        ▼
popup.js 发送 action: startTranslation
        │
        ▼
content.js 接收指令
        │
        ▼
text-extractor.js 提取页面文本节点
        │
        ▼
translator.js 逐段处理（先查缓存，未命中则调用 API）
        │
        ▼
api-handler.js 在 background 中调用 Google Translate
        │ 步骤 1: zh-CN → en
        │ 步骤 2: en → ja
        │ 步骤 3: ja → zh-CN
        ▼
结果返回给 translator.js
        │
        ▼
dom-patcher.js 替换节点文本
        │
        ▼
progress-ui.js 更新页面进度
        │
        ▼
popup.js 接收 updateStatus，更新状态文本
```

---

## 六、风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| Google 免费 API 限流或返回非 JSON | 翻译失败 | 单段失败保留原文；后续可考虑增加备用后端或缓存降级。 |
| 页面 DOM 动态更新（SPA） | 新内容未翻译 | MVP 先处理初始页面，后续增加 MutationObserver 监听。 |
| 翻译长文本导致请求失败 | 整段未翻译 | 对超长文本分段或截断处理。 |
| 隐私与数据安全 | 用户敏感文本被发送到第三方 | 在 README 中明确说明数据流向；后续设置页可加入“不翻译输入框”等选项。 |
| 图标占位影响体验 | 扩展图标不美观 | 不影响功能，阶段 4 后设计正式图标。 |

---

## 七、后续规划（MVP 之后）

| 阶段 | 功能 | 说明 |
|------|------|------|
| V2 | 自定义翻译链路 | 允许用户配置 `zh-CN → en → ja → zh-CN` 以外的回译链。 |
| V2 | 设置页（options） | 配置语言链、并发数、缓存开关、API 选择。 |
| V2 | 多后端支持 | 支持用户配置 OpenAI / DeepSeek / DeepL 等 API Key。 |
| V2 | 黑白名单 | 按域名设置默认启用/禁用。 |
| V3 | 智能区域选择 | 仅翻译正文，避开导航栏、广告、页脚。 |
| V3 | 梗词库 | 在回译结果中二次替换，增强节目效果。 |
| V3 | 跨浏览器支持 | 适配 Firefox（Manifest V2/V3 兼容）。 |
| V3 | 上架准备 | 隐私政策、商店素材、截图、宣传文案。 |

---

## 八、当前进度

- [x] 阶段 1：基础骨架与迁移
- [x] 阶段 2：核心乱翻译引擎重构
- [x] 阶段 3：UI/UX 与状态同步
- [x] 阶段 4：验证与文档

---

## 十、MVP 阶段技术决策

### Content Script 内联化
由于浏览器对 content script 的**原生 ES Module** 支持不稳定（实测 Edge 会报 `Cannot use import statement outside a module`），MVP 阶段将 `src/content/content.js` 改为单一内联文件，包含：
- 常量定义
- Storage 封装
- 消息通信
- 文本提取
- DOM 补丁
- 翻译调度
- 进度浮层
- 入口监听

`text-extractor.js`、`translator.js`、`dom-patcher.js`、`progress-ui.js` 仍保留在 `src/content/` 中作为后续 Vite 模块化重构的参考。

### Background 保持 ES Module
`service-worker.js` 与 `api-handler.js` 仍然使用 ES Module。Service Worker 对 module 的支持更稳定，不受 content script 限制影响。

### 多翻译 API 回退策略
MVP 阶段由于 Google 翻译 API 在国内网络环境下通常无法访问，引入百度翻译 API 作为备选：
- `api-handler.js` 优先读取 `chrome.storage.local` 中的百度翻译配置。
- 若已配置百度密钥，优先使用百度翻译链路完成回译。
- 若未配置百度密钥，回退到 Google Translate API。
- 若两者均失败，返回具体错误信息，提示用户配置百度翻译 API。
- popup 中提供「翻译设置」面板，用于保存/清除百度翻译 App ID 和 Secret Key。

1. **每次阶段完成后进行本地加载验证**：在 Chrome 扩展管理页加载 `src/` 目录，确认功能正常。
2. **每次修改后检查 Console**：确认 content / background / popup 三方无报错。
3. **保持最小权限原则**：仅申请必要的 `activeTab`、`scripting` 和 Google API 相关 `host_permissions`。
4. **文档同步**：每完成一个阶段，更新本计划中的进度勾选框和 README 中的功能说明。
