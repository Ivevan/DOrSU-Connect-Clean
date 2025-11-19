/**
 * Script to regenerate embeddings for all chunks without embeddings
 * Run: node backend/scripts/regenerate-embeddings.js
 */

import { getMongoDBService } from '../src/services/mongodb.js';
import { getEmbeddingService } from '../src/services/embedding.js';
import { Logger } from '../src/utils/logger.js';

async function regenerateEmbeddings() {
  try {
    Logger.info('🔄 Starting embedding regeneration...');
    
    const mongoService = getMongoDBService();
    await mongoService.connect();
    
    const embeddingService = getEmbeddingService();
    await embeddingService.initialize();
    
    const collection = mongoService.getCollection('knowledge_chunks');
    
    // Find all chunks without embeddings
    const chunksWithoutEmbeddings = await collection.find({
      $or: [
        { embedding: { $exists: false } },
        { embedding: null },
        { embedding: { $size: 0 } }
      ]
    }).toArray();
    
    Logger.info(`📊 Found ${chunksWithoutEmbeddings.length} chunks without embeddings`);
    
    if (chunksWithoutEmbeddings.length === 0) {
      Logger.success('✅ All chunks already have embeddings!');
      process.exit(0);
    }
    
    // Regenerate embeddings
    Logger.info('🤖 Generating embeddings...');
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < chunksWithoutEmbeddings.length; i++) {
      const chunk = chunksWithoutEmbeddings[i];
      try {
        const textToEmbed = `${chunk.content || chunk.text || ''} ${(chunk.keywords || []).join(' ')}`.trim();
        
        if (!textToEmbed || textToEmbed.length < 10) {
          Logger.warn(`   Skipping chunk ${chunk.id}: text too short`);
          continue;
        }
        
        const embedding = await embeddingService.embedText(textToEmbed);
        
        // Update chunk with embedding
        await collection.updateOne(
          { _id: chunk._id },
          {
            $set: {
              embedding: embedding,
              'metadata.embedding_updated_at': new Date()
            }
          }
        );
        
        successCount++;
        
        if ((i + 1) % 50 === 0) {
          Logger.info(`   Progress: ${i + 1}/${chunksWithoutEmbeddings.length} (${successCount} success, ${errorCount} errors)`);
        }
      } catch (error) {
        errorCount++;
        Logger.error(`   Failed to generate embedding for chunk ${chunk.id}: ${error.message}`);
      }
    }
    
    Logger.success(`✅ Regeneration complete!`);
    Logger.info(`   Success: ${successCount}`);
    Logger.info(`   Errors: ${errorCount}`);
    
    // Verify
    const chunksWithEmbeddings = await collection.countDocuments({ 
      embedding: { $exists: true, $ne: null, $not: { $size: 0 } } 
    });
    Logger.info(`\n📊 Final count: ${chunksWithEmbeddings} chunks with embeddings`);
    
    process.exit(0);
  } catch (error) {
    Logger.error('Regeneration failed:', error);
    process.exit(1);
  }
}

regenerateEmbeddings();

