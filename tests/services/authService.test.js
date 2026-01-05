/**
 * Unit Tests for Authentication Service
 */

const authService = require('../../src/services/authService');
const { TestDatabase } = require('../helpers/testSetup');
const jwt = require('jsonwebtoken');

describe('AuthService', () => {
  let testDb;
  let db;

  beforeAll(async () => {
    testDb = new TestDatabase();
    db = await testDb.setup();

    // Mock getDatabase to return test database
    jest.mock('../../src/db', () => ({
      getDatabase: () => db
    }));
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.clearData();
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'TestPassword123';
      const hash = await authService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);

      expect(hash1).not.toBe(hash2); // Salt makes each hash unique
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123';
      const hash = await authService.hashPassword(password);
      const isValid = await authService.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123';
      const hash = await authService.hashPassword(password);
      const isValid = await authService.verifyPassword('WrongPassword', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept valid password', () => {
      const error = authService.validatePassword('ValidPass123');
      expect(error).toBeNull();
    });

    it('should reject password shorter than 8 characters', () => {
      const error = authService.validatePassword('Short1');
      expect(error).toContain('at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const error = authService.validatePassword('lowercase123');
      expect(error).toContain('uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const error = authService.validatePassword('UPPERCASE123');
      expect(error).toContain('lowercase letter');
    });

    it('should reject password without number', () => {
      const error = authService.validatePassword('NoNumbers');
      expect(error).toContain('number');
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        plan: 'free'
      };

      const token = authService.generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token structure
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.plan).toBe(user.plan);
    });

    it('should set token expiration', () => {
      const user = { id: 'user-123', email: 'test@example.com', plan: 'free' };
      const token = authService.generateToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const user = { id: 'user-123', email: 'test@example.com', plan: 'free' };
      const token = authService.generateToken(user);
      const decoded = authService.verifyToken(token);

      expect(decoded.userId).toBe(user.id);
      expect(decoded.email).toBe(user.email);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        authService.verifyToken('invalid.token.here');
      }).toThrow('Invalid or expired token');
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        authService.verifyToken('not-a-token');
      }).toThrow('Invalid or expired token');
    });
  });

  describe('register', () => {
    it('should create new user with hashed password', async () => {
      const email = 'newuser@example.com';
      const password = 'SecurePass123';

      const result = await authService.register(email, password);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(email.toLowerCase());
      expect(result.user.plan).toBe('free');
      expect(result.user).not.toHaveProperty('password_hash');

      // Verify password was hashed
      const dbUser = await db.get('SELECT password_hash FROM users WHERE email = ?', [email.toLowerCase()]);
      expect(dbUser.password_hash).toBeDefined();
      expect(dbUser.password_hash).not.toBe(password);
    });

    it('should normalize email to lowercase', async () => {
      const result = await authService.register('TEST@EXAMPLE.COM', 'SecurePass123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should generate valid JWT token', async () => {
      const result = await authService.register('token@example.com', 'SecurePass123');
      const decoded = jwt.decode(result.token);

      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.email).toBe(result.user.email);
    });

    it('should reject duplicate email', async () => {
      const email = 'duplicate@example.com';
      const password = 'SecurePass123';

      await authService.register(email, password);

      await expect(
        authService.register(email, password)
      ).rejects.toThrow('Email already registered');
    });

    it('should reject weak password', async () => {
      await expect(
        authService.register('weak@example.com', 'short')
      ).rejects.toThrow('at least 8 characters');
    });

    it('should reject password without uppercase', async () => {
      await expect(
        authService.register('test@example.com', 'nouppercase123')
      ).rejects.toThrow('uppercase letter');
    });

    it('should reject invalid email format', async () => {
      await expect(
        authService.register('invalid-email', 'SecurePass123')
      ).rejects.toThrow('Invalid email format');
    });
  });

  describe('login', () => {
    it('should login with correct credentials', async () => {
      const email = 'login@example.com';
      const password = 'SecurePass123';

      // Register user first
      await authService.register(email, password);

      // Login
      const result = await authService.login(email, password);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(email.toLowerCase());
      expect(result.user).not.toHaveProperty('password_hash');
    });

    it('should update last_login timestamp', async () => {
      const email = 'timestamp@example.com';
      const password = 'SecurePass123';

      await authService.register(email, password);

      const beforeLogin = await db.get('SELECT last_login FROM users WHERE email = ?', [email.toLowerCase()]);

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      await authService.login(email, password);

      const afterLogin = await db.get('SELECT last_login FROM users WHERE email = ?', [email.toLowerCase()]);
      expect(afterLogin.last_login).not.toBe(beforeLogin.last_login);
    });

    it('should reject non-existent email', async () => {
      await expect(
        authService.login('nonexistent@example.com', 'SecurePass123')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject incorrect password', async () => {
      const email = 'wrongpass@example.com';
      await authService.register(email, 'CorrectPass123');

      await expect(
        authService.login(email, 'WrongPass123')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should be case-insensitive for email', async () => {
      const email = 'CaseSensitive@Example.COM';
      const password = 'SecurePass123';

      await authService.register(email, password);

      const result = await authService.login('casesensitive@example.com', password);
      expect(result.user.email).toBe('casesensitive@example.com');
    });
  });

  describe('getUserById', () => {
    it('should retrieve user by ID', async () => {
      const registerResult = await authService.register('retrieve@example.com', 'SecurePass123');
      const userId = registerResult.user.id;

      const user = await authService.getUserById(userId);

      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
      expect(user.email).toBe('retrieve@example.com');
      expect(user).not.toHaveProperty('password_hash');
    });

    it('should return null for non-existent ID', async () => {
      const user = await authService.getUserById('nonexistent-id');
      expect(user).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('should change password with correct old password', async () => {
      const email = 'changepass@example.com';
      const oldPassword = 'OldPass123';
      const newPassword = 'NewPass456';

      const { user } = await authService.register(email, oldPassword);

      await authService.changePassword(user.id, oldPassword, newPassword);

      // Verify can login with new password
      const loginResult = await authService.login(email, newPassword);
      expect(loginResult.user.id).toBe(user.id);

      // Verify cannot login with old password
      await expect(
        authService.login(email, oldPassword)
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject incorrect old password', async () => {
      const email = 'wrongold@example.com';
      const { user } = await authService.register(email, 'OldPass123');

      await expect(
        authService.changePassword(user.id, 'WrongPass123', 'NewPass456')
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should reject weak new password', async () => {
      const email = 'weaknew@example.com';
      const { user } = await authService.register(email, 'OldPass123');

      await expect(
        authService.changePassword(user.id, 'OldPass123', 'weak')
      ).rejects.toThrow('at least 8 characters');
    });
  });
});
