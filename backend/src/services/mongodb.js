/**
 * MongoDB Service
 * Handles MongoDB connection, connection pooling, and database operations
 */

import { MongoClient } from 'mongodb';
import { mongoConfig } from '../config/mongodb.config.js';
import { Logger } from '../utils/logger.js';

class MongoDBService {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 3;
  }

  /**
   * Connect to MongoDB Atlas
   */
  async connect() {
    if (this.isConnected && this.client) {
      Logger.info('MongoDB already connected');
      return this.db;
    }

    try {
      this.connectionAttempts++;
      Logger.info(`Connecting to MongoDB Atlas... (Attempt ${this.connectionAttempts}/${this.maxRetries})`);
      
      // Create MongoDB client with connection pooling
      this.client = new MongoClient(mongoConfig.uri, mongoConfig.options);
      
      // Connect to MongoDB
      await this.client.connect();
      
      // Get database instance
      this.db = this.client.db(mongoConfig.dbName);
      
      // Test the connection
      await this.db.command({ ping: 1 });
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      Logger.success(`✅ Connected to MongoDB Atlas: ${mongoConfig.dbName}`);
      Logger.info(`   Collections: ${Object.values(mongoConfig.collections).join(', ')}`);
      
      // Set up connection error handlers
      this.client.on('error', (error) => {
        Logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });
      
      this.client.on('close', () => {
        Logger.warn('MongoDB connection closed');
        this.isConnected = false;
      });
      
      // Initialize indexes
      await this.initializeIndexes();
      
      return this.db;
      
    } catch (error) {
      this.isConnected = false;
      Logger.error('Failed to connect to MongoDB:', error);
      
      if (this.connectionAttempts < this.maxRetries) {
        Logger.info(`Retrying connection in 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return this.connect();
      } else {
        Logger.error(`MongoDB connection failed after ${this.maxRetries} attempts`);
        throw error;
      }
    }
  }

  /**
   * Initialize database indexes for better performance
   */
  async initializeIndexes() {
    try {
      const chunksCollection = this.db.collection(mongoConfig.collections.chunks);
      const cacheCollection = this.db.collection(mongoConfig.collections.cache);
      const analyticsCollection = this.db.collection(mongoConfig.collections.analytics);
      const usersCollection = this.db.collection(mongoConfig.collections.users || 'users');
      
      // Indexes for knowledge chunks
      await chunksCollection.createIndex({ id: 1 }, { unique: true });
      await chunksCollection.createIndex({ section: 1 });
      await chunksCollection.createIndex({ type: 1 });
      await chunksCollection.createIndex({ keywords: 1 });
      await chunksCollection.createIndex({ 'metadata.updated_at': -1 });
      
      // IMPROVED: Compound indexes for common query patterns
      await chunksCollection.createIndex({ section: 1, type: 1 });
      await chunksCollection.createIndex({ category: 1, section: 1 });
      await chunksCollection.createIndex({ 'metadata.acronym': 1, section: 1 });
      await chunksCollection.createIndex({ 'metadata.year': 1, type: 1 });
      await chunksCollection.createIndex({ keywords: 1, section: 1 });
      
      // Text search index for full-text search (IMPROVED: Include content field)
      try {
        await chunksCollection.createIndex({ 
          content: 'text', 
          text: 'text',
          keywords: 'text' 
        }, { 
          name: 'text_search_index',
          weights: { content: 10, text: 10, keywords: 5 },
          default_language: 'english'
        });
      } catch (error) {
        // If text index already exists with different fields, create a new one
        if (error.code === 85) {
          Logger.debug('Text index already exists, skipping...');
        } else {
          throw error;
        }
      }
      
      // Indexes for cache
      await cacheCollection.createIndex({ query: 1 }, { unique: true });
      await cacheCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }); // TTL index
      
      // Indexes for analytics
      await analyticsCollection.createIndex({ timestamp: -1 });
      await analyticsCollection.createIndex({ query: 1 });
      await analyticsCollection.createIndex({ complexity: 1 });
      
      // Indexes for users
      await usersCollection.createIndex({ email: 1 }, { unique: true });
      await usersCollection.createIndex({ createdAt: -1 });
      await usersCollection.createIndex({ isActive: 1 });
      
      Logger.success('✅ MongoDB indexes initialized');
      
    } catch (error) {
      Logger.error('Failed to initialize MongoDB indexes:', error);
    }
  }

  /**
   * Get collection by name
   */
  getCollection(collectionName) {
    if (!this.isConnected || !this.db) {
      throw new Error('MongoDB not connected');
    }
    return this.db.collection(collectionName);
  }

  /**
   * Insert knowledge chunks (bulk insert with upsert to prevent data loss)
   * CRITICAL FIX: Use upsert instead of insert to update existing chunks and prevent duplicates from being skipped
   * FIXED: Handle metadata fields individually to avoid conflict with $setOnInsert
   */
  async insertChunks(chunks) {
    try {
      const collection = this.getCollection(mongoConfig.collections.chunks);
      
      // CRITICAL FIX: Set metadata fields individually using dot notation
      // This avoids the conflict between $set (entire metadata object) and $setOnInsert (metadata.created_at)
      const bulkOps = chunks.map(chunk => {
        const now = new Date();
        
        // Build update object - set all fields individually, especially metadata fields
        const updateDoc = {
          $set: {
            id: chunk.id,
            content: chunk.content,
            text: chunk.text || chunk.content,
            section: chunk.section,
            type: chunk.type,
            category: chunk.category,
            keywords: chunk.keywords || [],
            embedding: chunk.embedding,
            // Set all metadata fields individually using dot notation to avoid conflict
            ...Object.keys(chunk.metadata || {}).reduce((acc, key) => {
              // Skip created_at - it's handled by $setOnInsert
              if (key !== 'created_at') {
                acc[`metadata.${key}`] = chunk.metadata[key];
              }
              return acc;
            }, {}),
            'metadata.updated_at': now
          },
          $setOnInsert: {
            'metadata.created_at': now // Only set on insert, preserve existing on update
          }
        };
        
        return {
          updateOne: {
            filter: { id: chunk.id },
            update: updateDoc,
            upsert: true
          }
        };
      });
      
      const result = await collection.bulkWrite(bulkOps, { ordered: false });
      
      Logger.success(`✅ Processed chunks: ${result.upsertedCount} inserted, ${result.modifiedCount} updated, ${result.matchedCount} matched (total: ${chunks.length})`);
      
      // Warn if there's a mismatch
      const totalProcessed = result.upsertedCount + result.modifiedCount + result.matchedCount;
      if (totalProcessed < chunks.length) {
        Logger.warn(`⚠️  Warning: Only ${totalProcessed} of ${chunks.length} chunks were processed. Some may have failed.`);
      }
      
      return result;
      
    } catch (error) {
      Logger.error('Failed to insert chunks:', error);
      throw error;
    }
  }

  /**
   * Update chunk with embedding vector
   */
  async updateChunkEmbedding(chunkId, embedding) {
    try {
      const collection = this.getCollection(mongoConfig.collections.chunks);
      
      await collection.updateOne(
        { id: chunkId },
        {
          $set: {
            embedding: embedding,
            'metadata.embedding_updated_at': new Date()
          }
        }
      );
      
    } catch (error) {
      Logger.error(`Failed to update embedding for chunk ${chunkId}:`, error);
      throw error;
    }
  }

  /**
   * Batch update embeddings for multiple chunks
   */
  async batchUpdateEmbeddings(chunksWithEmbeddings) {
    try {
      const collection = this.getCollection(mongoConfig.collections.chunks);
      
      const bulkOps = chunksWithEmbeddings.map(({ id, embedding }) => ({
        updateOne: {
          filter: { id },
          update: {
            $set: {
              embedding,
              'metadata.embedding_updated_at': new Date()
            }
          }
        }
      }));
      
      const result = await collection.bulkWrite(bulkOps);
      Logger.success(`✅ Updated ${result.modifiedCount} embeddings`);
      return result;
      
    } catch (error) {
      Logger.error('Failed to batch update embeddings:', error);
      throw error;
    }
  }

  /**
   * Vector similarity search using MongoDB Atlas Vector Search
   * Uses the "DOrSUAI" vector search index for efficient semantic search
   */
  async vectorSearch(queryEmbedding, limit = 10) {
    try {
      const collection = this.getCollection(mongoConfig.collections.chunks);
      
      // Use MongoDB Atlas Vector Search aggregation pipeline
      // This leverages the "DOrSUAI" vector search index you created
      const pipeline = [
        {
          $vectorSearch: {
            index: 'DOrSUAI',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: Math.max(limit * 15, 150), // Increased from 100 to 150 for better recall
            limit: limit
          }
        },
        {
          $project: {
            _id: 1,
            id: 1,
            content: 1,
            text: 1,
            section: 1,
            type: 1,
            category: 1,
            keywords: 1,
            metadata: 1,
            embedding: 1,
            score: { $meta: 'vectorSearchScore' } // Get the similarity score from Atlas
          }
        }
      ];
      
      const results = await collection.aggregate(pipeline).toArray();
      
      // Map results to expected format
      return results.map(chunk => ({
        ...chunk,
        similarity: chunk.score || 0, // Use vectorSearchScore as similarity
        score: (chunk.score || 0) * 100 // Scale to 0-100
      }));
      
    } catch (error) {
      // Fallback to manual cosine similarity if vector search fails
      Logger.warn(`Atlas Vector Search failed, falling back to manual cosine similarity: ${error.message}`);
      
      try {
        const collection = this.getCollection(mongoConfig.collections.chunks);
        const chunks = await collection.find({ embedding: { $exists: true } }).limit(limit * 5).toArray();
        
        const results = chunks.map(chunk => {
          const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
          return {
            ...chunk,
            similarity,
            score: similarity * 100
          };
        });
        
        return results
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
      } catch (fallbackError) {
        Logger.error('Vector search fallback also failed:', fallbackError);
        throw error; // Throw original error
      }
    }
  }

  /**
   * Vector similarity search for schedule collection using MongoDB Atlas Vector Search
   * Uses a vector search index on the schedule collection for semantic search of events/announcements
   * @param {number[]} queryEmbedding - Query embedding vector (384 dimensions)
   * @param {number} limit - Maximum number of results to return
   * @param {string} indexName - Name of the vector search index (default: 'schedule_vector_index')
   * @returns {Promise<Array>} Array of schedule events with similarity scores
   */
  async vectorSearchSchedule(queryEmbedding, limit = 10, indexName = 'schedule_vector_index') {
    try {
      const collection = this.getCollection('schedule');
      
      // Use MongoDB Atlas Vector Search aggregation pipeline
      const pipeline = [
        {
          $vectorSearch: {
            index: indexName,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: Math.max(limit * 10, 100), // Search more candidates for better results
            limit: limit
          }
        },
        {
          $project: {
            _id: 1,
            title: 1,
            description: 1,
            category: 1,
            type: 1,
            date: 1,
            isoDate: 1,
            time: 1,
            semester: 1,
            dateType: 1,
            startDate: 1,
            endDate: 1,
            userType: 1,
            image: 1,
            images: 1,
            imageFileId: 1,
            source: 1,
            createdAt: 1,
            updatedAt: 1,
            createdBy: 1,
            score: { $meta: 'vectorSearchScore' } // Get the similarity score from Atlas
          }
        }
      ];
      
      const results = await collection.aggregate(pipeline).toArray();
      
      // Map results to expected format
      return results.map(event => ({
        ...event,
        similarity: event.score || 0, // Use vectorSearchScore as similarity
        score: (event.score || 0) * 100 // Scale to 0-100
      }));
      
    } catch (error) {
      // Fallback to manual cosine similarity if vector search fails
      Logger.warn(`Schedule Vector Search failed, falling back to manual cosine similarity: ${error.message}`);
      
      try {
        const collection = this.getCollection('schedule');
        const events = await collection.find({ embedding: { $exists: true } }).limit(limit * 5).toArray();
        
        const results = events.map(event => {
          const similarity = this.cosineSimilarity(queryEmbedding, event.embedding);
          return {
            ...event,
            similarity,
            score: similarity * 100
          };
        });
        
        return results
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
      } catch (fallbackError) {
        Logger.error('Schedule vector search fallback also failed:', fallbackError);
        throw error; // Throw original error
      }
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Get all knowledge chunks
   */
  async getAllChunks() {
    try {
      const collection = this.getCollection(mongoConfig.collections.chunks);
      const chunks = await collection.find({}).toArray();
      return chunks;
    } catch (error) {
      Logger.error('Failed to get chunks:', error);
      throw error;
    }
  }

  /**
   * Search chunks by keywords
   */
  async searchChunks(query, limit = 10) {
    try {
      const collection = this.getCollection(mongoConfig.collections.chunks);
      
      // Full-text search
      const chunks = await collection.find({
        $text: { $search: query }
      }, {
        score: { $meta: 'textScore' }
      })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .toArray();
      
      return chunks;
    } catch (error) {
      Logger.error('Failed to search chunks:', error);
      throw error;
    }
  }

  /**
   * Cache AI response
   * @param {string} query - The query string
   * @param {string} response - The AI response
   * @param {string} complexity - Query complexity
   * @param {number} ttl - Time to live in seconds (0 = no expiration, persistent until manual clear)
   */
  async cacheResponse(query, response, complexity, ttl = 3600) {
    try {
      const collection = this.getCollection(mongoConfig.collections.cache);
      const normalizedQuery = query.toLowerCase().trim();
      
      const updateData = {
        response,
        complexity,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Only set expiresAt if TTL > 0 (persistent cache if TTL = 0)
      if (ttl > 0) {
        updateData.expiresAt = new Date(Date.now() + ttl * 1000);
      } else {
        // For persistent cache (TTL = 0), set expiresAt to null
        updateData.expiresAt = null;
      }
      
      await collection.updateOne(
        { query: normalizedQuery },
        { $set: updateData },
        { upsert: true }
      );
      
      Logger.debug(`Cached response in MongoDB ai_cache collection for query: "${normalizedQuery.substring(0, 30)}..."`);
    } catch (error) {
      Logger.error('Failed to cache response:', error);
    }
  }

  /**
   * Get cached response
   */
  async getCachedResponse(query) {
    try {
      const collection = this.getCollection(mongoConfig.collections.cache);
      const normalizedQuery = query.toLowerCase().trim();
      
      // Find cached response - check both with and without expiration
      const cached = await collection.findOne({
        query: normalizedQuery,
        $or: [
          { expiresAt: { $gt: new Date() } },  // Not expired
          { expiresAt: null },                   // No expiration (persistent cache)
          { expiresAt: { $exists: false } }     // No expiration field
        ]
      });
      
      return cached?.response || null;
    } catch (error) {
      Logger.error('Failed to get cached response:', error);
      return null;
    }
  }

  /**
   * Log query analytics
   */
  async logQuery(query, complexity, responseTime, cached = false) {
    try {
      const collection = this.getCollection(mongoConfig.collections.analytics);
      
      await collection.insertOne({
        query,
        complexity,
        responseTime,
        cached,
        timestamp: new Date()
      });
      
    } catch (error) {
      Logger.error('Failed to log analytics:', error);
    }
  }

  /**
   * Log user query with frequency tracking and user type categorization
   */
  async logUserQuery(userId, query, userType = null) {
    try {
      if (!userId || !query || !query.trim()) {
        return;
      }

      const collection = this.getCollection(mongoConfig.collections.conversations);
      
      // Normalize query for comparison (lowercase, trim, remove extra spaces)
      const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
      
      // Use a hash to avoid MongoDB field name issues with special characters
      // Store queries in an array with frequency count and userType
      const userDoc = await collection.findOne({ userId: userId });
      
      if (!userDoc || !userDoc.queryFrequency) {
        // Create new document with query frequency array
        await collection.updateOne(
          { userId: userId },
          {
            $set: {
              userId: userId,
              queryFrequency: [{ query: normalizedQuery, count: 1, userType: userType || null }],
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
      } else {
        // Update existing query frequency
        const queryIndex = userDoc.queryFrequency.findIndex(q => q.query === normalizedQuery);
        
        if (queryIndex >= 0) {
          // Increment count for existing query
          await collection.updateOne(
            { userId: userId, 'queryFrequency.query': normalizedQuery },
            {
              $inc: { 'queryFrequency.$.count': 1 },
              $set: { 
                'queryFrequency.$.userType': userType || userDoc.queryFrequency[queryIndex].userType,
                updatedAt: new Date() 
              }
            }
          );
        } else {
          // Add new query
          await collection.updateOne(
            { userId: userId },
            {
              $push: { queryFrequency: { query: normalizedQuery, count: 1, userType: userType || null } },
              $set: { updatedAt: new Date() }
            }
          );
        }
      }
      
      // Also log to global FAQs collection for cross-user analytics
      if (userType) {
        await this.logGlobalQuery(normalizedQuery, userType);
      }
      
      Logger.info(`✅ Logged user query for userId: ${userId}, userType: ${userType || 'none'}`);
    } catch (error) {
      Logger.error('Failed to log user query:', error);
    }
  }

  /**
   * Log query to global FAQs collection (accessible across all users)
   */
  async logGlobalQuery(query, userType) {
    try {
      if (!query || !query.trim() || !userType) {
        return;
      }

      const collection = this.getCollection('global_faqs');
      const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
      
      // Find or create FAQ document
      const faqDoc = await collection.findOne({ query: normalizedQuery, userType: userType });
      
      if (!faqDoc) {
        // Create new FAQ entry
        await collection.insertOne({
          query: normalizedQuery,
          userType: userType,
          count: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        // Increment count
        await collection.updateOne(
          { query: normalizedQuery, userType: userType },
          {
            $inc: { count: 1 },
            $set: { updatedAt: new Date() }
          }
        );
      }
      
      Logger.info(`✅ Logged global FAQ query: ${normalizedQuery}, userType: ${userType}`);
    } catch (error) {
      Logger.error('Failed to log global query:', error);
    }
  }

  /**
   * Get top N most frequently asked questions for a user (DEPRECATED - use getGlobalFAQs instead)
   */
  async getTopQueries(userId, limit = 5) {
    try {
      if (!userId) {
        return [];
      }

      const collection = this.getCollection(mongoConfig.collections.conversations);
      
      const userDoc = await collection.findOne({ userId: userId });
      
      if (!userDoc || !userDoc.queryFrequency || !Array.isArray(userDoc.queryFrequency)) {
        return [];
      }
      
      // Sort query frequency array by count (descending) and get top N
      const queryArray = [...userDoc.queryFrequency]
        .sort((a, b) => (b.count || 0) - (a.count || 0)) // Sort by count descending
        .slice(0, limit) // Get top N
        .map(item => {
          // Capitalize first letter of query for display
          const query = item.query || '';
          return query.charAt(0).toUpperCase() + query.slice(1);
        });
      
      return queryArray;
      
    } catch (error) {
      Logger.error('Failed to get top queries:', error);
      return [];
    }
  }

  /**
   * Get global FAQs from knowledge base (accessible across all users and devices)
   * Returns top N FAQs based on frequency across all users
   */
  async getGlobalFAQs(userType = null, limit = 5) {
    try {
      const collection = this.getCollection('global_faqs');
      
      // Build query filter
      const filter = userType ? { userType: userType } : {};
      
      // Get top FAQs sorted by count
      const faqs = await collection
        .find(filter)
        .sort({ count: -1 }) // Sort by count descending
        .limit(limit)
        .toArray();
      
      // Format and return FAQs
      return faqs.map(faq => {
        const query = faq.query || '';
        // Capitalize first letter of query for display
        return query.charAt(0).toUpperCase() + query.slice(1);
      });
      
    } catch (error) {
      Logger.error('Failed to get global FAQs:', error);
      // If collection doesn't exist yet, return empty array
      return [];
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalytics(startDate = null, endDate = null) {
    try {
      const collection = this.getCollection(mongoConfig.collections.analytics);
      
      const match = {};
      if (startDate && endDate) {
        match.timestamp = { $gte: startDate, $lte: endDate };
      }
      
      const stats = await collection.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalQueries: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTime' },
            cachedQueries: { $sum: { $cond: ['$cached', 1, 0] } },
            simpleQueries: { $sum: { $cond: [{ $eq: ['$complexity', 'simple'] }, 1, 0] } },
            complexQueries: { $sum: { $cond: [{ $eq: ['$complexity', 'complex'] }, 1, 0] } },
            multiComplexQueries: { $sum: { $cond: [{ $eq: ['$complexity', 'multi-complex'] }, 1, 0] } }
          }
        }
      ]).toArray();
      
      return stats[0] || {};
    } catch (error) {
      Logger.error('Failed to get analytics:', error);
      return {};
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
        this.isConnected = false;
        Logger.info('MongoDB connection closed');
      } catch (error) {
        Logger.error('Error closing MongoDB connection:', error);
      }
    }
  }

  /**
   * Check connection status
   */
  async healthCheck() {
    try {
      if (!this.isConnected || !this.db) {
        return { status: 'disconnected', message: 'Not connected to MongoDB' };
      }
      
      await this.db.command({ ping: 1 });
      
      return {
        status: 'connected',
        database: mongoConfig.dbName,
        collections: Object.values(mongoConfig.collections)
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // ===== USER MANAGEMENT METHODS =====

  /**
   * Create a new user
   */
  async createUser(user) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const result = await collection.insertOne(user);
      Logger.success(`✅ User created: ${user.email}`);
      return { ...user, _id: result.insertedId };
    } catch (error) {
      Logger.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findUser(email) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const user = await collection.findOne({ email: email.toLowerCase() });
      return user;
    } catch (error) {
      Logger.error('Failed to find user:', error);
      return null;
    }
  }

  /**
   * Find user by ID
   */
  async findUserById(userId) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const { ObjectId } = await import('mongodb');
      const user = await collection.findOne({ _id: new ObjectId(userId) });
      return user;
    } catch (error) {
      Logger.error('Failed to find user by ID:', error);
      return null;
    }
  }

  /**
   * Update user password
   */
  async updateUserPassword(userId, hashedPassword) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const { ObjectId } = await import('mongodb');

      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            password: hashedPassword,
            passwordUpdatedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('User not found');
      }

      Logger.success(`✅ Updated password for user: ${userId}`);
      return { success: true };
    } catch (error) {
      Logger.error('Failed to update user password:', error);
      throw error;
    }
  }

  /**
   * Update user by email
   */
  async updateUser(email, updateData) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const result = await collection.updateOne(
        { email: email.toLowerCase() },
        {
          $set: {
            ...updateData,
            updatedAt: new Date()
          }
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('User not found');
      }
      
      Logger.success(`✅ User updated: ${email}`);
      return { success: true };
    } catch (error) {
      Logger.error('Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Update user's last login timestamp
   */
  async updateUserLastLogin(email) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      await collection.updateOne(
        { email: email.toLowerCase() },
        {
          $set: {
            lastLogin: new Date(),
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      Logger.error('Failed to update last login:', error);
    }
  }

  /**
   * Get all users (for admin)
   */
  async getAllUsers(limit = 100, skip = 0) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const users = await collection
        .find({}, { projection: { password: 0 } }) // Exclude password
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();
      return users;
    } catch (error) {
      Logger.error('Failed to get all users:', error);
      return [];
    }
  }

  /**
   * Update user profile picture
   */
  async updateUserProfilePicture(userId, imageFileId, imageUrl) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const { ObjectId } = await import('mongodb');
      
      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            profilePictureFileId: imageFileId,
            profilePicture: imageUrl,
            updatedAt: new Date()
          }
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('User not found');
      }
      
      Logger.success(`✅ Profile picture updated for user: ${userId}`);
      return { success: true };
    } catch (error) {
      Logger.error('Failed to update profile picture:', error);
      throw error;
    }
  }

  /**
   * Get user count
   */
  async getUserCount() {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      return await collection.countDocuments();
    } catch (error) {
      Logger.error('Failed to get user count:', error);
      return 0;
    }
  }

  // ===== EMAIL VERIFICATION METHODS =====

  /**
   * Create a new email verification request
   */
  async createEmailVerificationRequest(email, token, expiresAt) {
    try {
      const collection = this.getCollection(
        mongoConfig.collections.emailVerifications || 'email_verifications'
      );
      await collection.insertOne({
        email: email.toLowerCase(),
        token,
        expiresAt,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      Logger.error('Failed to create email verification request:', error);
      throw error;
    }
  }

  /**
   * Get verification record by token
   */
  async getEmailVerificationByToken(token) {
    try {
      const collection = this.getCollection(
        mongoConfig.collections.emailVerifications || 'email_verifications'
      );
      return await collection.findOne({ token });
    } catch (error) {
      Logger.error('Failed to get email verification by token:', error);
      return null;
    }
  }

  /**
   * Get latest verification status for an email
   */
  async getLatestEmailVerification(email) {
    try {
      const collection = this.getCollection(
        mongoConfig.collections.emailVerifications || 'email_verifications'
      );
      return await collection
        .find({ email: email.toLowerCase() })
        .sort({ createdAt: -1 })
        .limit(1)
        .next();
    } catch (error) {
      Logger.error('Failed to get email verification status:', error);
      return null;
    }
  }

  /**
   * Mark verification token as used/verified
   */
  async markEmailVerificationVerified(token) {
    try {
      const collection = this.getCollection(
        mongoConfig.collections.emailVerifications || 'email_verifications'
      );
      await collection.updateOne(
        { token },
        {
          $set: {
            verified: true,
            verifiedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
    } catch (error) {
      Logger.error('Failed to update email verification token:', error);
      throw error;
    }
  }

  /**
   * Delete a user account and all associated data
   */
  async deleteUser(userId) {
    try {
      const { ObjectId } = await import('mongodb');
      const userObjectId = new ObjectId(userId);
      
      // First, get user email before deletion (for email verification cleanup)
      const usersCollection = this.getCollection(mongoConfig.collections.users || 'users');
      const user = await usersCollection.findOne({ _id: userObjectId });
      const userEmail = user?.email;
      
      // Delete user from users collection
      const userResult = await usersCollection.deleteOne({ _id: userObjectId });
      
      if (userResult.deletedCount === 0) {
        Logger.warn(`User not found for deletion: ${userId}`);
        return { success: false, message: 'User not found' };
      }
      
      // Delete all chat history and conversations
      const conversationsCollection = this.getCollection(mongoConfig.collections.conversations);
      await conversationsCollection.deleteOne({ userId: userId });
      
      // Delete email verification records if user email exists
      if (userEmail) {
        try {
          const emailVerificationsCollection = this.getCollection(
            mongoConfig.collections.emailVerifications || 'email_verifications'
          );
          const emailDeleteResult = await emailVerificationsCollection.deleteMany({ 
            email: userEmail.toLowerCase() 
          });
          if (emailDeleteResult.deletedCount > 0) {
            Logger.info(`🗑️ Deleted ${emailDeleteResult.deletedCount} email verification record(s) for ${userEmail}`);
          }
        } catch (emailError) {
          Logger.warn('Failed to delete email verification records:', emailError);
          // Continue - email verification deletion is not critical
        }
      }
      
      Logger.success(`🗑️ User account deleted: ${userId}${userEmail ? ` (${userEmail})` : ''}`);
      return { success: true, message: 'User account and all associated data deleted' };
    } catch (error) {
      Logger.error('Failed to delete user:', error);
      throw error;
    }
  }

  // ===== CHAT HISTORY METHODS =====

  /**
   * Save chat history for a user
   */
  async saveChatHistory(userId, chatHistory) {
    try {
      const collection = this.getCollection(mongoConfig.collections.conversations);
      
      // Create or update chat history document
      const result = await collection.updateOne(
        { userId: userId },
        {
          $set: {
            userId: userId,
            history: chatHistory,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      
      Logger.success(`✅ Chat history saved for user: ${userId}`);
      return result;
    } catch (error) {
      Logger.error('Failed to save chat history:', error);
      throw error;
    }
  }

  /**
   * Get chat history for a user
   */
  async getChatHistory(userId) {
    try {
      const collection = this.getCollection(mongoConfig.collections.conversations);
      
      const chatHistory = await collection.findOne({ userId: userId });
      
      return chatHistory ? chatHistory.history : [];
    } catch (error) {
      Logger.error('Failed to get chat history:', error);
      return [];
    }
  }

  /**
   * Save a specific chat session
   */
  async saveChatSession(userId, sessionId, messages, userType = null) {
    try {
      const collection = this.getCollection(mongoConfig.collections.conversations);
      
      // Update or create chat session within user's document
      const updateData = {
        [`sessions.${sessionId}.messages`]: messages,
        [`sessions.${sessionId}.updatedAt`]: new Date()
      };
      
      // Add userType if provided
      if (userType) {
        updateData[`sessions.${sessionId}.userType`] = userType;
      }
      
      const result = await collection.updateOne(
        { userId: userId },
        {
          $set: updateData,
          $setOnInsert: {
            userId: userId,
            history: [],
            createdAt: new Date(),
            [`sessions.${sessionId}.createdAt`]: new Date()
          }
        },
        { upsert: true }
      );
      
      Logger.success(`✅ Chat session saved for user: ${userId}, session: ${sessionId}, userType: ${userType || 'none'}, messages: ${messages.length}`);
      Logger.info(`   Collection: ${mongoConfig.collections.conversations}, Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`);
      return result;
    } catch (error) {
      Logger.error('Failed to save chat session:', error);
      throw error;
    }
  }

  /**
   * Get a specific chat session
   */
  async getChatSession(userId, sessionId) {
    try {
      const collection = this.getCollection(mongoConfig.collections.conversations);
      
      const chatDoc = await collection.findOne(
        { userId: userId },
        { projection: { [`sessions.${sessionId}`]: 1 } }
      );
      
      return chatDoc && chatDoc.sessions && chatDoc.sessions[sessionId] 
        ? chatDoc.sessions[sessionId].messages 
        : [];
    } catch (error) {
      Logger.error('Failed to get chat session:', error);
      return [];
    }
  }

  /**
   * Add chat to history list
   */
  async addChatToHistory(userId, chatInfo) {
    try {
      const collection = this.getCollection(mongoConfig.collections.conversations);
      
      // First try to update existing history entry with same id
      const updateData = {
        'history.$.title': chatInfo.title,
        'history.$.preview': chatInfo.preview,
        'history.$.timestamp': chatInfo.timestamp
      };
      
      // Add userType if provided
      if (chatInfo.userType) {
        updateData['history.$.userType'] = chatInfo.userType;
      }
      
      const updateExisting = await collection.updateOne(
        { userId: userId, 'history.id': chatInfo.id },
        {
          $set: updateData,
          $setOnInsert: { userId: userId }
        }
      );
      
      if (updateExisting.matchedCount > 0) {
        Logger.success(`✅ Chat history updated for user: ${userId}, session: ${chatInfo.id}`);
        return updateExisting;
      }

      // If not existing, push new history item, keeping only the last 50
      const result = await collection.updateOne(
        { userId: userId },
        {
          $push: {
            history: {
              $each: [chatInfo],
              $slice: -50 // Keep only the last 50 chats
            }
          },
          $setOnInsert: {
            userId: userId,
            sessions: {},
            createdAt: new Date()
          },
          $set: {
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      
      Logger.success(`✅ Chat added to history for user: ${userId}`);
      return result;
    } catch (error) {
      Logger.error('Failed to add chat to history:', error);
      throw error;
    }
  }

  /**
   * Delete a chat session and remove from history
   */
  async deleteChatSession(userId, sessionId) {
    try {
      const collection = this.getCollection(mongoConfig.collections.conversations);

      const result = await collection.updateOne(
        { userId: userId },
        {
          $unset: { [`sessions.${sessionId}`]: '' },
          $pull: { history: { id: sessionId } },
          $set: { updatedAt: new Date() }
        }
      );

      Logger.success(`🗑️ Chat session deleted for user: ${userId}, session: ${sessionId}`);
      return result;
    } catch (error) {
      Logger.error('Failed to delete chat session:', error);
      throw error;
    }
  }

  /**
   * Delete all chat history for a user
   */
  async deleteAllChatHistory(userId) {
    try {
      const collection = this.getCollection(mongoConfig.collections.conversations);

      const result = await collection.updateOne(
        { userId: userId },
        {
          $set: {
            history: [],
            sessions: {},
            queryFrequency: [],
            updatedAt: new Date()
          }
        }
      );

      Logger.success(`🗑️ All chat history deleted for user: ${userId}`);
      return result;
    } catch (error) {
      Logger.error('Failed to delete all chat history:', error);
      throw error;
    }
  }
}

// Singleton instance
let mongoDBServiceInstance = null;

export function getMongoDBService() {
  if (!mongoDBServiceInstance) {
    mongoDBServiceInstance = new MongoDBService();
  }
  return mongoDBServiceInstance;
}

export { MongoDBService };

