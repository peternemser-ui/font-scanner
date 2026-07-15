module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/public/**',
    '!src/**/*.test.js',
  ],
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  verbose: true,
  testTimeout: 10000,
  // Suites are isolated by Postgres schema (see tests/helpers/testSetup.js), so
  // they no longer share state. Kept at 1 because each test file mocks
  // ../../src/db with its own instance and jest module state is per-worker;
  // raise this only after verifying no suite depends on serial execution.
  maxWorkers: 1,
  forceExit: true,
};
