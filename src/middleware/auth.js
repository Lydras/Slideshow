const { isAuthEnabled, isValidSession } = require('../services/authService');

function isPublicRequest(req) {
  const path = req.path;

  if (path.startsWith('/auth')) return true;
  if (path === '/dropbox/callback') return true;

  if (req.method !== 'GET') return false;
  if (path === '/' || path === '/settings') return true;
  if (path === '/images' || path.startsWith('/images/')) return true;
  if (path.startsWith('/plex/') && path.endsWith('/thumb')) return true;

  return false;
}

function requireAuth(req, res, next) {
  if (!isAuthEnabled() || isPublicRequest(req)) {
    return next();
  }

  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!isValidSession(token)) {
    return res.status(401).json({ error: { message: 'Authentication required' } });
  }

  next();
}

module.exports = { requireAuth, isPublicRequest };
