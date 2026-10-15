
const allowedOrigin = () => {
  const origin = process.env.APP_ORIGIN || 'http://localhost:3000';

  try {
    return new URL(origin).origin;
  } catch {
    throw new Error('APP_ORIGIN must be a valid URL.');
  }
};

// Protect state-changing requests against cross-site requests.
module.exports = function csrfHeader(req, res, next) {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({
      error: 'Request could not be verified.',
    });
  }

  const origin = req.get('Origin');

  // Browser requests from another origin are not accepted.
  if (origin) {
    try {
      if (new URL(origin).origin !== allowedOrigin()) {
        return res.status(403).json({
          error: 'Request could not be verified.',
        });
      }
    } catch {
      return res.status(403).json({
        error: 'Request could not be verified.',
      });
    }
  }

  return next();
};
