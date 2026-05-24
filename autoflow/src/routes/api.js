const express = require('express');
const router = express.Router();
const store = require('../store');
const wa = require('../services/whatsapp');
const ig = require('../services/instagram');
const { runFlow } = require('../engine/flowRunner');
const { processWAMessage, processIGEvent } = require('../engine/processor');
const logger = require('../logger');

// ── Flows ────────────────────────────────────────────────────────────────────
router.get('/flows', (req, res) => res.json(store.flows));

router.post('/flows', (req, res) => {
  const { id, name, channel, steps } = req.body;
  if (!id || !name || !channel) return res.status(400).json({ error: 'id, name, channel required' });
  if (store.flows.find(f => f.id === id)) return res.status(409).json({ error: 'Flow ID already exists' });
  const flow = { id, name, channel, active: true, steps: steps || [] };
  store.flows.push(flow);
  logger.info('Flow created', { id, name });
  res.status(201).json(flow);
});

router.patch('/flows/:id', (req, res) => {
  const flow = store.getFlow(req.params.id);
  if (!flow) return res.status(404).json({ error: 'Not found' });
  Object.assign(flow, req.body);
  res.json(flow);
});

router.delete('/flows/:id', (req, res) => {
  const idx = store.flows.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.flows.splice(idx, 1);
  res.json({ deleted: req.params.id });
});

router.post('/flows/:id/run', async (req, res) => {
  const flow = store.getFlow(req.params.id);
  if (!flow) return res.status(404).json({ error: 'Not found' });
  const ctx = req.body.context || {};
  runFlow(req.params.id, ctx).catch(err => logger.error('Manual flow run error', { err: err.message }));
  res.json({ queued: true, flowId: req.params.id });
});

// ── Triggers ─────────────────────────────────────────────────────────────────
router.get('/triggers', (req, res) => res.json(store.triggers));

router.post('/triggers', (req, res) => {
  const { id, name, channel, event, condition, flowId, replyTemplate } = req.body;
  if (!id || !name || !channel || !event) return res.status(400).json({ error: 'id, name, channel, event required' });
  if (store.triggers.find(t => t.id === id)) return res.status(409).json({ error: 'Trigger ID exists' });
  const trigger = { id, name, channel, event, condition: condition || { type: 'any' },
    flowId: flowId || null, replyTemplate: replyTemplate || null, active: true, firedCount: 0 };
  store.triggers.push(trigger);
  res.status(201).json(trigger);
});

router.patch('/triggers/:id', (req, res) => {
  const t = store.getTrigger(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  Object.assign(t, req.body);
  res.json(t);
});

router.delete('/triggers/:id', (req, res) => {
  const idx = store.triggers.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.triggers.splice(idx, 1);
  res.json({ deleted: req.params.id });
});

// ── Templates ────────────────────────────────────────────────────────────────
router.get('/templates', (req, res) => res.json(store.templates));

router.put('/templates/:name', (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body required' });
  store.templates[req.params.name] = body;
  res.json({ name: req.params.name, body });
});

router.delete('/templates/:name', (req, res) => {
  if (!store.templates[req.params.name]) return res.status(404).json({ error: 'Not found' });
  delete store.templates[req.params.name];
  res.json({ deleted: req.params.name });
});

// ── Logs ─────────────────────────────────────────────────────────────────────
router.get('/logs', (req, res) => {
  let logs = store.logs;
  if (req.query.channel) logs = logs.filter(l => l.channel === req.query.channel);
  if (req.query.level)   logs = logs.filter(l => l.level === req.query.level);
  const limit = parseInt(req.query.limit) || 100;
  res.json(logs.slice(0, limit));
});

router.delete('/logs', (req, res) => {
  store.logs.length = 0;
  res.json({ cleared: true });
});

// ── Manual Send ───────────────────────────────────────────────────────────────
router.post('/send/whatsapp', async (req, res) => {
  const { to, type, text, templateName, imageUrl, caption, buttons, body: btnBody } = req.body;
  if (!to) return res.status(400).json({ error: 'to is required' });
  try {
    let result;
    if (type === 'template') result = await wa.sendTemplate(to, templateName, req.body.lang || 'en_US');
    else if (type === 'image') result = await wa.sendImage(to, imageUrl, caption);
    else if (type === 'buttons') result = await wa.sendButtons(to, btnBody, buttons);
    else result = await wa.sendText(to, text || '');
    store.addLog({ level: 'info', channel: 'whatsapp', event: 'manual_send', msg: `Manual send → ${to}` });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send/instagram/dm', async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: 'to and text required' });
  try {
    const result = await ig.sendDM(to, text);
    store.addLog({ level: 'info', channel: 'instagram', event: 'manual_dm', msg: `Manual DM → ${to}` });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Test webhook simulation ───────────────────────────────────────────────────
router.post('/test/whatsapp', async (req, res) => {
  const { from, text } = req.body;
  if (!from || !text) return res.status(400).json({ error: 'from and text required' });
  const msg = { id: 'test_' + Date.now(), from, name: 'Test User', text, msgType: 'text', timestamp: Date.now() };
  await processWAMessage(msg);
  res.json({ simulated: true, msg });
});

router.post('/test/instagram', async (req, res) => {
  const { event = 'messages', senderId = 'test_ig_user', text = 'hello', commentId } = req.body;
  const evt = { event, senderId, text, commentId };
  await processIGEvent(evt);
  res.json({ simulated: true, evt });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  res.json({
    flows:    { total: store.flows.length, active: store.flows.filter(f => f.active).length },
    triggers: { total: store.triggers.length, active: store.triggers.filter(t => t.active).length,
                totalFired: store.triggers.reduce((s, t) => s + t.firedCount, 0) },
    templates: Object.keys(store.templates).length,
    logs: store.logs.length,
    optouts: store.optouts.size,
  });
});

module.exports = router;
