const express = require('express');
const morgan = require('morgan');
const path = require('path');
const { PUBLIC_DIR, BODY_SIZE_LIMIT } = require('./config/constants');
const { helmetMiddleware, globalRateLimit } = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(helmetMiddleware);
  app.use(globalRateLimit);

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(express.json({ limit: BODY_SIZE_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: BODY_SIZE_LIMIT }));
  app.use(express.static(PUBLIC_DIR));

  app.use('/api', require('./routes'));

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
