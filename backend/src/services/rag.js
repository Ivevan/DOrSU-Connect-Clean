import { pipeline } from '@xenova/transformers';
import faiss from 'faiss-node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger } from '../utils/logger.js';
import { TypoCorrector } from '../utils/query-analyzer.js';
import { VectorSearchService } from './vector-search.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TIMEZONE = process.env.CALENDAR_TIMEZONE || 'Asia/Manila';

function formatDateInTimezone(date, options = {}) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    ...options,
  }).format(date);
}

export class OptimizedRAGService {
  constructor(mongoService = null) {
    this.faissOptimizedData = null;
    this.mongoService = mongoService; // MongoDB service for dynamic data
    this.lastMongoSync = null; // Track last sync time
    
    // CACHING REMOVED - Always fetch fresh data for accuracy
    
    // FAISS vector search (kept for backward compatibility and fallback)
    this.faissIndex = null;
    this.embeddings = [];
    this.textChunks = [];
    this.embeddingDimension = 384; // Standard dimension for sentence transformers (all-MiniLM-L6-v2)
    
    // Transformer model for embeddings
    this.embeddingModel = null;
    this.modelLoaded = false;
    
    // VectorSearchService - handles ALL retrieval/search logic
    this.vectorSearchService = null;
    
    this.loadOptimizedData();
    this.initializeEmbeddingModel();
    
    // Sync with MongoDB every 30 seconds if available
    // NOTE: Initial sync is handled by server.js with a 2-second delay (line 110)
    // to ensure MongoDB is connected before first sync
    if (this.mongoService) {
      setInterval(() => this.syncWithMongoDB(), 30000);
    }
  }

  // Load FAISS-optimized data structure (deprecated - now using MongoDB)
  loadOptimizedData() {
    // All data now comes from MongoDB via syncWithMongoDB()
    // This method is kept for backward compatibility but no longer loads from file
    this.faissOptimizedData = { chunks: [] };
    Logger.info('RAG service will load data from MongoDB');
  }


  // Initialize transformer embedding model
  async initializeEmbeddingModel() {
    try {
      Logger.info('Loading transformer embedding model (all-MiniLM-L6-v2)...');
      
      // Load the sentence-transformers model for feature extraction
      this.embeddingModel = await pipeline(
        'feature-extraction', 
        'Xenova/all-MiniLM-L6-v2'
      );
      
      this.modelLoaded = true;
      Logger.success('Transformer embedding model loaded successfully');
      
      // Now initialize FAISS with the transformer model
      await this.initializeFAISS();
      
      // Initialize VectorSearchService after FAISS is ready
      this.vectorSearchService = new VectorSearchService(
        this.mongoService,
        this.faissOptimizedData,
        this.faissIndex,
        this.textChunks,
        this.embeddingModel,
        this.modelLoaded
      );
      
    } catch (error) {
      Logger.error('Failed to load transformer model', error);
      Logger.warn('Falling back to simple embeddings');
      this.modelLoaded = false;
      
      // Fallback to simple embeddings
      await this.initializeFAISS();
      
      // Initialize VectorSearchService even if model failed
      this.vectorSearchService = new VectorSearchService(
        this.mongoService,
        this.faissOptimizedData,
        this.faissIndex,
        this.textChunks,
        this.embeddingModel,
        this.modelLoaded
      );
    }
  }


  // Initialize FAISS index and create embeddings
  async initializeFAISS() {
    try {
      Logger.info('Initializing FAISS vector search...');
      
      // Try to create FAISS index
      try {
        this.faissIndex = new faiss.IndexFlatL2(this.embeddingDimension);
        Logger.success('FAISS index created successfully');
      } catch (faissError) {
        Logger.warn(`FAISS initialization failed, using enhanced keyword search: ${faissError.message}`);
        this.faissIndex = null;
        return; // Exit early if FAISS fails
      }
      
      // Create text chunks from optimized data
      this.createOptimizedTextChunks();
      
      // Generate embeddings
      await this.generateEmbeddings();
      
      Logger.success(`FAISS initialized: ${this.textChunks.length} chunks indexed`);
    } catch (error) {
      Logger.error('FAISS initialization failed', error);
      this.faissIndex = null;
    }
  }

  // Create text chunks from FAISS-optimized data
  createOptimizedTextChunks() {
    if (!this.faissOptimizedData || !this.faissOptimizedData.chunks) return;
    
    this.textChunks = [];
    
    // Process each optimized chunk
    // CRITICAL: data-refresh.js creates both content and text fields - use both
    this.faissOptimizedData.chunks.forEach(chunk => {
      this.textChunks.push({
        id: chunk.id,
        text: chunk.text || chunk.content || '', // Use both content and text for compatibility
        section: chunk.section,
        type: chunk.type,
        category: chunk.category, // CRITICAL: Include category field
        keywords: chunk.keywords || [],
        metadata: chunk.entities || chunk.metadata || {},
        originalChunk: chunk
      });
    });
    
    Logger.debug(`Created ${this.textChunks.length} text chunks for FAISS indexing`);
  }

  // Generate embeddings using transformer model
  async generateEmbeddings() {
    Logger.info('Generating transformer-based embeddings...');
    
    this.embeddings = [];
    
    for (let i = 0; i < this.textChunks.length; i++) {
      const chunk = this.textChunks[i];
      
      // Generate embedding using transformer model or fallback
      const embedding = await this.createTransformerEmbedding(chunk);
      
      this.embeddings.push(embedding);
      
      // Add to FAISS index (with error handling)
      try {
      this.faissIndex.add(embedding);
      } catch (addError) {
        Logger.debug(`Failed to add embedding ${i} to FAISS index: ${addError.message}`);
        // Continue with other embeddings
      }
      
      // Progress indicator for large datasets
      if ((i + 1) % 20 === 0) {
        Logger.debug(`Progress: ${i + 1}/${this.textChunks.length} embeddings generated`);
      }
    }
    
    Logger.success(`Generated ${this.embeddings.length} transformer-based embeddings`);
  }

  // Create transformer-based embedding
  async createTransformerEmbedding(chunk) {
    if (this.modelLoaded && this.embeddingModel) {
      try {
        // IMPROVED: Better text combination for date/schedule queries
        let text = chunk.text;
        const keywords = (chunk.keywords || []).join(' ');
        
        // Extract and normalize dates in text for better semantic matching
        // This helps match "January 15" with "Jan 15" or "1/15"
        if (chunk.metadata && (chunk.metadata.date || chunk.metadata.startDate)) {
          const date = chunk.metadata.date || chunk.metadata.startDate;
          try {
            const dateObj = new Date(date);
            // Add multiple date formats to improve matching (using timezone-aware formatting)
            const dateFormats = [
              formatDateInTimezone(dateObj, { year: 'numeric', month: 'long', day: 'numeric' }),
              formatDateInTimezone(dateObj, { year: 'numeric', month: 'short', day: 'numeric' }),
              formatDateInTimezone(dateObj, { month: 'long', day: 'numeric' }),
              formatDateInTimezone(dateObj, { month: 'short', day: 'numeric' })
            ].filter(Boolean);
            if (dateFormats.length > 0) {
              text = `${text} ${dateFormats.join(' ')}`;
            }
          } catch (e) {
            // Date parsing failed, continue with original text
          }
        }
        
        const combinedText = `${text} ${keywords}`.trim();
        
        // Generate embedding using transformer
        const output = await this.embeddingModel(combinedText, { 
          pooling: 'mean',
          normalize: true
        });
        
        // Convert to Float32Array for FAISS
        const embedding = Array.from(output.data);
        
        return embedding;
      } catch (error) {
        Logger.debug(`Transformer embedding failed, using fallback: ${error.message}`);
        return this.createFallbackEmbedding(chunk);
      }
    } else {
      // Use fallback if model not loaded
      return this.createFallbackEmbedding(chunk);
    }
  }

