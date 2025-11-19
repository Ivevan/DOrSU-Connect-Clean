/**
 * Logger Utility
 * Centralized logging with log levels and formatting
 */
export class Logger {
  // Log levels: ERROR < WARN < INFO < DEBUG
  static LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
  static LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  
  static shouldLog(level) {
    const currentLevel = this.LEVELS[this.LOG_LEVEL] ?? this.LEVELS.INFO;
    const messageLevel = this.LEVELS[level] ?? this.LEVELS.INFO;
    return messageLevel <= currentLevel;
  }
  
  /**
   * Format token count for display (e.g., 90000 -> "90k", 100000 -> "100k")
   * @param {number} tokens - Token count
   * @returns {string} Formatted token string
   */
  static formatTokens(tokens) {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}k`;
    }
    return tokens.toString();
  }
  
  /**
   * Format token usage as "used/limit" (e.g., "90k/100k")
   * @param {number} used - Tokens used
   * @param {number} limit - Token limit
   * @returns {string} Formatted token usage string
   */
  static formatTokenUsage(used, limit) {
    return `${this.formatTokens(used)}/${this.formatTokens(limit)}`;
  }
  
  static formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    return `[${timestamp}] ${level}: ${message}${formattedArgs}`;
  }
  
  static info(message, ...args) {
    if (this.shouldLog('INFO')) {
      console.log(this.formatMessage('INFO', message, ...args));
    }
  }
  
  static success(message, ...args) {
    if (this.shouldLog('INFO')) {
      console.log(`\x1b[32m${this.formatMessage('SUCCESS', message, ...args)}\x1b[0m`);
    }
  }
  
  static warn(message, ...args) {
    if (this.shouldLog('WARN')) {
      console.warn(`\x1b[33m${this.formatMessage('WARN', message, ...args)}\x1b[0m`);
    }
  }
  
  static error(message, error, ...args) {
    if (this.shouldLog('ERROR')) {
      const errorInfo = error instanceof Error ? `\nError: ${error.message}\nStack: ${error.stack}` : 
                       error ? `\nError: ${String(error)}` : '';
      console.error(`\x1b[31m${this.formatMessage('ERROR', message, ...args)}${errorInfo}\x1b[0m`);
    }
  }
  
  static debug(message, ...args) {
    if (this.shouldLog('DEBUG') && process.env.NODE_ENV === 'development') {
      console.debug(`\x1b[36m${this.formatMessage('DEBUG', message, ...args)}\x1b[0m`);
    }
  }
  
  /**
   * Log token usage information
   * @param {string} message - Log message
   * @param {Object} tokenInfo - Token information object
   * @param {number} tokenInfo.used - Tokens used
   * @param {number} tokenInfo.limit - Token limit
   * @param {number} [tokenInfo.remaining] - Tokens remaining
   * @param {number} [tokenInfo.input] - Input tokens
   * @param {number} [tokenInfo.output] - Output tokens
   * @param {number} [tokenInfo.total] - Total tokens
   * @param {string} [tokenInfo.keyLabel] - Key label (e.g., "Key 1")
   * @param {...any} args - Additional arguments
   */
  static tokenUsage(message, tokenInfo, ...args) {
    if (!this.shouldLog('INFO')) return;
    
    const { used, limit, remaining, input, output, total, keyLabel } = tokenInfo || {};
    
    // Build token usage string
    let tokenStr = '';
    if (used !== undefined && limit !== undefined) {
      tokenStr = this.formatTokenUsage(used, limit);
      if (remaining !== undefined) {
        tokenStr += ` (${this.formatTokens(remaining)} remaining)`;
      }
    } else if (total !== undefined) {
      tokenStr = `${this.formatTokens(total)} total`;
      if (input !== undefined && output !== undefined) {
        tokenStr += ` (${this.formatTokens(input)} input + ${this.formatTokens(output)} output)`;
      }
    }
    
    // Build full message
    const keyPrefix = keyLabel ? `[${keyLabel}] ` : '';
    const fullMessage = tokenStr ? `${keyPrefix}${message} | ${tokenStr}` : `${keyPrefix}${message}`;
    
    console.log(`\x1b[36m💾 ${this.formatMessage('INFO', fullMessage, ...args)}\x1b[0m`);
  }

  /**
   * Log search query with detected type and metadata
   * @param {string} query - The search query
   * @param {string} detectedType - Detected query type (e.g., 'history', 'programs', 'deans')
   * @param {Object} [metadata] - Additional metadata about the query
   * @param {string} [metadata.searchMethod] - Search method used
   * @param {string} [metadata.facultyCode] - Detected faculty code (if any)
   * @param {boolean} [metadata.isListingQuery] - Whether it's a listing query
   */
  static logSearchQuery(query, detectedType, metadata = {}) {
    // Always log - remove the shouldLog check for this critical method
    // if (!this.shouldLog('INFO')) return;
    
    const { searchMethod, facultyCode, isListingQuery, ...otherMetadata } = metadata;
    const queryPreview = query.length > 60 ? query.substring(0, 60) + '...' : query;
    
    let logMsg = `🔍 SEARCH QUERY: "${queryPreview}"\n`;
    logMsg += `   Type: ${detectedType || 'general'}`;
    if (searchMethod) logMsg += ` | Method: ${searchMethod}`;
    if (facultyCode) logMsg += ` | Faculty: ${facultyCode}`;
    if (isListingQuery) logMsg += ` | Listing Query`;
    if (Object.keys(otherMetadata).length > 0) {
      logMsg += ` | ${JSON.stringify(otherMetadata)}`;
    }
    
    console.log(`\x1b[36m${logMsg}\x1b[0m`);
  }

  /**
   * Log retrieved chunks/data with details
   * @param {string} query - The original query
   * @param {Array} chunks - Array of retrieved chunks
   * @param {Object} [options] - Logging options
   * @param {number} [options.maxChunks=10] - Maximum number of chunks to log
   * @param {boolean} [options.showFullContent=false] - Show full content or truncate
   * @param {string} [options.source] - Source of the chunks (e.g., 'mongodb', 'vector_search')
   */
  static logRetrievedChunks(query, chunks, options = {}) {
    // Always log - remove the shouldLog check for this critical method
    // if (!this.shouldLog('INFO')) return;
    
    const { maxChunks = 10, showFullContent = false, source } = options;
    const queryPreview = query.length > 50 ? query.substring(0, 50) + '...' : query;
    
    if (!chunks || chunks.length === 0) {
      console.log(`\x1b[33m⚠️  RETRIEVED CHUNKS: "${queryPreview}" | ${source || 'unknown'} | NO CHUNKS FOUND\x1b[0m`);
      return;
    }
    
    console.log(`\x1b[36m📦 RETRIEVED CHUNKS: "${queryPreview}" | ${source || 'unknown'} | Found ${chunks.length} chunks\x1b[0m`);
    
    const chunksToLog = chunks.slice(0, maxChunks);
    chunksToLog.forEach((chunk, index) => {
      const content = chunk.text || chunk.content || '';
      const contentPreview = showFullContent || content.length < 150 
        ? content 
        : content.substring(0, 150) + '...';
      
      let chunkInfo = `   [${index + 1}] `;
      if (chunk.id) chunkInfo += `ID: ${chunk.id.substring(0, 40)}${chunk.id.length > 40 ? '...' : ''} | `;
      if (chunk.section) chunkInfo += `Section: ${chunk.section} | `;
      if (chunk.type) chunkInfo += `Type: ${chunk.type} | `;
      if (chunk.category) chunkInfo += `Category: ${chunk.category} | `;
      if (chunk.score !== undefined) chunkInfo += `Score: ${chunk.score.toFixed(2)} | `;
      if (chunk.source) chunkInfo += `Source: ${chunk.source}`;
      
      console.log(`\x1b[90m${chunkInfo}\x1b[0m`);
      console.log(`\x1b[90m      Content: ${contentPreview}\x1b[0m`);
      
      // Log metadata if present
      if (chunk.metadata && Object.keys(chunk.metadata).length > 0) {
        const relevantMetadata = {};
        if (chunk.metadata.field) relevantMetadata.field = chunk.metadata.field;
        if (chunk.metadata.faculty) relevantMetadata.faculty = chunk.metadata.faculty;
        if (chunk.metadata.name) relevantMetadata.name = chunk.metadata.name;
        if (chunk.metadata.facultyCode) relevantMetadata.facultyCode = chunk.metadata.facultyCode;
        if (chunk.metadata.programCode) relevantMetadata.programCode = chunk.metadata.programCode;
        if (Object.keys(relevantMetadata).length > 0) {
          console.log(`\x1b[90m      Metadata: ${JSON.stringify(relevantMetadata)}\x1b[0m`);
        }
      }
    });
    
    if (chunks.length > maxChunks) {
      console.log(`\x1b[90m   ... and ${chunks.length - maxChunks} more chunks\x1b[0m`);
    }
  }

  /**
   * Log search results summary
   * @param {string} query - The original query
   * @param {Object} summary - Search results summary
   * @param {number} summary.totalChunks - Total chunks retrieved
   * @param {number} summary.returnedChunks - Number of chunks returned
   * @param {string} summary.searchType - Type of search performed
   * @param {Array} [summary.sources] - Array of sources used
   * @param {number} [summary.executionTime] - Execution time in ms
   */
  static logSearchResults(query, summary) {
    // Always log - remove the shouldLog check for this critical method
    // if (!this.shouldLog('INFO')) return;
    
    const { totalChunks, returnedChunks, searchType, sources = [], executionTime } = summary;
    const queryPreview = query.length > 50 ? query.substring(0, 50) + '...' : query;
    
    let resultMsg = `✅ SEARCH RESULTS: "${queryPreview}"\n`;
    resultMsg += `   Type: ${searchType || 'general'} | `;
    resultMsg += `Retrieved: ${totalChunks || 0} | `;
    resultMsg += `Returned: ${returnedChunks || 0}`;
    if (sources.length > 0) {
      resultMsg += ` | Sources: ${sources.join(', ')}`;
    }
    if (executionTime !== undefined) {
      resultMsg += ` | Time: ${executionTime}ms`;
    }
    
    console.log(`\x1b[32m${resultMsg}\x1b[0m`);
  }

  /**
   * Log data fetch operation (generalized for any data retrieval)
   * @param {string} operation - Operation name (e.g., 'searchPrograms', 'searchDeans')
   * @param {string} query - The query/search term
   * @param {Object} details - Operation details
   * @param {number} [details.chunksFound] - Number of chunks found
   * @param {string} [details.method] - Method used (e.g., 'aggregation', 'vector_search')
   * @param {Object} [details.filters] - Filters applied
   * @param {Array} [details.chunks] - Chunks retrieved (will be logged if provided)
   */
  static logDataFetch(operation, query, details = {}) {
    // Always log - remove the shouldLog check for this critical method
    // if (!this.shouldLog('INFO')) return;
    
    const { chunksFound, method, filters, chunks, ...otherDetails } = details;
    const queryPreview = query.length > 50 ? query.substring(0, 50) + '...' : query;
    
    let fetchMsg = `📊 DATA FETCH: ${operation} | Query: "${queryPreview}"\n`;
    if (method) fetchMsg += `   Method: ${method} | `;
    if (chunksFound !== undefined) fetchMsg += `Chunks: ${chunksFound}`;
    if (filters && Object.keys(filters).length > 0) {
      fetchMsg += ` | Filters: ${JSON.stringify(filters)}`;
    }
    if (Object.keys(otherDetails).length > 0) {
      fetchMsg += ` | ${JSON.stringify(otherDetails)}`;
    }
    
    console.log(`\x1b[35m${fetchMsg}\x1b[0m`);
    
    // If chunks are provided, log them too
    if (chunks && chunks.length > 0) {
      this.logRetrievedChunks(query, chunks, { source: `${operation} (${method || 'unknown'})` });
    }
  }
}
  