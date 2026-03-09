const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db/connection');
const { getSlideshowImages } = require('../services/imageService');
const { getSource, markImageUnavailable } = require('../services/sourceService');
const { isSubPath } = require('../utils/pathUtils');
const { parseIntParam } = require('../utils/parseIntParam');
const { getThumbnail } = require('../services/thumbnailService');
const { getFromCache, writeToCache, evictIfNeeded } = require('../services/cacheService');
const dropboxService = require('../services/dropboxService');
const plexService = require('../services/plexService');

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildUnavailableImagePlaceholder(label) {
  const safeLabel = escapeXml(label || "Unavailable image");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#111827"/><stop offset="100%" stop-color="#1f2937"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#bg)"/>
      <circle cx="1320" cy="180" r="180" fill="rgba(148,163,184,0.12)"/>
      <circle cx="220" cy="760" r="220" fill="rgba(148,163,184,0.08)"/>
      <text x="120" y="380" fill="#f9fafb" font-size="64" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Image unavailable from Plex</text>
      <text x="120" y="450" fill="#cbd5e1" font-size="30" font-family="Segoe UI, Arial, sans-serif">The slideshow skipped to a safe fallback for this item.</text>
      <text x="120" y="540" fill="#94a3b8" font-size="26" font-family="Segoe UI, Arial, sans-serif">${safeLabel}</text>
    </svg>`
  );
}
const router = Router();

// Get images for slideshow
router.get('/', (req, res) => {
  const playlistId = req.query.playlist_id || null;
  const images = getSlideshowImages(playlistId);
  res.json(images);
});

// Serve local images with path traversal protection
router.get('/serve/local/:sourceId/*', (req, res) => {
  const sourceId = parseIntParam(req, res, 'sourceId');
  if (sourceId === null) return;
  const source = getSource(sourceId);

  if (!source || source.type !== 'local') {
    return res.status(404).json({ error: { message: 'Source not found' } });
  }

  const requestedPath = decodeURIComponent(req.params[0]);
  const resolvedPath = path.resolve(requestedPath);

  // Path traversal check: ensure the resolved path is within the source's base path
  if (!isSubPath(source.path, resolvedPath)) {
    return res.status(403).json({ error: { message: 'Access denied' } });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: { message: 'File not found' } });
  }

  res.sendFile(resolvedPath);
});

// Serve dropbox images (proxy through server, with disk cache)
router.get('/serve/dropbox/:sourceId/*', async (req, res, next) => {
  try {
    const sourceId = parseIntParam(req, res, 'sourceId');
    if (sourceId === null) return;
    const source = getSource(sourceId);

    if (!source || source.type !== 'dropbox') {
      return res.status(404).json({ error: { message: 'Source not found' } });
    }

    // Express * wildcard strips leading slash; Dropbox paths need it
    const rawPath = decodeURIComponent(req.params[0]);
    const filePath = rawPath.startsWith('/') ? rawPath : '/' + rawPath;

    // Check disk cache first
    const cached = getFromCache(sourceId, filePath);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.sendFile(cached);
    }

    const buffer = await dropboxService.downloadFile(source.credential_id, filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml', '.tiff': 'image/tiff', '.tif': 'image/tiff',
      '.avif': 'image/avif', '.ico': 'image/x-icon',
    };
    const contentType = mimeTypes[ext] || 'image/jpeg';

    // Write to disk cache (async, don't block response)
    writeToCache(sourceId, filePath, buffer, contentType);
    evictIfNeeded();

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// Serve plex images (proxy through server, with disk cache)
router.get('/serve/plex/:sourceId/:imageId', async (req, res, next) => {
  try {
    const sourceId = parseIntParam(req, res, 'sourceId');
    if (sourceId === null) return;
    const imageId = parseIntParam(req, res, 'imageId');
    if (imageId === null) return;
    const source = getSource(sourceId);

    if (!source || source.type !== 'plex') {
      return res.status(404).json({ error: { message: 'Source not found' } });
    }

    const db = getDb();
    const image = db.prepare('SELECT * FROM image_cache WHERE id = ? AND source_id = ?').get(imageId, sourceId);
    if (!image) {
      return res.status(404).json({ error: { message: 'Image not found' } });
    }

    const cacheKey = image.thumbnail_path || image.file_path || ('plex:' + image.id);
    const cached = getFromCache(sourceId, cacheKey);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.sendFile(cached);
    }

    try {
      const result = await plexService.downloadBestPhoto(
        source.credential_id,
        source.plex_server_url,
        image
      );

      writeToCache(sourceId, cacheKey, result.buffer, result.contentType || 'image/jpeg');
      evictIfNeeded();

      res.set('Content-Type', result.contentType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(result.buffer);
    } catch (err) {
      const thumbnail = await getThumbnail(sourceId, imageId);
      if (thumbnail) {
        res.set('Content-Type', thumbnail.contentType);
        res.set('Cache-Control', 'public, max-age=3600');
        return res.sendFile(thumbnail.path);
      }

      markImageUnavailable(sourceId, imageId);
      const placeholder = buildUnavailableImagePlaceholder(image.file_name);
      writeToCache(sourceId, cacheKey, placeholder, 'image/svg+xml');
      evictIfNeeded();
      res.set('Content-Type', 'image/svg+xml');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(placeholder);
    }
  } catch (err) {
    next(err);
  }
});

// Serve thumbnail for an image
router.get('/thumbnail/:sourceId/:imageId', async (req, res, next) => {
  try {
    const sourceId = parseIntParam(req, res, 'sourceId');
    if (sourceId === null) return;
    const imageId = parseIntParam(req, res, 'imageId');
    if (imageId === null) return;

    const result = await getThumbnail(sourceId, imageId);
    if (!result) {
      return res.status(404).json({ error: { message: 'Thumbnail not available' } });
    }

    res.set('Content-Type', result.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(result.path);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
