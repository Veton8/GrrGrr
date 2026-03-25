const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { sqlite } = require('../config/database');

class AuthService {
  async register({ email, phone, password, username, displayName }) {
    // Check if user exists
    const existing = sqlite
      .prepare('SELECT id FROM users WHERE email = ? OR phone = ? OR username = ?')
      .get(email || '__none__', phone || '__none__', username);

    if (existing) {
      throw Object.assign(new Error('User already exists'), { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();

    sqlite
      .prepare(
        `INSERT INTO users (id, email, phone, password_hash, username, display_name)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, email || null, phone || null, passwordHash, username, displayName || username);

    const user = sqlite
      .prepare(
        'SELECT id, email, phone, username, display_name, avatar_url, bio, coin_balance, created_at FROM users WHERE id = ?'
      )
      .get(id);

    const tokens = await this.generateTokens(user.id, user.username);
    return { user: this.formatUser(user), ...tokens };
  }

  async login({ identifier, password }) {
    const user = sqlite
      .prepare('SELECT * FROM users WHERE email = ? OR phone = ? OR username = ?')
      .get(identifier, identifier, identifier);

    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    const tokens = await this.generateTokens(user.id, user.username);
    return { user: this.formatUser(user), ...tokens };
  }

  async refreshToken(refreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = sqlite
      .prepare(
        "SELECT * FROM refresh_tokens WHERE user_id = ? AND token_hash = ? AND expires_at > datetime('now')"
      )
      .get(decoded.userId, tokenHash);

    if (!stored) {
      throw Object.assign(new Error('Refresh token not found or expired'), { status: 401 });
    }

    sqlite.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);

    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    return this.generateTokens(decoded.userId, user.username);
  }

  async logout(userId, refreshToken) {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      sqlite
        .prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND token_hash = ?')
        .run(userId, tokenHash);
    }
  }

  async generateTokens(userId, username) {
    const accessToken = jwt.sign({ userId, username }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const id = uuidv4();

    sqlite
      .prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
      .run(id, userId, tokenHash, expiresAt);

    return { accessToken, refreshToken };
  }

  formatUser(user) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      coinBalance: user.coin_balance,
      createdAt: user.created_at,
    };
  }
}

module.exports = new AuthService();
