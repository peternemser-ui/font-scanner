const {
  makeReportId,
  normalizeUrlForReportId,
  roundTimestampToMinute,
  hashForStorageKey,
  isSafeReportId,
} = require('../../src/utils/reportId');

describe('reportId', () => {
  const fixedTimestamp = '2024-01-15T10:30:45.123Z';
  const roundedTimestamp = '2024-01-15T10:30:00.000Z';

  describe('makeReportId', () => {
    it('should generate valid reportId format', () => {
      const id = makeReportId({
        analyzerKey: 'seo',
        normalizedUrl: 'https://example.com',
        startedAtISO: fixedTimestamp,
      });
      expect(id).toMatch(/^r_[a-f0-9]{16}$/);
      expect(isSafeReportId(id)).toBe(true);
    });

    it('should return empty string for missing inputs', () => {
      expect(makeReportId({ analyzerKey: '', normalizedUrl: 'https://example.com', startedAtISO: fixedTimestamp })).toBe('');
      expect(makeReportId({ analyzerKey: 'seo', normalizedUrl: '', startedAtISO: fixedTimestamp })).toBe('');
      expect(makeReportId({ analyzerKey: 'seo', normalizedUrl: 'https://example.com', startedAtISO: '' })).toBe('');
    });

    it('should be deterministic for same inputs', () => {
      const id1 = makeReportId({ analyzerKey: 'seo', normalizedUrl: 'https://example.com', startedAtISO: fixedTimestamp });
      const id2 = makeReportId({ analyzerKey: 'seo', normalizedUrl: 'https://example.com', startedAtISO: fixedTimestamp });
      expect(id1).toBe(id2);
    });
  });

  describe('collision prevention', () => {
    it('different URLs produce different reportIds', () => {
      const id1 = makeReportId({ analyzerKey: 'seo', normalizedUrl: 'https://a.com', startedAtISO: fixedTimestamp });
      const id2 = makeReportId({ analyzerKey: 'seo', normalizedUrl: 'https://b.com', startedAtISO: fixedTimestamp });
      expect(id1).not.toBe(id2);
    });

    it('same URL different analyzers produce different reportIds', () => {
      const id1 = makeReportId({ analyzerKey: 'seo', normalizedUrl: 'https://example.com', startedAtISO: fixedTimestamp });
      const id2 = makeReportId({ analyzerKey: 'security', normalizedUrl: 'https://example.com', startedAtISO: fixedTimestamp });
      expect(id1).not.toBe(id2);
    });

    it('same URL and analyzer at different times produce different reportIds', () => {
      const id1 = makeReportId({ analyzerKey: 'seo', normalizedUrl: 'https://example.com', startedAtISO: '2024-01-15T10:30:00.000Z' });
      const id2 = makeReportId({ analyzerKey: 'seo', normalizedUrl: 'https://example.com', startedAtISO: '2024-01-15T10:31:00.000Z' });
      expect(id1).not.toBe(id2);
    });

    it('timestamps within same minute produce same reportId (rounded)', () => {
      const id1 = makeReportId({ analyzerKey: 'seo', normalizedUrl: 'https://example.com', startedAtISO: '2024-01-15T10:30:00.000Z' });
      const id2 = makeReportId({ analyzerKey: 'seo', normalizedUrl: 'https://example.com', startedAtISO: '2024-01-15T10:30:45.999Z' });
      expect(id1).toBe(id2);
    });
  });

  describe('normalizeUrlForReportId', () => {
    it('should lowercase hostname', () => {
      expect(normalizeUrlForReportId('https://EXAMPLE.COM')).toBe('https://example.com');
      expect(normalizeUrlForReportId('https://Example.Com/Path')).toBe('https://example.com/Path');
    });

    it('should strip default port 443 for https', () => {
      expect(normalizeUrlForReportId('https://example.com:443')).toBe('https://example.com');
      expect(normalizeUrlForReportId('https://example.com:443/path')).toBe('https://example.com/path');
    });

    it('should strip default port 80 for http', () => {
      expect(normalizeUrlForReportId('http://example.com:80')).toBe('http://example.com');
      expect(normalizeUrlForReportId('http://example.com:80/path')).toBe('http://example.com/path');
    });

    it('should keep non-default ports', () => {
      expect(normalizeUrlForReportId('https://example.com:8443')).toBe('https://example.com:8443');
      expect(normalizeUrlForReportId('http://example.com:8080')).toBe('http://example.com:8080');
    });

    it('should remove trailing slash from root path', () => {
      expect(normalizeUrlForReportId('https://example.com/')).toBe('https://example.com');
    });

    it('should remove trailing slash from non-root paths', () => {
      expect(normalizeUrlForReportId('https://example.com/path/')).toBe('https://example.com/path');
    });

    it('should sort query parameters for consistent ordering', () => {
      const url1 = normalizeUrlForReportId('https://example.com?a=1&b=2');
      const url2 = normalizeUrlForReportId('https://example.com?b=2&a=1');
      expect(url1).toBe(url2);
      expect(url1).toBe('https://example.com?a=1&b=2');
    });

    it('should add https protocol if missing', () => {
      expect(normalizeUrlForReportId('example.com')).toBe('https://example.com');
      expect(normalizeUrlForReportId('example.com/path')).toBe('https://example.com/path');
    });

    it('should handle empty input', () => {
      expect(normalizeUrlForReportId('')).toBe('');
      expect(normalizeUrlForReportId(null)).toBe('');
      expect(normalizeUrlForReportId(undefined)).toBe('');
    });

    it('URL normalization prevents collisions from URL variations', () => {
      // These should all normalize to the same URL
      const url1 = normalizeUrlForReportId('https://example.com:443/');
      const url2 = normalizeUrlForReportId('https://example.com');
      const url3 = normalizeUrlForReportId('HTTPS://EXAMPLE.COM/');
      expect(url1).toBe(url2);
      expect(url2).toBe(url3);
    });

    it('query param order does not cause collision', () => {
      const url1 = normalizeUrlForReportId('https://example.com?a=1&b=2&c=3');
      const url2 = normalizeUrlForReportId('https://example.com?c=3&a=1&b=2');
      const url3 = normalizeUrlForReportId('https://example.com?b=2&c=3&a=1');
      expect(url1).toBe(url2);
      expect(url2).toBe(url3);
    });
  });

  describe('roundTimestampToMinute', () => {
    it('should round seconds and milliseconds to zero', () => {
      expect(roundTimestampToMinute('2024-01-15T10:30:45.123Z')).toBe('2024-01-15T10:30:00.000Z');
      expect(roundTimestampToMinute('2024-01-15T10:30:59.999Z')).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle already rounded timestamps', () => {
      expect(roundTimestampToMinute('2024-01-15T10:30:00.000Z')).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle empty input', () => {
      expect(roundTimestampToMinute('')).toBe('');
      expect(roundTimestampToMinute(null)).toBe('');
      expect(roundTimestampToMinute(undefined)).toBe('');
    });
  });

  describe('hashForStorageKey', () => {
    it('should generate consistent hash for same input', () => {
      expect(hashForStorageKey('test')).toBe(hashForStorageKey('test'));
    });

    it('should generate different hash for different inputs', () => {
      expect(hashForStorageKey('test1')).not.toBe(hashForStorageKey('test2'));
    });

    it('should return alphanumeric string', () => {
      const hash = hashForStorageKey('https://example.com');
      expect(hash).toMatch(/^[a-z0-9]+$/);
    });

    it('should handle empty input', () => {
      expect(hashForStorageKey('')).toBe('0');
      expect(hashForStorageKey(null)).toBe('0');
      expect(hashForStorageKey(undefined)).toBe('0');
    });
  });

  describe('isSafeReportId', () => {
    it('should return true for valid reportIds', () => {
      expect(isSafeReportId('r_0123456789abcdef')).toBe(true);
      expect(isSafeReportId('r_ABCDEF0123456789')).toBe(true);
    });

    it('should return false for invalid reportIds', () => {
      expect(isSafeReportId('')).toBe(false);
      expect(isSafeReportId('r_short')).toBe(false);
      expect(isSafeReportId('r_toolongtobevalid123')).toBe(false);
      expect(isSafeReportId('invalid_format')).toBe(false);
      expect(isSafeReportId(null)).toBe(false);
      expect(isSafeReportId(undefined)).toBe(false);
    });
  });
});
