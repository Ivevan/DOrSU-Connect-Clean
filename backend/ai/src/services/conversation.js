/**
 * Conversation Memory Service
 * Handles conversation context for follow-up questions and pronoun resolution
 */

import NodeCache from 'node-cache';
import { Logger } from '../utils/logger.js';

export class ConversationService {
  constructor() {
    // Store conversations with 10-minute TTL
    this.conversations = new NodeCache({
      stdTTL: 600, // 10 minutes
      checkperiod: 60, // Check for expired keys every minute
      maxKeys: 1000 // Store up to 1000 conversations
    });
    
    Logger.success('💬 Conversation Memory Service initialized');
  }
  
  /**
   * Generate session ID from request (IP + User-Agent)
   */
  getSessionId(req) {
    const ip = req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return `${ip}_${userAgent}`.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
  }
  
  /**
   * Store conversation turn (query + response + context)
   */
  storeConversation(sessionId, query, response, context = {}) {
    try {
      // Get existing conversation history
      let history = this.conversations.get(sessionId) || [];
      
      // Extract entities from the conversation
      const entities = this.extractEntities(query, response, context);
      
      // Add new turn to history
      const turn = {
        timestamp: Date.now(),
        query,
        response,
        context,
        entities, // Store extracted entities for pronoun resolution
        queryLower: query.toLowerCase()
      };
      
      history.push(turn);
      
      // Keep only last 5 turns to prevent memory bloat and token overflow
      if (history.length > 5) {
        history = history.slice(-5);
      }
      
      this.conversations.set(sessionId, history);
      
      Logger.info(`💬 Stored conversation turn for session: ${sessionId.substring(0, 20)}...`);
      
      return true;
    } catch (error) {
      Logger.error(`Failed to store conversation: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Extract entities (people, topics) from conversation
   */
  extractEntities(query, response, context) {
    const entities = {
      people: [],
      topics: [],
      programs: [],
      faculties: [],
      campuses: []
    };
    
    // Extract people mentioned (president, deans, etc.)
    const peoplePatterns = [
      /Dr\.\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/gi, // Dr. Roy G. Ponce
      /President\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/gi,
      /Dean\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/gi
    ];
    
    peoplePatterns.forEach(pattern => {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        entities.people.push(match[1]);
      }
    });
    
    // Extract faculties (FACET, FTED, etc.)
    const facultyPattern = /\b(FACET|FTED|FALS|FHUSOCOM|Faculty of [A-Z][a-z,\s]+)\b/gi;
    const facultyMatches = response.matchAll(facultyPattern);
    for (const match of facultyMatches) {
      entities.faculties.push(match[1]);
    }
    
    // Extract programs (BSIT, BSED, etc.)
    const programPattern = /\b(B[A-Z]{2,4}|Bachelor of [A-Z][a-z,\s]+)\b/gi;
    const programMatches = response.matchAll(programPattern);
    for (const match of programMatches) {
      entities.programs.push(match[1]);
    }
    
    // Extract campuses
    const campusPattern = /\b(Main Campus|Banaybanay|Cateel|Baganga|Tarragona|San Isidro) Campus\b/gi;
    const campusMatches = response.matchAll(campusPattern);
    for (const match of campusMatches) {
      entities.campuses.push(match[1]);
    }
    
    // Extract topics from context
    if (context.detectedTopics) {
      entities.topics = context.detectedTopics.map(t => t.category);
    }
    
    return entities;
  }
  
  /**
   * Get conversation context for follow-up questions
   */
  getContext(sessionId) {
    try {
      const history = this.conversations.get(sessionId) || [];
      
      if (history.length === 0) {
        return null;
      }
      
      // Return recent conversation history
      return {
        history,
        lastTurn: history[history.length - 1],
        recentEntities: this.getMostRecentEntities(history)
      };
    } catch (error) {
      Logger.error(`Failed to get conversation context: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get most recent entities mentioned (for pronoun resolution)
   */
  getMostRecentEntities(history) {
    const allEntities = {
      people: [],
      topics: [],
      programs: [],
      faculties: [],
      campuses: []
    };
    
    // Collect entities from recent turns (most recent first)
    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      if (turn.entities) {
        Object.keys(allEntities).forEach(key => {
          if (turn.entities[key]) {
            allEntities[key] = [...allEntities[key], ...turn.entities[key]];
          }
        });
      }
    }
    
    // Deduplicate and return most recent
    Object.keys(allEntities).forEach(key => {
      allEntities[key] = [...new Set(allEntities[key])];
    });
    
    return allEntities;
  }
  
  /**
   * Resolve pronouns in query using conversation context
   */
  resolvePronouns(query, context) {
    if (!context || !context.recentEntities) {
      return query;
    }
    
    let resolvedQuery = query;
    const entities = context.recentEntities;
    
    // Pronoun patterns
    const pronounPatterns = [
      // English pronouns
      { pattern: /\b(his|her|their|its)\s+(achievements?|programs?|courses?|background|details?|info)\b/gi, type: 'possessive' },
      { pattern: /\b(he|she|they|it)\b/gi, type: 'subject' },
      { pattern: /\b(him|her|them)\b/gi, type: 'object' },
      
      // Tagalog pronouns
      { pattern: /\b(niya|kanyang)\s+(mga\s+)?(tagumpay|programa|kurso|background)\b/gi, type: 'possessive' },
      { pattern: /\bsiya\b/gi, type: 'subject' },
      
      // Bisaya pronouns
      { pattern: /\b(iya|iyang)\s+(mga\s+)?(kalampusan|programa|kurso)\b/gi, type: 'possessive' }
    ];
    
    // Try to resolve with most recent person
    if (entities.people.length > 0) {
      const mostRecentPerson = entities.people[0];
      
      pronounPatterns.forEach(({ pattern, type }) => {
        if (pattern.test(resolvedQuery)) {
          if (type === 'possessive') {
            // "his achievements" → "Dr. Roy G. Ponce's achievements"
            resolvedQuery = resolvedQuery.replace(pattern, (match, pronoun, item) => {
              return `${mostRecentPerson}'s ${item || ''}`.trim();
            });
          } else if (type === 'subject' || type === 'object') {
            // "he" → "Dr. Roy G. Ponce"
            resolvedQuery = resolvedQuery.replace(pattern, mostRecentPerson);
          }
        }
      });
    }
    
    return resolvedQuery;
  }
  
  /**
   * Clear conversation for a session
   */
  clearConversation(sessionId) {
    this.conversations.del(sessionId);
    Logger.info(`🗑️ Cleared conversation for session: ${sessionId.substring(0, 20)}...`);
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      activeConversations: this.conversations.keys().length,
      totalTurns: this.conversations.keys().reduce((acc, key) => {
        const history = this.conversations.get(key) || [];
        return acc + history.length;
      }, 0)
    };
  }
}

// Export singleton instance
export default new ConversationService();

