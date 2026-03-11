const { getDb } = require('../db/connection');
const { scanDirectory } = require('./localScannerService');
const dropboxService = require('./dropboxService');
const plexService = require('./plexService');

function listSources() {
  const db = getDb();
  return db.prepare('SELECT * FROM sources ORDER BY id').all();
}

function getSource(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
}

function createSource({ name, type, path, include_subfolders = 1, credential_id = null, plex_server_url = null }) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO sources (name, type, path, include_subfolders, credential_id, plex_server_url) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, type, path, include_subfolders, credential_id, plex_server_url);
  return getSource(result.lastInsertRowid);
}

function updateSource(id, updates) {
  const db = getDb();
  const source = getSource(id);
  if (!source) return null;

  const fields = ['name', 'type', 'path', 'include_subfolders', 'credential_id', 'plex_server_url'];
  const setClauses = [];
  const values = [];

  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }

  if (setClauses.length === 0) return source;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE sources SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  return getSource(id);
}

function deleteSource(id) {
  const db = getDb();
  db.prepare('DELETE FROM image_cache WHERE source_id = ?').run(id);
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
}

function getSelectionState(sourceId) {
  const db = getDb();
  const existingImages = db.prepare(
    `SELECT id, file_path, selected, review_status, favorite, reviewed_at
     FROM image_cache
     WHERE source_id = ?`
  ).all(sourceId);

  const imageStateByPath = new Map();
  for (const img of existingImages) {
    imageStateByPath.set(img.file_path, {
      selected: img.selected,
      review_status: img.review_status || 'pending',
      favorite: img.favorite || 0,
      reviewed_at: img.reviewed_at || null,
    });
  }

  const playlistSelections = db.prepare(
    `SELECT pi.playlist_id, pi.sort_order, ic.file_path
     FROM playlist_images pi
     JOIN image_cache ic ON ic.id = pi.image_id
     WHERE ic.source_id = ?
     ORDER BY pi.playlist_id, pi.sort_order`
  ).all(sourceId);

  const playlistSelectionMap = new Map();
  for (const row of playlistSelections) {
    if (!playlistSelectionMap.has(row.playlist_id)) {
      playlistSelectionMap.set(row.playlist_id, []);
    }
    playlistSelectionMap.get(row.playlist_id).push({ file_path: row.file_path, sort_order: row.sort_order });
  }

  return { imageStateByPath, playlistSelectionMap };
}

async function scanSource(id) {
  const db = getDb();
  const source = getSource(id);
  if (!source) return null;

  const { imageStateByPath, playlistSelectionMap } = getSelectionState(id);

  let images = [];

  if (source.type === 'local') {
    images = scanDirectory(source.path, !!source.include_subfolders).map(img => ({
      ...img,
      thumbnail_path: null,
    }));
  } else if (source.type === 'dropbox') {
    images = (await dropboxService.listImages(source.credential_id, source.path, !!source.include_subfolders)).map(img => ({
      ...img,
      thumbnail_path: null,
    }));
  } else if (source.type === 'plex') {
    images = await plexService.listPhotos(source.credential_id, source.plex_server_url, source.path);
  }

  const insertImage = db.prepare(
    `INSERT INTO image_cache (
      source_id, file_path, file_name, selected, thumbnail_path, is_available,
      review_status, favorite, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertPlaylistImage = db.prepare(
    'INSERT INTO playlist_images (playlist_id, image_id, sort_order) VALUES (?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM image_cache WHERE source_id = ?').run(id);

    const insertedByPath = new Map();
    for (const img of images) {
      const existingState = imageStateByPath.get(img.file_path);
      const result = insertImage.run(
        id,
        img.file_path,
        img.file_name,
        existingState ? existingState.selected : 1,
        img.thumbnail_path || null,
        1,
        existingState ? existingState.review_status : 'pending',
        existingState ? existingState.favorite : 0,
        existingState ? existingState.reviewed_at : null
      );
      insertedByPath.set(img.file_path, result.lastInsertRowid);
    }

    for (const [playlistId, selections] of playlistSelectionMap.entries()) {
      let sortOrder = 0;
      for (const selection of selections) {
        const imageId = insertedByPath.get(selection.file_path);
        if (!imageId) continue;
        insertPlaylistImage.run(playlistId, imageId, sortOrder);
        sortOrder++;
      }
    }
  });

  transaction();

  return { count: images.length };
}

function getSourceImages(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM image_cache WHERE source_id = ? AND is_available = 1 ORDER BY file_name').all(id);
}

function markImageUnavailable(sourceId, imageId) {
  const db = getDb();
  db.prepare('UPDATE image_cache SET is_available = 0 WHERE source_id = ? AND id = ?').run(sourceId, imageId);
}

function updateImageSelection(sourceId, imageIds, selected) {
  const db = getDb();
  if (!imageIds || imageIds.length === 0) {
    db.prepare('UPDATE image_cache SET selected = ? WHERE source_id = ?').run(selected, sourceId);
  } else {
    const normalizedIds = Array.from(new Set(imageIds.map(id => parseInt(id, 10)).filter(id => Number.isInteger(id))));
    if (normalizedIds.length === 0) return;
    const placeholders = normalizedIds.map(() => '?').join(',');
    db.prepare(
      `UPDATE image_cache SET selected = ? WHERE source_id = ? AND id IN (${placeholders})`
    ).run(selected, sourceId, ...normalizedIds);
  }
}

function updateImageReviewState(imageId, { review_status, favorite, reviewed_at }) {
  const db = getDb();
  db.prepare(
    `UPDATE image_cache
     SET review_status = ?,
         favorite = ?,
         reviewed_at = ?,
         selected = CASE
           WHEN ? = 'approved' THEN 1
           WHEN ? = 'hidden' THEN 0
           ELSE selected
         END
     WHERE id = ?`
  ).run(review_status, favorite, reviewed_at, review_status, review_status, imageId);
}

function getSourceImageCounts(sourceId) {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM image_cache WHERE source_id = ? AND is_available = 1').get(sourceId);
  const selected = db.prepare('SELECT COUNT(*) as count FROM image_cache WHERE source_id = ? AND selected = 1 AND is_available = 1').get(sourceId);
  return { total: total.count, selected: selected.count };
}

module.exports = {
  listSources,
  getSource,
  createSource,
  updateSource,
  deleteSource,
  scanSource,
  getSourceImages,
  markImageUnavailable,
  updateImageSelection,
  updateImageReviewState,
  getSourceImageCounts,
};