  // Fallback embedding method (improved TF-IDF-like approach)
  createFallbackEmbedding(chunk) {
    const text = chunk.text.toLowerCase();
    const keywords = (chunk.keywords || []).join(' ').toLowerCase();
    const metadata = JSON.stringify(chunk.metadata || {}).toLowerCase();
    
    // Combine all text sources
    const combinedText = `${text} ${keywords} ${metadata}`;
    const words = combinedText.split(/\s+/);
    const embedding = new Array(this.embeddingDimension).fill(0);
    
    // Enhanced word frequency approach with keyword weighting
    const wordFreq = {};
    words.forEach(word => {
      if (word.length > 2) { // Filter short words
      wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    // Weight keywords higher
    (chunk.keywords || []).forEach(keyword => {
      const normalizedKeyword = keyword.toLowerCase();
      wordFreq[normalizedKeyword] = (wordFreq[normalizedKeyword] || 0) + 3; // 3x weight for keywords
    });
    
    // Convert to vector (simplified)
    let index = 0;
    Object.entries(wordFreq).forEach(([word, freq]) => {
      const hash = this.simpleHash(word) % this.embeddingDimension;
      embedding[hash] += freq;
      index++;
    });
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      return embedding.map(val => val / norm);
    }
    
    return embedding;
  }

  // Simple hash function
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // DEPRECATED: These methods are now handled by VectorSearchService
  // Keeping as thin wrappers for backward compatibility
  async findRelevantDataFAISS(query, maxResults = 5) {
    if (!this.vectorSearchService) {
      this.vectorSearchService = new VectorSearchService(
        this.mongoService,
        this.faissOptimizedData,
        this.faissIndex,
        this.textChunks,
        this.embeddingModel,
        this.modelLoaded
      );
    }
    return await this.vectorSearchService.searchFAISS(query, maxResults);
  }

  async findRelevantDataMongoDB(query, maxResults = 5) {
    if (!this.vectorSearchService) {
      this.vectorSearchService = new VectorSearchService(
        this.mongoService,
        this.faissOptimizedData,
        this.faissIndex,
        this.textChunks,
        this.embeddingModel,
        this.modelLoaded
      );
    }
    return await this.vectorSearchService.searchMongoDB(query, maxResults);
  }

  async findRelevantDataKeyword(query, maxResults = 5) {
    if (!this.vectorSearchService) {
      this.vectorSearchService = new VectorSearchService(
        this.mongoService,
        this.faissOptimizedData,
        this.faissIndex,
        this.textChunks,
        this.embeddingModel,
        this.modelLoaded
      );
    }
    return await this.vectorSearchService.searchKeyword(query, maxResults);
  }

  // Get context for specific topics using optimized chunking
  // SIMPLIFIED: Now uses VectorSearchService for all retrieval
  async getContextForTopic(query, maxTokens = 500, maxSections = 10, suggestMore = false, scheduleService = null, userType = null) {
    // Debug: Verify we have optimized data
    if (!this.faissOptimizedData || !this.faissOptimizedData.chunks) {
      Logger.warn('RAG: No optimized data available');
      return '[NO KNOWLEDGE BASE DATA AVAILABLE]';
    }
    
    // Ensure VectorSearchService is initialized
    if (!this.vectorSearchService) {
      this.vectorSearchService = new VectorSearchService(
        this.mongoService,
        this.faissOptimizedData,
        this.faissIndex,
        this.textChunks,
        this.embeddingModel,
        this.modelLoaded
      );
    }
    
    // Update VectorSearchService with latest data (in case of sync)
    this.vectorSearchService.faissOptimizedData = this.faissOptimizedData;
    this.vectorSearchService.faissIndex = this.faissIndex;
    this.vectorSearchService.textChunks = this.textChunks;
    
    // Correct typos in query before processing
    let correctedQuery = query;
    try {
      const typoCorrection = TypoCorrector.correctTypos(query, {
        maxDistance: 2,
        minSimilarity: 0.6,
        correctPhrases: true
      });
      
      if (typoCorrection.hasCorrections) {
        Logger.debug(`🔤 RAG Context Typo correction: "${typoCorrection.original}" → "${typoCorrection.corrected}"`);
        correctedQuery = typoCorrection.corrected;
      }
    } catch (error) {
      Logger.debug(`Typo correction failed in getContextForTopic: ${error.message}`);
    }
    
    // NO CACHING - Always fetch fresh data for accuracy
    
    // Use corrected query for all subsequent processing
    query = correctedQuery;
    
    // Query type detection (consolidated)
    // Unified schedule queries - all calendar, events, announcements use schedule collection
    const isScheduleQuery = this._detectCalendarQuery(query);
    
    // Check if this is a comprehensive query that needs ALL related chunks
    const comprehensiveKeywords = [
      'core values', 'mission', 'missions', 'mandate', 'objectives',
      'graduate outcomes', 'quality commitments', 'president', 'vice president', 'vice presidents',
      'leadership', 'chancellor', 'board', 'governance', 'administration',
      'history', 'faculties', 'faculty', 'programs', 'programme', 'enrollment', 
      'campuses', 'campus', 'deans', 'dean', 'directors', 'director',
      'events', 'schedules', 'calendar', 'announcements', 'dates', 'deadlines'
    ];
    
    // Check for plural keywords (indicates user wants ALL items)
    const pluralKeywords = [
      'faculties', 'programs', 'courses', 'deans', 'directors', 'campuses',
      'values', 'missions', 'objectives', 'commitments', 'outcomes',
      'events', 'schedules', 'announcements', 'dates', 'deadlines',
      'presidents', 'vice presidents', 'chancellors', 'executives'
    ];
    
    const hasPluralKeyword = pluralKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );
    
    const isComprehensive = comprehensiveKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    ) || hasPluralKeyword;
    
    // Check for "list all" or "what are the" patterns
    const listingPatterns = /\b(list|all|every|show\s+all|what\s+are\s+the|enumerate)\b/i;
    const isListingQuery = listingPatterns.test(query);
    
    // Check for basic "what is" queries
    const isBasicQuery = /^(what is|what's|tell me about)\s+(dorsu|davao oriental state university)/i.test(query.trim());
    
    // Check for vision/mission queries - these need EXACT data retrieval
    const isVisionMissionQuery = /\b(vision|mission|mandate|core values|graduate outcomes|quality policy)\b/i.test(query);
    
    // ===== COMPREHENSIVE QUERY TYPE DETECTION =====
    // Based on ALL data structures in dorsu_data.json
    
    // Use consolidated query type detection helper
    const queryTypes = this._detectAllQueryTypes(query);
    const {
      isHistoryQuery,
      isLeadershipQuery,
      isSUASTQuery,
      isAdmissionRequirementsQuery,
      isEnrollmentQuery,
      isFacultyQuery,
      isProgramQuery,
      isCampusQuery,
      isOfficeQuery,
      isStudentOrgQuery,
      isValuesQuery,
      isLibraryQuery
    } = queryTypes;
    
    // SUAST/Statistics queries
    
    // Enrollment queries
    
    // Faculty queries
    
    // Program queries
    
    // Campus queries
    
    // Office queries (general)
    /\b(usc|university student council|ang sidlakan|catalyst|student organization|student organizations|student publication|yearbook)\b/i.test(query);
    
    // Values/Outcomes queries
    
    // Library queries
    
    // Debug logging for leadership query detection
    if (isLeadershipQuery) {
      Logger.debug(`🔍 Leadership pattern detected in query: "${query.substring(0, 50)}..."`);
    }
    
    // Check for office head queries (who is the head of [office/acronym])
    const officeHeadPattern = /\b(who\s+(is|are)\s+(the\s+)?(head|director|chief|manager|officer)\s+(of|in)?|head\s+of|director\s+of|chief\s+of|manager\s+of)\b/i;
    const officeAcronymPattern = /\b(OSPAT|OSA|OSCD|FASG|PESO|IRO|HSU|CGAD|IP-TBM|GCTC)\b/i;
    const officeNamePattern = /\b(office|offices|unit|units)\s+(of|for|in)?\s+[a-z\s]+(office|unit|services|affairs|program|programs)\b/i;
    const hasOfficeHeadPattern = officeHeadPattern.test(query);
    const hasOfficeAcronym = officeAcronymPattern.test(query);
    const hasOfficeName = officeNamePattern.test(query);
    const hasOfficeWord = /\boffice\b/i.test(query);
    const isOfficeHeadQuery = hasOfficeHeadPattern && (hasOfficeAcronym || hasOfficeName || hasOfficeWord);
    
    // Debug logging for office head query detection
    if (hasOfficeHeadPattern) {
      Logger.debug(`🔍 Office head pattern detected in query: "${query.substring(0, 50)}..."`);
      Logger.debug(`   hasOfficeAcronym: ${hasOfficeAcronym}, hasOfficeName: ${hasOfficeName}, hasOfficeWord: ${hasOfficeWord}`);
      Logger.debug(`   isOfficeHeadQuery: ${isOfficeHeadQuery}`);
    }
    
    // SIMPLIFIED: Use VectorSearchService for ALL retrieval
    // Determine query type for VectorSearchService
    let queryType = null;
    if (isHistoryQuery) queryType = 'history';
    // CRITICAL: Dean queries MUST be checked BEFORE leadership to avoid misrouting
    // "dean|deans" is included in isLeadershipQuery pattern, so this must come first
    else if (/\b(dean|deans|who\s+(is|are)\s+the\s+dean|dean\s+of)\b/i.test(query)) queryType = 'deans';
    else if (isLeadershipQuery || isOfficeHeadQuery) {
      if (isOfficeHeadQuery) queryType = 'office';
      else queryType = 'leadership';
    }
    else if (isStudentOrgQuery) queryType = 'student_org';
    // CRITICAL: Values/Outcomes queries MUST be checked BEFORE programs - "graduate" matches programs pattern
    // Values/Outcomes queries (must be checked before comprehensive - "values" is in comprehensive pattern)
    else if (/\b(core\s+values?|values?\s+of|graduate\s+outcomes?|outcomes?|quality\s+policy|mandate|charter)\b/i.test(query)) queryType = 'values';
    else if (isProgramQuery) queryType = 'programs';
    else if (isFacultyQuery) queryType = 'faculties';
    else if (isAdmissionRequirementsQuery) queryType = 'admission_requirements';
    // Hymn/Anthem queries (must be checked before comprehensive/general)
    else if (/\b(hymn|anthem|university\s+hymn|university\s+anthem|dorsu\s+hymn|dorsu\s+anthem|lyrics|song|composer)\b/i.test(query)) queryType = 'hymn';
    // Vision/Mission queries (must be checked before comprehensive/general)
    else if (/\b(vision|mission|what\s+is\s+.*\s+(vision|mission)|dorsu.*\s+(vision|mission)|university.*\s+(vision|mission))\b/i.test(query)) queryType = 'vision_mission';
    // Schedule/Calendar queries (must be checked before comprehensive/general)
    else if (isScheduleQuery) queryType = 'schedule';
    else if (isComprehensive || isListingQuery || hasPluralKeyword) queryType = 'comprehensive';
    
    // For admission requirements queries, increase maxResults to get all requirement chunks
    const adjustedMaxResults = isAdmissionRequirementsQuery ? maxSections * 5 : maxSections * 3;
    
    // Get relevant data using VectorSearchService
    let relevantData = [];
    try {
      relevantData = await this.vectorSearchService.search(query, {
        maxResults: adjustedMaxResults, // Get more for admission requirements to ensure all student categories are included
        maxSections: maxSections,
        queryType: queryType,
        userType
      });
      
      Logger.debug(`✅ VectorSearchService returned ${relevantData.length} chunks for query type: ${queryType || 'general'}`);
      
      // For admission requirements, prioritize chunks with type 'admission_requirements'
      if (isAdmissionRequirementsQuery && relevantData.length > 0) {
        const requirementsChunks = relevantData.filter(chunk => 
          chunk.type === 'admission_requirements' || 
          chunk.category?.includes('requirements') ||
          chunk.text?.toLowerCase().includes('requirements')
        );
        const otherChunks = relevantData.filter(chunk => 
          chunk.type !== 'admission_requirements' && 
          !chunk.category?.includes('requirements') &&
          !chunk.text?.toLowerCase().includes('requirements')
        );
        // Prioritize requirements chunks
        relevantData = [...requirementsChunks, ...otherChunks].slice(0, maxSections);
        Logger.debug(`📋 Admission requirements: Found ${requirementsChunks.length} requirements chunks, ${otherChunks.length} other chunks`);
      }
    } catch (error) {
      Logger.error(`VectorSearchService failed: ${error.message}`);
      relevantData = [];
    }
    
    // Handle vision/mission queries separately (if needed) - use VectorSearchService
    if (isVisionMissionQuery && relevantData.length === 0) {
      Logger.debug(`VISION/MISSION QUERY: Trying comprehensive search for "${query.substring(0, 40)}..."`);
      try {
        relevantData = await this.vectorSearchService.search(query, {
          maxResults: maxSections * 2,
          maxSections: maxSections,
          queryType: 'comprehensive',
          userType
        });
      } catch (error) {
        Logger.debug(`Vision/mission search failed: ${error.message}`);
      }
    }
    
    // Ensure we have data before proceeding
    if (!relevantData || relevantData.length === 0) {
      Logger.warn('RAG: No relevant data found');
      return '[NO KNOWLEDGE BASE DATA AVAILABLE]';
    }
    
    // NOTE: All search/retrieval logic is now handled by VectorSearchService above
    // The old search logic (history, leadership, office, comprehensive, etc.) has been moved to vector-search.js
    // This keeps rag.js focused on response generation and context building
    
    // Calendar event handling (if needed)
    // All search logic has been moved to VectorSearchService - see vector-search.js
    // The old search code has been removed - VectorSearchService handles all retrieval
    
    // For schedule queries, also fetch and include schedule events
    let scheduleEventsData = [];
    if (isScheduleQuery && scheduleService && this.mongoService) {
      try {
        // IMPROVED: Extract month/year/semester from query for better filtering
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                           'july', 'august', 'september', 'october', 'november', 'december'];
        const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        let requestedMonth = null;
        let requestedYear = null;
        let requestedSemester = null;
        
        const queryLower = query.toLowerCase();
        
        // Extract year (4 digits)
        const yearMatch = queryLower.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          requestedYear = parseInt(yearMatch[1], 10);
        }
        
        // Extract month
        monthNames.forEach((month, index) => {
          if (queryLower.includes(month)) {
            requestedMonth = index; // 0-11
          }
        });
        if (requestedMonth === null) {
          monthAbbr.forEach((month, index) => {
            if (queryLower.includes(month)) {
              requestedMonth = index; // 0-11
            }
          });
        }
        
        // Extract semester: 1 (1st semester), 2 (2nd semester), or "Off" (off semester)
        const semesterPatterns = [
          { pattern: /\b(1st|first)\s+semester\b/i, value: 1 },
          { pattern: /\b(2nd|second)\s+semester\b/i, value: 2 },
          { pattern: /\boff\s+semester\b/i, value: 'Off' },
          { pattern: /\bsemester\s+1\b|\bsemester\s+one\b/i, value: 1 },
          { pattern: /\bsemester\s+2\b|\bsemester\s+two\b/i, value: 2 },
          { pattern: /\b1\s+sem\b|\bfirst\s+sem\b/i, value: 1 },
          { pattern: /\b2\s+sem\b|\bsecond\s+sem\b/i, value: 2 }
        ];
        
        for (const { pattern, value } of semesterPatterns) {
          if (pattern.test(queryLower)) {
            requestedSemester = value;
            Logger.debug(`📅 Detected semester from query: ${value}`);
            break;
          }
        }
        
        // Calculate date range based on query
        const now = new Date();
        let startDate = new Date(now);
        let endDate = new Date(now);
        
        if (requestedMonth !== null && requestedYear) {
          // User specified month and year - filter to that month
          startDate = new Date(requestedYear, requestedMonth, 1);
          endDate = new Date(requestedYear, requestedMonth + 1, 0, 23, 59, 59); // Last day of month
          Logger.debug(`📅 Filtering calendar events to ${monthNames[requestedMonth]} ${requestedYear}`);
        } else if (requestedYear) {
          // User specified year only - filter to that year
          startDate = new Date(requestedYear, 0, 1);
          endDate = new Date(requestedYear, 11, 31, 23, 59, 59);
          Logger.debug(`📅 Filtering calendar events to year ${requestedYear}`);
        } else {
          // Default: Past 30 days to future 365 days
          startDate.setDate(startDate.getDate() - 30);
          endDate.setDate(endDate.getDate() + 365);
        }
        
        // Check if schedule events are already in relevantData from vector search
        const matchesUserTypeForEvent = (eventUserType) => {
          if (!userType || userType === 'faculty') {
            return true;
          }
          const normalized = (eventUserType || 'all').toString().toLowerCase();
          if (!normalized || normalized === 'all') {
            return true;
          }
          return normalized === userType.toLowerCase();
        };

        let scheduleEventsFromVectorSearch = relevantData
          .filter(item => item.section === 'schedule_events')
          .filter(event => matchesUserTypeForEvent(event.metadata?.userType || event.userType));
        
        Logger.debug(`📅 RAG: Already have ${scheduleEventsFromVectorSearch.length} schedule events from vector search`);
        
        // Extract exam type from query for filtering
        // Improved patterns to catch more variations (e.g., "prelim exam schedule", "preliminary examination", "prelim exam", "final and prelim")
        // Check if query contains exam type keywords - if multiple types are mentioned, treat as multiple exam query
        const hasPrelim = /\b(prelim|preliminary|prelims?)\b/i.test(query);
        const hasMidterm = /\b(midterm|mid-term|mid\s+term)\b/i.test(query);
        const hasFinal = /\b(final|finals?)\b/i.test(query);
        const hasExam = /\b(exam|examination|exams?)\b/i.test(query);
        const hasSchedule = /\b(schedule|schedules?|date|dates?|when)\b/i.test(query);
        
        // Count how many exam types are mentioned
        const examTypesCount = [hasPrelim, hasMidterm, hasFinal].filter(Boolean).length;
        const isMultipleExamQuery = examTypesCount > 1;
        
        // If query mentions exam/schedule keywords OR mentions multiple exam types, treat as exam query
        // This handles cases like "final and prelim" even without "exam" keyword
        const hasExamContext = hasExam || hasSchedule || isMultipleExamQuery;
        
        // For prelim: must have "prelim/preliminary" AND exam context
        const isPrelimQuery = hasPrelim && hasExamContext;
        // For midterm: must have "midterm" AND exam context
        const isMidtermQuery = hasMidterm && hasExamContext;
        // For final: must have "final" AND exam context
        const isFinalQuery = hasFinal && hasExamContext;
        const isExamQuery = hasExam;
        
        Logger.debug(`📅 Exam query detection: hasPrelim=${hasPrelim}, hasMidterm=${hasMidterm}, hasFinal=${hasFinal}, hasExam=${hasExam}, hasSchedule=${hasSchedule}`);
        Logger.debug(`📅 Exam query detection: examTypesCount=${examTypesCount}, isMultipleExamQuery=${isMultipleExamQuery}, hasExamContext=${hasExamContext}`);
        Logger.debug(`📅 Exam query detection: prelim=${isPrelimQuery}, midterm=${isMidtermQuery}, final=${isFinalQuery}, exam=${isExamQuery}`);
        
        // Filter vector search results for exam type if this is an exam-specific query
        // Support multiple exam types (e.g., "final and prelim")
        if (isPrelimQuery || isMidtermQuery || isFinalQuery) {
          const filteredFromVector = scheduleEventsFromVectorSearch.filter(event => {
            const titleLower = (event.metadata?.title || event.text || '').toLowerCase();
            // Use OR logic to match ANY of the requested exam types
            let matches = false;
            if (isPrelimQuery) matches = matches || titleLower.includes('prelim') || titleLower.includes('preliminary');
            if (isMidtermQuery) matches = matches || titleLower.includes('midterm');
            if (isFinalQuery) matches = matches || titleLower.includes('final');
            return matches;
          });
          
          const requestedTypes = [];
          if (isPrelimQuery) requestedTypes.push('prelim');
          if (isMidtermQuery) requestedTypes.push('midterm');
          if (isFinalQuery) requestedTypes.push('final');
          const examTypesStr = requestedTypes.join(' + ');
          
          Logger.debug(`📅 RAG: Filtered vector search results from ${scheduleEventsFromVectorSearch.length} to ${filteredFromVector.length} ${examTypesStr} exam events`);
          
          if (filteredFromVector.length > 0) {
            scheduleEventsFromVectorSearch = filteredFromVector;
            // Remove unfiltered schedule events from relevantData and add filtered ones
            const otherData = relevantData.filter(item => item.section !== 'schedule_events');
            relevantData = [...scheduleEventsFromVectorSearch, ...otherData];
          }
        }
        
        let events = [];
        
        // Only fetch from scheduleService if we don't have enough exam-filtered schedule events from vector search
        // For exam queries, always try to fetch directly to ensure we get the best results (even if vector search had some)
        if (scheduleEventsFromVectorSearch.length < 3 || (isPrelimQuery || isMidtermQuery || isFinalQuery)) {
          // Log schedule fetch operation
          Logger.logDataFetch('fetchScheduleEvents', query, {
            method: 'scheduleService.getEvents',
            filters: {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              semester: requestedSemester,
              requestedMonth,
              requestedYear,
              limit: 100,
              examFilter: isPrelimQuery ? 'prelim' : isMidtermQuery ? 'midterm' : isFinalQuery ? 'final' : null
            }
          });

          // For multiple exam types, don't use MongoDB examType filter (it only supports one type)
          // Instead, fetch all events and filter JavaScript-side for ALL requested types
          let examTypeForQuery = null;
          const requestedExamTypes = [];
          if (isPrelimQuery) requestedExamTypes.push('prelim');
          if (isMidtermQuery) requestedExamTypes.push('midterm');
          if (isFinalQuery) requestedExamTypes.push('final');
          
          // Only use MongoDB filter if exactly ONE exam type is requested
          if (requestedExamTypes.length === 1) {
            examTypeForQuery = requestedExamTypes[0];
          }
          // If multiple exam types, fetch without examType filter and filter JavaScript-side
          
          events = await scheduleService.getEvents({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            semester: requestedSemester, // Pass semester filter
            limit: 100,
            examType: examTypeForQuery, // Only set if single exam type, null for multiple types
            enableLogging: true, // Enable logging for RAG/AI queries
            userType
          });
          
          const examTypesStr = requestedExamTypes.length > 0 ? requestedExamTypes.join(' + ') : 'none';
          Logger.debug(`📅 RAG: Fetched ${events.length} schedule events from scheduleService${examTypeForQuery ? ` (MongoDB filtered for ${examTypeForQuery})` : ` (requested: ${examTypesStr}, will filter JS-side)`}`);
          
          // Additional JavaScript filtering for exam type - support multiple exam types with OR logic
          if (isPrelimQuery || isMidtermQuery || isFinalQuery) {
            const beforeCount = events.length;
            events = events.filter(event => {
              const titleLower = (event.title || '').toLowerCase();
              // Use OR logic: match ANY of the requested exam types
              let matches = false;
              if (isPrelimQuery) matches = matches || titleLower.includes('prelim') || titleLower.includes('preliminary');
              if (isMidtermQuery) matches = matches || titleLower.includes('midterm');
              if (isFinalQuery) matches = matches || titleLower.includes('final');
              return matches;
            });
            if (events.length !== beforeCount) {
              Logger.debug(`📅 RAG: Additional filtering reduced results from ${beforeCount} to ${events.length} ${examTypesStr} exam events`);
            }
          }
        } else {
          Logger.debug(`📅 RAG: Using ${scheduleEventsFromVectorSearch.length} schedule events from vector search, skipping direct fetch`);
        }
        
        // Additional filtering: For date ranges, check if query month/year falls within the range
        let filteredEvents = events;
        if (events && events.length > 0) {
          const initialCount = filteredEvents.length;
          filteredEvents = filteredEvents.filter(event => matchesUserTypeForEvent(event.userType));
          if (filteredEvents.length !== initialCount) {
            Logger.debug(`📅 RAG: Filtered schedule events by userType (${userType || 'all'}) from ${initialCount} to ${filteredEvents.length}`);
          }
        }
        if (requestedMonth !== null && requestedYear) {
          const beforeMonthFilter = filteredEvents.length;
          filteredEvents = filteredEvents.filter(event => {
            // For date ranges, check if the requested month/year overlaps with the range
            if (event.dateType === 'date_range' && event.startDate && event.endDate) {
              const rangeStart = new Date(event.startDate);
              const rangeEnd = new Date(event.endDate);
              const queryStart = new Date(requestedYear, requestedMonth, 1);
              const queryEnd = new Date(requestedYear, requestedMonth + 1, 0, 23, 59, 59);
              
              // Check if ranges overlap
              return (rangeStart <= queryEnd && rangeEnd >= queryStart);
            } else {
              // For single dates, check if it's in the requested month/year
              const eventDate = new Date(event.isoDate || event.date);
              return eventDate.getMonth() === requestedMonth && eventDate.getFullYear() === requestedYear;
            }
          });
          Logger.debug(`📅 Filtered ${beforeMonthFilter} events to ${filteredEvents.length} events for ${monthNames[requestedMonth]} ${requestedYear}`);
        }
        
        if (filteredEvents && filteredEvents.length > 0) {
          // Convert schedule events to RAG format chunks
          scheduleEventsData = filteredEvents.map((event, idx) => {
            const eventDate = event.isoDate || event.date;
            const dateStr = eventDate ? formatDateInTimezone(
              new Date(eventDate),
              { year: 'numeric', month: 'long', day: 'numeric' }
            ) || 'Date TBD' : 'Date TBD';
            
            // Create searchable text from event
            let eventText = `${event.title || 'Untitled Event'}. `;
            if (event.description) eventText += `${event.description}. `;
            eventText += `Date: ${dateStr}. `;
            if (event.time) eventText += `Time: ${event.time}. `;
            if (event.category) eventText += `Category: ${event.category}. `;
            // Include semester information in event text for better searchability
            if (event.semester) {
              const semesterText = event.semester === 1 ? '1st Semester' : 
                                   event.semester === 2 ? '2nd Semester' : 
                                   event.semester === 'Off' ? 'Off Semester' : 
                                   `Semester ${event.semester}`;
              eventText += `Semester: ${semesterText}. `;
            }
            if (event.dateType === 'date_range' && event.startDate && event.endDate) {
              const start = formatDateInTimezone(new Date(event.startDate), { year: 'numeric', month: 'long', day: 'numeric' });
              const end = formatDateInTimezone(new Date(event.endDate), { year: 'numeric', month: 'long', day: 'numeric' });
              if (start && end) {
                eventText += `Date Range: ${start} to ${end}. `;
              }
            }
            
            // Extract keywords from event
            const keywords = [];
            if (event.title) keywords.push(...event.title.toLowerCase().split(/\s+/).filter(w => w.length > 3));
            if (event.category) keywords.push(event.category.toLowerCase());
            // Add semester to keywords for better matching
            if (event.semester) {
              if (event.semester === 1) keywords.push('1st', 'first', 'semester');
              else if (event.semester === 2) keywords.push('2nd', 'second', 'semester');
              else if (event.semester === 'Off') keywords.push('off', 'semester');
            }
            if (event.description) {
              const descWords = event.description.toLowerCase().split(/\s+/).filter(w => w.length > 4);
              keywords.push(...descWords.slice(0, 5)); // Top 5 words from description
            }
            
            return {
              id: `schedule-${event._id || event.id || idx}`,
              section: 'schedule_events',
              type: 'schedule_event',
              text: eventText.trim(),
              score: 100, // High score for calendar events in calendar queries
              metadata: {
                title: event.title,
                date: eventDate,
                time: event.time,
                category: event.category,
                description: event.description,
                dateType: event.dateType,
                startDate: event.startDate,
                endDate: event.endDate,
                semester: event.semester, // Include semester in metadata
                userType: event.userType || 'all'
              },
              keywords: [...new Set(keywords)], // Remove duplicates
              source: 'schedule_database'
            };
          });
          
          // Log converted schedule events
          Logger.logRetrievedChunks(query, scheduleEventsData, {
            source: 'rag_schedule_events',
            maxChunks: 30,
            showFullContent: false
          });
          
          // Merge schedule events with RAG results, but avoid duplicates
          // CRITICAL: For exam-specific queries, only use filtered events - never merge unfiltered vector search results
          const otherData = relevantData.filter(item => item.section !== 'schedule_events');
          
          if (isPrelimQuery || isMidtermQuery || isFinalQuery) {
            // For exam queries, ONLY use the directly fetched and filtered events
            // Support multiple exam types with OR logic
            const filteredVectorEvents = scheduleEventsFromVectorSearch.filter(event => {
              const titleLower = (event.metadata?.title || event.text || '').toLowerCase();
              // Use OR logic: match ANY of the requested exam types
              let matches = false;
              if (isPrelimQuery) matches = matches || titleLower.includes('prelim') || titleLower.includes('preliminary');
              if (isMidtermQuery) matches = matches || titleLower.includes('midterm');
              if (isFinalQuery) matches = matches || titleLower.includes('final');
              return matches;
            });
            
            const requestedTypes = [];
            if (isPrelimQuery) requestedTypes.push('prelim');
            if (isMidtermQuery) requestedTypes.push('midterm');
            if (isFinalQuery) requestedTypes.push('final');
            const examTypesStr = requestedTypes.join(' + ');
            
            // Merge: filtered direct fetch events first, then filtered vector search events (if any), then other data
            relevantData = [...scheduleEventsData, ...filteredVectorEvents, ...otherData];
            Logger.debug(`📅 RAG: For ${examTypesStr} exam query, merged ${scheduleEventsData.length} direct + ${filteredVectorEvents.length} filtered vector events`);
          } else if (scheduleEventsFromVectorSearch.length > 0) {
            // For non-exam queries, merge normally
            if (isScheduleQuery) {
              // For schedule queries, prioritize directly fetched/filtered events
              relevantData = [...scheduleEventsData, ...scheduleEventsFromVectorSearch, ...otherData];
            } else {
              // For other queries, keep vector search results first
              relevantData = [...scheduleEventsFromVectorSearch, ...scheduleEventsData, ...otherData];
            }
          } else {
            // No schedule events from vector search, just merge directly fetched ones
            if (isScheduleQuery) {
              relevantData = [...scheduleEventsData, ...otherData];
            } else {
              relevantData = [...otherData, ...scheduleEventsData];
            }
          }
          
          Logger.debug(`RAG: Added ${scheduleEventsData.length} schedule events to context (total schedule events: ${relevantData.filter(item => item.section === 'schedule_events').length})`);
          Logger.logDataFetch('ragScheduleEventsAdded', query, {
            method: 'rag_context_merge',
            chunksAdded: scheduleEventsData.length,
            totalScheduleEvents: relevantData.filter(item => item.section === 'schedule_events').length,
            totalRelevantData: relevantData.length
          });
        } else if (scheduleEventsFromVectorSearch.length > 0 && !(isPrelimQuery || isMidtermQuery || isFinalQuery)) {
          // If we didn't fetch directly but have vector search results, use them
          // BUT: For exam-specific queries, never use unfiltered vector search results
          // If filtered results are empty, it means no exam events were found
          Logger.debug(`RAG: Using ${scheduleEventsFromVectorSearch.length} schedule events from vector search only`);
          Logger.logDataFetch('ragScheduleEventsFromVectorSearch', query, {
            method: 'vector_search_only',
            chunksAdded: scheduleEventsFromVectorSearch.length,
            totalRelevantData: relevantData.length
          });
        } else if (isPrelimQuery || isMidtermQuery || isFinalQuery) {
          // For exam queries with no results, remove unfiltered schedule events from relevantData
          // Support multiple exam types with OR logic
          const requestedTypes = [];
          if (isPrelimQuery) requestedTypes.push('prelim');
          if (isMidtermQuery) requestedTypes.push('midterm');
          if (isFinalQuery) requestedTypes.push('final');
          const examTypesStr = requestedTypes.join(' + ');
          Logger.debug(`📅 RAG: No ${examTypesStr} exam events found. Removing unfiltered schedule events from results.`);
          
          // Remove unfiltered schedule events that don't match ANY of the requested exam types
          relevantData = relevantData.filter(item => {
            if (item.section !== 'schedule_events') return true;
            const titleLower = (item.metadata?.title || item.text || '').toLowerCase();
            // Use OR logic: match ANY of the requested exam types
            let matches = false;
            if (isPrelimQuery) matches = matches || titleLower.includes('prelim') || titleLower.includes('preliminary');
            if (isMidtermQuery) matches = matches || titleLower.includes('midterm');
            if (isFinalQuery) matches = matches || titleLower.includes('final');
            return matches;
          });
          
          Logger.logDataFetch('ragExamQueryNoResults', query, {
            method: 'exam_filter_removed',
            examTypes: examTypesStr,
            remainingEvents: relevantData.filter(item => item.section === 'schedule_events').length,
            totalRelevantData: relevantData.length
          });
        }
      } catch (scheduleError) {
        Logger.error('RAG: Error fetching schedule events', scheduleError);
        // Continue without schedule data if there's an error
      }
    }
    
