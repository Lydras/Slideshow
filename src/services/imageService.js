const { getDb } = require('../db/connection');
const { shuffleArray } = require('../utils/shuffleArray');
const { getAllSettings } = require('./settingsService');

function getImagesForPlaylist(playlistId) {
  const db = getDb();

  let sourceIds;
  if (playlistId) {
    const rows = db.prepare(
      'SELECT source_id FROM playlist_sources WHERE playlist_id = ? ORDER BY sort_order'
    ).all(playlistId);
    sourceIds = rows.map(r => r.source_id);
  } else {
    // No playlist: use all sources
    const rows = db.prepare('SELECT id FROM sources ORDER BY id').all();
    sourceIds = rows.map(r => r.id);
  }

  if (sourceIds.length === 0) return [];

  const placeholders = sourceIds.map(() => '?').join(',');

  // Check if playlist has custom image selections
  if (playlistId) {
    const customCount = db.prepare(
      'SELECT COUNT(*) as count FROM playlist_images WHERE playlist_id = ?'
    ).get(playlistId);

    if (customCount.count > 0) {
      // Use playlist-specific image selections
      const images = db.prepare(
        `SELECT ic.*, s.type as source_type, s.plex_server_url
         FROM playlist_images pi
         JOIN image_cache ic ON ic.id = pi.image_id
         JOIN sources s ON s.id = ic.source_id
         WHERE pi.playlist_id = ?
         ORDER BY pi.sort_order, ic.file_name`
      ).all(playlistId);
      return images;
    }
  }

  // Default: return selected images from sources
  const images = db.prepare(
    `SELECT ic.*, s.type as source_type, s.plex_server_url
     FROM image_cache ic
     JOIN sources s ON s.id = ic.source_id
     WHERE ic.source_id IN (${placeholders}) AND ic.selected = 1
     ORDER BY ic.source_id, ic.file_name`
  ).all(...sourceIds);

  return images;
}

function getSlideshowImages(playlistId) {
  const settings = getAllSettings();
  let images = getImagesForPlaylist(playlistId || settings.active_playlist_id || null);

  // Build URLs for each image
  images = images.map(img => ({
    id: img.id,
    source_id: img.source_id,
    file_name: img.file_name,
    url: buildImageUrl(img),
  }));

  if (settings.order === 'random') {
    images = shuffleArray(images);
  }

  return images;
}

function encodePathSegments(filePath) {
  return filePath.split('/').map(s => encodeURIComponent(s)).join('/');
}

function buildImageUrl(image) {
  if (image.source_type === 'local') {
    return `/api/images/serve/local/${image.source_id}/${encodeURIComponent(image.file_path)}`;
  }
  if (image.source_type === 'dropbox') {
    return `/api/images/serve/dropbox/${image.source_id}${encodePathSegments(image.file_path)}`;
  }
  if (image.source_type === 'plex') {
    return `/api/images/serve/plex/${image.source_id}${encodePathSegments(image.file_path)}`;
  }
  return '';
}

module.exports = { getSlideshowImages, getImagesForPlaylist };
