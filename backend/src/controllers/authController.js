const { body } = require('express-validator');
const authService = require('../services/authService');
const { sqlite } = require('../config/database');

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-50 chars, alphanumeric and underscores only'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
];

const loginValidation = [
  body('identifier').notEmpty().withMessage('Email, phone, or username required'),
  body('password').notEmpty().withMessage('Password required'),
];

async function register(req, res, next) {
  try {
    const { email, phone, password, username, displayName } = req.body;
    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone number required' });
    }
    const result = await authService.register({ email, phone, password, username, displayName });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { identifier, password } = req.body;
    const result = await authService.login({ identifier, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    const tokens = await authService.refreshToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.user.id, req.body.refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = sqlite
      .prepare(
        `SELECT id, email, phone, username, display_name, avatar_url, bio, coin_balance,
                (SELECT COUNT(*) FROM followers WHERE following_id = users.id) as follower_count,
                (SELECT COUNT(*) FROM followers WHERE follower_id = users.id) as following_count
         FROM users WHERE id = ?`
      )
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      coinBalance: user.coin_balance,
      followerCount: user.follower_count,
      followingCount: user.following_count,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  registerValidation,
  loginValidation,
};
