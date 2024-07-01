module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'jest',
  ],
  globals: {
    module: 'writable'
  },
  rules: {
    quotes: ['error', 'single', { 'avoidEscape': true }],
    semi: [2, 'always'],
    indent: ['error', 2, { 'SwitchCase': 1 }],
    'keyword-spacing': 'error',
    'object-curly-spacing': ['warn', 'always', { 'objectsInObjects': false }],
    'max-len': [1, { code: 120 }],
    'no-trailing-spaces': 'warn',
    'no-multiple-empty-lines': ['warn', { 'max': 1 }],
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  overrides: [{
    files: ['*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'max-len': 'off',
    }
  }],
  env: {
    node: true
  }
};
