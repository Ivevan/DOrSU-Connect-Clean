# Knowledge Base Structure Documentation

## Overview

The DOrSU Connect knowledge base is stored in MongoDB using the `knowledge_chunks` collection. This collection contains structured chunks of information about Davao Oriental State University (DOrSU) that are used for Retrieval-Augmented Generation (RAG) to provide accurate AI responses.

---

## Collection Details

- **Collection Name**: `knowledge_chunks`
- **Database**: `dorsu_connect`
- **Purpose**: Store searchable chunks of DOrSU information for AI-powered responses

---

## Document Structure

Each document in the `knowledge_chunks` collection follows this structure:

```javascript
{
  _id: ObjectId,                    // MongoDB auto-generated ID
  id: String,                       // Unique chunk identifier (indexed, unique)
  content: String,                  // Main content/text of the chunk
  text: String,                     // Searchable text (same as content, used for text search)
  section: String,                   // Category/section this chunk belongs to (indexed)
  type: String,                      // Type of content (indexed)
  category: String,                  // Additional categorization
  topic: String,                     // Optional topic classification
  keywords: Array<String>,           // Extracted keywords for search (indexed, text search)
  embedding: Array<Number>,         // Vector embedding (384 dimensions) for semantic search
  metadata: {
    source: String,                  // Source of the data (e.g., "dorsu_data.json", "file_upload_...")
    field: String,                   // Original field name in source data
    updated_at: Date,                // Last update timestamp (indexed)
    chunkIndex: Number,              // Index within the source (for file uploads)
    fileName: String,                // Original filename (for file uploads)
    extension: String,               // File extension (for file uploads)
    uploadedAt: Date,                // Upload timestamp (for file uploads)
    // ... other source-specific metadata
  },
  entities: Object,                  // Optional extracted entities (people, topics, etc.)
  score: Number                      // Relevance score (calculated during search)
}
```

---

## Field Descriptions

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | Unique identifier for the chunk. Format: `{section}_{key}_{timestamp}_{index}` |
| `content` | String | Yes | The main textual content of the chunk |
| `text` | String | Yes | Searchable text (typically same as content) |
| `section` | String | Yes | High-level category/section (e.g., "history", "leadership", "programs") |
| `type` | String | Yes | Type of content (e.g., "text", "file_upload", "calendar_event") |
| `category` | String | No | Additional categorization (often same as section) |
| `topic` | String | No | Optional topic classification |
| `keywords` | Array | Yes | Extracted keywords for search (max 10 keywords) |
| `embedding` | Array<Number> | No | Vector embedding for semantic search (384 dimensions) |

### Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `metadata.source` | String | Source of the data (e.g., "dorsu_data.json", "file_upload_...") |
| `metadata.field` | String | Original field name in source data |
| `metadata.updated_at` | Date | Last update timestamp |
| `metadata.chunkIndex` | Number | Index within the source (for file uploads) |
| `metadata.fileName` | String | Original filename (for file uploads) |
| `metadata.extension` | String | File extension (for file uploads) |
| `metadata.uploadedAt` | Date | Upload timestamp (for file uploads) |

---

## Common Sections

The `section` field categorizes chunks into major knowledge areas:

### 1. **History & Background**
- `history` - University history and founding
- `historical` - Historical information
- `background` - Background information about DOrSU

### 2. **Leadership & Governance**
- `leadership` - Leadership information
- `president` - University president details
- `vice_president` / `vicePresidents` - Vice presidents information
- `chancellor` - Chancellor information
- `dean` / `deans` - Deans information
- `director` / `directors` - Directors information
- `board` / `boardOfRegents` - Board of Regents
- `governance` - Governance structure
- `administration` - Administrative information

### 3. **Academic Information**
- `programs` - Academic programs offered
- `faculties` - Faculty information
- `enrollment` - Enrollment data and statistics
- `campuses` - Campus locations and information

### 4. **Vision, Mission & Values**
- `vision_mission` - Vision and mission statements
- `mandate` - University mandate
- `values` - Core values
- `quality_policy` - Quality policy
- `graduate_outcomes` - Graduate outcomes

### 5. **Events & Announcements**
- `calendar_events` - Calendar events (from calendar collection)
- `announcements` - Announcements and events
- `posts` - Posts and announcements (from posts collection)

### 6. **Resources & Services**
- `student_resources` - Student resources
- `manuals` - Student manuals and guides
- `offices` - Office information and links
- `websites` - Website links and URLs

### 7. **File Uploads**
- `uploaded_files` - Content from uploaded files (txt, docx, csv, json)

### 8. **General**
- `general` - General DOrSU information

---

## Content Types

The `type` field indicates the type of content:

| Type | Description |
|------|-------------|
| `text` | Regular text content from JSON data |
| `file_upload` | Content from uploaded files |
| `calendar_event` | Calendar event information |
| `structured` | Structured data (arrays, objects) |
| `leadership` | Leadership/executive information |
| `program` | Academic program information |

