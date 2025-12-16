import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ActivityLogService } from './services/activity-log.js';
import { AuthService, authMiddleware } from './services/auth.js';
import { buildClarificationMessage, isConversationResetRequest } from './services/chat-guardrails.js';
import { getChatHistoryService } from './services/chat-history.js';
import conversationService from './services/conversation.js';
import { getDataRefreshService } from './services/dataset-setup.js';
import { handleVerificationRedirect } from './services/email-verification-redirect.js';
import { getFileProcessorService } from './services/file-processor.js';
import responseFormatter from './services/formatter.js';
import { getGridFSService } from './services/gridfs.js';
import { getMongoDBService } from './services/mongodb.js';
import { buildNewsContext } from './services/news-context.js';
import { OptimizedRAGService } from './services/rag.js';
import { getScheduleService } from './services/schedule.js';
import { getNewsScraperService } from './services/scraper.js';
import { LlamaService } from './services/service.js';
import { buildSystemInstructions, getAdmissionRequirementsInstructions, getCalendarEventsInstructions, getHistoryCriticalRules, getHistoryDataSummary, getHistoryInstructions, getHymnCriticalRules, getHymnInstructions, getLeadershipCriticalRules, getLeadershipInstructions, getPresidentInstructions, getProgramCriticalRules, getProgramInstructions } from './services/system.js';
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

// ===== TIMEZONE UTILITIES =====
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
let activityLogService = null;

// ===== FALLBACK CONTEXT =====
const fallbackContext = `## DAVAO ORIENTAL STATE UNIVERSITY (DOrSU)
**Founded:** 1989 | **Location:** Mati City, Davao Oriental
**Vision:** A university of excellence, innovation and inclusion
**President:** Dr. Roy G. Ponce`;

const ELEVATED_ROLES = ['admin', 'superadmin'];
const hasAdminAccess = (role) => ELEVATED_ROLES.includes(role);

async function initializeServices() {
  try {
    mongoService = getMongoDBService();
    await mongoService.connect();
    Logger.success('MongoDB initialized');
    
    // Migrate existing users to have default roles
    try {
      const migrationResult = await mongoService.migrateUserRoles();
      if (migrationResult.migrated > 0) {
        Logger.success(`✅ User role migration: ${migrationResult.message}`);
      }
    } catch (error) {
      Logger.warn('User role migration failed (non-critical):', error.message);
    }
    
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
    
    // Initialize activity log service
    activityLogService = new ActivityLogService(mongoService);
    Logger.success('Activity log service initialized');
    
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
    
    // Initialize RAG service now that MongoDB is connected
    if (!ragService) {
      ragService = new OptimizedRAGService(mongoService);
      Logger.success('RAG service initialized');
      setTimeout(() => ragService?.syncWithMongoDB(), 2000);
    }
  } catch (error) {
    Logger.error('MongoDB init failed:', error.message);
  }
}

// Kick off initialization (async but awaited internally)
initializeServices();

// ===== DATA INITIALIZATION =====
try {
  dorsuData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  dorsuContext = fallbackContext;
} catch (e) {
  Logger.error('Data init failed:', e.message);
}

