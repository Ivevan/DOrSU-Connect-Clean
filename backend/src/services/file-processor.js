/**
 * File Processor Service
 * Handles parsing and processing of uploaded files (txt, docx, csv, json)
 */

import fs from 'node:fs';
import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { getEmbeddingService } from './embedding.js';

class FileProcessorService {
  constructor() {
    this.embeddingService = null;
  }

  async initialize() {
    if (!this.embeddingService) {
      this.embeddingService = getEmbeddingService();
      if (!this.embeddingService.isLoaded) {
        await this.embeddingService.initialize();
      }
    }
  }

  /**
   * Process uploaded file and extract text content
   */
  async processFile(fileBuffer, fileName, mimeType) {
    try {
      await this.initialize();
      
      const extension = path.extname(fileName).toLowerCase();
      let textContent = '';
      let metadata = {
        fileName,
        mimeType,
        extension,
        uploadedAt: new Date()
      };

      switch (extension) {
        case '.txt':
          textContent = fileBuffer.toString('utf8');
          break;
        
        case '.json':
          try {
            const jsonData = JSON.parse(fileBuffer.toString('utf8'));
            // Convert JSON to readable text
            textContent = this.jsonToText(jsonData);
            metadata.jsonStructure = true;
          } catch (error) {
            throw new Error(`Invalid JSON file: ${error.message}`);
          }
          break;
        
        case '.csv':
          textContent = this.csvToText(fileBuffer.toString('utf8'));
          metadata.csvStructure = true;
          break;
        
        case '.docx':
          // For docx, we'll need to extract text
          // Since we don't have mammoth installed, we'll try a simple approach
          // Note: This is a basic implementation - for production, use mammoth or docx-parser
          textContent = await this.extractDocxText(fileBuffer);
          break;
        
        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }

      if (!textContent || textContent.trim().length === 0) {
        throw new Error('File appears to be empty or could not be parsed');
      }

      return {
        textContent: textContent.trim(),
        metadata
      };
    } catch (error) {
      Logger.error(`File processing error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert JSON to readable text format
   */
  jsonToText(jsonData, prefix = '') {
    let text = '';
    
    if (Array.isArray(jsonData)) {
      jsonData.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          text += this.jsonToText(item, `${prefix}[${index}]`);
        } else {
          text += `${prefix}[${index}]: ${String(item)}\n`;
        }
      });
    } else if (typeof jsonData === 'object' && jsonData !== null) {
      for (const [key, value] of Object.entries(jsonData)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null) {
          text += this.jsonToText(value, fullKey);
        } else {
          text += `${fullKey}: ${String(value)}\n`;
        }
      }
    } else {
      text += `${prefix}: ${String(jsonData)}\n`;
    }
    
    return text;
  }

  /**
   * Convert CSV to readable text format
   */
  csvToText(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return '';
    
    // Parse CSV (simple implementation - assumes comma-separated)
    const rows = lines.map(line => {
      // Handle quoted fields
      const fields = [];
      let currentField = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim());
      return fields;
    });
    
    if (rows.length === 0) return '';
    
    // Convert to text format
    let text = '';
    const headers = rows[0];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === headers.length) {
        text += `Row ${i}:\n`;
        headers.forEach((header, index) => {
          if (row[index]) {
            text += `  ${header}: ${row[index]}\n`;
          }
        });
        text += '\n';
      }
    }
    
    return text;
  }

  /**
   * Extract text from DOCX file
   * Note: This is a basic implementation. For production, install and use 'mammoth' package
   */
  async extractDocxText(fileBuffer) {
    // DOCX files are ZIP archives containing XML files
    // The main content is in word/document.xml
    // This is a simplified extraction - for production, use mammoth library
    
    try {
      // Try to extract text from DOCX XML structure
      // DOCX files start with PK (ZIP signature)
      const zipSignature = fileBuffer.slice(0, 2).toString('hex');
      if (zipSignature !== '504b') {
        throw new Error('Invalid DOCX file format');
      }
      
      // For now, return a placeholder message
      // In production, you should use: npm install mammoth
      // Then: const result = await mammoth.extractRawText({ buffer: fileBuffer });
      // return result.value;
      
      throw new Error('DOCX parsing requires mammoth library. Please install: npm install mammoth');
    } catch (error) {
      Logger.error(`DOCX extraction error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse file content into knowledge base chunks
   */
  async parseIntoChunks(textContent, metadata) {
    try {
      await this.initialize();
      
      const chunks = [];
      const chunkSize = 500; // Characters per chunk
      const overlap = 50; // Overlap between chunks
      
      // Split text into sentences
      const sentences = textContent.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
      
      let currentChunk = '';
      let chunkIndex = 0;
      
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
          // Save current chunk
          const chunkId = `upload_${metadata.fileName}_${Date.now()}_${chunkIndex++}`;
          chunks.push({
            id: chunkId,
            content: currentChunk.trim(),
            text: currentChunk.trim(),
            section: 'uploaded_files',
            type: 'file_upload',
            category: metadata.extension.replace('.', ''),
            keywords: this.extractKeywords(currentChunk),
            metadata: {
              ...metadata,
              chunkIndex,
              source: `file_upload_${metadata.fileName}`
            }
          });
          
          // Start new chunk with overlap
          const words = currentChunk.split(/\s+/);
          const overlapWords = words.slice(-Math.floor(overlap / 10)); // Approximate overlap
          currentChunk = overlapWords.join(' ') + ' ' + sentence;
        } else {
          currentChunk += (currentChunk ? '. ' : '') + sentence;
        }
      }
      
      // Add remaining chunk
      if (currentChunk.trim().length > 0) {
        const chunkId = `upload_${metadata.fileName}_${Date.now()}_${chunkIndex++}`;
        chunks.push({
          id: chunkId,
          content: currentChunk.trim(),
          text: currentChunk.trim(),
          section: 'uploaded_files',
          type: 'file_upload',
          category: metadata.extension.replace('.', ''),
          keywords: this.extractKeywords(currentChunk),
          metadata: {
            ...metadata,
            chunkIndex,
            source: `file_upload_${metadata.fileName}`
          }
        });
      }
      
      // Generate embeddings for all chunks
      Logger.info(`Generating embeddings for ${chunks.length} chunks from ${metadata.fileName}...`);
      const chunksWithEmbeddings = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const textToEmbed = `${chunk.content} ${chunk.keywords.join(' ')}`.trim();
        const embedding = await this.embeddingService.embedText(textToEmbed);
        
        chunksWithEmbeddings.push({
          ...chunk,
          embedding
        });
        
        if ((i + 1) % 10 === 0) {
          Logger.info(`   Progress: ${i + 1}/${chunks.length}`);
        }
      }
      
      Logger.success(`✅ Generated ${chunksWithEmbeddings.length} embeddings`);
      
      return chunksWithEmbeddings;
    } catch (error) {
      Logger.error(`Chunk parsing error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them'
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
  }

  /**
   * Parse CSV calendar file
   */
  parseCalendarCSV(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];
    
    const events = [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Expected headers: title, date, time, category, description (optional)
    const titleIndex = headers.findIndex(h => h.includes('title') || h.includes('event'));
    const dateIndex = headers.findIndex(h => h.includes('date'));
    const timeIndex = headers.findIndex(h => h.includes('time'));
    const categoryIndex = headers.findIndex(h => h.includes('category') || h.includes('type'));
    const descriptionIndex = headers.findIndex(h => h.includes('description') || h.includes('desc'));
    
    if (titleIndex === -1 || dateIndex === -1) {
      throw new Error('CSV must contain "title" and "date" columns');
    }
    
    // Get current year for month-only dates
    const currentYear = new Date().getFullYear();
    
    for (let i = 1; i < lines.length; i++) {
      const fields = this.parseCSVLine(lines[i]);
      
      if (fields.length <= Math.max(titleIndex, dateIndex)) continue;
      
      const title = fields[titleIndex]?.trim();
      const dateStr = fields[dateIndex]?.trim();
      const time = timeIndex >= 0 ? fields[timeIndex]?.trim() || 'All Day' : 'All Day';
      const category = categoryIndex >= 0 ? fields[categoryIndex]?.trim() || 'Announcement' : 'Announcement';
      const description = descriptionIndex >= 0 ? fields[descriptionIndex]?.trim() || '' : '';
      
      if (!title || !dateStr) continue;
      
      // Skip invalid entries
      const invalidPatterns = ['within this semester', 'within semester', 'tbd', 'tba', 'to be determined'];
      if (invalidPatterns.some(pattern => dateStr.toLowerCase().includes(pattern))) {
        Logger.warn(`Skipping row ${i + 1}: Invalid date entry: ${dateStr}`);
        continue;
      }
      
      // Parse dates - may return multiple dates for fields with multiple dates
      const dates = this.parseDate(dateStr, currentYear);
      
      if (!dates || dates.length === 0) {
        Logger.warn(`Skipping row ${i + 1}: Invalid date format: ${dateStr}`);
        continue;
      }
      
      // Create an event for each date found
      for (const date of dates) {
        events.push({
          title,
          date: this.formatDate(date),
          isoDate: date.toISOString(),
          time,
          category,
          description,
          source: 'CSV Upload'
        });
      }
    }
    
    return events;
  }

  /**
   * Parse a single CSV line handling quoted fields
   */
  parseCSVLine(line) {
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());
    return fields;
  }

  /**
   * Parse date string in various formats
   * Returns an array of dates (for fields with multiple dates)
   */
  parseDate(dateStr, currentYear = null) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    const year = currentYear || new Date().getFullYear();
    const dates = [];
    
    // Month names mapping (0-indexed: 0=January, 11=December)
    const monthNames = {
      'january': 0, 'jan': 0,
      'february': 1, 'feb': 1,
      'march': 2, 'mar': 2,
      'april': 3, 'apr': 3,
      'may': 4,
      'june': 5, 'jun': 5,
      'july': 6, 'jul': 6,
      'august': 7, 'aug': 7,
      'september': 8, 'sep': 8, 'sept': 8,
      'october': 9, 'oct': 9,
      'november': 10, 'nov': 10,
      'december': 11, 'dec': 11
    };
    
    // Try ISO format first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return [date];
    }
    
    // Try MM/DD/YYYY or DD/MM/YYYY
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0]) {
          // MM/DD/YYYY or DD/MM/YYYY - try both
          const m1 = parseInt(match[1], 10);
          const m2 = parseInt(match[2], 10);
          const y = parseInt(match[3], 10);
          
          // Try MM/DD/YYYY first
          date = new Date(y, m1 - 1, m2);
          if (!isNaN(date.getTime()) && date.getMonth() === m1 - 1) return [date];
          
          // Try DD/MM/YYYY
          date = new Date(y, m2 - 1, m1);
          if (!isNaN(date.getTime()) && date.getMonth() === m2 - 1) return [date];
        } else if (format === formats[1]) {
          // YYYY-MM-DD
          const y = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const d = parseInt(match[3], 10);
          date = new Date(y, m - 1, d);
          if (!isNaN(date.getTime())) return [date];
        } else {
          // DD-MM-YYYY
          const d = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const y = parseInt(match[3], 10);
          date = new Date(y, m - 1, d);
          if (!isNaN(date.getTime())) return [date];
        }
      }
    }
    
    // Handle month name with multiple dates: "December 12 15 16 17 18"
    const monthWithDatesPattern = /^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+([\d\s,]+)/i;
    const monthWithDatesMatch = dateStr.match(monthWithDatesPattern);
    if (monthWithDatesMatch) {
      const monthName = monthWithDatesMatch[1].toLowerCase();
      const monthIndex = monthNames[monthName];
      if (monthIndex !== undefined) {
        // Extract all day numbers
        const daysStr = monthWithDatesMatch[2];
        const days = daysStr.match(/\d+/g);
        if (days && days.length > 0) {
          for (const day of days) {
            const dayNum = parseInt(day, 10);
            if (dayNum >= 1 && dayNum <= 31) {
              date = new Date(year, monthIndex, dayNum);
              if (!isNaN(date.getTime())) {
                dates.push(date);
              }
            }
          }
          if (dates.length > 0) return dates;
        }
      }
    }
    
    // Handle month name with single date: "January 7" or "January 7 8 9"
    const monthSingleDatePattern = /^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})/i;
    const monthSingleMatch = dateStr.match(monthSingleDatePattern);
    if (monthSingleMatch) {
      const monthName = monthSingleMatch[1].toLowerCase();
      const monthIndex = monthNames[monthName];
      if (monthIndex !== undefined) {
        // Extract all day numbers from the rest of the string
        const restOfString = dateStr.substring(monthSingleMatch[0].length);
        const allDays = dateStr.match(/\d+/g);
        if (allDays && allDays.length > 0) {
          for (const day of allDays) {
            const dayNum = parseInt(day, 10);
            if (dayNum >= 1 && dayNum <= 31) {
              date = new Date(year, monthIndex, dayNum);
              if (!isNaN(date.getTime())) {
                dates.push(date);
              }
            }
          }
          if (dates.length > 0) return dates;
        }
      }
    }
    
    // Handle month name only: "August", "October", etc. - use first day of month
    const monthOnlyPattern = /^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)$/i;
    const monthOnlyMatch = dateStr.match(monthOnlyPattern);
    if (monthOnlyMatch) {
      const monthName = monthOnlyMatch[1].toLowerCase();
      const monthIndex = monthNames[monthName];
      if (monthIndex !== undefined) {
        // Use first day of the month
        date = new Date(year, monthIndex, 1);
        if (!isNaN(date.getTime())) {
          return [date];
        }
      }
    }
    
    // Handle week references: "March 3rd Week" - approximate to 3rd week (around day 15-21)
    const weekPattern = /^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d+)(st|nd|rd|th)?\s*week/i;
    const weekMatch = dateStr.match(weekPattern);
    if (weekMatch) {
      const monthName = weekMatch[1].toLowerCase();
      const monthIndex = monthNames[monthName];
      const weekNum = parseInt(weekMatch[2], 10);
      if (monthIndex !== undefined && weekNum >= 1 && weekNum <= 5) {
        // Approximate: 1st week = day 1-7, 2nd = 8-14, 3rd = 15-21, 4th = 22-28, 5th = 29-31
        const dayApprox = (weekNum - 1) * 7 + 4; // Middle of the week
        date = new Date(year, monthIndex, Math.min(dayApprox, 28));
        if (!isNaN(date.getTime())) {
          return [date];
        }
      }
    }
    
    return null;
  }

  /**
   * Format date to readable string
   */
  formatDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
}

let fileProcessorServiceInstance = null;

export function getFileProcessorService() {
  if (!fileProcessorServiceInstance) {
    fileProcessorServiceInstance = new FileProcessorService();
  }
  return fileProcessorServiceInstance;
}

export default FileProcessorService;

