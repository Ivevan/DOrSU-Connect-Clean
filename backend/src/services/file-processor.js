/**
 * File Processor Service
 * Handles parsing and processing of uploaded files (txt, docx, csv, json)
 */

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
   * Enhanced to handle structured data better for knowledge base
   */
  jsonToText(jsonData, prefix = '', options = {}) {
    const { maxDepth = 5, currentDepth = 0 } = options;
    
    // Prevent infinite recursion
    if (currentDepth >= maxDepth) {
      return `${prefix}: [Max depth reached]\n`;
    }
    
    let text = '';
    
    if (Array.isArray(jsonData)) {
      // Handle arrays - each item gets its own context
      jsonData.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          const itemPrefix = prefix ? `${prefix}[${index}]` : `Item ${index + 1}`;
          text += this.jsonToText(item, itemPrefix, { ...options, currentDepth: currentDepth + 1 });
        } else {
          const key = prefix || 'Value';
          text += `${key}: ${String(item)}\n`;
        }
      });
    } else if (typeof jsonData === 'object' && jsonData !== null) {
      // Handle objects - create natural language descriptions
      const entries = Object.entries(jsonData);
      
      // For structured data, try to create coherent sentences
      if (entries.length > 0) {
        // Check if this looks like a structured entity (e.g., person, event, document)
        const hasNameField = jsonData.name || jsonData.title || jsonData.fullName || jsonData.name;
        const hasDescriptionField = jsonData.description || jsonData.content || jsonData.text || jsonData.details;
        
        if (hasNameField || hasDescriptionField) {
          // Create a natural language entry for structured entities
          let entityText = '';
          if (hasNameField) {
            entityText += `${jsonData.name || jsonData.title || jsonData.fullName || jsonData.name}`;
          }
          
          // Add key attributes
          entries.forEach(([key, value]) => {
            if (key === 'name' || key === 'title' || key === 'fullName' || key === 'name') return;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Nested object - recurse
              entityText += `\n${key}:\n`;
              entityText += this.jsonToText(value, `  `, { ...options, currentDepth: currentDepth + 1 });
            } else if (Array.isArray(value)) {
              // Array - list items
              if (value.length > 0) {
                entityText += `\n${key}: ${value.map(v => String(v)).join(', ')}`;
              }
            } else if (value !== null && value !== undefined) {
              entityText += `. ${key}: ${String(value)}`;
            }
          });
          
          text += entityText + '\n\n';
        } else {
          // Regular object - use key-value format
          for (const [key, value] of entries) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null) {
              text += this.jsonToText(value, fullKey, { ...options, currentDepth: currentDepth + 1 });
            } else if (Array.isArray(value)) {
              text += `${fullKey}: ${value.map(v => String(v)).join(', ')}\n`;
            } else {
              text += `${fullKey}: ${String(value)}\n`;
            }
          }
        }
      }
    } else {
      // Primitive value
      const key = prefix || 'Value';
      text += `${key}: ${String(jsonData)}\n`;
    }
    
    return text;
  }

  /**
   * Convert CSV to readable text format
   * Enhanced to handle various CSV formats and create structured knowledge chunks
   */
  csvToText(csvContent) {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return '';
    
    // Enhanced CSV parser - handles quoted fields, commas in quotes, etc.
    const parseCSVLine = (line) => {
      const fields = [];
      let currentField = '';
      let inQuotes = false;
      let i = 0;
      
      while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            currentField += '"';
            i += 2;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
            i++;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          fields.push(currentField.trim());
          currentField = '';
          i++;
        } else {
          currentField += char;
          i++;
        }
      }
      
      // Add last field
      fields.push(currentField.trim());
      return fields;
    };
    
    const rows = lines.map(line => parseCSVLine(line));
    
    if (rows.length === 0) return '';
    
    // Normalize header row - trim and clean headers
    const headers = rows[0].map(h => h.trim().toLowerCase().replace(/[^\w\s]/g, ''));
    
    if (rows.length === 1) {
      // Only headers, no data
      return `CSV File with columns: ${headers.join(', ')}\n`;
    }
    
    // Convert to structured text format
    let text = '';
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Skip empty rows
      if (row.every(cell => !cell || cell.trim().length === 0)) {
        continue;
      }
      
      // Create a structured entry for each row
      // Try to identify if this looks like structured data (e.g., title, name, description)
      const rowObj = {};
      headers.forEach((header, index) => {
        if (row[index] && row[index].trim()) {
          rowObj[header] = row[index].trim();
        }
      });
      
      // Create natural language description
      const entryParts = [];
      
      // Priority fields for natural language
      const priorityFields = ['name', 'title', 'subject', 'topic', 'event', 'program', 'faculty'];
      let hasPriorityField = false;
      
      priorityFields.forEach(priorityField => {
        const fieldValue = rowObj[priorityField];
        if (fieldValue) {
          entryParts.push(`${fieldValue}`);
          hasPriorityField = true;
        }
      });
      
      // Add other fields
      Object.entries(rowObj).forEach(([key, value]) => {
        if (!priorityFields.includes(key) && value) {
          // Format based on field name
          if (key.includes('date') || key.includes('time')) {
            entryParts.push(`${key}: ${value}`);
          } else if (key.includes('description') || key.includes('details') || key.includes('content')) {
            entryParts.push(`${value}`);
          } else {
            entryParts.push(`${key}: ${value}`);
          }
        }
      });

      const rawUserType = rowObj.usertype || rowObj.audience || rowObj.targetuser || rowObj.audiencetype;
      const normalizedUserType = this.normalizeUserType(rawUserType);
      if (normalizedUserType) {
        const audienceLabel = normalizedUserType === 'student'
          ? 'Students'
          : normalizedUserType === 'faculty'
            ? 'Faculty'
            : 'All audiences';
        entryParts.push(`Audience: ${audienceLabel}`);
      }
      
      if (entryParts.length > 0) {
        text += entryParts.join('. ') + '.\n\n';
      } else {
        // Fallback: use all fields
        const allFields = Object.entries(rowObj)
          .map(([key, value]) => `${key}: ${value}`)
          .join('. ');
        if (allFields) {
          text += allFields + '.\n\n';
        }
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
   * Required fields: Type (Institutional/Academic), Event, DateType, StartDate, EndDate, Year, Month, WeekOfMonth, Description
   * Accepts at least 3 of these fields (flexible field names)
   */
  parseCalendarCSV(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];
    
    const events = [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Find field indices with flexible matching (case-insensitive, handles underscores/spaces)
    const findFieldIndex = (possibleNames) => {
      return headers.findIndex(h => {
        const normalized = h.toLowerCase().replace(/[_\s]/g, '');
        return possibleNames.some(name => normalized === name || normalized.includes(name));
      });
    };
    
    // Required/Expected fields: Type, Event, DateType, StartDate, EndDate, Year, Month, WeekOfMonth, Description, Semester
    const typeIndex = findFieldIndex(['type', 'category', 'eventtype']);
    const eventIndex = findFieldIndex(['event', 'title', 'name']);
    const dateTypeIndex = findFieldIndex(['datetype', 'datetype', 'date_type']);
    const startDateIndex = findFieldIndex(['startdate', 'start_date', 'start']);
    const endDateIndex = findFieldIndex(['enddate', 'end_date', 'end']);
    const yearIndex = findFieldIndex(['year']);
    const monthIndex = findFieldIndex(['month']);
    const weekOfMonthIndex = findFieldIndex(['weekofmonth', 'week_of_month', 'weekinmonth', 'week_in_month']);
    const descriptionIndex = findFieldIndex(['description', 'desc', 'details']);
    const timeIndex = findFieldIndex(['time', 'eventtime', 'event_time']);
    const semesterIndex = findFieldIndex(['semester', 'sem', 'term']);
    const userTypeIndex = findFieldIndex(['usertype', 'audience', 'audience_type', 'audiencetype', 'targetuser']);
    
    // Count how many required fields are present (need at least 3, including Event)
    const foundFields = [
      typeIndex !== -1,
      eventIndex !== -1,
      dateTypeIndex !== -1,
      startDateIndex !== -1,
      endDateIndex !== -1,
      yearIndex !== -1,
      monthIndex !== -1,
      weekOfMonthIndex !== -1,
      descriptionIndex !== -1,
      semesterIndex !== -1
    ].filter(Boolean).length;
    
    // Validate: Must have Event field and at least 2 other fields (total 3+)
    if (eventIndex === -1) {
      throw new Error('CSV must contain "Event" column (or "Title"/"Name")');
    }
    
    if (foundFields < 3) {
      throw new Error(`CSV must contain at least 3 of the required fields. Found: ${foundFields}. Required fields: Type, Event, DateType, StartDate, EndDate, Year, Month, WeekOfMonth, Description`);
    }
    
    const isNewFormat = dateTypeIndex !== -1 || startDateIndex !== -1 || endDateIndex !== -1;
    
    // For old format, find date column
    const dateIndex = findFieldIndex(['date', 'eventdate', 'event_date', 'when']);
    
    Logger.info(`CSV Format detected - Fields found: ${foundFields}/10. Event: ${eventIndex !== -1}, Type: ${typeIndex !== -1}, DateType: ${dateTypeIndex !== -1}, StartDate: ${startDateIndex !== -1}, EndDate: ${endDateIndex !== -1}, Year: ${yearIndex !== -1}, Month: ${monthIndex !== -1}, WeekOfMonth: ${weekOfMonthIndex !== -1}, Description: ${descriptionIndex !== -1}, Semester: ${semesterIndex !== -1}`);
    
    // Get current year for month-only dates
    const currentYear = new Date().getFullYear();
    
    for (let i = 1; i < lines.length; i++) {
      const fields = this.parseCSVLine(lines[i]);
      
      if (fields.length <= eventIndex) continue;
      
      const title = eventIndex >= 0 ? fields[eventIndex]?.trim() : '';
      if (!title) continue;
      
      // Get Type (Institutional or Academic) - default to Institutional
      const typeRaw = typeIndex >= 0 ? fields[typeIndex]?.trim() : 'Institutional';
      const category = typeRaw && (typeRaw.toLowerCase() === 'academic' || typeRaw.toLowerCase() === 'institutional') 
        ? typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1).toLowerCase() 
        : 'Institutional';
      
      const description = descriptionIndex >= 0 ? fields[descriptionIndex]?.trim() || '' : '';
      const time = timeIndex >= 0 ? fields[timeIndex]?.trim() || 'All Day' : 'All Day';
      const rawUserType = userTypeIndex >= 0 ? fields[userTypeIndex]?.trim() : '';
      const normalizedUserType = this.normalizeUserType(rawUserType) || 'all';
      
      // Parse semester field: 1 (1st semester), 2 (2nd semester), or "Off" (off semester)
      let semester = null;
      if (semesterIndex >= 0) {
        const semesterRaw = fields[semesterIndex]?.trim() || '';
        const semesterLower = semesterRaw.toLowerCase();
        
        // Normalize semester values
        if (semesterLower === '1' || semesterLower === 'first' || semesterLower === '1st' || semesterLower === 'first semester' || semesterLower === '1st semester') {
          semester = 1;
        } else if (semesterLower === '2' || semesterLower === 'second' || semesterLower === '2nd' || semesterLower === 'second semester' || semesterLower === '2nd semester') {
          semester = 2;
        } else if (semesterLower === 'off' || semesterLower === 'off semester' || semesterLower === 'off-semester' || semesterLower === 'off_semester') {
          semester = 'Off';
        } else if (semesterRaw !== '') {
          // Try to parse as number
          const semesterNum = parseInt(semesterRaw, 10);
          if (!isNaN(semesterNum) && (semesterNum === 1 || semesterNum === 2)) {
            semester = semesterNum;
          } else {
            Logger.warn(`Row ${i + 1}: Invalid semester value "${semesterRaw}", expected 1, 2, or "Off"`);
          }
        }
      }
      
      if (isNewFormat) {
        // New format: DateType, StartDate, EndDate, WeekOfMonth, Month, Year
        const dateType = dateTypeIndex >= 0 ? fields[dateTypeIndex]?.trim().toLowerCase() : 'date';
        const startDateStr = startDateIndex >= 0 ? fields[startDateIndex]?.trim() : '';
        const endDateStr = endDateIndex >= 0 ? fields[endDateIndex]?.trim() : '';
        const weekOfMonth = weekOfMonthIndex >= 0 ? fields[weekOfMonthIndex]?.trim() : null;
        const month = monthIndex >= 0 ? fields[monthIndex]?.trim() : null;
        const year = yearIndex >= 0 ? fields[yearIndex]?.trim() : currentYear.toString();
        
        // Parse dates - only parse if strings are not empty
        let startDate = null;
        let endDate = null;
        
        if (startDateStr && startDateStr.trim() !== '') {
          const parsedStart = this.parseDate(startDateStr.trim(), parseInt(year, 10));
          if (parsedStart && parsedStart.length > 0) {
            startDate = parsedStart[0];
          } else {
            Logger.warn(`Skipping row ${i + 1}: Could not parse StartDate: ${startDateStr}`);
          }
        }
        
        if (endDateStr && endDateStr.trim() !== '') {
          const parsedEnd = this.parseDate(endDateStr.trim(), parseInt(year, 10));
          if (parsedEnd && parsedEnd.length > 0) {
            endDate = parsedEnd[0];
          } else {
            Logger.warn(`Skipping row ${i + 1}: Could not parse EndDate: ${endDateStr}`);
          }
        }
        
        // Handle different date types - check dateType first
        if (dateType === 'month_only' || dateType === 'month') {
          // Month-only event (no specific date, just month)
          if (!month) {
            Logger.warn(`Skipping row ${i + 1}: Month-only event requires Month column`);
            continue;
          }
          const monthNum = parseInt(month, 10) - 1; // 0-indexed
          const yearNum = parseInt(year, 10);
          const placeholderDate = new Date(yearNum, monthNum, 1);
          
          events.push({
            title,
            date: this.formatDate(placeholderDate),
            isoDate: new Date(placeholderDate),
            time,
            category,
            description,
            source: 'CSV Upload',
            userType: normalizedUserType,
            dateType: 'month',
            month: parseInt(month, 10),
            year: yearNum,
            semester: semester
          });
        } else if (dateType === 'week_in_month' || dateType === 'week') {
          // Week-only event (no specific date, just week of month)
          if (!weekOfMonth || !month) {
            Logger.warn(`Skipping row ${i + 1}: Week-in-month event requires WeekOfMonth and Month columns`);
            continue;
          }
          const monthNum = parseInt(month, 10) - 1; // 0-indexed
          const weekNum = parseInt(weekOfMonth, 10);
          const yearNum = parseInt(year, 10);
          // Approximate: 1st week = day 1-7, 2nd = 8-14, 3rd = 15-21, 4th = 22-28, 5th = 29-31
          const dayApprox = (weekNum - 1) * 7 + 1;
          const placeholderDate = new Date(yearNum, monthNum, Math.min(dayApprox, 28));
          
          events.push({
            title,
            date: this.formatDate(placeholderDate),
            isoDate: new Date(placeholderDate),
            time,
            category,
            description,
            source: 'CSV Upload',
            userType: normalizedUserType,
            dateType: 'week',
            weekOfMonth: weekNum,
            month: parseInt(month, 10),
            year: yearNum,
            semester: semester
          });
        } else if (dateType === 'date_range' && startDate && endDate) {
          // Date range: create events for all dates in the range to mark them on calendar
          // Normalize dates to start of day for comparison
          const start = new Date(startDate);
          const end = new Date(endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          
          // If start and end are the same, treat as single date
          if (start.getTime() === end.getTime()) {
            events.push({
              title,
              date: this.formatDate(startDate),
              isoDate: new Date(startDate),
              time,
              category,
              description,
              source: 'CSV Upload',
              userType: normalizedUserType,
              dateType: 'date',
              startDate: new Date(startDate),
              endDate: new Date(startDate),
              weekOfMonth: weekOfMonth ? parseInt(weekOfMonth, 10) : null,
              month: month ? parseInt(month, 10) : null,
              year: parseInt(year, 10),
              semester: semester
            });
          } else {
            // Create an event for each date in the range to mark all dates on calendar
            const eventDates = this.getDateRange(startDate, endDate);
            for (const eventDate of eventDates) {
              events.push({
                title,
                date: this.formatDate(eventDate),
                isoDate: new Date(eventDate),
                time,
                category,
                description,
                source: 'CSV Upload',
                userType: normalizedUserType,
                dateType: 'date_range',
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                weekOfMonth: weekOfMonth ? parseInt(weekOfMonth, 10) : null,
                month: month ? parseInt(month, 10) : null,
                year: parseInt(year, 10),
                semester: semester
              });
            }
          }
        } else if (dateType === 'date' && startDate) {
          // Single date
          events.push({
            title,
            date: this.formatDate(startDate),
            isoDate: new Date(startDate),
            time,
            category,
            description,
            source: 'CSV Upload',
            userType: normalizedUserType,
            dateType: 'date',
            startDate: new Date(startDate),
            endDate: new Date(startDate),
            weekOfMonth: weekOfMonth ? parseInt(weekOfMonth, 10) : null,
            month: month ? parseInt(month, 10) : null,
            year: parseInt(year, 10),
            semester: semester
          });
        } else {
          // If we can't parse the date type, log a warning but don't skip if we have dates
          if (!startDate && !endDate && !month) {
            Logger.warn(`Skipping row ${i + 1}: Invalid date format - dateType: ${dateType}, startDate: ${startDateStr}, endDate: ${endDateStr}, month: ${month}`);
            continue;
          }
        }
      } else {
        // Old format: single date column
        const dateStr = dateIndex >= 0 ? fields[dateIndex]?.trim() : '';
        if (!dateStr) continue;
        
        // Skip if this looks like a DateType value (not a date)
        const dateTypeValues = ['date', 'date_range', 'month_only', 'week_in_month', 'week', 'month'];
        if (dateTypeValues.includes(dateStr.toLowerCase())) {
          Logger.warn(`Skipping row ${i + 1}: Date column contains DateType value "${dateStr}" - CSV may be in new format but headers not detected correctly`);
          continue;
        }
        
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
            isoDate: new Date(date),
            time,
            category,
            description,
            source: 'CSV Upload',
            userType: normalizedUserType,
            semester: semester
          });
        }
      }
    }
    
    return events;
  }

  /**
   * Get all dates in a date range
   */
  getDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    // Normalize to start of day
    current.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
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

  /**
   * Normalize textual user type values from CSV uploads
   */
  normalizeUserType(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;

    if (['student', 'students', 'student only', 'students only', 'learner', 'learners'].includes(normalized)) {
      return 'student';
    }
    if (['faculty', 'faculties', 'faculty only', 'staff', 'teachers', 'professors', 'instructors'].includes(normalized)) {
      return 'faculty';
    }
    if (['all', 'everyone', 'public', 'general', 'both', 'all students', 'all faculty'].includes(normalized)) {
      return 'all';
    }
    return null;
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


