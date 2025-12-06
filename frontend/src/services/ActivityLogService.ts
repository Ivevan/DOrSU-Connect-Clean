/**
 * Activity Log Service
 * Handles fetching activity logs from the backend (admin only)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../config/api.config';
import { getCurrentUser } from './authService';

export interface ActivityLog {
  _id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  action: string;
  details: Record<string, any>;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date | string;
  };
  createdAt: Date | string;
}

export interface ActivityLogFilters {
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  userEmail?: string;
  limit?: number;
  skip?: number;
}

export interface ActivityLogResponse {
  logs: ActivityLog[];
  total: number;
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

class ActivityLogService {
  /**
   * Get authentication token (with admin token support and Firebase token exchange if needed)
   */
  async getToken(): Promise<string | null> {
    try {
      const isAdmin = await AsyncStorage.getItem('isAdmin');
      const storedToken = await AsyncStorage.getItem('userToken');
      
      // If admin, return admin token directly
      if (isAdmin === 'true' && storedToken && storedToken.startsWith('admin_')) {
        return storedToken;
      }
      
      // For regular users, try to get backend JWT token
      if (storedToken && !storedToken.startsWith('admin_')) {
        return storedToken;
      }

      // If no backend token, try to exchange Firebase ID token
      const currentUser = getCurrentUser();
      if (!currentUser || typeof currentUser.getIdToken !== 'function') {
        console.warn('⚠️ ActivityLogService.getToken: No Firebase user found');
        return null;
      }

      // Force refresh Firebase token
      const firebaseToken = await currentUser.getIdToken(true);
      if (!firebaseToken) {
        console.warn('⚠️ ActivityLogService.getToken: Failed to get Firebase token');
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
        console.warn('⚠️ ActivityLogService.getToken: Token exchange failed:', exchangeError);
      }

      // Fallback to Firebase token
      return firebaseToken;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  /**
   * Get activity logs with optional filters
   */
  async getActivityLogs(filters: ActivityLogFilters = {}): Promise<ActivityLogResponse> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      // Build query string
      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userEmail) params.append('userEmail', filters.userEmail);
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.skip) params.append('skip', String(filters.skip));

      const queryString = params.toString();
      const url = `${apiConfig.baseUrl}/api/activity-logs${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
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
        throw new Error(errorData.error || `Failed to fetch activity logs: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        logs: data.logs || [],
        total: data.total || 0,
      };
    } catch (error: any) {
      console.error('Failed to get activity logs:', error);
      throw error;
    }
  }

  /**
   * Get activity logs for a specific user
   */
  async getActivityLogsByUser(userId: string, limit = 100, skip = 0): Promise<ActivityLogResponse> {
    return this.getActivityLogs({ userId, limit, skip });
  }

  /**
   * Get activity logs by action type
   */
  async getActivityLogsByAction(action: string, limit = 100, skip = 0): Promise<ActivityLogResponse> {
    return this.getActivityLogs({ action, limit, skip });
  }
}

export default new ActivityLogService();