---

## Indexes

The collection has the following indexes for optimal performance:

1. **Unique Index on `id`**: Ensures each chunk has a unique identifier
2. **Index on `section`**: Fast filtering by section
3. **Index on `type`**: Fast filtering by type
4. **Index on `keywords`**: Fast keyword-based search
5. **Text Search Index**: Full-text search on `text` and `keywords` fields
   - Weight: `text: 10`, `keywords: 5`
6. **Index on `metadata.updated_at`**: Sorting by update time

---

## Data Sources

### 1. **JSON Data File** (`dorsu_data.json`)
- Source: `backend/src/data/dorsu_data.json`
- Processed by: `DataRefreshService.parseDataIntoChunks()`
- Sections created from JSON structure:
  - History, leadership, programs, faculties, campuses, etc.
- Metadata: `{ source: "dorsu_data.json", field: <original_key>, updated_at: Date }`

### 2. **File Uploads**
- Supported formats: `.txt`, `.docx`, `.csv`, `.json`
- Processed by: `FileProcessorService.parseIntoChunks()`
- Chunk size: 500 characters with 50 character overlap
- Section: `uploaded_files`
- Type: `file_upload`
- Metadata: `{ source: "file_upload_<filename>", fileName, extension, chunkIndex, uploadedAt }`

### 3. **Calendar Events**
- Source: `calendar` collection
- Processed by: `RAGService.getContextForTopic()` (on-demand)
- Section: `calendar_events`
- Type: `calendar_event`
- Includes: title, date, time, category, description, semester

### 4. **Posts/Announcements**
- Source: `posts` collection
- Processed by: `server.js` (on-demand)
- Section: `announcements` or `posts`
- Includes: title, date, category, type, description

---

## Search Capabilities

### 1. **Keyword Search**
- Searches `keywords` array and `text` field
- Uses MongoDB text search index
- Case-insensitive matching
- Supports partial matches

### 2. **Semantic Search (FAISS)**
- Uses vector embeddings (384 dimensions)
- Model: `Xenova/all-MiniLM-L6-v2`
- Calculates cosine similarity between query and chunk embeddings
- Returns most semantically similar chunks

### 3. **Section-Based Filtering**
- Filters chunks by `section` field
- Used for queries like "list all programs" or "show all faculties"
- Ensures comprehensive results for specific categories

### 4. **Hybrid Search**
- Combines keyword search and semantic search
- Merges and deduplicates results
- Sorts by relevance score

---

## Chunk Creation Process

### From JSON Data:
1. Parse JSON structure recursively
2. Extract text values (length > 20 characters)
3. Extract keywords from text
4. Create chunk with section based on JSON path
5. Generate embedding (if embedding service available)
6. Store in MongoDB

### From File Uploads:
1. Extract text content from file
2. Split into sentences
3. Create chunks of ~500 characters with 50 character overlap
4. Extract keywords from each chunk
5. Generate embeddings for all chunks
6. Store in MongoDB

### Special Handling:
- **Structured Arrays**: Leadership data (vicePresidents, deans, etc.) are grouped together to prevent fragmentation
- **Date Ranges**: Calendar events with date ranges are stored with both `startDate` and `endDate`
- **Semester Information**: Calendar events include `semester` field (1, 2, or "Off")

---

## Example Documents

### Example 1: History Chunk
```javascript
{
  id: "history_founded_1703123456789_0",
  content: "Davao Oriental State University (DOrSU) was founded on December 13, 1989...",
  text: "Davao Oriental State University (DOrSU) was founded on December 13, 1989...",
  section: "history",
  type: "text",
  category: "history",
  keywords: ["davao", "oriental", "state", "university", "founded", "december", "1989"],
  embedding: [0.123, -0.456, ...], // 384 dimensions
  metadata: {
    source: "dorsu_data.json",
    field: "history.founded",
    updated_at: ISODate("2025-01-15T10:30:00Z")
  }
}
```

### Example 2: Leadership Chunk
```javascript
{
  id: "leadership_vicePresidents_1703123456789_1",
  content: "Vice Presidents of DOrSU: Dr. John Doe (VP for Academic Affairs), Dr. Jane Smith (VP for Research)...",
  text: "Vice Presidents of DOrSU: Dr. John Doe (VP for Academic Affairs), Dr. Jane Smith (VP for Research)...",
  section: "leadership",
  type: "leadership",
  category: "leadership",
  keywords: ["vice", "presidents", "academic", "affairs", "research"],
  embedding: [0.234, -0.567, ...],
  metadata: {
    source: "dorsu_data.json",
    field: "leadership.vicePresidents",
    updated_at: ISODate("2025-01-15T10:30:00Z")
  }
}
```

