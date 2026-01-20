# Resend Domain Verification Guide

## Why Domain Verification is Required

The `onboarding@resend.dev` testing domain can **ONLY** send emails to your Resend account owner email (the email you used to sign up).

To send OTP emails to **ANY email address**, you **MUST** verify a domain in Resend.

## Step-by-Step Domain Verification

### Step 1: Go to Resend Domains
1. Log in to https://resend.com
2. Click on **"Domains"** in the left sidebar
3. Click **"Add Domain"** button

### Step 2: Enter Your Domain
- Enter your domain name (e.g., `dorsu.edu.ph`)
- Or use a subdomain (e.g., `mail.dorsu.edu.ph` or `noreply.dorsu.edu.ph`)
- Click **"Add"**

### Step 3: Add DNS Records
Resend will show you DNS records to add. You'll need to add these **TXT records** to your domain's DNS settings:

**Example DNS Records:**
```
Type: TXT
Name: @ (or your subdomain)
Value: [SPF record from Resend]
```

```
Type: TXT
Name: resend._domainkey (or similar)
Value: [DKIM record from Resend]
```

### Step 4: Add Records to Your DNS Provider
1. Go to your domain's DNS management (wherever you manage DNS - GoDaddy, Cloudflare, Namecheap, etc.)
2. Add the TXT records exactly as Resend shows them
3. Save the changes

### Step 5: Verify in Resend
1. Go back to Resend dashboard
2. Click **"Verify DNS Records"** or wait for automatic verification
3. Verification usually takes **5-30 minutes** (can take up to 72 hours)

### Step 6: Update Environment Variables
Once verified, update in Render:

```env
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@dorsu.edu.ph
```

Or if using a subdomain:
```env
RESEND_FROM_EMAIL=noreply@mail.dorsu.edu.ph
```

## Quick Setup Options

### Option A: Use Main Domain (dorsu.edu.ph)
- Verify `dorsu.edu.ph` in Resend
- Use: `RESEND_FROM_EMAIL=noreply@dorsu.edu.ph`

### Option B: Use Subdomain (Recommended)
- Verify `mail.dorsu.edu.ph` or `noreply.dorsu.edu.ph`
- Use: `RESEND_FROM_EMAIL=noreply@mail.dorsu.edu.ph`
- **Benefit**: Isolates sending reputation from main domain

## After Verification

Once your domain is verified:
1. ✅ You can send to **ANY email address**
2. ✅ No more 403 errors
3. ✅ Professional sender address
4. ✅ Better email deliverability

## Troubleshooting

**DNS records not verifying?**
- Wait up to 72 hours for DNS propagation
- Double-check you copied the records exactly
- Make sure there are no typos in the domain name

**Don't have domain access?**
- Contact your IT department or domain administrator
- Ask them to add the DNS records Resend provides
- Or use a subdomain you have access to

## Current Status

- ❌ **Without verified domain**: Can only send to your Resend account email
- ✅ **With verified domain**: Can send to any email address


