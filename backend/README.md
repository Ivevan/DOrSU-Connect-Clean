# DOrSU AI Backend

AI-powered chatbot backend for DOrSU Connect app using RAG (Retrieval-Augmented Generation) for context-aware responses.

## 🚀 Quick Deploy to Render

**Deploy in 3 minutes!** See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)

For detailed deployment instructions, see [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md)

---

## Features

- **RAG-based Context Retrieval** - Retrieves relevant information from DOrSU knowledge base
- **Conversation Management** - Maintains conversation context for follow-up questions
- **MongoDB Integration** - Stores knowledge base and query logs
- **News Scraping** - Automatically scrapes and provides latest DOrSU news
- **Intent Classification** - Intelligently classifies user queries
- **Response Caching** - Caches responses for faster subsequent queries
- **Groq Cloud API** - Ultra-fast AI responses using cloud-based 70b models
- **Multi-Key Support** - Rotates between multiple API keys for increased capacity

## Prerequisites

- Node.js 18+ 
- MongoDB (local or remote)
- Groq API Key(s) - Get from [console.groq.com](https://console.groq.com)

## Setup

1. **Install Dependencies**
   ```bash
   cd backend
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
backend/
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
│   │   ├── intent-classifier.js # Intent classification
│   │   ├── logger.js           # Logging utility
│   │   ├── query-analyzer.js   # Query analysis
│   │   └── response-cleaner.js # Response cleaning
│   └── server.js         # Main server file
├── scripts/
│   └── refresh-knowledge-base.js
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
GROQ_API_KEYS=key1,key2,...  # Groq API keys (comma-separated for multi-key support)
# Or use single key:
# GROQ_API_KEY=your_groq_api_key_here
```

### Email Configuration

The backend supports multiple email providers for sending verification emails. **Resend is recommended** as it's reliable, developer-friendly, and doesn't require phone verification.

#### Option 1: Resend (RECOMMENDED - No Phone Verification!)

1. Sign up at [Resend](https://resend.com) (free tier: 3,000 emails/month, 100 emails/day)
2. Create an API key:
   - Go to [API Keys](https://resend.com/api-keys)
   - Click "Create API Key"
   - Copy the API key (starts with `re_`)
3. Configure in `.env`:
   ```env
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_your_api_key_here
   RESEND_FROM_EMAIL=noreply@dorsu.edu.ph
   ```
   **Note**: For production, you'll need to verify a domain. For testing, Resend provides `onboarding@resend.dev` as a default sender.

#### Option 2: Brevo (No Phone Verification!)

1. Sign up at [Brevo](https://www.brevo.com) (free tier: 300 emails/day)
2. Get your SMTP credentials:
   - Go to Dashboard → Settings → SMTP & API
   - Under "SMTP" section, copy your SMTP key
   - Note your account email address
3. Configure in `.env`:
   ```env
   EMAIL_PROVIDER=brevo
   BREVO_SMTP_KEY=your_smtp_key_here
   BREVO_SMTP_USER=your_email@example.com
   BREVO_FROM_EMAIL=noreply@dorsu.edu.ph
   ```

#### Option 3: Mailgun (Alternative)

1. Sign up at [Mailgun](https://www.mailgun.com) (free tier: 5,000 emails/month)
2. Verify your domain or use sandbox domain
3. Get API key from Settings → API Keys
4. Configure in `.env`:
   ```env
   EMAIL_PROVIDER=mailgun
   MAILGUN_API_KEY=your_mailgun_api_key
   MAILGUN_DOMAIN=your_domain.com
   MAILGUN_FROM_EMAIL=noreply@your_domain.com
   ```

#### Option 4: SendGrid (May require phone verification)

1. Sign up at [SendGrid](https://sendgrid.com) (free tier: 100 emails/day)
2. Create an API key:
   - Go to Settings → API Keys
   - Create API Key with "Mail Send" permissions
   - Copy the API key
3. Configure in `.env`:
   ```env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your_api_key_here
   SENDGRID_FROM_EMAIL=noreply@dorsu.edu.ph
   ```

#### Option 5: Gmail (Fallback - May have connection issues on cloud platforms)

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account → Security → App passwords
   - Create password for "Mail"
3. Configure in `.env`:
   ```env
   EMAIL_PROVIDER=gmail
   GMAIL_USER=your_email@gmail.com
   GMAIL_APP_PASSWORD=your_app_password
   ```

**Note**: If `EMAIL_PROVIDER` is not set, the system will automatically try Resend → Brevo → Mailgun → SendGrid → Gmail in that order.

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

1. Review RAG settings (reduce sections/tokens)
2. Clear cache and try again
3. Check MongoDB query performance
4. Verify Groq API keys are configured correctly
5. Check API key usage statistics (may need more keys)

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

