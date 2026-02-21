import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  stylistic: {
    indent: 2, // 4, or 'tab'
    quotes: 'single', // or 'double'
  },

  javascript: {
    overrides: {
      'no-undef': ['off'],
      'unused-imports/no-unused-vars': ['warn'],
      'no-unused-vars': ['off'],
      'no-console': ['off'],
    },
    extends: [
      './.eslintrc-auto-import.json',
    ],
  },

  typescript: {
    tsconfigPath: 'tsconfig.json',
    overrides: {
      'no-use-before-define': ['off'],
      '@typescript-eslint/no-use-before-define': ['off'],
      'no-console': ['off'],
      'ts/ban-ts-comment': ['off'],
      'ts/explicit-function-return-type': ['off'],
      'ts/no-floating-promises': ['off'],
      'ts/no-misused-promises': ['off'],
      'ts/no-unsafe-argument': ['off'],
      'ts/no-unsafe-assignment': ['off'],
      'ts/no-unsafe-call': ['off'],
      'ts/no-unsafe-member-access': ['off'],
      'ts/no-unsafe-return': ['off'],
      'ts/strict-boolean-expressions': ['off'],
    },
  },
  jsonc: false,
  yaml: false,

  ignores: [
    '**/fixtures',
    'lib/FileSaver.js',
    'src/coordinator/epubBuilderCoordinator.ts',
    'src/main.ts',
    'src/modules/appApiService.ts',
    'src/modules/epubBuilder.ts',
    'src/modules/epubEditor.ts',
    'src/modules/uiLogger.ts',
    'src/modules/volumeLoader.ts',
    'src/modules/xhrManager.ts',
    // ...globs
  ],
})
