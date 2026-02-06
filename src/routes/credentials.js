const { Router } = require('express');
const { listCredentials, deleteCredential } = require('../services/credentialService');
const { getDb } = require('../db/connection');
const { parseIntParam } = require('../utils/parseIntParam');

const router = Router();

router.get('/', (req, res) => {
  const credentials = listCredentials();
  res.json(credentials);
});

router.delete('/:id', (req, res) => {
  const id = parseIntParam(req, res, 'id');
  if (id === null) return;

  // Check if any sources reference this credential
  const db = getDb();
  const source = db.prepare('SELECT id FROM sources WHERE credential_id = ?').get(id);
  if (source) {
    return res.status(409).json({
      error: { message: 'Credential is in use by a source. Remove the source first.' },
    });
  }

  deleteCredential(id);
  res.json({ message: 'Credential deleted' });
});

module.exports = router;
