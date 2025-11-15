/**
 * Calendar Service
 * Handles calendar events management, CSV uploads, and event retrieval
 */

import { Logger } from '../utils/logger.js';
import { parseMultipartFormData } from '../utils/multipart-parser.js';
import { authMiddleware } from './auth.js';
import { getFileProcessorService } from './file-processor.js';

export class CalendarService {
  constructor(mongoService, authService) {
    this.mongoService = mongoService;
    this.authService = authService;
  }

  /**
   * Handle calendar routes
   * Returns true if the route was handled, false otherwise
   */
  async handleRoute(req, res, method, url) {
    Logger.info(`📅 CalendarService.handleRoute: ${method} ${url}`);
    
    // Upload calendar CSV
    if (method === 'POST' && url === '/api/admin/upload-calendar-csv') {
      Logger.info('📅 CalendarService: Matched upload-calendar-csv route');
      return await this.handleUploadCalendarCSV(req, res);
    }

    // Get calendar events
    if (method === 'GET' && url === '/api/calendar/events') {
      return await this.handleGetEvents(req, res);
    }

    // Get calendar event by ID
    if (method === 'GET' && url.startsWith('/api/calendar/events/')) {
      const eventId = url.split('/api/calendar/events/')[1];
      return await this.handleGetEventById(req, res, eventId);
    }

    // Delete calendar event
    if (method === 'DELETE' && url.startsWith('/api/admin/calendar/events/')) {
      const eventId = url.split('/api/admin/calendar/events/')[1];
      return await this.handleDeleteEvent(req, res, eventId);
    }

    // Route not handled by this service
    return false;
  }