    // Final check: ensure we have data
    if (!relevantData || relevantData.length === 0) {
      Logger.warn('RAG: No relevant data found after all searches');
      return '[NO KNOWLEDGE BASE DATA AVAILABLE]';
    }
    
    // Build context from retrieved data
    // For basic queries, use minimal context
    let context = '';
    let currentTokens = 0;
    
    // Only add basic info for basic queries
    if (isBasicQuery && !isComprehensive) {
      const basicInfo = `## DAVAO ORIENTAL STATE UNIVERSITY (DOrSU)
**Full Name:** Davao Oriental State University
**Type:** State-funded research-based coeducational higher education institution
**Location:** Mati City, Davao Oriental, Philippines
**Founded:** December 13, 1989

`;
      context = basicInfo;
      currentTokens = Math.round(basicInfo.length / 4);
    }
    
    // For comprehensive/listing queries, be more generous with tokens but still respect limits
    const shouldIncludeAll = isComprehensive || isListingQuery || hasPluralKeyword;
    
    // Smart token budget: Use the full maxTokens requested by server
    // Server already accounts for model limits (10K for program queries, 8K for USC, etc.)
    // No need to cap here - trust the server's calculation
    const effectiveMaxTokens = maxTokens; // Use requested tokens directly
    
    // Separate schedule events from other data for better formatting
    const scheduleEvents = relevantData.filter(item => item.section === 'schedule_events');
    const otherData = relevantData.filter(item => item.section !== 'schedule_events');
    
