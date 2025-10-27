// eslint.config.cjs — Flat config för ESLint v9 (tuned för TypeScript + React)
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const importPlugin = require('eslint-plugin-import');
const prettierPlugin = require('eslint-plugin-prettier');
const globals = require('globals');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // 1) Ignorera mappar/filer (ersätter .eslintignore)
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'client/dist/**',
      'build/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.min.*',
      '**/vendor/**',
      // lägg till fler vid behov
    ],
  },

  // 2) Basrekommendationer för JS
  js.configs.recommended,

  // 3) Gemensam TS/React-konfiguration (client + server)
  {
    files: ['client/src/**/*.{ts,tsx}', 'server/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        // Vill du ha “type-aware” regler senare, lägg till project: ['./tsconfig.json', './tsconfig.node.json']
      },
      // Globala variabler
      globals: {
        ...globals.browser, // för client-kod
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      import: importPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        // TS-alias och paths
        typescript: {
          project: ['./tsconfig.json', './tsconfig.node.json'],
          alwaysTryTypes: true,
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      // hjälpsamt om du använder "@/*"
      'import/internal-regex': '^@/',
    },
    rules: {
      // ======= Grundtoning för att få ned felmängden =======
      // Låt TS ta detta i stället:
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-use-before-define': 'off',
      '@typescript-eslint/no-redeclare': 'warn',
      '@typescript-eslint/no-use-before-define': 'off',

      // Imports (alias, extraneous m.m.)
      'import/no-unresolved': 'off', // TS-resolver sköter detta
      'import/named': 'off',
      'import/no-extraneous-dependencies': 'off',

      // TS-striktisar – börja mjukt
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',

      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-constructed-context-values': 'off',
      'react/no-unstable-nested-components': 'off',
      'react/no-array-index-key': 'warn',

      // Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Stil/”quality of life”
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: 'warn',
      curly: 'warn',

      // Prettier
      'prettier/prettier': 'warn',
    },
  },

  // 4) Server-specifika globals (Node)
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // lägg server-specifika regler här vid behov
    },
  },
];
