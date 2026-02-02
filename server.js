require('dotenv').config();

const createApp = require('./src/app');
const { runMigrations } = require('./src/db/migrations');
const { closeDb } = require('./src/db/connection');
const { loadOrCreateMasterKey } = require('./src/services/cryptoService');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

runMigrations();
loadOrCreateMasterKey();

const app = createApp();

const server = app.listen(PORT, HOST, () => {
  const os = require('os');
  console.log(`Slideshow server running on http://${HOST}:${PORT}`);
  if (HOST === '0.0.0.0') {
    // Show LAN IP addresses for convenience
    const interfaces = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          console.log(`  LAN access: http://${addr.address}:${PORT}`);
        }
      }
    }
  }
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  closeDb();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  closeDb();
  server.close(() => process.exit(0));
});
