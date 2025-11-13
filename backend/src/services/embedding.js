/**
 * Embedding Service
 * Handles text-to-vector embeddings using transformer models
 * Optimized for semantic search and RAG applications
 */

import { pipeline } from '@xenova/transformers';
import { Logger } from '../utils/logger.js';

class EmbeddingService {
  constructor() {
    this.model = null;
    this.modelName = 'Xenova/all-MiniLM-L6-v2'; // 384 dimensions
    this.dimension = 384;
    this.isLoaded = false;
    this.embeddingCache = new Map(); // Cache embeddings for frequently used texts
  }

  /**
   * Initialize the embedding model
   */
  async initialize() {
    if (this.isLoaded) {
      return;
    }

    try {
      Logger.info('🤖 Loading embedding model: ' + this.modelName);
      
      this.model = await pipeline(
        'feature-extraction',
        this.modelName
      );
      
      this.isLoaded = true;
      Logger.success('✅ Embedding model loaded successfully');
      Logger.info(`   Dimension: ${this.dimension}`);
      
    } catch (error) {
      Logger.error('Failed to load embedding model:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   * @param {string} text - Input text
   * @returns {Promise<number[]>} - 384-dimensional embedding vector
   */
  async embedText(text) {
    if (!this.isLoaded) {
      await this.initialize();
    }

    // Check cache first
    const cacheKey = text.substring(0, 100); // Use first 100 chars as key
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }

    try {
      // Generate embedding
      const output = await this.model(text, {
        pooling: 'mean',
        normalize: true
      });

      // Convert to array
      const embedding = Array.from(output.data);

      // Cache the result
      if (this.embeddingCache.size < 1000) {
        this.embeddingCache.set(cacheKey, embedding);
      }

      return embedding;

    } catch (error) {
      Logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   * @param {string[]} texts - Array of input texts
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async embedBatch(texts) {
    if (!this.isLoaded) {
      await this.initialize();
    }

    const embeddings = [];
    
    for (let i = 0; i < texts.length; i++) {
      const embedding = await this.embedText(texts[i]);
      embeddings.push(embedding);
      
      // Progress indicator for large batches
      if ((i + 1) % 10 === 0) {
        Logger.info(`   Embedded ${i + 1}/${texts.length} texts`);
      }
    }

    return embeddings;
  }

  /**
   * Compute cosine similarity between two embeddings
   * @param {number[]} embedding1 - First embedding vector
   * @param {number[]} embedding2 - Second embedding vector
   * @returns {number} - Similarity score (0 to 1)
   */
  cosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return similarity;
  }

  /**
   * Find most similar texts to a query
   * @param {string} query - Query text
   * @param {Array} chunks - Array of {text, embedding} objects
   * @param {number} topK - Number of results to return
   * @returns {Promise<Array>} - Top K most similar chunks with scores
   */
  async findSimilar(query, chunks, topK = 5) {
    // Generate query embedding
    const queryEmbedding = await this.embedText(query);

    // Calculate similarities
    const results = chunks.map(chunk => {
      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        ...chunk,
        similarity: similarity,
        score: similarity * 100 // Convert to percentage
      };
    });

    // Sort by similarity (descending) and return top K
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Clear embedding cache
   */
  clearCache() {
    this.embeddingCache.clear();
    Logger.info('Embedding cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.embeddingCache.size,
      maxSize: 1000
    };
  }
}

// Singleton instance
let embeddingServiceInstance = null;

export function getEmbeddingService() {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}

export { EmbeddingService };

