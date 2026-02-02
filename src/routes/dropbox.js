const { Router } = require('express');
const { query, body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authRateLimit } = require('../middleware/security');
const dropboxService = require('../services/dropboxService');

const router = Router();

// Get the OAuth authorization URL
router.get(
  '/auth-url',
  authRateLimit,
  [
    query('app_key').notEmpty().withMessage('app_key is required'),
    query('app_secret').notEmpty().withMessage('app_secret is required'),
    validate,
  ],
  async (req, res, next) => {
    try {
      const redirectUri = `${req.protocol}://${req.get('host')}/api/dropbox/callback`;
      // Encode app credentials in the OAuth state parameter so they round-trip through Dropbox
      const oauthState = Buffer.from(JSON.stringify({
        app_key: req.query.app_key,
        app_secret: req.query.app_secret,
      })).toString('base64url');
      const authUrl = await dropboxService.getAuthUrl(req.query.app_key, redirectUri, oauthState);

      res.json({
        auth_url: authUrl,
        redirect_uri: redirectUri,
      });
    } catch (err) {
      next(err);
    }
  }
);

// OAuth callback
router.get('/callback', authRateLimit, async (req, res, next) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: { message: 'No authorization code provided' } });
    }

    // Recover app credentials from the OAuth state parameter
    let appKey, appSecret;
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        appKey = decoded.app_key;
        appSecret = decoded.app_secret;
      } catch {
        // Fall back to query params for backwards compat
      }
    }
    // Also accept direct query params as fallback
    appKey = appKey || req.query.app_key;
    appSecret = appSecret || req.query.app_secret;

    if (!appKey || !appSecret) {
      return res.status(400).json({ error: { message: 'Missing app credentials. Please restart the authorization flow.' } });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/dropbox/callback`;
    const credentialId = await dropboxService.exchangeCodeForToken(
      code, appKey, appSecret, redirectUri
    );

    // Redirect to frontend with credential ID
    res.redirect(`/#/sources?dropbox_credential_id=${credentialId}`);
  } catch (err) {
    next(err);
  }
});

// List folders for a credential
router.get('/:credentialId/folders', async (req, res, next) => {
  try {
    const credentialId = parseInt(req.params.credentialId, 10);
    const folderPath = req.query.path || '';
    const folders = await dropboxService.listFolders(credentialId, folderPath);
    res.json(folders);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
