const store = require('../store');
const wa = require('../services/whatsapp');
const ig = require('../services/instagram');
const logger = require('../logger');

/**
 * Run a flow given a context (who triggered it, on which channel, with what data).
 */
async function runFlow(flowId, context) {
  const flow = store.getFlow(flowId);
  if (!flow || !flow.active) return;

  logger.info('Running flow', { flowId, name: flow.name, channel: flow.channel });
  store.addLog({ level: 'info', channel: flow.channel, event: 'flow_start', msg: `Flow "${flow.name}" started`, context });

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    try {
      await executeStep(step, flow.channel, context);
    } catch (err) {
      logger.error('Step failed', { flowId, step: i, type: step.type, err: err.message });
      store.addLog({ level: 'error', channel: flow.channel, event: 'step_error', msg: `Step ${i} failed: ${err.message}` });
      break; // stop flow on error (configurable)
    }
  }

  store.addLog({ level: 'info', channel: flow.channel, event: 'flow_done', msg: `Flow "${flow.name}" completed` });
}

/**
 * Execute a single flow step.
 */
async function executeStep(step, channel, ctx) {
  switch (step.type) {

    case 'action':
      await executeAction(step, channel, ctx);
      break;

    case 'wait':
      await sleep(step.delay * 1000);
      break;

    case 'condition': {
      const { evaluateCondition } = require('./triggerMatcher');
      const pass = evaluateCondition(step.condition, ctx);
      if (!pass) throw new Error(`Condition failed: ${JSON.stringify(step.condition)}`);
      break;
    }

    case 'set_variable':
      ctx.vars = ctx.vars || {};
      ctx.vars[step.key] = step.value;
      break;

    default:
      logger.warn('Unknown step type', { type: step.type });
  }
}

async function executeAction(step, channel, ctx) {
  const to = ctx.from || ctx.senderId;

  if (channel === 'whatsapp') {
    switch (step.action) {

      case 'send_message': {
        const body = step.text || resolveTemplate(step.template, ctx);
        await wa.sendText(to, body);
        logger.info('WA sent text', { to, preview: body.substring(0, 40) });
        break;
      }

      case 'send_template': {
        await wa.sendTemplate(to, step.templateName, step.lang || 'en_US', step.components || []);
        logger.info('WA sent template', { to, templateName: step.templateName });
        break;
      }

      case 'send_buttons': {
        await wa.sendButtons(to, step.body, step.buttons);
        logger.info('WA sent buttons', { to });
        break;
      }

      case 'send_image': {
        await wa.sendImage(to, step.imageUrl, step.caption || '');
        break;
      }

      case 'mark_read': {
        if (ctx.id) await wa.markRead(ctx.id);
        break;
      }

      case 'optout': {
        store.optouts.add(to);
        const body = resolveTemplate('optout_msg', ctx);
        await wa.sendText(to, body);
        logger.info('WA optout', { to });
        break;
      }

      default:
        logger.warn('Unknown WA action', { action: step.action });
    }

  } else if (channel === 'instagram') {
    switch (step.action) {

      case 'send_dm': {
        const text = step.text || resolveTemplate(step.template, ctx);
        await ig.sendDM(to, text);
        logger.info('IG DM sent', { to });
        break;
      }

      case 'reply_comment': {
        if (!ctx.commentId) { logger.warn('reply_comment: no commentId in ctx'); break; }
        const text = step.text || resolveTemplate(step.template, ctx);
        await ig.replyToComment(ctx.commentId, text);
        logger.info('IG comment replied', { commentId: ctx.commentId });
        break;
      }

      case 'hide_comment': {
        if (ctx.commentId) await ig.hideComment(ctx.commentId);
        break;
      }

      default:
        logger.warn('Unknown IG action', { action: step.action });
    }
  }
}

// ── Template resolver (replaces {{name}}, {{1}}, etc.) ──────────────────────
function resolveTemplate(nameOrText, ctx) {
  let text = store.getTemplate(nameOrText) || nameOrText || '';
  // replace {{name}} with ctx.name if available
  text = text.replace(/\{\{name\}\}/gi, ctx.name || 'there');
  text = text.replace(/\{\{from\}\}/gi, ctx.from || ctx.senderId || '');
  // replace numbered vars {{1}}, {{2}} with ctx.vars[1], etc.
  if (ctx.vars) {
    Object.entries(ctx.vars).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    });
  }
  return text;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { runFlow, resolveTemplate };
