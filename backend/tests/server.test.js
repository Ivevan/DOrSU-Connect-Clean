import assert from 'node:assert/strict';
import test from 'node:test';

const {
  isConversationResetRequest,
  buildClarificationMessage,
} = await import('../src/services/chat-guardrails.js');

test('isConversationResetRequest detects explicit commands', () => {
  assert.equal(isConversationResetRequest('clear chat'), true);
  assert.equal(isConversationResetRequest('Reset Conversation'), true);
  assert.equal(isConversationResetRequest('please reset the chat history'), true);
});

test('isConversationResetRequest ignores normal prompts', () => {
  assert.equal(isConversationResetRequest('final exam schedule'), false);
  assert.equal(isConversationResetRequest('tell me about programs'), false);
});

test('buildClarificationMessage includes helpful hints', () => {
  const message = buildClarificationMessage({
    vagueReason: 'the query is too short',
    detectedTopics: [],
    originalQuery: 'final exam schedule',
  });

  assert.match(message, /too short/i);
  assert.match(message, /date or timeframe/i);
  assert.match(message, /clarify/i);
});

