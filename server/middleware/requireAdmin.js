
module.exports = function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Please sign in to continue.',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Administrator access required.',
    });
  }

  return next();
};
