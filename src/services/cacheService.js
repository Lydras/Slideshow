const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CACHE_DIR, CACHE_MAX_SIZE_MB } = require('../config/constants');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getCacheKey(sourceId, filePath) {
  const hash = crypto.createHash('md5').update(`${sourceId}:${filePath}`).digest('hex');
  return hash;
}

function getCachePath(cacheKey, ext) {
  return path.join(CACHE_DIR, `${cacheKey}${ext}`);
}

function getFromCache(sourceId, filePath) {
  const key = getCacheKey(sourceId, filePath);
  // Try common extensions
  for (const ext of ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.avif', '']) {
    const cachePath = getCachePath(key, ext);
    if (fs.existsSync(cachePath)) {
      // Update mtime for LRU eviction
      const now = new Date();
      try { fs.utimesSync(cachePath, now, now); } catch {}
      return cachePath;
    }
  }
  return null;
}

function writeToCache(sourceId, filePath, buffer, contentType) {
  const key = getCacheKey(sourceId, filePath);
  const ext = contentTypeToExt(contentType);
  const cachePath = getCachePath(key, ext);

  try {
    fs.writeFileSync(cachePath, buffer);
    return cachePath;
  } catch (err) {
    console.error('Cache write error:', err.message);
    return null;
  }
}

function contentTypeToExt(contentType) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/avif': '.avif',
    'image/svg+xml': '.svg',
  };
  return map[contentType] || '.jpg';
}

function getCacheStats() {
  if (!fs.existsSync(CACHE_DIR)) {
    return { files: 0, sizeBytes: 0, sizeMB: 0, maxMB: CACHE_MAX_SIZE_MB };
  }

  const files = fs.readdirSync(CACHE_DIR);
  let totalSize = 0;

  for (const file of files) {
    try {
      const stat = fs.statSync(path.join(CACHE_DIR, file));
      totalSize += stat.size;
    } catch {}
  }

  return {
    files: files.length,
    sizeBytes: totalSize,
    sizeMB: Math.round(totalSize / (1024 * 1024) * 10) / 10,
    maxMB: CACHE_MAX_SIZE_MB,
  };
}

function clearCache() {
  if (!fs.existsSync(CACHE_DIR)) return { deleted: 0 };

  const files = fs.readdirSync(CACHE_DIR);
  let deleted = 0;

  for (const file of files) {
    try {
      fs.unlinkSync(path.join(CACHE_DIR, file));
      deleted++;
    } catch {}
  }

  return { deleted };
}

function evictIfNeeded() {
  const stats = getCacheStats();
  if (stats.sizeMB <= CACHE_MAX_SIZE_MB) return;

  // LRU eviction: delete oldest-accessed files until under limit
  const files = fs.readdirSync(CACHE_DIR)
    .map(name => {
      const filePath = path.join(CACHE_DIR, name);
      try {
        const stat = fs.statSync(filePath);
        return { name, path: filePath, size: stat.size, mtime: stat.mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.mtime - b.mtime); // oldest first

  let currentSize = stats.sizeBytes;
  const targetSize = CACHE_MAX_SIZE_MB * 1024 * 1024 * 0.8; // evict to 80% of max

  for (const file of files) {
    if (currentSize <= targetSize) break;
    try {
      fs.unlinkSync(file.path);
      currentSize -= file.size;
    } catch {}
  }
}

module.exports = {
  getFromCache,
  writeToCache,
  getCacheStats,
  clearCache,
  evictIfNeeded,
};
