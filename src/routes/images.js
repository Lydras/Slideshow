const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const { getSlideshowImages } = require('../services/imageService');
const { getSource } = require('../services/sourceService');
const { isSubPath } = require('../utils/pathUtils');
const { getThumbnail } = require('../services/thumbnailService');
const { getFromCache, writeToCache, evictIfNeeded } = require('../services/cacheService');

const router = Router();

// Get images for slideshow
router.get('/', (req, res) => {
  const playlistId = req.query.playlist_id || null;
  const images = getSlideshowImages(playlistId);
  res.json(images);
});

// Serve local images with path traversal protection
router.get('/serve/local/:sourceId/*', (req, res) => {
  const sourceId = parseInt(req.params.sourceId, 10);
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
    const sourceId = parseInt(req.params.sourceId, 10);
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

    const dropboxService = require('../services/dropboxService');
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
router.get('/serve/plex/:sourceId/*', async (req, res, next) => {
  try {
    const sourceId = parseInt(req.params.sourceId, 10);
    const source = getSource(sourceId);

    if (!source || source.type !== 'plex') {
      return res.status(404).json({ error: { message: 'Source not found' } });
    }

    // Express * wildcard strips leading slash; Plex API paths need it
    const rawKey = decodeURIComponent(req.params[0]);
    const photoKey = rawKey.startsWith('/') ? rawKey : '/' + rawKey;

    // Check disk cache first
    const cached = getFromCache(sourceId, photoKey);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.sendFile(cached);
    }

    const plexService = require('../services/plexService');
    const { buffer, contentType } = await plexService.downloadPhoto(
      source.credential_id,
      source.plex_server_url,
      photoKey
    );

    // Write to disk cache
    writeToCache(sourceId, photoKey, buffer, contentType || 'image/jpeg');
    evictIfNeeded();

    res.set('Content-Type', contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// Serve thumbnail for an image
router.get('/thumbnail/:sourceId/:imageId', async (req, res, next) => {
  try {
    const sourceId = parseInt(req.params.sourceId, 10);
    const imageId = parseInt(req.params.imageId, 10);

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
