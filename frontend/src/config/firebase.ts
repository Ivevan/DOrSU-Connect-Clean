/**
 * Firebase Configuration - Cross-Platform Support
 * 
 * - Native builds: Uses @react-native-firebase (configured via google-services.json)
 * - Expo Go / Development: Uses Firebase JS SDK
 * - Web: Uses Firebase JS SDK
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Detect if we're running in native build or Expo Go
const isExpoGo = Constants.appOwnership === 'expo';
const isNativeBuild = !isExpoGo && Platform.OS !== 'web';

let auth: any = null;
let FirebaseAuthTypes: any = null;

// Firebase config for JS SDK (Expo Go and Web) - read from env with fallbacks
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyC0j8xRHaUezorPFQVNHt0TOxMkU-9jt4g",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "dorsu-connect-a7e25.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "dorsu-connect-a7e25",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "dorsu-connect-a7e25.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "473603633094",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:473603633094:web:b8902108095df87911ccc7",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-E88RPCR7NQ"
};

if (isNativeBuild) {
  // Native build - Use React Native Firebase
  try {
    const rnFirebase = require('@react-native-firebase/auth');
    auth = rnFirebase.default;
    FirebaseAuthTypes = rnFirebase.FirebaseAuthTypes;
    console.log('✅ Using React Native Firebase (Native)');
  } catch (error) {
    console.warn('⚠️ React Native Firebase not available, falling back to JS SDK');
    // Fallback to JS SDK
    const { initializeApp, getApps } = require('firebase/app');
    const { getAuth } = require('firebase/auth');
    
    let app;
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = () => getAuth(app);
    console.log('✅ Using Firebase JS SDK (Fallback)');
  }
} else {
  // Expo Go or Web - Use Firebase JS SDK
  const { initializeApp, getApps } = require('firebase/app');
  const { getAuth } = require('firebase/auth');
  
  let app;
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = () => getAuth(app);
  console.log(`✅ Using Firebase JS SDK (${Platform.OS === 'web' ? 'Web' : 'Expo Go'})`);
}

/**
 * Get Firebase Auth instance
 */
export function getFirebaseAuth(): any {
  if (typeof auth === 'function') {
    return auth();
  }
  return auth;
}

/**
 * Get Firebase Auth instance (async - for compatibility)
 */
export async function getFirebaseAuthAsync(): Promise<any> {
  return getFirebaseAuth();
}

// Export auth instance for direct access
export { auth, FirebaseAuthTypes };
export default auth;


