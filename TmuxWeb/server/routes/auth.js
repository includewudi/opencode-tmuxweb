const express = require('express');
const crypto = require('crypto');
const config = require('../config-loader');

const router = express.Router();

const COOKIE_NAME = 'tmuxweb_session';
// 过期时间从 config 读取，默认 30 天
const COOKIE_MAX_AGE = (config.sessionMaxAgeDays ?? 30) * 24 * 3600; // seconds

/**
 * Create signed session value: token + timestamp + signature
 */
function createSessionValue(token) {
  const timestamp = Date.now().toString();
  const data = `${token}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(data)
    .digest('hex');
  return `${data}:${signature}`;
}

/**
 * Verify and extract token from signed session value
 */
function verifySessionValue(sessionValue) {
  if (!sessionValue) return null;

  const parts = sessionValue.split(':');
  if (parts.length !== 3) return null;

  const [token, timestamp, signature] = parts;
  const data = `${token}:${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(data)
    .digest('hex');

  if (signature !== expectedSignature) return null;

  // 校验 timestamp 是否在有效期内
  const issuedAt = parseInt(timestamp, 10);
  const maxAgeMs = COOKIE_MAX_AGE * 1000;
  if (isNaN(issuedAt) || Date.now() - issuedAt > maxAgeMs) return null;

  return token;
}

/**
 * POST /api/auth/login
 * Accept { token: string }, validate against config.token
 * On success: set HttpOnly cookie with session info
 */
router.post('/login', (req, res) => {
  const { token } = req.body;

  if (!token || token !== config.token) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid token'
    });
  }

  const sessionValue = createSessionValue(token);
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie(COOKIE_NAME, sessionValue, {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE * 1000,
    sameSite: 'lax',
    secure: false,
    path: '/'
  });

  res.json({
    success: true,
    message: 'Login successful'
  });
});

/**
 * POST /api/auth/logout
 * Clear the session cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  });

  res.json({ success: true });
});

module.exports = { router, verifySessionValue, COOKIE_NAME };
