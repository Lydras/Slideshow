const { getDb } = require('../db/connection');
const defaults = require('../config/defaults');

function getAllSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = { ...defaults };
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

function getSetting(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : (defaults[key] ?? null);
}

function normalizeSettingsUpdates(db, updates) {
  const normalized = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    if (key === 'active_playlist_id') {
      const playlistId = String(value || '').trim();
      if (!playlistId) {
        normalized[key] = '';
        continue;
      }

      const existing = db.prepare('SELECT id FROM playlists WHERE id = ?').get(playlistId);
      if (!existing) {
        const err = new Error('Selected playlist does not exist');
        err.status = 400;
        throw err;
      }

      normalized[key] = String(existing.id);
      continue;
    }

    normalized[key] = String(value);
  }

  return normalized;
}

function updateSettings(updates) {
  const db = getDb();
  const normalized = normalizeSettingsUpdates(db, updates);
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(normalized)) {
      upsert.run(key, value);
    }
  });
  transaction();
  return getAllSettings();
}

module.exports = { getAllSettings, getSetting, updateSettings };
