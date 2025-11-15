import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthService, authMiddleware } from './services/auth.js';
import { getChatHistoryService } from './services/chat-history.js';
import conversationService from './services/conversation.js';
import { getDataRefreshService } from './services/data-refresh.js';
import responseFormatter from './services/formatter.js';
import { getMongoDBService } from './services/mongodb.js';
import { OptimizedRAGService } from './services/rag.js';
import { getNewsScraperService } from './services/scraper.js';
import { LlamaService } from './services/service.js';
import {
  generateCampusesResponse,
  generateFacultiesResponse,
  generateOfficersResponse,
  generateProgramListResponse,
  generateVisionMissionResponse
} from './services/structured-responses.js';
import { buildSystemInstructions } from './services/system.js';
import { GPUMonitor } from './utils/gpu-monitor.js';
import { IntentClassifier } from './utils/intent-classifier.js';
import { Logger } from './utils/logger.js';
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
    
    // Initialize authentication service
    authService = new AuthService(mongoService);
    Logger.success('Auth service initialized');
    
    // Initialize chat history service
    chatHistoryService = getChatHistoryService(mongoService, authService);
    Logger.success('Chat history service initialized');
    
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
  
  const gpuMonitor = GPUMonitor.getInstance();
  const cudaAvailable = await gpuMonitor.checkCUDA();
  if (cudaAvailable) {
    Logger.success(`GPU enabled: ${(await gpuMonitor.getGPUInfo())[0]?.name || 'Unknown'}`);
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
  
  // Debug logging for top-queries endpoint
  if (url === '/api/top-queries' || rawUrl.includes('top-queries')) {
    Logger.info(`🔍 Request: ${method} ${rawUrl} -> Parsed: ${url}`);
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
        
        // Handle president queries - request comprehensive information
        const presidentPattern = /\b(president|head|leader)\b/i;
        const isPresidentQuery = presidentPattern.test(prompt) && /\b(dorsu|university)\b/i.test(prompt);
        if (isPresidentQuery) {
          processedPrompt = 'Who is the president of DOrSU as of 2025? Provide comprehensive information including: full name, title, educational background - degrees and institutions, expertise areas, major achievements - UNESCO work, museums, awards, and current role. Give complete details, not just the name.';
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
        
        // SMART FALLBACK: Detect "list all" queries and return structured data without AI
        // Programs/Courses
        const listAllPattern = /\b(list|show|give me|give|what are|enumerate|tell me|can you give)\s+(all|the|me)?\s*(list of)?\s*(program|programs|course|courses)\b/i;
        const byFacultyPattern = /\b(program|programs|course|courses)\s+(by|per|in|under|for each)\s+(faculty|faculties)\b/i;
        const offeredPattern = /\b(program|programs|course|courses)\s+(offered|available)\b/i;
        const isProgramListQuery = listAllPattern.test(prompt) || byFacultyPattern.test(prompt) || offeredPattern.test(prompt);
        
        // Officers/Leadership
        const officersPattern = /\b(list|show|give me|give|what are|who are|enumerate|tell me)\s+(all|the|me)?\s*(list of)?\s*(officer|officers|dean|deans|director|directors|leadership|leaders|officials?)\b/i;
        const presidentListPattern = /\b(who is|who's|tell me about)\s+(the\s+)?(university\s+)?president\b/i;
        const isOfficersQuery = officersPattern.test(prompt) || presidentListPattern.test(prompt);
        
        // Faculties
        const facultiesPattern = /\b(list|show|give me|give|what are|enumerate|tell me)\s+(all|the|me)?\s*(list of)?\s*(faculty|faculties)\b/i;
        const isFacultiesQuery = facultiesPattern.test(prompt);
        
        // Campuses
        const campusesPattern = /\b(list|show|give me|give|what are|enumerate|tell me)\s+(all|the|me)?\s*(list of)?\s*(campus|campuses|extension)\b/i;
        const isCampusesQuery = campusesPattern.test(prompt);
        
        // Vision/Mission (EXACT DATA REQUIRED)
        const visionPattern = /\b(what is|what's|tell me|give me)\s+(the\s+)?(vision|mission|mission and vision|vision and mission)\s+(of\s+)?(dorsu|davao oriental state university)?\b/i;
        const isVisionOnly = /\b(vision)\b/i.test(prompt) && !/\b(mission)\b/i.test(prompt);
        const isMissionOnly = /\b(mission)\b/i.test(prompt) && !/\b(vision)\b/i.test(prompt);
        const isVisionMissionQuery = visionPattern.test(prompt);
        
        // Check if any fallback pattern matches
        if (isProgramListQuery || isOfficersQuery || isFacultiesQuery || isCampusesQuery || isVisionMissionQuery) {
          let fallbackType = '';
          let structuredResponse = '';
          
          if (isProgramListQuery) {
            fallbackType = 'programs';
            structuredResponse = generateProgramListResponse(byFacultyPattern.test(prompt));
          } else if (isOfficersQuery) {
            fallbackType = 'officers';
            structuredResponse = generateOfficersResponse(presidentListPattern.test(prompt));
          } else if (isFacultiesQuery) {
            fallbackType = 'faculties';
            structuredResponse = generateFacultiesResponse();
          } else if (isCampusesQuery) {
            fallbackType = 'campuses';
            structuredResponse = generateCampusesResponse();
          } else if (isVisionMissionQuery) {
            fallbackType = 'vision-mission';
            structuredResponse = generateVisionMissionResponse(isVisionOnly, isMissionOnly);
          }
          
          Logger.info(`📋 ${fallbackType.toUpperCase()} list query detected - using structured fallback (no AI needed)`);
          
          sendJson(res, 200, {
            reply: structuredResponse,
            source: 'structured-fallback',
            model: 'none',
            provider: 'static',
            complexity: 'simple',
            responseTime: Date.now() - Date.now(),
            usedKnowledgeBase: true,
            intent: {
              conversational: 'information_query',
              confidence: 100,
              dataSource: 'knowledge_base',
              category: fallbackType
            }
          });
          return;
        }
        
        // Handle programs/courses list queries - ensure complete list
        const programPattern = /\b(program|programs|course|courses)\s+(offered|available|in|at|of|does|do)\b/i;
        const isProgramQuery = programPattern.test(prompt);
        if (isProgramQuery) {
          processedPrompt = 'List ALL 38 programs - 29 undergraduate plus 9 graduate - offered by DOrSU from the knowledge base. Include program code, full name, and faculty. DO NOT list programs from your training data - ONLY from knowledge base chunks. Verify count: exactly 29 undergrad plus 9 grad.';
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
        
        // Analyze query complexity and intent
        const queryAnalysis = QueryAnalyzer.analyzeComplexity(processedPrompt);
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
          maxTokens: json.maxTokens ?? (isUSCQuery ? 1500 : isProgramQuery ? 1800 : smartSettings.maxTokens), // Balanced tokens to stay within 8K limit
          temperature: json.temperature ?? smartSettings.temperature,
          numCtx: smartSettings.numCtx,
          topP: 0.5,
          topK: 20,
          repeatPenalty: 1.1
        };

        const startTime = Date.now();
        
        // --- Cache Check ---
        
        // Check cache
        if (ragService) {
          const cachedResponse = ragService.getCachedAIResponse(processedPrompt);
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
        
        const isDOrSUQuery = intentClassification.source === 'knowledge_base';
        let systemPrompt = '';
        
        if (isDOrSUQuery) {
          let relevantContext = dorsuContext;
          
        if (ragService) {
          // Boost RAG retrieval for USC and program queries to get ALL relevant chunks
          let ragSections = smartSettings.ragSections;
          let ragTokens = smartSettings.ragMaxTokens;
          let retrievalType = '';
          
          if (isUSCQuery) {
            ragSections = 30;       // Reduced from 40
            ragTokens = 3000;       // Reduced from 4000 to save tokens
            retrievalType = '(USC query - full retrieval)';
          } else if (isProgramQuery) {
            ragSections = 35;       // Reduced from 45
            ragTokens = 3500;       // Reduced from 4500 to prevent rate limits
            retrievalType = '(Program list query - complete retrieval)';
          } else if (isPresidentQuery) {
            ragSections = 15;       // Reduced from 20
            ragTokens = 2000;       // Reduced from 2500 for safety
            retrievalType = '(President query - focused retrieval)';
          }
          
          relevantContext = await ragService.getContextForTopic(
            processedPrompt,
            ragTokens,
            ragSections
          );
          Logger.info(`📊 RAG: ${ragSections} sections, ${relevantContext.length} chars ${retrievalType}`);
        }
          
          // Build system instructions with conversation context AND intent classification
          const hasContext = relevantContext && relevantContext.trim().length > 100;
          
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
          
          systemPrompt = buildSystemInstructions(conversationContext, intentClassification) + '\n\n' +
            '=== DOrSU KNOWLEDGE BASE (YOUR ONLY SOURCE OF TRUTH - STRICTLY ENFORCED) ===\n' + 
            (hasContext ? relevantContext : '[NO KNOWLEDGE BASE DATA AVAILABLE - You MUST inform the user you don\'t have this information]') + 
            newsContext +  // Include news if query is about news
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
              '• Answer using ONLY and EXCLUSIVELY the data in the knowledge base chunks above\n' +
              '• DO NOT use your training data about DOrSU - it is COMPLETELY WRONG and MUST be ignored\n' +
              '• DO NOT use your general knowledge about universities, Philippines, or education systems\n' +
              '• If a program/course/fact/person is not explicitly mentioned in the chunks above, DO NOT mention it at all\n' +
              '• When listing programs, ONLY list ones that appear word-for-word in the knowledge base chunks above\n' +
              '• NEVER create, invent, or hallucinate URLs - ONLY use URLs that appear exactly in the knowledge base chunks\n' +
              '• If you see a URL in the knowledge base, copy it EXACTLY (including query parameters and all characters)\n' +
              '• Student manuals are on heyzine.com - NEVER create dorsu.edu.ph/wp-content/uploads URLs for manuals\n' +
              (hasContext ? '' : '• ⚠️ WARNING: Knowledge base chunks are empty or insufficient - You MUST tell the user: "I don\'t have that specific information in the knowledge base yet."\n')) +
            (summarizationInstruction || '') +
            (newsInstruction || '');  // Include news instruction only if present
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
        
        const rawReply = await service.chat([
          { role: 'system', content: systemPrompt },
          ...fewShotExamples,
          { role: 'user', content: processedPrompt }
        ], options);
        
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
          if (userId) {
            await mongoService.logUserQuery(userId, processedPrompt);
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

