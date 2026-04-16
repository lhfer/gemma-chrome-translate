# Gemma Chrome Translate

> **100% 本地运行、零数据上传** — 用 Gemma 4 模型实时流式翻译任何英文网页为地道的中文。

一个 Chrome 扩展，通过本地部署的 [oMLX](https://github.com/niconi19/oMLX) 推理服务，调用 Google Gemma 4 模型，将海外网站的英文内容流式翻译为自然、地道、流畅的简体中文。所有数据留在你的 Mac 上，不经过任何云端 API。

## Why

- 现有翻译工具（Google Translate、DeepL 等）翻译质量参差不齐，且需要将页面内容上传到云端
- 在隐私敏感场景（公司内部文档、私人社交平台浏览等）中，本地翻译是刚需
- Gemma 4 模型在翻译质量上已经足够好，配合精心设计的 prompt，输出接近母语水平的中文

## Features

**Smart Site-Aware Extraction**
- X / Twitter 深度适配：推文、长文、侧边栏趋势、Today's News 卡片全覆盖
- Hacker News 适配：标题 + 评论精准提取
- 通用网页：自动识别 `<main>` / `<article>` 内的正文内容
- 智能跳过：代码块、导航栏、按钮、已有中文内容自动过滤

**Streaming Translation**
- 翻译结果逐字流式显示，无需等待全文翻译完成
- 翻译过程中显示柔和的光泽扫过动画（shimmer），完成后有聚焦渐显效果
- 最多 3 路并发翻译，LRU 缓存 500 条，相同内容不重复调用

**Privacy First**
- 所有翻译请求发送到 `127.0.0.1`，不经过任何外部服务
- 无需注册、无需登录、无需 API key（除非你的 oMLX 配置了）
- 不采集任何使用数据

**Quick Toggle**
- 右侧 Command 键一键切换「原文 / 译文」，支持反复切换
- Popup 面板管理站点规则：记住哪些站点默认翻译
- X / Twitter 默认自动翻译，其他站点按需开启

## Quick Start

### 1. 启动本地推理服务

确保 [oMLX](https://github.com/niconi19/oMLX) 已安装，使用 Gemma 4 模型启动：

```bash
# oMLX 默认监听 http://127.0.0.1:8000
omlx serve gemma-4-e4b-it-4bit
```

### 2. 构建扩展

```bash
git clone https://github.com/lhfer/gemma-chrome-translate.git
cd gemma-chrome-translate
npm install
npm run build
```

### 3. 安装到 Chrome

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目中的 `dist/` 目录

### 4. 开始使用

- 打开任意英文网页（如 X / Twitter）
- 扩展自动翻译页面内容
- 按 **右侧 Command 键** 切换原文/译文
- 点击扩展图标管理站点设置

## Architecture

```
src/
  background/     # Service Worker — 翻译队列调度、LLM API 调用、缓存管理
  content/        # Content Script — 页面扫描、DOM 替换、可见性检测、快捷键
  popup/          # Popup UI — 站点开关、连接状态、oMLX 配置
  shared/         # 共享类型、消息协议、设置、哈希工具
public/
  manifest.json   # Manifest V3 配置
  content.css     # 翻译动画样式
  popup.html/css  # Popup 页面
```

**Tech Stack**: TypeScript, esbuild, Manifest V3, Vitest

## Configuration

在扩展 Popup 面板中可配置：

| 选项 | 默认值 | 说明 |
|---|---|---|
| oMLX 地址 | `http://127.0.0.1:8000/v1` | 本地推理服务地址 |
| 模型 | `gemma-4-e4b-it-4bit` | 任何兼容 OpenAI API 的模型 |
| API Key | （空） | 如果推理服务需要认证 |

## Development

```bash
npm install       # 安装依赖
npm run build     # 构建到 dist/
npm test          # 运行测试
npm run test:watch # 监听模式测试
```

## License

MIT
