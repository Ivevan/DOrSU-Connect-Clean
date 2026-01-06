/**
 * Manage Accounts Service
 * Handles user account management operations (admin only)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../config/api.config';
import { getCurrentUser } from './authService';

export interface BackendUser {
  _id: string;
  email: string;
  username: string;
  role?: 'user' | 'moderator' | 'admin' | 'superadmin';
  createdAt?: string;
  lastLogin?: string;
  isActive?: boolean;
  profilePicture?: string;
}

interface FirebaseLoginResponse {
  success: boolean;
  token: string;
  user?: {
    id: string;
    email: string;
    username?: string;
  };
}

class ManageAccountsService {
  /**
   * Get authentication token (with admin token support and Firebase token exchange if needed)
   */
  async getToken(): Promise<string | null> {
    try {
      const isAdmin = await AsyncStorage.getItem('isAdmin');
      const isSuperAdmin = await AsyncStorage.getItem('isSuperAdmin');
      const storedToken = await AsyncStorage.getItem('userToken');
      
      // If admin, return admin token directly
      if ((isAdmin === 'true' || isSuperAdmin === 'true') && storedToken && storedToken.startsWith('admin_')) {
        return storedToken;
      }
      
      // For regular users, try to get backend JWT token
      if (storedToken && !storedToken.startsWith('admin_')) {
        return storedToken;
      }

      // If no backend token, try to exchange Firebase ID token
      const currentUser = getCurrentUser();
      if (!currentUser || typeof currentUser.getIdToken !== 'function') {
        console.warn('⚠️ ManageAccountsService.getToken: No Firebase user found');
        return null;
      }

      // Force refresh Firebase token
      const firebaseToken = await currentUser.getIdToken(true);
      if (!firebaseToken) {
        console.warn('⚠️ ManageAccountsService.getToken: Failed to get Firebase token');
        return null;
      }

      // Exchange Firebase token for backend JWT
      try {
        const exchangeResponse = await fetch(`${apiConfig.baseUrl}/api/auth/firebase-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken: firebaseToken }),
        });

        if (exchangeResponse.ok) {
          const data = await exchangeResponse.json() as FirebaseLoginResponse;
          if (data.token) {
            await AsyncStorage.setItem('userToken', data.token);
            if (data.user?.id) {
              await AsyncStorage.setItem('userId', String(data.user.id));
            }
            return data.token;
          }
        }
      } catch (exchangeError) {
        console.warn('⚠️ ManageAccountsService.getToken: Token exchange failed:', exchangeError);
      }

      // Fallback to Firebase token
      return firebaseToken;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<BackendUser[]> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Admin access required');
        }
        throw new Error(errorData.error || `Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      return data.users || [];
    } catch (error: any) {
      console.error('Failed to get users:', error);
      throw error;
    }
  }

  /**
   * Update user active status (admin only)
   */
  async updateUserStatus(userId: string, isActive: boolean): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
        }
        
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error(errorData.error || 'Forbidden: Admin access required');
        } else if (response.status === 400) {
          throw new Error(errorData.error || 'Invalid request');
        }
        throw new Error(errorData.error || errorData.message || `Failed to update status: ${response.statusText}`);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to update user status:', error);
      throw error;
    }
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, role: 'user' | 'moderator' | 'admin' | 'superadmin'): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
        }
        
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          const errorMessage = errorData.error || 'Forbidden: Admin access required';
          throw new Error(errorMessage);
        } else if (response.status === 400) {
          const errorMessage = errorData.error || 'Invalid request. Please check the user ID and role.';
          throw new Error(errorMessage);
        }
        const errorMessage = errorData.error || errorData.message || `Failed to update role: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to update user role:', error);
      throw error;
    }
  }
}

export default new ManageAccountsService();

