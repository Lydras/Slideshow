const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { parseIntParam } = require('../utils/parseIntParam');
const {
  listPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addSource,
  removeSource,
  getPlaylistImages,
  setPlaylistImages,
  clearPlaylistImages,
} = require('../services/playlistService');

const router = Router();

router.get('/', (req, res) => {
  res.json(listPlaylists());
});

router.get('/:id', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const playlist = getPlaylist(id);
  if (!playlist) return res.status(404).json({ error: { message: 'Playlist not found' } });
  res.json(playlist);
});

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').optional().isString(),
    validate,
  ],
  (req, res) => {
    try {
      const playlist = createPlaylist(req.body);
      res.status(201).json(playlist);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: { message: 'A playlist with this name already exists' } });
      }
      throw err;
    }
  }
);

router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('description').optional().isString(),
    validate,
  ],
  (req, res) => {
    try {
      const id = parseIntParam(req, res, 'id');
      if (id === null) return;
      const playlist = updatePlaylist(id, req.body);
      if (!playlist) return res.status(404).json({ error: { message: 'Playlist not found' } });
      res.json(playlist);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: { message: 'A playlist with this name already exists' } });
      }
      throw err;
    }
  }
);

router.delete('/:id', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const playlist = getPlaylist(id);
  if (!playlist) return res.status(404).json({ error: { message: 'Playlist not found' } });
  deletePlaylist(id);
  res.json({ message: 'Playlist deleted' });
});

router.post(
  '/:id/sources',
  [
    body('source_id').isInt().withMessage('source_id is required'),
    body('sort_order').optional().isInt(),
    validate,
  ],
  (req, res) => {
    const id = parseIntParam(req, res, 'id');
    if (id === null) return;
    const playlist = getPlaylist(id);
    if (!playlist) return res.status(404).json({ error: { message: 'Playlist not found' } });
    const updated = addSource(id, req.body.source_id, req.body.sort_order || 0);
    res.json(updated);
  }
);

router.delete('/:id/sources', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const playlist = getPlaylist(id);
  if (!playlist) return res.status(404).json({ error: { message: 'Playlist not found' } });
  if (!req.body.source_id) {
    return res.status(400).json({ error: { message: 'source_id is required' } });
  }
  const updated = removeSource(id, req.body.source_id);
  res.json(updated);
});

// Playlist image selection endpoints
router.get('/:id/images', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const playlist = getPlaylist(id);
  if (!playlist) return res.status(404).json({ error: { message: 'Playlist not found' } });
  res.json(getPlaylistImages(id));
});

router.put('/:id/images', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const playlist = getPlaylist(id);
  if (!playlist) return res.status(404).json({ error: { message: 'Playlist not found' } });

  const { image_ids } = req.body;
  if (!Array.isArray(image_ids)) {
    return res.status(400).json({ error: { message: 'image_ids must be an array' } });
  }

  setPlaylistImages(id, image_ids);
  res.json({ message: 'Playlist images updated' });
});

router.delete('/:id/images', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const playlist = getPlaylist(id);
  if (!playlist) return res.status(404).json({ error: { message: 'Playlist not found' } });
  clearPlaylistImages(id);
  res.json({ message: 'Playlist custom images cleared' });
});

module.exports = router;
