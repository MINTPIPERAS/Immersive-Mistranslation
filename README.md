# 沉浸式乱翻译

一个浏览器扩展（Chrome / Edge），通过多语言回译链路把网页文字翻译得面目全非，制造沉浸式“乱翻译”效果。

> 没什么用，纯好玩。

---

## 效果示例

在任意网页点击扩展图标，选择「开始乱翻译」，页面上的可见文字会经过以下链路回译：

```
中文 → 英文 → 芬兰语 → 越南语 → 中文
```

经过多次语言转换后，原本的语义往往会产生漂移，变得离谱又搞笑。点击「恢复原文」即可一键还原。

---

## 安装方式（V2 开发模式）

V2 已迁移到 Vite 构建。

1. 克隆或下载本仓库。
2. 安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```
3. 打开 Chrome `chrome://extensions/` 或 Edge `edge://extensions/`。
4. 开启右上角「开发者模式」。
5. 点击「加载已解压的扩展程序」，**选择本项目的 `dist/` 目录**（不要选 `src/`）。
6. 扩展图标出现在工具栏，点击即可使用。

> ⚠️ **重要**：必须加载 `dist/` 目录，而不是 `src/`。`src/` 下是 ES Module 源码，直接加载会报 `Cannot use import statement outside a module`。

### 开发热重载

```bash
npm run dev
```

Vite 会监听文件变化并自动构建，之后仍需在扩展管理页刷新扩展。

---

## 使用说明

1. 打开任意网页（中文网页效果最明显）。
2. 点击扩展图标，弹出控制面板。
3. 点击「开始乱翻译」，等待右下角进度浮层完成。
4. 翻译完成后，可点击「恢复原文」还原。

---

## 配置翻译后端

扩展默认使用 **Google 翻译免费接口**，无需配置即可使用。如果你在中国大陆或 Google 访问不稳定，可以切换到 **百度翻译**。

### 方式一：Options 设置页（推荐）

1. 右键扩展图标 → **选项**，打开设置页。
2. 在「默认翻译后端」中选择 **百度翻译**。
3. 切换到「后端配置」→「百度翻译」标签，填入 **App ID** 和 **Secret Key**。
4. 点击「保存设置」。
5. 刷新当前网页，再次点击「开始乱翻译」。

### 方式二：Popup 面板（兼容旧版）

1. 点击扩展图标打开 popup。
2. 点击「翻译设置」，输入百度翻译的 **App ID** 和 **Secret Key**。
3. 保存后刷新网页使用。

> 注意：popup 只保存百度密钥，不会自动切换默认后端；若希望链路全程走百度，请在 Options 页中将「默认翻译后端」设为百度。

### 申请百度翻译 API

