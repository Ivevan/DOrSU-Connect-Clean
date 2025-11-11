import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
