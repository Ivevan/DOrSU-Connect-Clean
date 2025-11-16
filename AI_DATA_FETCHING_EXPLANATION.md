# How the AI Fetches Data - Complete Flow Explanation

## Overview
Yes, the AI **uses RAG (Retrieval-Augmented Generation)** to fetch data from the knowledge base. The system combines:
1. **RAG with FAISS Vector Search** - For semantic similarity search
2. **Keyword Search Fallback** - When FAISS is unavailable
3. **Direct Database Queries** - For calendar events and news
4. **Caching System** - To improve performance

---

## Complete Data Flow

### 1. **Initialization & Data Loading**

```
Server Starts
    ↓
MongoDB Service Connects
    ↓
RAG Service Initializes
    ↓
Syncs with MongoDB every 30 seconds
    ↓
Loads chunks from `knowledge_chunks` collection
    ↓
Generates/loads embeddings (384-dimensional vectors)
    ↓
Builds FAISS vector index for fast similarity search
```

**Key Files:**
- `backend/src/services/rag.js` - RAG service initialization
- `backend/src/services/mongodb.js` - Database operations
- `backend/src/server.js` - Service initialization

---

### 2. **When User Sends a Query**

```
User Query: "What is DOrSU?"
    ↓
Server receives POST /api/chat
    ↓
Query Analysis (QueryAnalyzer)
    - Detects intent (DOrSU vs general knowledge)
    - Determines complexity
    - Identifies topics (calendar, programs, etc.)
    ↓
Intent Classification
    - Routes to knowledge_base or general knowledge
    ↓
RAG Retrieval (if DOrSU query)
```

---

### 3. **RAG Retrieval Process**

#### Step 1: Check Cache
```javascript
// backend/src/services/rag.js - getContextForTopic()
const cacheKey = generateCacheKey(query, maxSections);
const cached = this.cache.get(cacheKey);
if (cached) {
    return cached; // Return immediately if cached
}
```

#### Step 2: Vector Similarity Search (FAISS)
```javascript
// Uses transformer embeddings (all-MiniLM-L6-v2)
const queryEmbedding = await createTransformerEmbedding(query);
const results = this.faissIndex.search(queryEmbedding, maxResults);
```

**How it works:**
- Converts user query to 384-dimensional vector
- Searches FAISS index for similar chunks
- Returns top N most similar chunks (by cosine similarity)
- Falls back to keyword search if FAISS fails

#### Step 3: Keyword Search (Fallback)
```javascript
// Enhanced keyword matching
- Scores chunks based on keyword matches
- Higher weight for exact keyword matches
- Medium weight for entity matches
- Special boost for calendar events in calendar queries
```

#### Step 4: Calendar Events Integration
```javascript
// If calendar query detected:
if (isCalendarQuery && calendarService) {
    // Fetch from calendar collection
    const events = await calendarService.getEvents({
        startDate: past 30 days,
        endDate: future 365 days,
        limit: 100
    });
    
    // Convert to RAG chunks
    calendarEventsData = events.map(event => ({
        id: `calendar-${event._id}`,
        section: 'calendar_events',
        text: formattedEventText,
        keywords: extractedKeywords,
        score: 100 // High priority
    }));
}
```

---

### 4. **Context Building**

The RAG service formats retrieved chunks into context:

```javascript
// backend/src/services/rag.js - getContextForTopic()
context = "## CALENDAR EVENTS AND SCHEDULES\n\n" +
          formattedCalendarEvents +
          "\n## KNOWLEDGE BASE SECTIONS\n\n" +
          relevantChunks.map(chunk => 
            `## ${chunk.section}\n${chunk.text}\n\n`
          ).join('');
```

**Format:**
- Groups calendar events first (if calendar query)
- Then adds knowledge base chunks
- Respects token limits (maxTokens parameter)
- Prioritizes high-scoring chunks

---

### 5. **System Prompt Assembly**

```javascript
// backend/src/server.js
systemPrompt = buildSystemInstructions() +
    "\n=== DOrSU KNOWLEDGE BASE ===\n" +
    relevantContext +           // From RAG
    calendarContext +           // From calendar collection
    newsContext +               // From news scraper
    "\n=== END OF KNOWLEDGE BASE ===\n" +
    calendarInstruction;        // Formatting rules
