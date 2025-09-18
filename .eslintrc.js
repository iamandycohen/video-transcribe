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
    // Proper rules for clean codebase
    '@typescript-eslint/no-explicit-any': 'warn', // Keep as warn for now
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-unused-vars': 'off', // Let TypeScript handle this
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-inferrable-types': 'off',
    'no-console': 'off', // Allow console.log for logging
    'prefer-const': 'error',
    'no-var': 'error',
    'no-undef': 'off', // TypeScript handles this
    'no-useless-escape': 'error',
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
