/**
 * Schedule Service
 * Unified service for handling calendar events, announcements, and posts
 * All schedule-related data (events, announcements, dates) uses the "schedule" collection
 */

import { Logger } from '../utils/logger.js';
import { parseMultipartFormData } from '../utils/multipart-parser.js';
import { authMiddleware } from './auth.js';
import { getEmbeddingService } from './embedding.js';
import { getFileProcessorService } from './file-processor.js';
import { getGridFSService } from './gridfs.js';

const DEFAULT_TIMEZONE = process.env.CALENDAR_TIMEZONE || 'Asia/Manila';

function formatDateInTimezone(date, options = {}) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    ...options,
  }).format(date);
}

export class ScheduleService {
  constructor(mongoService, authService, activityLogService = null) {
    this.mongoService = mongoService;
    this.authService = authService;
    this.activityLogService = activityLogService;
    this.port = Number.parseInt(process.env.PORT || '3000', 10);
  }

  /**
   * Helper method to send JSON response
   */
  sendJson(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
    res.end(json);
  }

  /**
   * Determine base URL from request or environment
   */
  getBaseUrl(req) {
    let baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      // Try to detect from request headers (works for production deployments)
      const host = req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 
                      (req.connection?.encrypted ? 'https' : 'http') ||
                      'http';
      if (host) {
        baseUrl = `${protocol}://${host}`;
        Logger.info(`📡 Detected base URL from request: ${baseUrl}`);
      } else {
        baseUrl = `http://localhost:${this.port}`;
        Logger.warn(`⚠️ Using fallback localhost URL. Set BASE_URL env var for production!`);
      }
    }
    return baseUrl;
  }

  /**
   * Extract schedule ID from URL, handling query parameters and trailing slashes
   */
  extractScheduleId(url) {
    let scheduleId = url.split('/api/admin/schedule/')[1];
    if (scheduleId) {
      // Remove query parameters if any
      scheduleId = scheduleId.split('?')[0].split('#')[0];
      // Remove trailing slash if any
      scheduleId = scheduleId.replace(/\/$/, '');
    }
    return scheduleId || null;
  }

  /**
   * Generate searchable text from schedule event for embedding
   */
  generateSearchableText(event) {
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
    
    // Handle different date types
    if (event.dateType === 'month_only' || event.isMonthOnly) {
      // Month-only event - format as month name
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
      // CRITICAL: Handle both Date objects and ISO strings for isoDate
      const isoDateObj = event.isoDate ? (event.isoDate instanceof Date ? event.isoDate : new Date(event.isoDate)) : null;
      const monthNum = event.month || (isoDateObj && !isNaN(isoDateObj.getTime()) ? isoDateObj.getMonth() + 1 : null);
      const monthName = event.monthName || (monthNum ? monthNames[monthNum - 1] : null);
      const year = event.year || (isoDateObj && !isNaN(isoDateObj.getTime()) ? isoDateObj.getFullYear() : null);
      if (monthName) {
        text += `Scheduled for ${monthName}${year ? ` ${year}` : ''} (month-only event, no specific date). `;
      } else if (event.isoDate || event.date) {
        // CRITICAL: Handle both Date objects and ISO strings
        const dateValue = event.isoDate || event.date;
        const eventDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (!isNaN(eventDate.getTime())) {
          const monthNameFromDate = monthNames[eventDate.getMonth()];
          const yearFromDate = eventDate.getFullYear();
          text += `Scheduled for ${monthNameFromDate} ${yearFromDate} (month-only event, no specific date). `;
        }
      }
    } else if (event.dateType === 'week_in_month' || event.isWeekInMonth) {
      // Week-in-month event - format as week of month
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
      // CRITICAL: Handle both Date objects and ISO strings for isoDate
      const isoDateObj = event.isoDate ? (event.isoDate instanceof Date ? event.isoDate : new Date(event.isoDate)) : null;
      const monthNum = event.month || (isoDateObj && !isNaN(isoDateObj.getTime()) ? isoDateObj.getMonth() + 1 : null);
      const monthName = event.monthName || (monthNum ? monthNames[monthNum - 1] : null);
      const weekOfMonth = event.weekOfMonth;
      const year = event.year || (isoDateObj && !isNaN(isoDateObj.getTime()) ? isoDateObj.getFullYear() : null);
      if (weekOfMonth && monthName) {
        const weekOrdinal = weekOfMonth === 1 ? '1st' : weekOfMonth === 2 ? '2nd' : weekOfMonth === 3 ? '3rd' : `${weekOfMonth}th`;
        text += `Scheduled for ${weekOrdinal} week of ${monthName}${year ? ` ${year}` : ''} (week-in-month event, no specific date). `;
      } else if (event.isoDate || event.date) {
        // CRITICAL: Handle both Date objects and ISO strings
        const dateValue = event.isoDate || event.date;
        const eventDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (!isNaN(eventDate.getTime())) {
          const monthNameFromDate = monthNames[eventDate.getMonth()];
          const yearFromDate = eventDate.getFullYear();
          text += `Scheduled for ${monthNameFromDate} ${yearFromDate} (week-in-month event, no specific date). `;
        }
      }
    } else {
      // Regular date events
      if (event.isoDate || event.date) {
        // CRITICAL: Handle both Date objects and ISO strings
        const dateValue = event.isoDate || event.date;
        const eventDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (!isNaN(eventDate.getTime())) {
          const dateFormats = [
            formatDateInTimezone(eventDate, { year: 'numeric', month: 'long', day: 'numeric' }),
            formatDateInTimezone(eventDate, { year: 'numeric', month: 'short', day: 'numeric' }),
            formatDateInTimezone(eventDate, { month: 'long', day: 'numeric' }),
            formatDateInTimezone(eventDate, { month: 'short', day: 'numeric' })
          ].filter(Boolean);
          if (dateFormats.length > 0) {
            text += `Date: ${dateFormats.join(', ')}. `;
          }
        }
      }
    }
    
    // Add date range if applicable
    if (event.dateType === 'date_range' && event.startDate && event.endDate) {
      // CRITICAL: Handle both Date objects and ISO strings
      const start = event.startDate instanceof Date ? event.startDate : new Date(event.startDate);
      const end = event.endDate instanceof Date ? event.endDate : new Date(event.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const startStr = formatDateInTimezone(start, { year: 'numeric', month: 'long', day: 'numeric' });
        const endStr = formatDateInTimezone(end, { year: 'numeric', month: 'long', day: 'numeric' });
        if (startStr && endStr) {
          text += `Date Range: ${startStr} to ${endStr}. `;
        }
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

    if (event.userType && event.userType !== 'all') {
      const audienceText = event.userType === 'student' ? 'Students' : 'Faculty';
      text += `Audience: ${audienceText}. `;
    }
    
    return text.trim();
  }

  /**
   * Generate embedding for schedule event
   */
  async generateEmbedding(event) {
    try {
      const embeddingService = getEmbeddingService();
      const searchableText = this.generateSearchableText(event);
      const embedding = await embeddingService.embedText(searchableText);
      return embedding;
    } catch (error) {
      Logger.error('Failed to generate embedding for schedule event:', error);
      // Return null if embedding generation fails - don't block event creation
      return null;
    }
  }

  /**
   * Handle schedule routes
   * Returns true if the route was handled, false otherwise
   */
  async handleRoute(req, res, method, url, rawUrl) {
    Logger.info(`📅 ScheduleService.handleRoute: ${method} ${url}`);
    
    // Upload schedule CSV (calendar events)
    if (method === 'POST' && url === '/api/admin/upload-calendar-csv') {
      Logger.info('📅 ScheduleService: Matched upload-calendar-csv route');
      return await this.handleUploadCalendarCSV(req, res);
    }

    // Create schedule item (unified endpoint)
    if (method === 'POST') {
      const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      if (normalizedUrl === '/api/admin/schedule/events') {
        Logger.info('📅 ScheduleService: Matched create-schedule-event route (unified)');
        // Check content-type to route to appropriate handler
        // Content-Type for multipart is set by the browser/fetch automatically
        const contentType = req.headers['content-type'] || '';
        Logger.info(`📅 Content-Type: ${contentType}`);
        
        // Check if it's multipart/form-data (posts/announcements with images)
        // Multipart form data will have 'multipart/form-data' in the content-type header
        if (contentType && contentType.includes('multipart/form-data')) {
          // Multipart form data (posts/announcements with images) -> use handleCreatePost
          Logger.info('📅 Detected multipart/form-data -> routing to handleCreatePost');
          return await this.handleCreatePost(req, res);
        } else if (contentType && contentType.includes('application/json')) {
          // JSON (calendar events) -> use handleCreateEvent
          Logger.info('📅 Detected application/json -> routing to handleCreateEvent');
          return await this.handleCreateEvent(req, res);
        } else {
          // If no content-type or unknown, try to detect by checking first chunk
          // But we can't peek ahead without consuming the stream, so default to handleCreatePost
          // since AddPostDrawer sends multipart even without explicit content-type
          Logger.info('📅 Content-Type not specified or unknown -> defaulting to handleCreatePost (multipart)');
          return await this.handleCreatePost(req, res);
        }
      }
      if (normalizedUrl === '/api/admin/create-post') {
        Logger.info('📅 ScheduleService: Matched create-post route');
        return await this.handleCreatePost(req, res);
      }
      if (normalizedUrl === '/api/admin/calendar/events') {
        Logger.info('📅 ScheduleService: Matched legacy create-event route');
        return await this.handleCreateEvent(req, res);
      }
    }

    // Get schedule items (unified endpoint - supports calendar events and posts)
    if (method === 'GET' && url.startsWith('/api/schedule/events')) {
      // Remove query parameters and trailing slashes for path matching
      const pathOnly = url.split('?')[0].split('#')[0];
      const normalizedUrl = pathOnly.endsWith('/') ? pathOnly.slice(0, -1) : pathOnly;
      
      if (normalizedUrl === '/api/schedule/events') {
        Logger.info('📅 ScheduleService: Matched get-schedule-events route (unified)');
        return await this.handleGetEvents(req, res);
      } else if (normalizedUrl.startsWith('/api/schedule/events/')) {
        const eventId = normalizedUrl.split('/api/schedule/events/')[1].split('?')[0].split('#')[0];
        Logger.info(`📅 ScheduleService: Matched get-schedule-event-by-id route for ID: ${eventId}`);
        return await this.handleGetEventById(req, res, eventId);
      }
    }

    // Get schedule items (public endpoint - supports calendar events and posts) - legacy support
    if (method === 'GET' && url.startsWith('/api/calendar/events')) {
      // Remove query parameters and trailing slashes for path matching
      const pathOnly = url.split('?')[0].split('#')[0];
      const normalizedUrl = pathOnly.endsWith('/') ? pathOnly.slice(0, -1) : pathOnly;
      
      if (normalizedUrl === '/api/calendar/events') {
        Logger.info('📅 ScheduleService: Matched get-calendar-events route (legacy)');
        return await this.handleGetEvents(req, res);
      } else if (normalizedUrl.startsWith('/api/calendar/events/')) {
        const eventId = normalizedUrl.split('/api/calendar/events/')[1].split('?')[0].split('#')[0];
        return await this.handleGetEventById(req, res, eventId);
      }
    }

    // Get schedule items (admin endpoint) - legacy support
    if (method === 'GET' && url === '/api/admin/posts') {
      Logger.info('📅 ScheduleService: Matched get-posts route (legacy)');
      return await this.handleGetPosts(req, res, rawUrl);
    }

    // Get schedule item by ID (public) - legacy support
    if (method === 'GET' && url.startsWith('/api/calendar/events/')) {
      const eventId = url.split('/api/calendar/events/')[1];
      return await this.handleGetEventById(req, res, eventId);
    }

    // Update schedule item (PUT) - check BEFORE delete to avoid conflicts
    if (method === 'PUT') {
      Logger.info(`📅 ScheduleService: Checking PUT route for: ${url}`);
      // Normalize URL (handle double slashes and trailing slashes)
      let normalizedUrl = url.replace(/\/+/g, '/'); // Replace multiple slashes with single
      normalizedUrl = normalizedUrl.endsWith('/') ? normalizedUrl.slice(0, -1) : normalizedUrl;
      
      // Match PUT /api/admin/calendar/events/{eventId} (legacy)
      const putEventMatch = normalizedUrl.match(/^\/api\/admin\/calendar\/events\/([^\/\?]+)/);
      if (putEventMatch && putEventMatch[1]) {
        const eventId = putEventMatch[1];
        Logger.info(`📅 ScheduleService: Matched update-event route for ID: ${eventId}`);
        return await this.handleUpdateEvent(req, res, eventId);
      }

      // Match PUT /api/admin/posts/{postId}
      if (normalizedUrl.startsWith('/api/admin/posts/')) {
        Logger.info(`📅 ScheduleService: Matched update-post route`);
        return await this.handleUpdatePost(req, res, normalizedUrl);
      }

      // Match PUT /api/admin/schedule/events/{scheduleId} (unified)
      const putScheduleEventsMatch = normalizedUrl.match(/^\/api\/admin\/schedule\/events\/([^\/\?]+)/);
      if (putScheduleEventsMatch && putScheduleEventsMatch[1]) {
        const scheduleId = putScheduleEventsMatch[1];
        Logger.info(`📅 ScheduleService: Matched update-schedule-event route for ID: ${scheduleId}`);
        return await this.handleUpdateEvent(req, res, scheduleId);
      }

      // Match PUT /api/admin/schedule/{scheduleId} (legacy)
      const putScheduleMatch = normalizedUrl.match(/^\/api\/admin\/schedule\/([^\/\?]+)/);
      if (putScheduleMatch && putScheduleMatch[1]) {
        const scheduleId = putScheduleMatch[1];
        Logger.info(`📅 ScheduleService: Matched update-schedule route for ID: ${scheduleId}`);
        return await this.handleUpdateSchedule(req, res, scheduleId);
      }
    }

    // Delete all schedule items - check this BEFORE individual delete to avoid conflicts
    if (method === 'DELETE') {
      // Normalize URL (handle double slashes and trailing slashes)
      let normalizedUrl = url.replace(/\/+/g, '/'); // Replace multiple slashes with single
      normalizedUrl = normalizedUrl.endsWith('/') ? normalizedUrl.slice(0, -1) : normalizedUrl;
      
      // Delete all schedule events (unified)
      if (normalizedUrl === '/api/admin/schedule/events') {
        Logger.info('📅 ScheduleService: Matched delete-all-schedule-events route (unified)');
        return await this.handleDeleteAllEvents(req, res);
      }

      // Delete all calendar events (legacy)
      if (normalizedUrl === '/api/admin/calendar/events') {
        Logger.info('📅 ScheduleService: Matched delete-all-events route (legacy)');
        return await this.handleDeleteAllEvents(req, res);
      }
      
      // Delete schedule item (individual) - legacy calendar endpoint
      const deleteEventMatch = normalizedUrl.match(/^\/api\/admin\/calendar\/events\/([^\/\?]+)/);
      if (deleteEventMatch && deleteEventMatch[1]) {
        const eventId = deleteEventMatch[1];
        Logger.info(`📅 ScheduleService: Matched delete-event route for ID: ${eventId}`);
        return await this.handleDeleteEvent(req, res, eventId);
      }

      // Delete schedule item (individual) - posts endpoint
      if (normalizedUrl.startsWith('/api/admin/posts/')) {
        Logger.info(`📅 ScheduleService: Matched delete-post route`);
        return await this.handleDeletePost(req, res, normalizedUrl);
      }

      // Delete schedule item (individual) - unified schedule endpoint
      const deleteScheduleEventsMatch = normalizedUrl.match(/^\/api\/admin\/schedule\/events\/([^\/\?]+)/);
      if (deleteScheduleEventsMatch && deleteScheduleEventsMatch[1]) {
        const scheduleId = deleteScheduleEventsMatch[1];
        Logger.info(`📅 ScheduleService: Matched delete-schedule-event route for ID: ${scheduleId}`);
        return await this.handleDeleteEvent(req, res, scheduleId);
      }

      // Delete schedule item (individual) - legacy schedule endpoint
      const deleteScheduleMatch = normalizedUrl.match(/^\/api\/admin\/schedule\/([^\/\?]+)/);
      if (deleteScheduleMatch && deleteScheduleMatch[1]) {
        const scheduleId = deleteScheduleMatch[1];
        Logger.info(`📅 ScheduleService: Matched delete-schedule route for ID: ${scheduleId}`);
        return await this.handleDeleteSchedule(req, res, scheduleId);
      }
    }

    // Route not handled by this service
    Logger.info(`📅 ScheduleService: Route not matched - ${method} ${url}`);
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

      // Store events in MongoDB schedule collection
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
   * Handle get schedule events (public endpoint - for calendar view)
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
      const type = params.get('type'); // Filter by type: calendar_event, announcement, etc.
      const limit = parseInt(params.get('limit') || '100');

      const events = await this.getEvents({ startDate, endDate, category, type, limit });

      this.sendJson(res, 200, {
        success: true,
        events,
        count: events.length
      });
      return true;
    } catch (error) {
      Logger.error('Get schedule events error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to retrieve events' });
      return true;
    }
  }

  /**
   * Handle get schedule item by ID (public)
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
      Logger.error('Get schedule event error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to retrieve event' });
      return true;
    }
  }

  /**
   * Handle get posts (admin endpoint - for dashboard)
   */
  async handleGetPosts(req, res, rawUrl) {
    Logger.info(`📝 Schedule endpoint: GET ${rawUrl}`);
    // Check authentication
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    try {
      const scheduleCollection = this.mongoService.getCollection('schedule');
      
      // Parse query parameters from rawUrl (includes query string)
      const urlParts = rawUrl.split('?');
      const queryParams = urlParts.length > 1 ? new URLSearchParams(urlParts[1]) : new URLSearchParams();
      const limit = parseInt(queryParams.get('limit') || '100', 10);
      const skip = parseInt(queryParams.get('skip') || '0', 10);
      const category = queryParams.get('category');
      
      // Build query - filter for posts/announcements/news/events
      // Exclude institutional/academic (those go to calendar)
      // Only include: Announcement, News, Event categories for dashboard Updates section
      const query = {
        // Exclude institutional/academic categories - these belong in calendar
        category: { $nin: ['Institutional', 'Academic', 'institutional', 'academic'] }
      };
      
      if (category) {
        // If specific category requested, use it (but still exclude institutional/academic)
        const categoryLower = category.toLowerCase();
        if (categoryLower !== 'institutional' && categoryLower !== 'academic') {
          query.category = category;
        } else {
          // If requesting institutional/academic, return empty (these go to calendar)
          query.category = { $exists: false }; // This will return no results
        }
      }

      // Fetch posts sorted by date (newest first)
      const posts = await scheduleCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();
      
      // Additional frontend-safe filtering: ensure only announcement/news/event categories
      const filteredPosts = posts.filter(post => {
        const postCategory = (post.category || '').toLowerCase();
        return postCategory === 'announcement' || 
               postCategory === 'news' || 
               postCategory === 'event' ||
               (!postCategory || postCategory === 'general') || // Include items with no category or 'General'
               (postCategory !== 'institutional' && postCategory !== 'academic');
      });

      // Convert MongoDB _id to id string and format for frontend
      const formattedPosts = filteredPosts.map(post => ({
        id: post._id.toString(),
        title: post.title || '',
        description: post.description || '',
        category: post.category || 'General',
        date: post.date || post.isoDate || new Date().toISOString(),
        isoDate: post.isoDate || post.date || new Date().toISOString(),
        image: post.image || null,
        images: post.images || (post.image ? [post.image] : []),
        imageFileId: post.imageFileId || null,
        type: post.type || (post.category === 'Event' ? 'event' : 'announcement'),
        source: post.source || 'Admin',
        createdAt: post.createdAt || new Date(),
        updatedAt: post.updatedAt || new Date(),
        createdBy: post.createdBy || 'admin',
        creatorRole: post.creatorRole || (post.source === 'Moderator' ? 'moderator' : 'admin'), // Include creator role for filtering
        isPinned: post.isPinned || false,
        isUrgent: post.isUrgent || false,
        // Approval fields
        isApproved: post.isApproved !== undefined ? post.isApproved : (post.status === 'approved'),
        status: post.status || (post.isApproved ? 'approved' : 'draft'),
        approvedAt: post.approvedAt || null,
        approvedBy: post.approvedBy || null,
      }));

      this.sendJson(res, 200, {
        success: true,
        posts: formattedPosts,
        total: formattedPosts.length,
      });
      return true;
    } catch (error) {
      Logger.error('Failed to get posts:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to fetch posts' });
      return true;
    }
  }

  /**
   * Handle create post (event/announcement)
   */
  async handleCreatePost(req, res) {
    Logger.info(`📝 POST /api/admin/create-post - Request received`);
    Logger.info(`📝 Content-Type: ${req.headers['content-type'] || 'missing'}`);
    Logger.info(`📝 Content-Length: ${req.headers['content-length'] || 'missing'}`);
    
    // Check authentication
    if (!this.authService || !this.mongoService) {
      Logger.error('❌ Services not available');
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      Logger.warn('❌ Unauthorized request to create-post');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    // Check if user is admin or moderator
    const isAdmin = auth.isAdmin === true;
    const isModerator = auth.role === 'moderator';
    if (!isAdmin && !isModerator) {
      Logger.warn(`❌ Forbidden: User ${auth.userId} (role: ${auth.role || 'user'}) attempted to create post`);
      this.sendJson(res, 403, { error: 'Forbidden: Admin or Moderator access required' });
      return true;
    }

    Logger.info(`✅ Authorization successful for create-post - User: ${auth.userId}, Role: ${auth.role || 'admin'}`);

    try {
      const contentType = req.headers['content-type'] || '';
      Logger.info(`📝 Parsing multipart data, Content-Type: ${contentType}`);
      
      if (!contentType.includes('multipart/form-data')) {
        Logger.warn(`❌ Invalid Content-Type: ${contentType}`);
        this.sendJson(res, 400, { error: 'Content-Type must be multipart/form-data' });
        return true;
      }

      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        Logger.warn('❌ Missing boundary in Content-Type');
        this.sendJson(res, 400, { error: 'Missing boundary in Content-Type' });
        return true;
      }

      Logger.info(`📝 Parsing multipart form data with boundary: ${boundary.substring(0, 20)}...`);
      const parts = await parseMultipartFormData(req, boundary);
      Logger.info(`📝 Parsed ${parts.length} parts from multipart data`);
      parts.forEach((part, index) => {
        Logger.info(`📝 Part ${index + 1}: name=${part.name}, filename=${part.filename || 'none'}, size=${part.data.length} bytes`);
      });
      
      // Extract form fields
      const titlePart = parts.find(p => p.name === 'title');
      const descriptionPart = parts.find(p => p.name === 'description');
      const categoryPart = parts.find(p => p.name === 'category');
      const datePart = parts.find(p => p.name === 'date');
      const imagePart = parts.find(p => p.filename);
      
      Logger.info(`📝 Extracted parts: title=${!!titlePart}, description=${!!descriptionPart}, category=${!!categoryPart}, date=${!!datePart}, image=${!!imagePart}`);

      if (!titlePart || !datePart) {
        this.sendJson(res, 400, { error: 'Title and date are required' });
        return true;
      }

      const title = titlePart.data.toString('utf8').trim();
      const description = descriptionPart ? descriptionPart.data.toString('utf8').trim() : '';
      const category = categoryPart ? categoryPart.data.toString('utf8').trim() : 'General';
      const dateStr = datePart.data.toString('utf8').trim();
      
      // Validate date
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        this.sendJson(res, 400, { error: 'Invalid date format' });
        return true;
      }

      // Handle image upload if present using GridFS
      let imageFileId = null;
      if (imagePart) {
        Logger.info(`📸 Image part found: filename=${imagePart.filename}, contentType=${imagePart.contentType}, size=${imagePart.data.length}`);
        try {
          const gridFSService = getGridFSService();
          const imageBuffer = Buffer.from(imagePart.data);
          const imageMimeType = imagePart.contentType || 'image/jpeg';
          const originalFilename = imagePart.filename || `image_${Date.now()}.jpg`;
          
          Logger.info(`📤 Uploading image to GridFS: ${originalFilename}, size: ${imageBuffer.length} bytes`);
          
          // Upload to GridFS
          imageFileId = await gridFSService.uploadImage(
            imageBuffer,
            originalFilename,
            imageMimeType,
            {
              postTitle: title,
              uploadedBy: auth.userId || 'admin',
            }
          );
          
          Logger.success(`📸 Image uploaded to GridFS: ${imageFileId}`);
        } catch (error) {
          Logger.error('❌ Failed to upload image to GridFS:', error);
          Logger.error('Error details:', error.message, error.stack);
          // Continue without image rather than failing the entire post creation
        }
      } else {
        Logger.info('ℹ️ No image part found in request');
      }

      // Create event/announcement document for schedule collection
      const baseUrl = this.getBaseUrl(req);
      
      const isoDateValue = new Date(date);
      // CRITICAL: Ensure dates are stored as Date objects, not strings
      // MongoDB will serialize Date objects correctly
      const creatorRole = isAdmin ? 'admin' : (isModerator ? 'moderator' : 'admin'); // Default to admin if role is unclear
      const event = {
        title,
        description,
        category,
        type: category === 'Event' ? 'event' : 'announcement', // Explicit type field
        date: this.formatDate(isoDateValue), // Human-readable format for display
        isoDate: isoDateValue, // Date object for queries and filtering
        imageFileId: imageFileId, // GridFS file ID
        image: imageFileId ? `${baseUrl}/api/images/${imageFileId}` : null, // Full URL for image retrieval
        images: imageFileId ? [`${baseUrl}/api/images/${imageFileId}`] : [],
        source: creatorRole === 'moderator' ? 'Moderator' : 'Admin', // Store source based on role
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: auth.userId || 'admin',
        creatorRole: creatorRole, // Store creator role for filtering
      };
      
      Logger.info(`🕐 Event object before insert - has time: ${!!event.time}, time value: "${event.time}"`);

      // Generate embedding for semantic search
      Logger.info(`🔍 Generating embedding for schedule event: ${title}`);
      const embedding = await this.generateEmbedding(event);
      if (embedding) {
        event.embedding = embedding;
        Logger.success(`✅ Generated embedding (${embedding.length} dimensions) for schedule event`);
      } else {
        Logger.warn('⚠️ Failed to generate embedding for schedule event, continuing without embedding');
      }

      // Insert into MongoDB schedule collection
      const scheduleCollection = this.mongoService.getCollection('schedule');
      const result = await scheduleCollection.insertOne(event);

      Logger.success(`✅ Event/Announcement created: ${title} (ID: ${result.insertedId})`);

      // Log activity
      if (this.activityLogService) {
        try {
          await this.activityLogService.logActivity(
            auth.userId,
            'admin.post_create',
            {
              postId: result.insertedId.toString(),
              postTitle: title,
              category: category,
            },
            {
              timestamp: new Date(),
              ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
              userAgent: req.headers['user-agent'],
            }
          );
        } catch (logError) {
          Logger.warn('Failed to log post creation activity:', logError);
        }
      }

      this.sendJson(res, 200, {
        success: true,
        message: 'Event/Announcement created successfully',
        event: {
          id: result.insertedId.toString(),
          ...event,
        },
      });
      return true;
    } catch (error) {
      Logger.error('Post creation error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to create post' });
      return true;
    }
  }

  /**
   * Handle create calendar event (legacy endpoint)
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
        semester: eventData.semester || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Generate embedding for semantic search
      Logger.info(`🔍 Generating embedding for schedule event: ${event.title}`);
      const embedding = await this.generateEmbedding(event);
      if (embedding) {
        event.embedding = embedding;
        Logger.success(`✅ Generated embedding (${embedding.length} dimensions) for schedule event`);
      } else {
        Logger.warn('⚠️ Failed to generate embedding for schedule event, continuing without embedding');
      }

      // Save event to schedule collection
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
    const formatted = formatDateInTimezone(date, { month: 'short', day: 'numeric', year: 'numeric' });
    return formatted || '';
  }

  /**
   * Handle delete all schedule events
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
   * Handle delete calendar event (legacy endpoint)
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
   * Handle delete post
   */
  async handleDeletePost(req, res, url) {
    Logger.info(`📝 DELETE /api/admin/posts - Request received`);
    const postId = this.extractScheduleId(url);
    
    if (!postId || postId.trim() === '') {
      Logger.warn('❌ DELETE /api/admin/posts: Post ID missing or empty');
      this.sendJson(res, 400, { error: 'Post ID required' });
      return true;
    }
    
    Logger.info(`📝 DELETE /api/admin/posts: Post ID = ${postId}`);

    // Check authentication
    if (!this.authService || !this.mongoService) {
      Logger.error('❌ Services not available');
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      Logger.warn('❌ Unauthorized request to delete post');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    Logger.info('✅ Authentication successful for delete post');

    try {
      const scheduleCollection = this.mongoService.getCollection('schedule');
      const { ObjectId } = await import('mongodb');
      
      let postObjectId;
      try {
        postObjectId = new ObjectId(postId);
      } catch (error) {
        Logger.error(`❌ Invalid ObjectId format: ${postId}`, error);
        this.sendJson(res, 400, { error: 'Invalid post ID format' });
        return true;
      }

      Logger.info(`📝 Finding post in MongoDB: ${postId}`);
      // Get post to check for imageFileId before deletion
      const postToDelete = await scheduleCollection.findOne({ _id: postObjectId });
      
      if (!postToDelete) {
        Logger.warn(`⚠️ Post not found for deletion: ${postId}`);
        this.sendJson(res, 404, { error: 'Post not found' });
        return true;
      }
      
      Logger.info(`✅ Post found for deletion: ${postId}`);

      // Delete image from GridFS if it exists
      if (postToDelete.imageFileId) {
        try {
          const gridFSService = getGridFSService();
          await gridFSService.deleteImage(postToDelete.imageFileId);
          Logger.info(`🗑️ Deleted image from GridFS: ${postToDelete.imageFileId}`);
        } catch (imageError) {
          Logger.warn('⚠️ Failed to delete image from GridFS:', imageError);
          // Continue with post deletion even if image deletion fails
        }
      }

      // Delete the post from MongoDB schedule collection
      const result = await scheduleCollection.deleteOne({ _id: postObjectId });

      if (result.deletedCount === 0) {
        this.sendJson(res, 404, { error: 'Post not found' });
        return true;
      }

      Logger.success(`✅ Post deleted: ${postId}`);

      // Log activity
      if (this.activityLogService) {
        try {
          await this.activityLogService.logActivity(
            auth.userId,
            'admin.post_delete',
            {
              postId: postId,
              postTitle: postToDelete?.title || 'Unknown',
              category: postToDelete?.category || 'General',
            },
            {
              timestamp: new Date(),
              ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
              userAgent: req.headers['user-agent'],
            }
          );
        } catch (logError) {
          Logger.warn('Failed to log post deletion activity:', logError);
        }
      }

      this.sendJson(res, 200, {
        success: true,
        message: 'Post deleted successfully',
      });
      return true;
    } catch (error) {
      Logger.error('Post deletion error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to delete post' });
      return true;
    }
  }

  /**
   * Handle update post
   */
  async handleUpdatePost(req, res, url) {
    Logger.info(`📝 PUT /api/admin/posts - Request received`);
    const postId = this.extractScheduleId(url);
    
    if (!postId || postId.trim() === '') {
      Logger.warn('❌ PUT /api/admin/posts: Post ID missing or empty');
      this.sendJson(res, 400, { error: 'Post ID required' });
      return true;
    }
    
    Logger.info(`📝 PUT /api/admin/posts: Post ID = ${postId}`);

    // Check authentication
    if (!this.authService || !this.mongoService) {
      Logger.error('❌ Services not available');
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      Logger.warn('❌ Unauthorized request to update post');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    Logger.info('✅ Authentication successful for update post');

    try {
      const contentType = req.headers['content-type'] || '';
      let updateData = {};
      let imageFileId = null;

      // Handle multipart/form-data (if image is being updated)
      if (contentType.includes('multipart/form-data')) {
        const boundary = contentType.split('boundary=')[1];
        if (!boundary) {
          this.sendJson(res, 400, { error: 'Missing boundary in Content-Type' });
          return true;
        }

        const parts = await parseMultipartFormData(req, boundary);
        
        // Extract form fields
        const titlePart = parts.find(p => p.name === 'title');
        const descriptionPart = parts.find(p => p.name === 'description');
        const categoryPart = parts.find(p => p.name === 'category');
        const datePart = parts.find(p => p.name === 'date');
        const imagePart = parts.find(p => p.filename);

        if (titlePart) updateData.title = titlePart.data.toString('utf8').trim();
        if (descriptionPart) updateData.description = descriptionPart.data.toString('utf8').trim();
        if (categoryPart) updateData.category = categoryPart.data.toString('utf8').trim();
        if (datePart) {
          const dateStr = datePart.data.toString('utf8').trim();
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            // CRITICAL: Store date as Date object, not ISO string
            updateData.date = this.formatDate(date); // Human-readable format
            updateData.isoDate = date; // Date object for queries
          }
        }

        // Handle image upload if present
        if (imagePart) {
          Logger.info(`📸 Image part found for update: filename=${imagePart.filename}, size=${imagePart.data.length}`);
          try {
            const gridFSService = getGridFSService();
            const imageBuffer = Buffer.from(imagePart.data);
            const imageMimeType = imagePart.contentType || 'image/jpeg';
            const originalFilename = imagePart.filename || `image_${Date.now()}.jpg`;
            
            // Upload to GridFS
            imageFileId = await gridFSService.uploadImage(
              imageBuffer,
              originalFilename,
              imageMimeType,
              {
                postTitle: updateData.title || 'Updated Post',
                uploadedBy: auth.userId || 'admin',
              }
            );
            
            // Determine base URL
            const baseUrl = this.getBaseUrl(req);
            
            updateData.imageFileId = imageFileId;
            updateData.image = `${baseUrl}/api/images/${imageFileId}`;
            updateData.images = [`${baseUrl}/api/images/${imageFileId}`];
            
            Logger.success(`📸 Image uploaded to GridFS for update: ${imageFileId}`);
          } catch (error) {
            Logger.error('❌ Failed to upload image to GridFS:', error);
            // Continue without image update
          }
        }
      } else {
        // Handle JSON body (no image update)
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        
        if (chunks.length === 0) {
          this.sendJson(res, 400, { error: 'No request body provided' });
          return true;
        }
        
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          updateData = JSON.parse(body);
        } catch (parseError) {
          Logger.error('Failed to parse JSON body:', parseError);
          this.sendJson(res, 400, { error: 'Invalid JSON body' });
          return true;
        }
      }

      if (Object.keys(updateData).length === 0) {
        this.sendJson(res, 400, { error: 'No update data provided' });
        return true;
      }

      // Update the post in MongoDB schedule collection
      const scheduleCollection = this.mongoService.getCollection('schedule');
      const { ObjectId } = await import('mongodb');
      
      let postObjectId;
      try {
        postObjectId = new ObjectId(postId);
      } catch (error) {
        Logger.error(`❌ Invalid ObjectId format: ${postId}`, error);
        this.sendJson(res, 400, { error: 'Invalid post ID format' });
        return true;
      }

      // Get existing post to merge with update data for embedding generation
      const existingPost = await scheduleCollection.findOne({ _id: postObjectId });
      if (!existingPost) {
        this.sendJson(res, 404, { error: 'Post not found' });
        return true;
      }

      // Merge existing data with updates for embedding generation
      const mergedEvent = { ...existingPost, ...updateData };
      
      // Regenerate embedding if text fields changed
      const textFieldsChanged = updateData.title || updateData.description || updateData.category || 
                                updateData.date || updateData.isoDate || updateData.semester;
      if (textFieldsChanged) {
        Logger.info(`🔍 Regenerating embedding for updated schedule event: ${mergedEvent.title || existingPost.title}`);
        const embedding = await this.generateEmbedding(mergedEvent);
        if (embedding) {
          updateData.embedding = embedding;
          Logger.success(`✅ Regenerated embedding (${embedding.length} dimensions) for schedule event`);
        } else {
          Logger.warn('⚠️ Failed to regenerate embedding for schedule event');
        }
      }

      updateData.updatedAt = new Date();

      Logger.info(`📝 Updating post in MongoDB: ${postId}`);
      const result = await scheduleCollection.updateOne(
        { _id: postObjectId },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        Logger.warn(`⚠️ Post not found: ${postId}`);
        this.sendJson(res, 404, { error: 'Post not found' });
        return true;
      }
      
      Logger.info(`✅ Post updated: ${postId}, modifiedCount: ${result.modifiedCount}`);

      // Fetch updated post
      const updatedPost = await scheduleCollection.findOne({ _id: postObjectId });

      Logger.success(`✅ Post updated: ${postId}`);

      // Log activity
      if (this.activityLogService) {
        try {
          await this.activityLogService.logActivity(
            auth.userId,
            'admin.post_update',
            {
              postId: postId,
              postTitle: updatedPost?.title || existingPost?.title || 'Unknown',
              category: updatedPost?.category || existingPost?.category || 'General',
              updatedFields: Object.keys(updateData),
            },
            {
              timestamp: new Date(),
              ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
              userAgent: req.headers['user-agent'],
            }
          );
        } catch (logError) {
          Logger.warn('Failed to log post update activity:', logError);
        }
      }

      this.sendJson(res, 200, {
        success: true,
        message: 'Post updated successfully',
        post: {
          id: updatedPost._id.toString(),
          title: updatedPost.title || '',
          description: updatedPost.description || '',
          category: updatedPost.category || 'General',
          date: updatedPost.date || updatedPost.isoDate || new Date().toISOString(),
          isoDate: updatedPost.isoDate || updatedPost.date || new Date().toISOString(),
          image: updatedPost.image || null,
          images: updatedPost.images || (updatedPost.image ? [updatedPost.image] : []),
          imageFileId: updatedPost.imageFileId || null,
          type: updatedPost.type || (updatedPost.category === 'Event' ? 'event' : 'announcement'),
          source: updatedPost.source || 'Admin',
          createdAt: updatedPost.createdAt || new Date(),
          updatedAt: updatedPost.updatedAt || new Date(),
          createdBy: updatedPost.createdBy || 'admin',
          isPinned: updatedPost.isPinned || false,
          isUrgent: updatedPost.isUrgent || false,
        },
      });
      return true;
    } catch (error) {
      Logger.error('Post update error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to update post' });
      return true;
    }
  }

  /**
   * Handle update calendar event (legacy endpoint)
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
      const contentType = req.headers['content-type'] || '';
      let updates = {};
      let imageFileId = null;

      // Handle multipart/form-data (if image is being updated)
      if (contentType.includes('multipart/form-data')) {
        Logger.info('📝 Update event: Detected multipart/form-data');
        const boundary = contentType.split('boundary=')[1];
        if (!boundary) {
          this.sendJson(res, 400, { error: 'Missing boundary in Content-Type' });
          return true;
        }

        const parts = await parseMultipartFormData(req, boundary);
        
        // Extract form fields
        const titlePart = parts.find(p => p.name === 'title');
        const descriptionPart = parts.find(p => p.name === 'description');
        const categoryPart = parts.find(p => p.name === 'category');
        const datePart = parts.find(p => p.name === 'date');
        const imagePart = parts.find(p => p.filename);

        if (titlePart) updates.title = titlePart.data.toString('utf8').trim();
        if (descriptionPart) updates.description = descriptionPart.data.toString('utf8').trim();
        if (categoryPart) updates.category = categoryPart.data.toString('utf8').trim();
        if (datePart) {
          const dateStr = datePart.data.toString('utf8').trim();
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            updates.date = this.formatDate(date);
            updates.isoDate = date;
          }
        }
        
        // Set default values for required fields if not provided
        if (!updates.time) updates.time = 'All Day';
        if (!updates.category) updates.category = 'Event';
        if (!updates.description) updates.description = '';
        
        // If isoDate is not set but we have a date, derive it
        if (!updates.isoDate && updates.date) {
          const date = new Date(updates.date);
          if (!isNaN(date.getTime())) {
            updates.isoDate = date;
          }
        }

        // Handle image upload if present
        if (imagePart) {
          Logger.info(`📸 Image part found for update: filename=${imagePart.filename}, size=${imagePart.data.length}`);
          try {
            const gridFSService = getGridFSService();
            const imageBuffer = Buffer.from(imagePart.data);
            const imageMimeType = imagePart.contentType || 'image/jpeg';
            const originalFilename = imagePart.filename || `image_${Date.now()}.jpg`;
            
            // Upload to GridFS
            imageFileId = await gridFSService.uploadImage(
              imageBuffer,
              originalFilename,
              imageMimeType,
              {
                postTitle: updates.title || 'Updated Event',
                uploadedBy: auth.userId || 'admin',
              }
            );
            
            // Determine base URL
            const baseUrl = this.getBaseUrl(req);
            
            updates.imageFileId = imageFileId;
            updates.image = `${baseUrl}/api/images/${imageFileId}`;
            updates.images = [`${baseUrl}/api/images/${imageFileId}`];
            
            Logger.success(`📸 Image uploaded to GridFS for update: ${imageFileId}`);
          } catch (error) {
            Logger.error('❌ Failed to upload image to GridFS:', error);
            // Continue without image update
          }
        }
      } else {
        // Handle JSON body (no image update)
        Logger.info('📝 Update event: Detected JSON body');
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        
        if (chunks.length === 0) {
          this.sendJson(res, 400, { error: 'Request body is required' });
          return true;
        }
        
        let eventData;
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          eventData = JSON.parse(body);
        } catch (parseError) {
          Logger.error('Failed to parse JSON body:', parseError);
          this.sendJson(res, 400, { error: 'Invalid JSON in request body' });
          return true;
        }

        // Validate required fields (isoDate can be derived from date if not provided)
        if (!eventData || !eventData.title) {
          Logger.warn('Update event validation failed:', { hasTitle: !!eventData?.title, hasIsoDate: !!eventData?.isoDate, hasDate: !!eventData?.date });
          this.sendJson(res, 400, { error: 'Title is required' });
          return true;
        }
        
        // If isoDate is not provided but date is, derive isoDate from date
        if (!eventData.isoDate && eventData.date) {
          const derivedDate = new Date(eventData.date);
          if (!isNaN(derivedDate.getTime())) {
            eventData.isoDate = derivedDate;
          }
        } else if (eventData.isoDate && !(eventData.isoDate instanceof Date)) {
          const normalizedIso = new Date(eventData.isoDate);
          if (!isNaN(normalizedIso.getTime())) {
            eventData.isoDate = normalizedIso;
          }
        }

        if (eventData.startDate && !(eventData.startDate instanceof Date)) {
          const normalizedStart = new Date(eventData.startDate);
          if (!isNaN(normalizedStart.getTime())) {
            eventData.startDate = normalizedStart;
          }
        }

        if (eventData.endDate && !(eventData.endDate instanceof Date)) {
          const normalizedEnd = new Date(eventData.endDate);
          if (!isNaN(normalizedEnd.getTime())) {
            eventData.endDate = normalizedEnd;
          }
        }

        // Prepare update object (exclude _id and other system fields)
        updates = {
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
          semester: eventData.semester || null,
        };
      }

      // Regenerate embedding if text fields changed
      const scheduleCollection = this.mongoService.getCollection('schedule');
      const { ObjectId } = await import('mongodb');
      let eventObjectId;
      try {
        eventObjectId = new ObjectId(eventId);
      } catch (error) {
        Logger.error(`❌ Invalid ObjectId format: ${eventId}`, error);
        this.sendJson(res, 400, { error: 'Invalid event ID format' });
        return true;
      }

      const existingEvent = await scheduleCollection.findOne({ _id: eventObjectId });
      if (existingEvent) {
        const mergedEvent = { ...existingEvent, ...updates };
        const textFieldsChanged = updates.title || updates.description || updates.category || 
                                  updates.isoDate || updates.semester;
        if (textFieldsChanged) {
          Logger.info(`🔍 Regenerating embedding for updated schedule event: ${mergedEvent.title}`);
          const embedding = await this.generateEmbedding(mergedEvent);
          if (embedding) {
            updates.embedding = embedding;
            Logger.success(`✅ Regenerated embedding (${embedding.length} dimensions) for schedule event`);
          } else {
            Logger.warn('⚠️ Failed to regenerate embedding for schedule event');
          }
        }
      }

      // Update event in schedule collection
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
   * Handle update schedule (unified endpoint)
   */
  async handleUpdateSchedule(req, res, scheduleId) {
    // This is a unified handler that can update any schedule item
    // For now, route to updateEvent as the implementation is the same
    return await this.handleUpdateEvent(req, res, scheduleId);
  }

  /**
   * Handle delete schedule (unified endpoint)
   */
  async handleDeleteSchedule(req, res, scheduleId) {
    // This is a unified handler that can delete any schedule item
    // For now, route to deleteEvent as the implementation is the same
    return await this.handleDeleteEvent(req, res, scheduleId);
  }

  /**
   * Create a single schedule event in MongoDB
   */
  async createEvent(event) {
    try {
      const scheduleCollection = this.mongoService.getCollection('schedule');
      const result = await scheduleCollection.insertOne(event);
      return { ...event, _id: result.insertedId };
    } catch (error) {
      Logger.error('Failed to create schedule event:', error);
      throw error;
    }
  }

  /**
   * Save events to MongoDB schedule collection
   */
  async saveEvents(events, uploadedBy) {
    try {
      const scheduleCollection = this.mongoService.getCollection('schedule');
      
      // Insert events (upsert based on title and date to avoid duplicates)
      let insertedCount = 0;
      let updatedCount = 0;
      
      for (const event of events) {
        // CRITICAL: Ensure all dates are stored as Date objects, not strings
        // This ensures consistent storage and proper querying
        if (event.isoDate && !(event.isoDate instanceof Date)) {
          const parsedIso = new Date(event.isoDate);
          if (!isNaN(parsedIso.getTime())) {
            event.isoDate = parsedIso;
          } else {
            Logger.warn(`Invalid isoDate for event "${event.title}": ${event.isoDate}`);
          }
        }
        if (event.startDate && !(event.startDate instanceof Date)) {
          const parsedStart = new Date(event.startDate);
          if (!isNaN(parsedStart.getTime())) {
            event.startDate = parsedStart;
          } else {
            Logger.warn(`Invalid startDate for event "${event.title}": ${event.startDate}`);
          }
        }
        if (event.endDate && !(event.endDate instanceof Date)) {
          const parsedEnd = new Date(event.endDate);
          if (!isNaN(parsedEnd.getTime())) {
            event.endDate = parsedEnd;
          } else {
            Logger.warn(`Invalid endDate for event "${event.title}": ${event.endDate}`);
          }
        }
        // CRITICAL: Ensure date field is human-readable format, not ISO string
        if (event.isoDate && !event.date) {
          event.date = this.formatDate(event.isoDate);
        } else if (event.isoDate && event.date && (event.date.includes('T') || event.date.includes('Z'))) {
          // If date is stored as ISO string, convert to human-readable format
          event.date = this.formatDate(event.isoDate);
        }
        // CRITICAL: Ensure year field is a number, not a string
        // Extract year from isoDate if year is missing or is a string
        if (event.isoDate instanceof Date) {
          const yearFromDate = event.isoDate.getFullYear();
          if (!event.year || typeof event.year === 'string') {
            event.year = yearFromDate;
          } else if (typeof event.year === 'number' && event.year !== yearFromDate) {
            // If year exists but doesn't match isoDate, use isoDate's year (more reliable)
            Logger.debug(`Year mismatch for event "${event.title}": stored year=${event.year}, isoDate year=${yearFromDate}. Using isoDate year.`);
            event.year = yearFromDate;
          }
        } else if (event.startDate instanceof Date && !event.year) {
          // If no isoDate but we have startDate, extract year from startDate
          event.year = event.startDate.getFullYear();
        }
        // Generate embedding for each event
        Logger.info(`🔍 Generating embedding for CSV event: ${event.title}`);
        const embedding = await this.generateEmbedding(event);
        if (embedding) {
          event.embedding = embedding;
        }
        
        const result = await scheduleCollection.updateOne(
          { 
            title: event.title,
            isoDate: event.isoDate
          },
          {
            $set: {
              ...event,
              uploadedAt: new Date(),
              uploadedBy: uploadedBy,
              source: event.source || 'CSV Upload',
              createdAt: new Date(),
              updatedAt: new Date(),
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
      Logger.error('Failed to save schedule events:', error);
      throw error;
    }
  }

  /**
   * Get schedule events from MongoDB
   * IMPROVED: Handles both single dates and date ranges properly
   * Supports semester filtering: 1 (1st semester), 2 (2nd semester), or "Off" (off semester)
   * Supports exam filtering: 'prelim', 'midterm', 'final' to filter by exam type in title
   * @param {boolean} enableLogging - Whether to enable verbose logging (default: false, only log for RAG/AI queries)
   */
  async getEvents({ startDate, endDate, category, semester, limit = 100, type, examType, enableLogging = false, userType = null }) {
    try {
      const scheduleCollection = this.mongoService.getCollection('schedule');
      
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
        if (queryStart) singleDateQuery.$gte = queryStart;
        if (queryEnd) singleDateQuery.$lte = queryEnd;
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
              startDate: { $gte: queryStart, $lte: queryEnd }
            });
            // Event endDate is within query range
            rangeConditions.push({
              endDate: { $gte: queryStart, $lte: queryEnd }
            });
            // Event range completely contains query range
            rangeConditions.push({
              startDate: { $lte: queryStart },
              endDate: { $gte: queryEnd }
            });
          } else if (queryStart) {
            rangeConditions.push({ endDate: { $gte: queryStart } });
          } else if (queryEnd) {
            rangeConditions.push({ startDate: { $lte: queryEnd } });
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
      
      // Filter for calendar events: Include Institutional/Academic categories OR calendar_event type
      // Exclude Announcement/News/Event categories (those go to dashboard Updates)
      if (!category && !type) {
        // Default calendar query: Show institutional/academic or calendar_event type
        // Exclude announcement/news/event categories (they belong in dashboard Updates)
        // Build calendar category filter using $and with $or
        const calendarCategoryFilter = {
          $and: [
            {
              $or: [
                { category: { $in: ['Institutional', 'Academic', 'institutional', 'academic'] } },
                { type: 'calendar_event' },
                { category: { $exists: false } } // Include items with no category if they have calendar_event type
              ]
            },
            {
              $or: [
                { category: { $nin: ['Announcement', 'News', 'Event', 'announcement', 'news', 'event'] } },
                { category: { $exists: false } }
              ]
            }
          ]
        };
        
        if (query.$or) {
          // If date query exists, wrap both conditions in $and
          query.$and = [
            { $or: query.$or },
            calendarCategoryFilter
          ];
          delete query.$or;
        } else {
          // No date query, just use calendar filter
          Object.assign(query, calendarCategoryFilter);
        }
      } else if (category) {
        query.category = category;
      }
      
      // Filter by type if provided (calendar_event, announcement, etc.)
      if (type) {
        if (type === 'all') {
          // Don't filter by type - return all types
        } else {
          query.type = type;
        }
      }
      
      // Filter by semester if provided
      // Semester values: 1 (1st semester), 2 (2nd semester), or "Off" (off semester)
      // CRITICAL: Normalize semester values to ensure proper matching
      if (semester !== undefined && semester !== null) {
        let normalizedSemester = null;
        if (semester === 1 || semester === '1' || semester === 'first' || semester === '1st') {
          normalizedSemester = 1;
        } else if (semester === 2 || semester === '2' || semester === 'second' || semester === '2nd') {
          normalizedSemester = 2;
        } else if (semester === 'Off' || semester === 'off' || semester === 'off semester') {
          normalizedSemester = 'Off';
        } else {
          // Try to parse as number
          const semesterNum = parseInt(semester, 10);
          if (!isNaN(semesterNum) && (semesterNum === 1 || semesterNum === 2)) {
            normalizedSemester = semesterNum;
          }
        }
        
        if (normalizedSemester !== null) {
          // CRITICAL: Match both numeric and string representations in database
          // Use $in to match both number and string representations
          if (normalizedSemester === 1 || normalizedSemester === 2) {
            query.semester = { $in: [normalizedSemester, String(normalizedSemester)] };
          } else {
            query.semester = normalizedSemester;
          }
          
          if (enableLogging) {
            Logger.debug(`📅 Added semester filter: ${normalizedSemester} (matching both number and string)`);
          }
        }
      }
      
      // CRITICAL: Add explicit year filtering if date range is provided
      // This ensures we don't get events from wrong years (e.g., 2026 when querying 2025)
      // CRITICAL: Handle both Date objects and ISO strings in MongoDB
      if (startDate && endDate) {
        const queryStartYear = new Date(startDate).getFullYear();
        const queryEndYear = new Date(endDate).getFullYear();
        
        // If date range is within a single year, add year filter
        if (queryStartYear === queryEndYear) {
          const yearStart = new Date(queryStartYear, 0, 1);
          const yearEnd = new Date(queryStartYear + 1, 0, 1);
          
          const yearFilter = {
            $or: [
              // Check explicit year field (both number and string)
              { year: queryStartYear },
              { year: String(queryStartYear) },
              // Check isoDate field - MongoDB handles Date objects, but also check if stored as string
              {
                $or: [
                  {
                    isoDate: {
                      $gte: yearStart,
                      $lt: yearEnd
                    }
                  },
                  // Also check if isoDate is stored as ISO string (for compatibility)
                  {
                    isoDate: {
                      $gte: yearStart.toISOString(),
                      $lt: yearEnd.toISOString()
                    }
                  }
                ]
              },
              // For date ranges, check if startDate OR endDate is in the requested year
              // This is more lenient - we'll do exact filtering in post-query if needed
              {
                dateType: 'date_range',
                $or: [
                  {
                    startDate: {
                      $gte: yearStart,
                      $lt: yearEnd
                    }
                  },
                  {
                    startDate: {
                      $gte: yearStart.toISOString(),
                      $lt: yearEnd.toISOString()
                    }
                  },
                  {
                    endDate: {
                      $gte: yearStart,
                      $lt: yearEnd
                    }
                  },
                  {
                    endDate: {
                      $gte: yearStart.toISOString(),
                      $lt: yearEnd.toISOString()
                    }
                  }
                ]
              }
            ]
          };
          
          if (query.$and) {
            query.$and.push(yearFilter);
          } else {
            query.$and = [yearFilter];
          }
          
          if (enableLogging) {
            Logger.debug(`📅 Added explicit year filter: ${queryStartYear} (prevents wrong year events, handles both Date objects and strings)`);
          }
        }
      }

      if (userType && userType.toLowerCase() !== 'faculty') {
        const normalizedUserType = userType.toLowerCase();
        const audienceFilter = {
          $or: [
            { userType: { $exists: false } },
            { userType: null },
            { userType: '' },
            { userType: 'all' },
            { userType: normalizedUserType }
          ]
        };
        if (query.$and) {
          query.$and.push(audienceFilter);
        } else if (query.$or) {
          query.$and = [{ $or: query.$or }, audienceFilter];
          delete query.$or;
        } else {
          query.$and = [audienceFilter];
        }
      }

      // Filter by exam type if provided (prelim, midterm, final)
      // This filters events by keywords in the title for exam-specific queries
      if (examType) {
        const examTypeLower = examType.toLowerCase();
        let examTitleFilter = null;
        
        if (examTypeLower === 'prelim' || examTypeLower === 'preliminary') {
          // Filter for prelim/preliminary examination events
          examTitleFilter = { 
            title: { 
              $regex: '\\b(prelim|preliminary)\\b',
              $options: 'i'
            }
          };
        } else if (examTypeLower === 'midterm') {
          // Filter for midterm examination events
          examTitleFilter = { 
            title: { 
              $regex: '\\bmidterm\\b',
              $options: 'i'
            }
          };
        } else if (examTypeLower === 'final') {
          // Filter for final examination events
          examTitleFilter = { 
            title: { 
              $regex: '\\bfinal\\b',
              $options: 'i'
            }
          };
        }
        
        // Add exam filter to query structure properly
        if (examTitleFilter) {
          if (query.$and) {
            // If query already has $and structure, add exam filter to it
            query.$and.push(examTitleFilter);
          } else {
            // If query is simple, add exam filter directly
            query.title = examTitleFilter.title;
          }
        }
      }

      // Log data fetch operation only if logging is enabled (for RAG/AI queries)
      if (enableLogging) {
        Logger.logDataFetch('getScheduleEvents', JSON.stringify({ startDate, endDate, category, semester, limit, type, examType }), {
          method: 'mongodb_find',
          filters: {
            startDate,
            endDate,
            category,
            semester,
            limit,
            type,
            examType,
            query: JSON.stringify(query)
          }
        });
      }

      // Fetch events sorted by date
      const events = await scheduleCollection
        .find(query)
        .sort({ isoDate: 1 })
        .limit(limit)
        .toArray();

      // CRITICAL: Verify year filtering worked correctly
      if (enableLogging && startDate && endDate) {
        const queryStartYear = new Date(startDate).getFullYear();
        const queryEndYear = new Date(endDate).getFullYear();
        
        if (queryStartYear === queryEndYear) {
          // Check if any events are from wrong year
          const wrongYearEvents = events.filter(event => {
            const eventYear = event.year || 
              (event.isoDate ? (event.isoDate instanceof Date ? event.isoDate.getFullYear() : new Date(event.isoDate).getFullYear()) : null) ||
              (event.startDate ? (event.startDate instanceof Date ? event.startDate.getFullYear() : new Date(event.startDate).getFullYear()) : null);
            return eventYear && eventYear !== queryStartYear;
          });
          
          if (wrongYearEvents.length > 0) {
            Logger.warn(`⚠️  Year filter issue: Found ${wrongYearEvents.length} events from wrong year (query: ${queryStartYear}, found: ${wrongYearEvents.map(e => e.year || 'unknown').join(', ')})`);
            wrongYearEvents.forEach(e => {
              Logger.warn(`   - "${e.title}": year=${e.year}, isoDate=${e.isoDate}, startDate=${e.startDate}`);
            });
          } else {
            Logger.debug(`✅ Year filter verified: All ${events.length} events are from year ${queryStartYear}`);
          }
        }
      }

      // Log retrieved events only if logging is enabled (for RAG/AI queries)
      if (enableLogging && events && events.length > 0) {
        const eventsForLogging = events.map(event => {
          // Format event date - handle both Date objects and strings
          const eventDate = event.isoDate || event.date;
          const dateObj = eventDate instanceof Date ? eventDate : new Date(eventDate);
          const dateStr = !isNaN(dateObj.getTime()) ? formatDateInTimezone(
            dateObj,
            { year: 'numeric', month: 'long', day: 'numeric' }
          ) || 'Date TBD' : 'Date TBD';
          
          // Create formatted text content similar to RAG format
          let eventText = `${event.title || 'Untitled Event'}. `;
          if (event.description) eventText += `${event.description}. `;
          eventText += `Date: ${dateStr}. `;
          if (event.time && event.time !== 'All Day') eventText += `Time: ${event.time}. `;
          if (event.category) eventText += `Category: ${event.category}. `;
          
          // Include semester information
          if (event.semester) {
            const semesterText = event.semester === 1 ? '1st Semester' : 
                               event.semester === 2 ? '2nd Semester' : 
                               event.semester === 'Off' ? 'Off Semester' : 
                               `Semester ${event.semester}`;
            eventText += `Semester: ${semesterText}. `;
          }
          
          // Include date range if applicable - handle both Date objects and strings
          if (event.dateType === 'date_range' && event.startDate && event.endDate) {
            const startObj = event.startDate instanceof Date ? event.startDate : new Date(event.startDate);
            const endObj = event.endDate instanceof Date ? event.endDate : new Date(event.endDate);
            const start = !isNaN(startObj.getTime()) ? formatDateInTimezone(startObj, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date TBD';
            const end = !isNaN(endObj.getTime()) ? formatDateInTimezone(endObj, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date TBD';
            if (start && end) {
              eventText += `Date Range: ${start} to ${end}. `;
            }
          }
          
          return {
            id: event._id?.toString() || 'unknown',
            section: 'schedule_events',
            type: event.type || 'event',
            category: event.category || 'General',
            text: eventText.trim(), // This is what Logger.logRetrievedChunks displays
            content: eventText.trim(), // Fallback for content field
            metadata: {
              title: event.title,
              date: eventDate,
              time: event.time,
              category: event.category,
              semester: event.semester,
              dateType: event.dateType,
              startDate: event.startDate,
              endDate: event.endDate
            }
          };
        });

        Logger.logRetrievedChunks(
          `Schedule Query: ${JSON.stringify({ startDate, endDate, category, semester })}`,
          eventsForLogging,
          {
            source: 'schedule_collection',
            maxChunks: 30,
            showFullContent: false
          }
        );
      } else if (enableLogging) {
        Logger.logRetrievedChunks(
          `Schedule Query: ${JSON.stringify({ startDate, endDate, category, semester })}`,
          [],
          {
            source: 'schedule_collection',
            maxChunks: 30,
            showFullContent: false
          }
        );
      }

      Logger.debug(`✅ Schedule events fetched: ${events.length} events found`);

      return events;
    } catch (error) {
      Logger.error('Failed to get schedule events:', error);
      throw error;
    }
  }

  /**
   * Get schedule event by ID
   */
  async getEventById(eventId) {
    try {
      const scheduleCollection = this.mongoService.getCollection('schedule');
      const { ObjectId } = await import('mongodb');
      
      // Convert eventId to ObjectId if it's a string
      const objectId = typeof eventId === 'string' ? new ObjectId(eventId) : eventId;
      
      const event = await scheduleCollection.findOne({ _id: objectId });
      return event;
    } catch (error) {
      Logger.error('Failed to get schedule event by ID:', error);
      throw error;
    }
  }

  /**
   * Delete all schedule events
   */
  async deleteAllEvents() {
    try {
      const scheduleCollection = this.mongoService.getCollection('schedule');
      const result = await scheduleCollection.deleteMany({});
      Logger.info(`✅ Deleted ${result.deletedCount} schedule events`);
      return {
        deletedCount: result.deletedCount
      };
    } catch (error) {
      Logger.error('Failed to delete all schedule events:', error);
      throw error;
    }
  }

  /**
   * Update schedule event
   */
  async updateEvent(eventId, updates) {
    try {
      const scheduleCollection = this.mongoService.getCollection('schedule');
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
      
      const result = await scheduleCollection.updateOne(
        { _id: objectId },
        { $set: updates }
      );
      
      if (result.matchedCount === 0) {
        return null;
      }
      
      // Return the updated event
      const updatedEvent = await scheduleCollection.findOne({ _id: objectId });
      return updatedEvent;
    } catch (error) {
      Logger.error('Failed to update schedule event:', error);
      throw error;
    }
  }

  /**
   * Delete schedule event
   */
  async deleteEvent(eventId) {
    try {
      const scheduleCollection = this.mongoService.getCollection('schedule');
      const { ObjectId } = await import('mongodb');
      
      // Convert eventId to ObjectId if it's a string
      const objectId = typeof eventId === 'string' ? new ObjectId(eventId) : eventId;
      
      const result = await scheduleCollection.deleteOne({ _id: objectId });
      return result.deletedCount > 0;
    } catch (error) {
      Logger.error('Failed to delete schedule event:', error);
      throw error;
    }
  }

  /**
   * Authentication middleware helper
   */
  getAuthMiddleware() {
    return authMiddleware(this.authService, this.mongoService);
  }
}

/**
 * Get schedule service instance
 */
let scheduleServiceInstance = null;

export function getScheduleService(mongoService, authService, activityLogService = null) {
  if (!scheduleServiceInstance && mongoService && authService) {
    scheduleServiceInstance = new ScheduleService(mongoService, authService, activityLogService);
    Logger.info('✅ ScheduleService instance created');
  } else if (!mongoService || !authService) {
    Logger.warn('⚠️ ScheduleService: mongoService or authService not provided');
  }
  return scheduleServiceInstance;
}

