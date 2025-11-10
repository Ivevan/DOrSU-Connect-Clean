/**
 * Query Analyzer - Maximizes Data Retrieval
 * Analyzes queries to retrieve as many relevant chunks as possible
 * Optimized for Groq's lightning-fast inference
 */

import { IntentClassifier } from './intent-classifier.js';

export class QueryAnalyzer {
  
  /**
   * Analyze query to determine optimal data retrieval strategy
   * @param {string} query - User's question
   * @returns {Object} - { complexity: string, confidence: number, settings: {}, intentClassification: {} }
   */
  static analyzeComplexity(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    // STEP 1: Classify intent (DOrSU vs General Knowledge)
    const intentClassification = IntentClassifier.classifyIntent(query);
    
    // Topic categories that need extensive data (MULTILINGUAL)
    const topicCategories = {
      // Core university information
      // Tagalog: mga halaga, misyon, bisyon, mandato
      // Bisaya: mga mithi, misyon, panan-awon
      identity: ['core values', 'mission', 'vision', 'mandate', 'objectives', 'hymn', 'motto', 'halaga', 'misyon', 'bisyon', 'mandato', 'mithi', 'panan-awon'],
      
      // Leadership & organizational
      // Tagalog: presidente, bise presidente, dekano
      // Bisaya: presidente, dire, dekano
      leadership: ['president', 'vice president', 'chancellor', 'dean', 'director', 'administration', 'leadership', 'board', 'governance', 'presidente', 'bise presidente', 'dekano', 'direktor', 'dire'],
      
      // Academic programs
      // Tagalog: programa, kurso, fakultad, departamento
      // Bisaya: programa, kurso, fakultad
      academic: ['programs', 'courses', 'faculties', 'departments', 'college', 'baccalaureate', 'degree', 'curriculum', 'programa', 'kurso', 'fakultad', 'departamento', 'kolehiyo'],
      
      // Campus & facilities
      // Tagalog: kampus, pasilidad, gusali
      // Bisaya: kampus, pasilidad
      campus: ['campus', 'campuses', 'location', 'facilities', 'building', 'extension', 'main campus', 'kampus', 'pasilidad', 'gusali', 'lokasyon'],
      
      // Enrollment & requirements
      // Tagalog: enrollment, pag-enrol, kinakailangan
      // Bisaya: pagpalista, kinahanglan
      enrollment: ['enrollment', 'admission', 'requirements', 'steps', 'process', 'how to enroll', 'register', 'pag-enrol', 'kinakailangan', 'hakbang', 'proseso', 'pagpalista', 'kinahanglan'],
      
      // Quality & outcomes
      quality: ['quality commitments', 'graduate outcomes', 'accreditation', 'standards', 'kalidad', 'akreditasyon'],
      
      // Historical & factual
      // Tagalog: kasaysayan, itinatag, pinagmulan
      // Bisaya: kasaysayan, gitukod
      historical: ['history', 'founded', 'established', 'evolution', 'development', 'background', 'kasaysayan', 'itinatag', 'pinagmulan', 'gitukod']
    };
    
    // Query intent patterns (MULTILINGUAL: English, Tagalog, Bisaya)
    const intentPatterns = {
      // Listing requests (need ALL data)
      // English: list, all, every, show all
      // Tagalog: lahat, ilista, itala, ipakita
      // Bisaya: tanan, lista, ipakita
      listing: /\b(list|all|every|show\s+all|give\s+me\s+all|enumerate|name\s+all|tell\s+me\s+the|what\s+are\s+the|the\s+(programs|faculties|courses|campuses|deans|values|missions|requirements)|lahat|ilista|itala|ipakita\s+lahat|tanan|lista|ipakita\s+tanan)\b/i,
      
      // How many / counting (need comprehensive data)
      // Tagalog: ilan, bilang
      // Bisaya: pila, ihap
      counting: /\b(how\s+many|count|number\s+of|total|ilan|bilang|pila|ihap)\b/i,
      
      // What are / plural (multiple items expected)
      // Tagalog: ano ang, sino ang, maaari mo bang
      // Bisaya: unsa ang, kinsa ang, mahimo ba nimo
      multiple: /\b(what\s+are|who\s+are|can\s+you\s+(tell|list|show)|ano\s+ang|sino\s+ang|maaari\s+mo\s+bang|unsa\s+ang|kinsa\s+ang|mahimo\s+ba\s+nimo)\b/i,
      
      // Comprehensive explanations
      // Tagalog: ipaliwanag, sabihin, ano, sino
      // Bisaya: ipasabot, sultihi, unsa, kinsa
      comprehensive: /\b(explain|describe|tell\s+me\s+about|what\s+is|who\s+is|ipaliwanag|sabihin|ano\s+(ba\s+)?ang|sino\s+(ba\s+)?ang|ipasabot|sultihi|unsa\s+ang|kinsa\s+ang)\b/i,
      
      // Follow-up questions (pronouns indicating context continuation)
      // English: he, she, his, her, their, it, that, this
      // Tagalog: siya, niya, kanyang, ito, iyan
      // Bisaya: siya, iya, kana, kini
      followUp: /\b(he|she|his|her|their|it|that|this|them|those|siya|niya|kanyang|kanila|ito|iyan|iya|kana|kini)\b/i,
      
      // Multi-part questions
      multiPart: /\?\s*.*\?/  // Multiple question marks
    };
    
    let detectedTopics = [];
    let detectedIntents = [];
    let ragMultiplier = 1.0;
    
    // Detect topics
    Object.entries(topicCategories).forEach(([category, keywords]) => {
      const matchedKeywords = keywords.filter(kw => lowerQuery.includes(kw));
      if (matchedKeywords.length > 0) {
        detectedTopics.push({ category, keywords: matchedKeywords });
        // Each topic match increases data retrieval
        ragMultiplier += 0.5;
      }
    });
    
    // Detect intents
    let isFollowUpQuery = false;
    Object.entries(intentPatterns).forEach(([intent, pattern]) => {
      if (pattern.test(lowerQuery)) {
        detectedIntents.push(intent);
        
        // Track follow-up queries
        if (intent === 'followUp') {
          isFollowUpQuery = true;
        }
        
        // Listing and counting need maximum data
        if (intent === 'listing' || intent === 'counting') {
          ragMultiplier += 1.5;
        } else if (intent === 'multiple' || intent === 'multiPart') {
          ragMultiplier += 1.0;
        } else if (intent === 'followUp') {
          // Follow-up queries need context from previous conversation
          ragMultiplier += 0.5;
        } else {
          ragMultiplier += 0.3;
        }
      }
    });
    
    // Check for plural nouns (indicates multiple items needed)
    const pluralKeywords = [
      'programs', 'courses', 'deans', 'faculties', 'departments',
      'campuses', 'values', 'outcomes', 'members', 'leaders',
      'requirements', 'steps', 'processes', 'policies', 'missions',
      'objectives', 'commitments', 'buildings', 'facilities', 'colleges'
    ];
    
    const foundPlurals = pluralKeywords.filter(kw => lowerQuery.includes(kw));
    if (foundPlurals.length > 0) {
      // STRONG multiplier for plurals - they indicate comprehensive queries
      ragMultiplier += foundPlurals.length * 1.5;  // Increased from 0.5 to 1.5
      // If plural is the main subject (near start of query), boost even more
      if (foundPlurals.some(plural => lowerQuery.indexOf(plural) < 20)) {
        ragMultiplier += 1.0;  // Extra boost for early plurals
      }
    }
    
    // Determine final complexity (for logging purposes)
    let complexityLevel = 'standard';
    if (ragMultiplier >= 3.0) {
      complexityLevel = 'maximum-retrieval';
    } else if (ragMultiplier >= 2.0) {
      complexityLevel = 'high-retrieval';
    } else if (ragMultiplier >= 1.5) {
      complexityLevel = 'moderate-retrieval';
    }
    
    // Build analysis result
    const analysis = {
      complexity: complexityLevel,
      confidence: Math.min(100, Math.round(ragMultiplier * 25)),
      detectedTopics,
      detectedIntents,
      foundPlurals,
      ragMultiplier: Math.min(6.0, ragMultiplier), // Increased cap to 6x for comprehensive queries
      settings: this.getOptimalSettings(ragMultiplier, query),
      isMultiPart: detectedIntents.includes('multiPart'),
      isFollowUp: isFollowUpQuery,  // Flag for conversation context
      intentClassification  // Add intent classification result
    };
    
    return analysis;
  }
  
