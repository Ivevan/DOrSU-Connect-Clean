/**
 * Script to generate embeddings for all schedule events without embeddings
 * Run: node backend/scripts/generate-schedule-embeddings.js
 */

import { getMongoDBService } from '../src/services/mongodb.js';
import { getEmbeddingService } from '../src/services/embedding.js';
import { Logger } from '../src/utils/logger.js';

/**
 * Generate searchable text from schedule event for embedding
 */
function generateSearchableText(event) {
  let text = '';
  
  // Add title
  if (event.title) {
    text += `${event.title}. `;
  }
  
  // Add description
  if (event.description) {
    text += `${event.description}. `;
  }
  
  // Add category
  if (event.category) {
    text += `Category: ${event.category}. `;
  }
  
  // Add date information in multiple formats for better matching
  if (event.isoDate || event.date) {
    const eventDate = new Date(event.isoDate || event.date);
    if (!isNaN(eventDate.getTime())) {
      const dateFormats = [
        eventDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        eventDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
        eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ];
      text += `Date: ${dateFormats.join(', ')}. `;
    }
  }
  
  // Add date range if applicable
  if (event.dateType === 'date_range' && event.startDate && event.endDate) {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const startStr = start.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      text += `Date Range: ${startStr} to ${endStr}. `;
    }
  }
  
  // Add time
  if (event.time && event.time !== 'All Day') {
    text += `Time: ${event.time}. `;
  }
  
  // Add semester information
  if (event.semester) {
    const semesterText = event.semester === 1 ? '1st Semester' : 
                        event.semester === 2 ? '2nd Semester' : 
                        event.semester === 'Off' ? 'Off Semester' : 
                        `Semester ${event.semester}`;
    text += `Semester: ${semesterText}. `;
  }
  
  return text.trim();
}

async function generateScheduleEmbeddings() {
  try {
    Logger.info('🔄 Starting schedule embedding generation...');
    
    const mongoService = getMongoDBService();
    await mongoService.connect();
    
    const embeddingService = getEmbeddingService();
    await embeddingService.initialize();
    
    const collection = mongoService.getCollection('schedule');
    
    // Find all schedule events without embeddings
    const eventsWithoutEmbeddings = await collection.find({
      $or: [
        { embedding: { $exists: false } },
        { embedding: null },
        { embedding: { $size: 0 } }
      ]
    }).toArray();
    
    Logger.info(`📊 Found ${eventsWithoutEmbeddings.length} schedule events without embeddings`);
    
    if (eventsWithoutEmbeddings.length === 0) {
      Logger.success('✅ All schedule events already have embeddings!');
      process.exit(0);
    }
    
    // Generate embeddings
    Logger.info('🤖 Generating embeddings for schedule events...');
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < eventsWithoutEmbeddings.length; i++) {
      const event = eventsWithoutEmbeddings[i];
      try {
        const searchableText = generateSearchableText(event);
        
        if (!searchableText || searchableText.length < 10) {
          Logger.warn(`   Skipping event ${event._id}: text too short`);
          continue;
        }
        
        const embedding = await embeddingService.embedText(searchableText);
        
        // Update event with embedding
        await collection.updateOne(
          { _id: event._id },
          {
            $set: {
              embedding: embedding,
              updatedAt: new Date()
            }
          }
        );
        
        successCount++;
        
        if ((i + 1) % 10 === 0) {
          Logger.info(`   Progress: ${i + 1}/${eventsWithoutEmbeddings.length} (${successCount} success, ${errorCount} errors)`);
        }
      } catch (error) {
        errorCount++;
        Logger.error(`   Failed to generate embedding for event ${event._id} (${event.title || 'untitled'}): ${error.message}`);
      }
    }
    
    Logger.success(`✅ Embedding generation complete!`);
    Logger.info(`   Success: ${successCount}`);
    Logger.info(`   Errors: ${errorCount}`);
    
    // Verify
    const eventsWithEmbeddings = await collection.countDocuments({ 
      embedding: { $exists: true, $ne: null, $not: { $size: 0 } } 
    });
    const totalEvents = await collection.countDocuments({});
    Logger.info(`\n📊 Final count: ${eventsWithEmbeddings}/${totalEvents} schedule events with embeddings`);
    
    if (eventsWithEmbeddings === totalEvents) {
      Logger.success('✅ All schedule events now have embeddings! Ready for vector search.');
    } else {
      Logger.warn(`⚠️  ${totalEvents - eventsWithEmbeddings} events still need embeddings`);
    }
    
    process.exit(0);
  } catch (error) {
    Logger.error('Embedding generation failed:', error);
    process.exit(1);
  }
}

generateScheduleEmbeddings();

