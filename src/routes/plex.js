const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authRateLimit } = require('../middleware/security');
const plexService = require('../services/plexService');

const router = Router();

// Connect to a Plex server
router.post(
  '/connect',
  authRateLimit,
  [
    body('server_url').trim().notEmpty().withMessage('server_url is required'),
    body('token').trim().notEmpty().withMessage('token is required'),
    validate,
  ],
  async (req, res, next) => {
    try {
      const result = await plexService.connect(req.body.server_url, req.body.token);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Get server URL stored in credential
router.get('/:credentialId/info', async (req, res, next) => {
  try {
    const credentialId = parseInt(req.params.credentialId, 10);
    const serverUrl = plexService.getServerUrl(credentialId);
    res.json({ server_url: serverUrl });
  } catch (err) {
    next(err);
  }
});

// Resolve server URL from query param, credential, or existing sources
function resolveServerUrl(credentialId, queryUrl) {
  if (queryUrl) return queryUrl;

  // Try credential's stored server_url
  try {
    const storedUrl = plexService.getServerUrl(credentialId);
    if (storedUrl) return storedUrl;
  } catch { /* ignore */ }

  // Fall back to existing sources
  const { getDb } = require('../db/connection');
  const db = getDb();
  const source = db.prepare(
    'SELECT plex_server_url FROM sources WHERE credential_id = ? AND type = ? LIMIT 1'
  ).get(credentialId, 'plex');
  return source?.plex_server_url || null;
}

// List photo libraries for a credential
router.get('/:credentialId/libraries', async (req, res, next) => {
  try {
    const credentialId = parseInt(req.params.credentialId, 10);
    const url = resolveServerUrl(credentialId, req.query.server_url);

    if (!url) {
      return res.status(400).json({ error: { message: 'server_url is required' } });
    }

    const libraries = await plexService.getLibraries(credentialId, url);
    res.json(libraries);
  } catch (err) {
    next(err);
  }
});

// Get albums and photos at section top level
router.get('/:credentialId/libraries/:sectionId/contents', async (req, res, next) => {
  try {
    const credentialId = parseInt(req.params.credentialId, 10);
    const url = resolveServerUrl(credentialId, req.query.server_url);

    if (!url) {
      return res.status(400).json({ error: { message: 'server_url is required' } });
    }

    const contents = await plexService.getSectionContents(credentialId, url, req.params.sectionId);
    res.json(contents);
  } catch (err) {
    next(err);
  }
});

// Get children of an album/container
router.get('/:credentialId/browse/:ratingKey', async (req, res, next) => {
  try {
    const credentialId = parseInt(req.params.credentialId, 10);
    const url = resolveServerUrl(credentialId, req.query.server_url);

    if (!url) {
      return res.status(400).json({ error: { message: 'server_url is required' } });
    }

    const children = await plexService.getContainerChildren(credentialId, url, req.params.ratingKey);
    res.json(children);
  } catch (err) {
    next(err);
  }
});

// Proxy Plex thumbnails
router.get('/:credentialId/thumb', async (req, res, next) => {
  try {
    const credentialId = parseInt(req.params.credentialId, 10);
    const url = resolveServerUrl(credentialId, req.query.server_url);

    if (!url) {
      return res.status(400).json({ error: { message: 'server_url is required' } });
    }

    const thumbPath = req.query.path;
    if (!thumbPath) {
      return res.status(400).json({ error: { message: 'path is required' } });
    }

    const result = await plexService.getThumbnail(credentialId, url, thumbPath);
    if (!result) {
      return res.status(404).json({ error: { message: 'Thumbnail not found' } });
    }

    res.set('Content-Type', result.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
});

// List items in a photo library
router.get('/:credentialId/libraries/:sectionId/items', async (req, res, next) => {
  try {
    const credentialId = parseInt(req.params.credentialId, 10);
    const url = resolveServerUrl(credentialId, req.query.server_url);

    if (!url) {
      return res.status(400).json({ error: { message: 'server_url is required' } });
    }

    const { sectionId } = req.params;
    const items = await plexService.getLibraryItems(credentialId, url, sectionId);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
