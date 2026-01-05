/**
 * Integration Tests for Authentication Routes
 */

const request = require('supertest');
const express = require('express');
const { TestDatabase } = require('../helpers/testSetup');
const authRoutes = require('../../src/routes/auth');

describe('Authentication Routes', () => {
  let app;
  let testDb;
  let db;

  beforeAll(async () => {
    testDb = new TestDatabase();
    db = await testDb.setup();

    // Mock getDatabase
    jest.doMock('../../src/db', () => ({
      getDatabase: () => db
    }));

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.clearData();
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ password: 'SecurePass123' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('8 characters');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });

    it('should return 400 for duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123'
      };

      // Register first time
      await request(app).post('/api/auth/register').send(userData);

      // Try to register again
      const response = await request(app).post('/api/auth/register').send(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already registered');
    });

    it('should normalize email to lowercase', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'UPPERCASE@EXAMPLE.COM',
          password: 'SecurePass123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('uppercase@example.com');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const userData = {
        email: 'login@example.com',
        password: 'SecurePass123'
      };

      // Register user
      await request(app).post('/api/auth/register').send(userData);

      // Login
      const response = await request(app)
        .post('/api/auth/login')
        .send(userData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(userData.email);
    });

    it('should return 401 for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email or password');
    });

    it('should return 401 for incorrect password', async () => {
      const userData = {
        email: 'wrongpass@example.com',
        password: 'CorrectPass123'
      };

      // Register user
      await request(app).post('/api/auth/register').send(userData);

      // Try to login with wrong password
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'WrongPass123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email or password');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should be case-insensitive for email', async () => {
      // Register with mixed case
      await request(app).post('/api/auth/register').send({
        email: 'CaseSensitive@Example.COM',
        password: 'SecurePass123'
      });

      // Login with lowercase
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'casesensitive@example.com',
          password: 'SecurePass123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('casesensitive@example.com');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile with valid token', async () => {
      // Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'profile@example.com',
          password: 'SecurePass123'
        });

      const token = registerResponse.body.token;

      // Get profile
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('profile@example.com');
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Authentication required');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'InvalidFormat token123');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full registration → login → profile flow', async () => {
      const userData = {
        email: 'fullflow@example.com',
        password: 'SecurePass123'
      };

      // 1. Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(200);
      const registrationToken = registerResponse.body.token;

      // 2. Verify profile with registration token
      const profileResponse1 = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${registrationToken}`);

      expect(profileResponse1.status).toBe(200);
      expect(profileResponse1.body.user.email).toBe(userData.email);

      // 3. Logout (client-side only for JWT)
      const logoutResponse = await request(app)
        .post('/api/auth/logout');

      expect(logoutResponse.status).toBe(200);

      // 4. Login again
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(userData);

      expect(loginResponse.status).toBe(200);
      const loginToken = loginResponse.body.token;

      // 5. Verify profile with login token
      const profileResponse2 = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${loginToken}`);

      expect(profileResponse2.status).toBe(200);
      expect(profileResponse2.body.user.email).toBe(userData.email);
    });
  });

  describe('Token Expiration', () => {
    it('should include expiration in token', async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'expiry@example.com',
          password: 'SecurePass123'
        });

      const token = registerResponse.body.token;
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);

      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');
      expect(decoded.exp).toBeGreaterThan(decoded.iat);

      // Verify token is valid for at least 6 days (should be 7 days)
      const expiryDuration = decoded.exp - decoded.iat;
      expect(expiryDuration).toBeGreaterThan(6 * 24 * 60 * 60);
    });
  });
});
