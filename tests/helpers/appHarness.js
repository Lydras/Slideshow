const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = path.join(os.tmpdir(), 'slideshow-app-tests');
process.env.NODE_ENV = 'test';
process.env.SLIDESHOW_DATA_DIR = dataDir;

function resetEnvironment() {
  try {
    require('../../src/db/connection').closeDb();
  } catch (err) {
    // Ignore first-run module resolution failures.
  }

  jest.resetModules();
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
}

function createHarness() {
  resetEnvironment();

  const { runMigrations } = require('../../src/db/migrations');
  const cryptoService = require('../../src/services/cryptoService');
  const sourceService = require('../../src/services/sourceService');
  const playlistService = require('../../src/services/playlistService');
  const settingsService = require('../../src/services/settingsService');
  const credentialService = require('../../src/services/credentialService');
  const authService = require('../../src/services/authService');
  const { closeDb } = require('../../src/db/connection');
  const createApp = require('../../src/app');

  cryptoService._resetMasterKey();
  runMigrations();
  cryptoService.loadOrCreateMasterKey();

  return {
    app: createApp(),
    closeDb,
    sourceService,
    playlistService,
    settingsService,
    credentialService,
    authService,
    dataDir,
  };
}

module.exports = { createHarness, dataDir };
