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

function updateSettings(updates) {
  const db = getDb();
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      upsert.run(key, String(value));
    }
  });
  transaction();
  return getAllSettings();
}

module.exports = { getAllSettings, getSetting, updateSettings };
