const { getDb } = require('../db/connection');
const { encrypt, decrypt } = require('./cryptoService');

function listCredentials() {
  const db = getDb();
  return db.prepare('SELECT id, service, label, created_at, updated_at FROM credentials').all();
}

function getCredential(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM credentials WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    decrypted_data: JSON.parse(decrypt(row.encrypted_data)),
  };
}

function storeCredential(service, label, data) {
  const db = getDb();
  const encrypted = encrypt(JSON.stringify(data));
  const result = db.prepare(
    'INSERT INTO credentials (service, label, encrypted_data) VALUES (?, ?, ?)'
  ).run(service, label, encrypted);
  return result.lastInsertRowid;
}

function updateCredential(id, data) {
  const db = getDb();
  const encrypted = encrypt(JSON.stringify(data));
  db.prepare(
    "UPDATE credentials SET encrypted_data = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(encrypted, id);
}

function deleteCredential(id) {
  const db = getDb();
  db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
}

module.exports = {
  listCredentials,
  getCredential,
  storeCredential,
  updateCredential,
  deleteCredential,
};
