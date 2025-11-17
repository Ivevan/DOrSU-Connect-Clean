import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { API_BASE_URL } from '../config/api.config';
import { getCurrentUser, User } from '../services/authService';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  userToken: string | null;
  userEmail: string | null;
  userName: string | null;
  firebaseUser: User | null;
  login: (token: string, email: string, userName: string, userId: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<boolean>;
  getUserToken: () => Promise<string | null>;
  resetInactivityTimer: () => void; // Reset inactivity timer on user activity
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  
  // Inactivity timer - auto logout after 5 minutes (300,000ms)
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Check authentication status
  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      // Check backend auth
      const token = await AsyncStorage.getItem('userToken');
      const email = await AsyncStorage.getItem('userEmail');
      const name = await AsyncStorage.getItem('userName');
      
      if (token && email) {
        setUserToken(token);
        setUserEmail(email);
        setUserName(name);
        setIsAuthenticated(true);
        return true;
      }
      
      // Check Firebase auth
      try {
        const currentUser = getCurrentUser();
        if (currentUser?.email) {
          setFirebaseUser(currentUser);
          // If no backend token yet, try exchanging Firebase ID token for backend JWT
          if (!token) {
            try {
              // Force refresh the token to ensure it's valid
              const idToken = await currentUser.getIdToken(true);
              
              // Validate token format before sending
              if (!idToken || typeof idToken !== 'string' || idToken.length < 100) {
                console.error('❌ AuthContext: Invalid token format received from Firebase');
                throw new Error('Invalid token format');
              }
              
              // Check if token looks like a JWT (has 3 parts separated by dots)
              const tokenParts = idToken.split('.');
              if (tokenParts.length !== 3) {
                console.error('❌ AuthContext: Token does not appear to be a valid JWT');
                throw new Error('Invalid token format - expected JWT');
              }
              
              console.log('🔄 AuthContext: Attempting Firebase token exchange, token length:', idToken.length, 'parts:', tokenParts.length);
              
              const resp = await fetch(`${API_BASE_URL}/api/auth/firebase-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
              });
              
              const data = await resp.json();
              if (resp.ok && data?.token && data?.user?.id) {
                // Store backend JWT token (same as regular account creation)
                await AsyncStorage.setItem('userToken', data.token);
                
                // Store MongoDB userId from backend response (CRITICAL - same as CreateAccount.tsx)
                // This ensures Google users are saved to MongoDB just like regular users
                await AsyncStorage.setItem('userId', String(data.user.id));
                
                // Store user info
                await AsyncStorage.setItem('userEmail', currentUser.email);
                const userName = data?.user?.username || currentUser.displayName || currentUser.email;
                await AsyncStorage.setItem('userName', userName);
                
                // Update state
                setUserToken(data.token);
                setUserEmail(currentUser.email);
                setUserName(userName);
                
                console.log('✅ AuthContext: Google user saved to MongoDB and backend JWT stored', {
                  userId: data.user.id,
                  email: data.user.email
                });
              } else {
                console.error('❌ AuthContext: Token exchange failed:', {
                  status: resp.status,
                  statusText: resp.statusText,
                  error: data?.error,
                  details: data?.details
                });
              }
            } catch (ex) {
              console.error('❌ AuthContext: Token exchange error:', ex);
              // ignore exchange failure; Firebase token fallback will still work
            }
          }
          setIsAuthenticated(true);
          return true;
        }
      } catch (error) {
        console.error('Firebase auth check error:', error);
      }
      
      setIsAuthenticated(false);
      return false;
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Get user token (for Firebase users, get ID token)
  const getUserToken = async (): Promise<string | null> => {
    try {
      // First check if we have a backend token (preferred - works for chat history)
      const backendToken = await AsyncStorage.getItem('userToken');
      if (backendToken) {
        console.log('✅ getUserToken: Using backend JWT token, length:', backendToken.length);
        return backendToken;
      }
      
      // If no backend token, try to exchange Firebase token for backend JWT first
      try {
        const currentUser = getCurrentUser();
        if (currentUser && typeof currentUser.getIdToken === 'function') {
          // Force refresh to get a valid token
          const idToken = await currentUser.getIdToken(true);
          console.log('🔄 getUserToken: No backend token, attempting token exchange with Firebase ID token...');
          
          // Try to exchange for backend JWT
          const { API_BASE_URL } = require('../config/api.config');
          const resp = await fetch(`${API_BASE_URL}/api/auth/firebase-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          
          const data = await resp.json();
          if (resp.ok && data?.token) {
            // Store backend JWT token
            await AsyncStorage.setItem('userToken', data.token);
            if (data?.user?.id) {
              await AsyncStorage.setItem('userId', String(data.user.id));
            }
            setUserToken(data.token);
            console.log('✅ getUserToken: Token exchange successful, using backend JWT');
            return data.token;
          } else {
            console.warn('⚠️ getUserToken: Token exchange failed, using Firebase ID token as fallback');
          }
          
          // Fallback to Firebase ID token if exchange failed
          console.log('✅ getUserToken: Using Firebase ID token (exchange failed or not attempted)');
          setFirebaseUser(currentUser);
          return idToken;
        }
      } catch (error) {
        console.error('❌ getUserToken: Failed to get or exchange Firebase token:', error);
      }
      
      console.warn('⚠️ getUserToken: No token available');
      return null;
    } catch (error) {
      console.error('❌ getUserToken: Unexpected error:', error);
      return null;
    }
  };

  // Login function
  const login = async (token: string, email: string, name: string, userId: string) => {
    try {
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userEmail', email);
      await AsyncStorage.setItem('userName', name);
      await AsyncStorage.setItem('userId', userId);
      
      setUserToken(token);
      setUserEmail(email);
      setUserName(name);
      setIsAuthenticated(true);
      // Timer will be reset automatically when isAuthenticated changes in useEffect
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Reset inactivity timer - memoized with useCallback
  const resetInactivityTimer = useCallback(() => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    
    // Only set timer if user is authenticated
    if (isAuthenticated) {
      // Set new timer
      inactivityTimerRef.current = setTimeout(async () => {
        console.log('⏰ Auto-logout: User inactive for 5 minutes');
        try {
          await logout();
          // Navigate to GetStarted screen after logout
          // Note: Navigation will be handled by AppNavigator detecting auth state change
        } catch (error) {
          console.error('Auto-logout error:', error);
        }
      }, INACTIVITY_TIMEOUT);
    }
  }, [isAuthenticated]);

  // Logout function
  const logout = async () => {
    try {
      // Clear inactivity timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      
      // Clear AsyncStorage (including admin tokens)
      await AsyncStorage.multiRemove([
        'userToken', 
        'userEmail', 
        'userName', 
        'userId',
        'isAdmin',
        'adminToken',
        'adminEmail'
      ]);
      
      // Clear Firebase auth if logged in
      if (firebaseUser) {
        try {
          const { getFirebaseAuth } = require('../config/firebase');
          const auth = getFirebaseAuth();
          const isJSSDK = auth.signOut !== undefined;
          
          if (isJSSDK) {
            const { signOut } = require('firebase/auth');
            await signOut(auth);
          } else {
            await auth.signOut();
          }
        } catch (error) {
          console.error('Firebase logout error:', error);
        }
      }
      
      // Clear state
      setUserToken(null);
      setUserEmail(null);
      setUserName(null);
      setFirebaseUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Set up inactivity timer when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Reset timer on authentication
      resetInactivityTimer();
      
      // Track app state changes (background/foreground)
      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          // App came to foreground - reset timer
          resetInactivityTimer();
        } else if (nextAppState.match(/inactive|background/)) {
          // App went to background - clear timer (will reset when app comes back)
          if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
          }
        }
        appStateRef.current = nextAppState;
      });
      
      return () => {
        subscription.remove();
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
          inactivityTimerRef.current = null;
        }
      };
    } else {
      // Clear timer if not authenticated
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    }
  }, [isAuthenticated]);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    userToken,
    userEmail,
    userName,
    firebaseUser,
    login,
    logout,
    checkAuthStatus,
    getUserToken,
    resetInactivityTimer, // Expose reset function
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};