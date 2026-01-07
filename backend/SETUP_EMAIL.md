# Quick Email Setup Guide (Nodemailer)

Since OTP testing is working, here's how to set up real email sending using Nodemailer:

## Step 1: Choose Your Email Provider

### Option A: Gmail (Easiest for Testing)

1. **Enable 2-Step Verification**
   - Go to your Google Account: https://myaccount.google.com/security
   - Enable 2-Step Verification if not already enabled

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it: "DOrSU Connect"
   - Copy the 16-character password (format: `zzmv czdy zfbk qeki`)

3. **Add to `backend/.env` file:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx
   SMTP_FROM_EMAIL=your-email@gmail.com
   ```

### Option B: Custom SMTP (For Production)

If you have your own email server or domain:

```env
SMTP_HOST=smtp.dorsu.edu.ph
SMTP_PORT=587
SMTP_USER=noreply@dorsu.edu.ph
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=noreply@dorsu.edu.ph
```

**Common SMTP Settings:**
- **Gmail**: `smtp.gmail.com:587` (TLS) or `smtp.gmail.com:465` (SSL)
- **Outlook**: `smtp-mail.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **Custom**: Check with your email provider

## Step 2: Restart Backend Server

```bash
# Stop current server (Ctrl+C)
cd backend
npm run dev
```

## Step 3: Test with Real Email

1. **Request OTP from frontend**
   - Use a real email address you have access to
   - Click "SEND RESET LINK"

2. **Check your email inbox**
   - Look for email from your configured sender
   - Subject: "Password Reset OTP - DOrSU Connect"
   - The OTP code will be in the email

3. **Enter OTP in VerifyOTP screen**
   - Use the 6-digit code from email
   - Click "VERIFY CODE"

4. **Reset your password**
   - Enter new password
   - Confirm password
   - Click "RESET PASSWORD"

## Step 4: Verify Everything Works

✅ **Checklist:**
- [ ] OTP email received in inbox
- [ ] OTP code works in VerifyOTP screen
- [ ] Password reset successful
- [ ] Can login with new password

## Troubleshooting

### Email not received?
1. Check spam folder
2. Verify SMTP credentials are correct
3. Check backend console for errors
4. For Gmail: Make sure you're using App Password, not regular password

### Gmail App Password not working?
- Make sure 2-Step Verification is enabled
- Generate a new App Password
- Remove spaces from the App Password when adding to `.env`
- Use the full email address in `SMTP_USER`

### SMTP connection errors?
- Verify `SMTP_HOST` and `SMTP_PORT` are correct
- Check if your network/firewall blocks SMTP ports
- Try port 465 (SSL) instead of 587 (TLS) if 587 doesn't work
- For Gmail, make sure "Less secure app access" is not required (use App Password instead)

### Still seeing OTP in console?
- Make sure all SMTP variables are set in `.env`:
  - `SMTP_HOST`
  - `SMTP_USER`
  - `SMTP_PASSWORD`
- Restart backend server after adding the settings
- Check backend console for SMTP errors

## Production Notes

For production, you should:
1. ✅ Use your domain's SMTP server (e.g., `smtp.dorsu.edu.ph`)
2. ✅ Use a proper sender email (e.g., `noreply@dorsu.edu.ph`)
3. ✅ Re-enable rate limiting (uncomment the code in `password-reset.js`)
4. ✅ Use secure SMTP connection (port 465 with SSL or port 587 with TLS)
5. ✅ Store SMTP credentials securely (use environment variables, never commit to git)

## Benefits of Nodemailer

- ✅ Works with any SMTP server (Gmail, Outlook, custom)
- ✅ No API key needed (just SMTP credentials)
- ✅ More flexible than SendGrid
- ✅ Already installed in the project
- ✅ Works from localhost or production
