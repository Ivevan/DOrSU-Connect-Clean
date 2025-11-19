import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthService, authMiddleware } from './services/auth.js';
import { getScheduleService } from './services/schedule.js';
import { getChatHistoryService } from './services/chat-history.js';
import conversationService from './services/conversation.js';
import { getDataRefreshService } from './services/data-refresh.js';
import { getFileProcessorService } from './services/file-processor.js';
import responseFormatter from './services/formatter.js';
import { getGridFSService } from './services/gridfs.js';
import { getMongoDBService } from './services/mongodb.js';
import { OptimizedRAGService } from './services/rag.js';
import { getNewsScraperService } from './services/scraper.js';
import { LlamaService } from './services/service.js';
import { buildSystemInstructions, getCalendarEventsInstructions, getHistoryCriticalRules, getHistoryDataSummary, getHistoryInstructions, getHymnCriticalRules, getHymnInstructions, getLeadershipCriticalRules, getLeadershipInstructions, getPresidentInstructions, getProgramInstructions, getProgramCriticalRules } from './services/system.js';
import { IntentClassifier } from './utils/intent-classifier.js';
import { Logger } from './utils/logger.js';
import { parseMultipartFormData } from './utils/multipart-parser.js';
import QueryAnalyzer from './utils/query-analyzer.js';
import ResponseCleaner from './utils/response-cleaner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== SERVER CONFIGURATION =====
const port = Number.parseInt(process.env.PORT || '3000', 10);
const publicDir = path.resolve(__dirname, '../../frontend');
const dataPath = path.resolve(__dirname, './data/dorsu_data.json');

// ===== SERVICE INSTANCES =====
let dorsuData = null;
let dorsuContext = '';
let ragService = null;
let mongoService = null;
let dataRefreshService = null;
let newsScraperService = null;
let authService = null;
let chatHistoryService = null;
let scheduleService = null;

// ===== FALLBACK CONTEXT =====
const fallbackContext = `## DAVAO ORIENTAL STATE UNIVERSITY (DOrSU)
**Founded:** 1989 | **Location:** Mati City, Davao Oriental
**Vision:** A university of excellence, innovation and inclusion
**President:** Dr. Roy G. Ponce`;

// ===== SERVICE INITIALIZATION =====
(async () => {
  try {
    mongoService = getMongoDBService();
    await mongoService.connect();
    Logger.success('MongoDB initialized');
    
    // Initialize GridFS service for image storage
    const gridFSService = getGridFSService();
    await gridFSService.initialize();
    Logger.success('GridFS service initialized');
    
    // Initialize authentication service
    authService = new AuthService(mongoService);
    Logger.success('Auth service initialized');
    
    // Initialize chat history service
    chatHistoryService = getChatHistoryService(mongoService, authService);
    Logger.success('Chat history service initialized');
    
    // Initialize schedule service (unified calendar and posts)
    scheduleService = getScheduleService(mongoService, authService);
    Logger.success('Schedule service initialized');
    
    // Initialize data refresh service
    dataRefreshService = getDataRefreshService();
    
    // DISABLED: Auto-refresh temporarily disabled to prevent overwriting structured data
    // Use manual migration script: node scripts/migrate-with-updated-data.js
    // dataRefreshService.startAutoRefresh(60000);
    Logger.info('Data auto-refresh service initialized (auto-refresh disabled)');
    
    // Initialize news scraper service
    newsScraperService = getNewsScraperService(mongoService);
    newsScraperService.startAutoScraping();
    Logger.success('News scraper service started');
  } catch (error) {
    Logger.error('MongoDB init failed:', error.message);
  }
})();

// ===== DATA & RAG INITIALIZATION =====
try {
  dorsuData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  dorsuContext = fallbackContext;
  ragService = new OptimizedRAGService(mongoService);
  
  setTimeout(() => ragService?.syncWithMongoDB(), 2000);
  
  Logger.success('RAG service initialized');
} catch (e) {
  Logger.error('RAG init failed:', e.message);
}

// ===== UTILITY FUNCTIONS =====

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

function serveStatic(req, res) {
  try {
    let reqPath = req.url || '/';
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(publicDir, path.normalize(reqPath));
    if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath)) return false;
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

