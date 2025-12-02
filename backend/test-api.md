# Testing the Load Balancer API

## Base URL
```
http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com
```

## ⚠️ Current Status
The load balancer is set up, but tasks may still be registering. If you get **503 Service Unavailable**, wait 2-5 minutes for tasks to start and pass health checks.

## Method 1: PowerShell (Windows)

### Test Health Endpoint
```powershell
Invoke-WebRequest -Uri "http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/health" -Method GET
```

### Test with Response Display
```powershell
$response = Invoke-WebRequest -Uri "http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/health" -Method GET
Write-Host "Status: $($response.StatusCode)"
Write-Host "Response: $($response.Content)"
```

### Test Chat API (POST request)
```powershell
$body = @{
    prompt = "What is DOrSU?"
    userType = "student"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

Invoke-WebRequest -Uri "http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/api/chat" -Method POST -Body $body -Headers $headers
```

### Test with Authentication Token
```powershell
$token = "YOUR_JWT_TOKEN_HERE"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

Invoke-WebRequest -Uri "http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/api/chat" -Method POST -Body $body -Headers $headers
```

## Method 2: cURL (Cross-platform)

### Test Health Endpoint
```bash
curl http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/health
```

### Test with Verbose Output
```bash
curl -v http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/health
```

### Test Chat API
```bash
curl -X POST http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is DOrSU?","userType":"student"}'
```

### Test with Authentication
```bash
curl -X POST http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"prompt":"What is DOrSU?","userType":"student"}'
```

## Method 3: Browser

### Health Check
Open in browser:
```
http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/health
```

Expected response:
```json
{"status":"ok"}
```

### Other Endpoints (may require authentication)
- `/api/mongodb-status` - Check MongoDB connection
- `/api/news` - Get news updates
- `/api/chat` - AI chat (POST request, requires body)

## Method 4: Postman / Insomnia

1. **Create a new request**
2. **Set method**: GET or POST
3. **Enter URL**: `http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/health`
4. **For POST requests**:
   - Go to Headers tab
   - Add: `Content-Type: application/json`
   - Go to Body tab
   - Select "raw" and "JSON"
   - Enter JSON body:
     ```json
     {
       "prompt": "What is DOrSU?",
       "userType": "student"
     }
     ```

## Method 5: JavaScript/Node.js

```javascript
// Health check
fetch('http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/health')
  .then(res => res.json())
  .then(data => console.log(data));

// Chat API
fetch('http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    prompt: 'What is DOrSU?',
    userType: 'student'
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## Available Endpoints

### Public Endpoints (No Auth Required)
- `GET /health` - Health check
- `GET /api/mongodb-status` - MongoDB status
- `GET /api/news` - Get news updates

### Protected Endpoints (Auth Required)
- `POST /api/chat` - AI chat
- `POST /api/auth/firebase-login` - Firebase authentication
- `POST /api/auth/register-firebase` - User registration
- `GET /api/schedule` - Get schedule data
- `POST /api/auth/change-password` - Change password

## Quick Test Script (PowerShell)

Save as `test-api.ps1`:

```powershell
$baseUrl = "http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com"

Write-Host "Testing Health Endpoint..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "✅ Health Check: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTesting MongoDB Status..." -ForegroundColor Cyan
try {
    $mongo = Invoke-RestMethod -Uri "$baseUrl/api/mongodb-status" -Method GET
    Write-Host "✅ MongoDB Status: $($mongo.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ MongoDB Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTesting Chat API..." -ForegroundColor Cyan
$chatBody = @{
    prompt = "What is DOrSU?"
    userType = "student"
} | ConvertTo-Json

try {
    $chat = Invoke-RestMethod -Uri "$baseUrl/api/chat" -Method POST -Body $chatBody -ContentType "application/json"
    Write-Host "✅ Chat API Response received" -ForegroundColor Green
    Write-Host "Response: $($chat.reply.Substring(0, [Math]::Min(100, $chat.reply.Length)))..." -ForegroundColor Yellow
} catch {
    Write-Host "❌ Chat API Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    }
}
```

Run it:
```powershell
.\test-api.ps1
```

## Troubleshooting

### Connection Refused / Timeout
- Check if load balancer is active: `aws elbv2 describe-load-balancers`
- Check target health: `aws elbv2 describe-target-health`
- Verify ECS tasks are running: `aws ecs describe-services`

### 503 Service Unavailable
- Tasks may still be starting (wait 2-3 minutes)
- Check if tasks are healthy in target group
- Verify health check endpoint is working

### 404 Not Found
- Check the endpoint path is correct
- Some endpoints may require authentication

### CORS Errors (Browser)
- Backend should handle CORS, but if issues occur, check CORS headers
- For mobile apps, CORS is not an issue

## Expected Responses

### Health Check
```json
{"status":"ok"}
```

### MongoDB Status
```json
{
  "status": "connected",
  "database": "dorsu-connect"
}
```

### Chat API
```json
{
  "reply": "DOrSU is...",
  "sessionId": "...",
  "timestamp": "..."
}
```

