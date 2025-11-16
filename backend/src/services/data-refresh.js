/**
 * Data Refresh Service
 * Handles automatic refresh of knowledge base when new data is added
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger } from '../utils/logger.js';
import { getEmbeddingService } from './embedding.js';
import { getMongoDBService } from './mongodb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DataRefreshService {
  constructor() {
    this.isRefreshing = false;
    this.lastRefresh = null;
    this.dataFilePath = path.resolve(__dirname, '../data/dorsu_data.json');
    this.lastModified = null;
  }

  /**
   * Parse JSON data into searchable chunks
   */
  parseDataIntoChunks(data, parentKey = '', section = 'general') {
    const chunks = [];
    
    const extractKeywords = (text) => {
      const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been'
      ]);
      
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));
      
      const freq = {};
      words.forEach(word => {
        freq[word] = (freq[word] || 0) + 1;
      });
      
      return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);
    };
    
    // Convert object/array to readable text format
    const objectToText = (obj, prefix = '') => {
      if (Array.isArray(obj)) {
        return obj.map((item, index) => {
          if (typeof item === 'object' && item !== null) {
            return objectToText(item, `${prefix}[${index}]`);
          }
          return `${prefix}[${index}]: ${String(item)}`;
        }).join('\n');
      } else if (typeof obj === 'object' && obj !== null) {
        return Object.entries(obj)
          .map(([key, value]) => {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null) {
              return objectToText(value, fullKey);
            }
            return `${fullKey}: ${String(value)}`;
          })
          .join('\n');
      }
      return `${prefix}: ${String(obj)}`;
    };
    
    const processValue = (value, key, currentSection) => {
      if (typeof value === 'string' && value.length > 20) {
        chunks.push({
          id: `${currentSection}_${key}_${Date.now()}_${chunks.length}`,
          content: value,
          section: currentSection,
          type: 'text',
          category: currentSection,
          keywords: extractKeywords(value),
          metadata: {
            source: 'dorsu_data.json',
            field: key,
            updated_at: new Date()
          }
        });
      } else if (Array.isArray(value)) {
        // Special handling for structured arrays (like vicePresidents, deans, etc.)
        // Group related items together to prevent fragmentation
        const isStructuredArray = value.length > 0 && 
          typeof value[0] === 'object' && 
          value[0] !== null &&
          (key.includes('vicePresidents') || key.includes('deans') || 
           key.includes('directors') || key.includes('chancellor') ||
           key.includes('executives') || key.includes('boardOfRegents'));
        
        if (isStructuredArray) {
          // Create a single chunk for the entire array to keep related data together
          const arrayText = value.map((item, index) => {
            if (typeof item === 'object' && item !== null) {
              return Object.entries(item)
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(', ');
            }
            return String(item);
          }).join('\n');
          
          chunks.push({
            id: `${currentSection}_${key}_${Date.now()}_${chunks.length}`,
            content: arrayText,
            section: currentSection,
            type: 'structured_list',
            category: currentSection,
            keywords: extractKeywords(arrayText),
            metadata: {
              source: 'dorsu_data.json',
              field: key,
              itemCount: value.length,
              updated_at: new Date()
            }
          });
        } else {
          // For non-structured arrays, process items individually
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              processObject(item, `${key}[${index}]`, currentSection);
            } else if (typeof item === 'string' && item.length > 20) {
              chunks.push({
                id: `${currentSection}_${key}_${index}_${Date.now()}_${chunks.length}`,
                content: item,
                section: currentSection,
                type: 'list_item',
                category: currentSection,
                keywords: extractKeywords(item),
                metadata: {
                  source: 'dorsu_data.json',
                  field: key,
                  index: index,
                  updated_at: new Date()
                }
              });
            }
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        processObject(value, key, currentSection);
      }
    };
    
    const processObject = (obj, prefix, currentSection) => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        let newSection = currentSection;
        if (['history', 'leadership', 'programs', 'faculties', 'enrollment', 
             'visionMission', 'mandate', 'qualityPolicy', 'studentOrganizations',
             'annualAccomplishmentReports', 'studentResources', 'offices',
             'detailedOfficeServices', 'additionalOfficesAndCenters',
             'organizationalStructure/DOrSUOfficials2025'].includes(key)) {
          newSection = key;
        }
        
        processValue(value, fullKey, newSection);
      }
    };
    
    if (typeof data === 'object' && data !== null) {
      processObject(data, parentKey, section);
    }
    
    return chunks;
  }

  /**
   * Check if data file has been modified
   */
  hasDataChanged() {
    try {
      const stats = fs.statSync(this.dataFilePath);
      const currentModified = stats.mtime.getTime();
      
      if (this.lastModified === null) {
        this.lastModified = currentModified;
        return false;
      }
      
      if (currentModified > this.lastModified) {
        this.lastModified = currentModified;
        return true;
      }
      
      return false;
    } catch (error) {
      Logger.error('Error checking data file:', error);
      return false;
    }
  }

  /**
   * Refresh knowledge base from dorsu_data.json
   */
  async refreshFromDataFile() {
    if (this.isRefreshing) {
      Logger.warn('Refresh already in progress, skipping...');
      return { success: false, message: 'Refresh already in progress' };
    }

    try {
      this.isRefreshing = true;
      Logger.info('🔄 Starting knowledge base refresh...');

      const mongoService = getMongoDBService();
      const embeddingService = getEmbeddingService();

      // Ensure services are initialized
      if (!mongoService.isConnected) {
        await mongoService.connect();
      }
      if (!embeddingService.isLoaded) {
        await embeddingService.initialize();
      }

      // Load data file
      const rawData = fs.readFileSync(this.dataFilePath, 'utf8');
      const data = JSON.parse(rawData);
      Logger.info('📄 Loaded dorsu_data.json');

      // Parse into chunks
      const chunks = this.parseDataIntoChunks(data);
      Logger.info(`🔨 Generated ${chunks.length} chunks`);

      // Generate embeddings
      Logger.info('🤖 Generating embeddings...');
      const chunksWithEmbeddings = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const textToEmbed = `${chunk.content} ${chunk.keywords.join(' ')}`.trim();
        const embedding = await embeddingService.embedText(textToEmbed);
        
        chunksWithEmbeddings.push({
          ...chunk,
          embedding,
          text: chunk.content
        });

        if ((i + 1) % 50 === 0) {
          Logger.info(`   Progress: ${i + 1}/${chunks.length}`);
        }
      }
      
      Logger.success(`✅ Generated ${chunksWithEmbeddings.length} embeddings`);

      // Clear old chunks
      const collection = mongoService.getCollection('knowledge_chunks');
      const deleteResult = await collection.deleteMany({ 
        'metadata.source': 'dorsu_data.json' 
      });
      Logger.info(`🗑️  Removed ${deleteResult.deletedCount} old chunks`);

      // Insert new chunks
      await mongoService.insertChunks(chunksWithEmbeddings);
      const totalChunks = await collection.countDocuments();
      Logger.success(`✅ Refreshed knowledge base: ${totalChunks} total chunks`);

      this.lastRefresh = new Date();
      this.isRefreshing = false;

      return {
        success: true,
        message: 'Knowledge base refreshed successfully',
        oldChunksRemoved: deleteResult.deletedCount,
        newChunksAdded: chunksWithEmbeddings.length,
        totalChunks: totalChunks,
        timestamp: this.lastRefresh
      };

    } catch (error) {
      this.isRefreshing = false;
      Logger.error('❌ Knowledge base refresh failed:', error);
      return {
        success: false,
        message: error.message,
        error: error.toString()
      };
    }
  }

  /**
   * Auto-watch for file changes and refresh
   */
  startAutoRefresh(intervalMs = 60000) {
    Logger.info(`👀 Watching for changes in dorsu_data.json (checking every ${intervalMs/1000}s)`);
    
    setInterval(async () => {
      if (this.hasDataChanged()) {
        Logger.info('📝 Data file changed, triggering refresh...');
        await this.refreshFromDataFile();
      }
    }, intervalMs);
  }

  /**
   * Get refresh status
   */
  getStatus() {
    return {
      isRefreshing: this.isRefreshing,
      lastRefresh: this.lastRefresh,
      lastModified: this.lastModified ? new Date(this.lastModified) : null
    };
  }
}

// Singleton instance
let dataRefreshServiceInstance = null;

export function getDataRefreshService() {
  if (!dataRefreshServiceInstance) {
    dataRefreshServiceInstance = new DataRefreshService();
  }
  return dataRefreshServiceInstance;
}

export { DataRefreshService };

