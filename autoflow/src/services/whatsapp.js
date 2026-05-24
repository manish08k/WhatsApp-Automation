const axios = require('axios');
const logger = require('../logger');

const BASE = `https://graph.facebook.com/${process.env.WA_API_VERSION || 'v19.0'}`;
const PHONE_ID = () => process.env.WA_PHONE_NUMBER_ID;
const TOKEN = () => process.env.WA_ACCESS_TOKEN;

const api = axios.create({ baseURL: BASE, timeout: 10000 });
api.interceptors.request.use(cfg => {
  cfg.headers['Authorization'] = `Bearer ${TOKEN()}`;
  cfg.headers['Content-Type'] = 'application/json';
  return cfg;
});
api.interceptors.response.use(
  r => r.data,
  err => {
    const data = err.response?.data;
    logger.error('WA API error', { status: err.response?.status, data });
    throw new Error(data?.error?.message || err.message);
  }
);

// ── Send plain text ──────────────────────────────────────────────────────────
async function sendText(to, body) {
  return api.post(`/${PHONE_ID()}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhone(to),
    type: 'text',
    text: { preview_url: false, body },
  });
}

// ── Send approved template ───────────────────────────────────────────────────
async function sendTemplate(to, templateName, langCode = 'en_US', components = []) {
  return api.post(`/${PHONE_ID()}/messages`, {
    messaging_product: 'whatsapp',
    to: normalizePhone(to),
    type: 'template',
    template: { name: templateName, language: { code: langCode }, components },
  });
}

// ── Send image ───────────────────────────────────────────────────────────────
async function sendImage(to, imageUrl, caption = '') {
  return api.post(`/${PHONE_ID()}/messages`, {
    messaging_product: 'whatsapp',
    to: normalizePhone(to),
    type: 'image',
    image: { link: imageUrl, caption },
  });
}

// ── Send interactive buttons ─────────────────────────────────────────────────
async function sendButtons(to, bodyText, buttons) {
  // buttons: [{ id: 'btn_1', title: 'Yes' }, ...]  max 3
  return api.post(`/${PHONE_ID()}/messages`, {
    messaging_product: 'whatsapp',
    to: normalizePhone(to),
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

// ── Send list message ────────────────────────────────────────────────────────
async function sendList(to, bodyText, buttonLabel, sections) {
  return api.post(`/${PHONE_ID()}/messages`, {
    messaging_product: 'whatsapp',
    to: normalizePhone(to),
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: { button: buttonLabel, sections },
    },
  });
}

// ── Mark message as read ─────────────────────────────────────────────────────
async function markRead(messageId) {
  return api.post(`/${PHONE_ID()}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
}

// ── Get media URL from media ID ───────────────────────────────────────────────
async function getMediaUrl(mediaId) {
  const data = await api.get(`/${mediaId}`);
  return data.url;
}

// ── Fetch all approved templates ─────────────────────────────────────────────
async function listTemplates() {
  const bizId = process.env.WA_BUSINESS_ACCOUNT_ID;
  return api.get(`/${bizId}/message_templates?fields=name,status,language,components`);
}

// ── Parse incoming webhook payload ───────────────────────────────────────────
function parseWebhook(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    if (!value) return null;

    const messages = value.messages || [];
    const statuses = value.statuses || [];
    const contacts = value.contacts || [];

    return messages.map(msg => ({
      type: 'message',
      id: msg.id,
      from: msg.from,
      name: contacts.find(c => c.wa_id === msg.from)?.profile?.name || msg.from,
      timestamp: msg.timestamp,
      msgType: msg.type,
      text: msg.text?.body || null,
      buttonReply: msg.interactive?.button_reply || null,
      listReply: msg.interactive?.list_reply || null,
      image: msg.image || null,
      audio: msg.audio || null,
      document: msg.document || null,
    }));
  } catch (e) {
    logger.error('WA parseWebhook error', { err: e.message });
    return [];
  }
}

function normalizePhone(phone) {
  return phone.replace(/[^0-9]/g, '');
}

module.exports = {
  sendText,
  sendTemplate,
  sendImage,
  sendButtons,
  sendList,
  markRead,
  getMediaUrl,
  listTemplates,
  parseWebhook,
};
