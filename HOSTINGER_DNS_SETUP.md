# Hostinger DNS Setup Guide for Resend

## Step-by-Step Instructions

### 1. Access DNS Management in Hostinger

**Path 1 (Most Common):**
1. Log in to Hostinger: https://hpanel.hostinger.com
2. Click **"Domains"** in the left sidebar
3. Find your domain and click **"Manage"** button
4. Click on **"DNS / Name Servers"** tab
5. Click **"Manage DNS Records"** or **"DNS Zone Editor"**

**Path 2 (Alternative):**
1. Log in to Hostinger
2. Click **"Domains"** in the left sidebar
3. Click directly on your domain name
4. Look for **"DNS Zone Editor"** or **"DNS Management"**

### 2. What You'll See

You should see a table/list with existing DNS records like:
- A records
- CNAME records
- MX records
- TXT records

### 3. Add Resend DNS Records

After adding your domain in Resend, you'll get DNS records like:

**Example SPF Record:**
- **Type:** TXT
- **Name/Host:** `@` (or blank for root domain)
- **Value:** `v=spf1 include:_spf.resend.com ~all`
- **TTL:** 3600

**Example DKIM Record:**
- **Type:** TXT
- **Name/Host:** `_resend` (or `_resend.yourdomain.com`)
- **Value:** `[Long string from Resend]`
- **TTL:** 3600

**Steps to Add:**
1. Click **"Add Record"** or **"+"** button
2. Select **Type:** `TXT`
3. Enter **Name/Host:** (exactly as Resend shows)
4. Paste **Value:** (exactly as Resend shows - copy the full string)
5. Set **TTL:** `3600` (or leave default)
6. Click **"Add Record"** or **"Save"**

### 4. Important Notes

- ⚠️ **Copy DNS records EXACTLY** as shown in Resend (no extra spaces)
- ⚠️ **Wait 5-30 minutes** for DNS propagation
- ⚠️ **Check Resend dashboard** for verification status
- ⚠️ **Don't delete existing DNS records** unless you know what they're for

### 5. Verify in Resend

1. Go back to Resend dashboard: https://resend.com/domains
2. Check your domain status
3. Status should change from "Pending" to "Verified" ✅

### 6. Update Environment Variable

Once verified, in Render (or your deployment):
```
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

Replace `yourdomain.com` with your actual verified domain.

## Troubleshooting

**Can't find DNS settings?**
- Look for: "DNS Zone Editor", "DNS Management", "Manage DNS", "Advanced DNS"
- Contact Hostinger support if still can't find it

**DNS not verifying?**
- Wait longer (up to 48 hours, but usually 5-30 minutes)
- Double-check you copied the records exactly
- Make sure you're editing the correct domain
- Check if there are multiple DNS management interfaces (some accounts have both)

**Need help?**
- Share a screenshot of what you see in Hostinger
- Or describe the exact menu options you see



