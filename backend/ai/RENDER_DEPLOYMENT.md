# DOrSU AI Backend - Render Deployment Guide

This guide will help you deploy the DOrSU AI Backend to Render.

## Prerequisites

1. **GitHub Repository**: Your code must be pushed to a GitHub repository
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **Groq API Key**: Get your API key from [groq.com](https://console.groq.com)
4. **MongoDB Atlas**: Set up a free cluster at [mongodb.com](https://www.mongodb.com/cloud/atlas)

## Step 1: Prepare Your Repository

Ensure all the following files are in your repository:

- ✅ `backend/ai/package.json` - Dependencies and scripts
- ✅ `backend/ai/.env.example` - Example environment variables
- ✅ `backend/ai/.gitignore` - Excludes .env and node_modules
- ✅ `render.yaml` - Render configuration (in root directory)

**Important**: Make sure `.env` is NOT committed to GitHub (it should be in `.gitignore`)

## Step 2: Push to GitHub

```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin master
```

## Step 3: Deploy on Render

### Option A: Using render.yaml (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml`
5. Click **"Apply"**

### Option B: Manual Setup

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `dorsu-ai-backend`
   - **Region**: Oregon (US West) or closest to you
   - **Branch**: `master`
   - **Root Directory**: Leave empty (or `backend/ai` if you want)
   - **Runtime**: Node
   - **Build Command**: `cd backend/ai && npm install`
   - **Start Command**: `cd backend/ai && npm start`
   - **Plan**: Free

## Step 4: Configure Environment Variables

In your Render service settings, add these environment variables:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Sets production mode |
| `GROQ_API_KEY` | `your_groq_api_key` | Get from console.groq.com |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | AI model to use |
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB connection string |
| `PORT` | `10000` | Render's default port (auto-set) |

**How to add environment variables:**
1. Go to your service in Render Dashboard
2. Click **"Environment"** tab
3. Click **"Add Environment Variable"**
4. Add each variable from the table above

## Step 5: Deploy

1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Watch the deployment logs
3. Wait for "Your service is live 🎉"

## Step 6: Test Your Deployment

Your API will be available at: `https://your-service-name.onrender.com`

### Test the health endpoint:

```bash
curl https://your-service-name.onrender.com/health
```

Expected response:
```json
{"status":"ok"}
```

### Test the chat endpoint:

```bash
curl -X POST https://your-service-name.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is DOrSU?"}'
```

## Step 7: Update Frontend Configuration

Update your React Native app to use the Render URL:

**File**: `frontend/src/config/api.config.ts`

```typescript
export const API_CONFIG = {
  BASE_URL: 'https://your-service-name.onrender.com',
  ENDPOINTS: {
    CHAT: '/api/chat',
    // ... other endpoints
  }
};
```

## Important Notes

### Free Tier Limitations

- ⚠️ **Spins down after 15 minutes of inactivity**
- ⚠️ **First request after spin-down takes 30-60 seconds**
- ✅ **750 hours/month free** (enough for development)

### Cold Starts

When your service spins down, the first request will be slow:
- Add a loading message in your app
- Consider adding a "warming" endpoint that users can ping

### Logs & Monitoring

- View logs in Render Dashboard → Your Service → Logs
- Monitor health at: `https://your-service-name.onrender.com/health`

## Troubleshooting

### Build fails with "Cannot find module"

**Solution**: Make sure `buildCommand` includes `npm install`:
```yaml
buildCommand: cd backend/ai && npm install
```

### Service crashes on startup

**Check**:
1. Environment variables are set correctly
2. MongoDB URI is valid
3. Groq API key is valid
4. Look at logs for specific error

### CORS errors from frontend

**Solution**: The backend already has CORS enabled in `server.js`:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

### 502 Bad Gateway

**Causes**:
- Service is still starting up (wait 1-2 minutes)
- Out of memory (upgrade plan or optimize code)
- Port binding issue (make sure using `process.env.PORT`)

## Upgrading from Free Tier

If you need better performance:

1. **Starter Plan** ($7/month):
   - No spin-down
   - 512 MB RAM
   - Better for production

2. **Standard Plan** ($25/month):
   - 2 GB RAM
   - Auto-scaling
   - Better performance

## Monitoring & Maintenance

### Check Service Health

```bash
curl https://your-service-name.onrender.com/health
```

### Check MongoDB Status

```bash
curl https://your-service-name.onrender.com/api/mongodb-status
```

### Refresh Knowledge Base

```bash
curl -X POST https://your-service-name.onrender.com/api/refresh-knowledge
```

### View Recent News

```bash
curl https://your-service-name.onrender.com/api/news
```

## Security Best Practices

1. ✅ Never commit `.env` file
2. ✅ Use environment variables for all secrets
3. ✅ Keep API keys in Render's Environment Variables
4. ✅ Regularly rotate API keys
5. ✅ Monitor usage to prevent API abuse

## Support

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **DOrSU AI Issues**: Create an issue in your GitHub repo

---

**Deployment Checklist**

- [ ] Code pushed to GitHub
- [ ] `.env` not in repository
- [ ] `render.yaml` in root directory
- [ ] Groq API key obtained
- [ ] MongoDB cluster created
- [ ] Render account created
- [ ] Service deployed on Render
- [ ] Environment variables configured
- [ ] Health endpoint tested
- [ ] Chat endpoint tested
- [ ] Frontend updated with Render URL

---

**Your service is ready for deployment! 🚀**
