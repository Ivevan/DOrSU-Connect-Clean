# DOrSU AI Backend

AI-powered chatbot backend for DOrSU Connect app using RAG (Retrieval-Augmented Generation) for context-aware responses.

## Features

- **RAG-based Context Retrieval** - Retrieves relevant information from DOrSU knowledge base
- **Conversation Management** - Maintains conversation context for follow-up questions
- **MongoDB Integration** - Stores knowledge base and query logs
- **News Scraping** - Automatically scrapes and provides latest DOrSU news
- **Intent Classification** - Intelligently classifies user queries
- **Response Caching** - Caches responses for faster subsequent queries
- **GPU Support** - Optional GPU acceleration for faster inference

## Prerequisites

- Node.js 18+ 
- MongoDB (local or remote)
- (Optional) CUDA-enabled GPU for faster inference

## Setup

1. **Install Dependencies**
   ```bash
   cd backend/ai
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

4. **Start the Server**
   ```bash
   npm start
   ```

   The server will start on `http://localhost:3000`

## API Endpoints

### Chat Endpoints

- **POST /api/chat**
  - Send a message and get AI response
  - Request body: `{ "prompt": "Your question here" }`
  - Response: `{ "reply": "...", "model": "...", "responseTime": 1234 }`

### Status Endpoints

- **GET /health**
  - Check server health
  - Response: `{ "status": "ok" }`

- **GET /api/mongodb-status**
  - Check MongoDB connection
  - Response: `{ "status": "connected", ... }`

### Knowledge Base Management

- **POST /api/refresh-knowledge**
  - Manually refresh knowledge base from data file
  - Response: `{ "success": true, "message": "..." }`

- **POST /api/clear-cache**
  - Clear AI response cache
  - Response: `{ "success": true, "message": "Cache cleared" }`

### News Endpoints

- **GET /api/news**
  - Get latest DOrSU news
  - Response: `{ "success": true, "news": [...], "count": 10 }`

- **POST /api/scrape-news**
  - Manually trigger news scraping
  - Response: `{ "success": true, "newCount": 5 }`

## Project Structure

```
backend/ai/
├── src/
│   ├── config/           # Configuration files
│   │   └── mongodb.config.js
│   ├── data/             # Knowledge base data
│   │   └── dorsu_data.json
│   ├── services/         # Core services
│   │   ├── conversation.js      # Conversation management
│   │   ├── data-refresh.js      # Knowledge base refresh
│   │   ├── embedding.js         # Text embeddings
│   │   ├── formatter.js         # Response formatting
│   │   ├── rag.js              # RAG retrieval
│   │   ├── scraper.js          # News scraping
│   │   ├── service.js          # AI model service
│   │   └── system.js           # System prompts
│   ├── utils/            # Utility functions
│   │   ├── gpu-monitor.js      # GPU monitoring
│   │   ├── intent-classifier.js # Intent classification
│   │   ├── logger.js           # Logging utility
│   │   ├── query-analyzer.js   # Query analysis
│   │   └── response-cleaner.js # Response cleaning
│   └── server.js         # Main server file
├── package.json
├── .env.example
└── README.md
```

## Configuration

### Environment Variables

Edit `.env` to configure the backend:

```env
PORT=3000                    # Server port
MONGODB_URI=mongodb://...    # MongoDB connection string
MONGODB_DB_NAME=dorsu-ai     # Database name
ENABLE_CACHE=true           # Enable response caching
```

### Knowledge Base

The knowledge base is stored in `src/data/dorsu_data.json`. To update:

1. Edit the JSON file with new information
2. Call `POST /api/refresh-knowledge` to reload
3. Or restart the server

## Development

### Running in Development Mode

```bash
npm run dev  # Auto-restarts on file changes
```

### Monitoring

Watch the console for:
- Query analysis and intent classification
- RAG retrieval information
- Response times
- Cache hits/misses
- MongoDB operations

### Logs

The server logs include:
- 📊 RAG retrieval stats
- 💬 Conversational intent
- ⚡ Response times
- 🔍 Query complexity
- 🗄️ MongoDB operations

## Troubleshooting

### Server won't start

1. Check if port 3000 is available
2. Verify MongoDB is running
3. Check `.env` configuration

### MongoDB connection fails

1. Verify MongoDB is running: `mongosh`
2. Check connection string in `.env`
3. Ensure network connectivity

### Slow responses

1. Check if GPU is being utilized
2. Review RAG settings (reduce sections/tokens)
3. Clear cache and try again
4. Check MongoDB query performance

### News scraping fails

1. Check internet connectivity
2. Verify DOrSU website is accessible
3. Review scraper service logs

## API Usage Examples

### Send a Message

```javascript
// JavaScript/Node.js
const response = await fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'What is DOrSU?' })
});
const data = await response.json();
console.log(data.reply);
```

```bash
# cURL
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is DOrSU?"}'
```

### Get News

```javascript
const response = await fetch('http://localhost:3000/api/news');
const data = await response.json();
console.log(data.news);
```

## Production Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start src/server.js --name dorsu-ai
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables

Set production values for:
- `PORT` - Use environment-provided port
- `MONGODB_URI` - Use production MongoDB
- `ALLOWED_ORIGINS` - Set to your frontend URLs
- `NODE_ENV=production`

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the main project README
- Review the AI_CHAT_SETUP.md guide
- Contact the development team

