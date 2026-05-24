require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('./src/logger');
const { webhookLimiter, sendLimiter, apiLimiter } = require('./src/middleware/rateLimiter');

// Ensure logs dir exists
fs.mkdirSync('logs', { recursive: true });

const app = express();

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ── Serve UI ──────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Webhook routes ────────────────────────────────────────────────────────────
app.use('/webhook/whatsapp', webhookLimiter, require('./src/routes/whatsapp'));
app.use('/webhook/instagram', webhookLimiter, require('./src/routes/instagram'));

// ── REST API ──────────────────────────────────────────────────────────────────
app.use('/api', apiLimiter, require('./src/routes/api'));

// ── Send endpoints (stricter limit) ───────────────────────────────────────────
// Already nested under /api/send in routes/api.js, limiter applied at /api

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  uptime: process.uptime(),
  env: process.env.NODE_ENV || 'development',
  ts: new Date().toISOString(),
}));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`AutoFlow engine running on port ${PORT}`);
  logger.info(`Webhooks: POST /webhook/whatsapp  POST /webhook/instagram`);
  logger.info(`API:      GET/POST /api/flows  /api/triggers  /api/templates`);
});

module.exports = app;
