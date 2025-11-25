const conversationResetPattern = /^(?:please\s+)?(?:clear|reset|restart|start|new|fresh|forget|remove)(?:\s+(?:the|my|this))?\s+(?:chat|conversation|context|topic|thread|history)(?:\s+please|\s*)$/i;
const simpleResetCommands = new Set([
  'clear',
  'reset',
  'restart',
  'new chat',
  'new conversation',
  'start over',
  'start fresh',
  'forget everything',
]);

export function isConversationResetRequest(prompt = '') {
  const normalized = prompt.trim().toLowerCase();
  if (!normalized) return false;
  if (simpleResetCommands.has(normalized)) return true;
  return conversationResetPattern.test(normalized);
}

export function buildClarificationMessage(queryAnalysis = {}) {
  const reason = queryAnalysis.vagueReason
    ? `I noticed ${queryAnalysis.vagueReason}.`
    : 'I just want to be sure I understand the exact details you need.';
  const hints = [];
  if (!queryAnalysis.detectedTopics || queryAnalysis.detectedTopics.length === 0) {
    hints.push('mention the office, program, or event you are referring to');
  }
  const originalQuery = (queryAnalysis.originalQuery || '').toLowerCase();
  if (originalQuery && /schedule|exam|deadline|date/.test(originalQuery) && !/\b(when|date|time)\b/.test(originalQuery)) {
    hints.push('include the date or timeframe you care about');
  }
  if (!/\b(what|which|who|how|when|where)\b/.test(originalQuery)) {
    hints.push('add the specific information you need (e.g., requirements, head, location)');
  }
  const hintText = hints.length > 0 ? ` Please ${hints.join(' or ')}.` : '';
  return `${reason}${hintText} Could you clarify or add more context?`;
}

