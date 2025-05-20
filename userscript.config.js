import { defineMonkeyConfig } from 'vite-plugin-monkey'

export default defineMonkeyConfig({
  entry: 'src/main.js', // Your main Userscript entry file
  build: {
    fileName: 'wenku8-download-refactored.user.js', // Output filename
    // Configure Rollup options if needed
    // rollupOptions: {
    //   external: ['GM_xmlhttpRequest', 'unsafeWindow', 'OpenCC', 'JSZip', 'FileSaver', 'saveAs'], // Mark GM functions and @require globals as external
    // },
  },
  userscript: {
    namespace: 'wenku8HaoaRefactored',
    name: '轻小说文库下载 (优化版)',
    version: '2.3.0', // Update version as needed
    description: '优化版：生成分卷和全本ePub文档、ePub文档插图拖放、部分小说的在线阅读。提升了代码结构、可读性和可维护性。',
    author: 'HaoaW (Original), GeminiPro (Refactor)',
    icon: 'https://www.wenku8.net/favicon.ico',
    match: [
      '*://www.wenku8.net/*',
      '*://www.wenku8.cc/*',
      '*://www.wenku8.com/*', // Add .com mirror if exists/needed
    ],
    connect: [ // Domains script might connect to
      'wenku8.com', // For book info, reviews
      'wenku8.cc', // For book info, reviews
      'app.wenku8.com', // App API
      'dl.wenku8.com', // Text downloads
      'img.wenku8.com', // Image downloads
      '777743.xyz', // If this domain is still used
    ],
    grant: [
      'GM_xmlhttpRequest',
      // Add other grants used, e.g., GM_getValue, GM_setValue if implementing persistence
    ],
    require: [
      // Ensure correct URLs for required libraries
      'https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.js',
      'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', // Recommended newer version and minified
      'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js', // Minified
    ],
    // Add @noframes if script should not run inside iframes
    // noframes: true,
  },
})
