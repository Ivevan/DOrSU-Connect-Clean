/**
 * Calendar Service
 * Handles fetching calendar events from the backend
 */

import apiConfig from '../config/api.config';

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
}

class CalendarService {
  private baseUrl: string = apiConfig.baseUrl;

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
  }): Promise<CalendarEvent[]> {
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
        return data.events;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get calendar events:', error);
      return [];
    }
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
}

export default new CalendarService();

