const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validation');
const { SOURCE_TYPES } = require('../config/constants');
const { parseIntParam } = require('../utils/parseIntParam');
const {
  listSources,
  getSource,
  createSource,
  updateSource,
  deleteSource,
  scanSource,
  getSourceImages,
  updateImageSelection,
  getSourceImageCounts,
} = require('../services/sourceService');

const router = Router();

router.get('/', (req, res) => {
  res.json(listSources());
});

router.get('/:id', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const source = getSource(id);
  if (!source) return res.status(404).json({ error: { message: 'Source not found' } });
  res.json(source);
});

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('type').isIn(SOURCE_TYPES).withMessage(`Type must be one of: ${SOURCE_TYPES.join(', ')}`),
    body('path').trim().notEmpty().withMessage('Path is required'),
    body('include_subfolders').optional().isIn([0, 1]).withMessage('include_subfolders must be 0 or 1'),
    body('credential_id').optional({ values: 'null' }).isInt(),
    body('plex_server_url').optional({ values: 'null' }).isString(),
    validate,
  ],
  (req, res) => {
    const source = createSource(req.body);
    res.status(201).json(source);
  }
);

router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('type').optional().isIn(SOURCE_TYPES),
    body('path').optional().trim().notEmpty(),
    body('include_subfolders').optional().isIn([0, 1]),
    body('credential_id').optional({ values: 'null' }).isInt(),
    body('plex_server_url').optional({ values: 'null' }).isString(),
    validate,
  ],
  (req, res) => {
    const id = parseIntParam(req, res, 'id');
    if (id === null) return;
    const source = updateSource(id, req.body);
    if (!source) return res.status(404).json({ error: { message: 'Source not found' } });
    res.json(source);
  }
);

router.delete('/:id', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const source = getSource(id);
  if (!source) return res.status(404).json({ error: { message: 'Source not found' } });
  deleteSource(id);
  res.json({ message: 'Source deleted' });
});

router.post('/:id/scan', async (req, res, next) => {
  try {
    const id = parseIntParam(req, res, 'id');
    if (id === null) return;
    const result = await scanSource(id);
    if (!result) return res.status(404).json({ error: { message: 'Source not found' } });
    res.json({ message: `Scan complete. Found ${result.count} images.`, count: result.count });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/images', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const source = getSource(id);
  if (!source) return res.status(404).json({ error: { message: 'Source not found' } });
  res.json(getSourceImages(id));
});

// Bulk update image selection for a source
router.put('/:id/images/selection', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const source = getSource(id);
  if (!source) return res.status(404).json({ error: { message: 'Source not found' } });

  const { selected, image_ids } = req.body;
  if (selected !== 0 && selected !== 1) {
    return res.status(400).json({ error: { message: 'selected must be 0 or 1' } });
  }

  updateImageSelection(id, image_ids || [], selected);
  res.json({ message: 'Selection updated' });
});

// Get image counts for a source
router.get('/:id/images/counts', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;
  const source = getSource(id);
  if (!source) return res.status(404).json({ error: { message: 'Source not found' } });
  res.json(getSourceImageCounts(id));
});

module.exports = router;
