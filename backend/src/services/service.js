import Groq from 'groq-sdk';
import { Ollama } from 'ollama';
import { Logger } from '../utils/logger.js';

/**
 * Hybrid AI Service
 * - Local Development: Uses Ollama (GPU-accelerated on your RTX 3050)
 * - Production/Cloud: Uses Groq (20-40x faster, cloud-based)
 * 
 * Auto-detects environment based on GROQ_API_KEY presence
 */
export class LlamaService {
  constructor() {
    // Detect environment: If GROQ_API_KEY exists, use Groq (production)
    this.useGroq = !!process.env.GROQ_API_KEY;
    this.provider = this.useGroq ? 'groq' : 'ollama';
    
    // Ollama configuration (local development)
    this.config = {
      host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
      model: process.env.LLAMA_MODEL || 'phi3:mini',
      temperature: Number.parseFloat(process.env.TEMPERATURE || '0.7'),
      maxTokens: Number.parseInt(process.env.MAX_TOKENS || '1024', 10),
      gpuLayers: Number.parseInt(process.env.GPU_LAYERS || '33', 10),
      numGpu: Number.parseInt(process.env.NUM_GPU || '1', 10),
      numThread: Number.parseInt(process.env.NUM_THREAD || '12', 10),
      numCtx: Number.parseInt(process.env.NUM_CTX || '2048', 10),
      numBatch: Number.parseInt(process.env.NUM_BATCH || '1024', 10),
      repeatPenalty: Number.parseFloat(process.env.REPEAT_PENALTY || '1.1'),
      useMlock: process.env.USE_MLOCK === 'true',
      useMmap: process.env.USE_MMAP !== 'false'
    };
    
    // Groq model fallback list (in priority order)
    this.groqModels = [
      'llama-3.3-70b-versatile',              // Primary: Fast + High Quality
      'llama-3.1-8b-instant',                 // Fallback 1: Faster, smaller
      'meta-llama/llama-4-scout-17b-16e-instruct', // Fallback 2
      'openai/gpt-oss-120b'                   // Fallback 4
    ];
    this.currentModelIndex = 0;
    
    // Initialize appropriate client
    if (this.useGroq) {
      this.groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
      this.groqModel = this.groqModels[this.currentModelIndex];
      Logger.success(`🚀 AI Provider: Groq Cloud (${this.groqModel}) - Ultra-fast responses`);
    } else {
      this.client = new Ollama({ host: this.config.host });
      Logger.info(`💻 AI Provider: Ollama Local (${this.config.model}) - Using GPU`);
    }
  }

  async chat(messages, options = {}) {
    try {
      // Route to appropriate provider
      if (this.useGroq) {
        return await this.chatWithGroqFallback(messages, options);
      } else {
        return await this.chatWithOllama(messages, options);
      }
    } catch (error) {
      console.error(`${this.provider.toUpperCase()} chat error:`, error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Chat with automatic model fallback on rate limit
   */
  async chatWithGroqFallback(messages, options = {}) {
    let lastError = null;
    const maxAttempts = this.groqModels.length;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        this.groqModel = this.groqModels[this.currentModelIndex];
        const response = await this.chatWithGroq(messages, options);
        
        // Success! Reset to primary model for next time
        if (this.currentModelIndex !== 0) {
          Logger.info(`✅ Successfully switched back to primary model: ${this.groqModels[0]}`);
          this.currentModelIndex = 0;
        }
        
        return response;
      } catch (error) {
        lastError = error;
        
        // Check if it's a rate limit error (429)
        const isRateLimit = error.message?.includes('429') || 
                           error.message?.includes('rate_limit_exceeded') ||
                           error.status === 429;
        
        if (isRateLimit && attempt < maxAttempts - 1) {
          // Try next model
          this.currentModelIndex = (this.currentModelIndex + 1) % this.groqModels.length;
          Logger.warn(`⚠️  Rate limit hit on ${this.groqModel}. Switching to: ${this.groqModels[this.currentModelIndex]}`);
          continue;
        }
        
        // If not a rate limit error, or we've tried all models, throw
        break;
      }
    }
    
    // All models failed
    Logger.error(`❌ All ${maxAttempts} models exhausted. Last error: ${lastError?.message}`);
    throw lastError;
  }

  /**
   * Chat using Groq Cloud (Production - Ultra Fast)
   */
  async chatWithGroq(messages, options = {}) {
    Logger.info(`🤖 Using model: ${this.groqModel}`);
    
    const response = await this.groqClient.chat.completions.create({
      model: this.groqModel,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1000,
      top_p: options.topP ?? 0.9,
      stream: false, // Can enable for streaming responses
      stop: null
    });
    
    return response.choices[0]?.message?.content || '';
  }

  /**
   * Chat using Ollama Local (Development - GPU Accelerated)
   */
  async chatWithOllama(messages, options = {}) {
    const chatOptions = {
      model: this.config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      options: {
        temperature: options.temperature ?? this.config.temperature,
        num_predict: options.maxTokens ?? this.config.maxTokens,
        num_gpu: options.numGpu ?? this.config.numGpu ?? 1,
        num_thread: options.numThread ?? this.config.numThread ?? 12,
        num_ctx: options.numCtx ?? this.config.numCtx ?? 2048,
        num_batch: options.numBatch ?? this.config.numBatch ?? 1024,
        repeat_penalty: options.repeatPenalty ?? this.config.repeatPenalty ?? 1.1,
        top_p: options.topP ?? 0.9,
        top_k: options.topK ?? 40,
        use_mlock: options.useMlock ?? this.config.useMlock ?? true,
        use_mmap: options.useMmap ?? this.config.useMmap ?? true,
        gpu_layers: options.gpuLayers ?? this.config.gpuLayers ?? 33,
      }
    };

    const response = await this.client.chat(chatOptions);
    return response.message.content;
  }

  async generate(prompt, options = {}) {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  async isModelAvailable() {
    if (this.useGroq) {
      // Groq models are always available via API
      return true;
    }
    
    try {
      const models = await this.client.list();
      return models.models.some(model => model.name === this.config.model);
    } catch (error) {
      console.error('Error checking model availability:', error);
      return false;
    }
  }

  async pullModel() {
    if (this.useGroq) {
      Logger.info('Groq models are cloud-based, no pulling needed');
      return;
    }
    
    try {
      console.log(`Pulling model ${this.config.model}...`);
      await this.client.pull({ model: this.config.model, stream: false });
      console.log(`Model ${this.config.model} pulled successfully`);
    } catch (error) {
      console.error('Error pulling model:', error);
      throw new Error(`Failed to pull model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current AI provider info
   */
  getProviderInfo() {
    return {
      provider: this.provider,
      model: this.useGroq ? this.groqModel : this.config.model,
      isCloud: this.useGroq,
      isLocal: !this.useGroq
    };
  }
}
