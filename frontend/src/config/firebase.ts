/**
 * Firebase Configuration - Using React Native Firebase (Native)
 * 
 * This module uses @react-native-firebase/app and @react-native-firebase/auth
 * which are native modules that work reliably with React Native.
 * 
 * The native Firebase is initialized in MainApplication.kt, so we just need
 * to import and use the React Native Firebase modules.
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { Platform } from 'react-native';

// For web platform, we still need Firebase JS SDK
let webAuth: any = null;
if (Platform.OS === 'web') {
  // Web uses Firebase JS SDK
  const { initializeApp, getApps } = require('firebase/app');
  const { getAuth } = require('firebase/auth');
  
  const firebaseConfig = {
    apiKey: "AIzaSyC0j8xRHaUezorPFQVNHt0TOxMkU-9jt4g",
    authDomain: "dorsu-connect-a7e25.firebaseapp.com",
    projectId: "dorsu-connect-a7e25",
    storageBucket: "dorsu-connect-a7e25.firebasestorage.app",
    messagingSenderId: "473603633094",
    appId: "1:473603633094:web:b8902108095df87911ccc7",
    measurementId: "G-E88RPCR7NQ"
  };

  let app;
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  webAuth = getAuth(app);
}

/**
 * Get Firebase Auth instance
 * - Native: Returns @react-native-firebase/auth
 * - Web: Returns Firebase JS SDK auth
 */
export function getFirebaseAuth(): FirebaseAuthTypes.Module | any {
  if (Platform.OS === 'web') {
    return webAuth;
  }
  // Native - React Native Firebase is initialized in MainApplication.kt
  return auth();
}

/**
 * Get Firebase Auth instance (async - for compatibility)
 */
export async function getFirebaseAuthAsync(): Promise<FirebaseAuthTypes.Module | any> {
  return getFirebaseAuth();
}

// Export auth instance for direct access
export { auth };
export default auth;


