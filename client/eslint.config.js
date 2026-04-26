import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

const browserGlobals = {
  AbortSignal: 'readonly',
  console: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  URLSearchParams: 'readonly',
  window: 'readonly',
}

export default [
  {
    ignores: ['dist/**'],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
    },
  },
]
