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
    webClientId: WEB_CLIENT_ID, // Required for server-side authentication
    offlineAccess: true,
    forceCodeForRefreshToken: true,
    // Use native sign-in only - don't fall back to web view
    scopes: ['profile', 'email'],
  };
  if (ANDROID_CLIENT_ID) {
    googleConfig.androidClientId = ANDROID_CLIENT_ID;
  }
  try {
    GoogleSignin.configure(googleConfig);
    console.log('✅ Google Sign-In configured successfully');
  } catch (configError) {
    console.error('❌ Google Sign-In configuration error:', configError);
  }
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
    // Check if your device supports Google Play (only once)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Force account selection by signing out first
    // This ensures the account picker always shows, allowing users to choose which account to use
    try {
      await GoogleSignin.signOut();
    } catch (signOutError) {
      // Ignore sign-out errors (user might not be signed in)
      console.log('No previous Google sign-in to clear');
    }

    // Get the user's ID token from Google Sign-In
    // This uses native sign-in - should not open web view
    // If native sign-in fails, it will throw an error instead of falling back to web view
    // After signing out, this will always show the account picker
    const signInResult = await GoogleSignin.signIn();
    
    if (!signInResult || !signInResult.idToken) {
      throw new Error('No ID token received from Google Sign-In. Native sign-in failed. Please check Google Play Services and try again.');
    }

    const { idToken } = signInResult;

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
      androidClientId: ANDROID_CLIENT_ID,
    });

    // Handle connection errors specifically
    if (error.message?.includes('ERR_CONNECTION_CLOSED') || 
        error.message?.includes('connection') || 
        error.message?.includes('network')) {
      throw new Error('Network connection failed. Please check your internet connection and try again. If the problem persists, verify SHA-1 fingerprint in Firebase Console.');
    }

    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Sign-in was cancelled');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign-in is already in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services not available. Please update Google Play Services from the Play Store.');
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
 * Create user account with email and password (Firebase)
 */
export const createUserWithEmailAndPassword = async (email: string, password: string): Promise<User> => {
  try {
    if (Platform.OS === 'web') {
      if (!webFirebaseAuth) {
        throw new Error('Firebase Auth is not initialized for web');
      }
      const { createUserWithEmailAndPassword: createUser } = require('firebase/auth');
      const userCredential = await createUser(webFirebaseAuth, email, password);
      return userCredential.user;
    } else {
      // Native - React Native Firebase
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      return userCredential.user;
    }
  } catch (error: any) {
    console.error('Create user error:', error);
    
    // Handle Firebase Auth errors
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Please sign in instead.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use a stronger password.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Email/Password authentication is not enabled in Firebase. Please contact support or enable it in Firebase Console under Authentication > Sign-in method.');
    }
    
    throw new Error(error.message || 'Failed to create account');
  }
};

/**
 * Send email verification (Firebase) with deep link support
 */
export const sendEmailVerification = async (user: User): Promise<void> => {
  try {
    console.log('📧 Sending email verification for user:', user.email);
    console.log('📧 Platform:', Platform.OS);
    
    if (!user || !user.email) {
      throw new Error('Invalid user object. Cannot send verification email.');
    }
    
    if (Platform.OS === 'web') {
      const { sendEmailVerification: sendVerification } = require('firebase/auth');
      // Use Firebase default verification URL (no custom redirect)
      console.log('📧 Sending verification email (web) using Firebase default settings');
      await sendVerification(user);
      console.log('✅ Verification email sent successfully (web, default URL)');
    } else {
      // Native - React Native Firebase
      // React Native Firebase sendEmailVerification may not support actionCodeSettings
      // Try simple call first (most reliable)
      console.log('📧 Attempting to send verification email (native)...');
      
      try {
        // First, try without actionCodeSettings (most compatible)
        await user.sendEmailVerification();
        console.log('✅ Verification email sent successfully (native - simple)');
      } catch (simpleError: any) {
        console.warn('⚠️ Simple sendEmailVerification failed, trying with actionCodeSettings:', simpleError);
        
        // Fallback: rethrow the original error if even simple call fails
        console.error('❌ sendEmailVerification (native) failed:', simpleError);
        throw simpleError;
      }
    }
    
    console.log('✅ Email verification process completed successfully');
  } catch (error: any) {
    console.error('❌ Send email verification error:', error);
    console.error('❌ Error code:', error?.code);
    console.error('❌ Error message:', error?.message);
    console.error('❌ Full error:', JSON.stringify(error, null, 2));
    
    // Provide more specific error messages
    if (error?.code === 'auth/too-many-requests') {
      throw new Error('Too many verification emails sent. Please wait a few minutes before requesting another.');
    } else if (error?.code === 'auth/user-not-found') {
      throw new Error('User account not found. Please try creating your account again.');
    } else if (error?.code === 'auth/invalid-action-code') {
      throw new Error('Invalid verification code. Please request a new verification email.');
    } else if (error?.message) {
      throw new Error(`Failed to send verification email: ${error.message}`);
    } else {
      throw new Error('Failed to send verification email. Please check your internet connection and try again. If the problem persists, check your Firebase Console settings.');
    }
  }
};

