/**
 * Tests for Error Telemetry Service
 */

const { ErrorTelemetry, errorTelemetry } = require('../../src/utils/errorTelemetry');

describe('Error Telemetry Service', () => {
  let telemetry;

  beforeEach(() => {
    telemetry = new ErrorTelemetry({
      maxErrors: 100,
      maxAggregations: 50,
      retentionHours: 24
    });
    telemetry.stopCleanup();
  });

  afterEach(() => {
    if (telemetry) {
      telemetry.stopCleanup();
      telemetry.clear();
    }
  });

  describe('recordError', () => {
    it('should record an error with details', () => {
      const error = new Error('Test error');
      const errorId = telemetry.recordError(error, { requestId: 'req123' });

      expect(errorId).toBeDefined();
      expect(errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(telemetry.errors).toHaveLength(1);
    });

    it('should handle null error', () => {
      const errorId = telemetry.recordError(null);
      expect(errorId).toBeNull();
    });
  });

  describe('getStatistics', () => {
    it('should return statistics', () => {
      telemetry.recordError(new Error('Error 1'));
      telemetry.recordError(new TypeError('Error 2'));

      const stats = telemetry.getStatistics();
      expect(stats.summary.total).toBe(2);
    });
  });

  describe('getErrorRates', () => {
    it('should return error rates', () => {
      telemetry.recordError(new Error('Error 1'));
      
      const rates = telemetry.getErrorRates();
      expect(rates).toHaveProperty('lastMinute');
      expect(rates).toHaveProperty('rates');
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      telemetry.recordError(new Error('Error 1'));
      telemetry.clear();
      
      expect(telemetry.errors).toHaveLength(0);
    });
  });
});

describe('Singleton', () => {
  beforeAll(() => {
    errorTelemetry.stopCleanup();
  });

  afterAll(() => {
    errorTelemetry.stopCleanup();
    errorTelemetry.clear();
  });

  it('should work as singleton', () => {
    expect(errorTelemetry).toBeInstanceOf(ErrorTelemetry);
  });
});