1. 打开 [百度翻译开放平台](https://fanyi-api.baidu.com/) 或 [百度智能云机器翻译](https://console.bce.baidu.com/ai-engine/)。
2. 创建应用，选择 **通用翻译标准版**。
3. 获取 **App ID** 和 **Secret Key**。
4. 标准版一般有免费额度，按字符计费；当前主链路每条文本会调用 4 次 API，实际消耗 ≈ 原文字符数 × 4。

---

## 自定义翻译链路

在 Options 设置页中，可以：

- 增删翻译步骤
- 选择每步的源语言和目标语言
- 为每一步单独指定后端（留空则使用默认后端）

可用的后端包括：Google 翻译（免费）、百度翻译（需密钥），以及 DeepL / OpenAI / DeepLX 的占位配置（后续版本实现）。

> 当前版本已提供链路编辑界面并会保存配置；content script 真正从保存配置读取链路的完整逻辑将在后续 Phase 完成。

---

## 项目结构（V2）

```
Immersive-Mistranslation/
├── dist/                          # Vite 构建产物（扩展加载此目录）
├── src/                           # 源码
│   ├── manifest.json              # 扩展清单（Manifest V3）
│   ├── icons/                     # 图标
│   ├── background/                # Service Worker
│   │   ├── service-worker.js
│   │   ├── api-handler.js         # 翻译请求编排器
│   │   ├── md5.js                 # 百度签名用
│   │   └── translators/           # 可插拔后端
│   │       ├── index.js           # 注册表
│   │       ├── translator-backend.js
│   │       ├── baidu.js
│   │       ├── google.js
│   │       ├── deepl.js           # 占位
│   │       ├── openai.js          # 占位
│   │       └── deep-lx.js         # 占位
│   ├── content/                   # 内容脚本
│   │   ├── content.js             # 入口
│   │   ├── text-extractor.js      # 文本提取
│   │   ├── dom-patcher.js         # DOM 备份/应用/恢复
│   │   ├── translator.js          # 分块翻译调度
│   │   ├── progress-ui.js         # 页面内进度浮层
│   │   └── styles.css
│   ├── popup/                     # 弹出面板
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── options/                   # 设置页
│   │   ├── options.html
│   │   ├── options.js
│   │   └── options.css
│   └── shared/                    # 共享模块
│       ├── constants.js
│       ├── storage.js
│       └── message-bus.js
├── scripts/
│   └── build.js                   # 旧版构建脚本，V2 起不再使用
├── docs/
│   ├── MVP-PLAN.md
│   └── V2-PLAN.md
├── package.json
├── vite.config.js
├── README.md
└── LICENSE
```

---

## 当前功能（V2）

- [x] Vite 构建系统
- [x] 内容脚本模块化拆分
- [x] 可插拔翻译后端架构（TranslatorBackend 基类 + 注册表）
- [x] Google 翻译后端（免费接口）
- [x] 百度翻译后端（App ID / Secret Key）
- [x] DeepL / OpenAI / DeepLX 后端占位
- [x] Options 设置页（后端配置、链路编辑器、缓存管理）
- [x] 文本去重与本地缓存
- [x] 分块批量翻译，防止大页面超时
- [x] 页面内进度浮层
- [x] popup 状态同步与 API 配置面板
- [x] background port 断连自动重试
- [ ] 自定义链路在 content script 真正生效（Phase 4 最后一步）

---

## 为什么效果还是偏准确？

如果你发现即使经过了中 → 英 → 芬兰语 → 越南语 → 中，翻译结果仍然能看懂、甚至只是「有点怪」而不是面目全非，这是**正常现象**。

现代主流翻译 API（Google、百度）经过多年训练，非常擅长：

- **保留核心语义**：即使换几种语言，它仍会努力把原意「找回来」
- **修正语法错误**：中间语种的翻译误差往往会在后续语种中被修正
- **处理常见语序**：对常见语言对的语序了如指掌

所以效果更像「语义漂移」而不是「完全乱码」。想让效果更离谱，可以尝试：

- 在 Options 链路编辑器里加入更多步骤，比如 `中 → 英 → 芬兰语 → 越南语 → 泰语 → 中`
- 选择一些语言距离更远或 Google 支持较弱的语种
- 等后续版本接入「随机替换 / 梗词库」等纯娱乐滤镜

> 当前版本优先保证可用性，不保证荒诞程度。

---

## 注意事项 / 故障排查

- **必须从 `dist/` 加载扩展**：直接加载 `src/` 会导致 content script 报 `Cannot use import statement outside a module`。
- **翻译失败 / 网络错误**：默认使用 Google 免费接口，在中国大陆可能不稳定；此时建议配置百度后端并设置为默认后端。
- **background port 断开日志**：MV3 Service Worker 可能因浏览器生命周期被回收；扩展已内置一次自动重试，看到日志但翻译成功是正常行为。
- **进度浮层遮挡**：浮层 ID 为 `immersive-mistranslation-progress`，极少数页面 CSS 可能与之冲突。
- 仅供娱乐，请勿在涉及敏感信息或重要工作的页面使用。

---

## 后续规划

| 阶段 | 内容 | 状态 |
|------|------|------|
| V2 | Vite 迁移与模块化恢复 | ✅ |
| V2 | 可插拔后端架构 | ✅ |
| V2 | Options 设置页 | ✅ |
| V2 | 配置贯通（content script 读取 Options 保存的链路） | 进行中 |
| V3 | 站点黑白名单 | 待开始 |
| V3 | 智能区域选择：仅翻译正文，避开导航/广告 | 待开始 |
| V3 | 梗词库替换，增强节目效果 | 待开始 |
| V3 | 跨浏览器支持（Firefox） | 待开始 |
| V3 | Chrome Web Store 上架准备 | 待开始 |

---

## License

[LICENSE](./LICENSE)
