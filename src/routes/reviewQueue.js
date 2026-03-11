const { Router } = require('express');
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { parseIntParam } = require('../utils/parseIntParam');
const { getReviewQueue, applyReviewAction } = require('../services/reviewQueueService');

const router = Router();

router.get(
  '/',
  [query('mode').optional().isIn(['newly-scanned', 'unreviewed']), validate],
  (req, res) => {
    const mode = req.query.mode || 'newly-scanned';
    res.json({ items: getReviewQueue({ mode }) });
  }
);

router.post(
  '/:id/action',
  [body('action').isIn(['approve', 'hide', 'skip', 'favorite']), validate],
  (req, res) => {
    const id = parseIntParam(req, res, 'id');
    if (id === null) return;

    const item = applyReviewAction(id, req.body.action);
    if (!item) {
      return res.status(404).json({ error: { message: 'Image not found' } });
    }

    res.json(item);
  }
);

module.exports = router;
