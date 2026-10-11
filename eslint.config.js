const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: ['dist/**', 'supabase/**', 'docs/**', 'data/**', 'artifacts/**', 'node_modules/**'],
  },
]);
