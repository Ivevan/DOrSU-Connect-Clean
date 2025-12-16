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
      emailVerifications: 'email_verifications',
      activityLogs: 'activity_logs',
      students: 'students',
      faculty: 'faculty'
    },
    
    // Connection options
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 30000, // Increased from 5000 to 30000 (30 seconds)
      socketTimeoutMS: 60000, // Increased from 45000 to 60000 (60 seconds)
      connectTimeoutMS: 30000, // Added: 30 seconds to establish connection
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      // Additional resilience options
      heartbeatFrequencyMS: 10000 // Check connection health every 10 seconds
    }
  };
  
  