/**
 * Sign in with email and password (Firebase)
 */
export const signInWithEmailAndPassword = async (email: string, password: string): Promise<User> => {
  try {
    if (Platform.OS === 'web') {
      if (!webFirebaseAuth) {
        throw new Error('Firebase Auth is not initialized for web');
      }
      const { signInWithEmailAndPassword: signIn } = require('firebase/auth');
      const userCredential = await signIn(webFirebaseAuth, email, password);
      return userCredential.user;
    } else {
      // Native - React Native Firebase
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      return userCredential.user;
    }
  } catch (error: any) {
    console.error('Sign in error:', error);
    
    // Handle Firebase Auth errors
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      throw new Error('Invalid email or password.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('This account has been disabled.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    throw new Error(error.message || 'Failed to sign in');
  }
};

/**
 * Reload user to get latest email verification status
 */
export const reloadUser = async (user: User): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      const { reload } = require('firebase/auth');
      await reload(user);
      console.log('✅ User reloaded (web) - emailVerified:', user.emailVerified);
    } else {
      // Native - React Native Firebase
      // Force reload to get latest data from Firebase (important for cross-device detection)
      await user.reload();
      console.log('✅ User reloaded (native) - emailVerified:', user.emailVerified);
    }
  } catch (error: any) {
    console.error('❌ Reload user error:', error);
    throw new Error(error.message || 'Failed to reload user');
  }
};

/**
 * Apply email verification action code from URL
 * This is used when user clicks the verification link in their email
 */
export const applyEmailVerificationCode = async (actionCode: string): Promise<void> => {
  try {
    // Check if email is already verified before applying code
    const currentUser = getCurrentUser();
    if (currentUser?.emailVerified) {
      // Email already verified, no need to apply code
      return;
    }
    
    if (Platform.OS === 'web') {
      const { applyActionCode, getAuth } = require('firebase/auth');
      const firebaseAuth = getAuth();
      await applyActionCode(firebaseAuth, actionCode);
    } else {
      // Native - React Native Firebase - use the imported auth module
      await auth().applyActionCode(actionCode);
    }
  } catch (error: any) {
    // If code is invalid/expired/already used, check if email is now verified
    if (error?.code === 'auth/invalid-action-code' || error?.code === 'auth/expired-action-code') {
      // Code might be invalid because email was already verified
      const currentUser = getCurrentUser();
      if (currentUser?.emailVerified) {
        // Email is verified, silently return (code was already used successfully)
        return;
      }
      // Email not verified, throw error
      throw new Error('Invalid or expired verification code. Please request a new verification email.');
    } else if (error?.message) {
      throw new Error(`Failed to verify email: ${error.message}`);
    } else {
      throw new Error('Failed to verify email. Please try again.');
    }
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

/**
 * Send password reset email (Firebase)
 */
export const sendPasswordResetEmail = async (email: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (!webFirebaseAuth) {
        throw new Error('Firebase Auth is not initialized for web');
      }
      const { sendPasswordResetEmail: sendResetEmail } = require('firebase/auth');
      await sendResetEmail(webFirebaseAuth, email);
    } else {
      // Native - React Native Firebase
      await auth().sendPasswordResetEmail(email);
    }
  } catch (error: any) {
    console.error('Send password reset email error:', error);
    
    // Handle Firebase Auth errors
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email address.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many password reset requests. Please try again later.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    throw new Error(error.message || 'Failed to send password reset email');
  }
};

