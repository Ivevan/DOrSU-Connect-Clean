import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import conversationService from './services/conversation.js';
import { getDataRefreshService } from './services/data-refresh.js';
import responseFormatter from './services/formatter.js';
import { getMongoDBService } from './services/mongodb.js';
import { OptimizedRAGService } from './services/rag.js';
import { getNewsScraperService } from './services/scraper.js';
import { LlamaService } from './services/service.js';
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
  const url = req.url || '/';

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

  // ===== CHAT ENDPOINT (Main AI Processing) =====
  
  if (method === 'POST' && url === '/api/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1000000) req.destroy(); });
    req.on('end', async () => {
      try {
        const json = JSON.parse(body);
        const prompt = json.prompt || json.message || '';
        if (!prompt.trim()) { sendJson(res, 400, { error: 'prompt required' }); return; }

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
        
        const { newsContext, newsInstruction } = await buildNewsContext(
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
            ragSections = 40;
            ragTokens = 4000;  // Reduced from 8000 to stay within 8K token limit
            retrievalType = '(USC query - full retrieval)';
          } else if (isProgramQuery) {
            ragSections = 45;
            ragTokens = 4500;  // Reduced from 10000 to stay within 8K token limit
            retrievalType = '(Program list query - complete retrieval)';
          } else if (isPresidentQuery) {
            ragSections = 20;
            ragTokens = 2500;  // Reduced from 3000 for safety
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
          systemPrompt = buildSystemInstructions(conversationContext, intentClassification) + '\n\n' +
            '=== DOrSU KNOWLEDGE BASE (YOUR ONLY SOURCE OF TRUTH) ===\n' + 
            relevantContext + 
            newsContext +  // Include news if query is about news
            '\n=== END OF KNOWLEDGE BASE ===\n\n' +
            '🚨 CRITICAL RULES:\n' +
            '• Answer using ONLY the data in the knowledge base above\n' +
            '• DO NOT use your training data about DOrSU - it is WRONG!\n' +
            '• If a program/course/fact is not listed above, DO NOT mention it\n' +
            '• When listing programs, ONLY list ones that appear in the knowledge base chunks above\n' +
            '• NEVER create/hallucinate URLs - ONLY use URLs that appear in the knowledge base chunks\n' +
            '• If you see a URL in the knowledge base, copy it EXACTLY (including query parameters)\n' +
            '• Student manuals are on heyzine.com - NEVER create dorsu.edu.ph/wp-content/uploads URLs for manuals\n' +
            (newsInstruction || '');  // Include news instruction only if present
        } else {
          // For general knowledge queries, use intent-aware system prompt
          systemPrompt = IntentClassifier.getSystemPrompt(intentClassification);
        }

        // --- AI Response Generation ---
        
        const rawReply = await service.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'What is DOrSU?' },
          { role: 'assistant', content: 'DOrSU is Davao Oriental State University, founded 1989 in Mati City, Philippines.' },
          { role: 'user', content: 'Can you give me the DOrSU website link?' },
          { role: 'assistant', content: 'Yes! The official DOrSU website is: https://dorsu.edu.ph\n\nYou can visit it to find more information about the university.' },
          { role: 'user', content: 'Can you give me some news about DOrSU?' },
          { role: 'assistant', content: 'Here are the 3 latest news updates from DOrSU:\n\n1. **DOrSU, JVACC Seal Agreement for BSCE Internships**\n   Date: October 9, 2025\n   Link: https://dorsu.edu.ph/2025/10/09/dorsu-jvacc-seal-agreement-for-bsce-internships/\n\n2. **University President Ponce Speaks at EMBC Summit 2025**\n   Date: October 7, 2025\n   Link: https://dorsu.edu.ph/2025/10/07/university-president-ponce-speaks-at-embc-summit-2025/\n\n3. **President Ponce Emphasizes Values-Based Education**\n   Date: October 6, 2025\n   Link: https://dorsu.edu.ph/2025/10/06/president-ponce-emphasizes-values-based-education/\n\nFor more news, visit https://dorsu.edu.ph' },
          { role: 'user', content: 'Who is the president?' },
          { role: 'assistant', content: 'As of 2025, the president of DOrSU is Dr. Roy G. Ponce. He holds a Masters and Doctorate from the University of Melbourne, Australia, and is an expert in biodiversity conservation, education, and research.' },
          { role: 'user', content: 'Does DOrSU offer BS in Mechanical Engineering?' },
          { role: 'assistant', content: 'No, DOrSU does not offer BS in Mechanical Engineering. That program is NOT in the knowledge base. DOrSU only offers the 29 undergraduate programs listed in the knowledge base.' },
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
        if (mongoService) mongoService.logQuery(processedPrompt, queryAnalysis.complexity, responseTime, false);
        
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
 * Build news context for knowledge base
 */
async function buildNewsContext(shouldIncludeNews, isDateSpecific, newsService) {
  if (!shouldIncludeNews || !newsService) {
    return { newsContext: '', newsInstruction: '' };
  }
  
  try {
    const news = await newsService.getNews();
    if (!news || news.length === 0) {
      return { newsContext: '', newsInstruction: '' };
    }
    
    // Show only 3 latest news by default, unless user asks for specific date
    const newsToShow = isDateSpecific ? news.slice(0, 10) : news.slice(0, 3);
    
    let newsContext = '\n\n=== RECENT DORSU NEWS & UPDATES ===\n';
    newsToShow.forEach((item, index) => {
      newsContext += `\n${index + 1}. ${item.title}\n`;
      newsContext += `   Date: ${item.date}\n`;
      if (item.excerpt && item.excerpt !== 'Click to read more') {
        newsContext += `   ${item.excerpt}\n`;
      }
      newsContext += `   Link: ${item.link}\n`;
    });
    newsContext += '\n=== END OF NEWS ===\n';
    
    const newsInstruction = isDateSpecific ? '' : 
      '\n\n⚠️ CRITICAL: Show only the 3 latest news items using the format shown in the News Article Format section above.\n';
    
    Logger.info(`📰 Including ${newsToShow.length} news items in response`);
    
    return { newsContext, newsInstruction };
  } catch (error) {
    Logger.warn('Failed to fetch news for query:', error.message);
    return { newsContext: '', newsInstruction: '' };
  }
}

