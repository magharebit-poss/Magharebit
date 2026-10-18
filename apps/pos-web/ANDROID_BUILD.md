# MAGHAREBIT POS — Android APK Build Guide

## Prerequisites
- Node.js 18+
- Android Studio installed
- Android SDK (API level 33+)
- Java 17+

## Development (live reload on device)
1. Connect Android device via USB
   (enable USB debugging in developer options)
2. Set backend IP in .env.local:
   NEXT_PUBLIC_NATIVE_API_URL=http://YOUR_IP:3001
   NEXT_PUBLIC_IS_NATIVE=true
3. Build and sync:
   npm run build:native
   npm run cap:sync
4. Run on device:
   npm run cap:run

## Production APK
1. Build static export:
   npm run build:native
2. Sync to Android:
   npm run cap:sync
3. Open Android Studio:
   npm run cap:open
4. In Android Studio:
   Build → Generate Signed Bundle/APK
   Choose APK → Next
   Create or use existing keystore
   Build variant: release
5. APK location:
   android/app/build/outputs/apk/release/

## Backend connectivity
The Android app communicates with the backend
over the local network (WiFi/LAN) or via a
public HTTPS URL.

For production deployment:
- Host backend at https://api.magharebit.ma
- Set NEXT_PUBLIC_NATIVE_API_URL accordingly
- Use HTTPS to avoid cleartext traffic issues

## Features included in APK
- Licensing gate (offline-capable, 72h grace)
- POS with Arabic RTL interface
- DIBAL scale via Web Serial (Chrome/Edge only,
  not available in Capacitor WebView — use
  a Web Serial bridge or BLE scale adapter)
- Customer credit ledger (كريدي)
- Thermal printer via Web USB (same note as above
  — USB accessories need native Capacitor plugin)
- Café table management + KDS screen
- Offline-first cart (all data local until sync)

## Web Serial & Web USB in Capacitor
Web Serial and Web USB are Chrome-specific APIs
not available in the Android WebView.
For production scale/printer integration:
- Use @capacitor-community/bluetooth-le for BLE scales
- Use a native USB plugin for thermal printers
- Or run the POS in Chrome on Android for full
  Web Serial/USB support
