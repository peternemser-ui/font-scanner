# Log Sanitization

## Overview

The Font Scanner application automatically sanitizes all log output to prevent exposure of sensitive information. This is critical for production deployments where logs may be stored, transmitted, or accessed by multiple parties.

## What Gets Sanitized

### Automatic Sanitization

The logger automatically redacts the following sensitive data:

#### 1. **URL Parameters**
- API keys: `api_key`, `apikey`, `api-key`
- Tokens: `token`, `access_token`, `auth_token`, `bearer`
- Secrets: `secret`, `api_secret`
- Passwords: `password`, `pass`, `pwd`
- Session IDs: `session`, `sessionid`, `session_id`
- OAuth tokens: `oauth`, `oauth_token`
- Client secrets: `client_secret`

**Example:**
```javascript
// Before sanitization
logger.info('API call', { url: 'https://api.example.com?api_key=secret123' });

// After sanitization (logged as)
[INFO] API call {"url":"https://api.example.com?api_key=%5BREDACTED%5D"}
```

#### 2. **URL Credentials**
Username and password in URLs are removed:

```javascript
// Before
'https://user:password@api.example.com/path'

// After
'https://api.example.com/path'
```

#### 3. **Object Fields**
Sensitive keys in objects are automatically redacted:
- `password`, `pwd`, `pass`
- `secret`, `api_secret`, `apiSecret`
- `token`, `access_token`, `auth_token`
- `apiKey`, `api_key`
- `privateKey`, `private_key`
- `credentials`, `authorization`, `auth`
- `sessionId`, `session_id`
- `clientSecret`, `client_secret`

**Example:**
```javascript
// Before
logger.info('User login', { 
  username: 'john',
  password: 'secret123',
  apiKey: 'abc456'
});

// After  
[INFO] User login {"username":"john","password":"[REDACTED]","apiKey":"[REDACTED]"}
```

#### 4. **String Patterns**
Sensitive patterns in strings are redacted:
- **Email addresses**: `[EMAIL_REDACTED]`
- **IP addresses**: `[IP_REDACTED]`
- **Long alphanumeric strings** (potential API keys): `[KEY_REDACTED]`
- **JWT tokens**: `[JWT_REDACTED]`

**Example:**
```javascript
logger.info('Contact email: support@example.com, API key: sk_live_abc123def456...');
// Logged as: "Contact email: [EMAIL_REDACTED], API key: [KEY_REDACTED]"
```

#### 5. **Error Objects**
Error messages and stack traces are sanitized:

```javascript
try {
  await fetch('https://api.example.com?token=secret');
} catch (error) {
  logger.error('API failed', error);
  // Token is redacted in error message and stack trace
}
```

## Usage

### Basic Logging (Automatic Sanitization)

Sanitization happens automatically - just use the logger normally:

```javascript
const logger = require('./utils/logger').createLogger('MyModule');

// All of these are automatically sanitized
logger.info('Starting scan', { 
  url: 'https://example.com?api_key=secret',
  user: { password: 'pass123' }
});

logger.error('Auth failed', { 
  token: 'bearer_abc123',
  credentials: { apiKey: 'key456' }
});
```

### Manual Sanitization

If you need to sanitize data before passing it elsewhere (not logging), use the sanitizer utilities directly:

```javascript
const { 
  sanitizeUrl,
  sanitizeObject,
  sanitizeString 
} = require('./utils/sanitizer');

// Sanitize a URL
const safeUrl = sanitizeUrl('https://api.com?api_key=secret');

// Sanitize an object
const safeData = sanitizeObject({
  username: 'john',
  password: 'secret'
});

// Sanitize a string
const safeMessage = sanitizeString('Email: user@example.com');
```

### Custom Sensitive Keys

Add custom keys to sanitize:

```javascript
const { sanitizeObject } = require('./utils/sanitizer');

const data = {
  ssn: '123-45-6789',
  taxId: 'ABC123',
  name: 'John'
};

// Add 'ssn' and 'taxId' as sensitive
const sanitized = sanitizeObject(data, ['ssn', 'taxId']);
// Result: { ssn: '[REDACTED]', taxId: '[REDACTED]', name: 'John' }
```

