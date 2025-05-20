# wenku8-refactored

```
wenku8-refactored/
├── src/
│   ├── constants.js          # 全局常量
│   ├── utils.js            # 通用工具函数 (XHR, Fetch等封装)
│   ├── modules/
│   │   ├── OpenCCConverter.js    # 简繁转换模块
│   │   ├── AppApiService.js      # App接口服务模块
│   │   ├── VolumeLoader.js       # 卷内容和图片加载模块
│   │   ├── EpubEditor.js         # ePub编辑器模块
│   │   ├── XHRDownloadManager.js # XHR下载管理器模块
│   │   └── EpubFileBuilder.js    # ePub文件生成模块
│   │   └── UILogger.js           # 日志和进度显示模块
│   └── coordinator/
│       └── EpubBuilderCoordinator.js # 主协调器 (Epub构建流程控制)
│   └── main.js             # 脚本入口，初始化和UI交互逻辑
├── userscript.config.js    # vite-plugin-monkey 的元数据配置
├── vite.config.js          # Vite 配置文件
└── package.json            # npm 包管理文件