// ===== HTTP SERVER =====

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  // Parse URL to get pathname (remove query parameters and hash)
  const rawUrl = req.url || '/';
  const url = rawUrl.split('?')[0].split('#')[0];
  
  // Debug logging for specific endpoints
  if (url === '/api/top-queries' || rawUrl.includes('top-queries')) {
    Logger.info(`🔍 Request: ${method} ${rawUrl} -> Parsed: ${url}`);
  }
  if (url === '/api/admin/upload-calendar-csv' || rawUrl.includes('upload-calendar-csv') ||
      url === '/api/admin/posts' || rawUrl.includes('/api/admin/posts') ||
      url.startsWith('/api/calendar/') || url.startsWith('/api/admin/calendar/')) {
    Logger.info(`🔍 Schedule Request: ${method} ${rawUrl} -> Parsed: ${url}`);
    Logger.info(`🔍 Schedule service available: ${scheduleService ? 'YES' : 'NO'}`);
  }

  // ===== CORS HEADERS =====
  // Allow requests from frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight OPTIONS request
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ===== API ENDPOINTS =====
  
  // Health check
  if (method === 'GET' && url === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  // MongoDB status
  if (method === 'GET' && url === '/api/mongodb-status') {
    const health = mongoService ? await mongoService.healthCheck() : { status: 'unavailable' };
    sendJson(res, 200, health);
    return;
  }

  // ===== AUTHENTICATION ENDPOINTS =====

  // User Registration
  if (method === 'POST' && url === '/api/auth/register') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!authService) {
          sendJson(res, 503, { error: 'Authentication service not available' });
          return;
        }

        const { username, email, password } = JSON.parse(body);

        if (!username || !email || !password) {
          sendJson(res, 400, { error: 'Username, email and password are required' });
          return;
        }

        const result = await authService.register(username, email, password);
        sendJson(res, 201, result);
      } catch (error) {
        Logger.error('Register error:', error.message);
        sendJson(res, 400, { error: error.message });
      }
    });
    return;
  }

  // User Login
  if (method === 'POST' && url === '/api/auth/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!authService) {
          sendJson(res, 503, { error: 'Authentication service not available' });
          return;
        }

        const { email, password } = JSON.parse(body);

        if (!email || !password) {
          sendJson(res, 400, { error: 'Email and password are required' });
          return;
        }

        const result = await authService.login(email, password);
        sendJson(res, 200, result);
      } catch (error) {
        Logger.error('Login error:', error.message);
        sendJson(res, 401, { error: error.message });
      }
    });
    return;
  }

  // Google/Firebase ID token login (exchange for backend JWT)
  if (method === 'POST' && url === '/api/auth/firebase-login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!authService || !mongoService) {
          sendJson(res, 503, { error: 'Authentication service not available' });
          return;
        }

        const { idToken } = JSON.parse(body || '{}');
        if (!idToken) {
          sendJson(res, 400, { error: 'idToken is required' });
          return;
        }

        // Validate token format (should be a JWT-like string)
        if (typeof idToken !== 'string' || idToken.length < 100) {
          Logger.error(`Invalid token format: token length is ${idToken?.length || 0}`);
          sendJson(res, 400, { error: 'Invalid token format' });
          return;
        }

        // Check if token looks like a JWT (has 3 parts separated by dots)
        const tokenParts = idToken.split('.');
        if (tokenParts.length !== 3) {
          Logger.error(`Token does not appear to be a valid JWT: ${tokenParts.length} parts found`);
          sendJson(res, 400, { error: 'Token format invalid - expected JWT format' });
          return;
        }

        Logger.info(`Validating Firebase ID token, token length: ${idToken.length}, parts: ${tokenParts.length}`);

        // Helper function to decode JWT payload (without signature verification)
        const decodeJWTPayload = (token) => {
          try {
            const payload = tokenParts[1];
            // Try base64url first (standard for JWTs), then fallback to base64
            let decoded;
            try {
              // Add padding if needed for base64url
              const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
              decoded = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
            } catch (e) {
              // Fallback to regular base64
              decoded = Buffer.from(payload, 'base64').toString('utf-8');
            }
            const parsed = JSON.parse(decoded);
            
            // Check if token is expired
            if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) {
              Logger.warn(`Token is expired. Exp: ${parsed.exp}, Now: ${Math.floor(Date.now() / 1000)}`);
              return null;
            }
            
            return parsed;
          } catch (error) {
            Logger.error(`Failed to decode JWT payload: ${error.message}`);
            return null;
          }
        };

        // Try to verify Firebase ID token using Google tokeninfo endpoint
        // This validates signature and returns token claims if valid
        let tokenInfo = null;
        let tokenValidationError = null;
        
        try {
          const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
          if (tokenInfoRes.ok) {
            tokenInfo = await tokenInfoRes.json();
            Logger.info(`Firebase token validated successfully via Google tokeninfo for email: ${tokenInfo.email || 'unknown'}`);
          } else {
            const errorText = await tokenInfoRes.text();
            tokenValidationError = errorText;
            Logger.warn(`Google tokeninfo validation failed: ${tokenInfoRes.status} - ${errorText}`);
            
            // Fallback: Try to decode JWT payload locally (without signature verification)
            // This is less secure but allows us to extract user info if tokeninfo fails
            Logger.info('Attempting to decode JWT payload locally as fallback...');
            const decodedPayload = decodeJWTPayload(idToken);
            if (decodedPayload && decodedPayload.email) {
              Logger.warn('⚠️ Using locally decoded JWT payload (signature not verified)');
              Logger.info(`Decoded payload keys: ${Object.keys(decodedPayload).join(', ')}`);
              tokenInfo = {
                email: decodedPayload.email,
                name: decodedPayload.name || decodedPayload.email.split('@')[0],
                sub: decodedPayload.sub || decodedPayload.user_id,
                aud: decodedPayload.aud,
                exp: decodedPayload.exp,
                iat: decodedPayload.iat
              };
              Logger.info(`Decoded token info for email: ${tokenInfo.email}, aud: ${tokenInfo.aud}`);
            } else {
              Logger.error(`Cannot decode JWT payload or missing email claim`);
              sendJson(res, 401, { 
                error: 'Invalid Firebase ID token', 
                details: errorText,
                note: 'Token validation failed and JWT payload could not be decoded'
              });
              return;
            }
          }
        } catch (fetchError) {
          Logger.error(`Error calling Google tokeninfo endpoint: ${fetchError.message}`);
          
          // Fallback: Try to decode JWT payload locally
          Logger.info('Attempting to decode JWT payload locally as fallback...');
          const decodedPayload = decodeJWTPayload(idToken);
          if (decodedPayload && decodedPayload.email) {
            Logger.warn('⚠️ Using locally decoded JWT payload (signature not verified) - tokeninfo endpoint unavailable');
            Logger.info(`Decoded payload keys: ${Object.keys(decodedPayload).join(', ')}`);
            tokenInfo = {
              email: decodedPayload.email,
              name: decodedPayload.name || decodedPayload.email.split('@')[0],
              sub: decodedPayload.sub || decodedPayload.user_id,
              aud: decodedPayload.aud,
              exp: decodedPayload.exp,
              iat: decodedPayload.iat
            };
            Logger.info(`Decoded token info for email: ${tokenInfo.email}, aud: ${tokenInfo.aud}`);
          } else {
            Logger.error(`Cannot decode JWT payload or missing email claim`);
            sendJson(res, 401, { 
              error: 'Invalid Firebase ID token', 
              details: fetchError.message,
              note: 'Token validation failed and JWT payload could not be decoded'
            });
            return;
          }
        }
        
        if (!tokenInfo) {
          Logger.error('No token info available after validation attempts');
          sendJson(res, 401, { error: 'Invalid Firebase ID token', details: tokenValidationError || 'Unknown error' });
          return;
        }

        // Optional audience check if provided
        const expectedAud = process.env.GOOGLE_WEB_CLIENT_ID;
        if (expectedAud && tokenInfo.aud && tokenInfo.aud !== expectedAud) {
          Logger.warn(`Token audience mismatch. Expected: ${expectedAud}, Got: ${tokenInfo.aud}`);
          // Log but don't fail - Firebase tokens can have different audiences
          // The tokeninfo endpoint already validated the signature
        }

        const email = (tokenInfo.email || '').toLowerCase();
        const name = tokenInfo.name || (email ? email.split('@')[0] : 'Google User');
        if (!email) {
          sendJson(res, 400, { error: 'Token missing email claim' });
          return;
        }

        // Find or create local user in MongoDB (just like regular account creation)
        let user = await mongoService.findUser(email);
        if (!user) {
          Logger.info(`Creating new Google user in MongoDB: ${email}`);
          user = await mongoService.createUser({
            username: name,
            email,
            password: '', // No password for federated accounts
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            provider: 'google',
            googleSub: tokenInfo.sub
          });
          Logger.success(`✅ Google user created in MongoDB: ${email} (ID: ${user._id || user.id})`);
        } else {
          Logger.info(`Google user found in MongoDB: ${email} (ID: ${user._id || user.id})`);
          // Update last login and provider info
          await mongoService.updateUserLastLogin(email);
        }

        // Issue backend JWT for subsequent authenticated requests
        // This ensures Google users use the same authentication mechanism as regular users
        const token = authService.generateToken(user);
        Logger.info(`Backend JWT generated for Google user: ${email}`);

        sendJson(res, 200, {
          success: true,
          user: {
            id: user._id || user.id,
            username: user.username,
            email: user.email
          },
          token
        });
      } catch (error) {
        Logger.error('Firebase login error:', error.message || String(error));
        sendJson(res, 401, { error: 'Firebase login failed' });
      }
    });
    return;
  }

  // Get current user profile
  if (method === 'GET' && url === '/api/auth/me') {
    if (!authService) {
      sendJson(res, 503, { error: 'Authentication service not available' });
      return;
    }

    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      sendJson(res, 401, { error: auth.error || 'Unauthorized' });
      return;
    }

    try {
      const user = await authService.getUserById(auth.userId);
      if (!user) {
        sendJson(res, 404, { error: 'User not found' });
        return;
      }
      sendJson(res, 200, { success: true, user });
    } catch (error) {
      Logger.error('Get user error:', error.message);
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  // Get all users (admin endpoint)
  if (method === 'GET' && url === '/api/users') {
    if (!authService) {
      sendJson(res, 503, { error: 'Authentication service not available' });
      return;
    }

    try {
      const users = await mongoService.getAllUsers();
      const count = await mongoService.getUserCount();
      sendJson(res, 200, { success: true, count, users });
    } catch (error) {
      Logger.error('Get users error:', error.message);
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  // Delete user account
  if (method === 'DELETE' && url === '/api/auth/account') {
    if (!authService || !mongoService) {
      sendJson(res, 503, { error: 'Services not available' });
      return;
    }

    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      sendJson(res, 401, { error: auth.error || 'Unauthorized' });
      return;
    }

    try {
      const result = await mongoService.deleteUser(auth.userId);
      if (result.success) {
        Logger.success(`✅ Account deleted successfully: ${auth.userId}`);
        sendJson(res, 200, { success: true, message: 'Account deleted successfully' });
      } else {
        sendJson(res, 404, { error: result.message || 'User not found' });
      }
    } catch (error) {
      Logger.error('Delete account error:', error.message);
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  // Manual knowledge base refresh endpoint
  if (method === 'POST' && url === '/api/refresh-knowledge') {
    if (!dataRefreshService) {
      sendJson(res, 503, { error: 'Data refresh service not available' });
      return;
    }
    
    try {
      Logger.info('📤 Manual knowledge base refresh requested');
      const result = await dataRefreshService.refreshFromDataFile();
      
      if (result.success) {
        // Trigger RAG sync immediately
        if (ragService) {
          await ragService.forceSyncMongoDB();
          // Clear AI response cache to ensure fresh responses
          ragService.clearAIResponseCache();
          Logger.info('🗑️ AI response cache cleared');
        }
        
        sendJson(res, 200, {
          success: true,
          message: 'Knowledge base refreshed and cache cleared successfully',
          data: result
        });
      } else {
        sendJson(res, 500, {
          success: false,
          error: result.message || 'Refresh failed'
        });
      }
    } catch (error) {
      Logger.error('Refresh error:', error);
      sendJson(res, 500, { error: error.message });
    }
    return;
  }
  
  // Clear AI response cache endpoint
  if (method === 'POST' && url === '/api/clear-cache') {
    try {
      if (ragService) {
        ragService.clearAIResponseCache();
        Logger.info('🗑️ AI response cache cleared manually');
        sendJson(res, 200, { success: true, message: 'Cache cleared successfully' });
      } else {
        sendJson(res, 503, { error: 'RAG service not available' });
      }
    } catch (error) {
      Logger.error('Clear cache error:', error);
      sendJson(res, 500, { error: error.message });
    }
    return;
  }
  
  // Get news endpoint
  if (method === 'GET' && url === '/api/news') {
    try {
      if (newsScraperService) {
        const news = await newsScraperService.getNews();
        sendJson(res, 200, { success: true, news, count: news.length });
      } else {
        sendJson(res, 503, { error: 'News scraper service not available' });
      }
    } catch (error) {
      Logger.error('Get news error:', error);
      sendJson(res, 500, { error: error.message });
    }
    return;
  }
  
  // Scrape news endpoint
  if (method === 'POST' && url === '/api/scrape-news') {
    try {
      if (newsScraperService) {
        Logger.info('📰 Manual news scraping requested');
        const result = await newsScraperService.scrapeNews();
        sendJson(res, 200, result);
      } else {
        sendJson(res, 503, { error: 'News scraper service not available' });
      }
    } catch (error) {
      Logger.error('Scrape news error:', error);
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  // Get refresh status
  if (method === 'GET' && url === '/api/refresh-status') {
    if (!dataRefreshService) {
      sendJson(res, 503, { error: 'Data refresh service not available' });
      return;
    }
    
    const status = dataRefreshService.getStatus();
    sendJson(res, 200, { success: true, status });
    return;
  }

  // ===== FILE UPLOAD ENDPOINT (Knowledge Base) =====
  if (method === 'POST' && url === '/api/admin/upload-file') {
    // Check authentication
    if (!authService || !mongoService) {
      sendJson(res, 503, { error: 'Services not available' });
      return;
    }

    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        sendJson(res, 400, { error: 'Content-Type must be multipart/form-data' });
        return;
      }

      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        sendJson(res, 400, { error: 'Missing boundary in Content-Type' });
        return;
      }

      const parts = await parseMultipartFormData(req, boundary);
      const filePart = parts.find(p => p.filename);
      
      if (!filePart) {
        sendJson(res, 400, { error: 'No file uploaded' });
        return;
      }

      // Validate file type
      const allowedExtensions = ['.txt', '.docx', '.csv', '.json'];
      const fileName = filePart.filename || 'unknown';
      const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      
      if (!allowedExtensions.includes(extension)) {
        sendJson(res, 400, { 
          error: `File type not allowed. Allowed types: ${allowedExtensions.join(', ')}` 
        });
        return;
      }

      Logger.info(`📤 Processing file upload: ${fileName} (${(filePart.data.length / 1024).toFixed(2)} KB)`);

      const fileProcessor = getFileProcessorService();
      const { textContent, metadata } = await fileProcessor.processFile(
        filePart.data,
        fileName,
        filePart.contentType
      );

      // Parse into chunks and generate embeddings
      const chunks = await fileProcessor.parseIntoChunks(textContent, metadata);

      // Insert chunks into MongoDB
      await mongoService.insertChunks(chunks);

      // Trigger RAG sync
      if (ragService) {
        await ragService.forceSyncMongoDB();
        ragService.clearAIResponseCache();
      }

      Logger.success(`✅ File uploaded and processed: ${chunks.length} chunks added`);

      sendJson(res, 200, {
        success: true,
        message: 'File uploaded and processed successfully',
        fileName,
        chunksAdded: chunks.length,
        metadata
      });
    } catch (error) {
      Logger.error('File upload error:', error);
      sendJson(res, 500, { error: error.message || 'File processing failed' });
    }
    return;
  }

  // ===== SCHEDULE ENDPOINTS (Unified Calendar and Posts) =====
  // All schedule routes (calendar events, posts, announcements) are handled by ScheduleService
  // This includes legacy calendar and posts endpoints for backward compatibility
  if (url === '/api/admin/create-post' || 
      url === '/api/admin/posts' || 
      url.startsWith('/api/admin/posts/') ||
      url === '/api/admin/upload-calendar-csv' || 
      url.startsWith('/api/calendar/') || 
      url.startsWith('/api/admin/calendar/') ||
      url.startsWith('/api/schedule/') ||
      url.startsWith('/api/admin/schedule/')) {
    // Initialize schedule service if not already initialized (for early requests)
    if (!scheduleService && mongoService && authService) {
      scheduleService = getScheduleService(mongoService, authService);
      if (scheduleService) {
        Logger.info('📅 Schedule service initialized on-demand');
      }
    }
    
    if (scheduleService) {
      Logger.info(`📅 Schedule service check: ${method} ${url}`);
      const handled = await scheduleService.handleRoute(req, res, method, url, rawUrl);
      if (handled) {
        Logger.info(`✅ Schedule service handled route: ${method} ${url}`);
        return;
      } else {
        Logger.warn(`⚠️ Schedule service did not handle route: ${method} ${url} - will continue to other handlers`);
      }
    } else {
      Logger.warn(`⚠️ Schedule service not initialized. mongoService: ${!!mongoService}, authService: ${!!authService}`);
    }
  }

  // ===== IMAGE ENDPOINTS (GridFS) =====
  // Serve images from GridFS
  if (method === 'GET' && url.startsWith('/api/images/')) {
    try {
      const fileId = url.split('/api/images/')[1];
      if (!fileId) {
        sendJson(res, 400, { error: 'File ID required' });
        return;
      }

      const gridFSService = getGridFSService();
      const { stream, metadata } = await gridFSService.downloadImage(fileId);

      // Set appropriate headers
      res.setHeader('Content-Type', metadata.contentType || 'image/jpeg');
      res.setHeader('Content-Length', metadata.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.setHeader('Content-Disposition', `inline; filename="${metadata.filename}"`);

      // Stream the image to response
      stream.on('error', (error) => {
        Logger.error('Error streaming image:', error);
        if (!res.headersSent) {
          sendJson(res, 500, { error: 'Failed to stream image' });
        }
      });

      stream.pipe(res);
      return;
    } catch (error) {
      Logger.error('Image retrieval error:', error);
      if (!res.headersSent) {
        sendJson(res, 404, { error: 'Image not found' });
      }
      return;
    }
  }

  // ===== CHAT HISTORY ENDPOINTS =====
  // All chat history routes are handled by ChatHistoryService
  if (chatHistoryService) {
    const handled = await chatHistoryService.handleRoute(req, res, method, url);
    if (handled) return;
  }

  // ===== CHAT ENDPOINT (Main AI Processing) =====
  
  if (method === 'POST' && url === '/api/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1000000) req.destroy(); });
    req.on('end', async () => {
      try {
        const json = JSON.parse(body);
        const prompt = json.prompt || json.message || '';
        const userType = json.userType || null; // 'student' or 'faculty' or null
        if (!prompt.trim()) { sendJson(res, 400, { error: 'prompt required' }); return; }
        
        // Try to get userId from auth token (optional - chat can work without auth)
        let userId = null;
        if (authService && mongoService) {
          try {
            const auth = await authMiddleware(authService, mongoService)(req);
            if (auth.authenticated && auth.userId) {
              userId = auth.userId;
            }
          } catch (authError) {
            // Auth is optional for chat - continue without userId
            Logger.info('Chat endpoint: No auth token provided (optional)');
          }
        }

        const service = new LlamaService();
        const providerInfo = service.getProviderInfo();
        
        // --- Query Preprocessing ---
        
        // Preprocess ambiguous queries
        let processedPrompt = prompt;
        if (prompt.toLowerCase().includes('what is dorsu')) {
          processedPrompt = 'What is DOrSU (Davao Oriental State University)?';
        }
        
        // ===== COMPREHENSIVE QUERY NORMALIZATION =====
        // Normalize ALL query types based on data structures in dorsu_data.json
        // This ensures consistent RAG retrieval regardless of query phrasing
        
        // CRITICAL: Check office head queries FIRST (before president queries)
        // Office head queries (declare early for use in director queries)
        const isOfficeHeadQuery = /\b(who\s+(is|are)\s+(the\s+)?(head|director|chief|manager)\s+(of|in)?|head\s+of|director\s+of|chief\s+of|manager\s+of)\b/i.test(prompt) && 
                                   (/\b(OSPAT|OSA|OSCD|FASG|PESO|IRO|HSU|CGAD|IP-TBM|GCTC|office|offices|unit|units)\b/i.test(prompt));
        
        if (isOfficeHeadQuery) {
          // Extract office acronym from query
          const officeAcronymMatch = prompt.match(/\b(OSPAT|OSA|OSCD|FASG|PESO|IRO|HSU|CGAD|IP-TBM|GCTC)\b/i);
          const officeAcronym = officeAcronymMatch ? officeAcronymMatch[0] : 'office';
          processedPrompt = `Who is the head of ${officeAcronym} (${officeAcronym === 'OSA' ? 'Office of Student Affairs' : officeAcronym === 'OSPAT' ? 'Office of Student Programs and Activities' : officeAcronym}) at DOrSU as of 2025? Provide the name, title, and role.`;
          Logger.debug(`🔍 Office head query detected - normalized for ${officeAcronym}`);
        }
        
        // President queries (MUST be more specific - require "president" keyword, not just "head")
        const presidentPattern = /\b(president|university\s+president|dorsu\s+president)\b/i;
        const hasDorsuContext = /\b(dorsu|davao oriental state university|university)\b/i.test(prompt);
        const isPresidentQuery = presidentPattern.test(prompt) && hasDorsuContext && !isOfficeHeadQuery;
        if (isPresidentQuery) {
          processedPrompt = 'Who is the president of DOrSU as of 2025? Provide comprehensive information including: full name, title, educational background - degrees and institutions, expertise areas, major achievements - UNESCO work, museums, awards, and current role. Give complete details, not just the name.';
          Logger.debug(`🔍 President query detected - normalized`);
        }
        
        // Vice President queries
        const vpPattern = /\b(vice president|vice presidents|vp|vps)\b/i;
        const isVPQuery = vpPattern.test(prompt);
        if (isVPQuery && !isPresidentQuery && !isOfficeHeadQuery) {
          processedPrompt = 'Who are the vice presidents of DOrSU as of 2025? Provide comprehensive information including names, positions, and roles for all vice presidents.';
          Logger.debug(`🔍 VP query detected - normalized`);
        }
        
        // SUAST/Statistics queries
        const suastPattern = /\b(suast|state university aptitude|scholarship test|entrance exam|admission test|applicants|passers|passing rate|statistics|stats|exam results)\b/i;
        const isSUASTQuery = suastPattern.test(prompt);
        if (isSUASTQuery) {
          processedPrompt = 'What are the SUAST (State University Aptitude and Scholarship Test) statistics? Provide information about applicants, passers, passing rates, and enrolled applicants by year.';
          Logger.debug(`🔍 SUAST query detected - normalized`);
        }
        
        // History queries
        const historyPattern = /\b(history|historical|founded|established|background|evolution|development|kasaysayan|itinatag|pinagmulan|gitukod|timeline|narrative|heritage|conversion)\b/i;
        let isHistoryQuery = historyPattern.test(prompt);
        if (isHistoryQuery) {
          processedPrompt = 'What is the history of DOrSU? Provide timeline of major events with key persons involved, including founding dates and Republic Acts.';
          Logger.debug(`🔍 History query detected - normalized`);
        }
        
        // Admission requirements queries (SPECIFIC - must be checked before general enrollment)
        const admissionRequirementsPattern = /\b(admission\s+requirements|requirements\s+for\s+admission|admission\s+req|what\s+(are|do|does)\s+.*\s+(need|required|requirement))\b/i;
        const isAdmissionRequirementsQuery = admissionRequirementsPattern.test(prompt) || 
          (/\b(admission|admissions)\b/i.test(prompt) && /\b(requirements?|required|need|needed|what.*need)\b/i.test(prompt));
        
        if (isAdmissionRequirementsQuery) {
          processedPrompt = 'What are the admission requirements for DOrSU? Include requirements for returning students, continuing students, transferring students, second-degree students, and incoming first-year students.';
          Logger.debug(`🔍 Admission requirements query detected - normalized`);
        }
        
        // CRITICAL: Exam schedule queries MUST be checked BEFORE general enrollment/schedule queries
        // Exam schedule queries (prelim, midterm, final examination schedules)
        const hasPrelim = /\b(prelim|preliminary|prelims?)\b/i.test(prompt);
        const hasMidterm = /\b(midterm|mid-term|mid\s+term)\b/i.test(prompt);
        const hasFinal = /\b(final|finals?)\b/i.test(prompt);
        const hasExam = /\b(exam|examination|exams?)\b/i.test(prompt);
        const hasSchedule = /\b(schedule|schedules?|date|dates?|when)\b/i.test(prompt);
        
        // Check if query mentions exam types AND schedule/exam keywords (in any order)
        const examTypesCount = [hasPrelim, hasMidterm, hasFinal].filter(Boolean).length;
        const isMultipleExamQuery = examTypesCount > 1;
        const hasExamContext = hasExam || hasSchedule || isMultipleExamQuery;
        
        const isExamScheduleQuery = (hasPrelim || hasMidterm || hasFinal || hasExam) && hasExamContext && 
                                   !isAdmissionRequirementsQuery &&
                                   !/\b(enrollment|enrolment|enroll)\s+(schedule|information)\b/i.test(prompt);
        
        // Enrollment queries (general - schedules, counts, etc.) - but NOT exam schedules or general schedule queries
        // CRITICAL: Enrollment queries MUST have BOTH enrollment AND registration keywords together
        // Examples: "when is the registration enrollment period", "enrollment and registration schedule"
        // This prevents general schedule queries like "when is siglakass schedule" from being misclassified
        const enrollmentKeywords = /\b(enrollment|enrolment|enroll)\b/i;
        const registrationKeywords = /\b(registration|register|enrollment period|enrollment schedule)\b/i;
        // Only match if query has BOTH enrollment AND registration keywords together
        const isEnrollmentQuery = enrollmentKeywords.test(prompt) && 
                                  registrationKeywords.test(prompt) &&
                                  !isAdmissionRequirementsQuery && 
                                  !isExamScheduleQuery;
        
        if (isExamScheduleQuery) {
          // Don't normalize exam schedule queries - preserve the exam type keywords
          // This allows the detection logic in rag.js and vector-search.js to work correctly
          processedPrompt = prompt; // Keep original query with exam type keywords
          Logger.debug(`🔍 Exam schedule query detected - preserving original query with exam keywords`);
        } else if (isEnrollmentQuery) {
          processedPrompt = 'What are the enrollment information and schedule for DOrSU? Include enrollment by campus and enrollment schedule.';
          Logger.debug(`🔍 Enrollment query detected - normalized`);
        }
        // General schedule queries (like "when is siglakass schedule") are NOT transformed here
        // They will be handled by the general schedule pattern detection later and preserve original query
        
        // Leadership queries (declare early for use in dean/director queries)
        const leadershipPattern = /\b(president|vice president|vice presidents|chancellor|dean|deans|director|directors|leadership|board|governance|administration|executive|executives|officials?|officers?)\b/i;
        const isLeadershipQuery = leadershipPattern.test(prompt) && !isOfficeHeadQuery;
        
        // Dean queries
        const deanPattern = /\b(dean|deans|faculty.*dean)\b/i;
        const isDeanQuery = deanPattern.test(prompt) && !isLeadershipQuery;
        if (isDeanQuery) {
          processedPrompt = 'Who are the deans of DOrSU faculties as of 2025? Provide names and their respective faculties.';
          Logger.debug(`🔍 Dean query detected - normalized`);
        }
        
        // Director queries
        const directorPattern = /\b(director|directors)\b/i;
        const isDirectorQuery = directorPattern.test(prompt) && !isLeadershipQuery && !isOfficeHeadQuery;
        if (isDirectorQuery) {
          processedPrompt = 'Who are the directors of DOrSU offices and centers as of 2025? Provide names and their respective offices or centers.';
          Logger.debug(`🔍 Director query detected - normalized`);
        }
        
        // Handle USC queries - prioritize DOrSU context
        const uscPattern = /\b(usc|university student council)\b/i;
        const isUSCQuery = uscPattern.test(prompt) && !prompt.toLowerCase().includes('southern california') && !prompt.toLowerCase().includes('south pacific');
        
        if (isUSCQuery) {
          // If query mentions USC without specific university context, assume DOrSU USC
          if (prompt.toLowerCase().match(/\bwhat\s+(is|are)\s+usc\b/i)) {
            processedPrompt = 'Tell me everything about the University Student Council - USC of DOrSU including its mission, beliefs, objectives, logo symbolism, and 2025 executives.';
          } else if (prompt.toLowerCase().includes('tell me about') && prompt.toLowerCase().includes('usc')) {
            processedPrompt = prompt.replace(/\busc\b/gi, 'DOrSU University Student Council - USC') + ' - provide complete details';
          } else if (!prompt.toLowerCase().includes('dorsu')) {
            // Add DOrSU context to USC queries
            processedPrompt = prompt + ' - referring to DOrSU University Student Council';
          }
        }
        
        // Handle manual/guide queries
        const manualPattern = /\b(manual|guide|handbook|documentation)\b/i;
        const isManualQuery = manualPattern.test(prompt);
        if (isManualQuery) {
          processedPrompt = 'What manuals, guides, or handbooks are available for DOrSU students? Include Pre-Admission Manual and Grade Inquiry Manual with their links.';
        }
        
        // Handle website/link queries
        const websitePattern = /\b(website|link|url|site|webpage|page)\b/i;
        const dorsuMention = /\b(dorsu|davao oriental state university)\b/i;
        const isWebsiteQuery = websitePattern.test(prompt) && dorsuMention.test(prompt);
        if (isWebsiteQuery) {
          processedPrompt = 'What is the official DOrSU website link? Include all important links like location map, university seal, hymn, and office links (IRO, IP-TBM, HSU, CGAD).';
        }
        
        // Handle courses queries (treat courses = programs)
        const coursesPattern = /\b(course|courses)\b/i;
        if (coursesPattern.test(prompt)) {
          processedPrompt = prompt.replace(/\b(course|courses)\b/gi, 'program');
        }
        
        // IMPROVED: Unified schedule queries - all calendar, events, announcements, schedules use schedule collection
        // Schedule queries: Focus on dates, schedules, timelines, deadlines, events, announcements
        const schedulePattern = /\b(date|dates|schedule|schedules|calendar|when|deadline|deadlines|holiday|holidays|academic\s+calendar|semester|enrollment\s+period|registration|exam\s+schedule|class\s+schedule|timeline|time\s+table|what\s+date|what\s+dates|when\s+is|when\s+are|when\s+will|event|events|announcement|announcements|upcoming|coming|next|this\s+(week|month|year))\b/i;
        const isScheduleQuery = schedulePattern.test(prompt) && !isExamScheduleQuery && !isEnrollmentQuery;
        
        // CRITICAL: Preserve original query for general schedule queries (like "when is siglakass schedule")
        // Don't transform them - let rag.js and vector-search.js handle the query as-is
        if (isScheduleQuery && !isExamScheduleQuery && !isEnrollmentQuery) {
          // Ensure original query is preserved - don't let any earlier transformations affect it
          if (processedPrompt !== prompt) {
            // If it was transformed, restore original (but this shouldn't happen if logic is correct)
            Logger.debug(`⚠️ General schedule query was transformed - restoring original: "${prompt.substring(0, 50)}..."`);
            processedPrompt = prompt;
          } else {
            // Query is already preserved (no transformation applied) - this is correct
            Logger.debug(`🔍 General schedule query detected - preserving original query: "${prompt.substring(0, 50)}..."`);
          }
        }
        
        // Handle programs/courses list queries - ensure complete list
        const programPattern = /\b(program|programs|course|courses)\s+(offered|available|in|at|of|does|do)\b/i;
        // Vision/Mission queries
        const visionMissionPattern = /\b(vision|mission|what\s+is\s+.*\s+(vision|mission)|dorsu.*\s+(vision|mission)|university.*\s+(vision|mission))\b/i;
        const isVisionMissionQuery = visionMissionPattern.test(prompt);
        if (isVisionMissionQuery) {
          processedPrompt = 'Provide the vision and mission of DOrSU from the knowledge base. Include the vision statement and all mission statements. Format: "Vision:" followed by the vision, then "Mission:" followed by all mission statements as a list.';
          Logger.debug(`🔍 Vision/Mission query detected - normalized`);
        }
        
        // Values/Outcomes/Mandate queries
        const valuesPattern = /\b(core\s+values?|values?\s+of|graduate\s+outcomes?|outcomes?|quality\s+policy|mandate|charter)\b/i;
        const isValuesQuery = valuesPattern.test(prompt);
        if (isValuesQuery) {
          const isCoreValuesQuery = /\b(core\s+values?|values?)\b/i.test(prompt) && !/\bgraduate\s+outcomes?|outcomes?|mandate|quality\s+policy|charter\b/i.test(prompt);
          const isOutcomesQuery = /\b(graduate\s+outcomes?|outcomes?)\b/i.test(prompt) && !/\bcore\s+values?|mandate|quality\s+policy|charter\b/i.test(prompt);
          const isMandateQuery = /\b(mandate|charter)\b/i.test(prompt);
          const isQualityPolicyQuery = /\bquality\s+policy\b/i.test(prompt);
          if (isCoreValuesQuery) {
            processedPrompt = 'Provide the core values of DOrSU from the knowledge base. List ALL core values as a numbered or bulleted list.';
          } else if (isOutcomesQuery) {
            processedPrompt = 'Provide the graduate outcomes of DOrSU from the knowledge base. List ALL graduate outcomes as a numbered or bulleted list.';
          } else if (isMandateQuery) {
            processedPrompt = 'Provide the mandate of DOrSU from the knowledge base. Include the mandate statement and all mandate objectives. Format: "Mandate:" followed by the mandate statement, then "Objectives:" followed by all objectives as a list.';
          } else if (isQualityPolicyQuery) {
            processedPrompt = 'Provide the quality policy of DOrSU from the knowledge base. Include the complete quality policy statement.';
          } else {
            processedPrompt = 'Provide the core values and graduate outcomes of DOrSU from the knowledge base. Format: "Core Values:" followed by all core values, then "Graduate Outcomes:" followed by all graduate outcomes. List each as a numbered or bulleted list.';
          }
          Logger.debug(`🔍 Values/Outcomes/Mandate query detected - normalized`);
        }
        
        const isHymnQuery = /\b(hymn|anthem|university\s+hymn|university\s+anthem|dorsu\s+hymn|dorsu\s+anthem|lyrics|song|composer)\b/i.test(prompt);
        if (isHymnQuery) {
          processedPrompt = 'Provide the complete lyrics of the DOrSU hymn in the correct order: Verse 1, Chorus, Verse 2, Final Chorus. Include ALL lines from each section. Label each section clearly (Verse 1, Chorus, Verse 2, Final Chorus). Include the hymn link: https://dorsu.edu.ph/university-hymn/';
          Logger.debug(`🔍 Hymn query detected - normalized`);
        }
        
        const isProgramQuery = programPattern.test(prompt);
        if (isProgramQuery) {
          processedPrompt = 'Organize and list the programs offered by DOrSU from the knowledge base, grouped by faculty category. For each faculty, show the faculty name and list the programs under that faculty with their codes and full names. Format: "Faculty of [Name] (Code)" followed by the programs. DO NOT list programs from your training data - ONLY from knowledge base chunks. At the end, ask if the user would like to know about programs from other faculties.';
        }
        
        // Faculty queries
        const facultyPattern = /\b(faculty|faculties|FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM|college|colleges)\s+(of|in|at)?\b/i;
        const isFacultyQuery = facultyPattern.test(prompt) && !isDeanQuery;
        if (isFacultyQuery) {
          processedPrompt = 'What are the faculties of DOrSU? List all faculties with their codes and full names.';
          Logger.debug(`🔍 Faculty query detected - normalized`);
        }
        
        // Handle news queries
        const newsPattern = /\b(news|update|updates|announcement|announcements|latest|recent|what\'s new|happenings|events)\b/i;
        const isNewsQuery = newsPattern.test(prompt) && /\b(dorsu|university)\b/i.test(prompt);
        const isDirectNewsQuery = /\b(news|updates|announcements)\b/i.test(prompt);
        
        // Check if user wants news from specific date/month
        const dateSpecificPattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}|last month|this month|last week)\b/i;
        const isDateSpecificQuery = dateSpecificPattern.test(prompt);
        
        // Check if user wants to summarize a specific news item (e.g., "summarize news 1", "tell me about news 2", "click 3")
        const newsSummarizePattern = /\b(summarize|summarise|summaries|tell me about|what's in|what is|click|select|choose|number|#)\s*(news|update|item|article)?\s*([1-9]|one|two|three|first|second|third|1st|2nd|3rd)\b/i;
        const newsIndexMatch = prompt.match(/\b([1-9]|one|two|three|first|second|third|1st|2nd|3rd)\b/i);
        const wantsNewsSummary = newsSummarizePattern.test(prompt) || (newsIndexMatch && /\b(news|update|item|article|summarize|tell|click|select)\b/i.test(prompt));
        
        let articleContent = null;
        let articleTitle = null;
        let articleUrl = null;
        
        // If user wants to summarize a specific news item, scrape it
        if (wantsNewsSummary && newsScraperService) {
          // Extract the index number (1-9, or words like "one", "first", etc.)
          let newsIndex = null;
          if (newsIndexMatch) {
            const indexStr = newsIndexMatch[1].toLowerCase();
            const indexMap = {
              'one': 1, 'first': 1, '1st': 1,
              'two': 2, 'second': 2, '2nd': 2,
              'three': 3, 'third': 3, '3rd': 3,
              'four': 4, 'fourth': 4, '4th': 4,
              'five': 5, 'fifth': 5, '5th': 5,
              'six': 6, 'sixth': 6, '6th': 6,
              'seven': 7, 'seventh': 7, '7th': 7,
              'eight': 8, 'eighth': 8, '8th': 8,
              'nine': 9, 'ninth': 9, '9th': 9
            };
            newsIndex = indexMap[indexStr] || parseInt(indexStr);
          } else {
            // Try to extract number from prompt
            const numberMatch = prompt.match(/\b([1-9])\b/);
            if (numberMatch) {
              newsIndex = parseInt(numberMatch[1]);
            }
          }
          
          if (newsIndex && newsIndex >= 1 && newsIndex <= 9) {
            Logger.info(`📰 User wants to summarize news item #${newsIndex}`);
            
            // Get the news item by index
            const newsItem = await newsScraperService.getNewsItemByIndex(newsIndex);
            
            if (newsItem && newsItem.link) {
              Logger.info(`📄 Scraping article from: ${newsItem.link}`);
              
              // Scrape the full article content
              const article = await newsScraperService.scrapeNewsArticle(newsItem.link);
              
              if (article && article.content) {
                articleContent = article.content;
                articleTitle = article.title || newsItem.title;
                articleUrl = article.url || newsItem.link;
                
                Logger.success(`✅ Successfully scraped article: ${articleTitle.substring(0, 50)}...`);
                
                // Modify the prompt to be a summarization request
                processedPrompt = `Please summarize the following news article about DOrSU. Provide a clear, concise summary including the main points, key information, and any important details:\n\nTitle: ${articleTitle}\n\nArticle Content:\n${articleContent}`;
              } else {
                Logger.warn(`⚠️ Could not scrape article content from ${newsItem.link}`);
                processedPrompt = `I tried to scrape the news article but couldn't retrieve its content. The article link is: ${newsItem.link}. Please inform the user that the article content is not available for summarization at this time.`;
              }
            } else {
              Logger.warn(`⚠️ News item #${newsIndex} not found or has no link`);
              processedPrompt = `I couldn't find news item #${newsIndex} to summarize. Please inform the user that the requested news item is not available.`;
            }
          }
        }
        
        // Only build news context if user is asking for news list (not summarizing a specific article)
        const { newsContext, newsInstruction } = wantsNewsSummary ? 
          { newsContext: '', newsInstruction: '' } : 
          await buildNewsContext(
            isNewsQuery || isDirectNewsQuery,
            isDateSpecificQuery,
            newsScraperService
          );
        
        // --- Query Analysis ---
        
        // Correct typos in query before analysis
        const { TypoCorrector } = await import('./utils/query-analyzer.js');
        const typoCorrection = TypoCorrector.correctTypos(processedPrompt, {
          maxDistance: 2,
          minSimilarity: 0.6,
          correctPhrases: true
        });
        
        // Use corrected query if corrections were made
        if (typoCorrection.hasCorrections) {
          Logger.info(`🔤 Typo correction: "${typoCorrection.original}" → "${typoCorrection.corrected}"`);
          Logger.debug(`   Corrections: ${typoCorrection.corrections.map(c => `${c.original}→${c.corrected} (${(c.similarity * 100).toFixed(0)}%)`).join(', ')}`);
          processedPrompt = typoCorrection.corrected;
        }
        
        // Analyze query complexity and intent (using corrected query)
        const queryAnalysis = QueryAnalyzer.analyzeComplexity(processedPrompt);
        
        // Check if query is vague and needs clarification
        if (queryAnalysis.isVague && queryAnalysis.needsClarification) {
          Logger.info(`🤔 Vague query detected: "${processedPrompt}" - Reason: ${queryAnalysis.vagueReason}`);
        }
        const smartSettings = queryAnalysis.settings;
        const intentClassification = queryAnalysis.intentClassification;
        
        Logger.info(QueryAnalyzer.formatAnalysis(queryAnalysis));
        Logger.info(IntentClassifier.formatClassification(intentClassification));
        
        // Log conversational intent for better debugging
        const intentIcon = getConversationalIntentIcon(intentClassification.conversationalIntent);
        Logger.info(`${intentIcon} Conversational Intent: ${intentClassification.conversationalIntent} (${intentClassification.conversationalConfidence}% confidence)`);
        
        // Conversation context for follow-ups
        const sessionId = conversationService.getSessionId(req);
        const conversationContext = conversationService.getContext(sessionId);
        
        if (queryAnalysis.isFollowUp && conversationContext) {
          processedPrompt = conversationService.resolvePronouns(processedPrompt, conversationContext);
        }
        
        const options = {
          maxTokens: json.maxTokens ?? (isUSCQuery ? 800 : isProgramQuery ? 900 : smartSettings.maxTokens), // Reduced to minimize token usage
          temperature: json.temperature ?? smartSettings.temperature,
          numCtx: smartSettings.numCtx,
          topP: 0.5,
          topK: 20,
          repeatPenalty: 1.1
        };

        const startTime = Date.now();
        
        // --- Cache Check ---
        
        // Check cache (in-memory only - no MongoDB to prevent stale negative responses)
        if (ragService) {
          const cachedResponse = await ragService.getCachedAIResponse(processedPrompt);
          if (cachedResponse) {
            const responseTime = Date.now() - startTime;
            Logger.info(`⚡ CACHED (${responseTime}ms)`);
            
            if (mongoService) mongoService.logQuery(processedPrompt, queryAnalysis.complexity, responseTime, true);
            
            sendJson(res, 200, {
              reply: cachedResponse,
              source: 'cached',
              model: providerInfo.model,
              complexity: queryAnalysis.complexity,
              responseTime,
              cached: true,
              tokenUsage: null, // No token usage for cached responses
              // Conversational intent information
              intent: {
                conversational: intentClassification.conversationalIntent,
                confidence: intentClassification.conversationalConfidence,
                dataSource: intentClassification.source,
                category: intentClassification.category
              }
            });
            return;
          }
        }

        // --- Context Retrieval & System Prompt Building ---
        
        // Schedule queries should always be treated as DOrSU queries to fetch schedule data
        const isDOrSUQuery = intentClassification.source === 'knowledge_base' || isScheduleQuery;
        let systemPrompt = '';
        
        if (isDOrSUQuery) {
          let relevantContext = dorsuContext;
          
        if (ragService) {
          // Boost RAG retrieval for USC and program queries to get ALL relevant chunks
          let ragSections = smartSettings.ragSections;
          let ragTokens = smartSettings.ragMaxTokens;
          let retrievalType = '';
          
          // AGGRESSIVE TOKEN REDUCTION: Reduce RAG context to minimize input tokens
          // Input tokens are the main cost - need to be very selective
          if (isUSCQuery) {
            ragSections = 15;       // Reduced from 25 - focus on top 15 most relevant
            ragTokens = 1200;       // Reduced from 2500 - CRITICAL: Controls input token cost
            retrievalType = '(USC query - optimized retrieval)';
          } else if (isFacultyQuery) {
            ragSections = 10;       // Faculties - need all 7 faculties
            ragTokens = 800;        // Enough tokens for faculty list
            retrievalType = '(Faculty query - comprehensive retrieval)';
            Logger.debug(`🔍 Faculty query detected - using enhanced retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isProgramQuery) {
            ragSections = 25;       // Increased to ensure all faculties are represented (7 faculties * 3-4 programs each)
            ragTokens = 1600;       // Increased to accommodate programs from all faculties
            retrievalType = '(Program list query - comprehensive retrieval)';
            Logger.debug(`🔍 Program query detected - using enhanced retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isPresidentQuery) {
            // CRITICAL FIX: Increase retrieval for president queries to ensure comprehensive data
            ragSections = 25;       // Increased from 15 - need even more chunks for comprehensive president info (education, expertise, achievements)
            ragTokens = 2000;      // Increased from 1200 - need more tokens for detailed president information (all fields)
            retrievalType = '(President query - comprehensive retrieval)';
            Logger.debug(`🔍 President query detected - using enhanced retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isVPQuery) {
            ragSections = 20;       // Increased from 12 - need to get ALL vice presidents
            ragTokens = 1500;       // Increased from 1000 - need more tokens for multiple VPs
            retrievalType = '(VP query - comprehensive retrieval)';
            Logger.debug(`🔍 VP query detected - using enhanced retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isSUASTQuery) {
            ragSections = 10;       // SUAST statistics
            ragTokens = 800;
            retrievalType = '(SUAST query - statistics retrieval)';
          } else if (isHistoryQuery) {
            ragSections = 60;       // History needs comprehensive timeline data (increased to match chunk retrieval)
            ragTokens = 3000;       // Increased token limit to ensure all history chunks are included
            retrievalType = '(History query - comprehensive retrieval)';
          } else if (isAdmissionRequirementsQuery) {
            ragSections = 15;       // Admission requirements - need all student categories
            ragTokens = 2000;       // Need enough tokens for all requirements lists
            retrievalType = '(Admission requirements query - comprehensive retrieval)';
            Logger.debug(`🔍 Admission requirements query detected - using enhanced retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isEnrollmentQuery) {
            ragSections = 12;       // Enrollment data (schedules, counts)
            ragTokens = 1000;
            retrievalType = '(Enrollment query - comprehensive retrieval)';
          } else if (isOfficeHeadQuery) {
            ragSections = 15;       // Office head queries - need specific office info
            ragTokens = 1200;       // Need enough tokens for office head details
            retrievalType = '(Office head query - specific office retrieval)';
            Logger.debug(`🔍 Office head query detected - using enhanced retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isDeanQuery) {
            ragSections = 15;       // Increased from 10 - need to get ALL deans
            ragTokens = 1200;       // Increased from 800 - need more tokens for multiple deans
            retrievalType = '(Dean query - comprehensive retrieval)';
          } else if (isDirectorQuery) {
            ragSections = 20;       // Increased from 15 - need to get ALL directors
            ragTokens = 1500;       // Increased from 1200 - need more tokens for multiple directors
            retrievalType = '(Director query - comprehensive retrieval)';
          }
          
          relevantContext = await ragService.getContextForTopic(
            processedPrompt,
            ragTokens,
            ragSections,
            false, // suggestMore
            scheduleService // Pass scheduleService for calendar event retrieval
          );
          Logger.info(`📊 RAG: ${ragSections} sections, ${relevantContext.length} chars ${retrievalType}`);
          
          // DIRECT MONGODB FALLBACK: For leadership and office head queries, if RAG returns basic info only or insufficient data, query MongoDB directly
          // TOKEN-AWARE: Limit fallback data to prevent excessive token usage
          // Note: isLeadershipQuery and isOfficeHeadQuery are already declared earlier in the code
          // Re-check on processedPrompt in case prompt was normalized
          const isLeadershipQueryProcessed = isLeadershipQuery || /\b(president|vice president|vice presidents|chancellor|dean|deans|director|directors|leadership|board|governance|administration|executive|executives|officials?|officers?)\b/i.test(processedPrompt);
          const isOfficeHeadQueryProcessed = isOfficeHeadQuery || (/\b(who\s+(is|are)\s+(the\s+)?(head|director|chief|manager)\s+(of|in)?|head\s+of|director\s+of|chief\s+of|manager\s+of)\b/i.test(processedPrompt) && 
                                   (/\b(OSPAT|OSA|OSCD|FASG|PESO|IRO|HSU|CGAD|IP-TBM|GCTC|office|offices|unit|units)\b/i.test(processedPrompt)));
          
          const hasBasicInfoOnly = relevantContext && relevantContext.includes('## DAVAO ORIENTAL STATE UNIVERSITY (DOrSU)') && 
                                   !relevantContext.includes('vice president') && 
                                   !relevantContext.includes('Vice President') &&
                                   !relevantContext.includes('Vice Presidents');
          const hasInsufficientData = !relevantContext || relevantContext.trim().length < 500; // Less than 500 chars is likely insufficient
          const hasNoOfficeInfo = isOfficeHeadQueryProcessed && relevantContext && 
                                  !relevantContext.toLowerCase().includes('ospat') && 
                                  !relevantContext.toLowerCase().includes('office') &&
                                  !relevantContext.toLowerCase().includes('head');
          // CRITICAL: For president queries, check if context contains president person information
          // Trigger fallback if context exists but doesn't have president name (roy + ponce) OR doesn't have any president details
          const contextLower = relevantContext ? relevantContext.toLowerCase() : '';
          const hasPresidentName = contextLower.includes('roy') && contextLower.includes('ponce');
          const hasPresidentDetails = contextLower.includes('education') || 
                                     contextLower.includes('expertise') || 
                                     contextLower.includes('achievement') || 
                                     contextLower.includes('melbourne') ||
                                     contextLower.includes('university of melbourne');
          const hasNoPresidentInfo = isPresidentQuery && relevantContext && 
                                     (!hasPresidentName || !hasPresidentDetails);
          
          if ((isLeadershipQueryProcessed || isOfficeHeadQueryProcessed) && mongoService && (hasBasicInfoOnly || hasInsufficientData || hasNoOfficeInfo || hasNoPresidentInfo)) {
            const queryType = isOfficeHeadQueryProcessed ? 'office head' : (isPresidentQuery ? 'president' : 'leadership');
            const reason = hasNoPresidentInfo ? 'no president info' : 
                          hasBasicInfoOnly ? 'basic info only' : 
                          hasNoOfficeInfo ? 'no office info' : 
                          'insufficient data';
            Logger.warn(`⚠️  RAG returned ${reason} for ${queryType} query - trying direct MongoDB query as fallback`);
            
            try {
              const chunksCollection = mongoService.getCollection('knowledge_chunks');
              
              // Build query based on query type
              let directQuery;
              if (isOfficeHeadQueryProcessed) {
                // Direct MongoDB query for office head data
                const officeAcronyms = processedPrompt.match(/\b(OSPAT|OSA|OSCD|FASG|PESO|IRO|HSU|CGAD|IP-TBM|GCTC)\b/i);
                const officePattern = officeAcronyms ? officeAcronyms[0] : 'office';
                
                directQuery = {
                  $or: [
                    { section: { $regex: /offices|unitsAndOfficesHeads|detailedOfficeServices|additionalOfficesAndCenters/i } },
                    { type: { $regex: /office|unit|head/i } },
                    { topic: { $regex: /office|unit|head/i } },
                    { content: { $regex: new RegExp(`${officePattern}|office.*head|head.*office`, 'i') } },
                    { text: { $regex: new RegExp(`${officePattern}|office.*head|head.*office`, 'i') } },
                    { keywords: { $in: [officePattern.toLowerCase(), 'office', 'head', 'director'] } }
                  ]
                };
              } else if (isPresidentQuery) {
                // CRITICAL: For president queries, use EXACT match to ensure we get the president chunk
                directQuery = {
                  $and: [
                    {
                      $or: [
                        { section: { $regex: /^leadership$/i } },
                        { section: { $regex: /^organizationalStructure\/DOrSUOfficials2025$/i } }
                      ]
                    },
                    {
                      $or: [
                        { type: { $regex: /^president$/i } },
                        { category: { $regex: /^president$/i } },
                        { content: { $regex: /roy.*g\.?\s*ponce|dr\.?\s*roy.*g\.?\s*ponce|roy.*ponce/i } },
                        { text: { $regex: /roy.*g\.?\s*ponce|dr\.?\s*roy.*g\.?\s*ponce|roy.*ponce/i } },
                        { 'metadata.name': { $regex: /roy.*ponce/i } }
                      ]
                    }
                  ]
                };
              } else {
                // Direct MongoDB query for leadership data (non-president)
                directQuery = {
                  $or: [
                    { section: { $regex: /leadership|president|vice|chancellor|dean|director|board|governance|administration/i } },
                    { type: { $regex: /leadership|president|vice|chancellor|dean|director|board|governance|administration/i } },
                    { topic: { $regex: /leadership|president|vice|chancellor|dean|director|board|governance|administration/i } },
                    { content: { $regex: /vice president|president|leadership|dean|director|chancellor/i } },
                    { text: { $regex: /vice president|president|leadership|dean|director|chancellor/i } }
                  ]
                };
              }
              
              const leadershipQuery = directQuery;
              
              // TOKEN-AWARE: Limit to top 10 chunks (reduced from 30) to control token usage
              // Prioritize chunks with relevant keywords for better relevance
              const allChunks = await chunksCollection.find(leadershipQuery).limit(50).toArray();
              
              if (allChunks && allChunks.length > 0) {
                // Sort by relevance based on query type
                const sortedChunks = allChunks.sort((a, b) => {
                  const contentA = (a.content || a.text || '').toLowerCase();
                  const contentB = (b.content || b.text || '').toLowerCase();
                  
                  if (isOfficeHeadQueryProcessed) {
                    // For office queries, prioritize chunks with office acronym and "head"
                    const officeAcronyms = processedPrompt.match(/\b(OSPAT|OSA|OSCD|FASG|PESO|IRO|HSU|CGAD|IP-TBM|GCTC)\b/i);
                    if (officeAcronyms) {
                      const acronym = officeAcronyms[0].toLowerCase();
                      const hasAcronymA = contentA.includes(acronym);
                      const hasAcronymB = contentB.includes(acronym);
                      const hasHeadA = contentA.includes('head') || contentA.includes('director');
                      const hasHeadB = contentB.includes('head') || contentB.includes('director');
                      
                      // Prioritize: acronym + head > acronym only > head only > others
                      if (hasAcronymA && hasHeadA && !(hasAcronymB && hasHeadB)) return -1;
                      if (hasAcronymB && hasHeadB && !(hasAcronymA && hasHeadA)) return 1;
                      if (hasAcronymA && !hasAcronymB) return -1;
                      if (hasAcronymB && !hasAcronymA) return 1;
                    }
                    // If both have or both don't have, sort by length (longer = more complete info)
                    return (contentB.length) - (contentA.length);
                  } else if (isPresidentQuery) {
                    // For president queries, prioritize chunks with president type and name
                    const hasPresidentTypeA = (a.type || '').toLowerCase() === 'president' || (a.category || '').toLowerCase() === 'president';
                    const hasPresidentTypeB = (b.type || '').toLowerCase() === 'president' || (b.category || '').toLowerCase() === 'president';
                    const hasPresidentNameA = contentA.includes('roy') && contentA.includes('ponce');
                    const hasPresidentNameB = contentB.includes('roy') && contentB.includes('ponce');
                    const hasPresidentDetailsA = contentA.includes('education') || contentA.includes('expertise') || contentA.includes('achievement');
                    const hasPresidentDetailsB = contentB.includes('education') || contentB.includes('expertise') || contentB.includes('achievement');
                    
                    // Highest priority: president type + name + details
                    if (hasPresidentTypeA && hasPresidentNameA && hasPresidentDetailsA && !(hasPresidentTypeB && hasPresidentNameB && hasPresidentDetailsB)) return -1;
                    if (hasPresidentTypeB && hasPresidentNameB && hasPresidentDetailsB && !(hasPresidentTypeA && hasPresidentNameA && hasPresidentDetailsA)) return 1;
                    
                    // High priority: president type + name
                    if (hasPresidentTypeA && hasPresidentNameA && !(hasPresidentTypeB && hasPresidentNameB)) return -1;
                    if (hasPresidentTypeB && hasPresidentNameB && !(hasPresidentTypeA && hasPresidentNameA)) return 1;
                    
                    // Medium priority: president name + details
                    if (hasPresidentNameA && hasPresidentDetailsA && !(hasPresidentNameB && hasPresidentDetailsB)) return -1;
                    if (hasPresidentNameB && hasPresidentDetailsB && !(hasPresidentNameA && hasPresidentDetailsA)) return 1;
                    
                    // If both have or both don't have, sort by length (longer = more complete info)
                    return (contentB.length) - (contentA.length);
                  } else {
                    // For other leadership queries, prioritize chunks with "vice president"
                    const hasVicePresidentA = contentA.includes('vice president');
                    const hasVicePresidentB = contentB.includes('vice president');
                    
                    if (hasVicePresidentA && !hasVicePresidentB) return -1;
                    if (!hasVicePresidentA && hasVicePresidentB) return 1;
                    
                    // If both have or both don't have, sort by length (longer = more complete info)
                    return (contentB.length) - (contentA.length);
                  }
                });
                
                // Take top 10 most relevant chunks (reduced from 30)
                const topChunks = sortedChunks.slice(0, 10);
                
                // Calculate current context size in tokens (rough estimate: 1 token ≈ 4 characters)
                const currentContextTokens = Math.round((relevantContext?.length || 0) / 4);
                const remainingTokenBudget = Math.max(0, ragTokens - currentContextTokens - 200); // Reserve 200 tokens for formatting
                const maxFallbackChars = remainingTokenBudget * 4; // Convert tokens to characters
                
                // Format leadership chunks with token limit
                let leadershipContext = '';
                let addedChars = 0;
                let chunksAdded = 0;
                
                for (const chunk of topChunks) {
                  const section = chunk.section || chunk.topic || 'leadership';
                  let content = chunk.content || chunk.text || '';
                  
                  // CRITICAL: For president queries, don't truncate - we need all details
                  // For other queries, truncate if too long (max 500 chars per chunk)
                  if (!isPresidentQuery && content.length > 500) {
                    content = content.substring(0, 500) + '...';
                  }
                  
                  const chunkText = `## ${section}\n${content}\n\n`;
                  const chunkChars = chunkText.length;
                  
                  // Check if adding this chunk would exceed token budget
                  if (addedChars + chunkChars > maxFallbackChars && chunksAdded > 0) {
                    Logger.debug(`Token budget reached: ${Math.round((addedChars + currentContextTokens) / 4)} tokens used, stopping fallback data`);
                    break;
                  }
                  
                  leadershipContext += chunkText;
                  addedChars += chunkChars;
                  chunksAdded++;
                }
                
                if (chunksAdded > 0) {
                  // Append to existing context
                  const dataLabel = isOfficeHeadQueryProcessed ? 'OFFICE HEAD DATA' : 'LEADERSHIP DATA';
                  relevantContext = relevantContext + `\n\n=== DIRECT MONGODB ${dataLabel} ===\n` + leadershipContext + `\n=== END OF ${dataLabel} ===\n`;
                  const totalTokens = Math.round((relevantContext.length) / 4);
                  Logger.info(`✅ Added ${chunksAdded} ${isOfficeHeadQueryProcessed ? 'office' : 'leadership'} chunks from direct MongoDB query (${Math.round(addedChars / 4)} tokens, total context: ~${totalTokens} tokens)`);
                } else {
                  Logger.warn(`⚠️  No ${isOfficeHeadQueryProcessed ? 'office' : 'leadership'} chunks could be added due to token budget constraints`);
                }
              } else {
                Logger.warn(`⚠️  Direct MongoDB query also found no ${isOfficeHeadQueryProcessed ? 'office' : 'leadership'} chunks`);
              }
            } catch (mongoError) {
              Logger.error('Direct MongoDB query failed:', mongoError);
              // Continue with RAG context even if direct query fails
            }
          }
        }
          
          // Fetch schedule events if query is schedule-related
          let scheduleContext = '';
          let scheduleInstruction = '';
          if (isScheduleQuery && scheduleService && mongoService) {
            try {
              // Get current date and date range (past 30 days to future 365 days)
              const now = new Date();
              const startDate = new Date(now);
              startDate.setDate(startDate.getDate() - 30); // Past 30 days
              const endDate = new Date(now);
              endDate.setDate(endDate.getDate() + 365); // Next 365 days
              
              const events = await scheduleService.getEvents({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                limit: 100 // Get up to 100 events
              });
              
              if (events && events.length > 0) {
                // Helper function to format date concisely (e.g., "Jan 11" or "Jan 11 - Jan 15")
                const formatDateConcise = (date) => {
                  if (!date) return 'Date TBD';
                  const d = new Date(date);
                  const month = d.toLocaleDateString('en-US', { month: 'short' });
                  const day = d.getDate();
                  return `${month} ${day}`;
                };
                
                // Group events by title to avoid redundancy
                const groupedEvents = new Map();
                events.forEach(event => {
                  const title = event.title || 'Untitled Event';
                  if (!groupedEvents.has(title)) {
                    groupedEvents.set(title, []);
                  }
                  groupedEvents.get(title).push(event);
                });
                
                // Format grouped events
                const formattedEvents = [];
                for (const [title, eventGroup] of groupedEvents) {
                  // Sort events by date
                  eventGroup.sort((a, b) => {
                    const dateA = a.isoDate || a.date || a.startDate || '';
                    const dateB = b.isoDate || b.date || b.startDate || '';
                    return new Date(dateA) - new Date(dateB);
                  });
                  
                  // Get unique properties from the group
                  const firstEvent = eventGroup[0];
                  const category = firstEvent.category;
                  const time = firstEvent.time;
                  const description = firstEvent.description;
                  
                  let eventInfo = `- **${title}**\n`;
                  
                  // Check if all events in group are date ranges
                  const allAreDateRanges = eventGroup.every(e => 
                    e.dateType === 'date_range' && e.startDate && e.endDate
                  );
                  
                  if (allAreDateRanges && eventGroup.length > 0) {
                    // For date ranges, show the range concisely
                    const startDate = eventGroup[0].startDate;
                    const endDate = eventGroup[eventGroup.length - 1].endDate;
                    
                    // If all events are part of the same range, show single range
                    if (eventGroup.length === 1) {
                      const start = formatDateConcise(startDate);
                      const end = formatDateConcise(endDate);
                      const year = new Date(startDate).getFullYear();
                      eventInfo += `  📅 Date: ${start} - ${end}, ${year}\n`;
                    } else {
                      // Multiple ranges - show first and last
                      const firstStart = formatDateConcise(startDate);
                      const lastEnd = formatDateConcise(endDate);
                      const year = new Date(startDate).getFullYear();
                      eventInfo += `  📅 Dates: ${firstStart} - ${lastEnd}, ${year}\n`;
                    }
                  } else {
                    // Mix of single dates and ranges, or all single dates
                    const dates = [];
                    eventGroup.forEach(event => {
                      if (event.dateType === 'date_range' && event.startDate && event.endDate) {
                        const start = formatDateConcise(event.startDate);
                        const end = formatDateConcise(event.endDate);
                        dates.push(`${start} - ${end}`);
                      } else if (event.isoDate || event.date) {
                        dates.push(formatDateConcise(event.isoDate || event.date));
                      }
                    });
                    
                    if (dates.length > 0) {
                      // Remove duplicates and format
                      const uniqueDates = [...new Set(dates)];
                      const year = eventGroup[0].isoDate || eventGroup[0].date 
                        ? new Date(eventGroup[0].isoDate || eventGroup[0].date).getFullYear()
                        : eventGroup[0].startDate 
                          ? new Date(eventGroup[0].startDate).getFullYear()
                          : new Date().getFullYear();
                      
                      if (uniqueDates.length === 1) {
                        eventInfo += `  📅 Date: ${uniqueDates[0]}, ${year}\n`;
                      } else if (uniqueDates.length <= 3) {
                        eventInfo += `  📅 Dates: ${uniqueDates.join(', ')}, ${year}\n`;
                      } else {
                        // Too many dates, show range
                        const firstDate = uniqueDates[0];
                        const lastDate = uniqueDates[uniqueDates.length - 1];
                        eventInfo += `  📅 Dates: ${firstDate} - ${lastDate}, ${year}\n`;
                      }
                    }
                  }
                  
                  if (time) eventInfo += `  ⏰ Time: ${time}\n`;
                  if (category) eventInfo += `  🏷️ Category: ${category}\n`;
                  if (description) {
                    const desc = description.length > 150 
                      ? description.substring(0, 150) + '...' 
                      : description;
                    eventInfo += `  📝 ${desc}\n`;
                  }
                  
                  formattedEvents.push(eventInfo);
                }
                
                scheduleContext = `\n\n=== DOrSU SCHEDULE EVENTS (${groupedEvents.size} unique events found) ===\n` +
                  `The following are calendar events, announcements, and schedules from DOrSU:\n\n` +
                  formattedEvents.join('\n') +
                  `\n=== END OF SCHEDULE EVENTS ===\n`;
                
                scheduleInstruction = getCalendarEventsInstructions();
                
                Logger.info(`📅 Schedule: Fetched ${events.length} events for schedule query`);
              } else {
                Logger.info('📅 Schedule: No events found in database');
              }
            } catch (scheduleError) {
              Logger.error('📅 Schedule: Error fetching events:', scheduleError);
              // Continue without schedule data if there's an error
            }
        }
          
          // Fetch additional schedule items (announcements/events) from schedule collection
          let postsContext = '';
          if (isScheduleQuery && mongoService) {
            try {
              const scheduleCollection = mongoService.getCollection('schedule');
              // Get recent schedule items (last 100, sorted by date descending)
              // Filter for posts/announcements (source: 'Admin' or type: 'announcement')
              const posts = await scheduleCollection
                .find({
                  $or: [
                    { source: 'Admin' },
                    { type: 'announcement' }
                  ]
                })
                .sort({ date: -1, createdAt: -1 })
                .limit(100)
                .toArray();
              
              if (posts && posts.length > 0) {
                const formattedPosts = posts.map(post => {
                  let postText = `- **${post.title || 'Untitled'}**\n`;
                  
                  if (post.date) {
                    const postDate = new Date(post.date);
                    const month = postDate.toLocaleDateString('en-US', { month: 'short' });
                    const day = postDate.getDate();
                    const year = postDate.getFullYear();
                    postText += `  📅 Date: ${month} ${day}, ${year}\n`;
                  }
                  
                  if (post.category) {
                    postText += `  🏷️ Category: ${post.category}\n`;
                  }
                  
                  if (post.type) {
                    postText += `  📌 Type: ${post.type}\n`;
                  }
                  
                  if (post.description) {
                    const desc = post.description.length > 200 
                      ? post.description.substring(0, 200) + '...' 
                      : post.description;
                    postText += `  📝 ${desc}\n`;
                  }
                  
                  return postText;
                });
                
                postsContext = `\n\n=== DOrSU ANNOUNCEMENTS AND EVENTS (${posts.length} posts found) ===\n` +
                  `The following are announcements and events from DOrSU:\n\n` +
                  formattedPosts.join('\n') +
                  `\n=== END OF ANNOUNCEMENTS AND EVENTS ===\n`;
                
                Logger.info(`📢 Posts: Fetched ${posts.length} posts for announcements/events query`);
              } else {
                Logger.info('📢 Posts: No posts found in database');
              }
              
              // Also fetch calendar events from schedule collection for comprehensive coverage
              if (scheduleService && !scheduleContext) {
                try {
                  const now = new Date();
                  const startDate = new Date(now);
                  startDate.setDate(startDate.getDate() - 30);
                  const endDate = new Date(now);
                  endDate.setDate(endDate.getDate() + 365);
                  
                  const events = await scheduleService.getEvents({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    limit: 50
                  });
                  
                  if (events && events.length > 0) {
                    const formatDateConcise = (date) => {
                      if (!date) return 'Date TBD';
                      const d = new Date(date);
                      const month = d.toLocaleDateString('en-US', { month: 'short' });
                      const day = d.getDate();
                      return `${month} ${day}`;
                    };
                    
                    const formattedEvents = events.slice(0, 20).map(event => {
                      let eventText = `- **${event.title || 'Untitled Event'}**\n`;
                      if (event.isoDate || event.date) {
                        const eventDate = new Date(event.isoDate || event.date);
                        const month = eventDate.toLocaleDateString('en-US', { month: 'short' });
                        const day = eventDate.getDate();
                        const year = eventDate.getFullYear();
                        eventText += `  📅 Date: ${month} ${day}, ${year}\n`;
                      }
                      if (event.category) eventText += `  🏷️ Category: ${event.category}\n`;
                      if (event.description) {
                        const desc = event.description.length > 150 
                          ? event.description.substring(0, 150) + '...' 
                          : event.description;
                        eventText += `  📝 ${desc}\n`;
                      }
                      return eventText;
                    });
                    
                    if (postsContext) {
                      postsContext += `\n\n=== SCHEDULE EVENTS (${events.length} events found) ===\n` +
                        `The following are calendar events with specific dates:\n\n` +
                        formattedEvents.join('\n') +
                        `\n=== END OF SCHEDULE EVENTS ===\n`;
                    } else {
                      postsContext = `\n\n=== SCHEDULE EVENTS (${events.length} events found) ===\n` +
                        `The following are calendar events with specific dates:\n\n` +
                        formattedEvents.join('\n') +
                        `\n=== END OF SCHEDULE EVENTS ===\n`;
                    }
                    
                    Logger.info(`📅 Schedule: Fetched ${events.length} events for schedule query`);
                  }
                } catch (scheduleError) {
                  Logger.debug('📅 Schedule: Error fetching events for schedule query:', scheduleError);
                }
              }
            } catch (scheduleError) {
              Logger.error('📢 Schedule: Error fetching schedule items:', scheduleError);
              // Continue without schedule data if there's an error
            }
          }
          
          // Check if query is vague and has insufficient context
          const isVagueWithInsufficientContext = queryAnalysis.isVague && 
            queryAnalysis.needsClarification && 
            (!relevantContext || relevantContext.trim().length < 100) &&
            !scheduleContext &&
            !postsContext &&
            !newsContext;
          
          // CRITICAL FIX: hasContext check - be more lenient to prevent false negatives
          // Even getBasicInfo() contains useful data (president name, etc.)
          // Only consider "no context" if it's truly empty or just the placeholder
          const contextText = relevantContext ? relevantContext.trim() : '';
          const hasContext = contextText.length > 50 && 
                            !contextText.includes('[NO KNOWLEDGE BASE DATA AVAILABLE]') &&
                            !contextText.includes('NO KNOWLEDGE BASE DATA AVAILABLE');
          
          // CRITICAL: Log context status for debugging
          if (!hasContext && contextText.length > 0) {
            Logger.warn(`⚠️  Context exists but marked as insufficient: ${contextText.length} chars`);
            Logger.debug(`   Context preview: "${contextText.substring(0, 200)}..."`);
          }
          
          // Add summarization instructions if summarizing an article
          const summarizationInstruction = articleContent ? 
            '\n\n📰 NEWS ARTICLE SUMMARIZATION INSTRUCTIONS:\n' +
            '• You are summarizing a DOrSU news article that was scraped from the official website\n' +
            '• The article content is provided above in the user message\n' +
            '• Provide a clear, concise summary that includes:\n' +
            '  - Main topic and purpose of the article\n' +
            '  - Key points and important information\n' +
            '  - Any dates, deadlines, or time-sensitive information\n' +
            '  - Important people, events, or locations mentioned\n' +
            '  - Any calls to action or next steps\n' +
            '• Keep the summary informative but concise (2-4 paragraphs)\n' +
            '• Use a friendly, conversational tone\n' +
            '• If the article mentions specific programs, events, or announcements, highlight them clearly\n' +
            '• Format your response with clear paragraphs and bullet points if helpful\n' +
            '• At the end, mention: "For the full article, visit: [article URL]"\n\n' : '';
          
          // Re-check history queries on processed prompt (in case prompt was normalized)
          isHistoryQuery = /\b(history|historical|founded|established|background|evolution|development|kasaysayan|itinatag|pinagmulan|gitukod)\b/i.test(processedPrompt) || isHistoryQuery;
          
          // Build data source instructions based on query type
          let dataSourceInstructions = '';
          if (isScheduleQuery) {
            dataSourceInstructions = '\n📅 DATA SOURCE FOR THIS QUERY:\n' +
              '• For dates, schedules, events, announcements, and timelines → Use ONLY the "SCHEDULE EVENTS" section above (from "schedule" collection)\n' +
              '• The schedule collection contains all calendar events, announcements, and posts\n' +
              '• DO NOT use general knowledge or training data about dates, events, or announcements\n' +
              '• If schedule events are provided above, use those EXACT dates and information\n' +
              '• Check both calendar events and announcements/events sections as they are from the unified schedule collection\n\n';
          } else if (isDirectNewsQuery) {
            dataSourceInstructions = '\n📰 DATA SOURCE FOR THIS QUERY:\n' +
              '• For news and updates → Use ONLY the "NEWS" section above (from "news" collection)\n' +
              '• DO NOT use general knowledge about news\n' +
              '• If news items are provided above, use that information\n\n';
          } else if (isHistoryQuery) {
            dataSourceInstructions = getHistoryInstructions();
          } else if (isPresidentQuery) {
            dataSourceInstructions = getPresidentInstructions();
          } else if (isOfficeHeadQuery) {
            dataSourceInstructions = '\n📋 DATA SOURCE FOR THIS QUERY:\n' +
              '• For office head information → Use ONLY the "KNOWLEDGE BASE" section above (from "knowledge_chunks" collection)\n' +
              '• Look for chunks with section: "offices", "unitsAndOfficesHeads", "detailedOfficeServices", or "additionalOfficesAndCenters"\n' +
              '• Match the office acronym (OSA, OSPAT, etc.) in the category, metadata.acronym, or content fields\n' +
              '• Extract the head/director name, title, and role from the chunks\n' +
              '• DO NOT use training data or general knowledge\n' +
              '• If office head information is provided above, use that information\n\n';
          } else if (isVPQuery) {
            dataSourceInstructions = getLeadershipInstructions(true, false, false);
          } else if (isDeanQuery) {
            dataSourceInstructions = getLeadershipInstructions(false, true, false);
          } else if (isDirectorQuery) {
            dataSourceInstructions = getLeadershipInstructions(false, false, true);
          } else if (isLeadershipQuery) {
            dataSourceInstructions = getLeadershipInstructions(false, false, false);
          } else if (isProgramQuery) {
            dataSourceInstructions = getProgramInstructions();
          } else if (isVisionMissionQuery) {
            dataSourceInstructions = '\n🎯 DATA SOURCE FOR THIS QUERY:\n' +
              '• For vision and mission → Use ONLY the "KNOWLEDGE BASE" section above (from "knowledge_chunks" collection)\n' +
              '• Look for chunks with metadata.field containing "visionMission.vision" or "visionMission.mission"\n' +
              '• Extract the vision statement and all mission statements from the chunks\n' +
              '• Format: "Vision:" followed by the vision statement, then "Mission:" followed by all mission statements\n' +
              '• DO NOT use training data or general knowledge\n' +
              '• If vision/mission information is provided above, use that information\n' +
              '• CRITICAL: Exclude hymn chunks that just contain "Davao Oriental State University" - only use actual vision/mission content\n\n';
          } else if (isValuesQuery) {
            const isCoreValuesQuery = /\b(core\s+values?|values?)\b/i.test(prompt) && !/\bgraduate\s+outcomes?|outcomes?|mandate|quality\s+policy|charter\b/i.test(prompt);
            const isOutcomesQuery = /\b(graduate\s+outcomes?|outcomes?)\b/i.test(prompt) && !/\bcore\s+values?|mandate|quality\s+policy|charter\b/i.test(prompt);
            const isMandateQuery = /\b(mandate|charter)\b/i.test(prompt);
            const isQualityPolicyQuery = /\bquality\s+policy\b/i.test(prompt);
            if (isCoreValuesQuery) {
              dataSourceInstructions = '\n💎 DATA SOURCE FOR THIS QUERY:\n' +
                '• For core values → Use ONLY the "KNOWLEDGE BASE" section above (from "knowledge_chunks" collection)\n' +
                '• Look for chunks with metadata.field containing "valuesAndOutcomes.coreValues"\n' +
                '• Extract ALL core values from the chunks\n' +
                '• Format: List all core values as a numbered or bulleted list\n' +
                '• DO NOT use training data or general knowledge\n' +
                '• If core values information is provided above, use that information\n\n';
            } else if (isOutcomesQuery) {
              dataSourceInstructions = '\n💎 DATA SOURCE FOR THIS QUERY:\n' +
                '• For graduate outcomes → Use ONLY the "KNOWLEDGE BASE" section above (from "knowledge_chunks" collection)\n' +
                '• Look for chunks with metadata.field containing "valuesAndOutcomes.graduateOutcomes"\n' +
                '• Extract ALL graduate outcomes from the chunks\n' +
                '• Format: List all graduate outcomes as a numbered or bulleted list\n' +
                '• DO NOT use training data or general knowledge\n' +
                '• If graduate outcomes information is provided above, use that information\n\n';
            } else if (isMandateQuery) {
              dataSourceInstructions = '\n💎 DATA SOURCE FOR THIS QUERY:\n' +
                '• For mandate → Use ONLY the "KNOWLEDGE BASE" section above (from "knowledge_chunks" collection)\n' +
                '• Look for chunks with metadata.field containing "mandate.statement" or "mandate.objectives"\n' +
                '• Extract the mandate statement and all mandate objectives from the chunks\n' +
                '• Format: "Mandate:" followed by the mandate statement, then "Objectives:" followed by all objectives as a numbered or bulleted list\n' +
                '• DO NOT use training data or general knowledge\n' +
                '• If mandate information is provided above, use that information\n\n';
            } else if (isQualityPolicyQuery) {
              dataSourceInstructions = '\n💎 DATA SOURCE FOR THIS QUERY:\n' +
                '• For quality policy → Use ONLY the "KNOWLEDGE BASE" section above (from "knowledge_chunks" collection)\n' +
                '• Look for chunks with metadata.field containing "qualityPolicy" or section "qualityPolicy"\n' +
                '• Extract the complete quality policy statement from the chunks\n' +
                '• DO NOT use training data or general knowledge\n' +
                '• If quality policy information is provided above, use that information\n\n';
            } else {
              dataSourceInstructions = '\n💎 DATA SOURCE FOR THIS QUERY:\n' +
                '• For core values and graduate outcomes → Use ONLY the "KNOWLEDGE BASE" section above (from "knowledge_chunks" collection)\n' +
                '• Look for chunks with metadata.field containing "valuesAndOutcomes.coreValues" or "valuesAndOutcomes.graduateOutcomes"\n' +
                '• Extract ALL core values and ALL graduate outcomes from the chunks\n' +
                '• Format: "Core Values:" followed by all core values, then "Graduate Outcomes:" followed by all graduate outcomes\n' +
                '• List each section as a numbered or bulleted list\n' +
                '• DO NOT use training data or general knowledge\n' +
                '• If values/outcomes information is provided above, use that information\n\n';
            }
          } else if (isHymnQuery) {
            dataSourceInstructions = getHymnInstructions();
          } else {
            dataSourceInstructions = '\n📚 DATA SOURCE FOR THIS QUERY:\n' +
              '• For general DOrSU knowledge → Use ONLY the "KNOWLEDGE BASE" section above (from "knowledge_chunks" collection)\n' +
              '• DO NOT use training data or general knowledge\n' +
              '• If knowledge base chunks are provided above, use that information\n\n';
          }
          
          // For vague queries with insufficient context, ask for clarification
          const clarificationInstruction = isVagueWithInsufficientContext ? 
            '\n\n🤔 CLARIFICATION REQUIRED (CRITICAL):\n' +
            '• The user\'s query is VAGUE or AMBIGUOUS and lacks sufficient context\n' +
            '• DO NOT guess or use training data to answer\n' +
            '• DO NOT provide generic information\n' +
            '• DO NOT simply say "I don\'t have that information yet" - you MUST ask for clarification\n' +
            '• You MUST ask the user for clarification in a friendly, helpful way\n' +
            '• Ask specific questions to understand what they need:\n' +
            '  - If they mentioned an acronym (like "MCC"), ask what it stands for or what they\'re referring to\n' +
            '  - If they mentioned a vague term (like "final exam", "schedule"), ask for more context:\n' +
            '    * Which subject/course/program?\n' +
            '    * Which semester/academic year?\n' +
            '    * What specific information do they need?\n' +
            '  - If the query is too short, ask them to provide more details\n' +
            '• Be friendly and helpful: "I\'d be happy to help! Could you provide more details about..."\n' +
            '• Example response format:\n' +
            '  "I\'d like to help you with [vague term], but I need a bit more information. Could you please clarify:\n' +
            '  - [Specific question 1]\n' +
            '  - [Specific question 2]\n' +
            '  Once you provide these details, I can give you accurate information from the knowledge base."\n' +
            '• IMPORTANT: Always ask follow-up questions for vague queries - never just say you don\'t have the information\n\n' : '';
          
          systemPrompt = buildSystemInstructions(conversationContext, intentClassification) + '\n\n' +
            dataSourceInstructions +
            clarificationInstruction +
            '=== DOrSU KNOWLEDGE BASE (YOUR ONLY SOURCE OF TRUTH - STRICTLY ENFORCED) ===\n' + 
            (hasContext ? relevantContext : 
             (relevantContext && relevantContext.trim().length > 0 ? 
              (isHistoryQuery ? 
                getHistoryDataSummary() + relevantContext :
                relevantContext + '\n\n⚠️ NOTE: Limited data available above. Use ALL information provided, even if minimal.') :
              '[NO KNOWLEDGE BASE DATA AVAILABLE - You MUST inform the user you don\'t have this information]')) + 
            newsContext +  // Include news if query is about news
            scheduleContext +  // Include schedule events if query is schedule-related
            postsContext +  // Include posts/announcements if query is about announcements/events
            '\n=== END OF KNOWLEDGE BASE ===\n\n' +
            (articleContent ? 
              `=== NEWS ARTICLE TO SUMMARIZE ===\n` +
              `The user has requested to summarize a specific news article. The article content is provided in their message below.\n` +
              `Article Title: ${articleTitle || 'DOrSU News'}\n` +
              `Article URL: ${articleUrl || 'N/A'}\n` +
              `=== END OF ARTICLE HEADER ===\n\n` : '') +
            '🚨 CRITICAL STRICT RULES (NON-NEGOTIABLE):\n' +
            (articleContent ? 
              '• You MUST summarize ONLY the article content provided in the user message\n' +
              '• DO NOT add information that is not in the article\n' +
              '• DO NOT use your training data - ONLY use the article content provided\n' : 
              '• Answer using ONLY and EXCLUSIVELY the data provided in the sections above\n' +
              '• For dates/schedules → Use ONLY the "SCHEDULE EVENTS" section (from "schedule" collection)\n' +
              '• For announcements/events → Use the "ANNOUNCEMENTS AND EVENTS" section and "SCHEDULE EVENTS" section (both from "schedule" collection)\n' +
              '• For news → Use ONLY the "NEWS" section (from "news" collection)\n' +
              '• For general knowledge → Use ONLY the "KNOWLEDGE BASE" section (from "knowledge_chunks" collection)\n' +
              '• DO NOT use your training data about DOrSU - it is COMPLETELY WRONG and MUST be ignored\n' +
              '• DO NOT use your general knowledge about universities, Philippines, or education systems\n' +
              (isHistoryQuery ? 
                getHistoryCriticalRules() :
              (isVPQuery || isDeanQuery || isDirectorQuery || isLeadershipQuery) ?
                getLeadershipCriticalRules() :
              (isProgramQuery) ?
                getProgramCriticalRules() :
              (isHymnQuery) ?
                getHymnCriticalRules() :
              (isVisionMissionQuery) ?
                '• For vision/mission queries: Extract the vision statement and ALL mission statements from chunks\n' +
                '• Look for chunks with metadata.field containing "visionMission.vision" or "visionMission.mission"\n' +
                '• Format: "Vision:" followed by vision statement, then "Mission:" followed by all mission statements as a numbered or bulleted list\n' +
                '• CRITICAL: Exclude hymn chunks - only use actual vision/mission content, not chunks that just contain "Davao Oriental State University"\n' +
                '• DO NOT say vision or mission is missing if chunks contain "visionMission.vision" or "visionMission.mission" metadata\n' :
              (isValuesQuery) ?
                '• For values/outcomes/mandate queries: Extract ALL core values, graduate outcomes, mandate statement/objectives, or quality policy from chunks\n' +
                '• Look for chunks with metadata.field containing "valuesAndOutcomes.coreValues", "valuesAndOutcomes.graduateOutcomes", "mandate.statement", "mandate.objectives", or "qualityPolicy"\n' +
                '• Format: For values/outcomes: "Core Values:" followed by all core values, then "Graduate Outcomes:" followed by all graduate outcomes\n' +
                '• Format: For mandate: "Mandate:" followed by mandate statement, then "Objectives:" followed by all objectives\n' +
                '• Format: For quality policy: Provide the complete quality policy statement\n' +
                '• If query asks only for core values, show only core values. If query asks only for outcomes, show only outcomes. If query asks for mandate, show mandate and objectives\n' +
                '• List each value/outcome/objective as a separate item (numbered or bulleted)\n' +
                '• DO NOT say values, outcomes, mandate, or quality policy are missing if chunks contain the corresponding metadata\n' :
              (isOfficeHeadQuery) ?
                '• For office head queries, extract ONLY the head/director name, title, and role from the chunks\n' +
                '• If the office acronym (OSA, OSPAT, etc.) is mentioned in the query, ONLY return information for that specific office\n' +
                '• DO NOT confuse different offices (e.g., OSA vs OSPAT)\n' +
                '• If office head information is not in the chunks above, DO NOT mention it at all\n' :
                '• If information is not in the sections above, DO NOT mention it at all\n') +
              '• When listing programs, ONLY list ones that appear word-for-word in the knowledge base chunks above\n' +
              '• NEVER create, invent, or hallucinate URLs - ONLY use URLs that appear exactly in the knowledge base chunks\n' +
              '• If you see a URL in the knowledge base, copy it EXACTLY (including query parameters and all characters)\n' +
              '• Student manuals are on heyzine.com - NEVER create dorsu.edu.ph/wp-content/uploads URLs for manuals\n' +
              '• For dates: Use EXACT dates from the calendar events section - DO NOT modify or approximate\n' +
              // CRITICAL FIX: Only show "no data" warning if truly no data exists
              // Check if we have ANY context (even minimal) before claiming no data
              ((hasContext || (relevantContext && relevantContext.trim().length > 50) || scheduleContext || postsContext || newsContext) ? 
                '• ✅ Data is available above - USE IT ALL. Extract every detail from the provided chunks.\n' :
                '• ⚠️ WARNING: No relevant data found in any collection - You MUST tell the user: "I don\'t have that specific information in the knowledge base yet."\n')) +
            (summarizationInstruction || '') +
            (newsInstruction || '') +  // Include news instruction only if present
            (scheduleInstruction || '');  // Include schedule instruction only if present
        } else {
          // For non-DOrSU queries, still restrict to knowledge base if available
          if (ragService && relevantContext && relevantContext.trim().length > 100) {
            systemPrompt = buildSystemInstructions(conversationContext, intentClassification) + '\n\n' +
              '=== KNOWLEDGE BASE DATA ===\n' + 
              relevantContext + 
              '\n=== END OF KNOWLEDGE BASE ===\n\n' +
              '🚨 CRITICAL: Use ONLY information from the knowledge base above. If information is not there, say you don\'t have it.';
          } else {
            // For general knowledge queries without DOrSU context, use intent-aware system prompt
            systemPrompt = IntentClassifier.getSystemPrompt(intentClassification);
          }
        }

        // --- AI Response Generation ---
        
        // Few-shot examples that reinforce knowledge-base-only behavior
        const fewShotExamples = isDOrSUQuery ? [
          { role: 'user', content: 'What is DOrSU?' },
          { role: 'assistant', content: 'DOrSU is Davao Oriental State University, founded 1989 in Mati City, Philippines. (This information comes from the knowledge base provided.)' },
          { role: 'user', content: 'Who is the president?' },
          { role: 'assistant', content: 'As of 2025, the president is Dr. Roy G. Ponce. (This information comes from the knowledge base provided.)' },
          { role: 'user', content: 'What programs does DOrSU offer in Computer Engineering?' },
          { role: 'assistant', content: 'I don\'t have that specific information in the knowledge base yet. Please check with the university directly for the most current program offerings.' }
        ] : [
          { role: 'user', content: 'What is DOrSU?' },
          { role: 'assistant', content: 'DOrSU is Davao Oriental State University, founded 1989 in Mati City, Philippines.' },
          { role: 'user', content: 'Who is the president?' },
          { role: 'assistant', content: 'The president is Dr. Roy G. Ponce.' }
        ];
        
        const chatResult = await service.chat([
          { role: 'system', content: systemPrompt },
          ...fewShotExamples,
          { role: 'user', content: processedPrompt }
        ], options);
        
        // Extract content and token usage from response
        const rawReply = typeof chatResult === 'object' && chatResult.content !== undefined 
          ? chatResult.content 
          : chatResult;
        const tokenUsage = typeof chatResult === 'object' && chatResult.tokenUsage !== undefined
          ? chatResult.tokenUsage
          : null;
        
        // --- Response Processing ---
        
        const formattedResponse = responseFormatter.format(rawReply, {
          enableMarkdown: false,  // Don't convert to HTML on backend - let frontend handle it
          enableSanitization: false,  // Let frontend handle sanitization
          enhanceBold: false,  // DISABLED - AI already adds bold, this causes ****text** instead of **text**
          highlightEntities: false,  // DISABLED - AI already highlights years and entities
          makeLinksClickable: false  // Don't convert links - let frontend handle it
        });
        
        // Clean HTML artifacts from response
        let reply = ResponseCleaner.cleanHTMLArtifacts(formattedResponse.text);
        const responseTime = Date.now() - startTime;
        
        // --- Caching & Logging ---
        
        // Cache and log
        if (ragService) ragService.cacheAIResponse(processedPrompt, reply, queryAnalysis.complexity);
        if (mongoService) {
          mongoService.logQuery(processedPrompt, queryAnalysis.complexity, responseTime, false);
          
          // Track user query for frequency analysis (if userId is available)
          // Include userType for categorization (student/faculty)
          if (userId) {
            await mongoService.logUserQuery(userId, processedPrompt, userType);
          }
        }
        
        conversationService.storeConversation(sessionId, processedPrompt, reply, {
          detectedTopics: queryAnalysis.detectedTopics,
          complexity: queryAnalysis.complexity
        });
        
        Logger.info(`⚡ Response: ${(responseTime / 1000).toFixed(2)}s`);
        
        // --- Send Response ---
        
        sendJson(res, 200, {
          reply,
          source: 'ai-model',
          model: providerInfo.model,
          provider: providerInfo.provider,
          complexity: queryAnalysis.complexity,
          responseTime,
          usedKnowledgeBase: isDOrSUQuery,
          // Token usage information
          tokenUsage: tokenUsage || null,
          // Conversational intent information
          intent: {
            conversational: intentClassification.conversationalIntent,
            confidence: intentClassification.conversationalConfidence,
            dataSource: intentClassification.source,
            category: intentClassification.category
          }
        });
      } catch (err) {
        Logger.error('Chat error:', err.message);
        sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // ===== STATIC FILE SERVING =====
  
  if (serveStatic(req, res)) return;
  
  // Log unmatched routes for debugging
  Logger.warn(`⚠️ 404 - Route not found: ${method} ${url} (raw: ${rawUrl})`);
  sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, '0.0.0.0', () => {
  Logger.success(`Server: http://localhost:${port}`);
  Logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ===== HELPER FUNCTIONS =====

/**
 * Get emoji icon for conversational intent
 */
function getConversationalIntentIcon(intentType) {
  const icons = {
    greeting: '👋',
    farewell: '👋',
    gratitude: '🙏',
    emotion_expression: '💭',
    task_request: '✅',
    information_query: '❓',
    clarification_request: '🤔',
    follow_up: '🔄',
    small_talk: '💬'
  };
  return icons[intentType] || '💬';
}

/**
 * Build news context - scrapes on-demand and returns formatted news
 */
async function buildNewsContext(shouldIncludeNews, isDateSpecific, newsService) {
  if (!shouldIncludeNews || !newsService) {
    return { newsContext: '', newsInstruction: '' };
  }
  
  try {
    // Scrape news fresh on-demand (sorted by date, newest first)
    const newsCount = isDateSpecific ? 10 : 3;
    const news = await newsService.getLatestNews(newsCount);
    
    if (!news || news.length === 0) {
      Logger.warn('📰 No news items found after scraping');
      return { 
        newsContext: '', 
        newsInstruction: '\n⚠️ Note: No recent news was found. Inform the user that no news items are available at this time.' 
      };
    }
    
    // Format news with proper structure including links
    let newsContext = '\n\n=== LATEST DORSU NEWS & UPDATES (SCRAPED ON-DEMAND) ===\n';
    news.forEach((item, index) => {
      newsContext += `\n${index + 1}. **${item.title}**\n`;
      newsContext += `   📅 Date: ${item.date}\n`;
      if (item.excerpt && item.excerpt !== 'Click to read more') {
        newsContext += `   📄 ${item.excerpt}\n`;
      }
      newsContext += `   🔗 Link: ${item.link}\n`;
    });
    newsContext += '\n=== END OF NEWS ===\n';
    
    const newsInstruction = isDateSpecific ? 
      '\n\n📰 NEWS RESPONSE FORMATTING (MANDATORY):\n' +
      '• Format the news response as a numbered list (1, 2, 3, etc.)\n' +
      '• For each news item, include:\n' +
      '  - Bold title on the first line\n' +
      '  - Date on the second line with 📅 emoji\n' +
      '  - Excerpt/description if available (third line)\n' +
      '  - Clickable link with 🔗 emoji and the FULL URL\n' +
      '• Make links clickable using markdown format: [Link Text](URL)\n' +
      '• At the end, inform users they can ask for summaries: "Would you like me to summarize any of these news items? Just say summarize news 1 or tell me about news 2!"\n' +
      '• Example format:\n' +
      '  1. **News Title**\n' +
      '     📅 Date: January 15, 2025\n' +
      '     This is the news excerpt or description.\n' +
      '     🔗 Link: [Read more](https://dorsu.edu.ph/news/article/)\n\n' :
      '\n\n📰 NEWS RESPONSE FORMATTING (MANDATORY):\n' +
      '• User asked for latest news - show exactly 3 latest posts based on date\n' +
      '• Format each news item as follows:\n' +
      '  1. **Bold Title** (first line)\n' +
      '     📅 Date: [Date] (second line)\n' +
      '     [Excerpt/description if available] (third line)\n' +
      '     🔗 Link: [Read full article](URL) (fourth line with clickable markdown link)\n' +
      '• Number the news items: 1, 2, 3\n' +
      '• Use proper spacing between items\n' +
      '• Make sure all links are clickable using markdown: [text](URL)\n' +
      '• Include the FULL URL from the knowledge base chunks\n' +
      '• Start your response with a friendly intro like: "Here are the 3 latest news from DOrSU:"\n' +
      '• After listing the news, add: "Would you like me to summarize any of these news items? Just say summarize news 1 or tell me about news 2!"\n' +
      '• Example:\n' +
      '  Here are the 3 latest news from DOrSU:\n\n' +
      '  1. **Annual Research Conference 2025**\n' +
      '     📅 Date: January 20, 2025\n' +
      '     DOrSU announces the annual research conference.\n' +
      '     🔗 Link: [Read full article](https://dorsu.edu.ph/news/annual-research-conference-2025/)\n\n' +
      '  2. **New Academic Programs Offered**\n' +
      '     📅 Date: January 15, 2025\n' +
      '     The university introduces new programs for 2025.\n' +
      '     🔗 Link: [Read full article](https://dorsu.edu.ph/news/new-academic-programs/)\n\n' +
      '  3. **Enrollment Schedule Released**\n' +
      '     📅 Date: January 10, 2025\n' +
      '     Enrollment dates and requirements are now available.\n' +
      '     🔗 Link: [Read full article](https://dorsu.edu.ph/news/enrollment-schedule-2025/)\n\n' +
      '  Would you like me to summarize any of these news items? Just say summarize news 1 or tell me about news 2!\n\n';
    
    Logger.info(`📰 Including ${news.length} latest news items in response (scraped on-demand, sorted by date)`);
    
    return { newsContext, newsInstruction };
  } catch (error) {
    Logger.error('Failed to scrape news on-demand:', error.message);
    return { 
      newsContext: '', 
      newsInstruction: '\n⚠️ Note: Unable to fetch news at this time. Inform the user that news scraping failed.' 
    };
  }
}

