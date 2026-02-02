const { Router } = require('express');
const authService = require('../services/authService');

const router = Router();

// Get auth status
router.get('/status', (req, res) => {
  const enabled = authService.isAuthEnabled();
  const token = extractToken(req);
  const authenticated = enabled ? authService.isValidSession(token) : true;
  res.json({ enabled, authenticated });
});

// Login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: { message: 'Password is required' } });
  }
  try {
    const token = authService.login(password);
    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: { message: err.message } });
  }
});

// Logout
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) authService.logout(token);
  res.json({ message: 'Logged out' });
});

// Set or change password (requires current auth if auth is enabled)
router.post('/password', (req, res) => {
  const { password, current_password } = req.body;

  // If auth is already enabled, require current password
  if (authService.isAuthEnabled()) {
    const token = extractToken(req);
    if (!authService.isValidSession(token)) {
      if (!current_password) {
        return res.status(401).json({ error: { message: 'Current password is required' } });
      }
      try {
        authService.login(current_password);
      } catch {
        return res.status(401).json({ error: { message: 'Current password is incorrect' } });
      }
    }
  }

  if (!password) {
    // Remove password (disable auth)
    authService.removePassword();
    return res.json({ message: 'Password removed, authentication disabled' });
  }

  try {
    authService.setPassword(password);
    const token = authService.login(password);
    res.json({ message: 'Password set', token });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

module.exports = router;
