const { getDb } = require('../db/connection');
const { updateImageReviewState } = require('./sourceService');

function getReviewQueue({ mode = 'newly-scanned', limit = 50 } = {}) {
  const db = getDb();
  const normalizedMode = mode === 'unreviewed' ? 'unreviewed' : 'newly-scanned';
  const parsedLimit = Number.parseInt(limit, 10);
  const maxRows = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
  const orderClause = normalizedMode === 'unreviewed' ? 'ic.id ASC' : 'ic.id DESC';

  return db.prepare(
    `SELECT ic.*, s.name AS source_name, s.type AS source_type
     FROM image_cache ic
     JOIN sources s ON s.id = ic.source_id
     WHERE ic.review_status = 'pending' AND ic.is_available = 1
     ORDER BY ${orderClause}
     LIMIT ?`
  ).all(maxRows);
}

function getReviewQueueItem(imageId) {
  const db = getDb();
  return db.prepare(
    `SELECT ic.*, s.name AS source_name, s.type AS source_type
     FROM image_cache ic
     JOIN sources s ON s.id = ic.source_id
     WHERE ic.id = ?`
  ).get(imageId);
}

function applyReviewAction(imageId, action) {
  const existing = getReviewQueueItem(imageId);
  if (!existing) return null;

  if (action === 'skip') {
    return existing;
  }

  const reviewedAt = new Date().toISOString();
  const nextState = {
    approve: {
      review_status: 'approved',
      favorite: existing.favorite || 0,
      reviewed_at: reviewedAt,
    },
    hide: {
      review_status: 'hidden',
      favorite: 0,
      reviewed_at: reviewedAt,
    },
    favorite: {
      review_status: 'approved',
      favorite: 1,
      reviewed_at: reviewedAt,
    },
  }[action];

  if (!nextState) {
    return null;
  }

  updateImageReviewState(imageId, nextState);
  return getReviewQueueItem(imageId);
}

module.exports = {
  getReviewQueue,
  applyReviewAction,
};
