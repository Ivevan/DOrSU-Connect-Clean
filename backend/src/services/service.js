import Groq from 'groq-sdk';
import { Logger } from '../utils/logger.js';

/**
 * Groq AI Service
 * - Production: Uses Groq Cloud API (ultra-fast, cloud-based)
 * - Multi-key support: Rotates between multiple API keys for increased capacity
 * - FIXED MODEL: Always uses llama-3.3-70b-versatile for consistent intelligent responses
 * 
 * Requires GROQ_API_KEY or GROQ_API_KEYS environment variable
 * Model is hardcoded to llama-3.3-70b-versatile and cannot be changed
 */
export class LlamaService {
  constructor() {
    // Parse multiple API keys from environment variable
    // Support both GROQ_API_KEYS (comma-separated) and GROQ_API_KEY (single key) for backward compatibility
    const apiKeysEnv = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY;
    this.groqApiKeys = [];
    
    if (apiKeysEnv) {
      // Parse multiple keys (comma-separated) or single key
      this.groqApiKeys = apiKeysEnv
        .split(',')
        .map(key => key.trim())
        .filter(key => key.length > 0);
    }
    
    // Require at least one API key
    if (this.groqApiKeys.length === 0) {
      throw new Error('GROQ_API_KEY or GROQ_API_KEYS environment variable is required. Please configure at least one Groq API key.');
    }
    
    this.provider = 'groq';
    
    // FIXED MODEL: Always use llama-3.3-70b-versatile for consistent intelligent responses
    // Model switching is disabled to maintain response quality and consistency
    this.groqModel = 'llama-3.3-70b-versatile'; // Fixed model - never changes
    this.modelLocked = true; // Permanently locked to prevent switching
    
    // Multi-key management
    this.currentKeyIndex = 0; // Current API key index (round-robin)
    this.keyUsageStats = {}; // Track usage per key: { keyIndex: { requests: 0, rateLimits: 0, tokensUsed: 0, tokensRemaining: 100000, lastUsed: null, exhausted: false, exhaustedUntil: null } }
    this.keySwitchCount = 0; // Track total key switches
    this.groqClients = []; // Array of Groq client instances (one per key)
    this.dailyTokenLimit = 100000; // Groq free tier: 100,000 tokens per day per key
    this.tokenSafetyMargin = 5000; // Safety margin: Stop using key when 5k tokens remain to prevent hitting limit
    this.effectiveTokenLimit = this.dailyTokenLimit - this.tokenSafetyMargin; // 95k effective limit per key
    
    // Create Groq client for each API key
    this.groqClients = this.groqApiKeys.map((apiKey, index) => {
      const client = new Groq({ apiKey });
      // Initialize usage stats for this key
      this.keyUsageStats[index] = {
        requests: 0,
        rateLimits: 0,
        tokensUsed: 0,
        tokensRemaining: this.dailyTokenLimit,
        effectiveRemaining: this.effectiveTokenLimit, // Remaining with safety margin
        lastUsed: null,
        exhausted: false,
        exhaustedUntil: null,
        lastResetDate: new Date().toDateString() // Track daily reset
      };
      return client;
    });
    
    // Set groqClient to first client
    this.groqClient = this.groqClients[0];
    
    Logger.success(`🚀 AI Provider: Groq Cloud (${this.groqModel}) - ${this.groqApiKeys.length} API key(s) configured`);
    Logger.info(`   🔒 Model locked to: ${this.groqModel} (fixed for consistent intelligent responses)`);
    if (this.groqApiKeys.length > 1) {
      Logger.info(`   ✅ Multi-key support enabled: ${this.groqApiKeys.length} keys configured`);
      Logger.info(`   ⚠️  NOTE: If all keys are from the same Groq account, they share the same token limit (100k/day)`);
      Logger.info(`   💡 To increase capacity, use API keys from DIFFERENT Groq accounts/organizations`);
      Logger.info(`   📊 Keys loaded: ${this.groqApiKeys.map((_, i) => `Key ${i + 1}`).join(', ')}`);
    } else {
      Logger.info(`   📊 Single key configured: 100,000 tokens/day limit`);
    }
  }

