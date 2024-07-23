import { defineConfig } from 'vite'
import monkey, { cdn, util } from 'vite-plugin-monkey'
import AutoImport from 'unplugin-auto-import/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    AutoImport({
      imports: [util.unimportPreset],
    }),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        icon: 'https://www.wenku8.net/favicon.ico',
        namespace: 'wenku8Haoa',
        match: ['*://www.wenku8.net/*', '*://www.wenku8.cc/*'],
        require: [
          // 'https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.js',
          // 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
          // 'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js',
        ],
      },
      server: {
        mountGmApi: true,
      },
      build: {
        externalGlobals: {
          // @require      https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.js
          // @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
          // @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
          'OpenCC': cdn.jsdelivr('opencc-js', 'umd/full.js'),
          'JSZip': cdn.jsdelivr('jszip', 'dist/jszip.min.js'),
          'file-saver': cdn.jsdelivr('file-saver', 'dist/FileSaver.min.js'),
        },
      },
    }),
  ],
})
