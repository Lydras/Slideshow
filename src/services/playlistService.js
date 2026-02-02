const { getDb } = require('../db/connection');

function listPlaylists() {
  const db = getDb();
  const playlists = db.prepare('SELECT * FROM playlists ORDER BY id').all();

  // Attach sources for each playlist
  const getSourcesStmt = db.prepare(
    'SELECT source_id, sort_order FROM playlist_sources WHERE playlist_id = ? ORDER BY sort_order'
  );
  for (const playlist of playlists) {
    playlist.sources = getSourcesStmt.all(playlist.id);
  }

  return playlists;
}

function getPlaylist(id) {
  const db = getDb();
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
  if (!playlist) return null;

  playlist.sources = db.prepare(
    'SELECT source_id, sort_order FROM playlist_sources WHERE playlist_id = ? ORDER BY sort_order'
  ).all(id);

  return playlist;
}

function createPlaylist({ name, description = '' }) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO playlists (name, description) VALUES (?, ?)'
  ).run(name, description);
  return getPlaylist(result.lastInsertRowid);
}

function updatePlaylist(id, updates) {
  const db = getDb();
  const playlist = getPlaylist(id);
  if (!playlist) return null;

  const fields = ['name', 'description'];
  const setClauses = [];
  const values = [];

  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }

  if (setClauses.length === 0) return playlist;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE playlists SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  return getPlaylist(id);
}

function deletePlaylist(id) {
  const db = getDb();
  db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
}

function addSource(playlistId, sourceId, sortOrder = 0) {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO playlist_sources (playlist_id, source_id, sort_order) VALUES (?, ?, ?)'
  ).run(playlistId, sourceId, sortOrder);
  return getPlaylist(playlistId);
}

function removeSource(playlistId, sourceId) {
  const db = getDb();
  db.prepare(
    'DELETE FROM playlist_sources WHERE playlist_id = ? AND source_id = ?'
  ).run(playlistId, sourceId);
  return getPlaylist(playlistId);
}

function getPlaylistImages(playlistId) {
  const db = getDb();
  return db.prepare(
    `SELECT pi.image_id, pi.sort_order, ic.file_path, ic.file_name, ic.source_id
     FROM playlist_images pi
     JOIN image_cache ic ON ic.id = pi.image_id
     WHERE pi.playlist_id = ?
     ORDER BY pi.sort_order, ic.file_name`
  ).all(playlistId);
}

function setPlaylistImages(playlistId, imageIds) {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM playlist_images WHERE playlist_id = ?').run(playlistId);
    const insert = db.prepare(
      'INSERT INTO playlist_images (playlist_id, image_id, sort_order) VALUES (?, ?, ?)'
    );
    for (let i = 0; i < imageIds.length; i++) {
      insert.run(playlistId, imageIds[i], i);
    }
  });
  transaction();
}

function clearPlaylistImages(playlistId) {
  const db = getDb();
  db.prepare('DELETE FROM playlist_images WHERE playlist_id = ?').run(playlistId);
}

module.exports = {
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
};
