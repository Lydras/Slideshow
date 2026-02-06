const crypto = require('crypto');
const { getSetting, updateSettings } = require('./settingsService');

// In-memory session store (cleared on server restart)
const sessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const candidateBuf = Buffer.from(candidate, 'hex');
  if (hashBuf.length !== candidateBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, candidateBuf);
}

function isAuthEnabled() {
  const hash = getSetting('auth_password_hash');
  return !!hash;
}

function setPassword(password) {
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }
  const hash = hashPassword(password);
  updateSettings({ auth_password_hash: hash });
  // Clear all existing sessions when password changes
  sessions.clear();
}

function removePassword() {
  updateSettings({ auth_password_hash: '' });
  sessions.clear();
}

function login(password) {
  const stored = getSetting('auth_password_hash');
  if (!stored) {
    throw new Error('No password configured');
  }
  if (!verifyPassword(password, stored)) {
    throw new Error('Invalid password');
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now() });
  return token;
}

function logout(token) {
  sessions.delete(token);
}

function isValidSession(token) {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return false;
  }
  return true;
}

module.exports = {
  isAuthEnabled,
  setPassword,
  removePassword,
  login,
  logout,
  isValidSession,
};
