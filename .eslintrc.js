module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
  ],
  env: {
    node: true,
    es2020: true,
  },
  rules: {
    // Temporarily relax rules for existing codebase
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-unused-vars': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-inferrable-types': 'off',
    'no-console': 'off', // Allow console.log for logging
    'prefer-const': 'warn',
    'no-var': 'error',
    'no-undef': 'off', // TypeScript handles this
    'no-useless-escape': 'warn',
  },
  ignorePatterns: [
    'dist/**/*',
    'node_modules/**/*',
    '*.js',
    '*.d.ts',
    'test-*.js',
    'example-*.js',
  ],
};