```

---

### 6. **AI Response Generation**

```
System Prompt (with RAG context)
    ↓
Few-shot examples
    ↓
User query
    ↓
LLM (Groq/Ollama) generates response
    ↓
Response uses ONLY knowledge base data
    ↓
Response formatted and returned
```

---

## Data Sources

### 1. **Knowledge Base (MongoDB `knowledge_chunks` collection)**
- **Source:** Uploaded files, `dorsu_data.json`, manual uploads
- **Storage:** MongoDB with embeddings
- **Retrieval:** FAISS vector search + keyword search
- **Sync:** Every 30 seconds automatically

### 2. **Calendar Events (MongoDB `calendar` collection)**
- **Source:** Admin-uploaded CSV files, manual event creation
- **Storage:** Direct MongoDB queries
- **Retrieval:** Direct query (not through RAG initially, but converted to RAG chunks)
- **Format:** Grouped by title, date ranges formatted concisely

### 3. **News Articles (MongoDB `news` collection)**
- **Source:** Web scraping from dorsu.edu.ph
- **Storage:** MongoDB
- **Retrieval:** Direct query
- **Update:** Auto-scraping service

---

## RAG Architecture Details

### Embedding Model
- **Model:** `Xenova/all-MiniLM-L6-v2`
- **Dimension:** 384
- **Type:** Sentence transformer
- **Purpose:** Convert text to vectors for semantic search

### FAISS Index
- **Type:** `IndexFlatL2` (Euclidean distance)
- **Purpose:** Fast similarity search
- **Fallback:** Keyword search if FAISS unavailable

### Caching Strategy
- **Cache Type:** NodeCache (in-memory)
- **TTL:** 15 minutes default
- **Cache Keys:** Normalized query + maxSections
- **Auto-clear:** Every 1 minute to keep data fresh

---

## Query-Specific Optimizations

### USC Queries
```javascript
ragSections = 30;      // More chunks
ragTokens = 3000;      // More tokens
```

### Program Queries
```javascript
ragSections = 35;      // Even more chunks
ragTokens = 3500;      // More tokens
```

### Calendar Queries
```javascript
// Fetches calendar events directly
// Converts to RAG chunks
// Prioritizes calendar events in results
```

---

## Key Code Locations

1. **RAG Service:** `backend/src/services/rag.js`
   - `getContextForTopic()` - Main retrieval function
   - `findRelevantDataFAISS()` - Vector search
   - `findRelevantDataKeyword()` - Keyword fallback
   - `syncWithMongoDB()` - Data synchronization

2. **Server Handler:** `backend/src/server.js`
   - Lines 1032-1069: RAG retrieval setup
   - Lines 1071-1222: Calendar event fetching
   - Lines 1244-1272: System prompt assembly

3. **MongoDB Service:** `backend/src/services/mongodb.js`
   - `getAllChunks()` - Retrieves all chunks
   - `insertChunks()` - Adds new chunks

4. **Calendar Service:** `backend/src/services/calendar.js`
   - `getEvents()` - Fetches calendar events

---

## Summary

**Yes, the AI uses RAG!** Here's the complete flow:

1. ✅ **Data stored in MongoDB** (`knowledge_chunks` collection)
2. ✅ **RAG service syncs** every 30 seconds
3. ✅ **FAISS vector index** for semantic search
4. ✅ **Query converted to embedding** using transformer model
5. ✅ **Similar chunks retrieved** via vector similarity
6. ✅ **Calendar events fetched separately** and converted to RAG chunks
7. ✅ **Context assembled** with all relevant data
8. ✅ **System prompt built** with knowledge base + calendar + news
9. ✅ **AI generates response** using ONLY the provided context

The system is **hybrid**: RAG for knowledge base + direct queries for calendar/news, all combined into a unified context for the AI.

