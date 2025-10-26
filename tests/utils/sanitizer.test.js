const {
  sanitizeUrl,
  sanitizeObject,
  sanitizeError,
  sanitizeString,
  sanitizeRequest
} = require('../../src/utils/sanitizer');

describe('Sanitizer Utility', () => {
  describe('sanitizeUrl', () => {
    it('should redact API keys in query parameters', () => {
      const url = 'https://api.example.com/data?api_key=secret123&other=value';
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toContain('%5BREDACTED%5D'); // URL-encoded [REDACTED]
      expect(sanitized).toContain('other=value');
      expect(sanitized).not.toContain('secret123');
    });

    it('should redact various token parameters', () => {
      const url = 'https://api.example.com/data?token=abc123&access_token=xyz789';
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toContain('%5BREDACTED%5D'); // URL-encoded [REDACTED]
      expect(sanitized).not.toContain('abc123');
      expect(sanitized).not.toContain('xyz789');
    });

    it('should remove credentials from URL', () => {
      const url = 'https://user:password@example.com/path';
      const sanitized = sanitizeUrl(url);
      expect(sanitized).not.toContain('user');
      expect(sanitized).not.toContain('password');
      expect(sanitized).toContain('example.com/path');
    });

    it('should handle URLs without sensitive data', () => {
      const url = 'https://example.com/path?page=1&limit=10';
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toBe(url);
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-url';
      const sanitized = sanitizeUrl(invalidUrl);
      expect(sanitized).toBe(invalidUrl);
    });

    it('should handle null/undefined', () => {
      expect(sanitizeUrl(null)).toBe(null);
      expect(sanitizeUrl(undefined)).toBe(undefined);
    });
  });

  describe('sanitizeObject', () => {
    it('should redact password fields', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com'
      };
      const sanitized = sanitizeObject(obj);
      expect(sanitized.username).toBe('john');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.email).toBe('john@example.com');
    });

    it('should redact API keys', () => {
      const obj = {
        apiKey: 'abc123',
        api_key: 'xyz789',
        data: 'public'
      };
      const sanitized = sanitizeObject(obj);
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.api_key).toBe('[REDACTED]');
      expect(sanitized.data).toBe('public');
    });

    it('should sanitize nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret',
            token: 'abc123'
          }
        }
      };
      const sanitized = sanitizeObject(obj);
      expect(sanitized.user.name).toBe('John');
      expect(sanitized.user.credentials.password).toBe('[REDACTED]');
      expect(sanitized.user.credentials.token).toBe('[REDACTED]');
    });

    it('should sanitize URLs in objects', () => {
      const obj = {
        url: 'https://api.example.com?api_key=secret',
        title: 'Example'
      };
      const sanitized = sanitizeObject(obj);
      expect(sanitized.url).toContain('%5BREDACTED%5D'); // URL-encoded [REDACTED]
      expect(sanitized.url).not.toContain('secret');
      expect(sanitized.title).toBe('Example');
    });

    it('should handle arrays', () => {
      const obj = {
        items: [
          { name: 'item1', password: 'secret1' },
          { name: 'item2', token: 'secret2' }
        ]
      };
      const sanitized = sanitizeObject(obj);
      expect(sanitized.items[0].password).toBe('[REDACTED]');
      expect(sanitized.items[1].token).toBe('[REDACTED]');
      expect(sanitized.items[0].name).toBe('item1');
    });

    it('should accept custom sensitive keys', () => {
      const obj = {
        ssn: '123-45-6789',
        name: 'John'
      };
      const sanitized = sanitizeObject(obj, ['ssn']);
      expect(sanitized.ssn).toBe('[REDACTED]');
      expect(sanitized.name).toBe('John');
    });
  });

  describe('sanitizeString', () => {
    it('should redact email addresses', () => {
      const str = 'Contact us at support@example.com for help';
      const sanitized = sanitizeString(str);
      expect(sanitized).toContain('[EMAIL_REDACTED]');
      expect(sanitized).not.toContain('support@example.com');
    });

    it('should redact IP addresses', () => {
      const str = 'Server IP: 192.168.1.100';
      const sanitized = sanitizeString(str);
      expect(sanitized).toContain('[IP_REDACTED]');
      expect(sanitized).not.toContain('192.168.1.100');
    });

    it('should redact long alphanumeric strings (potential API keys)', () => {
      const str = 'API Key: test_' + 'live_' + 'abc123xyz456';
      const sanitized = sanitizeString(str);
      expect(sanitized).toContain('[KEY_REDACTED]');
      expect(sanitized).not.toContain('abc123xyz456');
    });

    it('should redact JWT tokens', () => {
      const str = 'Token: eyJhbGci' + 'OiJIUzI1' + 'NiIsInR5cCI6IkpXVCJ9.test.signature';
      const sanitized = sanitizeString(str);
      expect(sanitized).toContain('[JWT_REDACTED]');
      expect(sanitized).not.toContain('eyJhbGci');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeString(null)).toBe(null);
      expect(sanitizeString(undefined)).toBe(undefined);
    });
  });

  describe('sanitizeError', () => {
    it('should sanitize Error objects', () => {
      const error = new Error('Failed to connect to https://user:pass@api.example.com');
      const sanitized = sanitizeError(error);
      expect(sanitized.name).toBe('Error');
      expect(sanitized.message).toBeDefined();
      expect(sanitized.message).not.toContain('user:pass');
    });

    it('should sanitize custom error properties', () => {
      const error = new Error('Auth failed');
      error.apiKey = 'secret123';
      error.url = 'https://api.example.com';
      const sanitized = sanitizeError(error);
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.url).toBe('https://api.example.com/');
    });
  });

  describe('sanitizeRequest', () => {
    it('should sanitize Express request objects', () => {
      const req = {
        method: 'POST',
        url: '/api/scan?api_key=secret',
        originalUrl: '/api/scan?api_key=secret',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'authorization': 'Bearer abc123',
          'content-type': 'application/json'
        },
        query: { api_key: 'secret' },
        body: { url: 'https://example.com', password: 'pass123' },
        ip: '192.168.1.1',
        requestId: 'req-123'
      };

      const sanitized = sanitizeRequest(req);
      
      expect(sanitized.method).toBe('POST');
      expect(sanitized.url).toContain('[REDACTED]');
      expect(sanitized.url).not.toContain('secret');
      expect(sanitized.headers.authorization).toBe('[REDACTED]');
      expect(sanitized.headers['user-agent']).toBe('Mozilla/5.0');
      expect(sanitized.query.api_key).toBe('[REDACTED]');
      expect(sanitized.body.password).toBe('[REDACTED]');
      expect(sanitized.body.url).toBe('https://example.com/');
      expect(sanitized.requestId).toBe('req-123');
    });
  });
});
