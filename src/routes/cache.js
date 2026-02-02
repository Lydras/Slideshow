const { Router } = require('express');
const { getCacheStats, clearCache } = require('../services/cacheService');

const router = Router();

// Get cache statistics
router.get('/stats', (req, res) => {
  const stats = getCacheStats();
  res.json(stats);
});

// Clear all cached files
router.delete('/', (req, res) => {
  const result = clearCache();
  res.json({ message: `Cleared ${result.deleted} cached files` });
});

module.exports = router;
