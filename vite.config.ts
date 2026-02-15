import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'
import monkey, { util } from 'vite-plugin-monkey'
import Package from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    AutoImport({
      dts: 'src/auto-imports.d.ts',
      imports: [
        util.unimportPreset,
      ],
      dirs: [
        'src/modules/**',
        'src/coordinator/**',
        'src/constants.js',
      ],
    }),
    monkey({
      entry: 'src/main.js',
      userscript: {
        namespace: Package.name,
        name: Package.displayName,
        version: Package.version, // Update version as needed
        description: Package.description,
        author: Package.author,
        icon: 'https://www.wenku8.net/favicon.ico',
        match: ['*://www.wenku8.net/*', '*://www.wenku8.cc/*'],
        require: [
          // 'https://cdn.jsdelivr.net/npm/jszip@2.6.1/dist/jszip.min.js',  // add on build
          // 'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js', // add on build
        ],
        connect: [
          'wenku8.com', // For book info, reviews
          'wenku8.cc', // For book info, reviews
          'app.wenku8.com', // App API
          'dl.wenku8.com', // Text downloads
          'img.wenku8.com', // Image downloads
          '777743.xyz', // Alternate image host root
          'pic.777743.xyz', // Alternate image host
        ],
        grant: [
          'GM_xmlhttpRequest',
          'GM_info',
          'unsafeWindow',
        ],
      },
      server: {
        mountGmApi: true,
      },
      build: {
        externalGlobals: {
          'jszip': ['JSZip', 'https://cdn.jsdelivr.net/npm/jszip@2.6.1/dist/jszip.min.js'],
          // 'file-saver': ['FileSaver', 'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js'],
        },
      },
    }),
  ],
})
