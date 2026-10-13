// This file handles account signup, login, logout and the current user session.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const csrfHeader = require('../middleware/csrfHeader');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
const attemptsLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait 15 minutes before trying again.' },
});
const secureCookie = process.env.NODE_ENV === 'production';

function sendToken(res, user) {
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.cookie('cravely_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookie,
    maxAge: 24 * 60 * 60 * 1000,
  });
  return res.json({ user: { id: user.id, name: user.name, email: user.email } });
}

function inputIsValid(req, res, next) {
  if (validationResult(req).isEmpty()) return next();
  return res.status(400).json({ error: 'Please check the information and try again.' });
}

function signupInputIsValid(req, res, next) {
  const errors = validationResult(req).array();
  if (!errors.length) return next();
  const field = errors[0].path;
  const messages = {
    name: 'Name must be between 2 and 50 characters.',
    email: 'Enter a valid email address.',
    password: 'Password needs at least 8 characters, a letter and a number. Use 72 UTF-8 bytes or fewer.',
  };
  return res.status(400).json({
    error: messages[field] || 'Please check the information and try again.',
  });
}

router.post('/signup', attemptsLimit, csrfHeader, [
  body('name').trim().isLength({ min: 2, max: 50 }),
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isString().bail().isLength({ min: 8, max: 200 })
    .matches(/[A-Za-z]/).matches(/\d/).custom((value) => !bcrypt.truncates(value)),
], signupInputIsValid, async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    ).run(name, email, passwordHash);
    return sendToken(res, { id: result.lastInsertRowid, name, email });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return next(error);
  }
});

router.post('/login', attemptsLimit, csrfHeader, [
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 200 }),
], inputIsValid, async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
    const user = db.prepare(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
    ).get(req.body.email);
    const passwordMatches = user
      ? await bcrypt.compare(req.body.password, user.password_hash)
      : await bcrypt.compare(req.body.password, '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5Y6BsmV6wM/VmHSewPkyM0QGtWZ7I8y');
    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    return sendToken(res, user);
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', csrfHeader, (req, res) => {
  res.clearCookie('cravely_token', { httpOnly: true, sameSite: 'strict', secure: secureCookie });
  return res.json({ message: 'Signed out.' });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
  return res.json({ user });
});

module.exports = router;