  /**
   * Handle calendar CSV upload
   */
  async handleUploadCalendarCSV(req, res) {
    Logger.info('📅 handleUploadCalendarCSV called');
    
    // Check authentication
    if (!this.authService || !this.mongoService) {
      Logger.error('Calendar CSV upload: Services not available');
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    Logger.info('📅 Calendar CSV upload: Checking authentication...');
    const auth = await this.getAuthMiddleware()(req);
    if (!auth.authenticated) {
      Logger.warn('Calendar CSV upload: Unauthorized');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }
    
    Logger.info('📅 Calendar CSV upload: Authentication successful');

    try {
      const contentType = req.headers['content-type'] || '';
      Logger.info(`Calendar CSV upload Content-Type: ${contentType}`);
      
      // Check for multipart/form-data
      if (!contentType.includes('multipart/form-data')) {
        Logger.warn(`Calendar CSV upload: Invalid Content-Type: ${contentType}`);
        this.sendJson(res, 400, { error: 'Content-Type must be multipart/form-data' });
        return true;
      }

      // Extract boundary from Content-Type header
      let boundary = contentType.split('boundary=')[1];
      
      if (!boundary) {
        Logger.warn('Calendar CSV upload: Missing boundary in Content-Type header');
        this.sendJson(res, 400, { error: 'Missing boundary in Content-Type header. Please ensure Content-Type includes boundary parameter.' });
        return true;
      }

      // Clean boundary (remove quotes if present)
      boundary = boundary.replace(/^["']|["']$/g, '');

      const parts = await parseMultipartFormData(req, boundary);
      Logger.info(`📅 Calendar CSV upload: Parsed ${parts.length} multipart parts`);
      parts.forEach((part, index) => {
        Logger.info(`📅 Part ${index}: name=${part.name}, filename=${part.filename || 'none'}, contentType=${part.contentType}`);
      });
      
      const filePart = parts.find(p => p.filename);
      
      if (!filePart) {
        Logger.warn('📅 Calendar CSV upload: No file part found in multipart data');
        Logger.warn(`📅 Available parts: ${JSON.stringify(parts.map(p => ({ name: p.name, filename: p.filename })))}`);
        this.sendJson(res, 400, { error: 'No file uploaded' });
        return true;
      }

      const fileName = filePart.filename || 'unknown';
      if (!fileName.toLowerCase().endsWith('.csv')) {
        this.sendJson(res, 400, { error: 'File must be a CSV file' });
        return true;
      }

      Logger.info(`📅 Processing calendar CSV upload: ${fileName}`);

      const fileProcessor = getFileProcessorService();
      const csvContent = filePart.data.toString('utf8');
      const events = fileProcessor.parseCalendarCSV(csvContent);

      if (events.length === 0) {
        this.sendJson(res, 400, { error: 'No valid events found in CSV file' });
        return true;
      }

      // Store events in MongoDB
      const result = await this.saveEvents(events, auth.userId);

      Logger.success(`✅ Calendar CSV processed: ${result.insertedCount} new events, ${result.updatedCount} updated`);

      this.sendJson(res, 200, {
        success: true,
        message: 'Calendar CSV uploaded and processed successfully',
        fileName,
        eventsAdded: result.insertedCount,
        eventsUpdated: result.updatedCount,
        totalEvents: events.length
      });
      return true;
    } catch (error) {
      Logger.error('Calendar CSV upload error:', error);
      this.sendJson(res, 500, { error: error.message || 'CSV processing failed' });
      return true;
    }
  }

  /**
   * Handle get calendar events
   */
  async handleGetEvents(req, res) {
    try {
      // Parse query parameters from URL
      const rawUrl = req.url || '/';
      const urlParts = rawUrl.split('?');
      const queryString = urlParts[1] || '';
      const params = new URLSearchParams(queryString);
      
      const startDate = params.get('startDate');
      const endDate = params.get('endDate');
      const category = params.get('category');
      const limit = parseInt(params.get('limit') || '100');

      const events = await this.getEvents({ startDate, endDate, category, limit });

      this.sendJson(res, 200, {
        success: true,
        events,
        count: events.length
      });
      return true;
    } catch (error) {
      Logger.error('Get calendar events error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to retrieve events' });
      return true;
    }
  }

  /**
   * Handle get calendar event by ID
   */
  async handleGetEventById(req, res, eventId) {
    try {
      const event = await this.getEventById(eventId);

      if (!event) {
        this.sendJson(res, 404, { error: 'Event not found' });
        return true;
      }

      this.sendJson(res, 200, {
        success: true,
        event
      });
      return true;
    } catch (error) {
      Logger.error('Get calendar event error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to retrieve event' });
      return true;
    }
  }

  /**
   * Handle delete calendar event
   */
  async handleDeleteEvent(req, res, eventId) {
    // Check authentication
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await this.getAuthMiddleware()(req);
    if (!auth.authenticated) {
      Logger.warn('Delete calendar event: Unauthorized');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    try {
      const deleted = await this.deleteEvent(eventId);

      if (!deleted) {
        this.sendJson(res, 404, { error: 'Event not found' });
        return true;
      }

      this.sendJson(res, 200, {
        success: true,
        message: 'Event deleted successfully'
      });
      return true;
    } catch (error) {
      Logger.error('Delete calendar event error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to delete event' });
      return true;
    }
  }

  /**
   * Save events to MongoDB
   */
  async saveEvents(events, uploadedBy) {
    try {
      const calendarCollection = this.mongoService.getCollection('calendar');
      
      // Insert events (upsert based on title and date to avoid duplicates)
      let insertedCount = 0;
      let updatedCount = 0;
      
      for (const event of events) {
        const result = await calendarCollection.updateOne(
          { 
            title: event.title,
            isoDate: event.isoDate
          },
          {
            $set: {
              ...event,
              uploadedAt: new Date(),
              uploadedBy: uploadedBy
            }
          },
          { upsert: true }
        );
        
        if (result.upsertedCount > 0) {
          insertedCount++;
        } else if (result.modifiedCount > 0) {
          updatedCount++;
        }
      }

      return {
        insertedCount,
        updatedCount,
        totalProcessed: events.length
      };
    } catch (error) {
      Logger.error('Failed to save calendar events:', error);
      throw error;
    }
  }

  /**
   * Get calendar events from MongoDB
   */
  async getEvents({ startDate, endDate, category, limit = 100 }) {
    try {
      const calendarCollection = this.mongoService.getCollection('calendar');
      
      // Build query
      const query = {};
      
      if (startDate || endDate) {
        query.isoDate = {};
        if (startDate) {
          query.isoDate.$gte = new Date(startDate).toISOString();
        }
        if (endDate) {
          query.isoDate.$lte = new Date(endDate).toISOString();
        }
      }
      
      if (category) {
        query.category = category;
      }

      // Fetch events sorted by date
      const events = await calendarCollection
        .find(query)
        .sort({ isoDate: 1 })
        .limit(limit)
        .toArray();

      return events;
    } catch (error) {
      Logger.error('Failed to get calendar events:', error);
      throw error;
    }
  }

  /**
   * Get calendar event by ID
   */
  async getEventById(eventId) {
    try {
      const calendarCollection = this.mongoService.getCollection('calendar');
      const event = await calendarCollection.findOne({ _id: eventId });
      return event;
    } catch (error) {
      Logger.error('Failed to get calendar event by ID:', error);
      throw error;
    }
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(eventId) {
    try {
      const calendarCollection = this.mongoService.getCollection('calendar');
      const result = await calendarCollection.deleteOne({ _id: eventId });
      return result.deletedCount > 0;
    } catch (error) {
      Logger.error('Failed to delete calendar event:', error);
      throw error;
    }
  }

  /**
   * Authentication middleware helper
   */
  getAuthMiddleware() {
    return authMiddleware(this.authService, this.mongoService);
  }

  /**
   * Send JSON response helper
   */
  sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}

/**
 * Get calendar service instance
 */
let calendarServiceInstance = null;

export function getCalendarService(mongoService, authService) {
  if (!calendarServiceInstance && mongoService && authService) {
    calendarServiceInstance = new CalendarService(mongoService, authService);
    Logger.info('✅ CalendarService instance created');
  } else if (!mongoService || !authService) {
    Logger.warn('⚠️ CalendarService: mongoService or authService not provided');
  }
  return calendarServiceInstance;
}

