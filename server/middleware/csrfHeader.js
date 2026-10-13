// This middleware rejects state-changing requests without the app's CSRF header.
module.exports = function csrfHeader(req, res, next) {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Request could not be verified.' });
  }
  return next();
};
