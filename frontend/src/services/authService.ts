import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// Web imports (only for web platform)
let webFirebaseAuth: any = null;
let GoogleAuthProvider: any = null;
if (Platform.OS === 'web') {
  const firebaseAuth = require('firebase/auth');
  GoogleAuthProvider = firebaseAuth.GoogleAuthProvider;
  const { getFirebaseAuth } = require('../config/firebase');
  webFirebaseAuth = getFirebaseAuth();
}

// Configure Google Sign-In for Android
// Web Client ID from Google Cloud Console (auto-created by Firebase)
const WEB_CLIENT_ID = '473603633094-s78o8vdig63os6dgpjtoiqkhscspfbua.apps.googleusercontent.com';

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID, // Required for Android - use Web Client ID
  offlineAccess: true, // If you want to access Google API on behalf of the user FROM YOUR SERVER
  forceCodeForRefreshToken: true, // [Android] related to `serverAuthCode`, read the docs link below *.
});

// Complete authentication session for web
WebBrowser.maybeCompleteAuthSession();

// Auth state change listener type
export type AuthStateListener = (user: FirebaseAuthTypes.User | null) => void;

// Type alias for User (native Firebase Auth user)
export type User = FirebaseAuthTypes.User;

/**
 * Sign in with Google on Android (Native)
 * Uses @react-native-firebase/auth for reliable native authentication
 */
export const signInWithGoogleAndroid = async (): Promise<User> => {
  try {
    // Check if your device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Get the user's ID token from Google Sign-In
    const { idToken } = await GoogleSignin.signIn();

    if (!idToken) {
      throw new Error('No ID token received from Google Sign-In');
    }

    // Create a Google credential with the token
    // Using React Native Firebase's credential method
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);

    // Sign in to Firebase with the Google credential
    // This is the native Firebase Auth method - no initialization issues!
    const userCredential = await auth().signInWithCredential(googleCredential);
    
    return userCredential.user;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      webClientId: WEB_CLIENT_ID,
    });

    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Sign-in was cancelled');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign-in is already in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services not available');
    } else if (error.code === statusCodes.SIGN_IN_REQUIRED) {
      throw new Error('Sign-in required. Please try again.');
    } else if (error.code === '10' || error.message?.includes('DEVELOPER_ERROR')) {
      // DEVELOPER_ERROR - usually means SHA-1 mismatch or wrong Client ID
      throw new Error('DEVELOPER_ERROR: Please verify SHA-1 fingerprint is added in Firebase Console and Google Cloud Console. Also verify the Web Client ID is correct.');
    } else if (error.code?.startsWith('auth/')) {
      // Firebase Auth error codes
      throw new Error(error.message || 'Firebase authentication failed');
    } else {
      throw new Error(error.message || 'Google sign-in failed');
    }
  }
};

/**
 * Sign in with Google on Web
 */
export const signInWithGoogleWeb = async (): Promise<User> => {
  try {
    if (!webFirebaseAuth || !GoogleAuthProvider) {
      throw new Error('Firebase Auth is not initialized for web');
    }

    const { signInWithCredential } = require('firebase/auth');

    // Create a random state string for security
    const state = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Math.random().toString()
    );

    // Create the auth request
    const request = new AuthSession.AuthRequest({
      clientId: WEB_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      state,
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'dorsuconnect',
        path: 'auth/callback',
      }),
    });

    // Get the discovery document
    const discovery = await AuthSession.fetchDiscoveryAsync(
      'https://accounts.google.com'
    );

    // Start the authentication session
    const result = await request.promptAsync(discovery, {
      showInRecents: true,
    });

    if (result.type === 'success') {
      const { id_token } = result.params;
      
      if (!id_token) {
        throw new Error('No ID token received');
      }

      // Create a Google credential with the token
      const googleCredential = GoogleAuthProvider.credential(id_token);

      // Sign in to Firebase with the Google credential
      const userCredential = await signInWithCredential(webFirebaseAuth, googleCredential);
      
      return userCredential.user;
    } else {
      throw new Error('Authentication was cancelled or failed');
    }
  } catch (error: any) {
    console.error('Google Web Sign-In Error:', error);
    throw new Error(error.message || 'Google sign-in failed');
  }
};

/**
 * Sign in with Google (Platform-aware)
 */
export const signInWithGoogle = async (): Promise<User> => {
  if (Platform.OS === 'web') {
    return signInWithGoogleWeb();
  } else {
    return signInWithGoogleAndroid();
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<void> => {
  try {
    if (Platform.OS !== 'web') {
      // Sign out from Google Sign-In
      await GoogleSignin.signOut();
      // Sign out from Firebase (native)
      await auth().signOut();
    } else {
      // Sign out from Firebase (web)
      if (webFirebaseAuth) {
        const { signOut: firebaseSignOut } = require('firebase/auth');
        await firebaseSignOut(webFirebaseAuth);
      }
    }
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

/**
 * Get the current user
 */
export const getCurrentUser = (): User | null => {
  try {
    if (Platform.OS === 'web') {
      if (!webFirebaseAuth) {
        return null;
      }
      return webFirebaseAuth.currentUser;
    }
    // Native - React Native Firebase
    return auth().currentUser;
  } catch {
    return null;
  }
};

/**
 * Check if user is signed in
 */
export const isSignedIn = (): boolean => {
  return getCurrentUser() !== null;
};

/**
 * Subscribe to authentication state changes
 */
export const onAuthStateChange = (callback: AuthStateListener): (() => void) => {
  if (Platform.OS === 'web') {
    // Web - Firebase JS SDK
    let unsubscribe: (() => void) | null = null;
    if (webFirebaseAuth) {
      const { onAuthStateChanged } = require('firebase/auth');
      unsubscribe = onAuthStateChanged(webFirebaseAuth, callback);
    }
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }
  
  // Native - React Native Firebase
  // This is synchronous and reliable - no initialization issues!
  return auth().onAuthStateChanged(callback);
};

/**
 * Get Google Sign-In error message
 */
export const getGoogleSignInErrorMessage = (error: any): string => {
  if (!error.code) {
    return error.message || 'An unknown error occurred';
  }

  switch (error.code) {
    case statusCodes.SIGN_IN_CANCELLED:
      return 'Sign-in was cancelled';
    case statusCodes.IN_PROGRESS:
      return 'Sign-in is already in progress';
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return 'Google Play Services not available. Please update Google Play Services.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/invalid-credential':
      return 'Invalid credentials. Please try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'User not found.';
    case 'auth/wrong-password':
      return 'Wrong password.';
    case 'auth/email-already-in-use':
      return 'This email is already in use.';
    case 'auth/weak-password':
      return 'Password is too weak.';
    default:
      return error.message || 'An error occurred during sign-in';
  }
};


