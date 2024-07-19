import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  stylistic: {
    indent: 2, // 4, or 'tab'
    quotes: 'single', // or 'double'
  },

  typescript: {
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
