import { pipeline } from '@xenova/transformers';
import faiss from 'faiss-node';
import NodeCache from 'node-cache';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OptimizedRAGService {
  constructor(mongoService = null) {
    this.faissOptimizedData = null;
    this.mongoService = mongoService; // MongoDB service for dynamic data
    this.lastMongoSync = null; // Track last sync time
    
    // Initialize caching system with NO automatic expiration
    // Cache will only be cleared at scheduled times (not by TTL)
    this.cache = new NodeCache({ 
      stdTTL: 0,          // 0 = no automatic expiration (cache persists until manually cleared)
      checkperiod: 0,    // Disable automatic expiration checking
      useClones: false,   // Better performance
      maxKeys: 5000       // Increased capacity for persistent cache
    });
    
    // Cache statistics
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    // FAISS vector search
    this.faissIndex = null;
    this.embeddings = [];
    this.textChunks = [];
    this.embeddingDimension = 384; // Standard dimension for sentence transformers (all-MiniLM-L6-v2)
    
    // Transformer model for embeddings
    this.embeddingModel = null;
    this.modelLoaded = false;
    
    this.loadOptimizedData();
    this.setupCacheMonitoring();
    this.initializeEmbeddingModel();
    
    // Sync with MongoDB every 30 seconds if available
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

  // Setup cache monitoring and scheduled clearing
  setupCacheMonitoring() {
    // Log cache statistics every 5 minutes
    setInterval(() => {
      const stats = this.getCacheStats();
      if (stats.total > 0) {
        Logger.debug(`RAG Cache: ${stats.hitRate}% hit rate (${stats.hits}/${stats.total}), ${stats.keys} entries`);
      }
    }, 300000); // 5 minutes
    
    // Schedule cache clearing at specific times
    this.scheduleCacheClearing();
  }
  
  // Schedule cache clearing at specific times (configurable)
  scheduleCacheClearing() {
    // Get scheduled times from environment variable or use defaults
    // Format: "HH:MM,HH:MM" (24-hour format, comma-separated)
    // Example: "00:00,12:00" = clear at midnight and noon
    const scheduledTimes = process.env.CACHE_CLEAR_TIMES || '00:00,06:00,12:00,18:00';
    const times = scheduledTimes.split(',').map(t => t.trim());
    
    // Remove duplicates (case-insensitive)
    const uniqueTimes = [...new Set(times)];
    if (times.length !== uniqueTimes.length) {
      Logger.warn(`Removed ${times.length - uniqueTimes.length} duplicate cache clear time(s)`);
    }
    
    Logger.info(`Cache scheduled to clear at: ${uniqueTimes.join(', ')}`);
    
    // Calculate next clear time for each scheduled time
    const scheduleNextClear = (hour, minute) => {
      const now = new Date();
      const clearTime = new Date();
      clearTime.setHours(hour, minute, 0, 0);
      
      // If the time has passed today, schedule for tomorrow
      if (clearTime <= now) {
        clearTime.setDate(clearTime.getDate() + 1);
      }
      
      const msUntilClear = clearTime.getTime() - now.getTime();
      
      setTimeout(() => {
        const keysBeforeClear = this.cache.keys().length;
        this.cache.flushAll();
        this.cacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
        Logger.info(`Scheduled cache clear: Cleared ${keysBeforeClear} entries at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
        
        // Schedule next clear (24 hours later)
        scheduleNextClear(hour, minute);
      }, msUntilClear);
    };
    
    // Schedule each unique time
    uniqueTimes.forEach(timeStr => {
      const [hour, minute] = timeStr.split(':').map(Number);
      if (!isNaN(hour) && !isNaN(minute) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
        scheduleNextClear(hour, minute);
      } else {
        Logger.warn(`Invalid cache clear time format: ${timeStr}. Use HH:MM format.`);
      }
    });
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
      
    } catch (error) {
      Logger.error('Failed to load transformer model', error);
      Logger.warn('Falling back to simple embeddings');
      this.modelLoaded = false;
      
      // Fallback to simple embeddings
      await this.initializeFAISS();
    }
  }

  // Generate cache key from query (optimized for better hit rates)
  generateCacheKey(query, maxResults) {
    // IMPROVED: Better normalization that handles date/schedule queries consistently
    let normalizedQuery = query.toLowerCase()
      .trim();
    
    // Normalize date-related terms for better cache hits
    // "when is", "what is the date", "schedule" all map to similar intent
    const dateSynonyms = {
      'when is': 'date',
      'when are': 'dates',
      'what is the date': 'date',
      'what are the dates': 'dates',
      'what date': 'date',
      'what dates': 'dates',
      'tell me about': 'info',
      'what is': 'info',
      'what are': 'info'
    };
    
    // Replace synonyms to normalize similar queries
    Object.entries(dateSynonyms).forEach(([synonym, replacement]) => {
      if (normalizedQuery.startsWith(synonym)) {
        normalizedQuery = normalizedQuery.replace(synonym, replacement);
      }
    });
    
    // Remove punctuation and normalize whitespace
    normalizedQuery = normalizedQuery
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, '_')    // Replace spaces with underscores
      .substring(0, 60);       // Increased length for better matching
    
    return `opt_rag_${normalizedQuery}_${maxResults}`;
  }

  // Get cache statistics
  getCacheStats() {
    const keys = this.cache.keys();
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? Math.round((this.cacheStats.hits / total) * 100) : 0;
    
    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      total: total,
      hitRate: hitRate,
      keys: keys.length,
      memory: this.cache.getStats()
    };
  }

  // Clear cache (useful for testing or memory management)
  clearCache() {
    this.cache.flushAll();
    this.cacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    Logger.info('RAG Cache cleared');
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
    this.faissOptimizedData.chunks.forEach(chunk => {
      this.textChunks.push({
        id: chunk.id,
        text: chunk.text,
        section: chunk.section,
        type: chunk.type,
        keywords: chunk.keywords || [],
        metadata: chunk.entities || {},
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
            // Add multiple date formats to improve matching
            const dateFormats = [
              dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
              dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
              dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
              dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            ];
            text = `${text} ${dateFormats.join(' ')}`;
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

  // FAISS-based vector similarity search (OPTIMIZED)
  async findRelevantDataFAISS(query, maxResults = 5) {
    if (!this.faissIndex || this.textChunks.length === 0) {
      Logger.debug('FAISS not available, falling back to keyword search');
      return this.findRelevantDataKeyword(query, maxResults);
    }

    // Cap maxResults to available chunks to prevent FAISS error
    const actualMaxResults = Math.min(maxResults, this.textChunks.length);

    // Check cache for FAISS search results
    const faissCacheKey = this.generateCacheKey(query, actualMaxResults);
    const cachedResults = this.cache.get(faissCacheKey);
    if (cachedResults) {
      this.cacheStats.hits++;
      Logger.debug(`FAISS Cache HIT: "${query.substring(0, 30)}..."`);
      return cachedResults;
    }

    try {
      // IMPROVED: Enhance query for date/schedule queries
      let enhancedQuery = query;
      const isCalendarQuery = /\b(date|dates|schedule|schedules|calendar|event|when|deadline)\b/i.test(query);
      
      if (isCalendarQuery) {
        // Add synonyms and related terms to improve semantic matching
        const dateSynonyms = ' date dates schedule schedules calendar event events timeline deadline deadlines';
        enhancedQuery = `${query}${dateSynonyms}`;
      }
      
      // Create query embedding using transformer or fallback
      const queryEmbedding = await this.createTransformerEmbedding({
        text: enhancedQuery,
        keywords: [],
        metadata: {}
      });
      
      // Search FAISS index (capped to available chunks)
      // IMPROVED: Get more results initially, then filter/rerank
      const searchResult = this.faissIndex.search(queryEmbedding, Math.min(actualMaxResults * 2, this.textChunks.length));
      
      const results = [];
      
      // Handle FAISS search result format (uses 'labels' instead of 'indices')
      const labels = searchResult.labels || [];
      const distances = searchResult.distances || [];
      
      for (let i = 0; i < labels.length; i++) {
        const index = labels[i];
        const distance = distances[i];
        const chunk = this.textChunks[index];
        
        if (chunk) {
          // Convert distance to similarity score (lower distance = higher similarity)
          let similarity = 1 / (1 + distance);
          
          // IMPROVED: Boost score for calendar events in calendar queries
          if (isCalendarQuery && (chunk.section === 'calendar_events' || chunk.type === 'calendar_event')) {
            similarity *= 1.2; // 20% boost
          }
          
          results.push({
            id: chunk.id,
            section: chunk.section,
            type: chunk.type,
            text: chunk.text,
            score: similarity * 100, // Scale to 0-100
            metadata: chunk.metadata,
            keywords: chunk.keywords,
            distance: distance
          });
        }
      }
      
      // Sort by score and take top results
      const sortedResults = results
        .sort((a, b) => b.score - a.score)
        .slice(0, actualMaxResults);
      
      // Cache the results (no TTL - persists until scheduled clear)
      this.cache.set(faissCacheKey, sortedResults);
      this.cacheStats.sets++;
      
      Logger.debug(`FAISS search: ${sortedResults.length} results for "${query.substring(0, 30)}..."`);
      
      return sortedResults;
      
    } catch (error) {
      Logger.error('FAISS search failed', error);
      return this.findRelevantDataKeyword(query, maxResults); // Fallback to keyword search
    }
  }

  // Enhanced keyword-based search as fallback
  findRelevantDataKeyword(query, maxResults = 5) {
    if (!this.faissOptimizedData || !this.faissOptimizedData.chunks) {
      return [];
    }

    // Check cache for keyword search results
    const keywordCacheKey = `keyword_${this.generateCacheKey(query, maxResults)}`;
    const cachedResults = this.cache.get(keywordCacheKey);
    if (cachedResults) {
      this.cacheStats.hits++;
      return cachedResults;
    }

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    
    // IMPROVED: Better calendar query detection - understands intent, not just keywords
    const calendarPattern = /\b(date|dates|event|events|announcement|announcements|schedule|schedules|calendar|when|upcoming|coming|next|deadline|deadlines|holiday|holidays|academic\s+calendar|semester|enrollment\s+period|registration|exam\s+schedule|class\s+schedule|timeline|time\s+table)\b/i;
    const calendarIntentPattern = /\b(when\s+(is|are|will|does)|what\s+(date|dates|time|schedule)|tell\s+me\s+(about\s+)?(the\s+)?(schedule|dates?|events?))\b/i;
    const isCalendarQuery = calendarPattern.test(query) || calendarIntentPattern.test(query);
    
    const results = [];
    
    // Score each chunk based on keyword matches
    this.faissOptimizedData.chunks.forEach(chunk => {
      let score = 0;
      
      // Boost score for calendar events if query is calendar-related
      if (isCalendarQuery && (chunk.section === 'calendar_events' || chunk.type === 'calendar_event')) {
        score += 50; // High base score for calendar events in calendar queries
      }
      
      // Score based on text content
      const textLower = chunk.text.toLowerCase();
      queryWords.forEach(word => {
        const occurrences = (textLower.match(new RegExp(word, 'g')) || []).length;
        score += occurrences * 2; // Base weight for text matches
      });
      
      // Score based on keywords (higher weight)
      if (chunk.keywords) {
        chunk.keywords.forEach(keyword => {
          const keywordLower = keyword.toLowerCase();
          if (queryWords.some(qw => keywordLower.includes(qw) || qw.includes(keywordLower))) {
            score += 5; // Higher weight for keyword matches
          }
        });
      }
      
      // Score based on metadata/entities
      if (chunk.entities) {
        const entitiesStr = JSON.stringify(chunk.entities).toLowerCase();
        queryWords.forEach(word => {
          if (entitiesStr.includes(word)) {
            score += 3; // Medium weight for entity matches
          }
        });
      }
      
      // Additional scoring for calendar events: match date-related terms
      if (chunk.section === 'calendar_events' || chunk.type === 'calendar_event') {
        const dateTerms = ['january', 'february', 'march', 'april', 'may', 'june', 
                          'july', 'august', 'september', 'october', 'november', 'december',
                          'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
                          'week', 'month', 'year', 'today', 'tomorrow', 'next', 'upcoming'];
        const hasDateTerm = dateTerms.some(term => queryLower.includes(term));
        if (hasDateTerm) {
          score += 20; // Boost for date-related queries
        }
      }
      
      if (score > 0) {
        results.push({
          id: chunk.id,
          section: chunk.section,
          type: chunk.type,
          text: chunk.text,
          score: score,
          metadata: chunk.entities,
          keywords: chunk.keywords,
          source: 'keyword_search'
        });
      }
    });

    const sortedResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
    
    // Cache the search results (no TTL - persists until scheduled clear)
    this.cache.set(keywordCacheKey, sortedResults);
    this.cacheStats.sets++;
    
    return sortedResults;
  }

  // Get context for specific topics using optimized chunking
  async getContextForTopic(query, maxTokens = 500, maxSections = 10, suggestMore = false, calendarService = null) {
    // Debug: Verify we have optimized data
    if (!this.faissOptimizedData || !this.faissOptimizedData.chunks) {
      Logger.warn('RAG: No optimized data available, using fallback');
      return this.getBasicInfo();
    }
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(query, maxSections);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheStats.hits++;
      Logger.debug(`RAG Cache HIT: "${query.substring(0, 30)}..."`);
      return cached;
    }
    
    this.cacheStats.misses++;
    Logger.debug(`RAG Cache MISS: "${query.substring(0, 30)}..." (${this.faissOptimizedData.chunks.length} chunks available)`);
    
    // IMPROVED: Better calendar query detection - understands intent, not just keywords
    const calendarPattern = /\b(date|dates|event|events|announcement|announcements|schedule|schedules|calendar|when|upcoming|coming|next|this\s+(week|month|year)|deadline|deadlines|holiday|holidays|academic\s+calendar|semester|enrollment\s+period|registration|exam\s+schedule|class\s+schedule|timeline|time\s+table)\b/i;
    const calendarIntentPattern = /\b(when\s+(is|are|will|does)|what\s+(date|dates|time|schedule)|tell\s+me\s+(about\s+)?(the\s+)?(schedule|dates?|events?))\b/i;
    const isCalendarQuery = calendarPattern.test(query) || calendarIntentPattern.test(query);
    
    // Check if this is a comprehensive query that needs ALL related chunks
    const comprehensiveKeywords = [
      'core values', 'mission', 'missions', 'mandate', 'objectives',
      'graduate outcomes', 'quality commitments', 'president', 'leadership',
      'history', 'faculties', 'faculty', 'programs', 'programme', 'enrollment', 
      'campuses', 'campus', 'deans', 'dean', 'directors', 'director',
      'events', 'schedules', 'calendar', 'announcements', 'dates', 'deadlines'
    ];
    
    // Check for plural keywords (indicates user wants ALL items)
    const pluralKeywords = [
      'faculties', 'programs', 'courses', 'deans', 'directors', 'campuses',
      'values', 'missions', 'objectives', 'commitments', 'outcomes',
      'events', 'schedules', 'announcements', 'dates', 'deadlines'
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
    
    // For vision/mission queries, prioritize exact section retrieval
    if (isVisionMissionQuery) {
      Logger.debug(`VISION/MISSION QUERY: Prioritizing exact section retrieval for "${query.substring(0, 40)}..."`);
      
      // Force keyword search to get ALL vision/mission chunks
      const visionMissionSections = ['vision_mission', 'visionMission', 'mandate', 'values', 'graduate_outcomes', 'quality_policy'];
      const sectionChunks = this.faissOptimizedData.chunks.filter(chunk => 
        visionMissionSections.some(section => 
          chunk.section?.toLowerCase().includes(section.toLowerCase()) ||
          chunk.type?.toLowerCase().includes(section.toLowerCase())
        )
      );
      
      if (sectionChunks.length > 0) {
        Logger.debug(`Found ${sectionChunks.length} exact vision/mission chunks`);
        relevantData = sectionChunks.map(chunk => ({
          id: chunk.id,
          section: chunk.section,
          type: chunk.type,
          text: chunk.text,
          score: 100, // Highest priority
          metadata: chunk.entities,
          keywords: chunk.keywords,
          source: 'exact_section_match'
        }));
      }
    }
    
    // For comprehensive/listing queries, get MORE chunks - prioritize completeness
    let relevantData;
    if ((isComprehensive && maxSections >= 8) || isListingQuery || hasPluralKeyword) {
      Logger.debug(`COMPREHENSIVE QUERY: Getting ALL related chunks for "${query.substring(0, 40)}..."`);
      
      // Increase retrieval significantly for comprehensive queries
      const expandedMaxSections = Math.max(maxSections * 3, 30);
      
      // Use keyword search for comprehensive queries to ensure we get ALL related chunks
      relevantData = this.findRelevantDataKeyword(query, expandedMaxSections);
      
      // Also try FAISS and merge results
      const faissData = await this.findRelevantDataFAISS(query, expandedMaxSections);
      
      // Merge and deduplicate results
      const allData = [...relevantData, ...faissData];
      const uniqueData = allData.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
      );
      
      // Sort by relevance score
      relevantData = uniqueData.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // For queries about specific sections (like faculties), filter to that section
      if (hasPluralKeyword) {
        const sectionKeywordMap = {
          'faculties': 'faculties',
          'faculty': 'faculties',
          'programs': 'programs',
          'programme': 'programs',
          'campuses': 'enrollment',
          'campus': 'enrollment',
          'values': 'values',
          'missions': 'vision_mission',
          'objectives': 'mandate',
          'commitments': 'quality_policy',
          'outcomes': 'graduate_outcomes'
        };
        
        const matchedSection = Object.entries(sectionKeywordMap).find(([key]) => 
          query.toLowerCase().includes(key)
        );
        
        if (matchedSection) {
          const [_, sectionName] = matchedSection;
          // Get ALL chunks from that specific section
          const sectionChunks = relevantData.filter(chunk => chunk.section === sectionName);
          if (sectionChunks.length > 0) {
            Logger.debug(`Found ${sectionChunks.length} chunks in section "${sectionName}"`);
            relevantData = sectionChunks;
          }
        }
      }
    } else {
      // Generate context using optimized FAISS (with fallback to keyword search)
      relevantData = await this.findRelevantDataFAISS(query, maxSections);
    }
    
    // For calendar queries, also fetch and include calendar events
    let calendarEventsData = [];
    if (isCalendarQuery && calendarService && this.mongoService) {
      try {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30); // Past 30 days
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 365); // Next 365 days
        
        const events = await calendarService.getEvents({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 100
        });
        
        if (events && events.length > 0) {
          // Convert calendar events to RAG format chunks
          calendarEventsData = events.map((event, idx) => {
            const eventDate = event.isoDate || event.date;
            const dateStr = eventDate ? new Date(eventDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }) : 'Date TBD';
            
            // Create searchable text from event
            let eventText = `${event.title || 'Untitled Event'}. `;
            if (event.description) eventText += `${event.description}. `;
            eventText += `Date: ${dateStr}. `;
            if (event.time) eventText += `Time: ${event.time}. `;
            if (event.category) eventText += `Category: ${event.category}. `;
            if (event.dateType === 'date_range' && event.startDate && event.endDate) {
              const start = new Date(event.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
              const end = new Date(event.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
              eventText += `Date Range: ${start} to ${end}. `;
            }
            
            // Extract keywords from event
            const keywords = [];
            if (event.title) keywords.push(...event.title.toLowerCase().split(/\s+/).filter(w => w.length > 3));
            if (event.category) keywords.push(event.category.toLowerCase());
            if (event.description) {
              const descWords = event.description.toLowerCase().split(/\s+/).filter(w => w.length > 4);
              keywords.push(...descWords.slice(0, 5)); // Top 5 words from description
            }
            
            return {
              id: `calendar-${event._id || event.id || idx}`,
              section: 'calendar_events',
              type: 'calendar_event',
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
                endDate: event.endDate
              },
              keywords: [...new Set(keywords)], // Remove duplicates
              source: 'calendar_database'
            };
          });
          
          // Merge calendar events with RAG results, prioritizing calendar events for calendar queries
          if (isCalendarQuery) {
            relevantData = [...calendarEventsData, ...relevantData];
          } else {
            relevantData = [...relevantData, ...calendarEventsData];
          }
          
          Logger.debug(`RAG: Added ${calendarEventsData.length} calendar events to context`);
        }
      } catch (calendarError) {
        Logger.error('RAG: Error fetching calendar events', calendarError);
        // Continue without calendar data if there's an error
      }
    }
    
    if (relevantData.length === 0) {
      const basicInfo = this.getBasicInfo();
      this.cache.set(cacheKey, basicInfo); // Cache basic info (no TTL - persists until scheduled clear)
      this.cacheStats.sets++;
      return basicInfo;
    }

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
    
    // Separate calendar events from other data for better formatting
    const calendarEvents = relevantData.filter(item => item.section === 'calendar_events');
    const otherData = relevantData.filter(item => item.section !== 'calendar_events');
    
    // Add calendar events section first if present
    if (calendarEvents.length > 0 && isCalendarQuery) {
      const calendarHeader = `\n## CALENDAR EVENTS AND SCHEDULES\n\n`;
      context += calendarHeader;
      currentTokens += Math.round(calendarHeader.length / 4);
      
      // Helper function to format date concisely (e.g., "Jan 11" or "Jan 11 - Jan 15")
      const formatDateConcise = (date) => {
        if (!date) return 'Date TBD';
        const d = new Date(date);
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        const day = d.getDate();
        return `${month} ${day}`;
      };
      
      // Group events by title to avoid redundancy
      const groupedEvents = new Map();
      calendarEvents.forEach(event => {
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
        
        let eventText = `**${title}**\n`;
        
        // Check if all events in group are date ranges
        const allAreDateRanges = eventGroup.every(e => 
          e.metadata?.dateType === 'date_range' && e.metadata.startDate && e.metadata.endDate
        );
        
        if (allAreDateRanges && eventGroup.length > 0) {
          // For date ranges, show the range concisely
          const startDate = eventGroup[0].metadata.startDate;
          const endDate = eventGroup[eventGroup.length - 1].metadata.endDate;
          
          // If all events are part of the same range, show single range
          if (eventGroup.length === 1) {
            const start = formatDateConcise(startDate);
            const end = formatDateConcise(endDate);
            const year = new Date(startDate).getFullYear();
            eventText += `📅 Date: ${start} - ${end}, ${year}\n`;
          } else {
            // Multiple ranges - show first and last
            const firstStart = formatDateConcise(startDate);
            const lastEnd = formatDateConcise(endDate);
            const year = new Date(startDate).getFullYear();
            eventText += `📅 Dates: ${firstStart} - ${lastEnd}, ${year}\n`;
          }
        } else {
          // Mix of single dates and ranges, or all single dates
          const dates = [];
          eventGroup.forEach(event => {
            if (event.metadata?.dateType === 'date_range' && event.metadata.startDate && event.metadata.endDate) {
              const start = formatDateConcise(event.metadata.startDate);
              const end = formatDateConcise(event.metadata.endDate);
              dates.push(`${start} - ${end}`);
            } else if (event.metadata?.date) {
              dates.push(formatDateConcise(event.metadata.date));
            }
          });
          
          if (dates.length > 0) {
            // Remove duplicates and format
            const uniqueDates = [...new Set(dates)];
            const year = eventGroup[0].metadata?.date 
              ? new Date(eventGroup[0].metadata.date).getFullYear()
              : eventGroup[0].metadata?.startDate 
                ? new Date(eventGroup[0].metadata.startDate).getFullYear()
                : new Date().getFullYear();
            
            if (uniqueDates.length === 1) {
              eventText += `📅 Date: ${uniqueDates[0]}, ${year}\n`;
            } else if (uniqueDates.length <= 3) {
              eventText += `📅 Dates: ${uniqueDates.join(', ')}, ${year}\n`;
            } else {
              // Too many dates, show range
              const firstDate = uniqueDates[0];
              const lastDate = uniqueDates[uniqueDates.length - 1];
              eventText += `📅 Dates: ${firstDate} - ${lastDate}, ${year}\n`;
            }
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

    // Cache the result (no TTL - persists until scheduled clear)
    this.cache.set(cacheKey, context);
    this.cacheStats.sets++;
    
    return context;
  }

  // Get basic university info
  getBasicInfo() {
    return `## DAVAO ORIENTAL STATE UNIVERSITY (DOrSU)
**Full Name:** Davao Oriental State University
**Type:** State-funded research-based coeducational higher education institution
**Location:** Mati City, Davao Oriental, Philippines
**Founded:** December 13, 1989
**Total Enrollment:** 17,251 students (as of 2025)
**President:** Dr. Roy G. Ponce

## VISION & MISSION
**Vision:** A university of excellence, innovation and inclusion.
**Mission:** To elevate knowledge generation, promote sustainable development, and produce holistic human resources.

## ACADEMIC STRUCTURE
**7 Faculties:** FACET, FALS, FTED, FBM, FCJE, FNAHS, FHUSOCOM
**Programs:** Undergraduate and Graduate programs across various disciplines
**Campuses:** Main Campus plus 5 Extension Campuses`;
  }

  // Cache AI responses for common queries
  // NOTE: No TTL - cache persists until scheduled clear time
  async cacheAIResponse(query, response, complexity) {
    const normalizedQuery = query.toLowerCase().trim();
    const cacheKey = `ai_opt_${normalizedQuery.replace(/\s+/g, '_')}`;
    
    // Store in-memory cache (fast access)
    this.cache.set(cacheKey, {
      response: response,
      complexity: complexity,
      cachedAt: Date.now()
    });
    
    // Also store in MongoDB for persistence (survives server restarts)
    if (this.mongoService) {
      try {
        // Store in MongoDB ai_cache collection (no expiration - cleared at scheduled times)
        await this.mongoService.cacheResponse(normalizedQuery, response, complexity, 0); // 0 = no expiration
        Logger.debug(`Cached AI response in MongoDB for "${query.substring(0, 30)}..."`);
      } catch (error) {
        Logger.warn(`Failed to cache in MongoDB (using in-memory only): ${error.message}`);
      }
    }
    
    this.cacheStats.sets++;
    Logger.debug(`Cached AI response for "${query.substring(0, 30)}..." (in-memory + MongoDB)`);
  }

  // Get cached AI response (checks both in-memory and MongoDB)
  async getCachedAIResponse(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const cacheKey = `ai_opt_${normalizedQuery.replace(/\s+/g, '_')}`;
    
    // First check in-memory cache (fastest)
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheStats.hits++;
      // Handle both old format (string) and new format (object with metadata)
      const response = typeof cached === 'string' ? cached : cached.response;
      Logger.debug(`Cache HIT (in-memory): "${query.substring(0, 30)}..."`);
      return response;
    }
    
    // If not in memory, check MongoDB (persistent cache)
    if (this.mongoService) {
      try {
        const mongoCached = await this.mongoService.getCachedResponse(normalizedQuery);
        if (mongoCached) {
          // Restore to in-memory cache for faster future access
          this.cache.set(cacheKey, {
            response: mongoCached,
            complexity: 'unknown',
            cachedAt: Date.now()
          });
          this.cacheStats.hits++;
          Logger.debug(`Cache HIT (MongoDB): "${query.substring(0, 30)}..."`);
          return mongoCached;
        }
      } catch (error) {
        Logger.debug(`MongoDB cache check failed (continuing): ${error.message}`);
      }
    }
    
    this.cacheStats.misses++;
    return null;
  }
  
  // Clear all AI response cache (both in-memory and MongoDB)
  async clearAIResponseCache() {
    // Clear in-memory cache
    const keys = this.cache.keys();
    const aiResponseKeys = keys.filter(key => key.startsWith('ai_opt_'));
    aiResponseKeys.forEach(key => this.cache.del(key));
    this.cacheStats.deletes += aiResponseKeys.length;
    
    // Clear MongoDB cache collection
    if (this.mongoService && this.mongoService.db) {
      try {
        const collection = this.mongoService.db.collection('ai_cache');
        const result = await collection.deleteMany({});
        Logger.info(`Cleared ${result.deletedCount} cached responses from MongoDB ai_cache collection`);
      } catch (error) {
        Logger.warn(`Failed to clear MongoDB cache: ${error.message}`);
      }
    }
    Logger.info(`Cleared ${aiResponseKeys.length} AI response cache entries`);
    return aiResponseKeys.length;
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
      const allChunks = [];
      for (const chunk of mongoChunks) {
        if (chunk.embedding) {
          allChunks.push({
            id: chunk.id,
            text: chunk.content,
            section: chunk.section || chunk.topic || 'general',
            type: chunk.type || chunk.category || 'info',
            topic: chunk.topic,
            category: chunk.category || 'general',
            keywords: chunk.keywords || [],
            metadata: chunk.metadata || {},
            entities: chunk.entities || {},
            embedding: chunk.embedding
          });
        }
      }
      
      if (allChunks.length > 0) {
        Logger.info(`Loading ${allChunks.length} chunks from MongoDB (replacing local data)`);
        
        // REPLACE textChunks array completely (don't merge)
        this.textChunks = allChunks;
        
        // CRITICAL FIX: Also update faissOptimizedData.chunks for keyword search
        this.faissOptimizedData = {
          chunks: allChunks.map(chunk => ({
            id: chunk.id,
            text: chunk.text,
            section: chunk.section,
            type: chunk.type,
            keywords: chunk.keywords,
            entities: chunk.metadata
          }))
        };
        
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
        
        Logger.success(`Successfully loaded ${allChunks.length} chunks from MongoDB`);
        Logger.debug(`   - textChunks: ${this.textChunks.length}`);
        Logger.debug(`   - faissOptimizedData.chunks: ${this.faissOptimizedData.chunks.length}`);
        Logger.debug(`   - FAISS embeddings: ${this.embeddings.length}`);
        
        // Clear AI cache since knowledge base changed
        this.cache.flushAll();
        Logger.info('Cleared AI cache (knowledge base updated)');
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
}
