# Complete Google OAuth Setup Guide for Firebase Android App

This is a comprehensive step-by-step guide to set up Google OAuth authentication with Firebase for your Android app. Follow each step carefully.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: Firebase Console Setup](#part-1-firebase-console-setup)
3. [Part 2: Get SHA-1 Fingerprint](#part-2-get-sha-1-fingerprint)
4. [Part 3: Google Cloud Console Setup](#part-3-google-cloud-console-setup)
5. [Part 4: Update Your Code](#part-4-update-your-code)
6. [Part 5: Test the Implementation](#part-5-test-the-implementation)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:
- ✅ Google account (for Firebase and Google Cloud Console)
- ✅ Android Studio installed (for getting SHA-1)
- ✅ Node.js and npm installed
- ✅ Your app's package name: `com.dorsuconnect.app`

---

## Part 1: Firebase Console Setup

### Step 1.1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `DOrSU-Connect` (or your preferred name)
4. Follow the wizard:
   - Enable/disable Google Analytics (optional)
   - Click **"Create project"**
   - Wait for project creation to complete
   - Click **"Continue"**

### Step 1.2: Add Android App to Firebase

1. In Firebase Console, click the **Android icon** (</>) or **"Add app"** → **Android**
2. Register your Android app:
   - **Android package name**: `com.dorsuconnect.app`
   - **App nickname** (optional): `DOrSU Connect Android`
   - **Debug signing certificate SHA-1**: Leave blank for now (we'll add this in Part 2)
   - Click **"Register app"**
3. **Download `google-services.json`**:
   - Click **"Download google-services.json"**
   - **IMPORTANT**: Do NOT place it yet - we need to add SHA-1 first
   - Keep the file location noted

### Step 1.3: Enable Google Authentication

1. In Firebase Console, go to **"Authentication"** in the left menu
2. Click **"Get started"** (if first time)
3. Go to **"Sign-in method"** tab
4. Click on **"Google"** provider
5. Toggle **"Enable"**
6. Set **Project support email** (select your email)
7. Click **"Save"**

### Step 1.4: Add Web App to Firebase (for Web Client ID)

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to **"Your apps"** section
3. Click **"Add app"** → **Web** (</> icon)
4. Register Web app:
   - **App nickname**: `DOrSU Connect Web`
   - **Firebase Hosting**: Leave unchecked (unless you need it)
   - Click **"Register app"**
5. **Copy the Firebase config object** - it looks like:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
   **Save these values** - you'll need them in Part 4.

---

## Part 2: Get SHA-1 Fingerprint

### Step 2.1: Get SHA-1 from Debug Keystore

**Windows PowerShell:**
```powershell
cd android
.\gradlew signingReport
```

**Windows CMD:**
```cmd
cd android
gradlew signingReport
```

**Mac/Linux:**
```bash
cd android
./gradlew signingReport
```

### Step 2.2: Find SHA-1 in Output

Look for output like this:
```
Variant: debug
Config: debug
Store: C:\Users\YourName\.android\debug.keystore
Alias: AndroidDebugKey
SHA1: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
SHA256: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

**Copy the SHA-1 value** (the one with colons, like: `DA:F4:A9:CF:...`)

### Step 2.3: Add SHA-1 to Firebase Console

1. Go back to Firebase Console
2. Go to **Project Settings** (gear icon)
3. Scroll to **"Your apps"** section
4. Find your **Android app** (`com.dorsuconnect.app`)
5. Click **"Add fingerprint"**
6. Paste your **SHA-1** fingerprint
7. Click **"Save"**
8. **Now download `google-services.json` again**:
   - Click **"Download google-services.json"** (or refresh the page)
   - This new file will include your SHA-1
9. Place the file in: `android/app/google-services.json`

---

## Part 3: Google Cloud Console Setup

### Step 3.1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select the project that's linked to your Firebase project
   - **Note**: Firebase automatically creates a Google Cloud project
   - If you don't see it, go to Firebase Console → Project Settings → General → Scroll down to find "Google Cloud Platform" section

### Step 3.2: Verify OAuth Client IDs (Auto-Created by Firebase)

**Good news!** Firebase automatically creates OAuth Client IDs when you add your apps.

1. In Google Cloud Console, go to **"APIs & Services"** → **"Credentials"**
2. You should see:
   - **"Android client for com.dorsuconnect.app (auto created by Google Service)"** - This is your Android OAuth Client ID
   - **"Web client (auto created by Google Service)"** - This is your Web OAuth Client ID (you need this!)

### Step 3.3: Get Your Web Client ID

1. In the **"OAuth 2.0 Client IDs"** section, find **"Web client (auto created by Google Service)"**
2. Click on it or click the **copy icon** (📋) next to the Client ID
3. **Copy the full Client ID** (looks like: `123456789-xxxxxxxxxxxxx.apps.googleusercontent.com`)
4. **Save this value** - you'll need it in Part 4

**Note**: If you have multiple Web clients, use the one created most recently (usually when you added the Web app to Firebase).

### Step 3.4: Verify OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Verify settings:
   - **User Type**: External (for most apps)
   - **App name**: Your app name
   - **User support email**: Your email
   - **Publishing status**: **Testing** (for development) or **In production** (for production)
   - **Scopes**: Should include `email`, `profile`, `openid` (usually auto-added)
   - **Test users**: Add your Google account if in Testing mode
3. Click **"Save"** if you made any changes

---

## Part 4: Update Your Code

### Step 4.1: Update Firebase Configuration

Open `frontend/src/config/firebase.ts` and replace the placeholder values:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // From Step 1.4
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // From Step 1.4
  projectId: "YOUR_PROJECT_ID", // From Step 1.4
  storageBucket: "YOUR_PROJECT_ID.appspot.com", // From Step 1.4
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // From Step 1.4
  appId: "YOUR_APP_ID" // From Step 1.4
};
```

**Example:**
```typescript
const firebaseConfig = {
  apiKey: "AIzaSyCTNfqBxXUYN_AbNFJ_RTN7fDaI9nsbKZE",
  authDomain: "dorsu-connect.firebaseapp.com",
  projectId: "dorsu-connect",
  storageBucket: "dorsu-connect.firebasestorage.app",
  messagingSenderId: "281445073941",
  appId: "1:281445073941:web:9d2465d386daece38e7a1c"
};
```

### Step 4.2: Update Web Client ID

Open `frontend/src/services/authService.ts` and replace:

```typescript
const WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
```

With your actual Web Client ID from Step 3.3:

```typescript
const WEB_CLIENT_ID = '123456789-xxxxxxxxxxxxx.apps.googleusercontent.com';
```

### Step 4.3: Verify google-services.json

1. Ensure `android/app/google-services.json` exists
2. Verify it contains:
   - `project_id`: Your Firebase project ID
   - `package_name`: `com.dorsuconnect.app`
   - The file should be the one downloaded AFTER adding SHA-1

---

## Part 5: Test the Implementation

### Step 5.1: Install Dependencies

```bash
npm install
```

### Step 5.2: Rebuild Android App

```bash
npm run android
```

or

```bash
npx expo run:android
```

### Step 5.3: Test Google Sign-In

1. Launch the app on your device/emulator
2. Navigate to the GetStarted screen
3. Tap **"Continue with Google"** button
4. Select your Google account
5. Grant permissions if prompted
6. Verify you're authenticated and redirected

---

## Troubleshooting

### Issue: "DEVELOPER_ERROR" (Error Code 10)

**Causes:**
- SHA-1 fingerprint not added or incorrect
- Wrong Web Client ID in code
- Package name mismatch

**Solution:**
1. Verify SHA-1 is added in Firebase Console (Step 2.3)
2. Verify SHA-1 matches your debug keystore (run `gradlew signingReport` again)
3. Download `google-services.json` again after adding SHA-1
4. Verify Web Client ID in code matches Google Cloud Console
5. Clean and rebuild:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npm run android
   ```

### Issue: "Component auth has not been registered yet"

**Causes:**
- Firebase Auth not initialized properly
- Native modules not loaded

**Solution:**
1. Ensure Firebase config values are correct
2. Rebuild the app completely
3. Restart Metro bundler with cache reset:
   ```bash
   npm start -- --reset-cache
   ```

### Issue: "Invalid credentials"

**Causes:**
- Wrong Client ID being used
- Using Android Client ID instead of Web Client ID

**Solution:**
1. Use the **Web Client ID** (not Android Client ID) in `authService.ts`
2. Verify the Client ID matches Google Cloud Console
3. The Android Client ID is automatically configured via `google-services.json`

### Issue: App crashes on Google Sign-In

**Causes:**
- Google Play Services not available
- Missing permissions

**Solution:**
1. Test on a device with Google Play Services (not AOSP)
2. Or use an emulator with Google APIs installed
3. Ensure internet permission is in AndroidManifest.xml (should already be there)

---

## Important Notes

1. **SHA-1 Fingerprint**: Must be added to Firebase Console **BEFORE** downloading `google-services.json`
2. **Web Client ID**: Use the **Web** Client ID (not Android) in your code
3. **google-services.json**: Must be downloaded **AFTER** adding SHA-1 fingerprint
4. **Rebuild Required**: After any configuration changes, rebuild the app
5. **Test Users**: Add your Google account as a test user in OAuth consent screen if in Testing mode

---

## Checklist

Use this checklist to ensure everything is set up:

### Firebase Console
- [ ] Created Firebase project
- [ ] Added Android app with package name: `com.dorsuconnect.app`
- [ ] Got SHA-1 fingerprint from `gradlew signingReport`
- [ ] Added SHA-1 fingerprint to Android app in Firebase Console
- [ ] Downloaded `google-services.json` (after adding SHA-1) and placed in `android/app/`
- [ ] Added Web app to Firebase
- [ ] Copied Firebase config values from Web app
- [ ] Enabled Google Authentication provider

### Google Cloud Console
- [ ] Verified Android OAuth Client ID exists (auto-created)
- [ ] Copied Web Client ID from "Web client (auto created by Google Service)"
- [ ] Verified OAuth consent screen settings
- [ ] Added test users (if in Testing mode)

### Code Configuration
- [ ] Updated `frontend/src/config/firebase.ts` with Firebase config values
- [ ] Updated `frontend/src/services/authService.ts` with Web Client ID
- [ ] Verified `google-services.json` is in `android/app/` directory
- [ ] Installed dependencies: `npm install`

### Testing
- [ ] Rebuilt Android app: `npm run android`
- [ ] Tested Google Sign-In on device/emulator
- [ ] Verified authentication works and user is redirected

---

## Quick Reference

### Files to Update
1. `frontend/src/config/firebase.ts` - Firebase config values
2. `frontend/src/services/authService.ts` - Web Client ID
3. `android/app/google-services.json` - Download from Firebase Console

### Where to Get Values
- **Firebase Config**: Firebase Console → Project Settings → Web app
- **Web Client ID**: Google Cloud Console → Credentials → Web client (auto created)
- **SHA-1**: Run `cd android && ./gradlew signingReport`

### Key Points
- ✅ Use **Web Client ID** in code (not Android Client ID)
- ✅ Add **SHA-1** before downloading `google-services.json`
- ✅ Rebuild after configuration changes
- ✅ OAuth Client IDs are auto-created by Firebase (no manual creation needed)

---

**Last Updated**: 2024
**Version**: 1.0.0

