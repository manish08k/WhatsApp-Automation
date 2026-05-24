const store = require('../store');
const logger = require('../logger');

/**
 * Match a normalized event against all active triggers.
 * Returns array of matched triggers.
 */
function matchTriggers(channel, event, payload) {
  const matched = [];

  for (const trigger of store.triggers) {
    if (!trigger.active) continue;
    if (trigger.channel !== channel) continue;
    if (trigger.event !== event) continue;

    if (evaluateCondition(trigger.condition, payload)) {
      trigger.firedCount++;
      matched.push(trigger);
      logger.info('Trigger matched', { id: trigger.id, name: trigger.name, from: payload.from || payload.senderId });
    }
  }

  return matched;
}

/**
 * Evaluate a single condition against a payload.
 */
function evaluateCondition(condition, payload) {
  if (!condition || condition.type === 'any') return true;

  if (condition.type === 'keyword') {
    const text = (payload.text || '').toLowerCase().trim();
    const val  = (condition.value || '').toLowerCase().trim();

    switch (condition.match) {
      case 'exact':       return text === val;
      case 'contains':    return text.includes(val);
      case 'starts_with': return text.startsWith(val);
      case 'ends_with':   return text.endsWith(val);
      case 'regex': {
        try { return new RegExp(val, 'i').test(text); }
        catch { return false; }
      }
      default: return false;
    }
  }

  if (condition.type === 'event_data') {
    // condition: { type:'event_data', field:'reaction.reaction', value:'love' }
    const got = getNestedValue(payload, condition.field);
    return String(got).toLowerCase() === String(condition.value).toLowerCase();
  }

  return false;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

module.exports = { matchTriggers, evaluateCondition };
