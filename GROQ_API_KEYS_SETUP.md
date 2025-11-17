# Groq API Keys Configuration Guide

## Setting Up 5 API Keys

Your service is already configured to support multiple Groq API keys! Here's how to set it up:

### Step 1: Format in .env File

In your `backend/.env` file, add all 5 API keys as a comma-separated list:

```env
GROQ_API_KEYS=gsk_key1_abc123,gsk_key2_def456,gsk_key3_ghi789,gsk_key4_jkl012,gsk_key5_mno345
```

**Important:**
- Use `GROQ_API_KEYS` (plural) for multiple keys
- Separate keys with commas (no spaces around commas)
- Each key should start with `gsk_`
- No quotes needed

### Step 2: Verify Configuration

When you start your server, you should see:

```
🚀 AI Provider: Groq Cloud (llama-3.3-70b-versatile) - 5 API key(s) configured
   ✅ Multi-key support enabled: 5 keys = ~5000 requests/day capacity
   📊 Keys loaded: Key 1, Key 2, Key 3, Key 4, Key 5
```

### Step 3: Capacity

With 5 API keys configured:
- **Total Capacity**: ~5,000 requests/day
- **Per Key**: ~1,000 requests/day
- **Automatic Rotation**: Keys rotate automatically for even distribution
- **Automatic Failover**: If one key hits rate limit, automatically switches to next

### Example .env Configuration

```env
# Groq API Keys (5 keys for 5k requests/day)
GROQ_API_KEYS=gsk_your_first_key_here,gsk_your_second_key_here,gsk_your_third_key_here,gsk_your_fourth_key_here,gsk_your_fifth_key_here

# Server
PORT=3000
NODE_ENV=production

# MongoDB
MONGODB_URI=your_mongodb_uri_here
```

### How It Works

1. **Round-Robin Distribution**: Each request uses the next key in rotation
2. **Automatic Switching**: If a key hits rate limit (429), automatically switches to next available key
3. **Key Tracking**: System tracks usage per key and marks exhausted keys
4. **Cooldown**: Exhausted keys are re-enabled after 1 hour

### Troubleshooting

**Problem**: Only 1 key is being used
- **Solution**: Check that `GROQ_API_KEYS` (plural) is used, not `GROQ_API_KEY` (singular)
- **Solution**: Verify keys are comma-separated with no spaces

**Problem**: Keys not loading
- **Solution**: Restart your server after updating .env
- **Solution**: Check that all keys are valid (start with `gsk_`)

**Problem**: Still hitting rate limits
- **Solution**: Verify all 5 keys are different (not duplicates)
- **Solution**: Check server logs to see which keys are being used

### Monitoring

Check key usage in your server logs:
- `🔄 Switched API key: X → Y` - Key rotation
- `⚠️ Key X marked as exhausted` - Key hit rate limit
- `🔄 Key X cooldown expired, re-enabling` - Key available again

### Current Status

Your service is **ready** to use 5 keys! Just update your `.env` file with the format above and restart the server.

