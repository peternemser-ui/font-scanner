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
  // Run tests sequentially to prevent SQLite mock cross-contamination.
  // Multiple test files mock ../../src/db with different in-memory databases;
  // parallel workers can cause FK constraint violations and stale DB references.
  maxWorkers: 1,
  forceExit: true,
};