    // Add schedule events section first if present
    if (scheduleEvents.length > 0 && isScheduleQuery) {
      const scheduleHeader = `\n## SCHEDULE EVENTS AND ANNOUNCEMENTS\n\n`;
      context += scheduleHeader;
      currentTokens += Math.round(scheduleHeader.length / 4);
      
      // Helper function to format date concisely (e.g., "Jan 11" or "Jan 11 - Jan 15")
      const formatDateConcise = (date) => {
        if (!date) return 'Date TBD';
        const d = new Date(date);
        const month = formatDateInTimezone(d, { month: 'short' });
        const day = formatDateInTimezone(d, { day: 'numeric' });
        return month && day ? `${month} ${day}` : 'Date TBD';
      };
      
      // Group events by title to avoid redundancy
      const groupedEvents = new Map();
      scheduleEvents.forEach(event => {
        const title = event.metadata?.title || 'Untitled Event';
        if (!groupedEvents.has(title)) {
          groupedEvents.set(title, []);
        }
        groupedEvents.get(title).push(event);
      });
      
      // Format grouped events
      for (const [title, eventGroup] of groupedEvents) {
        // Sort events by date
        eventGroup.sort((a, b) => {
          const dateA = a.metadata?.date || a.metadata?.startDate || '';
          const dateB = b.metadata?.date || b.metadata?.startDate || '';
          return new Date(dateA) - new Date(dateB);
        });
        
        // Get unique properties from the group
        const firstEvent = eventGroup[0];
        const category = firstEvent.metadata?.category;
        const time = firstEvent.metadata?.time;
        const description = firstEvent.metadata?.description;
        const semester = firstEvent.metadata?.semester;
        
        let eventText = `**${title}**\n`;
        
        // Add semester information if available
        if (semester) {
          const semesterText = semester === 1 ? '1st Semester' : 
                               semester === 2 ? '2nd Semester' : 
                               semester === 'Off' ? 'Off Semester' : 
                               `Semester ${semester}`;
          eventText += `📚 Semester: ${semesterText}\n`;
        }
        
        // FIXED: Group events by their actual date range to prevent mixing different ranges
        // Each unique date range should be shown separately
        const dateRanges = new Map(); // Map to store unique date ranges
        
        eventGroup.forEach(event => {
          let rangeKey = '';
          let rangeDisplay = '';
          
          if (event.metadata?.dateType === 'date_range' && event.metadata.startDate && event.metadata.endDate) {
            // For date ranges, use startDate-endDate as key
            const start = formatDateConcise(event.metadata.startDate);
            const end = formatDateConcise(event.metadata.endDate);
            rangeKey = `${event.metadata.startDate}_${event.metadata.endDate}`;
            rangeDisplay = `${start} - ${end}`;
          } else if (event.metadata?.date) {
            // For single dates, use the date as key
            rangeKey = event.metadata.date;
            rangeDisplay = formatDateConcise(event.metadata.date);
          } else if (event.metadata?.startDate) {
            // Fallback to startDate
            rangeKey = event.metadata.startDate;
            rangeDisplay = formatDateConcise(event.metadata.startDate);
          }
          
          if (rangeKey && !dateRanges.has(rangeKey)) {
            dateRanges.set(rangeKey, rangeDisplay);
          }
        });
        
        if (dateRanges.size > 0) {
          const uniqueRanges = Array.from(dateRanges.values());
          
          // Determine year from first event
          const firstEvent = eventGroup[0];
          const year = firstEvent.metadata?.date 
            ? new Date(firstEvent.metadata.date).getFullYear()
            : firstEvent.metadata?.startDate 
              ? new Date(firstEvent.metadata.startDate).getFullYear()
              : new Date().getFullYear();
          
          if (uniqueRanges.length === 1) {
            eventText += `📅 Date: ${uniqueRanges[0]}, ${year}\n`;
          } else if (uniqueRanges.length <= 3) {
            eventText += `📅 Dates: ${uniqueRanges.join(', ')}, ${year}\n`;
          } else {
            // Too many ranges - list them separately
            eventText += `📅 Dates:\n`;
            uniqueRanges.forEach(range => {
              eventText += `   • ${range}, ${year}\n`;
            });
          }
        }
        
        if (time) eventText += `⏰ Time: ${time}\n`;
        if (category) eventText += `🏷️ Category: ${category}\n`;
        if (description) {
          const desc = description.length > 150 
            ? description.substring(0, 150) + '...' 
            : description;
          eventText += `📝 ${desc}\n`;
        }
        eventText += '\n';
        
        const eventTokens = Math.round(eventText.length / 4);
        if (currentTokens + eventTokens > effectiveMaxTokens) {
          break;
        }
        
        context += eventText;
        currentTokens += eventTokens;
      }
    }
    
