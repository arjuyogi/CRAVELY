// This middleware verifies the signed session cookie before protected routes run.
const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  const token = req.cookies.cravely_token;
  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }
};
