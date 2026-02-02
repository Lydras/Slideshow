const { isAuthEnabled, isValidSession } = require('../services/authService');

// Routes that don't require authentication (slideshow display mode)
const PUBLIC_PATHS = [
  '/auth',          // Auth endpoints themselves
  '/images',        // Image serving and slideshow data (GET only)
  '/settings',      // Settings read needed for slideshow config (GET only)
];

function requireAuth(req, res, next) {
  // If auth is not configured, allow everything
  if (!isAuthEnabled()) {
    return next();
  }

  // Allow public paths
  const path = req.path;

  // Auth routes are always public
  if (path.startsWith('/auth')) return next();

  // OAuth callbacks are public (browser redirects carry no auth token)
  if (path === '/dropbox/callback') return next();

  // GET requests for slideshow display are public
  if (req.method === 'GET') {
    if (path === '/' || path === '/images' || path.startsWith('/images/')) return next();
    if (path === '/settings') return next();
    // Plex thumbnail proxy (used by <img> tags which can't send auth headers)
    if (path.startsWith('/plex/') && path.endsWith('/thumb')) return next();
  }

  // Everything else requires authentication
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!isValidSession(token)) {
    return res.status(401).json({ error: { message: 'Authentication required' } });
  }

  next();
}

module.exports = { requireAuth };
