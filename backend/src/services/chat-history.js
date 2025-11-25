/**
 * Chat History Service
 * Handles all chat history related endpoints and operations
 */

import { Logger } from '../utils/logger.js';
import { authMiddleware } from './auth.js';

export class ChatHistoryService {
  constructor(mongoService, authService) {
    this.mongoService = mongoService;
    this.authService = authService;
  }

  /**
   * Handle chat history routes
   * Returns true if the route was handled, false otherwise
   */
  async handleRoute(req, res, method, url) {
    // Save chat history
    if (method === 'POST' && url === '/api/chat-history') {
      return await this.handleSaveChatHistory(req, res);
    }

    // Get chat history list
    if (method === 'GET' && url === '/api/chat-history') {
      return await this.handleGetChatHistory(req, res);
    }

    // Delete all chat history
    if (method === 'DELETE' && url === '/api/chat-history') {
      return await this.handleDeleteAllChatHistory(req, res);
    }

    // Get top frequently asked questions for a user (support legacy typo route)
    const topQueriesPaths = ['/api/top-queries', '/api/top-qqueries'];
    if (method === 'GET' && topQueriesPaths.includes(url)) {
      return await this.handleGetTopQueries(req, res);
    }

    // Get specific chat session
    if (method === 'GET' && url.startsWith('/api/chat-session/')) {
      return await this.handleGetChatSession(req, res, url);
    }

    // Delete specific chat session
    if (method === 'DELETE' && url.startsWith('/api/chat-session/')) {
      return await this.handleDeleteChatSession(req, res, url);
    }

    // Route not handled by this service
    return false;
  }

  /**
   * Save chat history
   */
  async handleSaveChatHistory(req, res) {
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    Logger.info(`POST /api/chat-history: Validating authentication...`);
    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      Logger.error(`POST /api/chat-history: Authentication failed - ${auth.error || 'Unauthorized'}, details: ${auth.details || 'none'}`);
      this.sendJson(res, 401, { error: auth.error || 'Unauthorized', details: auth.details });
      return true;
    }
    Logger.info(`POST /api/chat-history: Authentication successful for userId: ${auth.userId}`);

    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1000000) req.destroy(); });
    req.on('end', async () => {
      try {
        const json = JSON.parse(body);
        const { sessionId, messages, userType } = json;

        if (!sessionId || !messages) {
          this.sendJson(res, 400, { error: 'sessionId and messages required' });
          return;
        }

        // Save the chat session with userType
        await this.mongoService.saveChatSession(auth.userId, sessionId, messages, userType);

        // Add to chat history list with userType
        if (messages.length > 0) {
          const firstMessage = messages[0];
          const lastMessage = messages[messages.length - 1];

          const chatInfo = {
            id: sessionId,
            title: firstMessage.content.substring(0, 50) + (firstMessage.content.length > 50 ? '...' : ''),
            preview: lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : ''),
            timestamp: new Date(),
            userType: userType || 'student' // Default to student if not provided
          };

          await this.mongoService.addChatToHistory(auth.userId, chatInfo);
          Logger.info(`✅ Chat history entry added for user: ${auth.userId}, session: ${sessionId}, userType: ${userType || 'student'}`);
        }

        this.sendJson(res, 200, { success: true, message: 'Chat history saved' });
      } catch (error) {
        Logger.error('Save chat history error:', error);
        this.sendJson(res, 500, { error: error.message });
      }
    });
    return true;
  }

  /**
   * Get chat history list
   */
  async handleGetChatHistory(req, res) {
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      this.sendJson(res, 401, { error: auth.error || 'Unauthorized' });
      return true;
    }

    try {
      const history = await this.mongoService.getChatHistory(auth.userId);
      this.sendJson(res, 200, { success: true, history });
    } catch (error) {
      Logger.error('Get chat history error:', error);
      this.sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  /**
   * Delete all chat history
   */
  async handleDeleteAllChatHistory(req, res) {
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      this.sendJson(res, 401, { error: auth.error || 'Unauthorized' });
      return true;
    }

    try {
      await this.mongoService.deleteAllChatHistory(auth.userId);
      this.sendJson(res, 200, { success: true, message: 'All chat history deleted' });
    } catch (error) {
      Logger.error('Delete all chat history error:', error);
      this.sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  /**
   * Get top frequently asked questions (global FAQs from knowledge base)
   */
  async handleGetTopQueries(req, res) {
    Logger.info(`📊 GET /api/top-queries - Request received`);

    if (!this.authService || !this.mongoService) {
      Logger.error('Top queries: Services not available');
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    try {
      const auth = await authMiddleware(this.authService, this.mongoService)(req);
      if (!auth.authenticated) {
        Logger.warn(`Top queries: Unauthorized - ${auth.error || 'No auth'}`);
        this.sendJson(res, 401, { error: auth.error || 'Unauthorized' });
        return true;
      }

      // Get userType from query parameter (optional)
      const rawUrl = req.url || '/';
      const urlParts = rawUrl.split('?');
      const queryString = urlParts[1] || '';
      const params = new URLSearchParams(queryString);
      const userType = params.get('userType'); // 'student' or 'faculty' or null for all

      Logger.info(`Top queries: Fetching global FAQs, userType: ${userType || 'all'}`);
      const topQueries = await this.mongoService.getGlobalFAQs(userType, 5);
      Logger.success(`Top queries: Returning ${topQueries.length} queries`);
      this.sendJson(res, 200, { success: true, queries: topQueries });
    } catch (error) {
      Logger.error('Get top queries error:', error);
      this.sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  /**
   * Get specific chat session
   */
  async handleGetChatSession(req, res, url) {
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      this.sendJson(res, 401, { error: auth.error || 'Unauthorized' });
      return true;
    }

    try {
      const sessionId = url.split('/')[3]; // /api/chat-session/{sessionId}

      if (!sessionId) {
        this.sendJson(res, 400, { error: 'Session ID required' });
        return true;
      }

      const messages = await this.mongoService.getChatSession(auth.userId, sessionId);
      this.sendJson(res, 200, { success: true, messages });
    } catch (error) {
      Logger.error('Get chat session error:', error);
      this.sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  /**
   * Delete specific chat session
   */
  async handleDeleteChatSession(req, res, url) {
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      this.sendJson(res, 401, { error: auth.error || 'Unauthorized' });
      return true;
    }

    try {
      const sessionId = url.split('/')[3]; // /api/chat-session/{sessionId}
      if (!sessionId) {
        this.sendJson(res, 400, { error: 'Session ID required' });
        return true;
      }

      await this.mongoService.deleteChatSession(auth.userId, sessionId);
      this.sendJson(res, 200, { success: true });
    } catch (error) {
      Logger.error('Delete chat session error:', error);
      this.sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  /**
   * Helper function to send JSON response
   */
  sendJson(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
    res.end(json);
  }
}

// Export singleton factory
let chatHistoryServiceInstance = null;

export function getChatHistoryService(mongoService, authService) {
  if (!chatHistoryServiceInstance) {
    chatHistoryServiceInstance = new ChatHistoryService(mongoService, authService);
  }
  return chatHistoryServiceInstance;
}

export default ChatHistoryService;

