# Quick Render Deployment Steps

## 1. Prerequisites Checklist
- [ ] GitHub repository with code
- [ ] Groq API key from console.groq.com
- [ ] MongoDB Atlas cluster (free tier)
- [ ] Render account (free)

## 2. Deploy to Render (3 minutes)

### Method 1: One-Click Blueprint (Easiest)
1. Go to https://dashboard.render.com
2. Click "New +" → "Blueprint"
3. Connect GitHub repo
4. Click "Apply"
5. Add environment variables in service settings:
   - `GROQ_API_KEY` → your Groq API key
   - `MONGODB_URI` → your MongoDB connection string

### Method 2: Manual Web Service
1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Settings:
   - **Build Command**: `cd backend/ai && npm install`
   - **Start Command**: `cd backend/ai && npm start`
   - **Environment Variables**:
     - `GROQ_API_KEY` = your_key
     - `MONGODB_URI` = your_uri
     - `GROQ_MODEL` = llama-3.3-70b-versatile
     - `NODE_ENV` = production

## 3. Test Deployment

### Health Check
```bash
curl https://your-app.onrender.com/health
```
Expected: `{"status":"ok"}`

### Chat Test
```bash
curl -X POST https://your-app.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is DOrSU?"}'
```

## 4. Update Frontend

In `frontend/src/config/api.config.ts`:
```typescript
export const API_CONFIG = {
  BASE_URL: 'https://your-app.onrender.com',
  // ...
};
```

## Important Notes

⚠️ **Free Tier**: Spins down after 15 min inactivity
- First request after sleep: ~30-60 seconds
- Add loading state in your app

✅ **Production Ready**:
- CORS enabled
- Health checks configured
- Environment variables secure
- Auto-deploys on git push

## Get Your URLs

After deployment, you'll get:
- Service URL: `https://dorsu-ai-backend.onrender.com`
- Use this in your React Native app

## Support

- Full guide: `backend/ai/RENDER_DEPLOYMENT.md`
- Render docs: https://render.com/docs
- Issues: Create GitHub issue

---

**That's it! Your backend is deployed! 🎉**
