const { getDb } = require('./connection');
const defaults = require('../config/defaults');

function runMigrations() {
  const db = getDb();

  // Core tables (no new columns - compatible with existing databases)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,
      label TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('local', 'dropbox', 'plex')),
      path TEXT NOT NULL,
      include_subfolders INTEGER NOT NULL DEFAULT 1,
      credential_id INTEGER,
      plex_server_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlist_sources (
      playlist_id INTEGER NOT NULL,
      source_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playlist_id, source_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS image_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_image_cache_source_id ON image_cache(source_id);
  `);

  // Run incremental migrations (adds columns to existing tables)
  runIncrementalMigrations(db);

  // Create tables and indexes that depend on incremental migrations
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_image_cache_selected ON image_cache(source_id, selected);

    CREATE TABLE IF NOT EXISTS playlist_images (
      playlist_id INTEGER NOT NULL,
      image_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playlist_id, image_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (image_id) REFERENCES image_cache(id) ON DELETE CASCADE
    );
  `);

  // Seed default settings
  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  const seedTransaction = db.transaction(() => {
    for (const [key, value] of Object.entries(defaults)) {
      insert.run(key, value);
    }
  });
  seedTransaction();
}

function runIncrementalMigrations(db) {
  // Add 'selected' column to image_cache if missing (for existing databases)
  const columns = db.prepare("PRAGMA table_info(image_cache)").all();
  const hasSelected = columns.some(c => c.name === 'selected');
  if (!hasSelected) {
    db.exec('ALTER TABLE image_cache ADD COLUMN selected INTEGER NOT NULL DEFAULT 1');
  }
}

module.exports = { runMigrations };