  /**
   * Get optimal settings based on RAG multiplier
   * Groq is FAST - maximize data retrieval for better answers!
   */
  static getOptimalSettings(ragMultiplier, query) {
    // Base settings - OPTIMIZED to prevent token limit errors
    const baseSettings = {
      maxTokens: 800,          // Reduced from 900 to save tokens
      numCtx: 4096,
      ragSections: 15,         // Reduced from 20 to limit context size
      ragMaxTokens: 2000,      // Reduced from 2500 to prevent rate limits
      temperature: 0.3
    };
    
    // Calculate scaled settings based on multiplier
    // Balance comprehensiveness with token limits (8K for most Groq models)
    const scaledSettings = {
      maxTokens: Math.min(1500, Math.round(baseSettings.maxTokens * ragMultiplier)),  // Cap at 1500 (reduced from 2000)
      numCtx: Math.min(16384, Math.round(baseSettings.numCtx * Math.sqrt(ragMultiplier))),
      ragSections: Math.min(40, Math.round(baseSettings.ragSections * ragMultiplier)),  // Cap at 40 (reduced from 50)
      ragMaxTokens: Math.min(4000, Math.round(baseSettings.ragMaxTokens * ragMultiplier)),  // Cap at 4000 (reduced from 5000)
      temperature: 0.3  // Keep consistent for quality
    };
    
    // Determine description
    let description = 'Standard retrieval';
    if (ragMultiplier >= 3.0) {
      description = 'Maximum data retrieval (comprehensive answer)';
    } else if (ragMultiplier >= 2.0) {
      description = 'High data retrieval (detailed answer)';
    } else if (ragMultiplier >= 1.5) {
      description = 'Moderate data retrieval (enhanced answer)';
    }
    
    return {
      ...scaledSettings,
      description,
      ragMultiplier: ragMultiplier.toFixed(2),
      suggestMore: false  // With Groq, we can provide everything upfront
    };
  }
  
  /**
   * Format analysis for logging
   */
  static formatAnalysis(analysis) {
    let icon = '📊';  // Standard
    if (analysis.complexity === 'maximum-retrieval') icon = '🎯';
    if (analysis.complexity === 'high-retrieval') icon = '📈';
    if (analysis.complexity === 'moderate-retrieval') icon = '📊';
    
    const topicsText = analysis.detectedTopics.length > 0 
      ? `Topics: ${analysis.detectedTopics.map(t => t.category).join(', ')}` 
      : 'No specific topics';
    
    const intentsText = analysis.detectedIntents.length > 0
      ? `Intents: ${analysis.detectedIntents.join(', ')}`
      : 'Basic query';
    
    return `${icon} ${analysis.complexity.toUpperCase()} (${analysis.ragMultiplier}x RAG) - ` +
           `${analysis.settings.ragSections} sections, ${analysis.settings.ragMaxTokens} tokens - ` +
           `${topicsText} | ${intentsText}`;
  }
}

// Export default
export default QueryAnalyzer;

