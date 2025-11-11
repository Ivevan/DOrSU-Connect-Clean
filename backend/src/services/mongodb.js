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
      
      // Text search index for full-text search
      await chunksCollection.createIndex({ 
        text: 'text', 
        keywords: 'text' 
      }, { 
        name: 'text_search_index',
        weights: { text: 10, keywords: 5 }
      });
      
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
   * Insert knowledge chunks (bulk insert)
   */
  async insertChunks(chunks) {
    try {
      const collection = this.getCollection(mongoConfig.collections.chunks);
      
      // Add timestamps
      const chunksWithTimestamps = chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          created_at: new Date(),
          updated_at: new Date()
        }
      }));
      
      const result = await collection.insertMany(chunksWithTimestamps, { ordered: false });
      Logger.success(`✅ Inserted ${result.insertedCount} chunks into MongoDB`);
      return result;
      
    } catch (error) {
      if (error.code === 11000) {
        Logger.warn('Some chunks already exist (duplicate key), skipping...');
      } else {
        Logger.error('Failed to insert chunks:', error);
        throw error;
      }
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
   * Vector similarity search using cosine similarity
   * Note: MongoDB Atlas supports vector search with $vectorSearch in Atlas Search
   */
  async vectorSearch(queryEmbedding, limit = 10) {
    try {
      const collection = this.getCollection(mongoConfig.collections.chunks);
      
      // Get all chunks with embeddings
      const chunks = await collection.find({ embedding: { $exists: true } }).toArray();
      
      // Calculate cosine similarity for each chunk
      const results = chunks.map(chunk => {
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        return {
          ...chunk,
          similarity,
          score: similarity * 100
        };
      });
      
      // Sort by similarity and return top results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
    } catch (error) {
      Logger.error('Vector search failed:', error);
      throw error;
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
   */
  async cacheResponse(query, response, complexity, ttl = 3600) {
    try {
      const collection = this.getCollection(mongoConfig.collections.cache);
      
      await collection.updateOne(
        { query: query.toLowerCase().trim() },
        {
          $set: {
            response,
            complexity,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + ttl * 1000)
          }
        },
        { upsert: true }
      );
      
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
      
      const cached = await collection.findOne({
        query: query.toLowerCase().trim(),
        expiresAt: { $gt: new Date() }
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
  async saveChatSession(userId, sessionId, messages) {
    try {
      const collection = this.getCollection(mongoConfig.collections.conversations);
      
      // Update or create chat session within user's document
      const result = await collection.updateOne(
        { userId: userId },
        {
          $set: {
            [`sessions.${sessionId}.messages`]: messages,
            [`sessions.${sessionId}.updatedAt`]: new Date()
          },
          $setOnInsert: {
            userId: userId,
            history: [],
            createdAt: new Date(),
            [`sessions.${sessionId}.createdAt`]: new Date()
          }
        },
        { upsert: true }
      );
      
      Logger.success(`✅ Chat session saved for user: ${userId}, session: ${sessionId}`);
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
      const updateExisting = await collection.updateOne(
        { userId: userId, 'history.id': chatInfo.id },
        {
          $set: {
            'history.$.title': chatInfo.title,
            'history.$.preview': chatInfo.preview,
            'history.$.timestamp': chatInfo.timestamp
          },
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

