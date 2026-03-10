/**
 * OAuth Service
 * Handles Google and Facebook OAuth flows without Passport.js
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db');
const config = require('../config');
const authService = require('./authService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('OAuthService');

class OAuthService {

  // ── Google ─────────────────────────────────────────────

  getGoogleAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: config.oauth.google.clientId,
      redirect_uri: this._googleRedirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeGoogleCode(code) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        redirect_uri: this._googleRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Google token error: ${data.error_description || data.error}`);
    return data; // { access_token, id_token, ... }
  }

  async getGoogleUserInfo(accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (data.error) throw new Error(`Google userinfo error: ${data.error.message}`);
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
      verified: data.verified_email,
    };
  }

  _googleRedirectUri() {
    return config.oauth.google.redirectUri || `${config.billing.appBaseUrl}/api/auth/oauth/google/callback`;
  }

  // ── Facebook ───────────────────────────────────────────

  getFacebookAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: config.oauth.facebook.clientId,
      redirect_uri: this._facebookRedirectUri(),
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  }

  async exchangeFacebookCode(code) {
    const params = new URLSearchParams({
      code,
      client_id: config.oauth.facebook.clientId,
      client_secret: config.oauth.facebook.clientSecret,
      redirect_uri: this._facebookRedirectUri(),
    });
    const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params}`);
    const data = await res.json();
    if (data.error) throw new Error(`Facebook token error: ${data.error.message}`);
    return data; // { access_token, token_type, expires_in }
  }

  async getFacebookUserInfo(accessToken) {
    const res = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) throw new Error(`Facebook userinfo error: ${data.error.message}`);
    return {
      id: data.id,
      email: data.email || null,
      name: data.name,
      picture: data.picture?.data?.url || null,
    };
  }

  _facebookRedirectUri() {
    return config.oauth.facebook.redirectUri || `${config.billing.appBaseUrl}/api/auth/oauth/facebook/callback`;
  }

  // ── Shared: find or create user ────────────────────────

  /**
   * Find existing user by social login or email, or create a new one.
   * Auto-links social account to existing email-matching user.
   *
   * Returns { user, token, isNewUser }
   */
  async findOrCreateUser(provider, providerUserId, email, displayName, avatarUrl) {
    const db = getDatabase();

    // 1. Check if this social account is already linked
    const existingLink = await db.get(
      'SELECT user_id FROM social_logins WHERE provider = ? AND provider_user_id = ?',
      [provider, providerUserId]
    );

    if (existingLink) {
      const user = await db.get(
        'SELECT id, email, plan, created_at, email_verified, is_admin FROM users WHERE id = ?',
        [existingLink.user_id]
      );
      if (user) {
        await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        const token = authService.generateToken(user);
        return { user, token, isNewUser: false };
      }
    }

    // 2. Check if a user with this email already exists (auto-link)
    if (email) {
      const existingUser = await db.get(
        'SELECT id, email, plan, created_at, email_verified, is_admin FROM users WHERE email = ?',
        [email.toLowerCase().trim()]
      );

      if (existingUser) {
        // Link this social account to the existing user
        await db.run(
          `INSERT INTO social_logins (user_id, provider, provider_user_id, email, display_name, avatar_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [existingUser.id, provider, providerUserId, email, displayName, avatarUrl]
        );
        // Mark email as verified (provider confirmed it)
        if (!existingUser.email_verified) {
          await db.run('UPDATE users SET email_verified = 1 WHERE id = ?', [existingUser.id]);
        }
        await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [existingUser.id]);
        const token = authService.generateToken(existingUser);
        logger.info('Linked social account to existing user', { provider, userId: existingUser.id });
        return { user: existingUser, token, isNewUser: false };
      }
    }

    // 3. Create a new user (no password)
    const userId = uuidv4();
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    if (!normalizedEmail) {
      throw new Error('Email is required for account creation. Please grant email permission.');
    }

    await db.run(
      'INSERT INTO users (id, email, password_hash, plan, email_verified) VALUES (?, ?, NULL, ?, 1)',
      [userId, normalizedEmail, 'free']
    );

    // Link social account
    await db.run(
      `INSERT INTO social_logins (user_id, provider, provider_user_id, email, display_name, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, provider, providerUserId, normalizedEmail, displayName, avatarUrl]
    );

    const user = await db.get(
      'SELECT id, email, plan, created_at, email_verified, is_admin FROM users WHERE id = ?',
      [userId]
    );

    const token = authService.generateToken(user);
    logger.info('Created new user via social login', { provider, userId });
    return { user, token, isNewUser: true };
  }

  // ── CSRF state helpers ─────────────────────────────────

  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }

  verifyState(state, expected) {
    if (!state || !expected) return false;
    return crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  }
}

module.exports = new OAuthService();