// ===== UTILITY FUNCTIONS =====

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
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
  const urlObj = new URL(rawUrl, `http://${req.headers.host || 'localhost:3000'}`);
  
  // Email verification redirect handler
  if (method === 'GET' && url === '/verify-email') {
    // For web, try to detect the frontend URL from referer or use default localhost
    let frontendOrigin = 'http://localhost:8081';
    const referer = req.headers.referer;
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        frontendOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      } catch (e) {
        // Use default if parsing fails
      }
    }
    // Also check if there's a specific frontend URL in headers or use the request origin
    const origin = req.headers.origin || `http://${req.headers.host || 'localhost:3000'}`;
    // Prefer frontend origin if we detected it, otherwise use request origin
    const redirectOrigin = frontendOrigin !== 'http://localhost:8081' ? frontendOrigin : origin;
    handleVerificationRedirect(urlObj, res, redirectOrigin);
    return;
  }
  
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
  // Debug logging for activity logs endpoint
  if (url === '/api/activity-logs' || rawUrl.includes('activity-logs')) {
    Logger.info(`📋 Activity Log Request: ${method} ${rawUrl} -> Parsed: ${url}`);
    Logger.info(`📋 Services available: authService=${!!authService}, mongoService=${!!mongoService}, activityLogService=${!!activityLogService}`);
  }

  // ===== CORS HEADERS =====
  // Allow requests from frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, If-Modified-Since');
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

  // Firebase User Registration (sync Firebase user to MongoDB)
  if (method === 'POST' && url === '/api/auth/register-firebase') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!authService || !mongoService) {
          sendJson(res, 503, { error: 'Authentication service not available' });
          return;
        }

        // Get Firebase ID token from Authorization header
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          sendJson(res, 401, { error: 'Firebase ID token required in Authorization header' });
          return;
        }

        const idToken = authHeader.substring(7);
        
        // Validate token format
        const tokenParts = idToken.split('.');
        if (tokenParts.length !== 3) {
          sendJson(res, 400, { error: 'Invalid token format' });
          return;
        }

        // Verify Firebase token and get user info
        let tokenInfo = null;
        try {
          const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
          if (tokenInfoRes.ok) {
            tokenInfo = await tokenInfoRes.json();
          } else {
            // Fallback: decode JWT payload locally
            const payload = tokenParts[1];
            const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
            const decoded = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
            const parsed = JSON.parse(decoded);
            
            if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) {
              sendJson(res, 401, { error: 'Token expired' });
              return;
            }
            
            tokenInfo = {
              email: parsed.email,
              name: parsed.name || parsed.email?.split('@')[0],
              sub: parsed.sub || parsed.user_id,
              email_verified: parsed.email_verified || false,
            };
          }
        } catch (tokenError) {
          Logger.error('Token validation error:', tokenError);
          sendJson(res, 401, { error: 'Invalid Firebase token' });
          return;
        }

        if (!tokenInfo || !tokenInfo.email) {
          sendJson(res, 401, { error: 'Invalid token - missing email' });
          return;
        }

        const { username, firstName, lastName } = JSON.parse(body || '{}');
        const normalizedEmail = tokenInfo.email.toLowerCase();
        // Use firstName + lastName if available, otherwise fall back to username or tokenInfo.name
        const displayName = (firstName && lastName) 
          ? `${firstName.trim()} ${lastName.trim()}`.trim()
          : username || tokenInfo.name || normalizedEmail.split('@')[0];

        // Check if user already exists in MongoDB
        let user = await mongoService.findUser(normalizedEmail);
        
        const updateData = {
          username: displayName,
          emailVerified: tokenInfo.email_verified || false,
          firebaseUid: tokenInfo.sub,
          provider: 'firebase',
        };
        
        // Add firstName and lastName if provided
        if (firstName) updateData.firstName = firstName.trim();
        if (lastName) updateData.lastName = lastName.trim();
        
        if (user) {
          // Update existing user
          await mongoService.updateUser(normalizedEmail, updateData);
          user = await mongoService.findUser(normalizedEmail);
        } else {
          // Create new user in MongoDB
          user = await mongoService.createUser({
            username: displayName,
            firstName: firstName ? firstName.trim() : undefined,
            lastName: lastName ? lastName.trim() : undefined,
            email: normalizedEmail,
            password: '', // No password for Firebase users
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            emailVerified: tokenInfo.email_verified || false,
            provider: 'firebase',
            role: 'user', // Default role for new users
            firebaseUid: tokenInfo.sub,
          });
        }

        // Generate JWT token
        const token = authService.generateToken(user);

        Logger.success(`✅ Firebase user synced to MongoDB: ${normalizedEmail}`);

        // Log registration activity (if new user) or login (if existing)
        if (activityLogService) {
          const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'] || 'unknown';
          const wasNewUser = !user.lastLogin; // Check if this was a new registration
          
          await activityLogService.logActivity(
            user._id?.toString() || user.id,
            wasNewUser ? 'user.register' : 'user.login',
            {
              email: normalizedEmail,
              username: displayName,
              method: 'firebase'
            },
            {
              ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
              userAgent: userAgent,
              timestamp: new Date()
            }
          );
        }

        sendJson(res, 201, {
          success: true,
          user: {
            id: user._id || user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user',
            createdAt: user.createdAt,
          },
          token,
        });
      } catch (error) {
        Logger.error('Firebase register error:', error.message);
        sendJson(res, 400, { error: error.message || 'Failed to sync Firebase user' });
      }
    });
    return;
  }

  // User Registration (Legacy - for backward compatibility)
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
        
        // Log registration activity
        if (activityLogService && result.success && result.user) {
          const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'] || 'unknown';
          await activityLogService.logActivity(
            result.user.id,
            'user.register',
            {
              email: email,
              username: username,
              method: 'email'
            },
            {
              ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
              userAgent: userAgent,
              timestamp: new Date()
            }
          );
        }
        
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
        
        // Log login activity
        if (activityLogService && result.success && result.user) {
          const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'] || 'unknown';
          await activityLogService.logActivity(
            result.user.id,
            'user.login',
            {
              email: email,
              method: 'email'
            },
            {
              ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
              userAgent: userAgent,
              timestamp: new Date()
            }
          );
        }
        
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
            googleSub: tokenInfo.sub,
            role: 'user' // Default role for new users
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

        // Log login activity (or registration if new user)
        if (activityLogService) {
          const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'] || 'unknown';
          const wasNewUser = !user.lastLogin; // If lastLogin doesn't exist, it's a new user
          
          await activityLogService.logActivity(
            user._id?.toString() || user.id,
            wasNewUser ? 'user.register' : 'user.login',
            {
              email: email,
              username: name,
              method: 'google'
            },
            {
              ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
              userAgent: userAgent,
              timestamp: new Date()
            }
          );
        }

        sendJson(res, 200, {
          success: true,
          user: {
            id: user._id || user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user'
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

  // Upload profile picture
  if (method === 'POST' && url === '/api/auth/profile-picture') {
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

      // Validate file type (images only)
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const mimeType = filePart.contentType || 'image/jpeg';
      
      if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
        sendJson(res, 400, { 
          error: `File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}` 
        });
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (filePart.data.length > maxSize) {
        sendJson(res, 400, { error: 'File size exceeds 5MB limit' });
        return;
      }

      Logger.info(`📤 Processing profile picture upload for user: ${auth.userId} (${(filePart.data.length / 1024).toFixed(2)} KB)`);

      // Upload to GridFS
      const gridFSService = getGridFSService();
      const fileName = filePart.filename || `profile_${Date.now()}.jpg`;
      const imageFileId = await gridFSService.uploadImage(
        Buffer.from(filePart.data),
        fileName,
        mimeType,
        { userId: auth.userId, type: 'profile-picture' }
      );

      // Build image URL
      const baseUrl = process.env.PUBLIC_BACKEND_URL || `http://localhost:${port}`;
      const imageUrl = `${baseUrl}/api/images/${imageFileId}`;

      // Update user profile picture in database
      await mongoService.updateUserProfilePicture(auth.userId, imageFileId, imageUrl);

      Logger.success(`✅ Profile picture uploaded: ${imageFileId}`);

      sendJson(res, 200, {
        success: true,
        message: 'Profile picture uploaded successfully',
        imageFileId,
        imageUrl
      });
    } catch (error) {
      Logger.error('Profile picture upload error:', error);
      sendJson(res, 500, { error: error.message || 'Failed to upload profile picture' });
    }
    return;
  }

  // Logout endpoint - log logout activity
  if (method === 'POST' && url === '/api/auth/logout') {
    if (!authService || !mongoService || !activityLogService) {
      sendJson(res, 503, { error: 'Services not available' });
      return;
    }

    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      // Even if not authenticated, return success (user might have already logged out)
      sendJson(res, 200, { success: true, message: 'Logged out successfully' });
      return;
    }

    try {
      // Log logout activity before clearing session
      const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      await activityLogService.logActivity(
        auth.userId,
        'user.logout',
        {
          email: auth.email || null,
        },
        {
          ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
          userAgent: userAgent,
          timestamp: new Date()
        }
      );

      Logger.success(`✅ User logged out: ${auth.userId || auth.email}`);
      sendJson(res, 200, { success: true, message: 'Logged out successfully' });
    } catch (error) {
      Logger.error('Logout error:', error.message);
      // Still return success even if logging fails (don't block logout)
      sendJson(res, 200, { success: true, message: 'Logged out successfully' });
    }
    return;
  }

  // Change password
  if (method === 'POST' && url === '/api/auth/change-password') {
    if (!authService || !mongoService) {
      sendJson(res, 503, { error: 'Services not available' });
      return;
    }

    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      sendJson(res, 401, { error: auth.error || 'Unauthorized' });
      return;
    }

    if (auth.isAdmin) {
      sendJson(res, 400, { error: 'Password changes are not supported for admin tokens' });
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { currentPassword, newPassword } = JSON.parse(body || '{}');
        const result = await authService.changePassword(auth.userId, currentPassword, newPassword);
        sendJson(res, 200, result);
      } catch (error) {
        Logger.error('Change password error:', error.message || error);
        sendJson(res, 400, { error: error.message || 'Failed to change password' });
      }
    });
    return;
  }

  // Get all users (admin endpoint) - SECURED
  if (method === 'GET' && url === '/api/users') {
    if (!authService || !mongoService) {
      sendJson(res, 503, { error: 'Services not available' });
      return;
    }

    // Require authentication
    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    // Only admins can view all users
    let isAdmin = auth.isAdmin;
    if (!isAdmin) {
      // Check if user has admin role in database
      const user = await mongoService.findUserById(auth.userId);
      if (!user || !hasAdminAccess(user.role)) {
        sendJson(res, 403, { error: 'Forbidden: Admin access required' });
        return;
      }
      isAdmin = true;
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

  // Migrate user roles (admin endpoint) - SECURED
  if (method === 'POST' && url === '/api/users/migrate-roles') {
    if (!authService || !mongoService) {
      sendJson(res, 503, { error: 'Services not available' });
      return;
    }

    // Require authentication
    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    // Only admins can run migration
    let isAdmin = auth.isAdmin;
    if (!isAdmin) {
      // Check if user has admin role in database
      const user = await mongoService.findUserById(auth.userId);
      if (!user || !hasAdminAccess(user.role)) {
        sendJson(res, 403, { error: 'Forbidden: Admin access required' });
        return;
      }
      isAdmin = true;
    }

    try {
      const result = await mongoService.migrateUserRoles();
      sendJson(res, 200, { success: true, ...result });
    } catch (error) {
      Logger.error('Migrate roles error:', error.message);
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  // Update user role (admin only) - SECURED
  if (method === 'PUT' && url.startsWith('/api/users/') && url.endsWith('/role')) {
    if (!authService || !mongoService) {
      sendJson(res, 503, { error: 'Services not available' });
      return;
    }

    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    // Check admin access - both token-based and database role
    let isAdmin = auth.isAdmin;
    if (!isAdmin) {
      const user = await mongoService.findUserById(auth.userId);
      isAdmin = user && hasAdminAccess(user.role);
    }

    if (!isAdmin) {
      sendJson(res, 403, { error: 'Forbidden: Admin access required' });
      return;
    }

    // Extract userId from URL: /api/users/{userId}/role
    const urlParts = url.split('/api/users/')[1];
    if (!urlParts) {
      sendJson(res, 400, { error: 'Invalid URL format' });
      return;
    }
    
    const userId = urlParts.replace('/role', '').trim();
    
    // Validate userId
    if (!userId || userId.length === 0) {
      sendJson(res, 400, { error: 'User ID is required' });
      return;
    }
    
    Logger.info(`Update role request for userId: ${userId}`);
    
    // Prevent self-demotion (optional security measure)
    if (userId === auth.userId) {
      sendJson(res, 400, { error: 'Cannot change your own role' });
      return;
    }
    
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { role } = JSON.parse(body || '{}');
        if (!role) {
          sendJson(res, 400, { error: 'Role is required' });
          return;
        }
        
        const validRoles = ['user', 'moderator', 'admin', 'superadmin'];
        if (!validRoles.includes(role)) {
          sendJson(res, 400, { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
          return;
        }
        
        Logger.info(`Attempting to update role for userId: ${userId} to role: ${role}`);
        
        // Get requester and target roles for authorization checks
        const requesterRole = auth.role || (await mongoService.findUserById(auth.userId))?.role || 'user';
        const targetUser = await mongoService.findUserById(userId);
        const oldRole = targetUser?.role || 'user';

        // Only superadmins can assign or change superadmin roles
        if (role === 'superadmin' && requesterRole !== 'superadmin') {
          sendJson(res, 403, { error: 'Forbidden: Superadmin role can only be assigned by a superadmin' });
          return;
        }
        if (targetUser?.role === 'superadmin' && requesterRole !== 'superadmin') {
          sendJson(res, 403, { error: 'Forbidden: Only a superadmin can modify another superadmin' });
          return;
        }

        // Admins can ONLY assign User or Moderator roles (never Admin/Superadmin)
        if (requesterRole === 'admin' && (role === 'admin' || role === 'superadmin')) {
          sendJson(res, 403, { error: 'Forbidden: Admins may only assign User or Moderator roles' });
          return;
        }

        // Only superadmins can modify existing admins (promote/demote/change)
        if (targetUser?.role === 'admin' && requesterRole !== 'superadmin') {
          sendJson(res, 403, { error: 'Forbidden: Only a superadmin can modify an admin account' });
          return;
        }
        
        const result = await mongoService.updateUserRole(userId, role);
        
        // Log activity
        if (activityLogService) {
          const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'] || 'unknown';
          await activityLogService.logActivity(
            auth.userId,
            'admin.role_change',
            {
              targetUserId: userId,
              targetUserEmail: targetUser?.email || null,
              oldRole: oldRole,
              newRole: role
            },
            {
              ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
              userAgent: userAgent,
              timestamp: new Date()
            }
          );
        }
        
        sendJson(res, 200, { success: true, message: 'User role updated successfully' });
      } catch (error) {
        Logger.error('Update user role error:', error.message);
        Logger.error('Error details:', error);
        sendJson(res, 400, { error: error.message || 'Failed to update user role' });
      }
    });
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
      // Get user info before deletion for logging
      const userToDelete = await mongoService.findUserById(auth.userId);
      const deletedUserEmail = userToDelete?.email || null;
      
      const result = await mongoService.deleteUser(auth.userId);
      if (result.success) {
        Logger.success(`✅ Account deleted successfully: ${auth.userId}`);
        
        // Log activity
        if (activityLogService) {
          const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'] || 'unknown';
          await activityLogService.logActivity(
            auth.userId,
            'user.account_delete',
            {
              deletedUserId: auth.userId,
              deletedUserEmail: deletedUserEmail
            },
            {
              ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
              userAgent: userAgent,
              timestamp: new Date()
            }
          );
        }
        
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

  // Get activity logs (admin can see all, users can see their own) - Check both with and without trailing slash
  if (method === 'GET' && (url === '/api/activity-logs' || url === '/api/activity-logs/')) {
    Logger.info(`📋 Activity logs endpoint hit: ${method} ${url} (raw: ${rawUrl})`);
    
    if (!authService || !mongoService || !activityLogService) {
      Logger.error('Activity logs: Services not available', { 
        authService: !!authService, 
        mongoService: !!mongoService, 
        activityLogService: !!activityLogService 
      });
      sendJson(res, 503, { error: 'Services not available' });
      return;
    }

    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      Logger.warn('Activity logs: Unauthorized request');
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    // Check admin access
    let isAdmin = auth.isAdmin;
    if (!isAdmin) {
      const user = await mongoService.findUserById(auth.userId);
      isAdmin = user && hasAdminAccess(user.role);
    }

    try {
      const userId = urlObj.searchParams.get('userId') || null;
      const action = urlObj.searchParams.get('action') || null;
      const startDate = urlObj.searchParams.get('startDate') || null;
      const endDate = urlObj.searchParams.get('endDate') || null;
      const userEmail = urlObj.searchParams.get('userEmail') || null;
      const limit = parseInt(urlObj.searchParams.get('limit') || '100', 10);
      const skip = parseInt(urlObj.searchParams.get('skip') || '0', 10);

      Logger.info(`📋 Activity logs: Fetching with filters`, { userId, action, limit, skip, isAdmin });

      const filters = {};
      
      // If user is not admin, restrict to their own logs only
      if (!isAdmin) {
        // Force filter by authenticated user's ID or email
        filters.userId = auth.userId;
        // Also filter by email if available
        if (auth.email) {
          filters.userEmail = auth.email;
        }
        Logger.info(`📋 Activity logs: Non-admin user, restricting to own logs (userId: ${auth.userId}, email: ${auth.email})`);
      } else {
        // Admin can filter by any userId or userEmail
      if (userId) filters.userId = userId;
        if (userEmail) filters.userEmail = userEmail;
      }
      
      // Action filter applies to both admin and user
      if (action) filters.action = action;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const result = await activityLogService.getActivityLogs(filters, limit, skip);
      Logger.success(`📋 Activity logs: Retrieved ${result.logs.length} logs (total: ${result.total})`);
      sendJson(res, 200, result);
    } catch (error) {
      Logger.error('Get activity logs error:', error.message);
      Logger.error('Error stack:', error.stack);
      sendJson(res, 500, { error: error.message || 'Failed to get activity logs' });
    }
    return;
  }

  // Get activity logs by user (admin only)
  if (method === 'GET' && url.startsWith('/api/activity-logs/user/')) {
    if (!authService || !mongoService || !activityLogService) {
      sendJson(res, 503, { error: 'Services not available' });
      return;
    }

    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    // Check admin access
    let isAdmin = auth.isAdmin;
    if (!isAdmin) {
      const user = await mongoService.findUserById(auth.userId);
      isAdmin = user && hasAdminAccess(user.role);
    }

    if (!isAdmin) {
      sendJson(res, 403, { error: 'Forbidden: Admin access required' });
      return;
    }

    try {
      const userId = url.split('/api/activity-logs/user/')[1];
      if (!userId) {
        sendJson(res, 400, { error: 'User ID is required' });
        return;
      }

      const limit = parseInt(urlObj.searchParams.get('limit') || '100', 10);
      const skip = parseInt(urlObj.searchParams.get('skip') || '0', 10);

      const result = await activityLogService.getActivityLogsByUser(userId, limit, skip);
      sendJson(res, 200, result);
    } catch (error) {
      Logger.error('Get activity logs by user error:', error.message);
      sendJson(res, 500, { error: error.message || 'Failed to get activity logs' });
    }
    return;
  }

  // Get activity logs by action (admin only)
  if (method === 'GET' && url.startsWith('/api/activity-logs/action/')) {
    if (!authService || !mongoService || !activityLogService) {
      sendJson(res, 503, { error: 'Services not available' });
      return;
    }

    const auth = await authMiddleware(authService, mongoService)(req);
    if (!auth.authenticated) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    // Check admin access
    let isAdmin = auth.isAdmin;
    if (!isAdmin) {
      const user = await mongoService.findUserById(auth.userId);
      isAdmin = user && hasAdminAccess(user.role);
    }

    if (!isAdmin) {
      sendJson(res, 403, { error: 'Forbidden: Admin access required' });
      return;
    }

    try {
      const action = url.split('/api/activity-logs/action/')[1];
      if (!action) {
        sendJson(res, 400, { error: 'Action is required' });
        return;
      }

      const limit = parseInt(urlObj.searchParams.get('limit') || '100', 10);
      const skip = parseInt(urlObj.searchParams.get('skip') || '0', 10);

      const result = await activityLogService.getActivityLogsByAction(action, limit, skip);
      sendJson(res, 200, result);
    } catch (error) {
      Logger.error('Get activity logs by action error:', error.message);
      sendJson(res, 500, { error: error.message || 'Failed to get activity logs' });
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
      scheduleService = getScheduleService(mongoService, authService, activityLogService);
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

        const sessionId = conversationService.getSessionId(req);
        if (isConversationResetRequest(prompt)) {
          conversationService.clearConversation(sessionId);
          sendJson(res, 200, {
            reply: 'Conversation context cleared. Feel free to start with a new question.',
            source: 'system',
            conversationCleared: true
          });
          return;
        }
        
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
          // CRITICAL FIX: Preserve specific history keywords (UNESCO, heritage, campus names, dates) for vector search
          const hasSpecificHistory = /\b(unesco|heritage|mt\.?\s*hamiguitan|mhrws|san isidro|cateel|banaybanay|baganga|1972|1989|2018|doscst|mcc|mati community college)\b/i.test(prompt);
          
          if (hasSpecificHistory) {
            // Preserve original query with specific keywords
            processedPrompt = prompt + ' - Provide detailed information from the knowledge base.';
            Logger.debug(`🔍 History query with specific keywords detected - preserving: "${prompt.substring(0, 50)}..."`);
          } else {
            // Generic history query - can normalize
            processedPrompt = 'What is the history of DOrSU? Provide timeline of major events with key persons involved, including founding dates and Republic Acts.';
            Logger.debug(`🔍 History query detected - normalized`);
          }
        }
        
        // Admission requirements queries (SPECIFIC - must be checked before general enrollment)
        const admissionRequirementsPattern = /\b(admission\s+requirements|requirements\s+for\s+admission|admission\s+req|what\s+(are|do|does)\s+.*\s+(need|required|requirement))\b/i;
        const isAdmissionRequirementsQuery = admissionRequirementsPattern.test(prompt) || 
          (/\b(admission|admissions)\b/i.test(prompt) && /\b(requirements?|required|need|needed|what.*need)\b/i.test(prompt));
        
        // Detect specific student category to preserve in query
        let studentCategory = null;
        if (isAdmissionRequirementsQuery) {
          if (/\b(transferring|transfer|transferee)\b/i.test(prompt)) {
            studentCategory = 'transferring students';
          } else if (/\b(returning|returnee)\b/i.test(prompt)) {
            studentCategory = 'returning students';
          } else if (/\b(continuing)\b/i.test(prompt)) {
            studentCategory = 'continuing students';
          } else if (/\b(second.*degree|second.*course)\b/i.test(prompt)) {
            studentCategory = 'second-degree students';
          } else if (/\b(incoming.*first.*year|first.*year|freshman|freshmen|new.*student)\b/i.test(prompt)) {
            studentCategory = 'incoming first-year students';
          }
          
          // Preserve student category if detected, otherwise ask for all
          if (studentCategory) {
            processedPrompt = `What are the admission requirements for ${studentCategory} at DOrSU?`;
            Logger.debug(`🔍 Admission requirements query detected - preserving category: ${studentCategory}`);
          } else {
            processedPrompt = 'What are the admission requirements for DOrSU? Include requirements for returning students, continuing students, transferring students, second-degree students, and incoming first-year students.';
            Logger.debug(`🔍 Admission requirements query detected - normalized (all categories)`);
          }
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
        const enrollmentKeywords = /\b(enrollment|enrolment|enroll|student.*population|population)\b/i;
        const registrationKeywords = /\b(registration|register|enrollment period|enrollment schedule)\b/i;
        // Only match if query has BOTH enrollment AND registration keywords together
        const isEnrollmentQuery = enrollmentKeywords.test(prompt) && 
                                  (registrationKeywords.test(prompt) || /\b(as of|2024|2025|main campus|campus)\b/i.test(prompt)) &&
                                  !isAdmissionRequirementsQuery && 
                                  !isExamScheduleQuery;
        
        if (isExamScheduleQuery) {
          // Don't normalize exam schedule queries - preserve the exam type keywords
          // This allows the detection logic in rag.js and vector-search.js to work correctly
          processedPrompt = prompt; // Keep original query with exam type keywords
          Logger.debug(`🔍 Exam schedule query detected - preserving original query with exam keywords`);
        } else if (isEnrollmentQuery) {
          // CRITICAL: Detect "total enrollment" queries - these should refer to GRAND TOTAL for 2025-2026
          const isTotalEnrollmentQuery = /\b(total\s+enrollment|enrollment\s+total|grand\s+total|total\s+students|overall\s+enrollment)\b/i.test(prompt) &&
                                         !/\b(main campus|baganga|banaybanay|cateel|san isidro|tarragona)\b/i.test(prompt) && // Not campus-specific
                                         (/\b(2025|2026|2025-2026)\b/i.test(prompt) || /\b(semester\s*1|semester\s*2|first\s+semester|second\s+semester)\b/i.test(prompt));
          
          if (isTotalEnrollmentQuery) {
            // Normalize to ask for GRAND TOTAL enrollment for 2025-2026 semester 1
            processedPrompt = 'What is the Grand Total enrollment for DOrSU in academic year 2025-2026, 1st semester? Provide the total enrollment number from the GRAND TOTAL entry.';
            Logger.debug(`🔍 Total enrollment query detected - routing to GRAND TOTAL for 2025-2026 semester 1`);
          } else {
            // CRITICAL FIX: Preserve specific enrollment keywords (campus names, years, "as of") for vector search
            const hasSpecificEnrollment = /\b(main campus|baganga|banaybanay|cateel|san isidro|tarragona|as of|2024|2025|17251|17,251|17629|17,629)\b/i.test(prompt);
            
            if (hasSpecificEnrollment) {
              // Preserve original query with specific keywords
              processedPrompt = prompt + ' - Provide the enrollment data from the knowledge base.';
              Logger.debug(`🔍 Enrollment query with specific keywords detected - preserving: "${prompt.substring(0, 50)}..."`);
            } else {
              // Generic enrollment query - can normalize
              processedPrompt = 'What are the enrollment information and schedule for DOrSU? Include enrollment by campus and enrollment schedule.';
              Logger.debug(`🔍 Enrollment query detected - normalized`);
            }
          }
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
        // CRITICAL: "start of classes" must be detected even if query contains "program" keywords
        const schedulePattern = /\b(date|dates|schedule|schedules|calendar|when|deadline|deadlines|holiday|holidays|academic\s+calendar|semester|enrollment\s+period|registration|exam\s+schedule|class\s+schedule|start\s+of\s+classes?|start\s+of\s+class|classes?\s+start|class\s+start|timeline|time\s+table|what\s+date|what\s+dates|when\s+is|when\s+are|when\s+will|event|events|announcement|announcements|upcoming|coming|next|this\s+(week|month|year))\b/i;
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
        // CRITICAL: Program queries MUST be checked BEFORE faculty queries to avoid misrouting
        // CRITICAL: Program queries MUST exclude schedule queries (when, date, start, semester start, start of classes, etc.) to avoid misrouting
        // CRITICAL: "undergraduate program" or "graduate program" in schedule context (e.g., "start of classes for undergraduate program") should NOT be treated as program queries
        const programPattern = /\b(program|programs|course|courses)\s+(offered|available|in|at|of|does|do)\b/i;
        const isProgramQuery = programPattern.test(prompt) && 
                               !isScheduleQuery && // CRITICAL: Exclude schedule queries
                               !/\b(when|date|dates|start\s+of|start\s+of\s+classes?|start\s+of\s+class|classes?\s+start|class\s+start|schedule|semester\s+\d+\s+start|registration|enrollment|exam|examination|deadline|examination\s+schedule|exam\s+schedule)\b/i.test(prompt);
        
        // Vision/Mission queries
        const visionMissionPattern = /\b(vision|mission|what\s+is\s+.*\s+(vision|mission)|dorsu.*\s+(vision|mission)|university.*\s+(vision|mission))\b/i;
        const isVisionMissionQuery = visionMissionPattern.test(prompt);
        if (isVisionMissionQuery) {
          // CRITICAL FIX: Check if query is about library vision (must preserve "library" keyword)
          const isLibraryVisionQuery = /\b(library|learning.*information.*resource|ulirc).*vision\b/i.test(prompt) ||
                                     /\bvision.*(library|learning.*information.*resource|ulirc)\b/i.test(prompt);
          
          if (isLibraryVisionQuery) {
            // Preserve library vision query with keywords for vector search
            processedPrompt = prompt + ' - Provide the vision from the knowledge base.';
            Logger.debug(`🔍 Library vision query detected - preserving keywords: "${prompt.substring(0, 50)}..."`);
          } else {
            // Generic vision/mission query - can normalize
            processedPrompt = 'Provide the vision and mission of DOrSU from the knowledge base. Include the vision statement and all mission statements. Format: "Vision:" followed by the vision, then "Mission:" followed by all mission statements as a list.';
            Logger.debug(`🔍 Vision/Mission query detected - normalized`);
          }
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
        
        // CRITICAL: Program queries MUST be checked BEFORE faculty queries
        // If query asks "what programs" or "programs offered", prioritize programs over faculties
        // CRITICAL: Skip program normalization if this is a schedule query (already handled above)
        if (isProgramQuery && !isScheduleQuery) {
          // CRITICAL FIX: Preserve faculty-specific keywords (FACET, FALS, etc.) for vector search
          // Only normalize if query doesn't mention a specific faculty
          const hasSpecificFaculty = /\b(FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM|Faculty of Computing|Faculty of Agriculture|Faculty of Teacher|Faculty of Business|Faculty of Criminal|Faculty of Nursing|Faculty of Humanities)\b/i.test(prompt);
          
          if (hasSpecificFaculty) {
            // CRITICAL FIX: Preserve original query WITHOUT adding suffix that might confuse query type detection
            // The suffix was causing the query to be misrouted or not match program chunks correctly
            // Vector search will handle the faculty-specific matching based on the original query
            processedPrompt = prompt; // Keep original query intact for better vector search matching
            Logger.info(`🔍 [QUERY NORMALIZATION] Program query with specific faculty - PRESERVING original query: "${prompt.substring(0, 60)}..."`);
          } else {
            // Generic program query - can normalize but keep "programs" keyword
            processedPrompt = 'What programs are offered by DOrSU? List all programs with their codes and full names, organized by faculty.';
            Logger.info(`🔍 [QUERY NORMALIZATION] Generic program query - normalized: "${processedPrompt.substring(0, 60)}..."`);
          }
        }
        
        // Faculty queries (checked AFTER program queries to avoid misrouting)
        const facultyPattern = /\b(faculty|faculties|FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM|college|colleges)\s+(of|in|at)?\b/i;
        const isFacultyQuery = facultyPattern.test(prompt) && !isDeanQuery && !isProgramQuery;
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
        queryAnalysis.originalQuery = processedPrompt;
        
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
        const conversationContext = conversationService.getContext(sessionId);
        
        if (queryAnalysis.isFollowUp && conversationContext) {
          processedPrompt = conversationService.resolvePronouns(processedPrompt, conversationContext);
        }

        // CRITICAL FIX: Only block queries if they're truly vague AND have no context
        // Don't block if query has specific entities, DOrSU keywords, or question words
        // This prevents blocking valid queries that just don't match topic categories
        if (queryAnalysis.needsClarification) {
          // Double-check: Even if marked as needing clarification, allow through if:
          // 1. Query has extracted entities (acronyms, years, names, numbers, dates)
          // 2. Query has DOrSU-specific keywords
          // 3. Query has question words and sufficient length
          const hasEntities = queryAnalysis.extractedEntities && (
            queryAnalysis.extractedEntities.officeAcronyms?.length > 0 ||
            queryAnalysis.extractedEntities.years?.length > 0 ||
            queryAnalysis.extractedEntities.names?.length > 0 ||
            queryAnalysis.extractedEntities.numbers?.length > 0 ||
            queryAnalysis.extractedEntities.dates?.length > 0
          );
          
          const hasDorsuKeywords = /\b(dorsu|davao oriental|facet|fals|fted|fbm|fcje|fnahs|fhusocom|bsit|bsce|bsmath|bitm|mba|maed|mst|mses|phd|edd|suast|fhe|ospat|osa|oscd|baganga|banaybanay|cateel|san isidro|tarragona|main campus|unesco|heritage|mt\.?\s*hamiguitan|mhrws|library|learning.*information.*resource|ulirc|roy.*ponce|president|vice president|dean|director|scholarship|enrollment|student.*population|17251|17,251|17629|17,629)\b/i.test(processedPrompt);
          
          const hasQuestionWords = /\b(what|who|when|where|why|how|which|when\s+is|what\s+is|who\s+is|where\s+is|how\s+many|how\s+to|list|tell|show|provide|give)\b/i.test(processedPrompt.toLowerCase());
          const hasSufficientLength = processedPrompt.trim().length >= 20;
          
          // Only block if truly vague (no entities, no keywords, no question words, or too short)
          if (hasEntities || hasDorsuKeywords || (hasQuestionWords && hasSufficientLength)) {
            Logger.debug(`🔓 Guardrail bypass: Query has entities/keywords/question words - allowing through: "${processedPrompt.substring(0, 50)}..."`);
            // Override needsClarification to allow query through
            queryAnalysis.needsClarification = false;
          } else {
            // Truly vague query - block it
            const clarificationMessage = buildClarificationMessage(queryAnalysis);
            sendJson(res, 200, {
              reply: clarificationMessage,
              source: 'guardrail',
              requiresClarification: true
            });
            return;
          }
        }
        
        const options = {
          maxTokens: json.maxTokens ?? (isUSCQuery ? 400 : isProgramQuery ? 400 : Math.min(smartSettings.maxTokens, 400)), // Reduced for chatbot - max 400 tokens output
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
        
        // Schedule queries (including exam schedule queries) should always be treated as DOrSU queries to fetch schedule data
        const isDOrSUQuery = intentClassification.source === 'knowledge_base' || isScheduleQuery || isExamScheduleQuery;
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
          } else if (isProgramQuery && !isScheduleQuery) {
            ragSections = 12;       // Reduced for chatbot - focus on specific faculty programs
            ragTokens = 1000;       // Reduced to fit model limits
            retrievalType = '(Program list query - optimized retrieval)';
            Logger.debug(`🔍 Program query detected - using optimized retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isPresidentQuery) {
            ragSections = 8;        // Reduced for chatbot - focus on key president info
            ragTokens = 800;        // Reduced to fit model limits
            retrievalType = '(President query - optimized retrieval)';
            Logger.debug(`🔍 President query detected - using optimized retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isVPQuery) {
            ragSections = 8;        // Reduced for chatbot - focus on key VP info
            ragTokens = 800;        // Reduced to fit model limits
            retrievalType = '(VP query - optimized retrieval)';
            Logger.debug(`🔍 VP query detected - using optimized retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isSUASTQuery) {
            ragSections = 10;       // SUAST statistics
            ragTokens = 800;
            retrievalType = '(SUAST query - statistics retrieval)';
          } else if (isHistoryQuery) {
            ragSections = 10;       // Increased to find all timeline events
            ragTokens = 1000;       // Increased to accommodate more timeline events
            retrievalType = '(History query - comprehensive retrieval)';
          } else if (isAdmissionRequirementsQuery) {
            ragSections = 8;        // Reduced for chatbot - focus on specific student category
            ragTokens = 1000;       // Reduced to fit model limits
            retrievalType = '(Admission requirements query - optimized retrieval)';
            Logger.debug(`🔍 Admission requirements query detected - using optimized retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isEnrollmentQuery) {
            ragSections = 6;        // Reduced for chatbot - focus on specific campus/year
            ragTokens = 600;        // Reduced to fit model limits
            retrievalType = '(Enrollment query - optimized retrieval)';
          } else if (isOfficeHeadQuery) {
            ragSections = 6;        // Reduced for chatbot - focus on specific office
            ragTokens = 600;        // Reduced to fit model limits
            retrievalType = '(Office head query - optimized retrieval)';
            Logger.debug(`🔍 Office head query detected - using optimized retrieval: ${ragSections} sections, ${ragTokens} tokens`);
          } else if (isDeanQuery) {
            ragSections = 8;        // Reduced for chatbot - focus on key deans
            ragTokens = 700;        // Reduced to fit model limits
            retrievalType = '(Dean query - optimized retrieval)';
          } else if (isDirectorQuery) {
            ragSections = 8;        // Reduced for chatbot - focus on key directors
            ragTokens = 700;        // Reduced to fit model limits
            retrievalType = '(Director query - optimized retrieval)';
          }
          
          relevantContext = await ragService.getContextForTopic(
            processedPrompt,
            ragTokens,
            ragSections,
            false, // suggestMore
            scheduleService, // Pass scheduleService for calendar event retrieval
            userType
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
          
          // Fetch schedule events if query is schedule-related (including exam schedule queries)
          let scheduleContext = '';
          let scheduleInstruction = '';
          if ((isScheduleQuery || isExamScheduleQuery) && scheduleService && mongoService) {
            try {
              // CRITICAL: Extract year/month from query for better filtering (same as rag.js)
              const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                                 'july', 'august', 'september', 'october', 'november', 'december'];
              const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                                'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
              
              let requestedMonth = null;
              let requestedYear = null;
              
              const queryLower = processedPrompt.toLowerCase();
              
              // CRITICAL: Extract year - handle academic year patterns (AY 2024-2025, 2024-2025)
              // For academic year queries, use the second year (e.g., AY 2024-2025 -> 2025)
              // This is because events like commencement exercises happen in the second year
              const academicYearMatch = queryLower.match(/\b(ay|academic\s+year)\s*(\d{4})\s*[-–]\s*(\d{4})\b/i) || 
                                        queryLower.match(/\b(\d{4})\s*[-–]\s*(\d{4})\b/);
              if (academicYearMatch) {
                // Extract the second year from academic year pattern (e.g., AY 2024-2025 -> 2025)
                const secondYear = academicYearMatch[3] || academicYearMatch[2];
                requestedYear = parseInt(secondYear, 10);
                Logger.debug(`📅 Server: Academic year pattern detected: extracted second year ${requestedYear} from academic year query`);
              } else {
                // Extract year (4 digits) - use the last/latest year if multiple years are mentioned
                const yearMatches = queryLower.match(/\b(20\d{2})\b/g);
                if (yearMatches && yearMatches.length > 0) {
                  // If multiple years, use the latest one (e.g., "2024 and 2025" -> 2025)
                  const years = yearMatches.map(y => parseInt(y, 10));
                  requestedYear = Math.max(...years);
                  if (yearMatches.length > 1) {
                    Logger.debug(`📅 Server: Multiple years detected: ${yearMatches.join(', ')}, using latest: ${requestedYear}`);
                  }
                }
              }
              
              // Extract month
              monthNames.forEach((month, index) => {
                if (queryLower.includes(month)) {
                  requestedMonth = index; // 0-11
                }
              });
              if (requestedMonth === null) {
                monthAbbr.forEach((month, index) => {
                  if (queryLower.includes(month)) {
                    requestedMonth = index; // 0-11
                  }
                });
              }
              
              // CRITICAL: Extract exam type from query for exam schedule queries
              // This ensures exam queries only get exam events, not all schedule events
              let examTypeForQuery = null;
              if (isExamScheduleQuery) {
                const hasPrelim = /\b(prelim|preliminary|prelims?)\b/i.test(processedPrompt);
                const hasMidterm = /\b(midterm|mid-term|mid\s+term)\b/i.test(processedPrompt);
                const hasFinal = /\b(final|finals?)\b/i.test(processedPrompt);
                
                // Determine exam type - prioritize specific types, fallback to null if multiple or none
                if (hasFinal && !hasPrelim && !hasMidterm) {
                  examTypeForQuery = 'final';
                } else if (hasPrelim && !hasFinal && !hasMidterm) {
                  examTypeForQuery = 'prelim';
                } else if (hasMidterm && !hasFinal && !hasPrelim) {
                  examTypeForQuery = 'midterm';
                }
                // If multiple exam types or none specific, leave as null (will filter JS-side)
                
                Logger.debug(`📅 Server: Exam schedule query detected - examType: ${examTypeForQuery || 'multiple/none (will filter JS-side)'}`);
              }
              
              // Calculate date range based on query
              const now = new Date();
              let startDate = new Date(now);
              let endDate = new Date(now);
              
              if (requestedMonth !== null && requestedYear) {
                // User specified month and year - filter to that month
                startDate = new Date(requestedYear, requestedMonth, 1);
                endDate = new Date(requestedYear, requestedMonth + 1, 0, 23, 59, 59); // Last day of month
                Logger.debug(`📅 Server: Filtering schedule events to ${monthNames[requestedMonth]} ${requestedYear}`);
              } else if (requestedYear) {
                // User specified year only - filter to that year
                startDate = new Date(requestedYear, 0, 1);
                endDate = new Date(requestedYear, 11, 31, 23, 59, 59);
                Logger.debug(`📅 Server: Filtering schedule events to year ${requestedYear}`);
              } else {
                // Default: Past 30 days to future 365 days
                startDate.setDate(startDate.getDate() - 30); // Past 30 days
                endDate.setDate(endDate.getDate() + 365); // Next 365 days
              }
              
              const events = await scheduleService.getEvents({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                limit: 100, // Get up to 100 events
                examType: examTypeForQuery // CRITICAL: Pass exam type for exam schedule queries
              });
              
              if (events && events.length > 0) {
                // CRITICAL: Filter events by exam type first (if exam query), then by year/month
                let filteredEvents = events;
                
                // CRITICAL: Filter by exam type if this is an exam schedule query
                // This ensures we only get exam events, not registration or other events
                if (isExamScheduleQuery) {
                  const beforeExamFilter = filteredEvents.length;
                  const hasPrelim = /\b(prelim|preliminary|prelims?)\b/i.test(processedPrompt);
                  const hasMidterm = /\b(midterm|mid-term|mid\s+term)\b/i.test(processedPrompt);
                  const hasFinal = /\b(final|finals?)\b/i.test(processedPrompt);
                  
                  filteredEvents = filteredEvents.filter(event => {
                    const titleLower = (event.title || '').toLowerCase();
                    // Use OR logic to match ANY of the requested exam types
                    let matches = false;
                    if (hasPrelim) matches = matches || titleLower.includes('prelim') || titleLower.includes('preliminary');
                    if (hasMidterm) matches = matches || titleLower.includes('midterm');
                    if (hasFinal) matches = matches || titleLower.includes('final');
                    return matches;
                  });
                  
                  if (beforeExamFilter !== filteredEvents.length) {
                    const examTypes = [];
                    if (hasPrelim) examTypes.push('prelim');
                    if (hasMidterm) examTypes.push('midterm');
                    if (hasFinal) examTypes.push('final');
                    Logger.debug(`📅 Server: Filtered ${beforeExamFilter} events to ${filteredEvents.length} for exam types: ${examTypes.join(', ')}`);
                  }
                }
                
                // CRITICAL: Filter events by year/month if specified (post-query filtering as safety net)
                if (requestedMonth !== null && requestedYear) {
                  const beforeFilter = filteredEvents.length;
                  filteredEvents = filteredEvents.filter(event => {
                    // For month-only events, check year and month match exactly
                    if (event.dateType === 'month_only' || event.isMonthOnly) {
                      const eventYear = event.year || (event.isoDate ? new Date(event.isoDate).getFullYear() : null);
                      const eventMonth = event.month || (event.isoDate ? new Date(event.isoDate).getMonth() + 1 : null);
                      // Month is 1-based in event.month, but 0-based in requestedMonth
                      return eventYear === requestedYear && eventMonth === (requestedMonth + 1);
                    }
                    
                    // For date ranges, check if the requested month/year overlaps with the range
                    if (event.dateType === 'date_range' && event.startDate && event.endDate) {
                      const rangeStart = new Date(event.startDate);
                      const rangeEnd = new Date(event.endDate);
                      if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) return false;
                      
                      // CRITICAL: Check that at least one date in the range is in the requested year
                      const rangeStartYear = rangeStart.getFullYear();
                      const rangeEndYear = rangeEnd.getFullYear();
                      if (rangeStartYear !== requestedYear && rangeEndYear !== requestedYear) {
                        return false;
                      }
                      
                      const queryStart = new Date(requestedYear, requestedMonth, 1);
                      const queryEnd = new Date(requestedYear, requestedMonth + 1, 0, 23, 59, 59);
                      return (rangeStart <= queryEnd && rangeEnd >= queryStart);
                    } else {
                      // For single dates, check if it's in the requested month/year
                      const dateValue = event.isoDate || event.date;
                      if (!dateValue) return false;
                      const eventDate = new Date(dateValue);
                      if (isNaN(eventDate.getTime())) return false;
                      return eventDate.getMonth() === requestedMonth && eventDate.getFullYear() === requestedYear;
                    }
                  });
                  if (beforeFilter !== filteredEvents.length) {
                    Logger.debug(`📅 Server: Filtered ${beforeFilter} events to ${filteredEvents.length} for ${monthNames[requestedMonth]} ${requestedYear}`);
                  }
                } else if (requestedYear) {
                  const beforeFilter = filteredEvents.length;
                  filteredEvents = filteredEvents.filter(event => {
                    // For month-only events, check year matches exactly
                    if (event.dateType === 'month_only' || event.isMonthOnly) {
                      const eventYear = event.year || (event.isoDate ? new Date(event.isoDate).getFullYear() : null);
                      return eventYear === requestedYear;
                    }
                    
                    // For date ranges, check if the range includes the requested year
                    if (event.dateType === 'date_range' && event.startDate && event.endDate) {
                      const rangeStart = new Date(event.startDate);
                      const rangeEnd = new Date(event.endDate);
                      if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) return false;
                      const rangeStartYear = rangeStart.getFullYear();
                      const rangeEndYear = rangeEnd.getFullYear();
                      return (rangeStartYear <= requestedYear && rangeEndYear >= requestedYear);
                    } else {
                      // For single dates, check if year matches exactly
                      const dateValue = event.isoDate || event.date;
                      if (!dateValue) return false;
                      const eventDate = new Date(dateValue);
                      if (isNaN(eventDate.getTime())) return false;
                      return eventDate.getFullYear() === requestedYear;
                    }
                  });
                  if (beforeFilter !== filteredEvents.length) {
                    Logger.debug(`📅 Server: Filtered ${beforeFilter} events to ${filteredEvents.length} for year ${requestedYear}`);
                  }
                }
                
                // Helper function to format date concisely (e.g., "Jan 11, 2025" or "Jan 11 - Jan 15, 2025")
                // CRITICAL: Always include year to prevent confusion
                // CRITICAL: Use Philippine timezone to prevent date shifts (e.g., Dec 1 -> Nov 30)
                const formatDateConcise = (date, includeYear = true) => {
                  if (!date) return 'Date TBD';
                  const d = new Date(date);
                  if (isNaN(d.getTime())) return 'Date TBD';
                  // Use timezone-aware formatting to ensure correct date in Philippine timezone
                  const month = formatDateInTimezone(d, { month: 'short' });
                  const day = formatDateInTimezone(d, { day: 'numeric' });
                  const year = formatDateInTimezone(d, { year: 'numeric' });
                  if (!month || !day) return 'Date TBD';
                  return includeYear && year ? `${month} ${day}, ${year}` : `${month} ${day}`;
                };
                
                // Group events by title to avoid redundancy
                const groupedEvents = new Map();
                filteredEvents.forEach(event => {
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
                  
                  // CRITICAL: For month-only events, format differently
                  if (firstEvent.dateType === 'month_only' || firstEvent.isMonthOnly) {
                    const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June',
                                          'July', 'August', 'September', 'October', 'November', 'December'];
                    const monthNum = firstEvent.month || (firstEvent.isoDate ? new Date(firstEvent.isoDate).getMonth() + 1 : null);
                    const monthName = firstEvent.monthName || (monthNum ? monthNamesFull[monthNum - 1] : null);
                    // CRITICAL: Use explicit year field first, then extract from date
                    let year = firstEvent.year;
                    if (!year && firstEvent.isoDate) {
                      const dateObj = new Date(firstEvent.isoDate);
                      if (!isNaN(dateObj.getTime())) {
                        year = dateObj.getFullYear();
                      }
                    }
                    // Fallback to requested year or current year
                    if (!year) {
                      year = requestedYear || new Date().getFullYear();
                    }
                    if (monthName && year) {
                      eventInfo += `  📅 Date: ${monthName} ${year} (month-only event, no specific date)\n`;
                    } else {
                      eventInfo += `  📅 Date: Date TBD\n`;
                    }
                  } else {
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
                        const start = formatDateConcise(startDate, true);
                        const end = formatDateConcise(endDate, true);
                        eventInfo += `  📅 Date: ${start} - ${end}\n`;
                      } else {
                        // Multiple ranges - show first and last
                        const firstStart = formatDateConcise(startDate, true);
                        const lastEnd = formatDateConcise(endDate, true);
                        eventInfo += `  📅 Dates: ${firstStart} - ${lastEnd}\n`;
                      }
                    } else {
                      // Mix of single dates and ranges, or all single dates
                      const dates = [];
                      eventGroup.forEach(event => {
                        if (event.dateType === 'date_range' && event.startDate && event.endDate) {
                          const start = formatDateConcise(event.startDate, true);
                          const end = formatDateConcise(event.endDate, true);
                          dates.push(`${start} - ${end}`);
                        } else if (event.isoDate || event.date) {
                          dates.push(formatDateConcise(event.isoDate || event.date, true));
                        }
                      });
                      
                      if (dates.length > 0) {
                        // Remove duplicates and format
                        const uniqueDates = [...new Set(dates)];
                        
                        if (uniqueDates.length === 1) {
                          eventInfo += `  📅 Date: ${uniqueDates[0]}\n`;
                        } else if (uniqueDates.length <= 3) {
                          eventInfo += `  📅 Dates: ${uniqueDates.join(', ')}\n`;
                        } else {
                          // Too many dates, show range
                          const firstDate = uniqueDates[0];
                          const lastDate = uniqueDates[uniqueDates.length - 1];
                          eventInfo += `  📅 Dates: ${firstDate} - ${lastDate}\n`;
                        }
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
                
                Logger.info(`📅 Schedule: Fetched ${filteredEvents.length} events for schedule query${requestedYear ? ` (filtered to ${requestedMonth !== null ? `${monthNames[requestedMonth]} ` : ''}${requestedYear})` : ''}`);
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
          if ((isScheduleQuery || isExamScheduleQuery) && mongoService) {
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
                    // CRITICAL: Use timezone-aware formatting to prevent date shifts
                    const month = formatDateInTimezone(postDate, { month: 'short' });
                    const day = formatDateInTimezone(postDate, { day: 'numeric' });
                    const year = formatDateInTimezone(postDate, { year: 'numeric' });
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
                  // CRITICAL: Extract year/month from query for better filtering (reuse variables from above if available)
                  // If not already extracted, extract them here
                  if (typeof requestedYear === 'undefined' || typeof requestedMonth === 'undefined') {
                    const monthNamesLocal = ['january', 'february', 'march', 'april', 'may', 'june', 
                                           'july', 'august', 'september', 'october', 'november', 'december'];
                    const monthAbbrLocal = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                                          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                    
                    let requestedMonthLocal = null;
                    let requestedYearLocal = null;
                    
                    const queryLowerLocal = processedPrompt.toLowerCase();
                    
                    // CRITICAL: Extract year - handle academic year patterns (AY 2024-2025, 2024-2025)
                    // For academic year queries, use the second year (e.g., AY 2024-2025 -> 2025)
                    const academicYearMatchLocal = queryLowerLocal.match(/\b(ay|academic\s+year)\s*(\d{4})\s*[-–]\s*(\d{4})\b/i) || 
                                                   queryLowerLocal.match(/\b(\d{4})\s*[-–]\s*(\d{4})\b/);
                    if (academicYearMatchLocal) {
                      // Extract the second year from academic year pattern (e.g., AY 2024-2025 -> 2025)
                      const secondYear = academicYearMatchLocal[3] || academicYearMatchLocal[2];
                      requestedYearLocal = parseInt(secondYear, 10);
                      Logger.debug(`📅 Server (fallback): Academic year pattern detected: extracted second year ${requestedYearLocal}`);
                    } else {
                      // Extract year (4 digits) - use the last/latest year if multiple years are mentioned
                      const yearMatchesLocal = queryLowerLocal.match(/\b(20\d{2})\b/g);
                      if (yearMatchesLocal && yearMatchesLocal.length > 0) {
                        // If multiple years, use the latest one (e.g., "2024 and 2025" -> 2025)
                        const years = yearMatchesLocal.map(y => parseInt(y, 10));
                        requestedYearLocal = Math.max(...years);
                        if (yearMatchesLocal.length > 1) {
                          Logger.debug(`📅 Server (fallback): Multiple years detected: ${yearMatchesLocal.join(', ')}, using latest: ${requestedYearLocal}`);
                        }
                      }
                    }
                    
                    // Extract month
                    monthNamesLocal.forEach((month, index) => {
                      if (queryLowerLocal.includes(month)) {
                        requestedMonthLocal = index; // 0-11
                      }
                    });
                    if (requestedMonthLocal === null) {
                      monthAbbrLocal.forEach((month, index) => {
                        if (queryLowerLocal.includes(month)) {
                          requestedMonthLocal = index; // 0-11
                        }
                      });
                    }
                    
                    // Use local variables if global ones weren't set
                    if (typeof requestedYear === 'undefined') requestedYear = requestedYearLocal;
                    if (typeof requestedMonth === 'undefined') requestedMonth = requestedMonthLocal;
                  }
                  
                  // Calculate date range based on query
                  const now = new Date();
                  let startDate = new Date(now);
                  let endDate = new Date(now);
                  
                  if (requestedMonth !== null && requestedMonth !== undefined && requestedYear) {
                    // User specified month and year - filter to that month
                    startDate = new Date(requestedYear, requestedMonth, 1);
                    endDate = new Date(requestedYear, requestedMonth + 1, 0, 23, 59, 59);
                  } else if (requestedYear) {
                    // User specified year only - filter to that year
                    startDate = new Date(requestedYear, 0, 1);
                    endDate = new Date(requestedYear, 11, 31, 23, 59, 59);
                  } else {
                    // Default: Past 30 days to future 365 days
                    startDate.setDate(startDate.getDate() - 30);
                    endDate.setDate(endDate.getDate() + 365);
                  }
                  
                  // CRITICAL: Extract exam type from query for exam schedule queries (same as above)
                  let examTypeForQueryLocal = null;
                  if (isExamScheduleQuery) {
                    const hasPrelim = /\b(prelim|preliminary|prelims?)\b/i.test(processedPrompt);
                    const hasMidterm = /\b(midterm|mid-term|mid\s+term)\b/i.test(processedPrompt);
                    const hasFinal = /\b(final|finals?)\b/i.test(processedPrompt);
                    
                    if (hasFinal && !hasPrelim && !hasMidterm) {
                      examTypeForQueryLocal = 'final';
                    } else if (hasPrelim && !hasFinal && !hasMidterm) {
                      examTypeForQueryLocal = 'prelim';
                    } else if (hasMidterm && !hasFinal && !hasPrelim) {
                      examTypeForQueryLocal = 'midterm';
                    }
                  }
                  
                  const events = await scheduleService.getEvents({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    limit: 50,
                    examType: examTypeForQueryLocal // CRITICAL: Pass exam type for exam schedule queries
                  });
                  
                  if (events && events.length > 0) {
                    // CRITICAL: Filter events by exam type first (if exam query), then by year/month
                    let filteredEventsLocal = events;
                    
                    // CRITICAL: Filter by exam type if this is an exam schedule query
                    if (isExamScheduleQuery) {
                      const beforeExamFilter = filteredEventsLocal.length;
                      const hasPrelim = /\b(prelim|preliminary|prelims?)\b/i.test(processedPrompt);
                      const hasMidterm = /\b(midterm|mid-term|mid\s+term)\b/i.test(processedPrompt);
                      const hasFinal = /\b(final|finals?)\b/i.test(processedPrompt);
                      
                      filteredEventsLocal = filteredEventsLocal.filter(event => {
                        const titleLower = (event.title || '').toLowerCase();
                        let matches = false;
                        if (hasPrelim) matches = matches || titleLower.includes('prelim') || titleLower.includes('preliminary');
                        if (hasMidterm) matches = matches || titleLower.includes('midterm');
                        if (hasFinal) matches = matches || titleLower.includes('final');
                        return matches;
                      });
                      
                      if (beforeExamFilter !== filteredEventsLocal.length) {
                        const examTypes = [];
                        if (hasPrelim) examTypes.push('prelim');
                        if (hasMidterm) examTypes.push('midterm');
                        if (hasFinal) examTypes.push('final');
                        Logger.debug(`📅 Server (fallback): Filtered ${beforeExamFilter} events to ${filteredEventsLocal.length} for exam types: ${examTypes.join(', ')}`);
                      }
                    }
                    
                    // CRITICAL: Filter events by year/month if specified (post-query filtering as safety net)
                    if (requestedMonth !== null && requestedMonth !== undefined && requestedYear) {
                      const beforeFilter = filteredEventsLocal.length;
                      filteredEventsLocal = filteredEventsLocal.filter(event => {
                        // For month-only events, check year and month match exactly
                        if (event.dateType === 'month_only' || event.isMonthOnly) {
                          const eventYear = event.year || (event.isoDate ? new Date(event.isoDate).getFullYear() : null);
                          const eventMonth = event.month || (event.isoDate ? new Date(event.isoDate).getMonth() + 1 : null);
                          return eventYear === requestedYear && eventMonth === (requestedMonth + 1);
                        }
                        
                        // For date ranges, check if the requested month/year overlaps with the range
                        if (event.dateType === 'date_range' && event.startDate && event.endDate) {
                          const rangeStart = new Date(event.startDate);
                          const rangeEnd = new Date(event.endDate);
                          if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) return false;
                          const rangeStartYear = rangeStart.getFullYear();
                          const rangeEndYear = rangeEnd.getFullYear();
                          if (rangeStartYear !== requestedYear && rangeEndYear !== requestedYear) {
                            return false;
                          }
                          const queryStart = new Date(requestedYear, requestedMonth, 1);
                          const queryEnd = new Date(requestedYear, requestedMonth + 1, 0, 23, 59, 59);
                          return (rangeStart <= queryEnd && rangeEnd >= queryStart);
                        } else {
                          // For single dates, check if it's in the requested month/year
                          const dateValue = event.isoDate || event.date;
                          if (!dateValue) return false;
                          const eventDate = new Date(dateValue);
                          if (isNaN(eventDate.getTime())) return false;
                          return eventDate.getMonth() === requestedMonth && eventDate.getFullYear() === requestedYear;
                        }
                      });
                      if (beforeFilter !== filteredEventsLocal.length) {
                        Logger.debug(`📅 Server (fallback): Filtered ${beforeFilter} events to ${filteredEventsLocal.length} for ${requestedMonth !== null ? `${monthNamesLocal[requestedMonth]} ` : ''}${requestedYear}`);
                      }
                    } else if (requestedYear) {
                      const beforeFilter = filteredEventsLocal.length;
                      filteredEventsLocal = filteredEventsLocal.filter(event => {
                        if (event.dateType === 'month_only' || event.isMonthOnly) {
                          const eventYear = event.year || (event.isoDate ? new Date(event.isoDate).getFullYear() : null);
                          return eventYear === requestedYear;
                        }
                        if (event.dateType === 'date_range' && event.startDate && event.endDate) {
                          const rangeStart = new Date(event.startDate);
                          const rangeEnd = new Date(event.endDate);
                          if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) return false;
                          const rangeStartYear = rangeStart.getFullYear();
                          const rangeEndYear = rangeEnd.getFullYear();
                          return (rangeStartYear <= requestedYear && rangeEndYear >= requestedYear);
                        } else {
                          const dateValue = event.isoDate || event.date;
                          if (!dateValue) return false;
                          const eventDate = new Date(dateValue);
                          if (isNaN(eventDate.getTime())) return false;
                          return eventDate.getFullYear() === requestedYear;
                        }
                      });
                      if (beforeFilter !== filteredEventsLocal.length) {
                        Logger.debug(`📅 Server (fallback): Filtered ${beforeFilter} events to ${filteredEventsLocal.length} for year ${requestedYear}`);
                      }
                    }
                    
                    const formattedEvents = filteredEventsLocal.slice(0, 20).map(event => {
                      let eventText = `- **${event.title || 'Untitled Event'}**\n`;
                      
                      // CRITICAL: Handle month-only events
                      if (event.dateType === 'month_only' || event.isMonthOnly) {
                        const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June',
                                              'July', 'August', 'September', 'October', 'November', 'December'];
                        const monthNum = event.month || (event.isoDate ? new Date(event.isoDate).getMonth() + 1 : null);
                        const monthName = event.monthName || (monthNum ? monthNamesFull[monthNum - 1] : null);
                        let year = event.year || (event.isoDate ? new Date(event.isoDate).getFullYear() : null);
                        if (!year) year = requestedYear || new Date().getFullYear();
                        if (monthName && year) {
                          eventText += `  📅 Date: ${monthName} ${year} (month-only event, no specific date)\n`;
                        } else {
                          eventText += `  📅 Date: Date TBD\n`;
                        }
                      } else if (event.isoDate || event.date) {
                        const eventDate = new Date(event.isoDate || event.date);
                        // CRITICAL: Use timezone-aware formatting to prevent date shifts
                        // CRITICAL: Always include year
                        const month = formatDateInTimezone(eventDate, { month: 'short' });
                        const day = formatDateInTimezone(eventDate, { day: 'numeric' });
                        const year = formatDateInTimezone(eventDate, { year: 'numeric' });
                        eventText += `  📅 Date: ${month} ${day}, ${year}\n`;
                      } else if (event.dateType === 'date_range' && event.startDate && event.endDate) {
                        const startDateObj = new Date(event.startDate);
                        const endDateObj = new Date(event.endDate);
                        if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
                          const start = formatDateInTimezone(startDateObj, { year: 'numeric', month: 'short', day: 'numeric' });
                          const end = formatDateInTimezone(endDateObj, { year: 'numeric', month: 'short', day: 'numeric' });
                          if (start && end) {
                            eventText += `  📅 Date: ${start} - ${end}\n`;
                          }
                        }
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
                      postsContext += `\n\n=== SCHEDULE EVENTS (${filteredEventsLocal.length} events found) ===\n` +
                        `The following are calendar events with specific dates:\n\n` +
                        formattedEvents.join('\n') +
                        `\n=== END OF SCHEDULE EVENTS ===\n`;
                    } else {
                      postsContext = `\n\n=== SCHEDULE EVENTS (${filteredEventsLocal.length} events found) ===\n` +
                        `The following are calendar events with specific dates:\n\n` +
                        formattedEvents.join('\n') +
                        `\n=== END OF SCHEDULE EVENTS ===\n`;
                    }
                    
                    Logger.info(`📅 Schedule (fallback): Fetched ${filteredEventsLocal.length} events for schedule query${requestedYear ? ` (filtered to ${requestedMonth !== null && requestedMonth !== undefined ? `${monthNamesLocal[requestedMonth]} ` : ''}${requestedYear})` : ''}`);
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
          if (isScheduleQuery || isExamScheduleQuery) {
            dataSourceInstructions = '\n📅 DATA SOURCE FOR THIS QUERY:\n' +
              '• For dates, schedules, events, announcements, and timelines → Use ONLY the "SCHEDULE EVENTS" section above (from "schedule" collection)\n' +
              '• The schedule collection contains all calendar events, announcements, and posts\n' +
              '• DO NOT use general knowledge or training data about dates, events, or announcements\n' +
              '• If schedule events are provided above, use those EXACT dates and information\n' +
              '• Check both calendar events and announcements/events sections as they are from the unified schedule collection\n' +
              (isExamScheduleQuery ? '• CRITICAL: For exam schedule queries, ONLY use exam events (prelim, midterm, or final examination) from the schedule events above\n' : '') +
              '\n';
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
          } else if (isProgramQuery && !isScheduleQuery) {
            dataSourceInstructions = getProgramInstructions();
          } else if (isAdmissionRequirementsQuery) {
            dataSourceInstructions = getAdmissionRequirementsInstructions();
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
              (isProgramQuery && !isScheduleQuery) ?
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

if (process.env.NODE_ENV !== 'test') {
  server.listen(port, '0.0.0.0', () => {
    Logger.success(`Server: http://localhost:${port}`);
    Logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

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

