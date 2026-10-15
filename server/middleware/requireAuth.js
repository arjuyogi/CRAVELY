
const jwt = require('jsonwebtoken');
const db = require('../db');

// Verify that the user is signed in.
module.exports = function requireAuth(req, res, next) {
  const token = req.cookies?.cravely_token;

  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({
      error: 'Please sign in to continue.',
    });
  }

  try {
    // Verify the token's signature and expiration.
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Make sure the token contains a valid user ID.
    if (
      !payload ||
      typeof payload.id !== 'number' ||
      !Number.isSafeInteger(payload.id) ||
      payload.id <= 0
    ) {
      return res.status(401).json({
        error: 'Please sign in to continue.',
      });
    }

    // Get the current user and role from the database.
    const user = db.prepare(
      'SELECT id, role FROM users WHERE id = ?'
    ).get(payload.id);

    if (!user) {
      return res.status(401).json({
        error: 'Please sign in to continue.',
      });
    }

    // Attach trusted database information to the request.
    req.user = {
      id: user.id,
      role: user.role,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      error: 'Please sign in to continue.',
    });
  }
};
