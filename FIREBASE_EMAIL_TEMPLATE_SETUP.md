# Firebase Email Template Configuration for Production

## Issue
The verification email shows `continueUrl=http://localhost:8081/verify-email` which is incorrect for production. This needs to be updated in Firebase Console.

## Solution: Configure Firebase Email Template

### Step 1: Update Email Template in Firebase Console

1. Go to **Firebase Console** → **Authentication** → **Templates**
2. Click on **"Email address verification"**
3. Click **"Edit"** or **"Customize"**
4. Find the **"Action URL"** or **"Continue URL"** field
5. Set it to one of the following:

   **For Mobile App (Recommended):**
   ```
   dorsuconnect://verify-email
   ```

   **OR for Web Fallback:**
   ```
   https://dorsu-connect.onrender.com/verify-email
   ```

   **OR Combined (Mobile with Web Fallback):**
   - Primary: `dorsuconnect://verify-email`
   - Fallback: `https://dorsu-connect.onrender.com/verify-email`

6. **Customize Email Content:**
   - **Subject**: "Verify your DOrSU Connect account"
   - **Body**: Add your app branding and clear instructions
   - Make sure the verification link is prominent

7. Click **"Save"**

### Step 2: Update Email Template Text (Optional but Recommended)

Customize the email body to include:
- Your app name (DOrSU Connect)
- Clear instructions
- Professional branding

Example email body:
```
Hello {{displayName}},

Please verify your email address to complete your DOrSU Connect account registration.

Click the link below to verify:
[VERIFY EMAIL BUTTON]

If you didn't create an account, you can safely ignore this email.

Thanks,
The DOrSU Connect Team
```

### Step 3: Test the Configuration

1. Create a test account
2. Check the verification email
3. Verify that the link uses the correct URL (not localhost)
4. Click the link to ensure it opens your app

## Current Code Configuration

The code already uses the correct deep link (`dorsuconnect://verify-email`) in `authService.ts`. The `continueUrl` in the email is controlled by Firebase Console settings, not by code.

## Environment Variables

Make sure your `backend/.env` file has:
```env
BASE_URL=https://dorsu-connect.onrender.com
PUBLIC_BACKEND_URL=https://dorsu-connect.onrender.com
```

## Notes

- The `continueUrl` parameter is a fallback URL used when the app isn't installed
- For mobile apps, the deep link (`dorsuconnect://verify-email`) should work automatically
- The `continueUrl` is what users see in the email as a clickable link
- Update this in Firebase Console, not in code

