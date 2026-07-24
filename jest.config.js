// jest.config.js
// Jest configuration for server, plugins, and client navigation unit tests

module.exports = {
  testEnvironment: 'node',
  roots: [
    '<rootDir>/server',
    '<rootDir>/plugins',
    '<rootDir>/tools/workflow-runner',
    '<rootDir>/client/src/core',
    '<rootDir>/client/src/plugins/guides',
    '<rootDir>/client/src/plugins/ai-providers',
    '<rootDir>/client/src/plugins/teams',
    '<rootDir>/client/src/plugins/tasks',
    '<rootDir>/client/src/plugins/notes',
    '<rootDir>/client/src/plugins/slots',
    '<rootDir>/client/src/plugins/requests',
    '<rootDir>/client/src/plugins/contacts',
    '<rootDir>/client/src/plugins/ingest',
    '<rootDir>/client/src/plugins/estimates',
    '<rootDir>/client/src/plugins/matches',
    '<rootDir>/client/src/plugins/files',
    '<rootDir>/client/src/plugins/cups',
  ],
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
