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
      const activityLogsCollection = this.db.collection(mongoConfig.collections.activityLogs);
      const studentsCollection = this.db.collection(mongoConfig.collections.students || 'students');
      const facultyCollection = this.db.collection(mongoConfig.collections.faculty || 'faculty');
      
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
      
      // Indexes for activity logs
      await activityLogsCollection.createIndex({ userId: 1, 'metadata.timestamp': -1 });
      await activityLogsCollection.createIndex({ action: 1, 'metadata.timestamp': -1 });
      await activityLogsCollection.createIndex({ 'metadata.timestamp': -1 });
      
      // Indexes for students
      await studentsCollection.createIndex({ studentId: 1 }, { unique: true });
      await studentsCollection.createIndex({ createdAt: -1 });
      
      // Indexes for faculty
      await facultyCollection.createIndex({ fullName: 1 });
      await facultyCollection.createIndex({ createdAt: -1 });
      await activityLogsCollection.createIndex({ userEmail: 1 });
      
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
      const userWithRole = {
        ...user,
        role: user.role || 'user', // Default to 'user' if not specified
        studentVerification: {
          status: 'pending', // Default to pending until verified
          submittedAt: null,
          verifiedAt: null
        },
        isActive: user.isActive !== undefined ? user.isActive : true
      };
      const result = await collection.insertOne(userWithRole);
      Logger.success(`✅ User created: ${user.email}`);
      return { ...userWithRole, _id: result.insertedId };
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
      // Ensure user has a role field (migration for existing users)
      if (user && !user.role) {
        await collection.updateOne(
          { _id: user._id },
          { $set: { role: 'user', updatedAt: new Date() } }
        );
        user.role = 'user';
      }
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
      // Handle admin token case
      if (userId === 'admin') {
        return { _id: 'admin', role: 'superadmin', email: 'admin@dorsu.edu.ph' };
      }
      
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const { ObjectId } = await import('mongodb');
      
      // Check if userId is a valid ObjectId format
      if (!ObjectId.isValid(userId)) {
        Logger.warn(`Invalid userId format: ${userId}`);
        return null;
      }
      
      const user = await collection.findOne({ _id: new ObjectId(userId) });
      // Ensure user has a role field (migration for existing users)
      if (user && !user.role) {
        await collection.updateOne(
          { _id: user._id },
          { $set: { role: 'user', updatedAt: new Date() } }
        );
        user.role = 'user';
      }
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
   * Update user role
   */
  async updateUserRole(userId, role) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const { ObjectId } = await import('mongodb');
      
      // Validate userId format
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID format');
      }
      
      // Validate ObjectId format
      if (!ObjectId.isValid(userId)) {
        Logger.error(`Invalid ObjectId format: ${userId}`);
        throw new Error(`Invalid user ID format: ${userId}`);
      }
      
      const validRoles = ['user', 'moderator', 'admin', 'superadmin'];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }
      
      const objectId = new ObjectId(userId);
      
      // First check if user exists
      const user = await collection.findOne({ _id: objectId });
      if (!user) {
        Logger.warn(`User not found with ID: ${userId}`);
        throw new Error(`User not found with ID: ${userId}`);
      }
      
      const result = await collection.updateOne(
        { _id: objectId },
        {
          $set: {
            role: role,
            updatedAt: new Date()
          }
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error(`User not found with ID: ${userId}`);
      }
      
      Logger.success(`✅ User role updated: ${userId} -> ${role}`);
      return { success: true };
    } catch (error) {
      Logger.error('Failed to update user role:', error);
      throw error;
    }
  }

  /**
   * Update user active status
   */
  async updateUserStatus(userId, isActive) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const { ObjectId } = await import('mongodb');
      
      // Validate userId format
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID format');
      }
      
      // Validate ObjectId format
      if (!ObjectId.isValid(userId)) {
        Logger.error(`Invalid ObjectId format: ${userId}`);
        throw new Error(`Invalid user ID format: ${userId}`);
      }
      
      if (typeof isActive !== 'boolean') {
        throw new Error('isActive must be a boolean value');
      }
      
      const objectId = new ObjectId(userId);
      
      // First check if user exists
      const user = await collection.findOne({ _id: objectId });
      if (!user) {
        Logger.warn(`User not found with ID: ${userId}`);
        throw new Error(`User not found with ID: ${userId}`);
      }
      
      const result = await collection.updateOne(
        { _id: objectId },
        {
          $set: {
            isActive: isActive,
            updatedAt: new Date()
          }
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error(`User not found with ID: ${userId}`);
      }
      
      Logger.success(`✅ User status updated: ${userId} -> ${isActive ? 'active' : 'inactive'}`);
      return { success: true };
    } catch (error) {
      Logger.error('Failed to update user status:', error);
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
      
      // Ensure all users have a role field (migration for existing users)
      const usersWithoutRole = users.filter(u => !u.role);
      if (usersWithoutRole.length > 0) {
        const { ObjectId } = await import('mongodb');
        const bulkOps = usersWithoutRole.map(user => ({
          updateOne: {
            filter: { _id: user._id },
            update: { $set: { role: 'user', updatedAt: new Date() } }
          }
        }));
        await collection.bulkWrite(bulkOps);
        // Update the returned users array
        users.forEach(user => {
          if (!user.role) {
            user.role = 'user';
          }
        });
      }
      
      // Convert _id ObjectId to string for JSON serialization
      const formattedUsers = users.map(user => ({
        ...user,
        _id: user._id ? user._id.toString() : user._id,
        id: user._id ? user._id.toString() : (user.id || null)
      }));
      
      return formattedUsers;
    } catch (error) {
      Logger.error('Failed to get all users:', error);
      return [];
    }
  }

  /**
   * Migrate all existing users to have a default role
   * This is a one-time migration that can be called manually or on server start
   */
  async migrateUserRoles() {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      
      // Find all users without a role field
      const usersWithoutRole = await collection.find({ 
        $or: [
          { role: { $exists: false } },
          { role: null },
          { role: '' }
        ]
      }).toArray();
      
      if (usersWithoutRole.length === 0) {
        Logger.info('✅ All users already have roles assigned');
        return { migrated: 0, message: 'No users need migration' };
      }
      
      // Update all users without role to have 'user' role
      const { ObjectId } = await import('mongodb');
      const bulkOps = usersWithoutRole.map(user => ({
        updateOne: {
          filter: { _id: user._id },
          update: { 
            $set: { 
              role: 'user', 
              updatedAt: new Date() 
            } 
          }
        }
      }));
      
      const result = await collection.bulkWrite(bulkOps);
      
      Logger.success(`✅ Migrated ${result.modifiedCount} users to have default 'user' role`);
      return { 
        migrated: result.modifiedCount, 
        message: `Successfully migrated ${result.modifiedCount} users` 
      };
    } catch (error) {
      Logger.error('Failed to migrate user roles:', error);
      throw error;
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

  // ===== PASSWORD RESET OTP METHODS =====

  /**
   * Create password reset OTP record
   */
  async createPasswordResetOTP(email, hashedOTP, expiresAt) {
    try {
      const collection = this.getCollection(
        mongoConfig.collections.passwordResetOTPs || 'password_reset_otps'
      );
      await collection.insertOne({
        email: email.toLowerCase(),
        hashedOTP,
        expiresAt,
        used: false,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      Logger.success(`✅ Created password reset OTP for: ${email}`);
    } catch (error) {
      Logger.error('Failed to create password reset OTP:', error);
      throw error;
    }
  }

  /**
   * Get latest password reset OTP for email
   */
  async getLatestPasswordResetOTP(email) {
    try {
      const collection = this.getCollection(
        mongoConfig.collections.passwordResetOTPs || 'password_reset_otps'
      );
      return await collection
        .find({ email: email.toLowerCase() })
        .sort({ createdAt: -1 })
        .limit(1)
        .next();
    } catch (error) {
      Logger.error('Failed to get password reset OTP:', error);
      return null;
    }
  }

  /**
   * Increment OTP verification attempts
   */
  async incrementOTPAttempts(otpId) {
    try {
      const collection = this.getCollection(
        mongoConfig.collections.passwordResetOTPs || 'password_reset_otps'
      );
      const { ObjectId } = await import('mongodb');
      await collection.updateOne(
        { _id: new ObjectId(otpId) },
        { 
          $inc: { attempts: 1 },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (error) {
      Logger.error('Failed to increment OTP attempts:', error);
    }
  }

  /**
   * Mark OTP as used
   */
  async markOTPAsUsed(otpId) {
    try {
      const collection = this.getCollection(
        mongoConfig.collections.passwordResetOTPs || 'password_reset_otps'
      );
      const { ObjectId } = await import('mongodb');
      await collection.updateOne(
        { _id: new ObjectId(otpId) },
        { 
          $set: { 
            used: true,
            updatedAt: new Date()
          }
        }
      );
      Logger.success(`✅ Marked OTP as used: ${otpId}`);
    } catch (error) {
      Logger.error('Failed to mark OTP as used:', error);
    }
  }

  /**
   * Invalidate all OTPs for an email
   */
  async invalidateAllOTPsForEmail(email) {
    try {
      const collection = this.getCollection(
        mongoConfig.collections.passwordResetOTPs || 'password_reset_otps'
      );
      const result = await collection.updateMany(
        { email: email.toLowerCase(), used: false },
        { 
          $set: { 
            used: true,
            updatedAt: new Date()
          }
        }
      );
      if (result.modifiedCount > 0) {
        Logger.info(`✅ Invalidated ${result.modifiedCount} OTP(s) for: ${email}`);
      }
    } catch (error) {
      Logger.error('Failed to invalidate OTPs:', error);
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

  /**
   * Log user activity
   * @param {string} userId - User ID who performed the action
   * @param {string} action - Action type (e.g., 'user.login', 'admin.role_change')
   * @param {object} details - Action-specific details
   * @param {object} metadata - Additional metadata (ipAddress, userAgent, timestamp)
   */
  async logActivity(userId, action, details = {}, metadata = {}) {
    try {
      const collection = this.getCollection(mongoConfig.collections.activityLogs);
      
      // Fetch user info for caching
      let userEmail = null;
      let userName = null;
      if (userId && userId !== 'admin') {
        try {
          const user = await this.findUserById(userId);
          if (user) {
            userEmail = user.email || null;
            userName = user.username || user.name || null;
          }
        } catch (error) {
          Logger.warn('Failed to fetch user info for activity log:', error);
        }
      } else if (userId === 'admin') {
        userEmail = 'admin@dorsu.edu.ph';
        userName = 'Admin';
      }

      const activityLog = {
        userId: userId || 'unknown',
        userEmail: userEmail,
        userName: userName,
        action: action,
        details: details,
        metadata: {
          ipAddress: metadata.ipAddress || null,
          userAgent: metadata.userAgent || null,
          timestamp: metadata.timestamp || new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(activityLog);
      Logger.debug(`📝 Activity logged: ${action} by ${userId}`);
      return { ...activityLog, _id: result.insertedId };
    } catch (error) {
      Logger.error('Failed to log activity:', error);
      throw error;
    }
  }

  /**
   * Get activity logs with filtering and pagination
   * @param {object} filters - Filter options (userId, action, startDate, endDate)
   * @param {number} limit - Maximum number of results
   * @param {number} skip - Number of results to skip
   * @returns {Promise<Array>} Array of activity logs
   */
  async getActivityLogs(filters = {}, limit = 100, skip = 0) {
    try {
      if (!this.isConnected || !this.db) {
        Logger.warn('MongoDB not connected, returning empty activity logs');
        return [];
      }
      
      const collection = this.getCollection(mongoConfig.collections.activityLogs);
      
      // Build query
      const query = {};
      
      if (filters.userId) {
        query.userId = filters.userId;
      }
      
      if (filters.action) {
        query.action = filters.action;
      }
      
      if (filters.startDate || filters.endDate) {
        query['metadata.timestamp'] = {};
        if (filters.startDate) {
          query['metadata.timestamp'].$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query['metadata.timestamp'].$lte = new Date(filters.endDate);
        }
      }

      if (filters.userEmail) {
        query.userEmail = { $regex: filters.userEmail, $options: 'i' };
      }

      // Execute query
      const logs = await collection
        .find(query)
        .sort({ 'metadata.timestamp': -1 })
        .limit(limit)
        .skip(skip)
        .toArray();

      // Convert _id to string for JSON serialization
      const formattedLogs = logs.map(log => ({
        ...log,
        _id: log._id ? log._id.toString() : log._id
      }));

      return formattedLogs;
    } catch (error) {
      Logger.error('Failed to get activity logs:', error);
      throw error;
    }
  }

  /**
   * Get activity log count (for pagination)
   * @param {object} filters - Filter options
   * @returns {Promise<number>} Total count
   */
  async getActivityLogCount(filters = {}) {
    try {
      if (!this.isConnected || !this.db) {
        Logger.warn('MongoDB not connected, returning 0 activity log count');
        return 0;
      }
      
      const collection = this.getCollection(mongoConfig.collections.activityLogs);
      
      const query = {};
      
      if (filters.userId) {
        query.userId = filters.userId;
      }
      
      if (filters.action) {
        query.action = filters.action;
      }
      
      if (filters.startDate || filters.endDate) {
        query['metadata.timestamp'] = {};
        if (filters.startDate) {
          query['metadata.timestamp'].$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query['metadata.timestamp'].$lte = new Date(filters.endDate);
        }
      }

      if (filters.userEmail) {
        query.userEmail = { $regex: filters.userEmail, $options: 'i' };
      }

      const count = await collection.countDocuments(query);
      return count;
    } catch (error) {
      Logger.error('Failed to get activity log count:', error);
      throw error;
    }
  }

  /**
   * Verify student credentials against database
   * Checks if studentId and fullName match a student record
   */
  async verifyStudentCredentialsInDB(studentId, fullName) {
    try {
      const collection = this.getCollection(mongoConfig.collections.students || 'students');
      
      // Normalize inputs for comparison
      const normalizedStudentId = studentId.trim().toUpperCase();
      const normalizedFullName = fullName.trim().toLowerCase().replace(/\s+/g, ' ');

      // Find student by exact ID match
      const student = await collection.findOne({ 
        studentId: normalizedStudentId 
      });

      if (!student) {
        Logger.warn(`❌ Student not found: ${studentId}`);
        return { 
          valid: false, 
          reason: 'Student credentials not found in database. Please verify your Student ID and Name.' 
        };
      }

      // Flexible name matching (handles variations like "Vasay, Ivan J P." or "Ivan J P. Vasay")
      const recordName = (student.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const nameParts = normalizedFullName.split(/[,\s]+/).filter(p => p.length > 0);
      const recordNameParts = recordName.split(/[,\s]+/).filter(p => p.length > 0);
      
      // Check if all name parts from input exist in record (order-independent)
      const nameMatch = nameParts.length > 0 && 
        nameParts.every(part => recordNameParts.some(recordPart => recordPart.includes(part) || part.includes(recordPart)));

      if (nameMatch) {
        Logger.success(`✅ Student verified: ${studentId} - ${fullName}`);
        return { 
          valid: true, 
          requiresManualVerification: false 
        };
      }

      Logger.warn(`❌ Student name mismatch: ${studentId} - Expected: ${student.fullName}, Got: ${fullName}`);
      return { 
        valid: false, 
        reason: 'Student name does not match. Please verify your full name.' 
      };
    } catch (error) {
      Logger.error('Failed to verify student credentials:', error);
      return { valid: false, reason: 'Database error occurred' };
    }
  }

  /**
   * Verify faculty credentials against database
   * Checks if fullName matches a faculty record
   */
  async verifyFacultyCredentialsInDB(fullName) {
    try {
      const collection = this.getCollection(mongoConfig.collections.faculty || 'faculty');
      
      // Normalize input for comparison
      const normalizedFullName = fullName.trim().toLowerCase().replace(/\s+/g, ' ');

      // Flexible name matching (handles variations like "Vasay, Ivan J P." or "Ivan J P. Vasay")
      const nameParts = normalizedFullName.split(/[,\s]+/).filter(p => p.length > 0);
      
      // Search for faculty with matching name parts
      const faculty = await collection.find({}).toArray();
      
      for (const member of faculty) {
        const recordName = (member.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const recordNameParts = recordName.split(/[,\s]+/).filter(p => p.length > 0);
        
        // Check if all name parts from input exist in record (order-independent)
        const nameMatch = nameParts.length > 0 && 
          nameParts.every(part => recordNameParts.some(recordPart => recordPart.includes(part) || part.includes(recordPart)));
        
        if (nameMatch) {
          Logger.success(`✅ Faculty verified: ${fullName}`);
          return { 
            valid: true, 
            requiresManualVerification: false 
          };
        }
      }

      Logger.warn(`❌ Faculty not found: ${fullName}`);
      return { 
        valid: false, 
        reason: 'Faculty credentials not found in database. Please verify your full name.' 
      };
    } catch (error) {
      Logger.error('Failed to verify faculty credentials:', error);
      return { valid: false, reason: 'Database error occurred' };
    }
  }

  /**
   * Submit student credentials for verification (Student ID and Name)
   */
  async submitStudentVerification(userId, studentId, fullName) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const { ObjectId } = await import('mongodb');
      
      const updateData = {
        studentVerification: {
          status: 'pending', // 'pending', 'verified', 'rejected'
          studentId: studentId.trim(),
          fullName: fullName.trim(),
          submittedAt: new Date(),
          verifiedAt: null,
          verifiedBy: null,
          rejectionReason: null
        },
        updatedAt: new Date()
      };

      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        throw new Error('User not found');
      }

      Logger.success(`✅ Student verification submitted for user: ${userId} (Student ID: ${studentId})`);
      return true;
    } catch (error) {
      Logger.error('Failed to submit student verification:', error);
      throw error;
    }
  }

  /**
   * Check if a user already exists with the same student ID or name
   * Returns true if a duplicate exists, false otherwise
   */
  async checkExistingUser(studentId, fullName, userType = 'student') {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      
      if (userType === 'student' && studentId) {
        // Check for existing user with the same student ID
        const normalizedStudentId = studentId.trim().toUpperCase();
        const existingByStudentId = await collection.findOne({
          'studentVerification.studentId': normalizedStudentId
        });
        
        if (existingByStudentId) {
          Logger.warn(`❌ User already exists with Student ID: ${studentId}`);
          return { 
            exists: true, 
            reason: `An account with Student ID "${studentId}" already exists. Please sign in instead.` 
          };
        }
      }
      
      // Check for existing user with the same full name (for both students and faculty)
      if (fullName) {
        const normalizedFullName = fullName.trim().toLowerCase().replace(/\s+/g, ' ');
        
        // For students, check studentVerification.fullName
        if (userType === 'student') {
          const existingByName = await collection.findOne({
            'studentVerification.fullName': { 
              $regex: new RegExp(`^${normalizedFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') 
            }
          });
          
          if (existingByName) {
            Logger.warn(`❌ User already exists with name: ${fullName}`);
            return { 
              exists: true, 
              reason: `An account with the name "${fullName}" already exists. Please sign in instead.` 
            };
          }
        } else if (userType === 'faculty') {
          // For faculty, check username or firstName + lastName combination
          const nameParts = normalizedFullName.split(/\s+/);
          if (nameParts.length >= 2) {
            const firstName = nameParts[nameParts.length - 1];
            const lastName = nameParts.slice(0, -1).join(' ');
            
            // Check by username (which might be the full name)
            const existingByUsername = await collection.findOne({
              $or: [
                { username: { $regex: new RegExp(`^${normalizedFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
                { 
                  firstName: { $regex: new RegExp(`^${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                  lastName: { $regex: new RegExp(`^${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                }
              ]
            });
            
            if (existingByUsername) {
              Logger.warn(`❌ User already exists with name: ${fullName}`);
              return { 
                exists: true, 
                reason: `An account with the name "${fullName}" already exists. Please sign in instead.` 
              };
            }
          }
        }
      }
      
      return { exists: false };
    } catch (error) {
      Logger.error('Failed to check existing user:', error);
      return { exists: false }; // Don't block registration on error
    }
  }

  /**
   * Verify student credentials (admin/superadmin only)
   */
  async verifyStudentCredentials(userId, verifiedBy, verified = true, rejectionReason = null) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      const { ObjectId } = await import('mongodb');
      
      const updateData = {
        'studentVerification.status': verified ? 'verified' : 'rejected',
        'studentVerification.verifiedAt': new Date(),
        'studentVerification.verifiedBy': verifiedBy,
        'studentVerification.rejectionReason': rejectionReason || null,
        updatedAt: new Date()
      };

      const result = await collection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        throw new Error('User not found');
      }

      Logger.success(`✅ Student verification ${verified ? 'approved' : 'rejected'} for user: ${userId}`);
      return true;
    } catch (error) {
      Logger.error('Failed to verify student credentials:', error);
      throw error;
    }
  }

  /**
   * Get users pending verification
   */
  async getPendingVerifications(limit = 50, skip = 0) {
    try {
      const collection = this.getCollection(mongoConfig.collections.users || 'users');
      
      const users = await collection
        .find({ 'studentVerification.status': 'pending' })
        .sort({ 'studentVerification.submittedAt': 1 })
        .limit(limit)
        .skip(skip)
        .toArray();

      return users.map(user => ({
        ...user,
        _id: user._id ? user._id.toString() : user._id
      }));
    } catch (error) {
      Logger.error('Failed to get pending verifications:', error);
      throw error;
    }
  }

  /**
   * Add student credential (superadmin only)
   */
  async addStudent(studentId, lastName, firstName, middleInitial, extension) {
    try {
      const collection = this.getCollection(mongoConfig.collections.students || 'students');
      const normalizedStudentId = studentId.trim().toUpperCase();
      const normalizedLastName = lastName.trim();
      const normalizedFirstName = firstName.trim();
      const normalizedMiddleInitial = middleInitial ? middleInitial.trim().toUpperCase() : '';
      const normalizedExtension = extension ? extension.trim() : '';

      // Validate required fields
      if (!normalizedLastName || !normalizedFirstName) {
        throw new Error('Last Name and First Name are required');
      }

      // Check if student already exists
      const existing = await collection.findOne({ studentId: normalizedStudentId });
      if (existing) {
        throw new Error('Student ID already exists');
      }

      // Construct full name for display and verification
      let fullName = `${normalizedLastName}, ${normalizedFirstName}`;
      if (normalizedMiddleInitial) {
        fullName += ` ${normalizedMiddleInitial}.`;
      }
      if (normalizedExtension) {
        fullName += ` ${normalizedExtension}`;
      }

      const result = await collection.insertOne({
        studentId: normalizedStudentId,
        lastName: normalizedLastName,
        firstName: normalizedFirstName,
        middleInitial: normalizedMiddleInitial,
        extension: normalizedExtension,
        fullName: fullName,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      Logger.success(`✅ Student added: ${normalizedStudentId} - ${fullName}`);
      return { 
        ...result, 
        studentId: normalizedStudentId, 
        lastName: normalizedLastName,
        firstName: normalizedFirstName,
        middleInitial: normalizedMiddleInitial,
        extension: normalizedExtension,
        fullName: fullName 
      };
    } catch (error) {
      Logger.error('Failed to add student:', error);
      throw error;
    }
  }

  /**
   * Get all students
   */
  async getAllStudents(limit = 1000, skip = 0) {
    try {
      const collection = this.getCollection(mongoConfig.collections.students || 'students');
      
      const students = await collection
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();

      return students.map(student => ({
        ...student,
        _id: student._id ? student._id.toString() : student._id
      }));
    } catch (error) {
      Logger.error('Failed to get students:', error);
      throw error;
    }
  }

  /**
   * Delete student (superadmin only)
   */
  async deleteStudent(studentId) {
    try {
      const collection = this.getCollection(mongoConfig.collections.students || 'students');
      const normalizedStudentId = studentId.trim().toUpperCase();

      const result = await collection.deleteOne({ studentId: normalizedStudentId });
      
      if (result.deletedCount === 0) {
        throw new Error('Student not found');
      }

      Logger.success(`✅ Student deleted: ${normalizedStudentId}`);
      return true;
    } catch (error) {
      Logger.error('Failed to delete student:', error);
      throw error;
    }
  }

  /**
   * Delete all students (superadmin only)
   */
  async deleteAllStudents() {
    try {
      const collection = this.getCollection(mongoConfig.collections.students || 'students');
      const result = await collection.deleteMany({});
      Logger.success(`✅ Deleted ${result.deletedCount} students`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      Logger.error('Failed to delete all students:', error);
      throw error;
    }
  }

  /**
   * Bulk add students (superadmin only)
   */
  async bulkAddStudents(students) {
    try {
      const collection = this.getCollection(mongoConfig.collections.students || 'students');
      const now = new Date();

      // Normalize and prepare students
      const normalizedStudents = students.map(s => {
        const studentId = s.studentId.trim().toUpperCase();
        let lastName = s.lastName ? s.lastName.trim() : '';
        let firstName = s.firstName ? s.firstName.trim() : '';
        let middleInitial = s.middleInitial ? s.middleInitial.trim().toUpperCase() : '';
        
        // If fullName is provided (for CSV compatibility), parse it
        if (!lastName && !firstName && s.fullName) {
          // Parse fullName: "LastName, FirstName MiddleInitial" or "LastName, FirstName"
          const nameParts = s.fullName.trim().split(',');
          if (nameParts.length >= 2) {
            lastName = nameParts[0].trim();
            const firstPart = nameParts[1].trim();
            const firstParts = firstPart.split(/\s+/);
            firstName = firstParts[0] || '';
            middleInitial = firstParts.length > 1 ? firstParts[1].replace(/\./g, '').toUpperCase() : '';
          } else {
            // Try space-separated format: "LastName FirstName MiddleInitial"
            const parts = s.fullName.trim().split(/\s+/);
            if (parts.length >= 2) {
              lastName = parts[0];
              firstName = parts[parts.length - 1];
              middleInitial = parts.length > 2 ? parts.slice(1, -1).join(' ').replace(/\./g, '').toUpperCase() : '';
            }
          }
        }
        
        // Construct full name
        const fullName = middleInitial 
          ? `${lastName}, ${firstName} ${middleInitial}.`
          : `${lastName}, ${firstName}`;

        return {
          studentId,
          lastName,
          firstName,
          middleInitial,
          fullName: fullName,
          createdAt: now,
          updatedAt: now
        };
      });

      // Validate all students have required fields
      const invalidStudents = normalizedStudents.filter(s => !s.lastName || !s.firstName);
      if (invalidStudents.length > 0) {
        throw new Error(`Invalid student data: Last Name and First Name are required for all students`);
      }

      // Check for duplicates
      const studentIds = normalizedStudents.map(s => s.studentId);
      const existing = await collection.find({ studentId: { $in: studentIds } }).toArray();
      if (existing.length > 0) {
        const existingIds = existing.map(e => e.studentId);
        throw new Error(`Duplicate student IDs found: ${existingIds.join(', ')}`);
      }

      const result = await collection.insertMany(normalizedStudents);
      Logger.success(`✅ Bulk added ${result.insertedCount} students`);
      return result;
    } catch (error) {
      Logger.error('Failed to bulk add students:', error);
      throw error;
    }
  }

  /**
   * Add faculty name (superadmin only)
   */
  async addFaculty(fullName) {
    try {
      const collection = this.getCollection(mongoConfig.collections.faculty || 'faculty');
      const normalizedFullName = fullName.trim();

      // Check if faculty already exists
      const existing = await collection.findOne({ 
        fullName: { $regex: new RegExp(`^${normalizedFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (existing) {
        throw new Error('Faculty name already exists');
      }

      const result = await collection.insertOne({
        fullName: normalizedFullName,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      Logger.success(`✅ Faculty added: ${normalizedFullName}`);
      return { ...result, fullName: normalizedFullName };
    } catch (error) {
      Logger.error('Failed to add faculty:', error);
      throw error;
    }
  }

  /**
   * Get all faculty
   */
  async getAllFaculty(limit = 1000, skip = 0) {
    try {
      const collection = this.getCollection(mongoConfig.collections.faculty || 'faculty');
      
      const faculty = await collection
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();

      return faculty.map(f => ({
        ...f,
        _id: f._id ? f._id.toString() : f._id
      }));
    } catch (error) {
      Logger.error('Failed to get faculty:', error);
      throw error;
    }
  }

  /**
   * Delete faculty (superadmin only)
   */
  async deleteFaculty(facultyId) {
    try {
      const collection = this.getCollection(mongoConfig.collections.faculty || 'faculty');
      const { ObjectId } = await import('mongodb');

      const result = await collection.deleteOne({ _id: new ObjectId(facultyId) });
      
      if (result.deletedCount === 0) {
        throw new Error('Faculty not found');
      }

      Logger.success(`✅ Faculty deleted: ${facultyId}`);
      return true;
    } catch (error) {
      Logger.error('Failed to delete faculty:', error);
      throw error;
    }
  }

  /**
   * Delete all faculty (superadmin only)
   */
  async deleteAllFaculty() {
    try {
      const collection = this.getCollection(mongoConfig.collections.faculty || 'faculty');
      const result = await collection.deleteMany({});
      Logger.success(`✅ Deleted ${result.deletedCount} faculty`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      Logger.error('Failed to delete all faculty:', error);
      throw error;
    }
  }

  /**
   * Bulk add faculty (superadmin only)
   */
  async bulkAddFaculty(facultyList) {
    try {
      const collection = this.getCollection(mongoConfig.collections.faculty || 'faculty');
      const now = new Date();

      // Normalize and prepare faculty
      const normalizedFaculty = facultyList.map(f => ({
        fullName: f.fullName.trim(),
        createdAt: now,
        updatedAt: now
      }));

      // Remove duplicates based on name (case-insensitive)
      const uniqueFaculty = [];
      const seenNames = new Set();
      for (const f of normalizedFaculty) {
        const lowerName = f.fullName.toLowerCase();
        if (!seenNames.has(lowerName)) {
          seenNames.add(lowerName);
          uniqueFaculty.push(f);
        }
      }

      // Check for existing faculty (case-insensitive)
      const existing = await collection.find({}).toArray();
      const existingNames = new Set(existing.map(e => e.fullName.toLowerCase()));
      const duplicateNames = uniqueFaculty
        .filter(f => existingNames.has(f.fullName.toLowerCase()))
        .map(f => f.fullName);
      
      if (duplicateNames.length > 0) {
        throw new Error(`Duplicate faculty names found: ${duplicateNames.join(', ')}`);
      }

      const result = await collection.insertMany(uniqueFaculty);
      Logger.success(`✅ Bulk added ${result.insertedCount} faculty`);
      return result;
    } catch (error) {
      Logger.error('Failed to bulk add faculty:', error);
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

