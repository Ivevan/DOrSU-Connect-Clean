# API Configuration Guide

## Quick Start

### Method 1: Using .env file (Recommended)

1. Copy `.env.example` to `.env` (already done for you)
2. Edit `.env` and change `EXPO_PUBLIC_API_ENV` to switch environments:

```env
# For local development
EXPO_PUBLIC_API_ENV=localhost

# For production (Render)
EXPO_PUBLIC_API_ENV=render
```

3. Run your app normally:
```bash
npm start
# or
npm run android
npm run ios
```

### Method 2: Using npm scripts (Override .env)

Run with local backend:
```bash
npm run start:local      # Start Expo with localhost API
npm run android:local    # Run Android with localhost API
npm run ios:local        # Run iOS with localhost API
```

Run with Render backend:
```bash
npm run start:render     # Start Expo with Render API
npm run android:render   # Run Android with Render API
npm run ios:render       # Run iOS with Render API
```

## Configuration Details

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_ENV` | Switch between 'localhost' or 'render' | `localhost` |
| `EXPO_PUBLIC_API_BASE_URL_LOCAL` | Your local backend URL | `http://localhost:3000` |
| `EXPO_PUBLIC_API_BASE_URL_RENDER` | Your production Render URL | `https://dorsu-connect.onrender.com` |

### Platform-Specific URLs

When using **localhost** mode, adjust the URL based on your device:

- **iOS Simulator**: `http://localhost:3000`
- **Android Emulator**: `http://10.0.2.2:3000`
- **Physical Device**: `http://YOUR_COMPUTER_IP:3000` (e.g., `http://192.168.1.100:3000`)

Update `EXPO_PUBLIC_API_BASE_URL_LOCAL` in `.env` accordingly.

## Testing the Configuration

After starting your app, check the console logs to verify which API URL is being used. The app will log the active API base URL on startup.

## Troubleshooting

1. **Can't connect to localhost from Android Emulator**
   - Change URL to `http://10.0.2.2:3000`

2. **Can't connect from physical device**
   - Find your computer's IP address
   - Make sure device and computer are on the same network
   - Update `.env` with your computer's IP

3. **Changes not taking effect**
   - Stop the Expo server
   - Clear cache: `expo start -c`
   - Restart the app
