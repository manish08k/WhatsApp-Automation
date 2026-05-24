const express = require('express');
const router = express.Router();
const wa = require('../services/whatsapp');
const { processWAMessage, processWAInteractive } = require('../engine/processor');
const logger = require('../logger');

// ── GET: Meta webhook verification ──────────────────────────────────────────
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    logger.info('WA webhook verified');
    return res.status(200).send(challenge);
  }
  logger.warn('WA webhook verification failed', { token });
  res.sendStatus(403);
});

// ── POST: Receive messages & status updates ──────────────────────────────────
router.post('/', async (req, res) => {
  // Always respond 200 immediately — Meta retries if you don't
  res.sendStatus(200);

  const messages = wa.parseWebhook(req.body);
  for (const msg of messages) {
    if (msg.msgType === 'text') {
      await processWAMessage(msg).catch(err =>
        logger.error('processWAMessage error', { err: err.message })
      );
    } else if (msg.msgType === 'interactive') {
      await processWAInteractive(msg).catch(err =>
        logger.error('processWAInteractive error', { err: err.message })
      );
    } else {
      logger.info('WA non-text message', { type: msg.msgType, from: msg.from });
    }
  }
});

module.exports = router;
