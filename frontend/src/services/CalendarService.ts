/**
 * Calendar Service
 * Handles fetching calendar events from the backend
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../config/api.config';
import cacheManager from '../utils/cacheManager';
import requestDeduplicator from '../utils/requestDeduplicator';
import { getCurrentUser } from './authService';

export interface CalendarEvent {
  _id?: string;
  title: string;
  date: string;
  isoDate: string;
  time: string;
  category: string;
  description?: string;
  source?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  // New fields for date ranges, weeks, and months
  dateType?: 'date' | 'date_range' | 'week' | 'month';
  startDate?: string;
  endDate?: string;
  weekOfMonth?: number;
  month?: number;
  year?: number;
}

class CalendarService {
  private baseUrl: string = apiConfig.baseUrl;

  /**
   * Get authentication token (with admin token support and Firebase token exchange if needed)
   */
  async getToken(): Promise<string | null> {
    try {
      // Check if user is admin first
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
        console.warn('⚠️ CalendarService.getToken: No Firebase user found or getIdToken not available');
        return null;
      }

      // Force refresh Firebase token
      const firebaseToken = await currentUser.getIdToken(true);
      
      if (!firebaseToken) {
        console.warn('⚠️ CalendarService.getToken: Failed to get Firebase token');
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
          const data = await exchangeResponse.json();
          if (data.token) {
            await AsyncStorage.setItem('userToken', data.token);
            if (data.user?.id) {
              await AsyncStorage.setItem('userId', String(data.user.id));
            }
            return data.token;
          }
        }
      } catch (exchangeError) {
        console.warn('⚠️ CalendarService.getToken: Token exchange failed:', exchangeError);
      }

      // Fallback to Firebase token (though backend might not accept it)
      return firebaseToken;
    } catch (error) {
      console.error('❌ CalendarService.getToken: Error getting token:', error);
      return null;
    }
  }

  /**
   * Get calendar events from the backend
   * @param startDate Optional start date filter (ISO string)
   * @param endDate Optional end date filter (ISO string)
   * @param category Optional category filter
   * @param limit Maximum number of events to return
   */
  async getEvents(params?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    limit?: number;
    forceRefresh?: boolean;
  }): Promise<CalendarEvent[]> {
    // Create cache key from params
    const cacheKey = `calendar_events_${params?.startDate || 'all'}_${params?.endDate || 'all'}_${params?.category || 'all'}_${params?.limit || 'all'}`;
    const CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache

    // Check cache first (unless force refresh)
    if (!params?.forceRefresh && cacheManager.has(cacheKey)) {
      const cached = cacheManager.get<CalendarEvent[]>(cacheKey);
      if (cached) {
        if (__DEV__) console.log('📦 Returning cached calendar events:', cached.length);
        return cached;
      }
    }

    // Use request deduplication
    return requestDeduplicator.deduplicate(cacheKey, async () => {
      try {
        const queryParams = new URLSearchParams();
        if (params?.startDate) queryParams.append('startDate', params.startDate);
        if (params?.endDate) queryParams.append('endDate', params.endDate);
        if (params?.category) queryParams.append('category', params.category);
        if (params?.limit) queryParams.append('limit', String(params.limit));

        const url = `${this.baseUrl}/api/calendar/events${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && Array.isArray(data.events)) {
          // Cache the result
          cacheManager.set(cacheKey, data.events, CACHE_TTL);
          if (__DEV__) console.log('✅ Fetched and cached', data.events.length, 'calendar events');
          return data.events;
        }
        
        return [];
      } catch (error) {
        if (__DEV__) console.error('Failed to get calendar events:', error);
        return [];
      }
    });
  }

  /**
   * Get calendar event by ID
   */
  async getEventById(eventId: string): Promise<CalendarEvent | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/calendar/events/${eventId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.event) {
        return data.event;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get calendar event:', error);
      return null;
    }
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      console.log('🗑️ CalendarService.deleteEvent called', { eventId, baseUrl: this.baseUrl });
      const token = await this.getToken();
      console.log('🔑 Token retrieved', { hasToken: !!token });
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = `${this.baseUrl}/api/admin/calendar/events/${eventId}`;
      console.log('📤 Sending DELETE request', { url, method: 'DELETE', hasAuth: !!token });

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      console.log('📥 DELETE response received', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ DELETE request failed', { status: response.status, errorText });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ DELETE response data', { data, success: data.success });
      return data.success === true;
    } catch (error) {
      console.error('❌ Failed to delete calendar event:', error);
      return false;
    }
  }

  /**
   * Update calendar event
   */
  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
    try {
      const token = await this.getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/api/admin/calendar/events/${eventId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.event) {
        return data.event;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      return null;
    }
  }

  /**
   * Delete all calendar events
   */
  async deleteAllEvents(): Promise<{ success: boolean; deletedCount?: number }> {
    try {
      const token = await this.getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/api/admin/calendar/events`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: data.success === true,
        deletedCount: data.deletedCount
      };
    } catch (error) {
      console.error('Failed to delete all calendar events:', error);
      return { success: false };
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
    try {
      const token = await this.getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/api/admin/calendar/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.event) {
        return data.event;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      return null;
    }
  }
}

export default new CalendarService();

