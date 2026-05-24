const axios = require('axios');
const logger = require('../logger');

const BASE = 'https://graph.facebook.com/v19.0';
const IG_ID = () => process.env.IG_USER_ID;
const TOKEN = () => process.env.IG_ACCESS_TOKEN;

const api = axios.create({ baseURL: BASE, timeout: 10000 });
api.interceptors.request.use(cfg => {
  cfg.headers['Authorization'] = `Bearer ${TOKEN()}`;
  return cfg;
});
api.interceptors.response.use(
  r => r.data,
  err => {
    logger.error('IG API error', { status: err.response?.status, data: err.response?.data });
    throw new Error(err.response?.data?.error?.message || err.message);
  }
);

// ── Send DM to a user ────────────────────────────────────────────────────────
async function sendDM(recipientIgId, text) {
  return api.post(`/${IG_ID()}/messages`, {
    recipient: { id: recipientIgId },
    message: { text },
  });
}

// ── Reply to a comment ───────────────────────────────────────────────────────
async function replyToComment(commentId, text) {
  return api.post(`/${commentId}/replies`, {
    message: text,
    access_token: TOKEN(),
  });
}

// ── Hide a comment ───────────────────────────────────────────────────────────
async function hideComment(commentId, hide = true) {
  return api.post(`/${commentId}`, { is_hidden: hide, access_token: TOKEN() });
}

// ── Delete a comment ─────────────────────────────────────────────────────────
async function deleteComment(commentId) {
  return api.delete(`/${commentId}?access_token=${TOKEN()}`);
}

// ── Get media (posts) ────────────────────────────────────────────────────────
async function getMedia(limit = 10) {
  return api.get(`/${IG_ID()}/media`, {
    params: { fields: 'id,caption,media_type,timestamp,like_count,comments_count', limit, access_token: TOKEN() },
  });
}

// ── Get comments on a media ───────────────────────────────────────────────────
async function getComments(mediaId) {
  return api.get(`/${mediaId}/comments`, {
    params: { fields: 'id,text,username,timestamp', access_token: TOKEN() },
  });
}

// ── Get profile of a user (by IG-scoped ID) ───────────────────────────────────
async function getUserProfile(userId) {
  return api.get(`/${userId}`, {
    params: { fields: 'id,username,name', access_token: TOKEN() },
  });
}

// ── Get story mentions ────────────────────────────────────────────────────────
async function getMentions() {
  return api.get(`/${IG_ID()}`, {
    params: { fields: 'mentioned_media', access_token: TOKEN() },
  });
}

// ── Parse incoming IG webhook ─────────────────────────────────────────────────
function parseWebhook(body) {
  try {
    const results = [];
    const entries = body.entry || [];

    for (const entry of entries) {
      // Direct Messages (Messaging)
      for (const msg of entry.messaging || []) {
        if (msg.message) {
          results.push({
            event: 'messages',
            senderId: msg.sender?.id,
            recipientId: msg.recipient?.id,
            timestamp: msg.timestamp,
            text: msg.message.text || null,
            attachments: msg.message.attachments || [],
            messageId: msg.message.mid,
          });
        }
        if (msg.read) {
          results.push({ event: 'messaging_seen', senderId: msg.sender?.id, timestamp: msg.timestamp });
        }
        if (msg.reaction) {
          results.push({ event: 'messaging_reactions', senderId: msg.sender?.id, reaction: msg.reaction });
        }
      }

      // Comments & Mentions (Changes)
      for (const change of entry.changes || []) {
        const v = change.value;
        if (change.field === 'comments') {
          results.push({
            event: 'comments',
            commentId: v.id,
            mediaId: v.media?.id,
            from: v.from,
            text: v.text,
            timestamp: v.timestamp,
          });
        }
        if (change.field === 'mentions') {
          results.push({
            event: 'mentions',
            mediaId: v.media_id,
            commentId: v.comment_id,
            from: entry.id,
          });
        }
        if (change.field === 'story_insights') {
          results.push({ event: 'story_insights', data: v });
        }
        if (change.field === 'live_comments') {
          results.push({ event: 'live_comments', commentId: v.id, text: v.text, from: v.from });
        }
      }
    }
    return results;
  } catch (e) {
    logger.error('IG parseWebhook error', { err: e.message });
    return [];
  }
}

module.exports = {
  sendDM,
  replyToComment,
  hideComment,
  deleteComment,
  getMedia,
  getComments,
  getUserProfile,
  getMentions,
  parseWebhook,
};
