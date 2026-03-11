const { getDb } = require('../db/connection');
const { shuffleArray } = require('../utils/shuffleArray');
const { getAllSettings } = require('./settingsService');

function playlistExists(db, playlistId) {
  if (!playlistId) return false;
  const row = db.prepare('SELECT id FROM playlists WHERE id = ?').get(playlistId);
  return !!row;
}

function getImagesForPlaylist(playlistId) {
  const db = getDb();

  let sourceIds;
  if (playlistId) {
    const rows = db.prepare(
      'SELECT source_id FROM playlist_sources WHERE playlist_id = ? ORDER BY sort_order'
    ).all(playlistId);
    sourceIds = rows.map(r => r.source_id);
  } else {
    const rows = db.prepare('SELECT id FROM sources ORDER BY id').all();
    sourceIds = rows.map(r => r.id);
  }

  if (sourceIds.length === 0) return [];

  const placeholders = sourceIds.map(() => '?').join(',');

  if (playlistId) {
    const customCount = db.prepare(
      `SELECT COUNT(*) as count
       FROM playlist_images pi
       JOIN image_cache ic ON ic.id = pi.image_id
       WHERE pi.playlist_id = ? AND ic.is_available = 1`
    ).get(playlistId);

    if (customCount.count > 0) {
      return db.prepare(
        `SELECT ic.*, s.type as source_type, s.plex_server_url
         FROM playlist_images pi
         JOIN image_cache ic ON ic.id = pi.image_id
         JOIN sources s ON s.id = ic.source_id
         WHERE pi.playlist_id = ? AND ic.is_available = 1
         ORDER BY pi.sort_order, ic.file_name`
      ).all(playlistId);
    }
  }

  return db.prepare(
    `SELECT ic.*, s.type as source_type, s.plex_server_url
     FROM image_cache ic
     JOIN sources s ON s.id = ic.source_id
     WHERE ic.source_id IN (${placeholders}) AND ic.selected = 1 AND ic.is_available = 1
     ORDER BY ic.source_id, ic.file_name`
  ).all(...sourceIds);
}

function getEffectivePlaylistId(explicitPlaylistId) {
  const db = getDb();
  if (explicitPlaylistId && playlistExists(db, explicitPlaylistId)) {
    return explicitPlaylistId;
  }

  const settings = getAllSettings();
  const activePlaylistId = settings.active_playlist_id || null;
  if (activePlaylistId && playlistExists(db, activePlaylistId)) {
    return activePlaylistId;
  }

  return null;
}

function weightImages(images) {
  return images.flatMap(image => {
    const weight = image.favorite === 1 ? 2 : 1;
    return Array.from({ length: weight }, () => ({
      id: image.id,
      source_id: image.source_id,
      file_name: image.file_name,
      url: buildImageUrl(image),
    }));
  });
}

function getSlideshowImages(playlistId) {
  const settings = getAllSettings();
  let images = getImagesForPlaylist(getEffectivePlaylistId(playlistId));

  images = weightImages(images);

  if (settings.order === 'random') {
    images = shuffleArray(images);
  }

  return images;
}

function encodePathSegments(filePath) {
  return filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function buildImageUrl(image) {
  if (image.source_type === 'local') {
    return `/api/images/serve/local/${image.source_id}/${encodeURIComponent(image.file_path)}`;
  }
  if (image.source_type === 'dropbox') {
    return `/api/images/serve/dropbox/${image.source_id}${encodePathSegments(image.file_path)}`;
  }
  if (image.source_type === 'plex') {
    return `/api/images/serve/plex/${image.source_id}/${image.id}`;
  }
  return '';
}

module.exports = { getSlideshowImages, getImagesForPlaylist, getEffectivePlaylistId };