    // Add other sections - prioritize completeness for comprehensive queries
    for (const item of otherData) {
      const sectionText = `## ${item.section} (${item.type})\n${item.text}\n\n`;
      const sectionTokens = Math.round(sectionText.length / 4);
      
      // Check if adding this chunk would exceed the effective limit
      if (currentTokens + sectionTokens > effectiveMaxTokens) {
        // For comprehensive queries, try to fit more but respect hard limit
        if (shouldIncludeAll && currentTokens < effectiveMaxTokens * 0.9) {
          // Add truncated version if we're not near the limit
          const remainingChars = (effectiveMaxTokens - currentTokens) * 4;
          if (remainingChars > 100) {
            context += sectionText.substring(0, remainingChars) + '...\n\n';
          }
        }
        break;
      }
      
      context += sectionText;
      currentTokens += sectionTokens;
    }
    
    // Log context size for comprehensive queries
    if (shouldIncludeAll) {
      Logger.debug(`Built comprehensive context: ${relevantData.length} chunks, ${currentTokens} tokens (~${Math.round(currentTokens * 1.3)} with overhead), ${context.length} chars`);
    }

    // Add suggestion for basic queries
    if (suggestMore && isBasicQuery && !isComprehensive) {
      context += `\n\n**Would you like to know more about:**
• DOrSU's history and founding
• Academic programs and faculties
• Leadership and organizational structure
• Core values and mission
• Campus locations and enrollment`;
    }

