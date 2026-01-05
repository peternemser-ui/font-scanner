const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-use-long-random-string';
const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';

class AuthService {
  /**
   * Hash password with bcrypt
   */
  async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   * Returns error message or null if valid
   */
  validatePassword(password) {
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null; // Valid
  }

  /**
   * Generate JWT token for user
   */
  generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        plan: user.plan || 'free'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Verify JWT token
   * Throws error if invalid or expired
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      throw new Error('Invalid token');
    }
  }

  /**
   * Register new user
   */
  async register(email, password) {
    const db = getDatabase();

    // Normalize email
    email = email.toLowerCase().trim();

    // Check if user exists
    const existing = await db.get(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing) {
      throw new Error('Email already registered');
    }

    // Validate password
    const passwordError = this.validatePassword(password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const userId = uuidv4();
    await db.run(
      'INSERT INTO users (id, email, password_hash, plan, email_verified) VALUES (?, ?, ?, ?, ?)',
      [userId, email, passwordHash, 'free', 0]
    );

    // Get created user (without password hash)
    const user = await db.get(
      'SELECT id, email, plan, created_at, email_verified FROM users WHERE id = ?',
      [userId]
    );

    // Generate token
    const token = this.generateToken(user);

    return { user, token };
  }

  /**
   * Login existing user
   */
  async login(email, password) {
    const db = getDatabase();

    // Normalize email
    email = email.toLowerCase().trim();

    // Get user with password hash
    const user = await db.get(
      'SELECT id, email, password_hash, plan, created_at, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const valid = await this.verifyPassword(password, user.password_hash);
    if (!valid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await db.run(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Generate token
    const token = this.generateToken(user);

    // Remove password hash from response
    delete user.password_hash;

    return { user, token };
  }

  /**
   * Get user by ID (without password hash)
   */
  async getUserById(userId) {
    const db = getDatabase();
    return db.get(
      'SELECT id, email, plan, created_at, last_login, email_verified, stripe_customer_id FROM users WHERE id = ?',
      [userId]
    );
  }

  /**
   * Update user plan (used by Stripe webhook)
   */
  async updateUserPlan(userId, plan) {
    const db = getDatabase();
    await db.run(
      'UPDATE users SET plan = ? WHERE id = ?',
      [plan, userId]
    );
  }

  /**
   * Change user password (for password reset)
   */
  async changePassword(userId, newPassword) {
    const passwordError = this.validatePassword(newPassword);
    if (passwordError) {
      throw new Error(passwordError);
    }

    const passwordHash = await this.hashPassword(newPassword);
    const db = getDatabase();

    await db.run(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, userId]
    );
  }

  /**
   * Generate password reset token
   * Token expires in 1 hour
   */
  async generateResetToken(email) {
    const db = getDatabase();
    email = email.toLowerCase().trim();

    // Check if user exists
    const user = await db.get('SELECT id, email FROM users WHERE email = ?', [email]);
    if (!user) {
      // Don't reveal if email exists or not (security)
      return { success: true, message: 'If this email exists, a reset link has been sent' };
    }

    // Generate secure reset token
    const resetToken = uuidv4() + '-' + Date.now().toString(36);
    const tokenHash = await this.hashPassword(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    await db.run(
      `INSERT OR REPLACE INTO password_resets (user_id, token_hash, expires_at, created_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [user.id, tokenHash, expiresAt.toISOString()]
    );

    return { 
      success: true, 
      resetToken, // In production, email this instead of returning
      userId: user.id,
      email: user.email,
      expiresAt 
    };
  }

  /**
   * Verify reset token and get user
   */
  async verifyResetToken(userId, token) {
    const db = getDatabase();

    // Get the stored reset record
    const resetRecord = await db.get(
      'SELECT * FROM password_resets WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP',
      [userId]
    );

    if (!resetRecord) {
      throw new Error('Reset token invalid or expired');
    }

    // Verify token matches
    const valid = await this.verifyPassword(token, resetRecord.token_hash);
    if (!valid) {
      throw new Error('Reset token invalid or expired');
    }

    return true;
  }

  /**
   * Reset password with token
   */
  async resetPassword(userId, token, newPassword) {
    // Verify token first
    await this.verifyResetToken(userId, token);

    // Change password
    await this.changePassword(userId, newPassword);

    // Delete used reset token
    const db = getDatabase();
    await db.run('DELETE FROM password_resets WHERE user_id = ?', [userId]);

    return { success: true };
  }

  /**
   * Get user by email (for password reset lookup)
   */
  async getUserByEmail(email) {
    const db = getDatabase();
    email = email.toLowerCase().trim();
    return db.get(
      'SELECT id, email, plan FROM users WHERE email = ?',
      [email]
    );
  }
}

module.exports = new AuthService();