/**
 * Confirm password reset with action code and new password (Firebase)
 */
export const confirmPasswordReset = async (actionCode: string, newPassword: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (!webFirebaseAuth) {
        throw new Error('Firebase Auth is not initialized for web');
      }
      const { confirmPasswordReset } = require('firebase/auth');
      await confirmPasswordReset(webFirebaseAuth, actionCode, newPassword);
    } else {
      // Native - React Native Firebase
      await auth().confirmPasswordReset(actionCode, newPassword);
    }
  } catch (error: any) {
    console.error('Confirm password reset error:', error);
    
    // Handle Firebase Auth errors
    if (error.code === 'auth/invalid-action-code' || error.code === 'auth/expired-action-code') {
      throw new Error('Invalid or expired reset code. Please request a new password reset email.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use a stronger password.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    throw new Error(error.message || 'Failed to reset password');
  }
};

/**
 * Re-authenticate Firebase user with email and password
 * Required before updating password or sensitive account information
 */
export const reauthenticateUser = async (currentPassword: string): Promise<void> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.email) {
      throw new Error('No user is currently signed in');
    }

    if (Platform.OS === 'web') {
      if (!webFirebaseAuth) {
        throw new Error('Firebase Auth is not initialized for web');
      }
      const { reauthenticateWithCredential, EmailAuthProvider } = require('firebase/auth');
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
    } else {
      // Native - React Native Firebase
      const emailCredential = auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
      await currentUser.reauthenticateWithCredential(emailCredential);
    }
  } catch (error: any) {
    console.error('Re-authentication error:', error);
    
    // Handle Firebase Auth errors
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      throw new Error('Current password is incorrect');
    } else if (error.code === 'auth/user-mismatch') {
      throw new Error('User mismatch. Please sign out and sign in again.');
    } else if (error.code === 'auth/user-not-found') {
      throw new Error('User not found. Please sign out and sign in again.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    throw new Error(error.message || 'Re-authentication failed');
  }
};

/**
 * Update Firebase user password
 * Requires re-authentication first
 */
export const updateFirebasePassword = async (newPassword: string): Promise<void> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('No user is currently signed in');
    }

    if (Platform.OS === 'web') {
      if (!webFirebaseAuth) {
        throw new Error('Firebase Auth is not initialized for web');
      }
      const { updatePassword } = require('firebase/auth');
      await updatePassword(currentUser, newPassword);
    } else {
      // Native - React Native Firebase
      await currentUser.updatePassword(newPassword);
    }
  } catch (error: any) {
    console.error('Update Firebase password error:', error);
    
    // Handle Firebase Auth errors
    if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use a stronger password.');
    } else if (error.code === 'auth/requires-recent-login') {
      throw new Error('Please re-authenticate before changing your password.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    throw new Error(error.message || 'Failed to update password');
  }
};

/**
 * Check if current user is a Firebase email/password user
 */
export const isEmailPasswordUser = (): boolean => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return false;
    }
    
    // Check if user has email/password provider
    // For Firebase, email/password users have providerData with providerId 'password'
    if (currentUser.providerData && currentUser.providerData.length > 0) {
      return currentUser.providerData.some(
        (provider: any) => provider.providerId === 'password' || provider.providerId === 'firebase'
      );
    }
    
    // Fallback: if user has email and no Google provider, assume email/password
    if (currentUser.email) {
      const hasGoogleProvider = currentUser.providerData?.some(
        (provider: any) => provider.providerId === 'google.com'
      );
      return !hasGoogleProvider;
    }
    
    return false;
  } catch {
    return false;
  }
};


