const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { THUMBNAIL_DIR, THUMBNAIL_SIZE, THUMBNAIL_QUALITY } = require('../config/constants');
const { getSource } = require('./sourceService');
const { getDb } = require('../db/connection');
const dropboxService = require('./dropboxService');
const plexService = require('./plexService');

function ensureThumbnailDir() {
  if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
  }
}

function getThumbnailKey(sourceId, filePath) {
  return crypto.createHash('md5').update(`${sourceId}:${filePath}`).digest('hex');
}

function getThumbnailPath(key) {
  return path.join(THUMBNAIL_DIR, `${key}.jpg`);
}

async function getThumbnail(sourceId, imageId) {
  const db = getDb();
  const image = db.prepare('SELECT * FROM image_cache WHERE id = ? AND source_id = ?').get(imageId, sourceId);
  if (!image) return null;

  const source = getSource(sourceId);
  if (!source) return null;

  const cacheKey = image.thumbnail_path || image.file_path;
  const key = getThumbnailKey(sourceId, cacheKey);
  const thumbPath = getThumbnailPath(key);

  if (fs.existsSync(thumbPath)) {
    return { path: thumbPath, contentType: 'image/jpeg' };
  }

  ensureThumbnailDir();

  if (source.type === 'local') {
    return generateLocalThumbnail(image, thumbPath);
  }
  if (source.type === 'dropbox') {
    return generateDropboxThumbnail(source, image, thumbPath);
  }
  if (source.type === 'plex') {
    return generatePlexThumbnail(source, image, thumbPath);
  }

  return null;
}

async function generateLocalThumbnail(image, thumbPath) {
  const fullPath = path.resolve(image.file_path);
  if (!fs.existsSync(fullPath)) return null;

  try {
    await sharp(fullPath)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toFile(thumbPath);
    return { path: thumbPath, contentType: 'image/jpeg' };
  } catch (err) {
    console.error(`Thumbnail generation failed for ${fullPath}:`, err.message);
    return null;
  }
}

async function generateDropboxThumbnail(source, image, thumbPath) {
  try {
    const thumbnailData = await dropboxService.getThumbnail(source.credential_id, image.file_path);
    if (thumbnailData) {
      fs.writeFileSync(thumbPath, thumbnailData);
      return { path: thumbPath, contentType: 'image/jpeg' };
    }

    const buffer = await dropboxService.downloadFile(source.credential_id, image.file_path);
    await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toFile(thumbPath);
    return { path: thumbPath, contentType: 'image/jpeg' };
  } catch (err) {
    console.error(`Dropbox thumbnail failed for ${image.file_path}:`, err.message);
    return null;
  }
}

async function generatePlexThumbnail(source, image, thumbPath) {
  const thumbnailSource = image.thumbnail_path || image.file_path;

  try {
    const thumbData = await plexService.getThumbnail(
      source.credential_id,
      source.plex_server_url,
      thumbnailSource
    );

    if (thumbData) {
      await sharp(thumbData.buffer)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: THUMBNAIL_QUALITY })
        .toFile(thumbPath);
      return { path: thumbPath, contentType: 'image/jpeg' };
    }

    // Backward compatibility for older scans that only stored a metadata key.
    const fullImage = await plexService.downloadPhoto(
      source.credential_id,
      source.plex_server_url,
      image.file_path
    );

    await sharp(fullImage.buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toFile(thumbPath);
    return { path: thumbPath, contentType: 'image/jpeg' };
  } catch (err) {
    console.error(`Plex thumbnail failed for ${thumbnailSource}:`, err.message);
    return null;
  }
}

module.exports = { getThumbnail };