    // NO CACHING - Always return fresh results
    
    return context;
  }

  // Cache AI responses for common queries
  // IMPORTANT: Do NOT cache negative responses (e.g., "I don't have that information")
  // Only cache positive, informative responses to prevent caching incorrect "no data" answers
  async cacheAIResponse(query, response, complexity) {
    // NO-OP: Caching completely disabled for fresh data every time
    return;
  }

  // Get cached AI response - DISABLED
  async getCachedAIResponse(query) {
    // NO-OP: Always return null to force fresh fetch
    return null;
  }
  
  // Clear all AI response cache - DISABLED
  async clearAIResponseCache() {
    // NO-OP: No cache to clear
    Logger.info('Cache clearing skipped - caching is disabled');
    return 0;
  }

  // Sync with MongoDB to get latest uploaded data
  async syncWithMongoDB() {
    if (!this.mongoService) return;
    
    try {
      const now = Date.now();
      
      // Get all chunks from MongoDB
      const mongoChunks = await this.mongoService.getAllChunks();
      
      if (!mongoChunks || mongoChunks.length === 0) {
        Logger.warn('No chunks found in MongoDB');
        return; // No data in MongoDB
      }
      
      Logger.info(`Syncing with MongoDB: ${mongoChunks.length} total chunks`);
      
      // Convert ALL MongoDB chunks to RAG format (replace, not merge)
      // CRITICAL FIX: Include ALL chunks, not just those with embeddings
      // Chunks without embeddings will be handled by keyword search
      const allChunks = [];
      const chunksWithoutEmbeddings = [];
      
      for (const chunk of mongoChunks) {
        const chunkData = {
          id: chunk.id,
          text: chunk.content || chunk.text || '',
          section: chunk.section || chunk.topic || 'general',
          type: chunk.type || chunk.category || 'info',
          topic: chunk.topic,
          category: chunk.category || 'general',
          keywords: chunk.keywords || [],
          metadata: chunk.metadata || {},
          entities: chunk.entities || chunk.metadata || {},
          embedding: chunk.embedding
        };
        
        if (chunk.embedding) {
          allChunks.push(chunkData);
        } else {
          chunksWithoutEmbeddings.push(chunkData);
        }
      }
      
      // Log chunks without embeddings (they'll still be searchable via keyword search)
      if (chunksWithoutEmbeddings.length > 0) {
        Logger.warn(`⚠️  Found ${chunksWithoutEmbeddings.length} chunks without embeddings (will use keyword search only)`);
      }
      
      // CRITICAL FIX: Always update keyword search index, even if no chunks have embeddings
      // This ensures ALL chunks are searchable via keyword search
      // CRITICAL: data-refresh.js creates both content and text - preserve both for compatibility
      const allChunksForKeywordSearch = [...allChunks, ...chunksWithoutEmbeddings];
      this.faissOptimizedData = {
        chunks: allChunksForKeywordSearch.map(chunk => ({
          id: chunk.id,
          text: chunk.text || chunk.content || '', // Use both content and text
          content: chunk.content || chunk.text || '', // Preserve both fields
          section: chunk.section,
          type: chunk.type,
          category: chunk.category, // CRITICAL: Include category (used for offices acronym, leadership position, etc.)
          keywords: chunk.keywords || [],
          entities: chunk.metadata || chunk.entities || {},
          metadata: chunk.metadata || chunk.entities || {} // Preserve metadata structure
        }))
      };
      
      Logger.info(`📚 Updated keyword search index: ${this.faissOptimizedData.chunks.length} total chunks (${allChunks.length} with embeddings, ${chunksWithoutEmbeddings.length} without)`);
      
      if (allChunks.length > 0) {
        Logger.info(`Loading ${allChunks.length} chunks from MongoDB (replacing local data)`);
        
        // REPLACE textChunks array completely (don't merge)
        this.textChunks = allChunks;
        
        // Rebuild FAISS index with all embeddings
        if (this.faissIndex) {
          try {
            // Clear existing index
            this.faissIndex = new faiss.IndexFlatL2(this.embeddingDimension);
            this.embeddings = [];
            
            // Add all embeddings to FAISS index
            for (const chunk of allChunks) {
              try {
                this.embeddings.push(chunk.embedding);
                this.faissIndex.add(chunk.embedding);
              } catch (error) {
                Logger.debug(`Failed to add chunk to FAISS: ${error.message}`);
              }
            }
            
            Logger.success(`FAISS index rebuilt with ${this.embeddings.length} embeddings`);
          } catch (faissError) {
            Logger.warn(`FAISS rebuild failed: ${faissError.message}`);
          }
        }
        
        Logger.success(`Successfully loaded ${allChunks.length} chunks with embeddings from MongoDB`);
        Logger.info(`   📊 Total chunks in keyword search: ${this.faissOptimizedData.chunks.length}`);
        Logger.info(`   🔍 FAISS vector search: ${this.embeddings.length} embeddings`);
        Logger.info(`   📝 Text chunks: ${this.textChunks.length}`);
        
        // Verify all chunks are accounted for
        if (this.faissOptimizedData.chunks.length !== mongoChunks.length) {
          Logger.warn(`⚠️  Mismatch: MongoDB has ${mongoChunks.length} chunks, but keyword index has ${this.faissOptimizedData.chunks.length}`);
        }
        
        // NO CACHE - No need to clear anything
      } else if (chunksWithoutEmbeddings.length > 0) {
        // Even if no chunks have embeddings, we still have chunks for keyword search
        Logger.info(`📚 Loaded ${chunksWithoutEmbeddings.length} chunks for keyword search only (no embeddings available)`);
        Logger.info(`   📊 Total chunks in keyword search: ${this.faissOptimizedData.chunks.length}`);
      } else {
        Logger.warn('⚠️  No chunks loaded from MongoDB (neither with nor without embeddings)');
      }
      
      // Update VectorSearchService with latest data
      if (this.vectorSearchService) {
        this.vectorSearchService.faissOptimizedData = this.faissOptimizedData;
        this.vectorSearchService.faissIndex = this.faissIndex;
        this.vectorSearchService.textChunks = this.textChunks;
      }
      
      this.lastMongoSync = now;
      
    } catch (error) {
      Logger.error('MongoDB sync failed', error);
    }
  }

  // Force sync with MongoDB (can be called manually)
  async forceSyncMongoDB() {
    Logger.info('Forcing MongoDB sync...');
    await this.syncWithMongoDB();
  }

  // ===== HELPER METHODS =====
  
  /**
   * Detect calendar query patterns
   */
  _detectCalendarQuery(query) {
    const calendarPattern = /\b(date|dates|event|events|announcement|announcements|schedule|schedules|calendar|when|upcoming|coming|next|this\s+(week|month|year)|deadline|deadlines|holiday|holidays|academic\s+calendar|semester|enrollment\s+period|registration|exam\s+schedule|class\s+schedule|timeline|time\s+table)\b/i;
    const calendarIntentPattern = /\b(when\s+(is|are|will|does)|what\s+(date|dates|time|schedule)|tell\s+me\s+(about\s+)?(the\s+)?(schedule|dates?|events?))\b/i;
    return calendarPattern.test(query) || calendarIntentPattern.test(query);
  }

  /**
   * Detect history query patterns
   */
  _detectHistoryQuery(query) {
    return /\b(history|historical|founded|established|background|evolution|development|kasaysayan|itinatag|pinagmulan|gitukod|timeline|narrative|heritage|conversion|doscst|mcc|mati community college)\b/i.test(query);
  }

  /**
   * Detect all query types based on data structures
   */
  _detectAllQueryTypes(query) {
    return {
      isHistoryQuery: /\b(history|historical|founded|established|background|evolution|development|kasaysayan|itinatag|pinagmulan|gitukod|timeline|narrative|heritage|conversion|doscst|mcc|mati community college)\b/i.test(query),
      isLeadershipQuery: /\b(president|vice president|vice presidents|chancellor|director|directors|leadership|board|governance|administration|executive|executives|board of regents)\b/i.test(query),
      isSUASTQuery: /\b(suast|state university aptitude|scholarship test|entrance exam|admission test|applicants|passers|passing rate|statistics|stats|exam results)\b/i.test(query),
      isAdmissionRequirementsQuery: /\b(admission\s+requirements?|requirements?\s+for\s+admission|admission\s+req|what\s+(are|do|does)\s+.*\s+(need|required|requirement))\b/i.test(query) || 
        (/\b(admission|admissions)\b/i.test(query) && /\b(requirements?|required|need|needed)\b/i.test(query)),
      isEnrollmentQuery: /\b(enrollment|enrolment|enroll|enrol|schedule|enrollment schedule|student count|total students|campus enrollment)\b/i.test(query) && 
        !/\b(admission\s+requirements?|requirements?\s+for\s+admission)\b/i.test(query),
      isFacultyQuery: /\b(faculty|faculties|FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM|college|colleges)\b/i.test(query),
      isProgramQuery: /\b(program|programs|programme|course|courses|degree|degrees|undergraduate|graduate|masters|doctorate|bachelor|BS|BA|MA|MS|PhD|EdD)\b/i.test(query),
      isCampusQuery: /\b(campus|campuses|extension|main campus|baganga|banaybanay|cateel|san isidro|tarragona|location|locations)\b/i.test(query),
      isOfficeQuery: /\b(office|offices|unit|units|service|services)\b/i.test(query),
      isStudentOrgQuery: /\b(usc|university student council|ang.*sidlakan|catalyst|student organization|student organizations|student publication|yearbook)\b/i.test(query),
      isValuesQuery: /\b(core values|graduate outcomes|values|outcomes|quality policy|mandate|charter)\b/i.test(query),
      isLibraryQuery: /\b(library|libraries|learning resource|information resource|book|books|borrow|borrowing)\b/i.test(query)
    };
  }

  /**
   * Sort results by score (highest first)
   */
  _sortByScore(results) {
    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Convert MongoDB chunks to RAG format
   */
  _convertMongoChunksToRAG(chunks, baseScore = 100, source = 'mongodb_search') {
    return chunks.map(chunk => ({
      id: chunk.id,
      section: chunk.section,
      type: chunk.type,
      text: chunk.content || chunk.text,
      score: baseScore + (chunk.relevanceScore || 0),
      metadata: chunk.metadata || {},
      keywords: chunk.keywords || [],
      category: chunk.category,
      source
    }));
  }

  /**
   * Sort chunks by score first, then by date (for chronological order)
   */
  _sortByScoreAndDate(chunks) {
    return chunks.sort((a, b) => {
      // Primary sort: by score
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Secondary sort: by date (if available in metadata or category)
      const dateA = a.metadata?.date || a.category || '';
      const dateB = b.metadata?.date || b.category || '';
      if (dateA && dateB) {
        return dateA.localeCompare(dateB); // Chronological order
      }
      return 0;
    });
  }
}
