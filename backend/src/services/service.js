import Groq from 'groq-sdk';
import { Logger } from '../utils/logger.js';

/**
 * Groq AI Service
 * - Production: Uses Groq Cloud API (ultra-fast, cloud-based)
 * - Multi-key support: Rotates between multiple API keys for increased capacity
 * - Multi-model support: Switches between configured models when one runs out of tokens
 * 
 * Requires GROQ_API_KEY or GROQ_API_KEYS environment variable
 * Optional: GROQ_MODEL_1 and GROQ_MODEL_2 for model switching (defaults to llama-3.3-70b-versatile)
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
    this.modelFallbackPriority = (process.env.GROQ_MODEL_FALLBACK_PRIORITY || 'auto').toLowerCase();
    
    // Multi-model support: Parse models from environment variables
    // Default to llama-3.1-8b-instant as primary (faster, more token-efficient)
    const model1 = process.env.GROQ_MODEL_1 || 'llama-3.1-8b-instant';
    const model2 = process.env.GROQ_MODEL_2 || 'llama-3.3-70b-versatile';
    
    this.groqModels = [model1];
    if (model2) {
      this.groqModels.push(model2);
    }
    
    this.currentModelIndex = 0; // Current model index
    this.groqModel = this.groqModels[this.currentModelIndex]; // Current model
    this.modelLocked = false; // Allow model switching when tokens exhausted
    this.modelSwitchCount = 0; // Track model switches
    
    // Track token usage per model (shared across all keys for same model)
    this.modelUsageStats = {}; // { modelName: { tokensUsed: 0, tokensRemaining: 100000, exhausted: false, exhaustedUntil: null } }
    this.groqModels.forEach(model => {
      this.modelUsageStats[model] = {
        tokensUsed: 0,
        tokensRemaining: this.dailyTokenLimit,
        effectiveRemaining: this.effectiveTokenLimit,
        exhausted: false,
        exhaustedUntil: null,
        lastResetDate: new Date().toDateString()
      };
    });
    
    // Multi-key management
    this.currentKeyIndex = 0; // Current API key index (round-robin)
    this.keyUsageStats = {}; // Track usage per key: { keyIndex: { requests: 0, rateLimits: 0, tokensUsed: 0, tokensRemaining: 100000, organizationId: null, lastUsed: null, exhausted: false, exhaustedUntil: null } }
    this.keySwitchCount = 0; // Track total key switches
    this.groqClients = []; // Array of Groq client instances (one per key)
    this.dailyTokenLimit = 100000; // Groq free tier: 100,000 tokens per day per key
    this.tokenSafetyMargin = 5000; // Safety margin: Stop using key when 5k tokens remain to prevent hitting limit
    this.effectiveTokenLimit = this.dailyTokenLimit - this.tokenSafetyMargin; // 95k effective limit per key
    this.organizationMap = {}; // Track which organization each key belongs to: { organizationId: [keyIndex1, keyIndex2, ...] }
    
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
        organizationId: null, // Will be populated when we encounter rate limit errors
        lastUsed: null,
        exhausted: false,
        exhaustedUntil: null,
        lastResetDate: new Date().toDateString() // Track daily reset
      };
      return client;
    });
    
    // Set groqClient to first client
    this.groqClient = this.groqClients[0];
    
    Logger.success(`🚀 AI Provider: Groq Cloud - ${this.groqApiKeys.length} API key(s), ${this.groqModels.length} model(s) configured`);
    Logger.info(`   📊 Current model: ${this.groqModel}`);
    if (this.groqModels.length > 1) {
      Logger.info(`   ✅ Multi-model support enabled: ${this.groqModels.join(', ')}`);
      Logger.info(`   🔄 Models will switch automatically when one runs out of tokens`);
    }
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
      
      // Extract and clean error message
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      // If error message already contains a user-friendly message (from our cleanup), use it as-is
      // Otherwise, wrap it in a generic message
      if (errorMessage.includes('Groq API server error') || 
          errorMessage.includes('rate_limit_exceeded') ||
          errorMessage.includes('tokens per day')) {
        // Error message is already cleaned and user-friendly
        throw new Error(errorMessage);
      } else {
        // Generic error - provide user-friendly message
        throw new Error(`Failed to generate response: ${errorMessage}`);
      }
    }
  }

  /**
   * Chat with automatic key and model rotation on rate limit/token exhaustion
   * Supports both key switching and model switching for increased capacity
   */
  async chatWithGroqFallback(messages, options = {}) {
    let lastError = null;
    const maxKeyAttempts = this.groqClients.length;
    const maxModelAttempts = this.groqModels.length;
    const maxServerErrorRetries = 3; // Max retries per key/model for server errors
    
    const startingKeyIndex = this.currentKeyIndex;
    const startingModelIndex = this.currentModelIndex;
    let keyAttempts = 0;
    let modelAttempts = 0;
    const serverErrorRetries = {}; // Track retries per key: { keyIndex: retryCount }
    
    const maxTotalAttempts = Math.max(maxKeyAttempts, maxModelAttempts) * (maxServerErrorRetries + 1);
    for (let totalAttempt = 0; totalAttempt < maxTotalAttempts; totalAttempt++) {
      try {
        // Log key/model usage for debugging
        if (this.groqApiKeys.length > 1 && this.currentKeyIndex !== startingKeyIndex) {
          Logger.info(`🔄 Using key: ${this.currentKeyIndex + 1}/${this.groqApiKeys.length} (attempt ${totalAttempt + 1})`);
        }
        if (this.groqModels.length > 1 && this.currentModelIndex !== startingModelIndex) {
          Logger.info(`🔄 Using model: ${this.groqModel} (${this.currentModelIndex + 1}/${this.groqModels.length}, attempt ${totalAttempt + 1})`);
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
        
        // Clean up HTML error pages (e.g., from Cloudflare 500 errors)
        // Remove HTML tags and extract meaningful error info
        if (errorMessage.includes('<!DOCTYPE html>') || errorMessage.includes('<html')) {
          // Extract status code if present
          const statusMatch = errorMessage.match(/Error code (\d+)/i) || errorMessage.match(/(\d{3})/);
          const statusCode = statusMatch ? statusMatch[1] : '500';
          
          // Check if it's a server error from Cloudflare/Groq
          if (errorMessage.includes('Internal server error') || errorMessage.includes('500')) {
            errorMessage = `Groq API server error (${statusCode}): Internal server error. Please try again in a few moments.`;
          } else if (errorMessage.includes('Bad Gateway') || errorMessage.includes('502')) {
            errorMessage = `Groq API server error (502): Bad Gateway. Please try again in a few moments.`;
          } else if (errorMessage.includes('Service Unavailable') || errorMessage.includes('503')) {
            errorMessage = `Groq API server error (503): Service temporarily unavailable. Please try again in a few moments.`;
          } else if (errorMessage.includes('Gateway Timeout') || errorMessage.includes('504')) {
            errorMessage = `Groq API server error (504): Gateway timeout. Please try again in a few moments.`;
          } else {
            errorMessage = `Groq API server error (${statusCode}): Please try again in a few moments.`;
          }
        }
        
        // Get HTTP status code from error (check multiple possible locations)
        const httpStatus = error?.status || 
                          error?.statusCode || 
                          error?.response?.status ||
                          error?.response?.statusCode ||
                          (errorMessage.match(/Error code (\d+)/i) ? parseInt(errorMessage.match(/Error code (\d+)/i)[1]) : null) ||
                          (errorMessage.match(/\b(500|502|503|504)\b/) ? parseInt(errorMessage.match(/\b(500|502|503|504)\b/)[1]) : null);
        
        // Check if it's a server error (500, 502, 503, 504) - these are transient and should be retried
        const isServerError = httpStatus >= 500 && httpStatus < 600;
        
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
        
        // Handle server errors (500, 502, 503, 504) with retry logic
        if (isServerError) {
          const failedKeyIndex = this.currentKeyIndex;
          
          // Track retries for this key
          if (!serverErrorRetries[failedKeyIndex]) {
            serverErrorRetries[failedKeyIndex] = 0;
          }
          serverErrorRetries[failedKeyIndex]++;
          const retryCount = serverErrorRetries[failedKeyIndex];
          
          const baseDelay = 2000; // Base delay: 2 seconds
          const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 10000); // Max 10 seconds
          
          Logger.warn(`⚠️  Server error (${httpStatus}) on key ${failedKeyIndex + 1}, retry ${retryCount}/${maxServerErrorRetries}. Retrying in ${exponentialDelay / 1000}s...`);
          
          // If we haven't exceeded max retries for this key, wait and retry
          if (retryCount < maxServerErrorRetries) {
            await new Promise(resolve => setTimeout(resolve, exponentialDelay));
            continue; // Retry with same key
          } else {
            // Max retries exceeded for this key, try next key if available
            Logger.warn(`⚠️  Key ${failedKeyIndex + 1} failed after ${maxServerErrorRetries} retries due to server error (${httpStatus})`);
            
            if (this.groqApiKeys.length > 1 && keyAttempts < maxKeyAttempts - 1) {
              const nextAvailableKey = this.findNextAvailableKey(failedKeyIndex);
              if (nextAvailableKey !== failedKeyIndex) {
                const nextKeyStats = this.keyUsageStats[nextAvailableKey];
                const nextKeyOrg = nextKeyStats?.organizationId ? ` (org: ${nextKeyStats.organizationId.substring(0, 15)}...)` : '';
                this.currentKeyIndex = nextAvailableKey;
                this.groqClient = this.groqClients[this.currentKeyIndex];
                this.keySwitchCount++;
                keyAttempts++;
                // Reset retry count for new key
                serverErrorRetries[this.currentKeyIndex] = 0;
                Logger.info(`🔄 Switching to key ${this.currentKeyIndex + 1}/${this.groqApiKeys.length} due to server error${nextKeyOrg}`);
                // Wait a bit before retrying with new key
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }
            }
            // All retries and keys exhausted, break to throw error
            Logger.error(`❌ Server error (${httpStatus}) persisted after ${maxServerErrorRetries} retries on key ${failedKeyIndex + 1} and all available keys`);
            break;
          }
        }
        
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
          
          // Track organization ID for this key
          if (organizationId && this.keyUsageStats[exhaustedKeyIndex]) {
            this.keyUsageStats[exhaustedKeyIndex].organizationId = organizationId;
            
            // Build organization map: track which keys belong to which organization
            if (!this.organizationMap[organizationId]) {
              this.organizationMap[organizationId] = [];
            }
            if (!this.organizationMap[organizationId].includes(exhaustedKeyIndex)) {
              this.organizationMap[organizationId].push(exhaustedKeyIndex);
            }
          }
          
          // Extract token usage info if available
          const tokenLimitMatch = errorMessage.match(/Limit (\d+), Used (\d+), Requested (\d+)/);
          if (tokenLimitMatch) {
            const [, limit, used, requested] = tokenLimitMatch;
            Logger.warn(`⚠️  Token limit (TPD) reached on key ${exhaustedKeyIndex + 1}: ${used}/${limit} tokens used, requested ${requested}. Cooldown: ${Math.round(cooldownMs / 60000)} minutes`);
            
            // Check if all keys are from the same organization
            if (organizationId && this.groqApiKeys.length > 1) {
              const keysInSameOrg = this.organizationMap[organizationId] || [exhaustedKeyIndex];
              if (keysInSameOrg.length === this.groqApiKeys.length) {
                Logger.warn(`⚠️  IMPORTANT: All ${this.groqApiKeys.length} API keys are from the same organization (${organizationId.substring(0, 20)}...)`);
                Logger.warn(`⚠️  Multiple keys from the same account share the same token limit (${limit} tokens/day)`);
                Logger.warn(`⚠️  To increase capacity, you need API keys from DIFFERENT Groq accounts/organizations`);
              } else {
                const keysInOtherOrgs = this.groqApiKeys.length - keysInSameOrg.length;
                Logger.info(`ℹ️  Key ${exhaustedKeyIndex + 1} is from organization ${organizationId.substring(0, 20)}... (${keysInSameOrg.length} keys in this org, ${keysInOtherOrgs} keys in other orgs)`);
                Logger.info(`💡 Will try switching to keys from different organizations first`);
              }
            }
          } else if (isTokenLimit) {
            Logger.warn(`⚠️  Token limit (TPD) reached on key ${exhaustedKeyIndex + 1}. Cooldown: ${Math.round(cooldownMs / 60000)} minutes`);
            if (organizationId && this.groqApiKeys.length > 1) {
              const keysInSameOrg = this.organizationMap[organizationId] || [exhaustedKeyIndex];
              if (keysInSameOrg.length === this.groqApiKeys.length) {
                Logger.warn(`⚠️  All keys from same organization (${organizationId.substring(0, 20)}...) - they share the token limit`);
              } else {
                Logger.info(`ℹ️  Key ${exhaustedKeyIndex + 1} exhausted. ${this.groqApiKeys.length - keysInSameOrg.length} keys from different organizations available`);
              }
            }
          } else {
            Logger.warn(`⚠️  Rate limit reached on key ${exhaustedKeyIndex + 1}. Cooldown: ${Math.round(cooldownMs / 60000)} minutes`);
          }
          
          this.markKeyExhausted(exhaustedKeyIndex, cooldownMs);
          
          const preferModelFallback = this.modelFallbackPriority === 'model_first' || this.groqApiKeys.length === 1;
          if (preferModelFallback && this.groqModels.length > 1 && modelAttempts < maxModelAttempts - 1) {
            const switched = this.switchToNextModel('Rate limit detected.');
            if (switched) {
              modelAttempts++;
              keyAttempts = 0;
              continue;
            }
          }
          
          // Try switching to next API key first (preferred over model switch)
          if (this.groqApiKeys.length > 1 && keyAttempts < maxKeyAttempts - 1) {
            // Find next available key (prioritizes keys from different organizations)
            const nextAvailableKey = this.findNextAvailableKey(exhaustedKeyIndex);
            if (nextAvailableKey !== exhaustedKeyIndex) {
              const nextKeyStats = this.keyUsageStats[nextAvailableKey];
              const nextKeyOrg = nextKeyStats?.organizationId ? ` (org: ${nextKeyStats.organizationId.substring(0, 15)}...)` : '';
              this.currentKeyIndex = nextAvailableKey;
              this.groqClient = this.groqClients[this.currentKeyIndex];
              this.keySwitchCount++;
              keyAttempts++;
              Logger.warn(`⚠️  Rate limit on key ${exhaustedKeyIndex + 1}. Switching to key ${this.currentKeyIndex + 1}/${this.groqApiKeys.length}${nextKeyOrg}`);
              continue;
            }
          }
          
          // If all keys exhausted, try switching models (if multiple models configured)
          if (keyAttempts >= maxKeyAttempts - 1 && this.groqModels.length > 1 && modelAttempts < maxModelAttempts - 1) {
            const switched = this.switchToNextModel('All keys exhausted.');
            if (switched) {
              modelAttempts++;
              keyAttempts = 0;
              continue;
            }
          }
          
          // If all keys and models exhausted, wait and retry
          if (keyAttempts >= maxKeyAttempts - 1 && (this.groqModels.length === 1 || modelAttempts >= maxModelAttempts - 1)) {
            if (this.groqApiKeys.length === 1 && this.groqModels.length === 1) {
              Logger.warn(`🔒 Single API key and model exhausted. Waiting before retry...`);
            } else if (this.groqApiKeys.length === 1) {
              Logger.warn(`🔒 Single API key exhausted. All models tried. Waiting before retry...`);
            } else if (this.groqModels.length === 1) {
              Logger.warn(`🔒 All keys exhausted. Model fixed to ${this.groqModel}. Waiting before retry...`);
            } else {
              Logger.warn(`🔒 All keys and models exhausted. Waiting before retry...`);
            }
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
            // Reset attempts to try all keys/models again
            keyAttempts = 0;
            modelAttempts = 0;
            continue;
          }
        }
        
        // Check if it's a token limit error (model exhausted)
        const isTokenLimitError = errorMessage.includes('token limit reached') || 
                                 errorMessage.includes('All models exhausted') ||
                                 errorMessage.includes('Model') && errorMessage.includes('token limit');
        
        // If token limit error and multiple models, try switching models
        if (isTokenLimitError && this.groqModels.length > 1 && modelAttempts < maxModelAttempts - 1) {
          const switched = this.switchToNextModel('Model token limit reached.');
          if (switched) {
            modelAttempts++;
            keyAttempts = 0;
            continue;
          }
        }
        
        // If not a rate limit or token limit error, or we've exhausted all options, throw
        break;
      }
    }
    
    // All keys/models failed
    // Clean up error message if it contains HTML
    let finalErrorMessage = lastError?.message || 'Unknown error';
    if (finalErrorMessage.includes('<!DOCTYPE html>') || finalErrorMessage.includes('<html')) {
      const statusMatch = finalErrorMessage.match(/Error code (\d+)/i) || finalErrorMessage.match(/(\d{3})/);
      const statusCode = statusMatch ? statusMatch[1] : '500';
      finalErrorMessage = `Groq API server error (${statusCode}): The service is temporarily unavailable. Please try again in a few moments.`;
    }
    
    if (this.groqModels.length > 1) {
      Logger.error(`❌ All ${maxKeyAttempts} keys and ${maxModelAttempts} models exhausted. Last error: ${finalErrorMessage}`);
    } else {
      Logger.error(`❌ All ${maxKeyAttempts} keys exhausted. Model: ${this.groqModel}. Last error: ${finalErrorMessage}`);
    }
    
    // Create a new error with cleaned message
    const cleanedError = new Error(finalErrorMessage);
    if (lastError?.stack) {
      cleanedError.stack = lastError.stack;
    }
    throw cleanedError;
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
   * Prioritizes keys from different organizations if current key's org is exhausted
   * @param {number} exhaustedKeyIndex - Index of the exhausted key (optional)
   * @returns {number} Index of available key
   */
  findNextAvailableKey(exhaustedKeyIndex = null) {
    const now = Date.now();
    let attempts = 0;
    let keyIndex = this.currentKeyIndex;
    
    // If we know which key is exhausted, try to find a key from a different organization first
    let exhaustedOrgId = null;
    if (exhaustedKeyIndex !== null && this.keyUsageStats[exhaustedKeyIndex]) {
      exhaustedOrgId = this.keyUsageStats[exhaustedKeyIndex].organizationId;
    }
    
    // First pass: Try to find a key from a different organization (if we know the exhausted org)
    if (exhaustedOrgId && this.organizationMap[exhaustedOrgId]) {
      const keysInExhaustedOrg = this.organizationMap[exhaustedOrgId];
      const keysInOtherOrgs = Array.from({ length: this.groqClients.length }, (_, i) => i)
        .filter(i => !keysInExhaustedOrg.includes(i));
      
      // Try keys from different organizations first
      for (const otherKeyIndex of keysInOtherOrgs) {
        const stats = this.keyUsageStats[otherKeyIndex];
        if (!stats?.exhausted || (stats.exhaustedUntil && now >= stats.exhaustedUntil)) {
          if (stats?.exhausted && stats.exhaustedUntil && now >= stats.exhaustedUntil) {
            stats.exhausted = false;
            stats.exhaustedUntil = null;
            Logger.info(`🔄 Key ${otherKeyIndex + 1} cooldown expired, re-enabling`);
          }
          Logger.info(`🔄 Switching to key ${otherKeyIndex + 1} from different organization (avoiding exhausted org)`);
          return otherKeyIndex;
        }
      }
    }
    
    // Second pass: Try to find any non-exhausted key (round-robin)
    keyIndex = (this.currentKeyIndex + 1) % this.groqClients.length;
    while (attempts < this.groqClients.length) {
      const stats = this.keyUsageStats[keyIndex];
      
      // Check if key is exhausted and still in cooldown
      if (!stats?.exhausted || (stats.exhaustedUntil && now >= stats.exhaustedUntil)) {
        // Key is available (not exhausted or cooldown expired)
        if (stats?.exhausted && stats.exhaustedUntil && now >= stats.exhaustedUntil) {
          // Reset exhausted status
          stats.exhausted = false;
          stats.exhaustedUntil = null;
          Logger.info(`🔄 Key ${keyIndex + 1} cooldown expired, re-enabling`);
        }
        return keyIndex;
      }
      
      // Try next key
      keyIndex = (keyIndex + 1) % this.groqClients.length;
      attempts++;
    }
    
    // All keys exhausted, return current key anyway (will retry)
    Logger.warn(`⚠️ All keys appear exhausted, using key ${this.currentKeyIndex + 1}`);
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
   * Switch to the next available model (if any)
   * @param {string} reason - Optional log message prefix
   * @returns {boolean} Whether a new model was selected
   */
  switchToNextModel(reason = '') {
    if (this.groqModels.length <= 1) {
      return false;
    }
    
    const nextModelIndex = this.findNextAvailableModel();
    if (nextModelIndex === this.currentModelIndex) {
      return false;
    }
    
    const previousModel = this.groqModel;
    this.currentModelIndex = nextModelIndex;
    this.groqModel = this.groqModels[this.currentModelIndex];
    this.modelSwitchCount++;
    
    const message = reason
      ? `🔄 ${reason} Switching model ${previousModel} → ${this.groqModel}`
      : `🔄 Switching model ${previousModel} → ${this.groqModel}`;
    Logger.warn(message);
    return true;
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
   * Find next available model (not exhausted)
   * @returns {number} Index of available model
   */
  findNextAvailableModel() {
    const now = Date.now();
    let attempts = 0;
    let modelIndex = this.currentModelIndex;
    
    // Try to find a non-exhausted model
    while (attempts < this.groqModels.length) {
      const modelName = this.groqModels[modelIndex];
      const stats = this.modelUsageStats[modelName];
      
      // Check if model is exhausted and still in cooldown
      if (!stats?.exhausted || (stats.exhaustedUntil && now >= stats.exhaustedUntil)) {
        // Model is available (not exhausted or cooldown expired)
        if (stats?.exhausted && stats.exhaustedUntil && now >= stats.exhaustedUntil) {
          // Reset exhausted status
          stats.exhausted = false;
          stats.exhaustedUntil = null;
          Logger.info(`🔄 Model ${modelName} cooldown expired, re-enabling`);
        }
        return modelIndex;
      }
      
      // Try next model
      modelIndex = (modelIndex + 1) % this.groqModels.length;
      attempts++;
    }
    
    // All models exhausted, return current model anyway (will retry)
    Logger.warn(`⚠️ All models appear exhausted, using model ${this.groqModels[this.currentModelIndex]}`);
    return this.currentModelIndex;
  }
  
  /**
   * Mark model as exhausted (out of tokens)
   * @param {string} modelName - Name of the exhausted model
   * @param {number} cooldownMs - Cooldown period in milliseconds (default: 24 hours)
   */
  markModelExhausted(modelName, cooldownMs = 24 * 60 * 60 * 1000) {
    const stats = this.modelUsageStats[modelName];
    if (stats) {
      stats.exhausted = true;
      stats.exhaustedUntil = Date.now() + cooldownMs;
      Logger.warn(`⚠️ Model ${modelName} marked as exhausted (cooldown: ${Math.round(cooldownMs / 60000)} minutes)`);
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
      organizationMap: this.organizationMap, // Show which keys belong to which organizations
      keys: Object.entries(this.keyUsageStats).map(([index, stats]) => ({
        index: Number.parseInt(index, 10),
        requests: stats.requests,
        rateLimits: stats.rateLimits,
        tokensUsed: stats.tokensUsed || 0,
        tokensRemaining: stats.tokensRemaining || this.dailyTokenLimit,
        effectiveRemaining: stats.effectiveRemaining || this.effectiveTokenLimit,
        tokensUsagePercent: ((stats.tokensUsed || 0) / this.dailyTokenLimit * 100).toFixed(1),
        tokensFormatted: `${this.formatTokens(stats.tokensUsed || 0)}/${this.formatTokens(this.dailyTokenLimit)}`,
        organizationId: stats.organizationId || 'unknown',
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
   * IMPROVED: Multi-key and multi-model support with automatic switching
   */
  async chatWithGroq(messages, options = {}) {
    // Get next available key (round-robin)
    const keyIndex = this.getNextAvailableKey();
    this.currentKeyIndex = keyIndex;
    this.groqClient = this.groqClients[keyIndex];
    
    // Get current model and check if it has tokens available
    const currentModel = this.groqModels[this.currentModelIndex];
    const modelStats = this.modelUsageStats[currentModel];
    
    // Reset daily token count for model if it's a new day
    if (modelStats) {
      const today = new Date().toDateString();
      if (modelStats.lastResetDate !== today) {
        const previousUsed = modelStats.tokensUsed;
        modelStats.tokensUsed = 0;
        modelStats.tokensRemaining = this.dailyTokenLimit;
        modelStats.effectiveRemaining = this.effectiveTokenLimit;
        modelStats.exhausted = false;
        modelStats.exhaustedUntil = null;
        modelStats.lastResetDate = today;
        Logger.info(`🔄 Token counter reset for model ${currentModel} (new day) - Previous: ${this.formatTokens(previousUsed)}`);
      }
      
      // Check if current model has enough tokens remaining (with safety margin)
      if (modelStats.tokensUsed >= this.effectiveTokenLimit || modelStats.exhausted) {
        // Try to switch to next available model
        if (this.groqModels.length > 1) {
          const nextModelIndex = this.findNextAvailableModel();
          if (nextModelIndex !== this.currentModelIndex) {
            this.currentModelIndex = nextModelIndex;
            this.groqModel = this.groqModels[this.currentModelIndex];
            this.modelSwitchCount++;
            Logger.warn(`🔄 Model ${currentModel} exhausted. Switching to model: ${this.groqModel}`);
          } else {
            // All models exhausted, mark current model and throw error
            this.markModelExhausted(currentModel, 24 * 60 * 60 * 1000);
            throw new Error(`All models exhausted. Model ${currentModel} token limit reached (safety margin: ${this.formatTokens(this.tokenSafetyMargin)})`);
          }
        } else {
          // Single model, mark as exhausted and throw error
          this.markModelExhausted(currentModel, 24 * 60 * 60 * 1000);
          throw new Error(`Model ${currentModel} token limit reached (safety margin: ${this.formatTokens(this.tokenSafetyMargin)})`);
        }
      }
    }
    
    // Update key usage stats
    const stats = this.keyUsageStats[keyIndex];
    if (stats) {
      stats.requests++;
      stats.lastUsed = Date.now();
    }
    
    // Log key and model usage
    if (this.groqApiKeys.length > 1 && keyIndex !== 0) {
      Logger.debug(`Using API key: ${keyIndex + 1}/${this.groqApiKeys.length} (model: ${this.groqModel})`);
    } else if (this.groqModels.length > 1) {
      Logger.debug(`Using model: ${this.groqModel} (${this.currentModelIndex + 1}/${this.groqModels.length})`);
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
    // Use model stats instead of key stats for token limits
    // CRITICAL: For llama-3.1-8b-instant, keep maxTokens low to avoid TPM limits (6000 TPM)
    let maxTokens = options.maxTokens ?? 300; // Reduced default to 300 for chatbot model
    const currentModelStats = this.modelUsageStats[this.groqModel];
    if (currentModelStats) {
      const remainingPercent = (currentModelStats.tokensRemaining / this.dailyTokenLimit) * 100;
      
      // If less than 20% remaining, reduce max_tokens significantly
      if (remainingPercent < 20) {
        maxTokens = Math.min(maxTokens, 300); // Cap at 300 tokens
      } else if (remainingPercent < 40) {
        maxTokens = Math.min(maxTokens, 400); // Cap at 400 tokens
      } else if (remainingPercent < 60) {
        maxTokens = Math.min(maxTokens, 450); // Cap at 450 tokens
      }
      
      // Never exceed effective remaining tokens for the model
      maxTokens = Math.min(maxTokens, Math.max(100, currentModelStats.effectiveRemaining - 100)); // Keep 100 token buffer
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
    
    // Track token usage from response (per model, not per key)
    const currentModelStatsForTracking = this.modelUsageStats[this.groqModel];
    if (response?.usage && currentModelStatsForTracking) {
      const usage = response.usage;
      
      // Token breakdown from Groq API response
      const promptTokens = usage.prompt_tokens || 0;      // Input tokens (system prompt + user query + context)
      const completionTokens = usage.completion_tokens || 0; // Output tokens (AI response)
      const tokensUsed = usage.total_tokens || 0;         // Total = promptTokens + completionTokens
      
      // Update cumulative stats for the model
      currentModelStatsForTracking.tokensUsed = (currentModelStatsForTracking.tokensUsed || 0) + tokensUsed;
      currentModelStatsForTracking.tokensRemaining = Math.max(0, this.dailyTokenLimit - currentModelStatsForTracking.tokensUsed);
      currentModelStatsForTracking.effectiveRemaining = Math.max(0, this.effectiveTokenLimit - currentModelStatsForTracking.tokensUsed);
      
      // Format tokens for display using Logger's formatting methods
      const tokenUsageStr = Logger.formatTokenUsage(currentModelStatsForTracking.tokensUsed, this.dailyTokenLimit);
      const remainingFormatted = Logger.formatTokens(currentModelStatsForTracking.tokensRemaining);
      const effectiveFormatted = Logger.formatTokens(currentModelStatsForTracking.effectiveRemaining);
      
      // Use Logger's tokenUsage method for consistent formatting
      Logger.tokenUsage(`Token usage (Model ${this.groqModel}): ${tokensUsed} total (${promptTokens} input + ${completionTokens} output)`, {
        used: currentModelStatsForTracking.tokensUsed,
        limit: this.dailyTokenLimit,
        remaining: currentModelStatsForTracking.tokensRemaining,
        input: promptTokens,
        output: completionTokens,
        total: tokensUsed,
        keyLabel: `Model ${this.groqModel}`
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
      
      // Warn if approaching limit (use model stats)
      const usagePercent = (currentModelStatsForTracking.tokensUsed / this.dailyTokenLimit) * 100;
      const usedFormatted = Logger.formatTokens(currentModelStatsForTracking.tokensUsed);
      const limitFormatted = Logger.formatTokens(this.dailyTokenLimit);
      
      if (usagePercent >= 95) {
        Logger.warn(`🚨 Model ${this.groqModel} token usage at ${usagePercent.toFixed(1)}% (${remainingFormatted} remaining) - Near limit!`);
      } else if (usagePercent >= 90) {
        Logger.warn(`⚠️  Model ${this.groqModel} token usage at ${usagePercent.toFixed(1)}% (${remainingFormatted} remaining) - Approaching limit`);
      } else if (usagePercent >= 75) {
        Logger.warn(`⚠️  Model ${this.groqModel} token usage at ${usagePercent.toFixed(1)}% (${remainingFormatted} remaining)`);
      } else if (usagePercent >= 50) {
        Logger.info(`📊 Model ${this.groqModel} token usage: ${usedFormatted}/${limitFormatted} (${remainingFormatted} remaining)`);
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
    const currentModelStatsForResponse = this.modelUsageStats[this.groqModel];
    
    // Store token usage in response object (not on string)
    const responseWithUsage = {
      content: content,
      tokenUsage: response?.usage ? {
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        totalTokens: response.usage.total_tokens || 0,
        tokensRemaining: currentModelStatsForResponse?.tokensRemaining || 0,
        tokensUsed: currentModelStatsForResponse?.tokensUsed || 0,
        dailyLimit: this.dailyTokenLimit,
        model: this.groqModel,
        modelIndex: this.currentModelIndex + 1,
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
      model: this.groqModel,
      models: this.groqModels,
      currentModelIndex: this.currentModelIndex,
      isCloud: true,
      isLocal: false,
      modelLocked: this.modelLocked,
      modelSwitchCount: this.modelSwitchCount,
      multiKey: {
        totalKeys: this.groqApiKeys.length,
        currentKeyIndex: this.currentKeyIndex,
        keySwitchCount: this.keySwitchCount,
        keyStats: this.getKeyStats()
      },
      multiModel: {
        totalModels: this.groqModels.length,
        currentModelIndex: this.currentModelIndex,
        modelSwitchCount: this.modelSwitchCount,
        modelStats: Object.entries(this.modelUsageStats).map(([modelName, stats]) => ({
          model: modelName,
          tokensUsed: stats.tokensUsed || 0,
          tokensRemaining: stats.tokensRemaining || this.dailyTokenLimit,
          effectiveRemaining: stats.effectiveRemaining || this.effectiveTokenLimit,
          exhausted: stats.exhausted,
          exhaustedUntil: stats.exhaustedUntil,
          isActive: modelName === this.groqModel
        }))
      }
    };
  }
  
  /**
   * Lock model switching (disable automatic model switching)
   */
  lockModel() {
    this.modelLocked = true;
    Logger.info(`🔒 Model switching locked. Current model: ${this.groqModel}`);
  }
  
  /**
   * Unlock model switching (enable automatic model switching)
   */
  unlockModel() {
    this.modelLocked = false;
    Logger.info(`🔓 Model switching unlocked. Models will switch automatically when tokens exhausted.`);
  }
  
  /**
   * Reset to primary model (first model in the list)
   */
  resetToPrimaryModel() {
    this.currentModelIndex = 0;
    this.groqModel = this.groqModels[0];
    Logger.info(`🔄 Reset to primary model: ${this.groqModel}`);
  }
}
