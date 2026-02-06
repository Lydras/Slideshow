const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  MASTER_KEY_PATH,
  DATA_DIR,
  PBKDF2_ITERATIONS,
  PBKDF2_KEYLEN,
  PBKDF2_DIGEST,
  SALT_LENGTH,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
} = require('../config/constants');

let masterKey = null;

function loadOrCreateMasterKey() {
  if (masterKey) return masterKey;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(MASTER_KEY_PATH)) {
    const hex = fs.readFileSync(MASTER_KEY_PATH, 'utf8').trim();
    masterKey = Buffer.from(hex, 'hex');
  } else {
    masterKey = crypto.randomBytes(32);
    fs.writeFileSync(MASTER_KEY_PATH, masterKey.toString('hex'), { mode: 0o600 });
  }

  return masterKey;
}

function deriveKey(salt) {
  const key = loadOrCreateMasterKey();
  return crypto.pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
}

function encrypt(plaintext) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = deriveKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: salt(32) + iv(12) + authTag(16) + ciphertext
  const packed = Buffer.concat([salt, iv, authTag, encrypted]);
  return packed.toString('base64');
}

function decrypt(base64Data) {
  const packed = Buffer.from(base64Data, 'base64');

  const MIN_LENGTH = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  if (packed.length < MIN_LENGTH) {
    throw new Error(`Invalid encrypted data: expected at least ${MIN_LENGTH} bytes, got ${packed.length}`);
  }

  const salt = packed.subarray(0, SALT_LENGTH);
  const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = packed.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const derivedKey = deriveKey(salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString('utf8');
}

// For testing: reset the cached master key
function _resetMasterKey() {
  masterKey = null;
}

module.exports = { loadOrCreateMasterKey, encrypt, decrypt, _resetMasterKey };
