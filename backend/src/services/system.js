export function buildSystemInstructions(conversationContext = null, intentClassification = null) {
    const year = new Date().getFullYear();
    
    // CONDENSED SYSTEM PROMPT - Minimize input tokens
    const baseInstructions = [
      'DOrSU Assistant - intelligent, friendly AI for Davao Oriental State University.',
      '',
      '🎯 BE CONCISE: Exact answers, direct language, no verbosity. Every token counts.',
      '💬 Core: Warm, professional. Use knowledge base ONLY - never hallucinate.',
      '',
    ];
    
    // Add intent-specific guidance if available (condensed)
    if (intentClassification && intentClassification.conversationalIntent) {
      const intentIcon = getIntentIcon(intentClassification.conversationalIntent);
      baseInstructions.push(
        `${intentIcon} Intent: ${intentClassification.conversationalIntent.toUpperCase()} | ${intentClassification.responseHint}`,
        ''
      );
    }
    
    baseInstructions.push(
      '🌍 Multilingual: Match user language/tone.',
      '📋 Format: URLs with "Link:" prefix. Lists: numbered, blank lines between items.',
      ''
    );
    
    // Dynamic conversation context (condensed)
    if (conversationContext && conversationContext.recentEntities) {
      const entities = conversationContext.recentEntities;
      const contextParts = [];
      
      if (entities.people && entities.people.length > 0) {
        contextParts.push(`People: ${entities.people[0]}`);
      }
      if (entities.topics && entities.topics.length > 0) {
        contextParts.push(`Topics: ${entities.topics.slice(0, 2).join(', ')}`);
      }
      
      if (contextParts.length > 0) {
        baseInstructions.push(`📌 Context: ${contextParts.join(' | ')}`, '');
      }
    }
    
    // Condensed critical rules
    const criticalRules = [
      '🚨 CRITICAL: Use ONLY knowledge base chunks - NEVER training data. If not in chunks → "I don\'t have that information yet."',
      'Position holders: Include "as of 2025". Programs: 38 total (29 undergrad + 9 grad) from knowledge base only.',
      'Vision: "A university of excellence, innovation and inclusion." URLs: Copy exactly from knowledge base.',
      ''
    ];
    
    return [...baseInstructions, ...criticalRules].join('\n');
  }
  
  /**
   * Get calendar events formatting instructions
   * Returns instructions for how to format and present calendar events in responses
   * IMPROVED: Emphasizes using exact dates from knowledge base for consistency
   */
  export function getCalendarEventsInstructions() {
    return '\n\n📅 CALENDAR EVENTS INSTRUCTIONS (CRITICAL FOR CONSISTENCY):\n' +
      '• Use ONLY the exact dates and information from the calendar events data provided above\n' +
      '• DO NOT modify, estimate, or approximate dates - use them EXACTLY as shown in the knowledge base\n' +
      '• DO NOT use your training data or general knowledge about dates - ONLY use dates from the calendar events section above\n' +
      '• When mentioning events, format dates concisely (e.g., "Jan 11 - Jan 15, 2025" instead of listing each date separately)\n' +
      '• For date range events, show the range format: "Jan 11 - Jan 15, 2025" - use the EXACT dates from the data\n' +
      '• Do NOT list the same event multiple times - group similar events together\n' +
      '• If multiple events share the same title, show them as a single entry with date ranges\n' +
      '• When mentioning events, include the exact date range, time (if available), and category from the knowledge base\n' +
      '• If the user asks about upcoming events, prioritize events with future dates from the calendar data\n' +
      '• If asking about a specific date or month, filter events accordingly from the provided calendar data\n' +
      '• Always format dates clearly and concisely (e.g., "Jan 11 - Jan 15, 2025") using the EXACT format from the data\n' +
      '• If dates are shown in the calendar events section, copy them EXACTLY - do not paraphrase or reformat\n' +
      '• Consistency is critical: If you see "Jan 11 - Jan 15, 2025" in the data, use that EXACT format every time\n' +
      '• If no events match the query, inform the user that no events were found for that criteria\n\n';
  }
  
  /**
   * Get emoji icon for conversational intent
   */
  function getIntentIcon(intentType) {
    const icons = {
      greeting: '👋',
      farewell: '👋',
      gratitude: '🙏',
      emotion_expression: '💭',
      task_request: '✅',
      information_query: '❓',
      clarification_request: '🤔',
      follow_up: '🔄',
      small_talk: '💬'
    };
    return icons[intentType] || '💬';
  }
  