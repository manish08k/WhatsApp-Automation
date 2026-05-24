const express = require('express');
const router = express.Router();
const ig = require('../services/instagram');
const { processIGEvent } = require('../engine/processor');
const logger = require('../logger');

// ── GET: Meta webhook verification ──────────────────────────────────────────
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.IG_VERIFY_TOKEN) {
    logger.info('IG webhook verified');
    return res.status(200).send(challenge);
  }
  logger.warn('IG webhook verification failed');
  res.sendStatus(403);
});

// ── POST: Receive events ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  res.sendStatus(200); // Respond immediately

  const events = ig.parseWebhook(req.body);
  for (const event of events) {
    await processIGEvent(event).catch(err =>
      logger.error('processIGEvent error', { err: err.message })
    );
  }
});

module.exports = router;
