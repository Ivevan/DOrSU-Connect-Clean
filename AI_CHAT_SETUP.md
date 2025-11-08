# DOrSU Connect - AI Chat Setup Guide

This guide explains how the frontend AIChat component connects to the AI backend.

## Architecture Overview

The AI Chat feature consists of:

1. **Backend AI Server** (`backend/ai/src/server.js`)
   - Runs on port 3000 by default
   - Provides `/api/chat` endpoint for AI conversations
   - Uses RAG (Retrieval-Augmented Generation) for context-aware responses
   - Includes MongoDB for knowledge base storage
   - Supports news scraping and caching

2. **Frontend AIChat Component** (`frontend/src/screens/user/AIChat.tsx`)
   - User interface for chatting with DOrSU AI
   - Displays conversation history
   - Shows loading states and error handling
   - Provides quick suggestion buttons

3. **AI Service** (`frontend/src/services/AIService.ts`)
   - Handles API communication between frontend and backend
   - Provides TypeScript interfaces for type safety
   - Manages request/response formatting

4. **API Configuration** (`frontend/src/config/api.config.ts`)
   - Configures backend URL for different environments
   - Easy switching between development and production

## Setup Instructions

### 1. Start the Backend AI Server

```bash
cd backend/ai
npm install  # If not already done
node src/server.js
```

The backend should start on `http://localhost:3000`

### 2. Configure the API URL

Edit `frontend/src/config/api.config.ts` if needed:

```typescript
const API_CONFIG = {
  development: {
    baseUrl: 'http://localhost:3000',
    // For Android emulator: 'http://10.0.2.2:3000'
    // For physical device: 'http://YOUR_COMPUTER_IP:3000'
  },
  production: {
    baseUrl: 'https://your-production-url.com',
  },
};
```

### 3. Run the Frontend

```bash
# In the project root
npm start

# Or for specific platforms
npm run android
npm run ios
npm run web
```

## Platform-Specific Configuration

### Android Emulator
Change the development URL to:
```typescript
baseUrl: 'http://10.0.2.2:3000'
```

### iOS Simulator
Use localhost:
```typescript
baseUrl: 'http://localhost:3000'
```

### Physical Device (Android/iOS)
Use your computer's local IP address:
```typescript
baseUrl: 'http://192.168.1.XXX:3000'  // Replace with your IP
```

To find your IP:
- **Windows**: Run `ipconfig` in CMD
- **macOS/Linux**: Run `ifconfig` or `ip addr`

### Web
Use localhost:
```typescript
baseUrl: 'http://localhost:3000'
```

## Features

### AI Chat Capabilities

1. **Context-Aware Responses**
   - Uses RAG to retrieve relevant information from DOrSU knowledge base
   - Caches responses for faster subsequent queries
   - Supports follow-up questions with conversation context

2. **Knowledge Base Coverage**
   - DOrSU information (programs, president, campus details)
   - University policies and procedures
   - Student services and facilities
   - Recent news and updates

3. **Intelligent Features**
   - Query complexity analysis
   - Intent classification
   - Smart token allocation
   - Response formatting

### User Interface Features

1. **Chat Interface**
   - Real-time message display
   - User and AI message bubbles with distinct styling
   - Auto-scroll to latest message
   - Loading indicators

2. **Quick Suggestions**
   - Pre-defined common questions
   - Click to send instantly
   - Only shown when chat is empty

3. **Info Modal**
   - Explains AI capabilities
   - Privacy reminders
   - Feature highlights

## API Endpoints

The backend provides these endpoints:

- `POST /api/chat` - Send message and get AI response
- `GET /health` - Check backend health
- `GET /api/mongodb-status` - Check MongoDB connection
- `GET /api/news` - Get latest DOrSU news
- `POST /api/refresh-knowledge` - Manually refresh knowledge base
- `POST /api/clear-cache` - Clear AI response cache

## Troubleshooting

### Connection Issues

1. **"Failed to send message" error**
   - Ensure backend is running on port 3000
   - Check if the URL in `api.config.ts` is correct
   - Verify network connectivity

2. **Backend not starting**
   - Check if MongoDB is running
   - Verify all dependencies are installed
   - Check for port conflicts

3. **Timeout errors**
   - Backend might be processing a complex query
   - Check backend logs for errors
   - Increase timeout in `api.config.ts` if needed

### Platform-Specific Issues

1. **Android Emulator can't connect**
   - Use `http://10.0.2.2:3000` instead of `localhost`

2. **Physical device can't connect**
   - Ensure device and computer are on same network
   - Use computer's local IP address
   - Check firewall settings

3. **CORS errors (Web only)**
   - Backend should allow CORS (already configured)
   - Check browser console for specific errors

## Testing

Test the connection:

1. Start the backend
2. Open the app and navigate to AI Chat
3. Click a suggestion or type a message
4. You should see a response from the AI

Example test queries:
- "What is DOrSU?"
- "Who is the president?"
- "What programs are offered?"
- "Tell me about recent news"

## Development Tips

1. **Monitor Backend Logs**
   ```bash
   cd backend/ai
   node src/server.js
   ```
   Watch for query analysis, RAG retrieval, and response times

2. **Check Network Requests**
   - Use React Native Debugger
   - Check browser DevTools (for web)
   - Monitor request/response in Network tab

3. **Update Knowledge Base**
   - Edit `backend/ai/src/data/dorsu_data.json`
   - Call `/api/refresh-knowledge` endpoint
   - Or restart the backend

## Production Deployment

1. Update production URL in `api.config.ts`
2. Deploy backend to a server (e.g., AWS, Heroku, DigitalOcean)
3. Ensure HTTPS for production
4. Configure environment variables for sensitive data
5. Set up proper error logging and monitoring

## Additional Resources

- Backend AI Documentation: See `backend/ai/` directory
- Frontend Components: See `frontend/src/screens/user/`
- API Service: See `frontend/src/services/AIService.ts`

