/**
 * Query Analyzer - Maximizes Data Retrieval
 * Analyzes queries to retrieve as many relevant chunks as possible
 * Optimized for Groq's lightning-fast inference
 */

import { IntentClassifier } from './intent-classifier.js';

/**
 * Typo Corrector Service
 * Corrects typos in user queries to improve search accuracy
 */
export class TypoCorrector {
  /**
   * Dictionary of common terms from the knowledge base
   * Organized by category for better matching
   */
  static COMMON_TERMS = [
    // Leadership terms
    'president', 'presidents', 'vice president', 'vice presidents', 'chancellor', 'chancellors',
    'dean', 'deans', 'director', 'directors', 'leadership', 'administration', 'board', 'governance',
    'executive', 'executives', 'officer', 'officers',
    
    // Office terms
    'office', 'offices', 'unit', 'units', 'head', 'heads', 'chief', 'manager', 'ospat', 'osa', 
    'oscd', 'fasg', 'peso', 'iro', 'hsu', 'cgad', 'ip-tbm', 'gctc',
    
    // Academic terms
    'program', 'programs', 'programme', 'course', 'courses', 'faculty', 'faculties',
    'department', 'departments', 'college', 'colleges', 'curriculum', 'degree', 'degrees',
    'baccalaureate', 'undergraduate', 'graduate', 'enrollment', 'admission',
    
    // Campus terms
    'campus', 'campuses', 'location', 'locations', 'facility', 'facilities', 'building', 'buildings',
    'extension', 'main campus',
    
    // Calendar/Event terms
    'date', 'dates', 'event', 'events', 'announcement', 'announcements', 'schedule', 'schedules',
    'calendar', 'deadline', 'deadlines', 'holiday', 'holidays', 'semester', 'registration',
    'exam', 'exams', 'examination', 'examinations', 'midterm', 'prelim', 'final',
    
    // Statistics/Exam terms (FIX: Added for better typo correction)
    'statistics', 'stats', 'suast', 'applicants', 'passers', 'passing rate', 'enrolled',
    'entrance exam', 'admission test', 'results', 'data', 'numbers',
    
    // University identity
    'dorsu', 'davao oriental state university', 'mission', 'vision', 'mandate', 'objectives',
    'core values', 'graduate outcomes', 'quality commitments', 'history', 'founded', 'established',
    
    // Common question words (should not be corrected)
    'what', 'who', 'when', 'where', 'why', 'how', 'which', 'tell', 'me', 'about', 'is', 'are',
    'the', 'of', 'and', 'or', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'from',
    
    // Faculty acronyms
    'facet', 'fals', 'fted', 'fbm', 'fcje', 'fnahs', 'fhusocom',
    
    // Other common terms
    'requirement', 'requirements', 'process', 'steps', 'procedure', 'policy', 'policies',
    'news', 'article', 'articles', 'post', 'posts'
  ];

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Edit distance (0 = identical, higher = more different)
   */
  static levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Create matrix
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    
    // Initialize first row and column
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    // Fill matrix
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,      // deletion
          matrix[j - 1][i] + 1,       // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    return matrix[len2][len1];
  }

  /**
   * Find similar words from dictionary
   * @param {string} word - Word to find similar matches for
   * @param {number} maxDistance - Maximum edit distance (default: 2 for typos)
   * @returns {Array} - Array of similar words with their distances
   */
  static findSimilarWords(word, maxDistance = 2) {
    const wordLower = word.toLowerCase();
    const similar = [];
    
    // Don't correct very short words (likely articles/prepositions)
    if (wordLower.length <= 2) {
      return [];
    }
    
    // Check each term in dictionary
    this.COMMON_TERMS.forEach(term => {
      const termLower = term.toLowerCase();
      
      // Skip if words are too different in length
      if (Math.abs(wordLower.length - termLower.length) > maxDistance) {
        return;
      }
      
      // Calculate distance
      const distance = this.levenshteinDistance(wordLower, termLower);
      
      if (distance <= maxDistance && distance > 0) {
        // Calculate similarity percentage
        const maxLen = Math.max(wordLower.length, termLower.length);
        const similarity = 1 - (distance / maxLen);
        
        similar.push({
          word: term,
          distance: distance,
          similarity: similarity
        });
      }
    });
    
    // Sort by similarity (highest first), then by distance (lowest first)
    return similar.sort((a, b) => {
      if (b.similarity !== a.similarity) {
        return b.similarity - a.similarity;
      }
      return a.distance - b.distance;
    });
  }

  /**
   * Correct typos in a query
   * @param {string} query - Original query with potential typos
   * @param {Object} options - Options for correction
   * @param {number} options.maxDistance - Maximum edit distance for corrections (default: 2)
   * @param {number} options.minSimilarity - Minimum similarity threshold (0-1, default: 0.6)
   * @param {boolean} options.correctPhrases - Whether to correct multi-word phrases (default: true)
   * @returns {Object} - { original: string, corrected: string, corrections: Array, hasCorrections: boolean }
   */
  static correctTypos(query, options = {}) {
    const {
      maxDistance = 2,
      minSimilarity = 0.6,
      correctPhrases = true
    } = options;
    
    const original = query;
    let corrected = query;
    const corrections = [];
    
    // Split query into words (preserve punctuation)
    const words = query.split(/(\s+)/);
    const correctedWords = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Skip whitespace and very short words
      if (!word.trim() || word.trim().length <= 2) {
        correctedWords.push(word);
        continue;
      }
      
      // Remove punctuation for matching, but preserve it
      const wordWithoutPunct = word.replace(/[^\w]/g, '');
      const punctBefore = word.match(/^[^\w]*/)?.[0] || '';
      const punctAfter = word.match(/[^\w]*$/)?.[0] || '';
      
      if (!wordWithoutPunct || wordWithoutPunct.length <= 2) {
        correctedWords.push(word);
        continue;
      }
      
      // Check for multi-word phrases first (if enabled)
      if (correctPhrases && i < words.length - 2) {
        // Try 2-word phrase
        const nextWord = words[i + 2]?.replace(/[^\w]/g, '') || '';
        if (nextWord && nextWord.length > 2) {
          const phrase = `${wordWithoutPunct} ${nextWord}`.toLowerCase();
          const similarPhrases = this.findSimilarWords(phrase, maxDistance);
          
          if (similarPhrases.length > 0 && similarPhrases[0].similarity >= minSimilarity) {
            const bestMatch = similarPhrases[0];
            const correctedPhrase = bestMatch.word;
            
            // Apply correction
            const [firstWord, secondWord] = correctedPhrase.split(' ');
            correctedWords.push(punctBefore + firstWord + punctAfter);
            correctedWords.push(words[i + 1]); // Preserve whitespace
            correctedWords.push(punctBefore + secondWord + punctAfter);
            
            corrections.push({
              original: phrase,
              corrected: correctedPhrase,
              similarity: bestMatch.similarity,
              distance: bestMatch.distance
            });
            
            i += 2; // Skip next word (already corrected)
            continue;
          }
        }
      }
      
      // CRITICAL FIX: Don't correct words that are already correct!
      // Check if word is already in COMMON_TERMS (exact match, case-insensitive)
      const wordLower = wordWithoutPunct.toLowerCase();
      const isAlreadyCorrect = this.COMMON_TERMS.some(term => 
        term.toLowerCase() === wordLower
      );
      
      // Don't correct acronyms (2-5 uppercase letters, possibly with hyphens)
      const isAcronym = /^[A-Z]{2,5}(-[A-Z0-9]+)?$/i.test(wordWithoutPunct);
      
      // Don't correct if already correct or is an acronym
      if (isAlreadyCorrect || isAcronym) {
        correctedWords.push(word);
        continue;
      }
      
      // Check single word
      const similarWords = this.findSimilarWords(wordWithoutPunct, maxDistance);
      
      if (similarWords.length > 0 && similarWords[0].similarity >= minSimilarity) {
        const bestMatch = similarWords[0];
        const correctedWord = bestMatch.word;
        
        // CRITICAL: Don't correct question words to other question words!
        // This prevents "who" → "why", "what" → "that", etc.
        const questionWords = ['what', 'who', 'when', 'where', 'why', 'how', 'which'];
        const isQuestionWord = questionWords.includes(wordLower);
        const correctedIsQuestionWord = questionWords.includes(correctedWord.toLowerCase());
        
        if (isQuestionWord && correctedIsQuestionWord && wordLower !== correctedWord.toLowerCase()) {
          // Don't correct one question word to another
          correctedWords.push(word);
          continue;
        }
        
        // Preserve original capitalization if it was capitalized
        const finalWord = wordWithoutPunct[0] === wordWithoutPunct[0].toUpperCase()
          ? correctedWord.charAt(0).toUpperCase() + correctedWord.slice(1)
          : correctedWord;
        
        correctedWords.push(punctBefore + finalWord + punctAfter);
        
        corrections.push({
          original: wordWithoutPunct,
          corrected: correctedWord,
          similarity: bestMatch.similarity,
          distance: bestMatch.distance
        });
      } else {
        // No correction found, keep original
        correctedWords.push(word);
      }
    }
    
    corrected = correctedWords.join('');
    
    return {
      original: original,
      corrected: corrected.trim(),
      corrections: corrections,
      hasCorrections: corrections.length > 0
    };
  }
}

