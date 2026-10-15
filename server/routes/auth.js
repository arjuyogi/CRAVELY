
require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const crypto = require('node:crypto');

const db = require('../db');
const csrfHeader = require('../middleware/csrfHeader');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const attemptsLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many attempts. Wait 15 minutes before trying again.',
  },
});

const secureCookie = process.env.NODE_ENV === 'production';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const cookieOptions = {
  httpOnly: true,
  secure: secureCookie,
  sameSite: 'strict',
  path: '/',
};

const DUMMY_PASSWORD_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5Y6BsmV6wM/VmHSewPkyM0QGtWZ7I8y';

function sendToken(res, user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  const token = jwt.sign(
    { id: Number(user.id) },
    process.env.JWT_SECRET,
    {
      expiresIn: '1d',
      algorithm: 'HS256',
    }
  );

  res.cookie('cravely_token', token, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000,
  });

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}

function inputIsValid(req, res, next) {
  if (validationResult(req).isEmpty()) {
    return next();
  }

  return res.status(400).json({
    error: 'Please check the information and try again.',
  });
}

function signupInputIsValid(req, res, next) {
  const errors = validationResult(req).array();

  if (errors.length === 0) {
    return next();
  }

  const messages = {
    name: 'Name must be between 2 and 50 characters.',
    email: 'Enter a valid email address.',
    password:
      'Password needs at least 8 characters, a letter and a number. Use 72 UTF-8 bytes or fewer.',
  };

  return res.status(400).json({
    error: messages[errors[0].path] ||
      'Please check the information and try again.',
  });
}

// SIGN UP
router.post(
  '/signup',
  attemptsLimit,
  csrfHeader,
  [
    body('name')
      .isString()
      .withMessage('Invalid name.')
      .bail()
      .trim()
      .isLength({ min: 2, max: 50 }),

    body('email')
      .isString()
      .bail()
      .trim()
      .isEmail()
      .normalizeEmail(),

    body('password')
      .isString()
      .bail()
      .isLength({ min: 8, max: 200 })
      .matches(/[A-Za-z]/)
      .matches(/\d/)
      .custom((value) => !bcrypt.truncates(value)),
  ],
  signupInputIsValid,
  async (req, res, next) => {
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured.');
      }

      const { name, email, password } = req.body;
      const passwordHash = await bcrypt.hash(password, 12);

      const result = db.prepare(`
        INSERT INTO users (name, email, password_hash)
        VALUES (?, ?, ?)
      `).run(name, email, passwordHash);

      return sendToken(res, {
        id: Number(result.lastInsertRowid),
        name,
        email,
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
          error: 'An account with this email already exists.',
        });
      }

      return next(error);
    }
  }
);

// EMAIL AND PASSWORD LOGIN
router.post(
  '/login',
  attemptsLimit,
  csrfHeader,
  [
    body('email')
      .isString()
      .bail()
      .trim()
      .isEmail()
      .normalizeEmail(),

    body('password')
      .isString()
      .bail()
      .isLength({ min: 8, max: 200 }),
  ],
  inputIsValid,
  async (req, res, next) => {
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured.');
      }

      const user = db.prepare(`
        SELECT id, name, email, password_hash
        FROM users
        WHERE email = ?
      `).get(req.body.email);

      const passwordMatches = await bcrypt.compare(
        req.body.password,
        user ? user.password_hash : DUMMY_PASSWORD_HASH
      );

      if (!user || !passwordMatches) {
        return res.status(401).json({
          error: 'Invalid email or password.',
        });
      }

      return sendToken(res, user);
    } catch (error) {
      return next(error);
    }
  }
);

// GOOGLE LOGIN
router.post(
  '/google',
  attemptsLimit,
  csrfHeader,
  [
    body('credential')
      .isString()
      .bail()
      .notEmpty(),
  ],
  inputIsValid,
  async (req, res, next) => {
    try {
      if (!process.env.JWT_SECRET || !process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Google authentication is not configured.');
      }

      let ticket;

      try {
        ticket = await googleClient.verifyIdToken({
          idToken: req.body.credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
      } catch {
        return res.status(401).json({
          error: 'Google sign-in could not be verified. Please try again.',
        });
      }

      const profile = ticket.getPayload();

      if (
        !profile?.sub ||
        !profile.email ||
        profile.email_verified !== true
      ) {
        return res.status(401).json({
          error: 'Please use a verified Google account.',
        });
      }

      const email = profile.email.trim().toLowerCase();
      const name =
        (profile.name || email.split('@')[0]).trim().slice(0, 50) ||
        'Google User';

      let user = db.prepare(`
        SELECT id, name, email
        FROM users
        WHERE email = ?
      `).get(email);

      if (!user) {
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 12);

        const result = db.prepare(`
          INSERT INTO users (name, email, password_hash)
          VALUES (?, ?, ?)
        `).run(name, email, passwordHash);

        user = {
          id: Number(result.lastInsertRowid),
          name,
          email,
        };
      }

      return sendToken(res, user);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
          error: 'An account with this email already exists. Please try again.',
        });
      }

      return next(error);
    }
  }
);

// LOGOUT
router.post('/logout', csrfHeader, (req, res) => {
  res.clearCookie('cravely_token', cookieOptions);

  return res.json({
    message: 'Signed out.',
  });
});

// CURRENT USER
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(`
    SELECT id, name, email
    FROM users
    WHERE id = ?
  `).get(req.user.id);

  if (!user) {
    return res.status(401).json({
      error: 'Please sign in to continue.',
    });
  }

  return res.json({ user });
});

module.exports = router;
