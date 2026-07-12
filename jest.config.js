// jest.config.js
// Jest configuration for server, plugins, and client navigation unit tests

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/server', '<rootDir>/plugins', '<rootDir>/client/src/core'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).js',
    '**/?(*.)+(spec|test).ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/__archive__/'],
  collectCoverageFrom: [
    'server/**/*.js',
    'plugins/**/*.js',
    '!server/**/__tests__/**',
    '!server/**/*.test.js',
    '!plugins/**/__tests__/**',
    '!plugins/**/*.test.js',
    '!server/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  setupFilesAfterEnv: [],
  moduleDirectories: ['node_modules', '<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          jsx: 'react-jsx',
          baseUrl: '.',
          paths: {
            '@/*': ['client/src/*'],
          },
        },
      },
    ],
  },
};
