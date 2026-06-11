import tseslint from 'typescript-eslint'
import prettierRecommended from 'eslint-plugin-prettier/recommended'

export default tseslint.config(
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    rules: {
      'prettier/prettier': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      'no-extra-boolean-cast': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'no-use-before-define': 'warn',
      radix: 'warn',
      'no-multiple-empty-lines': 'error',
      'padded-blocks': ['error', { blocks: 'never' }],
      'space-before-blocks': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: ['src/vendor/**/*', 'src/svg-icon/**/*'],
  }
)
