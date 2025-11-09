/**
 * Standalone script to refresh the knowledge base from dorsu_data.json
 * Usage: node scripts/refresh-knowledge-base.js
 */

import { getDataRefreshService } from '../src/services/data-refresh.js';
import { Logger } from '../src/utils/logger.js';

async function refreshKnowledgeBase() {
  try {
    Logger.info('🚀 Starting knowledge base refresh script...');
    
    const dataRefreshService = getDataRefreshService();
    const result = await dataRefreshService.refreshFromDataFile();
    
    if (result.success) {
      Logger.success('✅ Knowledge base refreshed successfully!');
      Logger.info(`📊 Total chunks: ${result.data?.totalChunks || 'N/A'}`);
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

