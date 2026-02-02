const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.use('/auth', require('./auth'));

// Apply auth middleware to all routes below
router.use(requireAuth);

router.use('/settings', require('./settings'));
router.use('/credentials', require('./credentials'));
router.use('/sources', require('./sources'));
router.use('/playlists', require('./playlists'));
router.use('/images', require('./images'));
router.use('/browse', require('./browse'));
router.use('/cache', require('./cache'));
router.use('/dropbox', require('./dropbox'));
router.use('/plex', require('./plex'));

module.exports = router;
