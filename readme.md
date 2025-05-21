# 轻小说文库下载 (优化版) - wenku8_dl_ug

wenku8_dl_ug 是一个功能强大的用户脚本，专为从轻小说文库 (Wenku8) 下载小说而设计。它支持批量下载、将小说转换为 EPUB 格式，并提供简繁体转换等实用功能。该项目是对 HaoaWang 原有脚本的重构和优化，旨在提升用户体验和代码质量。

## 项目链接

* **Greasy Fork (原作者 HaoaWang):** [轻小说文库下载](https://greasyfork.org/zh-CN/scripts/407369-%E8%BD%BB%E5%B0%8F%E8%AF%B4%E6%96%87%E5%BA%93%E4%B8%8B%E8%BD%BD)
* **GitHub (重构版):** [Raven-tu/wenku8_dl_ug](https://github.com/Raven-tu/wenku8_dl_ug)

## 主要特性

* **批量下载:** 支持一次性下载多卷或整本小说。
* **EPUB 格式转换:** 将下载的小说内容自动生成结构良好、兼容性佳的 EPUB 文件。
* **分卷与合集:** 可选择生成单独的分卷 EPUB 或包含所有卷的合集 EPUB。
* **插图处理:**
  * 自动下载并嵌入小说插图。
  * 支持拖放操作调整 EPUB 文档中的插图顺序。
  * 修复了在 Apple Books 等阅读器中可能出现的插图无法阅览的问题。
* **简繁体转换:** 内置 OpenCC 实现，方便用户在简体中文和繁体中文之间切换。
* **用户界面优化:** 提供直观的下载进度显示和日志记录。
* **代码现代化:** 项目采用现代 JavaScript (ESM) 和 Vite 进行构建，提升了代码的可读性、可维护性和性能。

## 安装指南

1. **安装用户脚本管理器:**
   * 首先，您需要在浏览器中安装一个用户脚本管理器。推荐使用 [Tampermonkey](https://www.tampermonkey.net/) (适用于 Chrome, Firefox, Safari, Edge 等主流浏览器) 或类似的扩展。
2. **安装脚本:**
   * 访问项目的 [Greasy Fork 页面](https://greasyfork.org/zh-CN/scripts/407369-%E8%BD%BB%E5%B0%8F%E8%AF%B4%E6%96%87%E5%BA%93%E4%B8%8B%E8%BD%BD) (如果希望使用最新重构版，请关注 GitHub Releases 或自行构建)。
   * 点击页面上的 "安装此脚本" 按钮。
   * 用户脚本管理器会自动弹出安装确认界面，点击 "安装" 即可。

## 使用说明

1. 安装完成后，访问 [轻小说文库 (Wenku8)](https://www.wenku8.net/) 的任意小说目录页或阅读页。
2. 脚本会自动在页面上添加下载相关的操作按钮或界面。
3. 根据界面提示选择需要下载的卷、格式等选项。
4. 点击下载按钮，脚本将开始下载小说内容并生成 EPUB 文件。
5. 下载完成后，浏览器会自动提示保存生成的 EPUB 文件。

## 开发

本项目使用 [Vite](https://vitejs.dev/) 和 [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 进行开发和构建。

**环境要求:**

* Node.js (推荐最新 LTS 版本)
* pnpm (推荐) 或 npm/yarn

**本地开发步骤:**

1. 克隆仓库:

   ```bash
   git clone https://github.com/Raven-tu/wenku8_dl_ug.git
   cd wenku8_dl_ug
   ```

2. 安装依赖:

   ```bash
   pnpm install
   # 或者使用 npm install / yarn install
   ```

3. 启动开发服务器:

   ```bash
   pnpm dev
   ```

   这会在本地启动一个开发服务器，并自动将脚本注入到匹配的网站 (通常是 `*.wenku8.net/*`)。您可以在浏览器中打开轻小说文库网站进行调试。

4. 构建生产版本:

   ```bash
   pnpm build
   ```

   构建后的用户脚本文件将位于 `dist` 目录下。

**主要脚本命令:**

* `pnpm dev`: 启动开发模式。
* `pnpm build`: 构建生产版本的用户脚本。
* `pnpm lint`: 使用 ESLint检查代码规范。
* `pnpm lint:fix`: 使用 ESLint 自动修复代码规范问题。
* `pnpm preview`: 预览生产构建。
* `pnpm release`: 使用 standard-version 发布新版本 (自动生成 CHANGELOG 和打 tag)。

## 目录结构

```text
wenku8_dl_ug/
├── lib/                      # 存放第三方库的本地副本 (如 FileSaver.js)
├── src/
│   ├── auto-imports.d.ts     # unplugin-auto-import 生成的类型声明文件
│   ├── constants.js          # 全局常量定义
│   ├── main.js               # 用户脚本主入口，负责初始化、UI交互逻辑
│   ├── vite-env.d.ts         # Vite 环境变量类型声明
│   ├── coordinator/
│   │   └── epubBuilderCoordinator.js # EPUB 构建流程的协调器，管理各模块协作
│   └── modules/
│       ├── appApiService.js  # 与 Wenku8 App 接口交互的服务模块
│       ├── epubBuilder.js    # EPUB 文件生成核心逻辑模块
│       ├── epubEditor.js     # EPUB 编辑相关功能模块 (如插图调整)
│       ├── opencc.js         # 简繁体转换模块 (基于 opencc-js)
│       ├── uiLogger.js       # UI 日志和进度显示模块
│       ├── utils.js          # 通用工具函数 (如 XHR, Fetch 封装)
│       ├── volumeLoader.js   # 小说卷内容和图片加载模块
│       └── xhrManager.js     # XHR 下载管理器模块，处理并发下载等
├── temp/                     # 临时文件或测试文件目录 (通常不包含在版本控制中)
├── auto-imports.d.ts         # (根目录的这个可能是旧的或重复的，以 src 内为准)
├── CHANGELOG.md              # 版本更新日志 (由 standard-version 自动生成)
├── eslint.config.mjs         # ESLint 配置文件
├── package.json              # 项目元数据和依赖管理文件
├── pnpm-lock.yaml            # pnpm 锁文件
├── readme.md                 # 项目说明文件 (即本文档)
├── tsconfig.json             # TypeScript 配置文件
└── vite.config.ts            # Vite 构建配置文件
```

## 贡献

欢迎提交 Pull Requests 或报告 Issues 来改进此项目。

## 致谢

* **HaoaWang:** 感谢原作者创建了如此实用的脚本。
* **OpenCC:** 提供了强大的简繁体转换功能。
* 以及所有使用和支持此项目的用户。
