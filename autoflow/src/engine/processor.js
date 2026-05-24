const { matchTriggers } = require('./triggerMatcher');
const { runFlow, resolveTemplate } = require('./flowRunner');
const wa = require('../services/whatsapp');
const ig = require('../services/instagram');
const store = require('../store');
const logger = require('../logger');

/**
 * Process a normalized WhatsApp message event.
 */
async function processWAMessage(msg) {
  // Respect opt-outs
  if (store.optouts.has(msg.from)) {
    logger.info('Skipping opted-out user', { from: msg.from });
    return;
  }

  store.addLog({ level: 'info', channel: 'whatsapp', event: 'message_received',
    msg: `From ${msg.from}: "${(msg.text || '[non-text]').substring(0, 60)}"` });

  // Auto mark-read
  if (msg.id) {
    try { await wa.markRead(msg.id); } catch (_) {}
  }

  const matched = matchTriggers('whatsapp', 'message_received', { text: msg.text, from: msg.from });

  if (matched.length === 0) {
    logger.info('No trigger matched', { from: msg.from, text: msg.text });
    return;
  }

  for (const trigger of matched) {
    // Direct reply first
    if (trigger.replyTemplate) {
      const body = resolveTemplate(trigger.replyTemplate, { from: msg.from, name: msg.name });
      try {
        await wa.sendText(msg.from, body);
        store.addLog({ level: 'info', channel: 'whatsapp', event: 'auto_reply',
          msg: `Reply sent → ${msg.from} via trigger "${trigger.name}"` });
      } catch (err) {
        store.addLog({ level: 'error', channel: 'whatsapp', event: 'send_error', msg: err.message });
      }
    }

    // Run linked flow
    if (trigger.flowId) {
      await runFlow(trigger.flowId, { from: msg.from, name: msg.name, text: msg.text, id: msg.id });
    }
  }
}

/**
 * Process a WA button/list reply.
 */
async function processWAInteractive(msg) {
  const reply = msg.buttonReply || msg.listReply;
  if (!reply) return;

  store.addLog({ level: 'info', channel: 'whatsapp', event: 'button_reply',
    msg: `${msg.from} clicked: "${reply.title}" (${reply.id})` });

  const matched = matchTriggers('whatsapp', 'button_reply', { buttonId: reply.id, text: reply.title, from: msg.from });
  for (const t of matched) {
    if (t.flowId) await runFlow(t.flowId, { from: msg.from, buttonId: reply.id });
  }
}

/**
 * Process an Instagram event (DM, comment, mention, etc.)
 */
async function processIGEvent(event) {
  store.addLog({ level: 'info', channel: 'instagram', event: event.event,
    msg: `IG event: ${event.event} from ${event.senderId || event.from?.id || 'unknown'}` });

  const matched = matchTriggers('instagram', event.event, {
    text: event.text || '',
    senderId: event.senderId,
    from: event.from,
    commentId: event.commentId,
    mediaId: event.mediaId,
  });

  for (const trigger of matched) {
    const ctx = { senderId: event.senderId || event.from?.id, commentId: event.commentId, mediaId: event.mediaId, text: event.text };

    if (trigger.replyTemplate) {
      const text = resolveTemplate(trigger.replyTemplate, ctx);
      try {
        if (event.event === 'messages' && ctx.senderId) {
          await ig.sendDM(ctx.senderId, text);
          store.addLog({ level: 'info', channel: 'instagram', event: 'dm_sent', msg: `DM → ${ctx.senderId}` });
        } else if (event.event === 'comments' && ctx.commentId) {
          await ig.replyToComment(ctx.commentId, text);
          store.addLog({ level: 'info', channel: 'instagram', event: 'comment_reply', msg: `Reply to comment ${ctx.commentId}` });
        }
      } catch (err) {
        store.addLog({ level: 'error', channel: 'instagram', event: 'ig_send_error', msg: err.message });
      }
    }

    if (trigger.flowId) {
      await runFlow(trigger.flowId, ctx);
    }
  }
}

module.exports = { processWAMessage, processWAInteractive, processIGEvent };