## Configuration

### Disable Sanitization (Development Only)

You can disable sanitization for local development debugging:

```bash
# .env
DISABLE_LOG_SANITIZATION=true
```

**⚠️ WARNING**: Never disable sanitization in production!

### Log Level

Control what gets logged:

```bash
# .env
LOG_LEVEL=INFO  # Options: ERROR, WARN, INFO, DEBUG
```

## Security Best Practices

### 1. Never Log Sensitive Data Directly

Even with sanitization, avoid logging sensitive data when possible:

```javascript
// ❌ Bad - Don't log passwords at all
logger.info('User login attempt', { password: user.password });

// ✅ Good - Don't include password
logger.info('User login attempt', { username: user.username });
```

### 2. Use Sanitization for All External Output

If you're sending data to external systems (monitoring, analytics), sanitize it:

```javascript
const { sanitizeObject } = require('./utils/sanitizer');

// Before sending to external monitoring
const safeMetrics = sanitizeObject(metrics);
await monitoring.send(safeMetrics);
```

### 3. Review Logs Regularly

Audit your logs periodically to ensure no sensitive data is leaking:

```bash
# Search for potential issues in logs
grep -i "password\|token\|secret" logs/*.log
```

### 4. Rotate and Secure Log Files

- Store logs securely with appropriate access controls
- Rotate logs regularly to limit exposure window
- Encrypt logs at rest and in transit

## Testing

The sanitizer has comprehensive tests. Run them:

```bash
npm test -- sanitizer.test.js
```

## API Reference

### `sanitizeUrl(url)`
Sanitizes a URL by removing credentials and redacting sensitive query parameters.

**Parameters:**
- `url` (string): The URL to sanitize

**Returns:** (string) Sanitized URL

### `sanitizeObject(obj, sensitiveKeys?)`
Recursively sanitizes an object by redacting sensitive fields.

**Parameters:**
- `obj` (Object): The object to sanitize
- `sensitiveKeys` (Array<string>, optional): Additional sensitive keys

**Returns:** (Object) Sanitized object

### `sanitizeString(str)`
Sanitizes a string by redacting sensitive patterns.

**Parameters:**
- `str` (string): The string to sanitize

**Returns:** (string) Sanitized string

### `sanitizeError(error)`
Sanitizes an Error object for safe logging.

**Parameters:**
- `error` (Error): The error to sanitize

**Returns:** (Object) Sanitized error object

### `sanitizeRequest(req)`
Sanitizes an Express request object.

**Parameters:**
- `req` (Request): Express request object

**Returns:** (Object) Sanitized request data

## Troubleshooting

### Sanitization Too Aggressive?

If legitimate data is being redacted, you can:

1. Check if the key name matches sensitive patterns
2. Rename the field if possible
3. Temporarily disable sanitization for debugging (development only)

### Need to Add More Patterns?

Edit `src/utils/sanitizer.js` and add patterns to the sensitive lists:

```javascript
const sensitiveParams = [
  // ... existing params
  'your_custom_param'
];
```

### Performance Concerns?

Sanitization is designed to be fast, but for very large objects:
- Consider sanitizing only top-level fields
- Use DEBUG log level only in development
- Disable verbose logging in production

## Compliance

This sanitization system helps meet:
- **GDPR**: Prevents logging of personal data
- **PCI DSS**: Prevents logging of payment information
- **SOC 2**: Demonstrates security controls
- **HIPAA**: Helps avoid logging PHI

## Related Documentation

- [PRIVACY.md](./PRIVACY.md) - Data privacy policy
- [REQUEST_ID_IMPLEMENTATION.md](./REQUEST_ID_IMPLEMENTATION.md) - Request tracking
- [Logger Documentation](./src/utils/logger.js) - Logger API

## Support

If you discover sensitive data in logs that isn't being redacted:
1. Report it immediately as a security issue
2. Add the pattern to `sanitizer.js`
3. Update this documentation
4. Add test cases

---

**Last Updated:** October 19, 2025
