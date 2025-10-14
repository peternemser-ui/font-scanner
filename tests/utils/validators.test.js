const { validateUrl } = require('../../src/utils/validators');

describe('Validators', () => {
  describe('validateUrl', () => {
    it('should validate valid HTTP URLs', () => {
      expect(validateUrl('http://example.com')).toBe(true);
      expect(validateUrl('http://www.example.com')).toBe(true);
      expect(validateUrl('http://example.com/path')).toBe(true);
    });

    it('should validate valid HTTPS URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('https://www.example.com')).toBe(true);
      expect(validateUrl('https://example.com/path')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('ftp://example.com')).toBe(false);
      expect(validateUrl('')).toBe(false);
      expect(validateUrl(null)).toBe(false);
      expect(validateUrl(undefined)).toBe(false);
    });

    it('should handle URLs with query parameters', () => {
      expect(validateUrl('https://example.com?param=value')).toBe(true);
    });

    it('should handle URLs with fragments', () => {
      expect(validateUrl('https://example.com#section')).toBe(true);
    });
  });
});
