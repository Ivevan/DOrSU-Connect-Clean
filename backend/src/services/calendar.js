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

    // Create calendar event
    if (method === 'POST') {
      const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      if (normalizedUrl === '/api/admin/calendar/events') {
        Logger.info('📅 CalendarService: Matched create-event route');
        return await this.handleCreateEvent(req, res);
      }
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

    // Update calendar event (PUT) - check BEFORE delete to avoid conflicts
    if (method === 'PUT') {
      Logger.info(`📅 CalendarService: Checking PUT route for: ${url}`);
      // Normalize URL (handle double slashes and trailing slashes)
      let normalizedUrl = url.replace(/\/+/g, '/'); // Replace multiple slashes with single
      normalizedUrl = normalizedUrl.endsWith('/') ? normalizedUrl.slice(0, -1) : normalizedUrl;
      
      // Match PUT /api/admin/calendar/events/{eventId}
      const putEventMatch = normalizedUrl.match(/^\/api\/admin\/calendar\/events\/([^\/\?]+)/);
      if (putEventMatch && putEventMatch[1]) {
        const eventId = putEventMatch[1];
        Logger.info(`📅 CalendarService: Matched update-event route for ID: ${eventId}`);
        return await this.handleUpdateEvent(req, res, eventId);
      }
    }

    // Delete all calendar events - check this BEFORE individual delete to avoid conflicts
    if (method === 'DELETE') {
      // Normalize URL (handle double slashes and trailing slashes)
      let normalizedUrl = url.replace(/\/+/g, '/'); // Replace multiple slashes with single
      normalizedUrl = normalizedUrl.endsWith('/') ? normalizedUrl.slice(0, -1) : normalizedUrl;
      
      if (normalizedUrl === '/api/admin/calendar/events') {
        Logger.info('📅 CalendarService: Matched delete-all-events route');
        return await this.handleDeleteAllEvents(req, res);
      }
      
      // Delete calendar event (individual)
      const deleteEventMatch = normalizedUrl.match(/^\/api\/admin\/calendar\/events\/([^\/\?]+)/);
      if (deleteEventMatch && deleteEventMatch[1]) {
        const eventId = deleteEventMatch[1];
        Logger.info(`📅 CalendarService: Matched delete-event route for ID: ${eventId}`);
        return await this.handleDeleteEvent(req, res, eventId);
      }
    }

    // Route not handled by this service
    Logger.info(`📅 CalendarService: Route not matched - ${method} ${url}`);
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
   * Handle create calendar event
   */
  async handleCreateEvent(req, res) {
    // Check authentication
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await this.getAuthMiddleware()(req);
    if (!auth.authenticated) {
      Logger.warn('Create calendar event: Unauthorized');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    try {
      // Read request body using event-based approach (more reliable)
      let body = '';
      await new Promise((resolve, reject) => {
        req.on('data', chunk => {
          body += chunk.toString();
          if (body.length > 1000000) { // 1MB limit
            req.destroy();
            reject(new Error('Request body too large'));
          }
        });
        req.on('end', () => {
          resolve();
        });
        req.on('error', reject);
      });

      if (!body) {
        this.sendJson(res, 400, { error: 'Request body is required' });
        return true;
      }

      let eventData;
      try {
        eventData = JSON.parse(body);
      } catch (parseError) {
        Logger.error('Failed to parse request body:', parseError);
        this.sendJson(res, 400, { error: 'Invalid JSON in request body' });
        return true;
      }

      // Validate required fields
      if (!eventData || !eventData.title || !eventData.isoDate) {
        Logger.warn('Create event validation failed:', { hasTitle: !!eventData?.title, hasIsoDate: !!eventData?.isoDate });
        this.sendJson(res, 400, { error: 'Title and date are required' });
        return true;
      }

      // Format date string
      const dateObj = new Date(eventData.isoDate);
      const formattedDate = this.formatDate(dateObj);

      // Create event object
      const event = {
        title: eventData.title,
        date: eventData.date || formattedDate,
        isoDate: eventData.isoDate,
        time: eventData.time || 'All Day',
        category: eventData.category || 'Event',
        description: eventData.description || '',
        source: 'Manual Entry',
        uploadedAt: new Date(),
        uploadedBy: auth.userId,
        dateType: eventData.dateType || 'date',
        startDate: eventData.startDate || eventData.isoDate,
        endDate: eventData.endDate || eventData.isoDate,
        weekOfMonth: eventData.weekOfMonth || null,
        month: eventData.month || null,
        year: eventData.year || null,
      };

      // Save event
      const savedEvent = await this.createEvent(event);

      Logger.success(`✅ Calendar event created: ${savedEvent._id}`);

      this.sendJson(res, 201, {
        success: true,
        message: 'Event created successfully',
        event: savedEvent
      });
      return true;
    } catch (error) {
      Logger.error('Create calendar event error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to create event' });
      return true;
    }
  }

  /**
   * Format date to readable string
   */
  formatDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  /**
   * Handle delete all calendar events
   */
  async handleDeleteAllEvents(req, res) {
    // Check authentication
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await this.getAuthMiddleware()(req);
    if (!auth.authenticated) {
      Logger.warn('Delete all calendar events: Unauthorized');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    try {
      const result = await this.deleteAllEvents();

      this.sendJson(res, 200, {
        success: true,
        message: 'All events deleted successfully',
        deletedCount: result.deletedCount
      });
      return true;
    } catch (error) {
      Logger.error('Delete all calendar events error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to delete all events' });
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
   * Create a single calendar event in MongoDB
   */
  async createEvent(event) {
    try {
      const calendarCollection = this.mongoService.getCollection('calendar');
      const result = await calendarCollection.insertOne(event);
      return { ...event, _id: result.insertedId };
    } catch (error) {
      Logger.error('Failed to create calendar event:', error);
      throw error;
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
   * IMPROVED: Handles both single dates and date ranges properly
   * Supports semester filtering: 1 (1st semester), 2 (2nd semester), or "Off" (off semester)
   */
  async getEvents({ startDate, endDate, category, semester, limit = 100 }) {
    try {
      const calendarCollection = this.mongoService.getCollection('calendar');
      
      // Build query - for date ranges, check if query range overlaps with event range
      const query = {};
      
      if (startDate || endDate) {
        const queryStart = startDate ? new Date(startDate) : null;
        const queryEnd = endDate ? new Date(endDate) : null;
        
        // Build date query: check both isoDate (for single dates) and date ranges
        // For date ranges, an event matches if:
        // 1. Event startDate is within query range, OR
        // 2. Event endDate is within query range, OR  
        // 3. Event range completely contains query range
        query.$or = [];
        
        // Single date events: isoDate falls within query range
        const singleDateQuery = {};
        if (queryStart) singleDateQuery.$gte = queryStart.toISOString();
        if (queryEnd) singleDateQuery.$lte = queryEnd.toISOString();
        if (Object.keys(singleDateQuery).length > 0) {
          query.$or.push({
            isoDate: singleDateQuery,
            $or: [
              { dateType: { $ne: 'date_range' } },
              { dateType: { $exists: false } }
            ]
          });
        }
        
        // Date range events: check if ranges overlap
        if (queryStart || queryEnd) {
          const rangeConditions = [];
          
          // Event startDate is within query range
          if (queryStart && queryEnd) {
            rangeConditions.push({
              startDate: { $gte: queryStart.toISOString(), $lte: queryEnd.toISOString() }
            });
            // Event endDate is within query range
            rangeConditions.push({
              endDate: { $gte: queryStart.toISOString(), $lte: queryEnd.toISOString() }
            });
            // Event range completely contains query range
            rangeConditions.push({
              startDate: { $lte: queryStart.toISOString() },
              endDate: { $gte: queryEnd.toISOString() }
            });
          } else if (queryStart) {
            rangeConditions.push({ endDate: { $gte: queryStart.toISOString() } });
          } else if (queryEnd) {
            rangeConditions.push({ startDate: { $lte: queryEnd.toISOString() } });
          }
          
          if (rangeConditions.length > 0) {
            query.$or.push({
              dateType: 'date_range',
              $or: rangeConditions
            });
          }
        }
        
        // If no $or conditions, remove it
        if (query.$or.length === 0) {
          delete query.$or;
        }
      }
      
      if (category) {
        query.category = category;
      }
      
      // Filter by semester if provided
      // Semester values: 1 (1st semester), 2 (2nd semester), or "Off" (off semester)
      if (semester !== undefined && semester !== null) {
        if (semester === 1 || semester === '1' || semester === 'first' || semester === '1st') {
          query.semester = 1;
        } else if (semester === 2 || semester === '2' || semester === 'second' || semester === '2nd') {
          query.semester = 2;
        } else if (semester === 'Off' || semester === 'off' || semester === 'off semester') {
          query.semester = 'Off';
        } else {
          // Try to parse as number
          const semesterNum = parseInt(semester, 10);
          if (!isNaN(semesterNum) && (semesterNum === 1 || semesterNum === 2)) {
            query.semester = semesterNum;
          }
        }
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
      const { ObjectId } = await import('mongodb');
      
      // Convert eventId to ObjectId if it's a string
      const objectId = typeof eventId === 'string' ? new ObjectId(eventId) : eventId;
      
      const event = await calendarCollection.findOne({ _id: objectId });
      return event;
    } catch (error) {
      Logger.error('Failed to get calendar event by ID:', error);
      throw error;
    }
  }

  /**
   * Delete all calendar events
   */
  async deleteAllEvents() {
    try {
      const calendarCollection = this.mongoService.getCollection('calendar');
      const result = await calendarCollection.deleteMany({});
      Logger.info(`✅ Deleted ${result.deletedCount} calendar events`);
      return {
        deletedCount: result.deletedCount
      };
    } catch (error) {
      Logger.error('Failed to delete all calendar events:', error);
      throw error;
    }
  }

  /**
   * Update calendar event
   */
  async updateEvent(eventId, updates) {
    try {
      const calendarCollection = this.mongoService.getCollection('calendar');
      const { ObjectId } = await import('mongodb');
      
      // Convert eventId to ObjectId if it's a string
      const objectId = typeof eventId === 'string' ? new ObjectId(eventId) : eventId;
      
      // If isoDate is being updated, also update the formatted date
      if (updates.isoDate) {
        const dateObj = new Date(updates.isoDate);
        updates.date = this.formatDate(dateObj);
      }
      
      // Add updated timestamp
      updates.updatedAt = new Date();
      
      const result = await calendarCollection.updateOne(
        { _id: objectId },
        { $set: updates }
      );
      
      if (result.matchedCount === 0) {
        return null;
      }
      
      // Return the updated event
      const updatedEvent = await calendarCollection.findOne({ _id: objectId });
      return updatedEvent;
    } catch (error) {
      Logger.error('Failed to update calendar event:', error);
      throw error;
    }
  }

  /**
   * Handle update calendar event
   */
  async handleUpdateEvent(req, res, eventId) {
    // Check authentication
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await this.getAuthMiddleware()(req);
    if (!auth.authenticated) {
      Logger.warn('Update calendar event: Unauthorized');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    try {
      // Read request body using event-based approach (more reliable)
      let body = '';
      await new Promise((resolve, reject) => {
        req.on('data', chunk => {
          body += chunk.toString();
          if (body.length > 1000000) { // 1MB limit
            req.destroy();
            reject(new Error('Request body too large'));
          }
        });
        req.on('end', () => {
          resolve();
        });
        req.on('error', reject);
      });

      if (!body) {
        this.sendJson(res, 400, { error: 'Request body is required' });
        return true;
      }

      let eventData;
      try {
        eventData = JSON.parse(body);
      } catch (parseError) {
        Logger.error('Failed to parse request body:', parseError);
        this.sendJson(res, 400, { error: 'Invalid JSON in request body' });
        return true;
      }

      // Validate required fields
      if (!eventData || !eventData.title || !eventData.isoDate) {
        Logger.warn('Update event validation failed:', { hasTitle: !!eventData?.title, hasIsoDate: !!eventData?.isoDate });
        this.sendJson(res, 400, { error: 'Title and date are required' });
        return true;
      }

      // Prepare update object (exclude _id and other system fields)
      const updates = {
        title: eventData.title,
        isoDate: eventData.isoDate,
        time: eventData.time || 'All Day',
        category: eventData.category || 'Event',
        description: eventData.description || '',
        dateType: eventData.dateType || 'date',
        startDate: eventData.startDate || eventData.isoDate,
        endDate: eventData.endDate || eventData.isoDate,
        weekOfMonth: eventData.weekOfMonth || null,
        month: eventData.month || null,
        year: eventData.year || null,
      };

      // Update event
      const updatedEvent = await this.updateEvent(eventId, updates);

      if (!updatedEvent) {
        this.sendJson(res, 404, { error: 'Event not found' });
        return true;
      }

      Logger.success(`✅ Calendar event updated: ${eventId}`);

      this.sendJson(res, 200, {
        success: true,
        message: 'Event updated successfully',
        event: updatedEvent
      });
      return true;
    } catch (error) {
      Logger.error('Update calendar event error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to update event' });
      return true;
    }
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(eventId) {
    try {
      const calendarCollection = this.mongoService.getCollection('calendar');
      const { ObjectId } = await import('mongodb');
      
      // Convert eventId to ObjectId if it's a string
      const objectId = typeof eventId === 'string' ? new ObjectId(eventId) : eventId;
      
      const result = await calendarCollection.deleteOne({ _id: objectId });
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

