# Android Emulator Troubleshooting

## Problem: Emulator Quits Before Opening

The emulator `Pixel_9_API_35` is crashing before it fully starts.

## Solutions

### Solution 1: Start Emulator Manually First

1. Open Android Studio
2. Go to **Tools** → **Device Manager** (or **AVD Manager**)
3. Find **Pixel_9_API_35**
4. Click the **Play** button (▶️) to start it manually
5. Wait for the emulator to fully boot
6. Then run: `npm run android`

### Solution 2: Use a Different Emulator

If the Pixel_9_API_35 emulator is problematic:

1. Open Android Studio → **Tools** → **Device Manager**
2. Create a new emulator:
   - Click **"Create Device"**
   - Select a device (e.g., Pixel 5, Pixel 6)
   - Select a system image (API 33 or 34 recommended)
   - Click **"Finish"**
3. Start the new emulator
4. Run: `npm run android`

### Solution 3: Use Physical Device

Connect your Android device via USB:

1. Enable **Developer Options** on your phone:
   - Go to **Settings** → **About phone**
   - Tap **Build number** 7 times
2. Enable **USB Debugging**:
   - Go to **Settings** → **Developer options**
   - Enable **USB debugging**
3. Connect phone via USB
4. Run: `npm run android`

### Solution 4: Fix Emulator via Command Line

Try these commands:

**List available emulators:**
```powershell
cd C:\Users\ivasa\AppData\Local\Android\Sdk\emulator
.\emulator -list-avds
```

**Start emulator with verbose output to see errors:**
```powershell
.\emulator -avd Pixel_9_API_35 -verbose
```

**Common fixes:**
- Increase emulator RAM: Android Studio → Device Manager → Edit → Advanced Settings → RAM: 2048 MB
- Enable hardware acceleration: Android Studio → Tools → SDK Manager → SDK Tools → Intel x86 Emulator Accelerator (HAXM installer)
- Cold boot: Device Manager → Cold Boot Now

### Solution 5: Reinstall Emulator

If nothing works:

1. Android Studio → **Tools** → **Device Manager**
2. Delete **Pixel_9_API_35** emulator
3. Create a new one with different settings:
   - Use API 33 or 34 (instead of 35)
   - Use x86_64 system image
   - RAM: 2048 MB or 3072 MB

## Quick Fix: Use Physical Device

The fastest solution is to use a physical Android device:

1. Connect your phone via USB
2. Enable USB debugging
3. Run: `npm run android`

Your phone will be detected automatically and the app will install.

---

## Recommended: Use Physical Device for Testing

For Google Sign-In testing, a physical device is often better because:
- ✅ Real Google Play Services
- ✅ No emulator performance issues
- ✅ Faster testing cycles
- ✅ More reliable authentication

---

**Last Updated**: 2024

