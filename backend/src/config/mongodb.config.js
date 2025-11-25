/**
 * MongoDB Configuration
 * Centralized configuration for MongoDB connection and settings
 */

export const mongoConfig = {
    // MongoDB Atlas connection string
    uri: process.env.MONGODB_URI || 'mongodb+srv://dcypher:admin@dorsuai.gdeuowj.mongodb.net/?retryWrites=true&w=majority&appName=DOrSUAI',
    
    // Database name
    dbName: process.env.MONGODB_DB_NAME || 'dorsu_connect',
    
    // Collection names
    collections: {
      chunks: process.env.MONGODB_COLLECTION_CHUNKS || 'knowledge_chunks',
      cache: process.env.MONGODB_COLLECTION_CACHE || 'ai_cache',
      analytics: process.env.MONGODB_COLLECTION_ANALYTICS || 'query_analytics',
      conversations: 'conversations',
      feedback: 'user_feedback',
      users: 'users',
      emailVerifications: 'email_verifications'
    },
    
    // Connection options
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
      w: 'majority'
    }
  };
  
  