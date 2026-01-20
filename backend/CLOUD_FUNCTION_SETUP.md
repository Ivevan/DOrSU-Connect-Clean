# Cloud Functions + SendGrid Setup Guide

This guide will help you set up a Cloud Function to send password reset OTP emails via SendGrid.

## Step 1: Set Up SendGrid Account

1. **Sign up for SendGrid**
   - Go to [https://sendgrid.com](https://sendgrid.com)
   - Create a free account (100 emails/day free tier)
   - Verify your email address

2. **Create API Key**
   - Go to Settings → API Keys
   - Click "Create API Key"
   - Name it: `DOrSU-Connect-Email`
   - Select "Full Access" or "Restricted Access" with "Mail Send" permission
   - Copy the API key (starts with `SG.`) - **Save this! You won't see it again**
    -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
3. **Verify Sender Identity** (Optional but recommended)
   - Go to Settings → Sender Authentication
   - Verify a Single Sender or Domain
   - For testing, you can use the default sender

## Step 2: Create Firebase Cloud Function

### Option A: Using Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed)
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project**
   ```bash
   cd backend
   firebase init functions
   ```
   - Select your Firebase project
   - Choose JavaScript (or TypeScript if you prefer)
   - Install dependencies: Yes

4. **Install SendGrid SDK**
   ```bash
   cd functions
   npm install @sendgrid/mail
   ```

5. **Create the Cloud Function**

   Create/edit `backend/functions/index.js`:

   ```javascript
   const functions = require('firebase-functions');
   const sgMail = require('@sendgrid/mail');

   // Set SendGrid API key from environment
   sgMail.setApiKey(functions.config().sendgrid.key || process.env.SENDGRID_API_KEY);

   exports.sendPasswordResetOTP = functions.https.onRequest(async (req, res) => {
     // Enable CORS
     res.set('Access-Control-Allow-Origin', '*');
     res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
     res.set('Access-Control-Allow-Headers', 'Content-Type');

     if (req.method === 'OPTIONS') {
       res.status(204).send('');
       return;
     }

     if (req.method !== 'POST') {
       res.status(405).send('Method Not Allowed');
       return;
     }

     try {
       const { to, subject, otp, type } = req.body;

       if (!to || !otp) {
         res.status(400).json({ error: 'Email and OTP are required' });
         return;
       }

       // Email template for password reset OTP
       const html = `
         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
           <h2 style="color: #2563EB;">Password Reset Request</h2>
           <p>You have requested to reset your password for DOrSU Connect.</p>
           <p>Your OTP code is:</p>
           <div style="background-color: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
             <h1 style="color: #2563EB; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
           </div>
           <p>This code will expire in 10 minutes.</p>
           <p>If you didn't request this, please ignore this email.</p>
           <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
           <p style="color: #6B7280; font-size: 12px;">DOrSU Connect - AI-Powered Academic Assistant</p>
         </div>
       `;

       const msg = {
         to: to,
         from: process.env.SENDGRID_FROM_EMAIL || 'noreply@dorsu.edu.ph',
         subject: subject || 'Password Reset OTP - DOrSU Connect',
         html: html,
       };

       await sgMail.send(msg);

       console.log(`✅ OTP email sent to: ${to}`);
       res.status(200).json({ success: true, message: 'Email sent successfully' });
     } catch (error) {
       console.error('❌ SendGrid error:', error);
       res.status(500).json({ 
         error: 'Failed to send email',
         details: error.message 
       });
     }
   });
   ```

6. **Set SendGrid API Key**
   ```bash
   firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY_HERE"
   ```

   Or set it in `.env` file:
   ```env
   SENDGRID_API_KEY=SG.your_api_key_here
   SENDGRID_FROM_EMAIL=noreply@dorsu.edu.ph
   ```

7. **Deploy the Function**
   ```bash
   firebase deploy --only functions:sendPasswordResetOTP
   ```

8. **Get the Function URL**
   After deployment, Firebase will show you the function URL, something like:
   ```
   https://us-central1-your-project-id.cloudfunctions.net/sendPasswordResetOTP
   ```

### Option B: Using Google Cloud Functions (Alternative)

If you prefer Google Cloud Functions directly:

1. **Create a new Cloud Function**
   - Go to [Google Cloud Console](https://console.cloud.google.com/functions)
   - Click "Create Function"
   - Name: `sendPasswordResetOTP`
   - Runtime: Node.js 18
   - Trigger: HTTP
   - Authentication: Allow unauthenticated invocations

2. **Add the same code as above** in the inline editor

3. **Set environment variables**:
   - `SENDGRID_API_KEY`: Your SendGrid API key
   - `SENDGRID_FROM_EMAIL`: Your sender email

## Step 3: Configure Backend

Add the Cloud Function URL to your backend `.env` file:

```env
CLOUD_FUNCTION_EMAIL_URL=https://us-central1-your-project-id.cloudfunctions.net/sendPasswordResetOTP
```

## Step 4: Test the Setup

1. **Test the Cloud Function directly**:
   ```bash
   curl -X POST https://your-function-url.cloudfunctions.net/sendPasswordResetOTP \
     -H "Content-Type: application/json" \
     -d '{"to":"test@example.com","otp":"123456","subject":"Test OTP"}'
   ```

2. **Test from your backend**:
   - Start your backend server
   - Try the forgot password flow from the frontend
   - Check your email for the OTP

## Troubleshooting

### Email not received?
- Check SendGrid Activity Feed: https://app.sendgrid.com/activity
- Check spam folder
- Verify sender email is authenticated in SendGrid
- Check Cloud Function logs: `firebase functions:log`

### Cloud Function errors?
- Check Firebase Console → Functions → Logs
- Verify SendGrid API key is set correctly
- Check CORS settings if calling from browser

### Backend can't reach Cloud Function?
- Verify `CLOUD_FUNCTION_EMAIL_URL` is set correctly
- Check network/firewall settings
- Verify the function is deployed and public

## Security Notes

- **Never commit API keys to git** - Use environment variables
- **Use Firebase Functions config** for sensitive data
- **Enable authentication** on Cloud Functions for production
- **Rate limit** email sending to prevent abuse
- **Monitor** SendGrid usage to avoid exceeding limits

## Alternative: Direct SendGrid Integration

If you don't want to use Cloud Functions, you can send emails directly from the backend:

1. Install SendGrid in backend:
   ```bash
   cd backend
   npm install @sendgrid/mail
   ```

2. Update `backend/src/services/password-reset.js`:
   - Replace `sendOTPEmail` method to use SendGrid directly
   - Remove Cloud Function URL requirement

3. Add to `.env`:
   ```env
   SENDGRID_API_KEY=SG.your_api_key_here
   SENDGRID_FROM_EMAIL=noreply@dorsu.edu.ph
   ```

