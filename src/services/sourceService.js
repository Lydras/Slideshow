const { getDb } = require('../db/connection');
const { scanDirectory } = require('./localScannerService');

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

async function scanSource(id) {
  const db = getDb();
  const source = getSource(id);
  if (!source) return null;

  // Build map of existing selections before clearing
  const existingImages = db.prepare(
    'SELECT file_path, selected FROM image_cache WHERE source_id = ?'
  ).all(id);
  const selectionMap = new Map();
  for (const img of existingImages) {
    selectionMap.set(img.file_path, img.selected);
  }

  let images = [];

  if (source.type === 'local') {
    images = scanDirectory(source.path, !!source.include_subfolders);
  } else if (source.type === 'dropbox') {
    const dropboxService = require('./dropboxService');
    images = await dropboxService.listImages(source.credential_id, source.path, !!source.include_subfolders);
  } else if (source.type === 'plex') {
    const plexService = require('./plexService');
    images = await plexService.listPhotos(source.credential_id, source.plex_server_url, source.path);
  }

  // Clear and re-insert inside a single transaction so a failed scan doesn't lose data
  const insert = db.prepare(
    'INSERT INTO image_cache (source_id, file_path, file_name, selected) VALUES (?, ?, ?, ?)'
  );
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM image_cache WHERE source_id = ?').run(id);
    for (const img of images) {
      // Preserve previous selection state; new images default to selected
      const selected = selectionMap.has(img.file_path) ? selectionMap.get(img.file_path) : 1;
      insert.run(id, img.file_path, img.file_name, selected);
    }
  });
  transaction();

  return { count: images.length };
}

function getSourceImages(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM image_cache WHERE source_id = ? ORDER BY file_name').all(id);
}

function updateImageSelection(sourceId, imageIds, selected) {
  const db = getDb();
  if (!imageIds || imageIds.length === 0) {
    // Update all images for this source
    db.prepare('UPDATE image_cache SET selected = ? WHERE source_id = ?').run(selected, sourceId);
  } else {
    const placeholders = imageIds.map(() => '?').join(',');
    db.prepare(
      `UPDATE image_cache SET selected = ? WHERE source_id = ? AND id IN (${placeholders})`
    ).run(selected, sourceId, ...imageIds);
  }
}

function getSourceImageCounts(sourceId) {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM image_cache WHERE source_id = ?').get(sourceId);
  const selected = db.prepare('SELECT COUNT(*) as count FROM image_cache WHERE source_id = ? AND selected = 1').get(sourceId);
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
  updateImageSelection,
  getSourceImageCounts,
};