export class QueryAnalyzer {
  
  /**
   * Extract structured entities from query (acronyms, years, names, etc.)
   * @param {string} query - User's question
   * @returns {Object} - Extracted entities
   */
  static extractEntities(query) {
    const entities = {
      officeAcronyms: [],
      years: [],
      names: [],
      dates: [],
      numbers: []
    };
    
    // Extract office acronyms
    const officeAcronyms = ['OSPAT', 'OSA', 'OSCD', 'FASG', 'PESO', 'IRO', 'HSU', 'CGAD', 'IP-TBM', 'GCTC'];
    officeAcronyms.forEach(acronym => {
      const regex = new RegExp(`\\b${acronym}\\b`, 'i');
      if (regex.test(query)) {
        entities.officeAcronyms.push(acronym);
      }
    });
    
    // Extract years (4-digit years)
    const yearMatches = query.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches) {
      entities.years = yearMatches.map(y => parseInt(y, 10));
    }
    
    // Extract numbers (for statistics queries)
    const numberMatches = query.match(/\b\d{3,}\b/g);
    if (numberMatches) {
      entities.numbers = numberMatches.map(n => parseInt(n, 10));
    }
    
    // Extract dates (month names, date patterns)
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                       'july', 'august', 'september', 'october', 'november', 'december'];
    monthNames.forEach(month => {
      if (query.toLowerCase().includes(month)) {
        entities.dates.push(month);
      }
    });
    
    // Extract person names (capitalized words, 2+ words)
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const nameMatches = query.match(namePattern);
    if (nameMatches) {
      entities.names = nameMatches.filter(name => 
        !['What', 'Who', 'When', 'Where', 'Why', 'How', 'The', 'This', 'That'].includes(name.split(' ')[0])
      );
    }
    
    return entities;
  }

  /**
   * Analyze query to determine optimal data retrieval strategy
   * @param {string} query - User's question
   * @returns {Object} - { complexity: string, confidence: number, settings: {}, intentClassification: {} }
   */
  static analyzeComplexity(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    // STEP 1: Extract structured entities
    const extractedEntities = this.extractEntities(query);
    
    // STEP 2: Classify intent (DOrSU vs General Knowledge)
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
      
      // Calendar & events
      // Tagalog: petsa, pangyayari, anunsyo, iskedyul
      // Bisaya: petsa, panghitabo, anunsyo, iskedyul
      calendar: ['date', 'dates', 'event', 'events', 'announcement', 'announcements', 'schedule', 'schedules', 'calendar', 'when', 'upcoming', 'coming', 'next', 'deadline', 'deadlines', 'holiday', 'holidays', 'academic calendar', 'semester', 'enrollment period', 'registration', 'exam schedule', 'class schedule', 'petsa', 'pangyayari', 'anunsyo', 'iskedyul', 'panghitabo'],
      
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
    const wordCount = lowerQuery.split(/\s+/).filter(word => word.length > 0).length;
    
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

    // Additional safeguard: treat pronoun matches as follow-ups only when query truly
    // depends on previous context (i.e., short question without explicit subject).
    if (isFollowUpQuery) {
      const explicitSubjectPattern = /\b(programs?|courses?|faculties?|deans?|students?|campus|campuses|university|dorsu|office|offices|department|departments|schedule|schedules|calendar|event|events|exam|exams|requirements?|admission|tuition|history|mission|vision|values?|outcomes?|organization|usc|sidlakan|catalyst|leadership|president|vice\s+president)\b/i;
      const hasExplicitSubject = explicitSubjectPattern.test(lowerQuery);
      const isShortPronounQuery = wordCount <= 8;
      if (hasExplicitSubject && !isShortPronounQuery) {
        // Remove follow-up intent to avoid unnecessary pronoun resolution
        detectedIntents = detectedIntents.filter(intent => intent !== 'followUp');
        isFollowUpQuery = false;
        ragMultiplier = Math.max(1.0, ragMultiplier - 0.5);
      }
    }
    
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
    
    // STEP 2: Detect vague queries that need clarification
    const vagueQueryAnalysis = this.detectVagueQuery(query, detectedTopics, detectedIntents, isFollowUpQuery, intentClassification);
    
    // IMPROVED: Boost multiplier for structured entity queries
    if (extractedEntities.officeAcronyms.length > 0) {
      ragMultiplier += 0.5; // Office acronym queries need precise matching
    }
    if (extractedEntities.years.length > 0) {
      ragMultiplier += 0.3; // Year-specific queries need targeted data
    }
    if (extractedEntities.names.length > 0) {
      ragMultiplier += 0.4; // Person name queries need exact matches
    }
    
    // Build analysis result
    const analysis = {
      complexity: complexityLevel,
      confidence: Math.min(100, Math.round(ragMultiplier * 25)),
      detectedTopics,
      detectedIntents,
      foundPlurals,
      extractedEntities, // NEW: Add extracted entities
      ragMultiplier: Math.min(6.0, ragMultiplier), // Increased cap to 6x for comprehensive queries
      settings: this.getOptimalSettings(ragMultiplier, query),
      isMultiPart: detectedIntents.includes('multiPart'),
      isFollowUp: isFollowUpQuery,  // Flag for conversation context
      intentClassification,  // Add intent classification result
      isVague: vagueQueryAnalysis.isVague,  // Flag for vague queries
      vagueReason: vagueQueryAnalysis.reason,  // Reason why query is vague
      needsClarification: vagueQueryAnalysis.needsClarification  // Whether to ask for clarification
    };
    
    return analysis;
  }
  
  /**
   * Detect vague queries that may need clarification
   * Examples: "final exam", "mcc", "schedule", short acronyms, ambiguous terms
   * @param {string} query - User's question
   * @param {Array} detectedTopics - Topics detected in query
   * @param {Array} detectedIntents - Intents detected in query
   * @param {boolean} isFollowUp - Whether this is a follow-up query
   * @param {Object} intentClassification - Intent classification result (optional)
   * @returns {Object} - { isVague: boolean, reason: string, needsClarification: boolean }
   */
  static detectVagueQuery(query, detectedTopics, detectedIntents, isFollowUp, intentClassification = null) {
    const lowerQuery = query.toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
    const queryLength = query.length;
    const wordCount = queryWords.length;
    
    // Skip vague detection for greetings - let the AI respond naturally
    if (intentClassification && intentClassification.conversationalIntent === 'greeting') {
      return {
        isVague: false,
        reason: null,
        needsClarification: false
      };
    }
    
    // Vague query patterns that need clarification
    const vaguePatterns = {
      // Short queries (1-3 words) without clear context
      shortQuery: wordCount <= 3 && queryLength < 30,
      
      // Common vague terms that need context
      vagueTerms: /\b(final\s+exam|midterm|prelim|quiz|test|exam|mcc|schedule|deadline|event|announcement|program|course|faculty|dean|director|president|office|department|building|campus|location|link|url|website|manual|guide|form|requirement|process|step|procedure)\b/i,
      
      // Acronyms (2-5 uppercase letters, possibly with numbers)
      acronyms: /\b[A-Z]{2,5}\d?\b/,
      
      // Single word queries (unless it's a clear question word)
      singleWord: wordCount === 1 && !/\b(what|who|when|where|why|how|which|list|show|tell|explain|describe|ano|sino|kailan|saan|bakit|paano|unsa|kinsa|kanus-a|asa|ngano|giunsa)\b/i.test(lowerQuery),
      
      // Queries with pronouns but no clear topic (follow-ups without context)
      pronounWithoutTopic: isFollowUp && detectedTopics.length === 0 && /\b(it|that|this|they|them|he|she|his|her|their|siya|niya|kanyang|ito|iyan|kana|kini)\b/i.test(lowerQuery),
      
      // Ambiguous academic terms
      ambiguousAcademic: /\b(final\s+exam|midterm|prelim|quiz|test|mcc|schedule)\b/i.test(lowerQuery) && !/\b(when|date|time|what|where|how|which|kailan|ano|saan|paano)\b/i.test(lowerQuery)
    };
    
    let isVague = false;
    let reasons = [];
    let needsClarification = false;
    
    // Check each vague pattern
    if (vaguePatterns.shortQuery && !isFollowUp) {
      isVague = true;
      reasons.push('short query without clear context');
    }
    
    if (vaguePatterns.vagueTerms.test(lowerQuery) && detectedTopics.length === 0 && !isFollowUp) {
      isVague = true;
      const matchedTerm = lowerQuery.match(vaguePatterns.vagueTerms)[0];
      reasons.push(`vague term "${matchedTerm}" without context`);
    }
    
    if (vaguePatterns.acronyms.test(query) && !isFollowUp) {
      isVague = true;
      const matchedAcronym = query.match(vaguePatterns.acronyms)[0];
      reasons.push(`unclear acronym "${matchedAcronym}"`);
    }
    
    if (vaguePatterns.singleWord && !isFollowUp) {
      isVague = true;
      reasons.push('single word query without question word');
    }
    
    if (vaguePatterns.pronounWithoutTopic) {
      isVague = true;
      reasons.push('pronoun reference without clear topic');
    }
    
    if (vaguePatterns.ambiguousAcademic) {
      isVague = true;
      reasons.push('ambiguous academic term without specific question');
    }
    
    // Determine if clarification is needed
    // If query is vague AND has no detected topics AND is not a follow-up with context
    if (isVague && detectedTopics.length === 0 && !isFollowUp) {
      needsClarification = true;
    }
    
    // Also check if query is too short and lacks question words
    if (wordCount <= 2 && !/\b(what|who|when|where|why|how|which|when\s+is|what\s+is|who\s+is|where\s+is|how\s+to|ano|sino|kailan|saan|bakit|paano|unsa|kinsa)\b/i.test(lowerQuery)) {
      needsClarification = true;
      if (!isVague) {
        isVague = true;
        reasons.push('very short query without question words');
      }
    }
    
    return {
      isVague,
      reason: reasons.length > 0 ? reasons.join(', ') : null,
      needsClarification
    };
  }
  
  /**
   * Get optimal settings based on RAG multiplier
   * Groq is FAST - maximize data retrieval for better answers!
   * IMPROVED: Adjust settings based on query structure
   */
  static getOptimalSettings(ragMultiplier, query) {
    // Extract entities to adjust settings
    const entities = this.extractEntities(query);
    const hasStructuredQuery = entities.officeAcronyms.length > 0 || 
                               entities.years.length > 0 || 
                               entities.names.length > 0;
    
    // Base settings - AGGRESSIVELY OPTIMIZED to minimize input tokens
    // Input tokens are the main cost - need to reduce RAG context significantly
    const baseSettings = {
      maxTokens: 500,          // Output tokens (response length)
      numCtx: 4096,
      ragSections: 8,          // Reduced from 12 - focus on top 8 most relevant chunks only
      ragMaxTokens: 800,       // Reduced from 1500 - CRITICAL: This controls input token cost
      temperature: 0.3,
      useMongoDBNative: hasStructuredQuery // Use MongoDB native search for structured queries
    };
    
    // Calculate scaled settings based on multiplier
    // Balance comprehensiveness with token limits (8K for most Groq models)
    const scaledSettings = {
      maxTokens: Math.min(1000, Math.round(baseSettings.maxTokens * ragMultiplier)),  // Cap at 1000
      numCtx: Math.min(16384, Math.round(baseSettings.numCtx * Math.sqrt(ragMultiplier))),
      ragSections: Math.min(15, Math.round(baseSettings.ragSections * ragMultiplier)),  // Cap at 15 (reduced from 30)
      ragMaxTokens: Math.min(1500, Math.round(baseSettings.ragMaxTokens * ragMultiplier)),  // Cap at 1500 (reduced from 3000) - CRITICAL for input token control
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

