const { Logger, createLogger, LOG_LEVELS } = require('../../src/utils/logger');

describe('Logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Logger instance', () => {
    it('should create a logger with context', () => {
      const logger = new Logger('TestContext');
      expect(logger.context).toBe('TestContext');
    });

    it('should log info messages', () => {
      const logger = new Logger('Test');
      logger.info('Test message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const logger = new Logger('Test');
      logger.error('Error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const logger = new Logger('Test');
      logger.warn('Warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should include data in log messages', () => {
      const logger = new Logger('Test');
      const testData = { key: 'value' };
      logger.info('Message with data', testData);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(testData))
      );
    });
  });

  describe('createLogger factory', () => {
    it('should create a logger instance', () => {
      const logger = createLogger('Factory');
      expect(logger).toBeInstanceOf(Logger);
      expect(logger.context).toBe('Factory');
    });
  });

  describe('LOG_LEVELS', () => {
    it('should export log levels', () => {
      expect(LOG_LEVELS).toEqual({
        ERROR: 'ERROR',
        WARN: 'WARN',
        INFO: 'INFO',
        DEBUG: 'DEBUG',
      });
    });
  });
});
