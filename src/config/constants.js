const path = require('path');

module.exports = {
  DB_PATH: path.join(__dirname, '..', '..', 'data', 'slideshow.db'),
  MASTER_KEY_PATH: path.join(__dirname, '..', '..', 'data', 'master.key'),
  DATA_DIR: path.join(__dirname, '..', '..', 'data'),
  PUBLIC_DIR: path.join(__dirname, '..', '..', 'public'),

  PBKDF2_ITERATIONS: 100000,
  PBKDF2_KEYLEN: 32,
  PBKDF2_DIGEST: 'sha512',
  SALT_LENGTH: 32,
  IV_LENGTH: 12,
  AUTH_TAG_LENGTH: 16,

  SOURCE_TYPES: ['local', 'dropbox', 'plex'],
  CREDENTIAL_SERVICES: ['dropbox', 'plex'],
  TRANSITION_TYPES: ['fade', 'slide', 'none'],
  ORDER_TYPES: ['sequential', 'random'],

  THUMBNAIL_DIR: path.join(__dirname, '..', '..', 'data', 'thumbnails'),
  THUMBNAIL_SIZE: 200,
  THUMBNAIL_QUALITY: 80,

  CACHE_DIR: path.join(__dirname, '..', '..', 'data', 'cache'),
  CACHE_MAX_SIZE_MB: 2000, // 2GB default max cache size

  RATE_LIMIT_WINDOW_MS: 60 * 1000,
  RATE_LIMIT_MAX: 200,
  AUTH_RATE_LIMIT_MAX: 10,
  BODY_SIZE_LIMIT: '1mb',
};
