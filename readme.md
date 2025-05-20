# wenku8-refactored

## 项目地址

- 作者 HaoaWang (原作者)
  - 项目地址 [轻小说文库下载](https://greasyfork.org/zh-CN/scripts/407369-%E8%BD%BB%E5%B0%8F%E8%AF%B4%E6%96%87%E5%BA%93%E4%B8%8B%E8%BD%BD)

- 重构项目地址
  - [GitHub](https://github.com/Raven-tu/wenku8_dl_ug)

## 重构内容

- 生成分卷和全本ePub文档
- ePub文档插图拖放
- 提升了代码结构、可读性和可维护性。

## 目录结构

```md
wenku8-refactored/
├── src/
│   ├── constants.js              # 全局常量
│   ├── modules/
│   │   ├── epubBuilder.js        # ePub文件生成模块
│   │   ├── uiLogger.js           # 日志和进度显示模块
│   │   ├── appApiService.js      # App接口服务模块
│   │   ├── epubEditor.js         # ePub编辑器模块
│   │   ├── opencc.js             # 简繁转换模块
│   │   ├── utils.js              # 通用工具函数 (XHR, Fetch等封装)
│   │   ├── volumeLoader.js       # 卷内容和图片加载模块
│   │   └── xhrManager.js         # XHR下载管理器模块
│   └── coordinator/
│       └── epubBuilderCoordinator.js # 主协调器 (Epub构建流程控制)
│   └── main.js             # 脚本入口，初始化和UI交互逻辑
├── userscript.config.js    # vite-plugin-monkey 的元数据配置
├── vite.config.js          # Vite 配置文件
└── package.json            # npm 包管理文件
