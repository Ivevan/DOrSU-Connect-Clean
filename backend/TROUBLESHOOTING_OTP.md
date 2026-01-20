# OTP Password Reset Troubleshooting

## Quick Checklist

1. **Backend Server Running?**
   ```bash
   cd backend
   npm run dev
   ```
   Should see: "✅ Password reset service initialized"

2. **Check Backend Console**
   When you request OTP, you should see:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📧 PASSWORD RESET OTP (FOR TESTING)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Email: your-email@example.com
   OTP Code: 123456
   Expires in: 10 minutes
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

3. **Check API Endpoint**
   Test directly:
   ```bash
   curl -X POST http://localhost:3000/api/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

4. **Common Issues**

   **Issue: "Services not available"**
   - Backend server not fully started
   - MongoDB not connected
   - Wait for "✅ Password reset service initialized"

   **Issue: "User not found" (but you want to test)**
   - In dev mode, OTP is still generated even if user doesn't exist
   - Check console for OTP code

   **Issue: Frontend stuck on "Sending..."**
   - Check backend console for errors
   - Check network tab in browser DevTools
   - Verify backend URL is correct

   **Issue: No OTP in console**
   - Make sure `SENDGRID_API_KEY` is NOT set (or empty)
   - Check if backend logged the request
   - Verify email is being sent to the API

5. **Manual Test**
   ```bash
   # Start backend
   cd backend
   npm run dev
   
   # In another terminal, test API
   curl -X POST http://localhost:3000/api/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"your-email@example.com"}'
   ```
   
   Should return: `{"success":true,"message":"OTP has been sent..."}`
   And backend console should show the OTP code.

