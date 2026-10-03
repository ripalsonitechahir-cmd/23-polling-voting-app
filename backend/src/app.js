const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('./config');
const logger = require('./logger');
const { prisma } = require('./db');
const { router: pollsRouter } = require('./polls');
const { ValidationError } = require('./validation');

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

// Minimal cookie parser (avoids an extra dependency).
app.use((req, _res, next) => {
  req.cookies = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) req.cookies[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path !== '/health') {
      logger.info('request', { method: req.method, path: req.originalUrl, status: res.statusCode, ms: Date.now() - start });
    }
  });
  next();
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (err) {
    logger.error('health check failed', { error: err.message });
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/polls', pollsRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app, falling back to index.html for client-side routes.
if (fs.existsSync(path.join(config.staticDir, 'index.html'))) {
  app.use(express.static(config.staticDir));
  app.get('*', (_req, res) => res.sendFile(path.join(config.staticDir, 'index.html')));
}

// Express recognises error handlers by their 4-argument signature.
app.use((err, _req, res, _next) => {
  if (err instanceof ValidationError) return res.status(400).json({ error: err.errors[0], errors: err.errors });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  logger.error('unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
