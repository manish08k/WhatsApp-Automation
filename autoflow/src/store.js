/**
 * store.js — In-memory data store
 * Swap out methods with a DB (Postgres/Mongo) without changing callers.
 */

const store = {
  // ── Flows ────────────────────────────────────────────────────────────────
  flows: [
    {
      id: 'flow_welcome',
      name: 'Welcome Series',
      channel: 'whatsapp',
      active: true,
      steps: [
        { type: 'action', action: 'send_message', template: 'welcome_msg' },
        { type: 'wait',   delay: 600 },
        { type: 'action', action: 'send_message', template: 'catalog_link' },
      ],
    },
    {
      id: 'flow_ig_comment',
      name: 'IG Comment Reply',
      channel: 'instagram',
      active: true,
      steps: [
        { type: 'action', action: 'reply_comment', text: 'Thanks for your comment! 🙌' },
        { type: 'action', action: 'send_dm',       template: 'ig_offer_dm' },
      ],
    },
  ],

  // ── Triggers ────────────────────────────────────────────────────────────
  triggers: [
    {
      id: 'trig_price_wa',
      name: 'Keyword: price',
      channel: 'whatsapp',
      event: 'message_received',
      condition: { type: 'keyword', match: 'contains', value: 'price' },
      flowId: null,
      replyTemplate: 'pricing_template',
      active: true,
      firedCount: 0,
    },
    {
      id: 'trig_hello_wa',
      name: 'Greeting',
      channel: 'whatsapp',
      event: 'message_received',
      condition: { type: 'keyword', match: 'starts_with', value: 'hello' },
      flowId: 'flow_welcome',
      replyTemplate: null,
      active: true,
      firedCount: 0,
    },
    {
      id: 'trig_stop_wa',
      name: 'Opt-out STOP',
      channel: 'whatsapp',
      event: 'message_received',
      condition: { type: 'keyword', match: 'exact', value: 'stop' },
      flowId: null,
      replyTemplate: 'optout_msg',
      active: true,
      firedCount: 0,
    },
    {
      id: 'trig_ig_dm',
      name: 'New IG DM',
      channel: 'instagram',
      event: 'messages',
      condition: { type: 'any' },
      flowId: null,
      replyTemplate: 'ig_welcome_dm',
      active: true,
      firedCount: 0,
    },
    {
      id: 'trig_ig_comment',
      name: 'Any IG Comment',
      channel: 'instagram',
      event: 'comments',
      condition: { type: 'any' },
      flowId: 'flow_ig_comment',
      replyTemplate: null,
      active: true,
      firedCount: 0,
    },
  ],

  // ── Templates ───────────────────────────────────────────────────────────
  templates: {
    welcome_msg:      'Hello! Welcome to AutoFlow 🎉 How can we help you today?',
    catalog_link:     'Check out our full catalog here 👉 https://yoursite.com/catalog',
    pricing_template: 'Hi! Our plans:\n• Basic: ₹999/mo\n• Pro: ₹2499/mo\n• Enterprise: ₹9999/mo\nReply with a plan name to get started!',
    optout_msg:       'You have been unsubscribed. Reply START to rejoin anytime.',
    ig_offer_dm:      'Hey! Thanks for your comment 🙌 DM us for an exclusive 20% off code!',
    ig_welcome_dm:    'Hi there! 👋 Thanks for reaching out. How can we help you?',
    ig_story_thanks:  'Thank you so much for the mention! Here\'s a little something for you 🎁',
  },

  // ── Opt-out list ─────────────────────────────────────────────────────────
  optouts: new Set(),

  // ── Event log (ring buffer, last 1000) ───────────────────────────────────
  logs: [],
  _maxLogs: 1000,

  addLog(entry) {
    this.logs.unshift({ ...entry, ts: new Date().toISOString() });
    if (this.logs.length > this._maxLogs) this.logs.length = this._maxLogs;
  },

  // ── CRUD helpers ─────────────────────────────────────────────────────────
  getFlow: (id) => store.flows.find(f => f.id === id) || null,
  getTrigger: (id) => store.triggers.find(t => t.id === id) || null,
  getTemplate: (name) => store.templates[name] || null,
};

module.exports = store;
