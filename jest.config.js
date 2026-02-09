// jest.config.js
// Jest configuration for V2 testing

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/server'],
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/**/__tests__/**',
    '!server/**/*.test.js',
    '!server/index.ts', // TypeScript entry point
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  // Setup files
  setupFilesAfterEnv: [],
  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>'],
  // Transform (if needed for TypeScript)
  // transform: {
  //   '^.+\\.ts$': 'ts-jest',
  // },
};
