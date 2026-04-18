import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    plugins: {
      'react-hooks': pluginReactHooks,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // Security: Prevent unsafe DOM manipulation
      // These rules prevent XSS vulnerabilities by banning dangerous DOM APIs
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression > Identifier[name='innerHTML']",
          message: 'Use textContent or createElement instead to prevent XSS. If you must use innerHTML, use DOMPurify.sanitize() first.',
        },
        {
          selector: "MemberExpression > Identifier[name='outerHTML']",
          message: 'Use textContent or createElement instead to prevent XSS.',
        },
        {
          selector: "CallExpression[callee.name='insertAdjacentHTML']",
          message: 'Use textContent or createElement instead to prevent XSS.',
        },
        {
          selector: "CallExpression[callee.name='document.write']",
          message: 'document.write() is deprecated and can cause security issues. Use DOM manipulation methods instead.',
        },
      ],
      
      // Enforce safe DOM patterns
      'no-restricted-properties': [
        'error',
        {
          object: 'Element',
          property: 'innerHTML',
          message: 'Use textContent for text content or createElement with appendChild for HTML content.',
        },
        {
          object: 'HTMLElement',
          property: 'innerHTML',
          message: 'Use textContent for text content or createElement with appendChild for HTML content.',
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'android/**', 'public/**'],
  },
];
