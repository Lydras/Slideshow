const { Router } = require('express');
const { browseLocal } = require('../services/browseService');

const router = Router();

router.get('/local', (req, res, next) => {
  try {
    const browsePath = req.query.path || '';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const result = browseLocal(browsePath, page, limit);
    res.json(result);
  } catch (err) {
    if (err.message.includes('does not exist') || err.message.includes('not a directory')) {
      return res.status(404).json({ error: { message: err.message } });
    }
    next(err);
  }
});

module.exports = router;
