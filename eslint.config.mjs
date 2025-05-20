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
      'no-console': ['warn'],
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
    },
  },
  jsonc: false,
  yaml: false,

  ignores: [
    '**/fixtures',
    // ...globs
  ],
})
