import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
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
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '473603633094-s78o8vdig63os6dgpjtoiqkhscspfbua.apps.googleusercontent.com';
// Android OAuth Client ID (type: Android) - optional for some setups
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '473603633094-b8ipfi3qajlds4rm3kvvi4o3dgoabqq4.apps.googleusercontent.com';

// Initialize Google Sign-In (native only; web module is a stub)
if (Platform.OS !== 'web') {
  const googleConfig: any = {
    webClientId: WEB_CLIENT_ID,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  };
  if (ANDROID_CLIENT_ID) {
    googleConfig.androidClientId = ANDROID_CLIENT_ID;
  }
  GoogleSignin.configure(googleConfig);
}

// Auth state change listener type
export type AuthStateListener = (user: FirebaseAuthTypes.User | null) => void;

// Type alias for User (native Firebase Auth user)
export type User = FirebaseAuthTypes.User;

/**
 * Sign in with Google on Android (Native)
 * Uses @react-native-firebase/auth for reliable native authentication
 * Forces account selection by signing out first
 */
export const signInWithGoogleAndroid = async (): Promise<User> => {
  try {
    // Check if your device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Sign out from Google Sign-In to force account selection
    // This ensures the user can choose a different account each time
    try {
      await GoogleSignin.signOut();
    } catch (signOutError) {
      // Ignore sign out errors (user might not be signed in)
      console.log('Sign out before sign in (expected):', signOutError);
    }

    // Get the user's ID token from Google Sign-In
    // This will now always show the account picker
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
 * Forces account selection using prompt parameter
 */
export const signInWithGoogleWeb = async (): Promise<User> => {
  try {
    if (!webFirebaseAuth || !GoogleAuthProvider) {
      throw new Error('Firebase Auth is not initialized for web');
    }

    const { signInWithPopup } = require('firebase/auth');

    // Create Google Auth Provider
    const provider = new GoogleAuthProvider();
    
    // Force account selection by setting prompt parameter
    // This ensures the user can choose a different account each time
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    // Add scopes if needed
    provider.addScope('profile');
    provider.addScope('email');

    // Sign in with popup (recommended for web)
    const result = await signInWithPopup(webFirebaseAuth, provider);
    
    return result.user;
  } catch (error: any) {
    console.error('Google Web Sign-In Error:', error);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed before completing');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by the browser. Please allow popups for this site.');
    } else if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in was cancelled');
    }
    
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
    // Web-specific errors
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by the browser. Please allow popups for this site.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled';
    // Common Firebase errors
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

/**
 * Delete user account from the backend (MongoDB)
 * This will delete the user account and all associated data from the knowledge base
 */
export const deleteAccount = async (token: string): Promise<boolean> => {
  try {
    const apiConfig = require('../config/api.config').default;
    const baseUrl = apiConfig.baseUrl;
    const response = await fetch(`${baseUrl}/api/auth/account`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success === true;
  } catch (error: any) {
    console.error('Failed to delete account:', error);
    throw error;
  }
};


