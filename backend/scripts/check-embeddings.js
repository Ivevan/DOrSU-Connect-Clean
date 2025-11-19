/**
 * Diagnostic script to check if chunks have embeddings
 * Run: node backend/scripts/check-embeddings.js
 */

import { getMongoDBService } from '../src/services/mongodb.js';
import { Logger } from '../src/utils/logger.js';

async function checkEmbeddings() {
  try {
    const mongoService = getMongoDBService();
    await mongoService.connect();
    
    const collection = mongoService.getCollection('knowledge_chunks');
    
    // Check total chunks
    const totalChunks = await collection.countDocuments({});
    Logger.info(`📊 Total chunks in MongoDB: ${totalChunks}`);
    
    // Check chunks with embeddings
    const chunksWithEmbeddings = await collection.countDocuments({ 
      embedding: { $exists: true, $ne: null } 
    });
    Logger.info(`✅ Chunks with embeddings: ${chunksWithEmbeddings}`);
    Logger.info(`❌ Chunks without embeddings: ${totalChunks - chunksWithEmbeddings}`);
    
    // Check embedding dimensions
    const sampleChunk = await collection.findOne({ embedding: { $exists: true } });
    if (sampleChunk && sampleChunk.embedding) {
      Logger.info(`📏 Embedding dimension: ${sampleChunk.embedding.length}`);
      Logger.info(`   Expected: 384 (Xenova/all-MiniLM-L6-v2)`);
      if (sampleChunk.embedding.length !== 384) {
        Logger.warn(`⚠️  WARNING: Embedding dimension mismatch! Expected 384, got ${sampleChunk.embedding.length}`);
      }
    }
    
    // Check president chunks specifically
    const presidentChunks = await collection.find({
      $or: [
        { section: { $regex: /leadership/i } },
        { type: { $regex: /president/i } },
        { content: { $regex: /president|roy.*ponce|dr\.?\s*roy/i } },
        { text: { $regex: /president|roy.*ponce|dr\.?\s*roy/i } }
      ]
    }).toArray();
    
    Logger.info(`\n👑 President-related chunks: ${presidentChunks.length}`);
    
    if (presidentChunks.length > 0) {
      Logger.info(`\n📋 Sample president chunks:`);
      presidentChunks.slice(0, 3).forEach((chunk, i) => {
        const hasEmbedding = chunk.embedding && chunk.embedding.length > 0;
        Logger.info(`\n   ${i + 1}. ID: ${chunk.id}`);
        Logger.info(`      Section: ${chunk.section}`);
        Logger.info(`      Type: ${chunk.type}`);
        Logger.info(`      Has embedding: ${hasEmbedding ? '✅' : '❌'}`);
        if (hasEmbedding) {
          Logger.info(`      Embedding dimension: ${chunk.embedding.length}`);
        }
        Logger.info(`      Content preview: "${(chunk.content || chunk.text || '').substring(0, 100)}..."`);
      });
      
      // Check how many president chunks have embeddings
      const presidentChunksWithEmbeddings = presidentChunks.filter(c => 
        c.embedding && c.embedding.length > 0
      ).length;
      Logger.info(`\n   ✅ President chunks with embeddings: ${presidentChunksWithEmbeddings}/${presidentChunks.length}`);
    } else {
      Logger.warn(`\n⚠️  No president chunks found in MongoDB!`);
      Logger.warn(`   This means the data refresh might not have processed president data correctly.`);
    }
    
    // Test vector search
    Logger.info(`\n🔍 Testing vector search...`);
    try {
      const { getEmbeddingService } = await import('../src/services/embedding.js');
      const embeddingService = getEmbeddingService();
      await embeddingService.initialize();
      
      const testQuery = "Who is the president of DOrSU?";
      const queryEmbedding = await embeddingService.embedText(testQuery);
      Logger.info(`   Generated query embedding: ${queryEmbedding.length} dimensions`);
      
      const vectorResults = await mongoService.vectorSearch(queryEmbedding, 5);
      Logger.info(`   Vector search results: ${vectorResults.length} chunks`);
      
      if (vectorResults.length > 0) {
        Logger.info(`\n   Top result:`);
        Logger.info(`      Score: ${vectorResults[0].score.toFixed(2)}`);
        Logger.info(`      Section: ${vectorResults[0].section}`);
        Logger.info(`      Type: ${vectorResults[0].type}`);
        Logger.info(`      Content: "${(vectorResults[0].text || vectorResults[0].content || '').substring(0, 150)}..."`);
      } else {
        Logger.warn(`   ⚠️  Vector search returned 0 results!`);
      }
    } catch (vectorError) {
      Logger.error(`   Vector search test failed: ${vectorError.message}`);
    }
    
    process.exit(0);
  } catch (error) {
    Logger.error('Diagnostic failed:', error);
    process.exit(1);
  }
}

checkEmbeddings();

