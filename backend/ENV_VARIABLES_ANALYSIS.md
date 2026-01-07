# Environment Variables Analysis

## ✅ REQUIRED Variables (Must Have)

### Authentication & Security
- **JWT_SECRET** - Used in `password-reset.js` and `auth.js` for JWT token signing
- **FIREBASE_SERVICE_ACCOUNT** - Used in `password-reset.js` for Firebase Admin SDK (password reset)

### Database
- **MONGODB_URI** - Used in `mongodb.config.js` for database connection

### Server Configuration
- **PORT** - Used in `server.js` (defaults to 3000 if not set)

### AI Service (Groq)
- **GROQ_API_KEYS** - Used in `service.js` (REQUIRED - throws error if missing)

### Email (OTP Password Reset)
- **SMTP_HOST** - Used in `password-reset.js` (optional - logs OTP to console if not set)
- **SMTP_PORT** - Used in `password-reset.js` (defaults to 587 if not set)
- **SMTP_USER** - Used in `password-reset.js` (optional - logs OTP to console if not set)
- **SMTP_PASSWORD** - Used in `password-reset.js` (optional - logs OTP to console if not set)
- **SMTP_FROM_EMAIL** - Used in `password-reset.js` (defaults to SMTP_USER or 'noreply@dorsu.edu.ph')

## ⚠️ RECOMMENDED Variables (Should Have)

### AI Service Configuration
- **GROQ_MODEL_1** - Used in `service.js` (defaults to 'llama-3.1-8b-instant' if not set)
- **GROQ_MODEL_2** - Used in `service.js` (defaults to 'llama-3.3-70b-versatile' if not set)
- **GROQ_MODEL_FALLBACK_PRIORITY** - Used in `service.js` (defaults to 'auto' if not set)

### Backend URLs
- **BASE_URL** - Used in `schedule.js` and `posts.js` for generating URLs (warns if not set)
- **PUBLIC_BACKEND_URL** - Used in `server.js` for email verification redirects (defaults to localhost if not set)

### Logging
- **LOG_LEVEL** - Used in `logger.js` (defaults to 'INFO' if not set)

### Google OAuth (Backend Validation)
- **GOOGLE_WEB_CLIENT_ID** - Used in `auth.js` for token validation (⚠️ NOTE: env.example has `WEB_CLIENT_ID` but code uses `GOOGLE_WEB_CLIENT_ID` - this is a mismatch!)

## ❌ NOT USED Variables (Can Be Removed)

- **CACHE_CLEAR_TIMES** - Not found in any backend code (can be removed or kept for future use)
- **WEB_CLIENT_ID** - Not used in backend (only used in frontend with EXPO_PUBLIC_ prefix)
- **ANDROID_CLIENT_ID** - Not used in backend (only used in frontend with EXPO_PUBLIC_ prefix)

## 🔧 ISSUES FOUND

1. **Variable Name Mismatch**: 
   - `env.example` has `WEB_CLIENT_ID`
   - Code uses `GOOGLE_WEB_CLIENT_ID`
   - **Fix**: Either rename in env.example to `GOOGLE_WEB_CLIENT_ID` or update code to use `WEB_CLIENT_ID`

2. **BASE_URL Missing 'h' in URL**:
   - Line 17: `BASE_URL=ttp://...` (missing 'h' in 'http')
   - Should be: `BASE_URL=http://...`

## 📝 Summary for OTP Password Reset

For **local testing without email**:
- No SMTP variables needed (OTP will be logged to console)

For **local testing with email**:
- SMTP_HOST
- SMTP_PORT (or use default 587)
- SMTP_USER
- SMTP_PASSWORD
- SMTP_FROM_EMAIL (optional)

For **production**:
- All SMTP variables required
- FIREBASE_SERVICE_ACCOUNT required
- JWT_SECRET required (should be changed from default)

