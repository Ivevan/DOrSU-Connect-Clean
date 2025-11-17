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
}
  