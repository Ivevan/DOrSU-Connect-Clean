/**
 * Standalone script to refresh the knowledge base from dorsu_data.json
 * Usage: node scripts/refresh-knowledge-base.js
 * 
 * NOTE: This script refreshes the MongoDB database. If the server is running,
 * it will automatically sync via the 30-second interval sync. For immediate
 * sync, use the /api/refresh-knowledge endpoint instead.
 */

import { getDataRefreshService } from '../src/services/data-refresh.js';
import { getMongoDBService } from '../src/services/mongodb.js';
import { OptimizedRAGService } from '../src/services/rag.js';
import { Logger } from '../src/utils/logger.js';

async function refreshKnowledgeBase() {
  try {
    Logger.info('🚀 Starting knowledge base refresh script...');
    
    // Initialize MongoDB connection
    const mongoService = getMongoDBService();
    await mongoService.connect();
    Logger.success('✅ MongoDB connected');
    
    // Initialize data refresh service
    const dataRefreshService = getDataRefreshService();
    const result = await dataRefreshService.refreshFromDataFile();
    
    if (result.success) {
      Logger.success('✅ Knowledge base refreshed successfully!');
      Logger.info(`📊 Generated: ${result.totalChunksGenerated} chunks`);
      Logger.info(`📥 Inserted: ${result.newChunksAdded} new chunks`);
      Logger.info(`🔄 Updated: ${result.updatedChunks} existing chunks`);
      Logger.info(`📦 Total in database: ${result.totalChunks} chunks`);
      
      // CRITICAL: Sync RAG service with updated chunks
      Logger.info('🔄 Syncing RAG service with updated chunks...');
      try {
        const ragService = new OptimizedRAGService(mongoService);
        await ragService.forceSyncMongoDB();
        Logger.success('✅ RAG service synced successfully');
        Logger.info(`   📚 Keyword search index: ${ragService.faissOptimizedData?.chunks?.length || 0} chunks`);
        Logger.info(`   🔍 FAISS vector index: ${ragService.embeddings?.length || 0} embeddings`);
      } catch (ragError) {
        Logger.warn(`⚠️  RAG sync failed (server will sync automatically): ${ragError.message}`);
        Logger.info('   💡 If server is running, it will sync within 30 seconds');
      }
      
      Logger.success('✅ Refresh complete! All chunks are now available for search.');
      process.exit(0);
    } else {
      Logger.error('❌ Refresh failed:', result.message);
      process.exit(1);
    }
  } catch (error) {
    Logger.error('❌ Error refreshing knowledge base:', error);
    process.exit(1);
  }
}

// Run the refresh
refreshKnowledgeBase();

