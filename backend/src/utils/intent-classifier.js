/**
 * Intent Classifier - Smart Query Routing & Conversational Intent Detection
 * 
 * Two-Layer Classification:
 * 1. Content Layer: DOrSU-specific vs. general knowledge routing
 * 2. Conversational Layer: User interaction intent (greeting, emotion, task, etc.)
 * 
 * Routes to appropriate data source and adjusts response style accordingly
 */

export class IntentClassifier {
  
    /**
     * Conversational Intent Patterns (Layer 1: Interaction Type)
     */
    static conversationalIntents = {
      greeting: {
        patterns: [
          /\b(hi|hello|hey|good\s+(morning|afternoon|evening|day)|greetings|sup|yo)\b/i,
          /\b(kumusta|kamusta|musta|kumusta\s+ka|oy|hoy)\b/i,
          /\b(magandang\s+(umaga|hapon|gabi|araw))\b/i
        ],
        responseHint: 'Respond warmly and briefly, then ask how you can help'
      },
      
      farewell: {
        patterns: [
          /\b(bye|goodbye|see\s+you|take\s+care|farewell|later|peace|cya|ttyl)\b/i,
          /\b(paalam|sige|thank\s+you|thanks|salamat|thank\s+you\s+so\s+much)\b/i,
          /\b(ayos|okay\s+na|gets\s+na|sige\s+salamat)\b/i
        ],
        responseHint: 'Respond kindly, wish them well, stay open for future questions'
      },
      
      gratitude: {
        patterns: [
          /\b(thank|thanks|thank\s+you|thx|ty|appreciate|grateful)\b/i,
          /\b(salamat|maraming\s+salamat|daghang\s+salamat)\b/i
        ],
        responseHint: 'Acknowledge warmly and offer continued assistance'
      },
      
      emotion_expression: {
        patterns: [
          /\b(i\s+feel|i\'m|i\s+am)\s+(sad|happy|stressed|anxious|worried|excited|frustrated|confused|tired|overwhelmed)\b/i,
          /\b(nalilito|nerbiyos|na\s*stress|nalulungkot|masaya|kinakabahan)\b/i,
          /\b(help\s+me|i\s+need\s+help|struggling|having\s+trouble|difficulty)\b/i
        ],
        responseHint: 'Respond empathetically, acknowledge their feelings, offer relevant support'
      },
      
      task_request: {
        patterns: [
          /\b(remind\s+me|set\s+a?\s*reminder|schedule|add\s+to|create\s+a)\b/i,
          /\b(can\s+you|could\s+you|please|paki|pwede\s+mo)\s+(help|assist|remind|set|schedule|create)\b/i,
          /\b(i\s+need\s+to|i\s+want\s+to|i\s+have\s+to)\b/i
        ],
        responseHint: 'Confirm understanding, clarify if needed, then act or guide'
      },
      
      information_query: {
        patterns: [
          /\b(what\s+is|what\s+are|what\'s|tell\s+me\s+about|explain|describe)\b/i,
          /\b(how\s+to|how\s+do\s+i|how\s+can\s+i|where\s+is|where\s+can\s+i|when\s+is|when\s+can)\b/i,
          /\b(who\s+is|who\s+are|why\s+is|why\s+are|why\s+do|which)\b/i,
          /\b(ano\s+ang|sino\s+ang|saan\s+ang|kailan|paano|bakit)\b/i,
          /\b(unsa|asa|kinsa|kanus-a|ngano|giunsa)\b/i,
          /\b(list|show\s+me|give\s+me|can\s+you\s+show|may\s+i\s+know)\b/i
        ],
        responseHint: 'Provide comprehensive, factual information from knowledge base'
      },
      
      clarification_request: {
        patterns: [
          /\b(what\s+do\s+you\s+mean|can\s+you\s+explain|i\s+don\'t\s+understand|clarify|confused)\b/i,
          /\b(elaborate|more\s+details|give\s+example|example|what\s+about)\b/i,
          /\b(ano\s+ibig\s+sabihin|hindi\s+ko\s+maintindihan)\b/i
        ],
        responseHint: 'Rephrase and provide more context or examples'
      },
      
      follow_up: {
        patterns: [
          /\b(and|also|what\s+about|how\s+about|what\s+else|anything\s+else|more)\b/i,
          /\b(he|she|his|her|their|that|this|it)\b/i,
          /\b(ano\s+pa|paano\s+naman|yung|yun)\b/i
        ],
        responseHint: 'Use conversation context to understand reference'
      },
      
      small_talk: {
        patterns: [
          /\b(how\s+are\s+you|what\'s\s+up|how\'s\s+it\s+going|how\s+do\s+you\s+do)\b/i,
          /\b(nice\s+to\s+meet|good\s+to\s+see|pleasure\s+to|lovely)\b/i,
          /\b(weather|day|weekend|today)\b/i
        ],
        responseHint: 'Keep it brief, friendly, and transition to offering help'
      }
    };
    
    /**
     * Detect conversational intent (Layer 1)
     * @param {string} query - User's message
     * @returns {Object} - { type, confidence, hint }
     */
    static detectConversationalIntent(query) {
      const lowerQuery = query.toLowerCase().trim();
      const detected = [];
      
      // Check each conversational intent
      for (const [intentName, intentData] of Object.entries(this.conversationalIntents)) {
        const matchCount = intentData.patterns.filter(pattern => pattern.test(lowerQuery)).length;
        
        if (matchCount > 0) {
          detected.push({
            type: intentName,
            confidence: Math.min(100, matchCount * 50),
            hint: intentData.responseHint
          });
        }
      }
      
      // Sort by confidence and return top match
      detected.sort((a, b) => b.confidence - a.confidence);
      
      return detected.length > 0 
        ? detected[0]
        : { type: 'information_query', confidence: 30, hint: 'Provide relevant information' };
    }
    
    /**
     * Comprehensive intent classification (Layer 1 + Layer 2)
     * @param {string} query - User's question
     * @returns {Object} - Complete classification with both layers
     */
    static classifyIntent(query) {
      const lowerQuery = query.toLowerCase().trim();
      
      // ====================================================================
      // LAYER 1: CONVERSATIONAL INTENT (How to respond)
      // ====================================================================
      const conversationalIntent = this.detectConversationalIntent(query);
      
      // ====================================================================
      // LAYER 2: CONTENT CLASSIFICATION (What data source to use)
      // ====================================================================
      
      // ============================================================
      // 1. DORSU-SPECIFIC INDICATORS (Knowledge Base)
      // ============================================================
      
      // Direct DOrSU mentions (MULTILINGUAL)
      const dorsuMentions = [
        'dorsu', 'davao oriental state university', 
        'davao oriental university', 'doscst',
        'mati university', 'mati city university',
        'university ng davao oriental', 'unibersidad ng davao oriental',
        'unibersidad sa davao oriental'
      ];
      
      // DOrSU-specific entities (people, places, programs)
      const dorsuEntities = {
        // People
        people: [
          'roy ponce', 'roy g. ponce', 'roy padilla', 'lilibeth galvez',
          'lea jimenez', 'edito sumile', 'misael clapano', 'anglie nemenzo',
          'richard maravillas', 'jovanie garay', 'leopoldo aquino',
          'gemma valdez', 'eleanor vilela', 'rizaldy maypa', 'danilo jacobe',
          'rex aparicio', 'goriel llanita', 'michelle tabotabo', 'jocelyn arles',
          'presidente ng dorsu', 'president ng dorsu'
        ],
        
        // Specific faculties (unique to DOrSU)
        faculties: [
          'facet', 'fals', 'fted', 'fbm', 'fcje', 'fnahs', 'fhusocom',
          'faculty of computing engineering and technology',
          'faculty of agriculture and life sciences',
          'faculty of teacher education',
          'faculty of business management',
          'faculty of criminal justice education',
          'faculty of nursing and allied health',
          'faculty of humanities social sciences'
        ],
        
        // DOrSU campuses
        campuses: [
          'main campus', 'baganga campus', 'banaybanay campus',
          'cateel campus', 'san isidro campus', 'tarragona campus',
          'extension campus', 'kampus ng dorsu'
        ],
        
        // DOrSU-specific programs
        programs: [
          'bitm', 'bsmrs', 'bsam', 'bses', 'bced', 'bsned', 'bped', 'btled',
          'industrial technology management', 'mathematics with research statistics',
          'agribusiness management', 'environmental science'
        ],
        
        // DOrSU locations
        locations: [
          'mati', 'mati city', 'davao oriental', 'guang-guang', 'dahican',
          'city of mati', 'lungsod ng mati'
        ],
        
        // DOrSU-specific topics
        topics: [
          'subangan museum', 'mt. hamiguitan', 'hamiguitan',
          'happy fish kids', 'happy forest kids', 'happy farm kids',
          'regenerative futures', 'unesco world heritage'
        ]
      };
      
      // DOrSU-specific questions (patterns that are university-specific)
      const dorsuQuestionPatterns = [
        // Organizational
        /\b(president|vice president|dean|director|chancellor|administrator|board of regents)\s+(of|ng)?\s*(dorsu|the university|our university)?\b/i,
        /\bwho\s+(is|ang)\s+the\s+(president|vp|dean|director|head)\b/i,
        
        // Academic
        /\b(programs|courses|faculties|departments|colleges)\s+(offered|available|in|ng|sa)\s*(dorsu|the university)?\b/i,
        /\bhow\s+to\s+(enroll|apply|register)\s+(in|sa|ng)?\s*(dorsu)?\b/i,
        /\b(admission|enrollment|requirements|tuition|fees)\s+(for|in|sa|ng)\s*(dorsu)?\b/i,
        
        // Facilities & Location
        /\bwhere\s+is\s+(dorsu|the university|main campus)\b/i,
        /\b(location|address|campus|building|facility)\s+(of|ng)?\s*(dorsu)?\b/i,
        
        // History & Identity
        /\b(history|founded|established|background|evolution)\s+(of|ng)?\s*(dorsu)?\b/i,
        /\b(vision|mission|core values|mandate|objectives|hymn|motto)\s+(of|ng)?\s*(dorsu)?\b/i,
        
        // Quality & Outcomes
        /\b(accreditation|quality|standards|graduate outcomes)\s+(of|ng)?\s*(dorsu)?\b/i,
        
        // Research & Extension
        /\b(research|extension|innovation|projects)\s+(at|in|ng|sa)\s*(dorsu)?\b/i
      ];
      
      // ============================================================
      // 2. GENERAL KNOWLEDGE INDICATORS (AI Training Data)
      // ============================================================
      
      const generalKnowledgePatterns = {
        // Science & Technology (not university-specific)
        science: [
          /\bwhat\s+is\s+(photosynthesis|gravity|atom|molecule|dna|rna|cell|protein|enzyme)\b/i,
          /\bexplain\s+(quantum|relativity|evolution|thermodynamics|chemistry|physics|biology)\b/i,
          /\bhow\s+does\s+(the\s+internet|wifi|bluetooth|gps|computer|ai|machine learning)\s+work\b/i,
          /\b(programming|coding|algorithm|data structure|python|javascript|java|c\+\+)\b/i
        ],
        
        // Mathematics (general concepts)
        math: [
          /\bsolve\s+(equation|integral|derivative|matrix|problem)\b/i,
          /\bcalculate\s+(area|volume|perimeter|distance|speed)\b/i,
          /\bwhat\s+is\s+(calculus|algebra|geometry|trigonometry|statistics|probability)\b/i,
          /\b(pythagorean theorem|quadratic formula|derivative|integral)\b/i
        ],
        
        // History & Geography (world/national, not DOrSU)
        history: [
          /\bwho\s+(is|was)\s+(albert einstein|isaac newton|marie curie|stephen hawking|nikola tesla)\b/i,
          /\bwhat\s+(happened|occurred)\s+in\s+\d{4}\b/i,
          /\b(world war|cold war|industrial revolution|renaissance|ancient civilization)\b/i,
          /\bwhere\s+is\s+(paris|tokyo|new york|london|beijing|manila)\b/i,
          /\b(philippines|filipino|pilipinas)\s+(history|culture|government|president|senator)\b/i
        ],
        
        // Language & Literature (general)
        language: [
          /\btranslate\s+.+\s+to\s+(english|tagalog|bisaya|cebuano|spanish|chinese)\b/i,
          /\bwhat\s+does\s+.+\s+mean\s+in\s+(english|tagalog|bisaya)\b/i,
          /\b(grammar|spelling|punctuation|sentence structure)\b/i,
          /\bwho\s+wrote\s+(novel|book|poem|story)\b/i
        ],
        
        // Current Events & News
        currentEvents: [
          /\b(latest news|current events|today|yesterday|this week|this month)\b/i,
          /\bwhat\s+happened\s+(today|yesterday|recently)\b/i,
          /\b(election|politics|government|congress|senate)\s+(today|now|current)\b/i
        ],
        
        // Health & Medicine (general)
        health: [
          /\bwhat\s+(are\s+)?(symptoms|causes|treatment|cure)\s+of\s+\w+\b/i,
          /\bhow\s+to\s+(treat|prevent|cure|diagnose)\b/i,
          /\b(medicine|drug|vaccine|therapy|surgery|diagnosis)\b/i
        ],
        
        // Technology & Tools (general)
        technology: [
          /\bhow\s+to\s+use\s+(microsoft|google|facebook|youtube|excel|word|powerpoint)\b/i,
          /\bwhat\s+is\s+(chatgpt|ai|artificial intelligence|blockchain|cryptocurrency)\b/i,
          /\b(install|download|setup|configure|troubleshoot)\b/i
        ],
        
        // Arts & Entertainment
        entertainment: [
          /\bwho\s+(is|are)\s+(actor|actress|singer|artist|celebrity|musician)\b/i,
          /\bwhat\s+is\s+(movie|film|song|album|tv show|series)\b/i,
          /\b(sports|football|basketball|soccer|tennis|olympics)\b/i
        ],
        
        // Philosophy & Ethics
        philosophy: [
          /\bwhat\s+is\s+(meaning\s+of\s+life|purpose|existence|consciousness|free will)\b/i,
          /\b(philosophy|ethics|morality|virtue|justice)\b/i,
          /\b(socrates|plato|aristotle|kant|nietzsche)\b/i
        ]
      };
      
      // ============================================================
      // 3. CLASSIFICATION LOGIC
      // ============================================================
      
      let dorsuScore = 0;
      let generalScore = 0;
      let detectedDorsuEntities = [];
      let detectedGeneralCategories = [];
      let reasoning = [];
      
      // Check for direct DOrSU mentions (very strong indicator)
      const hasDorsuMention = dorsuMentions.some(mention => lowerQuery.includes(mention));
      if (hasDorsuMention) {
        dorsuScore += 100;
        reasoning.push('Direct DOrSU mention');
      }
      
      // Check for DOrSU entities
      Object.entries(dorsuEntities).forEach(([category, entities]) => {
        const found = entities.filter(entity => lowerQuery.includes(entity));
        if (found.length > 0) {
          dorsuScore += found.length * 50;
          detectedDorsuEntities.push({ category, entities: found });
          reasoning.push(`DOrSU ${category}: ${found.join(', ')}`);
        }
      });
      
      // Check for DOrSU question patterns
      const matchedDorsuPatterns = dorsuQuestionPatterns.filter(pattern => pattern.test(lowerQuery));
      if (matchedDorsuPatterns.length > 0) {
        dorsuScore += matchedDorsuPatterns.length * 30;
        reasoning.push(`DOrSU question pattern matched`);
      }
      
      // Check for general knowledge patterns
      Object.entries(generalKnowledgePatterns).forEach(([category, patterns]) => {
        const matched = patterns.filter(pattern => pattern.test(lowerQuery));
        if (matched.length > 0) {
          generalScore += matched.length * 40;
          detectedGeneralCategories.push(category);
          reasoning.push(`General ${category} question`);
        }
      });
      
      // Contextual clues
      const contextualClues = {
        // University-related (but could be general)
        university: /\b(university|college|school|campus|student|teacher|professor|education)\b/i,
        
        // Question words that suggest general knowledge
        howTo: /\bhow\s+to\s+(?!enroll|apply|register)\w+/i,
        whatIs: /\bwhat\s+is\s+(?!dorsu|the\s+president|the\s+mission)\w+/i,
        whyIs: /\bwhy\s+(is|are|do|does)\b/i
      };
      
      // If mentions university but no DOrSU entities, it's likely general
      if (contextualClues.university.test(lowerQuery) && dorsuScore === 0) {
        generalScore += 20;
        reasoning.push('General university question');
      }
      
      // Generic "what is" questions without DOrSU context
      if (contextualClues.whatIs.test(lowerQuery) && dorsuScore === 0) {
        generalScore += 15;
        reasoning.push('General "what is" question');
      }
      
      // ============================================================
      // 4. FINAL CLASSIFICATION
      // ============================================================
      
      let intent = 'unknown';
      let source = 'ai_training_data';
      let confidence = 0;
      let category = 'general';
      
      if (dorsuScore > generalScore) {
        intent = 'dorsu_specific';
        source = 'knowledge_base';
        confidence = Math.min(100, Math.round((dorsuScore / (dorsuScore + generalScore + 1)) * 100));
        category = 'dorsu';
      } else if (generalScore > 0) {
        intent = 'general_knowledge';
        source = 'ai_training_data';
        confidence = Math.min(100, Math.round((generalScore / (dorsuScore + generalScore + 1)) * 100));
        
        // Determine specific category
        if (detectedGeneralCategories.length > 0) {
          category = detectedGeneralCategories[0];
        }
      } else {
        // Ambiguous - default to DOrSU if no clear indicator
        intent = 'ambiguous';
        source = 'knowledge_base';  // Default to knowledge base for safety
        confidence = 30;
        category = 'ambiguous';
        reasoning.push('No clear indicators - defaulting to DOrSU knowledge base');
      }
      
      return {
        // Layer 1: Conversational Intent (How to respond)
        conversationalIntent: conversationalIntent.type,
        conversationalConfidence: conversationalIntent.confidence,
        responseHint: conversationalIntent.hint,
        
        // Layer 2: Content Classification (What data source)
        intent,
        source,
        confidence,
        category,
        dorsuScore,
        generalScore,
        detectedDorsuEntities,
        detectedGeneralCategories,
        reasoning,
        query: query.substring(0, 100)  // Store truncated query for logging
      };
    }
    
    /**
     * Format classification for logging
     */
    static formatClassification(classification) {
      const icon = classification.source === 'knowledge_base' ? '🏫' : '🌍';
      const sourceText = classification.source === 'knowledge_base' 
        ? 'DOrSU Knowledge Base' 
        : 'AI Training Data';
      
      const intentIcon = this.getConversationalIcon(classification.conversationalIntent);
      
      return `${intentIcon} ${classification.conversationalIntent.toUpperCase()} | ` +
             `${icon} ${classification.intent.toUpperCase()} → ${sourceText} ` +
             `(${classification.confidence}% confidence)`;
    }
    
    /**
     * Get emoji icon for conversational intent
     */
    static getConversationalIcon(intentType) {
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
    
    /**
     * Get system prompt enhancement based on conversational intent
     */
    static getSystemPrompt(classification, hasKnowledgeBase = false) {
      let basePrompt = '';
      
      // Base data source instruction
      if (classification.source === 'knowledge_base') {
        basePrompt = 'You are a DOrSU Assistant. Answer using ONLY the DOrSU knowledge base provided. ' +
                     'If the information is not in the knowledge base, say "I don\'t have that specific information about DOrSU."';
      } else {
        basePrompt = 'You are a helpful AI assistant. Answer this general knowledge question using your training data. ' +
                     'Be accurate, concise, and educational. If you\'re unsure, acknowledge it.';
      }
      
      // Add conversational intent guidance
      const intentGuidance = `\n\n🎯 USER INTENT: ${classification.conversationalIntent}\n` +
                            `→ ${classification.responseHint}`;
      
      return basePrompt + intentGuidance;
    }
  }
  
  // Export default
  export default IntentClassifier;
  
  