const rateLimit = require('express-rate-limit');

// Per-IP limit for webhook endpoints (Meta sends bursts, so keep generous)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// Strict limit for manual send API
const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Send rate limit exceeded. Max 60/min.' },
});

// General API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { webhookLimiter, sendLimiter, apiLimiter };