  async chat(messages, options = {}) {
    try {
      const result = await this.chatWithGroqFallback(messages, options);
      // Return result as-is (it's already an object with content and tokenUsage)
      return result;
    } catch (error) {
      console.error(`${this.provider.toUpperCase()} chat error:`, error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Chat with automatic key rotation on rate limit
   * Model is FIXED to llama-3.3-70b-versatile - only keys rotate for capacity
   */
  async chatWithGroqFallback(messages, options = {}) {
    let lastError = null;
    const maxKeyAttempts = this.groqClients.length; // Only try different keys, not models
    
    // Model is fixed - always use llama-3.3-70b-versatile
    const startingKeyIndex = this.currentKeyIndex;
    let keyAttempts = 0;
    
    for (let totalAttempt = 0; totalAttempt < maxKeyAttempts; totalAttempt++) {
      try {
        // Log key usage for debugging (model is always the same)
        if (this.groqApiKeys.length > 1 && this.currentKeyIndex !== startingKeyIndex) {
          Logger.info(`🔄 Using key: ${this.currentKeyIndex + 1}/${this.groqApiKeys.length} (attempt ${totalAttempt + 1}/${maxKeyAttempts})`);
        }
        
        const groqResponse = await this.chatWithGroq(messages, options);
        
        // Extract content and tokenUsage from response
        const response = typeof groqResponse === 'object' && groqResponse.content !== undefined 
          ? groqResponse.content 
          : groqResponse;
        const tokenUsage = typeof groqResponse === 'object' && groqResponse.tokenUsage !== undefined
          ? groqResponse.tokenUsage
          : null;
        
        // Return response with token usage
        if (tokenUsage) {
          return { content: response, tokenUsage: tokenUsage };
        }
        
        return typeof response === 'object' && response.content !== undefined ? response : { content: response, tokenUsage: null };
      } catch (error) {
        lastError = error;
        
        // Extract error message from various possible error structures
        let errorMessage = '';
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (error?.error?.message) {
          errorMessage = error.error.message;
        } else if (error?.error && typeof error.error === 'string') {
          errorMessage = error.error;
        } else {
          errorMessage = JSON.stringify(error);
        }
        
        // Check if it's a rate limit error (429)
        // Groq can return rate limits for both requests and tokens
        const isRateLimit = error?.status === 429 || 
                           error?.code === 'rate_limit_exceeded' ||
                           errorMessage?.includes('429') || 
                           errorMessage?.includes('rate_limit_exceeded') ||
                           errorMessage?.includes('Rate limit reached') ||
                           errorMessage?.includes('tokens per day (TPD)') ||
                           errorMessage?.includes('"type":"tokens"') ||
                           (error?.error?.type === 'tokens' || error?.error?.code === 'rate_limit_exceeded');
        
        if (isRateLimit) {
          // Mark current key as exhausted
          const exhaustedKeyIndex = this.currentKeyIndex;
          
          // Parse retry time from error message (e.g., "Please try again in 1h5m2.688s")
          let cooldownMs = 60 * 60 * 1000; // Default: 1 hour
          const retryTimeMatch = errorMessage.match(/try again in ([\dhms.]+)/i);
          if (retryTimeMatch) {
            const timeString = retryTimeMatch[1];
            let totalMs = 0;
            
            // Parse hours (e.g., "1h")
            const hoursMatch = timeString.match(/([\d.]+)h/i);
            if (hoursMatch) {
              totalMs += parseFloat(hoursMatch[1]) * 60 * 60 * 1000;
            }
            
            // Parse minutes (e.g., "5m")
            const minutesMatch = timeString.match(/([\d.]+)m/i);
            if (minutesMatch) {
              totalMs += parseFloat(minutesMatch[1]) * 60 * 1000;
            }
            
            // Parse seconds (e.g., "2.688s")
            const secondsMatch = timeString.match(/([\d.]+)s/i);
            if (secondsMatch) {
              totalMs += parseFloat(secondsMatch[1]) * 1000;
            }
            
            if (totalMs > 0) {
              // Add 10% buffer to ensure we don't retry too early
              cooldownMs = Math.ceil(totalMs * 1.1);
            }
          }
          
          // Check if it's a token-based rate limit (TPD)
          const isTokenLimit = errorMessage.includes('tokens per day (TPD)') || 
                              errorMessage.includes('"type":"tokens"') ||
                              error?.error?.type === 'tokens';
          
          // Extract organization ID from error (if available)
          const orgMatch = errorMessage.match(/organization `([^`]+)`/);
          const organizationId = orgMatch ? orgMatch[1] : null;
          
          // Extract token usage info if available
          const tokenLimitMatch = errorMessage.match(/Limit (\d+), Used (\d+), Requested (\d+)/);
          if (tokenLimitMatch) {
            const [, limit, used, requested] = tokenLimitMatch;
            Logger.warn(`⚠️  Token limit (TPD) reached on key ${exhaustedKeyIndex + 1}: ${used}/${limit} tokens used, requested ${requested}. Cooldown: ${Math.round(cooldownMs / 60000)} minutes`);
            
            // Warn if all keys are from the same organization (they share the limit)
            if (organizationId && this.groqApiKeys.length > 1) {
              Logger.warn(`⚠️  IMPORTANT: All API keys appear to be from the same organization (${organizationId.substring(0, 20)}...)`);
              Logger.warn(`⚠️  Multiple keys from the same account share the same token limit (${limit} tokens/day)`);
              Logger.warn(`⚠️  To increase capacity, you need API keys from DIFFERENT Groq accounts/organizations`);
            }
          } else if (isTokenLimit) {
            Logger.warn(`⚠️  Token limit (TPD) reached on key ${exhaustedKeyIndex + 1}. Cooldown: ${Math.round(cooldownMs / 60000)} minutes`);
            if (organizationId && this.groqApiKeys.length > 1) {
              Logger.warn(`⚠️  All keys from same organization (${organizationId.substring(0, 20)}...) - they share the token limit`);
            }
          } else {
            Logger.warn(`⚠️  Rate limit reached on key ${exhaustedKeyIndex + 1}. Cooldown: ${Math.round(cooldownMs / 60000)} minutes`);
          }
          
          this.markKeyExhausted(exhaustedKeyIndex, cooldownMs);
          
          // Try switching to next API key first (preferred over model switch)
          if (this.groqApiKeys.length > 1 && keyAttempts < maxKeyAttempts - 1) {
            // Find next available key (skip exhausted ones)
            const nextAvailableKey = this.findNextAvailableKey();
            if (nextAvailableKey !== exhaustedKeyIndex) {
              this.currentKeyIndex = nextAvailableKey;
              this.groqClient = this.groqClients[this.currentKeyIndex];
              this.keySwitchCount++;
              keyAttempts++;
              Logger.warn(`⚠️  Rate limit on key ${exhaustedKeyIndex + 1}. Switching to key ${this.currentKeyIndex + 1}/${this.groqApiKeys.length}`);
              continue;
            }
          }
          
          // Model is fixed - cannot switch. If all keys exhausted, wait and retry
          if (keyAttempts >= maxKeyAttempts - 1) {
            Logger.warn(`🔒 All keys exhausted. Model fixed to ${this.groqModel}. Waiting before retry...`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
            // Reset key attempts to try all keys again
            keyAttempts = 0;
            continue;
          }
        }
        
        // If not a rate limit error, or we've exhausted all options, throw
        break;
      }
    }
    
    // All keys failed (model is fixed, so we only try keys)
    Logger.error(`❌ All ${maxKeyAttempts} keys exhausted. Model fixed to ${this.groqModel}. Last error: ${lastError?.message}`);
    throw lastError;
  }

  /**
   * Get next available API key (round-robin or least-used)
   * @returns {number} Index of the next available key
   */
  getNextAvailableKey() {
    if (this.groqClients.length === 0) {
      return 0;
    }
    
    // Check if current key is exhausted
    const currentKeyStats = this.keyUsageStats[this.currentKeyIndex];
    const now = Date.now();
    
    // If current key is exhausted, check if cooldown period has passed
    if (currentKeyStats?.exhausted && currentKeyStats?.exhaustedUntil) {
      if (now < currentKeyStats.exhaustedUntil) {
        // Key still in cooldown, find next available key
        return this.findNextAvailableKey();
      } else {
        // Cooldown passed, reset exhausted status
        currentKeyStats.exhausted = false;
        currentKeyStats.exhaustedUntil = null;
        Logger.info(`🔄 Key ${this.currentKeyIndex} cooldown expired, re-enabling`);
      }
    }
    
    // Round-robin: use current key, will increment after request
    return this.currentKeyIndex;
  }
  
  /**
   * Find next available key (not exhausted)
   * @returns {number} Index of available key
   */
  findNextAvailableKey() {
    const now = Date.now();
    let attempts = 0;
    let keyIndex = this.currentKeyIndex;
    
    // Try to find a non-exhausted key
    while (attempts < this.groqClients.length) {
      const stats = this.keyUsageStats[keyIndex];
      
      // Check if key is exhausted and still in cooldown
      if (!stats?.exhausted || (stats.exhaustedUntil && now >= stats.exhaustedUntil)) {
        // Key is available (not exhausted or cooldown expired)
        if (stats?.exhausted && stats.exhaustedUntil && now >= stats.exhaustedUntil) {
          // Reset exhausted status
          stats.exhausted = false;
          stats.exhaustedUntil = null;
          Logger.info(`🔄 Key ${keyIndex} cooldown expired, re-enabling`);
        }
        return keyIndex;
      }
      
      // Try next key
      keyIndex = (keyIndex + 1) % this.groqClients.length;
      attempts++;
    }
    
    // All keys exhausted, return current key anyway (will retry)
    Logger.warn(`⚠️ All keys appear exhausted, using key ${this.currentKeyIndex}`);
    return this.currentKeyIndex;
  }
  
  /**
   * Switch to next API key (round-robin)
   */
  switchToNextKey() {
    if (this.groqClients.length <= 1) {
      return; // No other keys to switch to
    }
    
    const oldKeyIndex = this.currentKeyIndex;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.groqClients.length;
    this.keySwitchCount++;
    this.groqClient = this.groqClients[this.currentKeyIndex];
    
    Logger.info(`🔄 Switched API key: ${oldKeyIndex} → ${this.currentKeyIndex} (switch #${this.keySwitchCount})`);
  }
  
  /**
   * Mark key as exhausted (rate limited)
   * @param {number} keyIndex - Index of the exhausted key
   * @param {number} cooldownMs - Cooldown period in milliseconds (default: 1 hour)
   */
  markKeyExhausted(keyIndex, cooldownMs = 60 * 60 * 1000) {
    const stats = this.keyUsageStats[keyIndex];
    if (stats) {
      stats.exhausted = true;
      stats.exhaustedUntil = Date.now() + cooldownMs;
      stats.rateLimits++;
      Logger.warn(`⚠️ Key ${keyIndex} marked as exhausted (cooldown: ${Math.round(cooldownMs / 60000)} minutes)`);
    }
  }
  
  /**
   * Format token count for display (e.g., 90000 -> "90k", 100000 -> "100k")
   * Uses Logger's formatTokens for consistency
   * @param {number} tokens - Token count
   * @returns {string} Formatted token string
   */
  formatTokens(tokens) {
    return Logger.formatTokens(tokens);
  }
  
  /**
   * Get usage statistics for all keys
   * @returns {Object} Statistics object
   */
  getKeyStats() {
    return {
      totalKeys: this.groqApiKeys.length,
      currentKeyIndex: this.currentKeyIndex,
      keySwitchCount: this.keySwitchCount,
      dailyTokenLimit: this.dailyTokenLimit,
      keys: Object.entries(this.keyUsageStats).map(([index, stats]) => ({
        index: Number.parseInt(index, 10),
        requests: stats.requests,
        rateLimits: stats.rateLimits,
        tokensUsed: stats.tokensUsed || 0,
        tokensRemaining: stats.tokensRemaining || this.dailyTokenLimit,
        effectiveRemaining: stats.effectiveRemaining || this.effectiveTokenLimit,
        tokensUsagePercent: ((stats.tokensUsed || 0) / this.dailyTokenLimit * 100).toFixed(1),
        tokensFormatted: `${this.formatTokens(stats.tokensUsed || 0)}/${this.formatTokens(this.dailyTokenLimit)}`,
        lastUsed: stats.lastUsed,
        exhausted: stats.exhausted,
        exhaustedUntil: stats.exhaustedUntil,
        isActive: Number.parseInt(index, 10) === this.currentKeyIndex
      }))
    };
  }
  
  /**
   * Reset daily statistics for all keys
   */
  resetKeyStats() {
    Object.keys(this.keyUsageStats).forEach(keyIndex => {
      const stats = this.keyUsageStats[keyIndex];
      stats.requests = 0;
      stats.rateLimits = 0;
      // Don't reset exhausted status or timestamps - let them expire naturally
    });
    Logger.info(`🔄 Reset daily key usage statistics`);
  }

  /**
   * Chat using Groq Cloud (Production - Ultra Fast)
   * IMPROVED: Multi-key support with round-robin rotation
   */
  async chatWithGroq(messages, options = {}) {
    // Get next available key (round-robin)
    const keyIndex = this.getNextAvailableKey();
    this.currentKeyIndex = keyIndex;
    this.groqClient = this.groqClients[keyIndex];
    
    // Update usage stats
    const stats = this.keyUsageStats[keyIndex];
    if (stats) {
      // Reset daily token count if it's a new day
      const today = new Date().toDateString();
      if (stats.lastResetDate !== today) {
        const previousUsed = stats.tokensUsed;
        stats.tokensUsed = 0;
        stats.tokensRemaining = this.dailyTokenLimit;
        stats.effectiveRemaining = this.effectiveTokenLimit;
        stats.lastResetDate = today;
        Logger.info(`🔄 Token counter reset for key ${keyIndex + 1} (new day) - Previous: ${this.formatTokens(previousUsed)}`);
      }
      
      // Check if key has enough tokens remaining (with safety margin)
      if (stats.tokensUsed >= this.effectiveTokenLimit) {
        Logger.warn(`⚠️  Key ${keyIndex + 1} has reached safety limit (${this.formatTokens(stats.tokensUsed)}/${this.formatTokens(this.dailyTokenLimit)}). Switching to next key...`);
        // Mark as exhausted and find next available key
        this.markKeyExhausted(keyIndex, 24 * 60 * 60 * 1000); // 24 hour cooldown
        throw new Error(`Key ${keyIndex + 1} token limit reached (safety margin: ${this.formatTokens(this.tokenSafetyMargin)})`);
      }
      
      stats.requests++;
      stats.lastUsed = Date.now();
    }
    
    // Only log key if using non-primary key (model is always fixed)
    if (this.groqApiKeys.length > 1 && keyIndex !== 0) {
      Logger.debug(`Using API key: ${keyIndex + 1}/${this.groqApiKeys.length} (model: ${this.groqModel})`);
    }
    
    // CONSISTENCY: Use very low temperature for ALL queries to ensure consistent responses
    // Lower temperature = more deterministic, less variation in responses
    // Detect if query is about dates/schedules for even lower temperature
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
    const isDateScheduleQuery = /\b(date|dates|schedule|schedules|calendar|event|when|deadline)\b/i.test(lastUserMessage);
    
    // Use very low temperature for maximum consistency
    // Base: 0.1 (very low for factual accuracy), even lower (0.05) for dates/schedules
    const baseTemperature = options.temperature ?? 0.1; // Reduced from 0.2 to 0.1 for better consistency
    const adjustedTemperature = isDateScheduleQuery ? 0.05 : baseTemperature; // Even lower for dates
    
    // TOKEN USAGE CONTROL: Dynamically adjust max_tokens based on remaining budget
    // Reduce max_tokens if key is running low on tokens to prevent hitting limit
    let maxTokens = options.maxTokens ?? 500; // Reduced default from 600 to 500
    if (stats) {
      const remainingPercent = (stats.tokensRemaining / this.dailyTokenLimit) * 100;
      
      // If less than 20% remaining, reduce max_tokens significantly
      if (remainingPercent < 20) {
        maxTokens = Math.min(maxTokens, 300); // Cap at 300 tokens
      } else if (remainingPercent < 40) {
        maxTokens = Math.min(maxTokens, 400); // Cap at 400 tokens
      } else if (remainingPercent < 60) {
        maxTokens = Math.min(maxTokens, 450); // Cap at 450 tokens
      }
      
      // Never exceed effective remaining tokens
      maxTokens = Math.min(maxTokens, Math.max(100, stats.effectiveRemaining - 100)); // Keep 100 token buffer
    }
    
    // FIXED MODEL: Always use llama-3.3-70b-versatile for all API keys
    // This ensures consistent intelligent responses across all requests
    // Verify model is correct before API call
    if (this.groqModel !== 'llama-3.3-70b-versatile') {
      Logger.error(`⚠️  MODEL MISMATCH: Expected llama-3.3-70b-versatile but got ${this.groqModel}. Fixing...`);
      this.groqModel = 'llama-3.3-70b-versatile';
    }
    
    Logger.debug(`🤖 API Call: model=${this.groqModel}, temperature=${adjustedTemperature}, max_tokens=${maxTokens}, key=${keyIndex + 1}`);
    
    const response = await this.groqClient.chat.completions.create({
      model: this.groqModel, // Fixed: 'llama-3.3-70b-versatile' - VERIFIED
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: adjustedTemperature, // Lower for consistency (0.1-0.2)
      max_tokens: maxTokens, // Dynamically adjusted based on remaining tokens
      top_p: options.topP ?? 0.9,
      stream: false, // Can enable for streaming responses
      stop: null
    });
    
    // Track token usage from response
    if (response?.usage && stats) {
      const usage = response.usage;
      
      // Token breakdown from Groq API response
      const promptTokens = usage.prompt_tokens || 0;      // Input tokens (system prompt + user query + context)
      const completionTokens = usage.completion_tokens || 0; // Output tokens (AI response)
      const tokensUsed = usage.total_tokens || 0;         // Total = promptTokens + completionTokens
      
      // Update cumulative stats
      stats.tokensUsed = (stats.tokensUsed || 0) + tokensUsed;
      stats.tokensRemaining = Math.max(0, this.dailyTokenLimit - stats.tokensUsed);
      stats.effectiveRemaining = Math.max(0, this.effectiveTokenLimit - stats.tokensUsed);
      
      // Format tokens for display using Logger's formatting methods
      const tokenUsageStr = Logger.formatTokenUsage(stats.tokensUsed, this.dailyTokenLimit);
      const remainingFormatted = Logger.formatTokens(stats.tokensRemaining);
      const effectiveFormatted = Logger.formatTokens(stats.effectiveRemaining);
      
      // Use Logger's tokenUsage method for consistent formatting
      Logger.tokenUsage(`Token usage (Key ${keyIndex + 1}): ${tokensUsed} total (${promptTokens} input + ${completionTokens} output)`, {
        used: stats.tokensUsed,
        limit: this.dailyTokenLimit,
        remaining: stats.tokensRemaining,
        input: promptTokens,
        output: completionTokens,
        total: tokensUsed,
        keyLabel: `Key ${keyIndex + 1}`
      });
      
      // Warn if input tokens are too high (main cost driver)
      if (promptTokens > 3000) {
        Logger.warn(`⚠️  HIGH INPUT TOKENS: ${promptTokens} tokens (system prompt + RAG context). Target: <2000 tokens per query.`);
      } else if (promptTokens > 2000) {
        Logger.info(`📊 Input tokens: ${promptTokens} (system prompt + user query + RAG context) - Consider reducing RAG context`);
      } else {
        Logger.debug(`   📥 Input tokens: ${promptTokens} (system prompt + user query + RAG context)`);
      }
      
      Logger.debug(`   📤 Output tokens: ${completionTokens} (max allowed: ${maxTokens})`);
      Logger.debug(`   📊 Daily usage: ${tokenUsageStr} (${effectiveFormatted} effective remaining)`);
      
      // Warn if approaching limit
      const usagePercent = (stats.tokensUsed / this.dailyTokenLimit) * 100;
      if (usagePercent >= 95) {
        Logger.warn(`🚨 Key ${keyIndex + 1} token usage at ${usagePercent.toFixed(1)}% (${remainingFormatted} remaining) - Near limit!`);
      } else if (usagePercent >= 90) {
        Logger.warn(`⚠️  Key ${keyIndex + 1} token usage at ${usagePercent.toFixed(1)}% (${remainingFormatted} remaining) - Approaching limit`);
      } else if (usagePercent >= 75) {
        Logger.warn(`⚠️  Key ${keyIndex + 1} token usage at ${usagePercent.toFixed(1)}% (${remainingFormatted} remaining)`);
      } else if (usagePercent >= 50) {
        Logger.info(`📊 Key ${keyIndex + 1} token usage: ${usedFormatted}/${limitFormatted} (${remainingFormatted} remaining)`);
      }
    }
    
    // Round-robin: increment key index for next request (only if multiple keys)
    // Note: This increment happens after successful request for next request
    if (this.groqApiKeys.length > 1) {
      const nextKeyIndex = (this.currentKeyIndex + 1) % this.groqClients.length;
      // Only increment if next key is not exhausted
      const nextKeyStats = this.keyUsageStats[nextKeyIndex];
      if (!nextKeyStats?.exhausted || (nextKeyStats.exhaustedUntil && Date.now() >= nextKeyStats.exhaustedUntil)) {
        this.currentKeyIndex = nextKeyIndex;
      }
      // If next key is exhausted, stay on current key for next request
    }
    
    // Return response with token usage metadata
    const content = response.choices[0]?.message?.content || '';
    
    // Store token usage in response object (not on string)
    const responseWithUsage = {
      content: content,
      tokenUsage: response?.usage ? {
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        totalTokens: response.usage.total_tokens || 0,
        tokensRemaining: stats?.tokensRemaining || 0,
        tokensUsed: stats?.tokensUsed || 0,
        dailyLimit: this.dailyTokenLimit,
        keyIndex: keyIndex + 1
      } : null
    };
    
    return responseWithUsage;
  }


  async generate(prompt, options = {}) {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  async isModelAvailable() {
    // Groq models are always available via API
    return true;
  }

  async pullModel() {
    Logger.info('Groq models are cloud-based, no pulling needed');
    return;
  }

  /**
   * Get current AI provider info
   */
  getProviderInfo() {
    return {
      provider: this.provider,
      model: this.groqModel, // Fixed model: llama-3.3-70b-versatile
      isCloud: true,
      isLocal: false,
      modelLocked: true, // Model is permanently locked
      multiKey: {
        totalKeys: this.groqApiKeys.length,
        currentKeyIndex: this.currentKeyIndex,
        keySwitchCount: this.keySwitchCount,
        keyStats: this.getKeyStats()
      }
    };
  }
  
  /**
   * Model is permanently locked to llama-3.3-70b-versatile
   * These methods are kept for API compatibility but do nothing
   */
  lockModel() {
    // Model is already permanently locked
    Logger.info(`🔒 Model is permanently locked to: ${this.groqModel}`);
  }
  
  /**
   * Cannot unlock model - it's permanently fixed
   */
  unlockModel() {
    Logger.warn(`⚠️ Model cannot be unlocked - permanently fixed to ${this.groqModel} for consistent responses`);
  }
  
  /**
   * Model is already set to llama-3.3-70b-versatile
   */
  resetToPrimaryModel() {
    // Model is already set correctly
    Logger.info(`Model is already set to: ${this.groqModel}`);
  }
}
