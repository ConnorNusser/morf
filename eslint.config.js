// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', '*.js'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // Console allowed — it's the logging channel in React Native
      'no-console': 'off',

      // Explicit any allowed — pragmatic for RN/3rd-party typing gaps
      '@typescript-eslint/no-explicit-any': 'off',

      // Unused vars downgraded off — avoids churning intentional WIP stubs
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]);