### Example 3: File Upload Chunk
```javascript
{
  id: "upload_student_manual_1703123456789_5",
  content: "The Pre-Admission Manual provides comprehensive information about the admission process...",
  text: "The Pre-Admission Manual provides comprehensive information about the admission process...",
  section: "uploaded_files",
  type: "file_upload",
  category: "txt",
  keywords: ["pre", "admission", "manual", "comprehensive", "information", "admission", "process"],
  embedding: [0.345, -0.678, ...],
  metadata: {
    source: "file_upload_student_manual.txt",
    fileName: "student_manual.txt",
    extension: "txt",
    chunkIndex: 5,
    uploadedAt: ISODate("2025-01-15T11:00:00Z")
  }
}
```

### Example 4: Calendar Event Chunk
```javascript
{
  id: "calendar-final_exam_67890abcdef",
  content: "Final Examination Schedule. Date: December 12 - December 22, 2025. Time: All Day. Category: Academic. Semester: 1st Semester.",
  text: "Final Examination Schedule. Date: December 12 - December 22, 2025. Time: All Day. Category: Academic. Semester: 1st Semester.",
  section: "calendar_events",
  type: "calendar_event",
  category: "Academic",
  keywords: ["final", "examination", "schedule", "december", "academic", "semester"],
  score: 100,
  metadata: {
    title: "Final Examination Schedule",
    date: "2025-12-12T00:00:00.000Z",
    time: "All Day",
    category: "Academic",
    description: "Final examination period for 1st semester",
    dateType: "date_range",
    startDate: "2025-12-12T00:00:00.000Z",
    endDate: "2025-12-22T00:00:00.000Z",
    semester: 1
  },
  source: "calendar_database"
}
```

---

## Data Maintenance

### Adding New Data:
1. **JSON Data**: Update `dorsu_data.json` and call `/api/refresh-knowledge` endpoint
2. **File Upload**: Use `/api/admin/upload-file` endpoint
3. **Calendar Events**: Use `/api/admin/calendar/events` endpoint or CSV upload
4. **Posts**: Use `/api/admin/posts` endpoint

### Updating Existing Data:
- Chunks are updated based on `id` field
- If `id` matches, existing chunk is updated
- If `id` doesn't exist, new chunk is created

### Cache Management:
- AI response cache is stored in-memory (NodeCache)
- Cache is cleared at scheduled times (configurable via `CACHE_CLEAR_TIMES`)
- Cache is also cleared when knowledge base is updated

---

## Query Patterns

### Common Query Types:

1. **History Queries**: `history`, `founded`, `established`, `background`
   - Retrieves chunks from `history` section
   - Prioritizes chunks with history-related keywords

2. **Leadership Queries**: `president`, `vice president`, `dean`, `director`
   - Retrieves chunks from `leadership` section
   - Uses direct MongoDB fallback if RAG returns insufficient data

3. **Program Queries**: `programs`, `courses`, `faculties`
   - Retrieves chunks from `programs` or `faculties` sections
   - Ensures complete lists are returned

4. **Calendar Queries**: `date`, `schedule`, `calendar`, `when`
   - Retrieves from `calendar` collection (on-demand)
   - Filters by date range and semester

5. **News/Announcements**: `news`, `announcements`, `events`
   - Retrieves from `news` or `posts` collections (on-demand)

---

## Statistics & Monitoring

### Collection Statistics:
- Total chunks: Query `db.knowledge_chunks.countDocuments()`
- Chunks by section: Query `db.knowledge_chunks.aggregate([{ $group: { _id: "$section", count: { $sum: 1 } } }])`
- Chunks with embeddings: Query `db.knowledge_chunks.countDocuments({ embedding: { $exists: true } })`

### Performance:
- Text search index for fast keyword matching
- Vector embeddings for semantic search
- Section-based indexes for filtering
- Caching for frequently accessed chunks

---

## Best Practices

1. **Chunk Size**: Keep chunks between 200-800 characters for optimal search
2. **Keywords**: Extract meaningful keywords (length > 3, exclude stop words)
3. **Sections**: Use consistent section names for better organization
4. **Metadata**: Include source information for traceability
5. **Embeddings**: Generate embeddings for all chunks to enable semantic search
6. **Updates**: Update chunks when source data changes
7. **Indexes**: Maintain indexes for frequently queried fields

---

## Related Collections

- **`calendar`**: Calendar events with dates, times, categories, and semester information
- **`posts`**: Announcements and events
- **`news`**: News articles scraped from DOrSU website
- **`ai_cache`**: Cached AI responses (deprecated for AI responses, now in-memory only)
- **`query_analytics`**: Query analytics and statistics
- **`conversations`**: User chat history and sessions

---

## Notes

- The knowledge base is the **ONLY SOURCE OF TRUTH** for AI responses
- AI is instructed to NEVER use training data - only knowledge base chunks
- Negative responses (e.g., "I don't have that information") are NOT cached
- Cache is cleared when knowledge base is updated to prevent stale responses
- Semester information (1, 2, or "Off") is included in calendar events for better filtering

---

*Last Updated: January 2025*

