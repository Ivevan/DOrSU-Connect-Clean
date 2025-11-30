/**
 * Data Refresh Script
 * Refreshes the knowledge base from dorsu_data.json
 * 
 * Usage: npm run refresh
 */

import 'dotenv/config';
import { getDatasetSetupService } from '../src/services/dataset-setup.js';
import { Logger } from '../src/utils/logger.js';

async function refreshData() {
  try {
    Logger.info('🚀 Starting data refresh...');
    
    const datasetSetupService = getDatasetSetupService();
    const result = await datasetSetupService.refreshFromDataFile();
    
    if (result.success) {
      Logger.success('✅ Data refresh completed successfully!');
      Logger.info(`   📊 Generated: ${result.totalChunksGenerated} chunks`);
      Logger.info(`   📥 Inserted: ${result.newChunksAdded} new chunks`);
      Logger.info(`   🔄 Updated: ${result.updatedChunks} existing chunks`);
      Logger.info(`   🗑️  Removed: ${result.oldChunksRemoved} old chunks`);
      Logger.info(`   📦 Total in database: ${result.totalChunks} chunks`);
      process.exit(0);
    } else {
      Logger.error('❌ Data refresh failed:', result.message);
      process.exit(1);
    }
  } catch (error) {
    Logger.error('❌ Fatal error during data refresh:', error);
    process.exit(1);
  }
}

refreshData();

