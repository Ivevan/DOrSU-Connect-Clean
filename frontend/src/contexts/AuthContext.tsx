import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
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
  getUserToken: () => Promise<string | null>; // Add this method
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
              const idToken = await currentUser.getIdToken();
              const resp = await fetch(`${API_BASE_URL}/api/auth/firebase-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
              });
              const data = await resp.json();
              if (resp.ok && data?.token) {
                await AsyncStorage.setItem('userToken', data.token);
                await AsyncStorage.setItem('userEmail', currentUser.email);
                await AsyncStorage.setItem('userName', currentUser.displayName || currentUser.email);
                setUserToken(data.token);
                setUserEmail(currentUser.email);
                setUserName(currentUser.displayName || currentUser.email);
              }
            } catch (ex) {
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
    // First check if we have a backend token
    const backendToken = await AsyncStorage.getItem('userToken');
    if (backendToken) {
      return backendToken;
    }
    
    // If no backend token, check if we have a Firebase user
    if (firebaseUser) {
      try {
        // Get Firebase ID token
        const idToken = await firebaseUser.getIdToken();
        return idToken;
      } catch (error) {
        console.error('Failed to get Firebase ID token:', error);
        return null;
      }
    }
    
    return null;
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
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Clear AsyncStorage
      await AsyncStorage.multiRemove(['userToken', 'userEmail', 'userName', 'userId']);
      
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
    getUserToken, // Add this method
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};