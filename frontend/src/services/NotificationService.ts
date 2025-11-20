/**
 * Notification Service
 * Manages event notifications for today's events, upcoming events, and new events
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarEvent } from './CalendarService';
import { Post } from './AdminDataService';

export interface Notification {
  id: string;
  type: 'today' | 'upcoming' | 'new_event' | 'new_post';
  title: string;
  message: string;
  eventId?: string;
  postId?: string;
  timestamp: number;
  read: boolean;
  eventData?: CalendarEvent | any;
  postData?: Post | any;
}

const NOTIFICATIONS_STORAGE_KEY = '@dorsu_connect_notifications';
const LAST_CHECK_KEY = '@dorsu_connect_last_notification_check';
const PROCESSED_ITEMS_KEY = '@dorsu_connect_processed_items'; // Track items that have already been notified (session-based)
const SESSION_ID_KEY = '@dorsu_connect_notification_session'; // Track current session

class NotificationService {
  /**
   * Get all notifications
   */
  async getNotifications(): Promise<Notification[]> {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (!stored) return [];
      
      const notifications: Notification[] = JSON.parse(stored);
      // Sort by timestamp (newest first)
      return notifications.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const notifications = await this.getNotifications();
      return notifications.filter(n => !n.read).length;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Save notifications to storage
   */
  private async saveNotifications(notifications: Notification[]): Promise<void> {
    try {
      // Keep only last 100 notifications to prevent storage bloat
      const limited = notifications.slice(0, 100);
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(limited));
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
  }

  /**
   * Add a new notification
   */
  async addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      
      // Check if notification already exists (prevent duplicates)
      const exists = notifications.some(n => 
        n.eventId === notification.eventId && 
        n.type === notification.type &&
        n.postId === notification.postId &&
        (Date.now() - n.timestamp) < 60000 // Within last minute
      );

      if (exists) {
        return; // Don't add duplicate
      }

      const newNotification: Notification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false,
      };

      notifications.unshift(newNotification);
      await this.saveNotifications(notifications);
    } catch (error) {
      console.error('Failed to add notification:', error);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const index = notifications.findIndex(n => n.id === notificationId);
      
      if (index !== -1) {
        notifications[index].read = true;
        await this.saveNotifications(notifications);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      notifications.forEach(n => n.read = true);
      await this.saveNotifications(notifications);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const filtered = notifications.filter(n => n.id !== notificationId);
      await this.saveNotifications(filtered);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  /**
   * Get processed items (items that have already been notified)
   */
  private async getProcessedItems(): Promise<{ events: Set<string>; posts: Set<string> }> {
    try {
      const stored = await AsyncStorage.getItem(PROCESSED_ITEMS_KEY);
      if (!stored) return { events: new Set(), posts: new Set() };
      
      const data = JSON.parse(stored);
      return {
        events: new Set(data.events || []),
        posts: new Set(data.posts || []),
      };
    } catch (error) {
      console.error('Failed to get processed items:', error);
      return { events: new Set(), posts: new Set() };
    }
  }

  /**
   * Mark items as processed (already notified)
   */
  private async markItemsAsProcessed(eventIds: string[], postIds: string[]): Promise<void> {
    try {
      const processed = await this.getProcessedItems();
      
      // Add new event IDs
      eventIds.forEach(id => processed.events.add(id));
      
      // Add new post IDs
      postIds.forEach(id => processed.posts.add(id));
      
      // Save to storage
      await AsyncStorage.setItem(PROCESSED_ITEMS_KEY, JSON.stringify({
        events: Array.from(processed.events),
        posts: Array.from(processed.posts),
      }));
    } catch (error) {
      console.error('Failed to mark items as processed:', error);
    }
  }

  /**
   * Check if notification already exists for an item (to avoid duplicates)
   */
  private async hasNotificationForItem(eventId?: string, postId?: string): Promise<boolean> {
    try {
      const notifications = await this.getNotifications();
      if (eventId) {
        return notifications.some(n => n.eventId === eventId);
      }
      if (postId) {
        return notifications.some(n => n.postId === postId);
      }
      return false;
    } catch (error) {
      console.error('Failed to check existing notifications:', error);
      return false;
    }
  }

  /**
   * Check if an event has already been processed in current session
   */
  private async isEventProcessed(eventId: string): Promise<boolean> {
    // First check if notification already exists
    if (await this.hasNotificationForItem(eventId)) {
      return true;
    }
    const processed = await this.getProcessedItems();
    return processed.events.has(eventId);
  }

  /**
   * Check if a post has already been processed in current session
   */
  private async isPostProcessed(postId: string): Promise<boolean> {
    // First check if notification already exists
    if (await this.hasNotificationForItem(undefined, postId)) {
      return true;
    }
    const processed = await this.getProcessedItems();
    return processed.posts.has(postId);
  }

  /**
   * Get or create session ID
   */
  private async getSessionId(): Promise<string> {
    try {
      let sessionId = await AsyncStorage.getItem(SESSION_ID_KEY);
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem(SESSION_ID_KEY, sessionId);
      }
      return sessionId;
    } catch (error) {
      // Fallback to timestamp-based session
      return `session_${Date.now()}`;
    }
  }

  /**
   * Initialize new session (call on app startup or login)
   */
  async initializeNewSession(): Promise<void> {
    try {
      // Create new session ID
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(SESSION_ID_KEY, newSessionId);
      
      // Clear processed items for new session (but keep notifications)
      await AsyncStorage.removeItem(PROCESSED_ITEMS_KEY);
      
      console.log('✅ New notification session initialized');
    } catch (error) {
      console.error('Failed to initialize new session:', error);
    }
  }

  /**
   * Clear all notifications
   * Note: This does NOT clear processed items, so notifications won't be recreated
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  /**
   * Clear processed items (called on logout or app restart)
   * This allows notifications to be recreated for today's/upcoming events
   */
  async clearProcessedItems(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PROCESSED_ITEMS_KEY);
      // Also clear session to start fresh
      await AsyncStorage.removeItem(SESSION_ID_KEY);
      console.log('✅ Processed items cleared');
    } catch (error) {
      console.error('Failed to clear processed items:', error);
    }
  }

  /**
   * Clear processed items but keep notifications (called on logout)
   */
  async onLogout(): Promise<void> {
    try {
      // Clear processed items so notifications can be recreated on next login
      await this.clearProcessedItems();
      // Keep notifications for user to see when they log back in
      // Don't clear notifications on logout
      console.log('✅ Notification session reset for logout');
    } catch (error) {
      console.error('Failed to reset notification session on logout:', error);
    }
  }

  /**
   * Check for new events and create notifications
   * Only notifies for today's and upcoming events (not past events)
   * Only notifies if event hasn't been processed before
   * Called when events are fetched
   */
  async checkForNewEvents(events: CalendarEvent[], previousEventIds?: Set<string>): Promise<void> {
    try {
      const now = new Date();
      const todayKey = this.getPHDateKey(now);
      const processedEventIds: string[] = [];
      
      for (const event of events) {
        const eventId = event._id || `calendar-${event.isoDate}-${event.title}`;
        
        // Skip if event has already been processed
        if (await this.isEventProcessed(eventId)) {
          continue;
        }
        
        // Check if this is a new event (not in previous list)
        if (previousEventIds && !previousEventIds.has(eventId)) {
          // New event detected
          const eventDate = event.isoDate || event.date;
          if (eventDate) {
            const eventDateKey = this.getPHDateKey(new Date(eventDate));
            
            // Only notify for today's and upcoming events, skip past events
            if (eventDateKey === todayKey) {
              // Event is today
              await this.addNotification({
                type: 'today',
                title: 'Event Today',
                message: `${event.title} is happening today!`,
                eventId: eventId,
                eventData: event,
              });
              processedEventIds.push(eventId);
            } else if (eventDateKey > todayKey) {
              // Upcoming event (future)
              await this.addNotification({
                type: 'upcoming',
                title: 'New Upcoming Event',
                message: `${event.title} is scheduled for ${new Date(eventDate).toLocaleDateString()}`,
                eventId: eventId,
                eventData: event,
              });
              processedEventIds.push(eventId);
            }
            // Skip past events (eventDateKey < todayKey) - no notification
          }
        }
      }
      
      // Mark processed events
      if (processedEventIds.length > 0) {
        await this.markItemsAsProcessed(processedEventIds, []);
      }
    } catch (error) {
      console.error('Failed to check for new events:', error);
    }
  }

  /**
   * Check for today's events based on current day
   * Only checks for events happening today (not past or future events)
   * Only notifies if event hasn't been processed before
   */
  async checkForTodaysEvents(events: CalendarEvent[]): Promise<void> {
    try {
      const now = new Date();
      const todayKey = this.getPHDateKey(now);
      const processedEventIds: string[] = [];
      
      // Get existing notifications to avoid duplicates
      const existingNotifications = await this.getNotifications();
      const existingTodayEventIds = new Set(
        existingNotifications
          .filter(n => n.type === 'today' && n.eventId)
          .map(n => n.eventId!)
      );

      for (const event of events) {
        const eventId = event._id || `calendar-${event.isoDate}-${event.title}`;
        const eventDate = event.isoDate || event.date;
        
        // Skip if event has already been processed
        if (await this.isEventProcessed(eventId)) {
          continue;
        }
        
        if (eventDate && !existingTodayEventIds.has(eventId)) {
          const eventDateKey = this.getPHDateKey(new Date(eventDate));
          
          // Only notify if event is today (not past or future)
          if (eventDateKey === todayKey) {
            await this.addNotification({
              type: 'today',
              title: 'Event Today',
              message: `${event.title} is happening today!`,
              eventId: eventId,
              eventData: event,
            });
            processedEventIds.push(eventId);
          }
        }
      }
      
      // Mark processed events
      if (processedEventIds.length > 0) {
        await this.markItemsAsProcessed(processedEventIds, []);
      }
    } catch (error) {
      console.error('Failed to check for today\'s events:', error);
    }
  }

  /**
   * Check for today's posts/updates based on current day
   * Only checks for posts happening today (not past posts)
   * Only notifies if post hasn't been processed before
   */
  async checkForTodaysPosts(posts: (Post | { id: string; title: string; isoDate?: string; date?: string; category?: string; [key: string]: any })[]): Promise<void> {
    try {
      const now = new Date();
      const todayKey = this.getPHDateKey(now);
      const processedPostIds: string[] = [];
      
      // Get existing notifications to avoid duplicates
      const existingNotifications = await this.getNotifications();
      const existingTodayPostIds = new Set(
        existingNotifications
          .filter(n => n.type === 'today' && n.postId)
          .map(n => n.postId!)
      );

      for (const post of posts) {
        const postId = post.id;
        const postDate = post.isoDate || post.date;
        
        // Skip if post has already been processed
        if (await this.isPostProcessed(postId)) {
          continue;
        }
        
        if (postDate && !existingTodayPostIds.has(postId)) {
          const postDateKey = this.getPHDateKey(new Date(postDate));
          
          // Only notify if post is today (not past or future)
          if (postDateKey === todayKey) {
            await this.addNotification({
              type: 'today',
              title: 'Update Today',
              message: `${post.title} is happening today!`,
              postId: postId,
              postData: post,
            });
            processedPostIds.push(postId);
          }
        }
      }
      
      // Mark processed posts
      if (processedPostIds.length > 0) {
        await this.markItemsAsProcessed([], processedPostIds);
      }
    } catch (error) {
      console.error('Failed to check for today\'s posts:', error);
    }
  }

  /**
   * Check for new posts and create notifications
   * Only notifies for today's and upcoming posts (not past posts)
   * Only notifies if post hasn't been processed before
   */
  async checkForNewPosts(posts: (Post | { id: string; title: string; isoDate?: string; date?: string; category?: string; [key: string]: any })[], previousPostIds?: Set<string>): Promise<void> {
    try {
      const now = new Date();
      const todayKey = this.getPHDateKey(now);
      const processedPostIds: string[] = [];
      
      for (const post of posts) {
        const postId = post.id;
        
        // Skip if post has already been processed
        if (await this.isPostProcessed(postId)) {
          continue;
        }
        
        // Check if this is a new post (not in previous list)
        if (previousPostIds && !previousPostIds.has(postId)) {
          // New post detected
          const postDate = post.isoDate || post.date;
          if (postDate) {
            const postDateKey = this.getPHDateKey(new Date(postDate));
            
            // Only notify for today's and upcoming posts, skip past posts
            if (postDateKey === todayKey) {
              // Post is today
              await this.addNotification({
                type: 'today',
                title: 'Update Today',
                message: `${post.title} is happening today!`,
                postId: postId,
                postData: post,
              });
              processedPostIds.push(postId);
            } else if (postDateKey > todayKey) {
              // Upcoming post (future)
              await this.addNotification({
                type: 'upcoming',
                title: 'New Upcoming Update',
                message: `${post.title} is scheduled for ${new Date(postDate).toLocaleDateString()}`,
                postId: postId,
                postData: post,
              });
              processedPostIds.push(postId);
            }
            // Skip past posts (postDateKey < todayKey) - no notification
          }
        }
      }
      
      // Mark processed posts
      if (processedPostIds.length > 0) {
        await this.markItemsAsProcessed([], processedPostIds);
      }
    } catch (error) {
      console.error('Failed to check for new posts:', error);
    }
  }

  /**
   * Check for today's items (both events and posts) based on current day
   * Only checks for items happening today (not past or future items)
   * This method should be called when screen comes into focus or periodically
   */
  async checkForTodaysItems(events: CalendarEvent[], posts: (Post | { id: string; title: string; isoDate?: string; date?: string; category?: string; [key: string]: any })[]): Promise<void> {
    try {
      const now = new Date();
      const todayKey = this.getPHDateKey(now);
      
      // Filter events to only include today's events
      const todaysEvents = events.filter(event => {
        const eventDate = event.isoDate || event.date;
        if (!eventDate) return false;
        const eventDateKey = this.getPHDateKey(new Date(eventDate));
        return eventDateKey === todayKey;
      });
      
      // Check for today's calendar events
      await this.checkForTodaysEvents(todaysEvents);
      
      // Filter posts to only include today's posts
      const todaysPosts = posts.filter(post => {
        const postDate = post.isoDate || post.date;
        if (!postDate) return false;
        const postDateKey = this.getPHDateKey(new Date(postDate));
        return postDateKey === todayKey;
      });
      
      // Check for today's posts
      await this.checkForTodaysPosts(todaysPosts);
    } catch (error) {
      console.error('Failed to check for today\'s items:', error);
    }
  }

  /**
   * Get Philippines timezone date key
   */
  private getPHDateKey(date: Date | string): number {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      const dtf = new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
      const parts = dtf.formatToParts(d);
      const y = Number(parts.find(p => p.type === 'year')?.value);
      const m = Number(parts.find(p => p.type === 'month')?.value) - 1;
      const day = Number(parts.find(p => p.type === 'day')?.value);
      return Date.UTC(y, m, day);
    } catch {
      const d = typeof date === 'string' ? new Date(date) : date;
      return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }

  /**
   * Get last check timestamp
   */
  async getLastCheckTimestamp(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem(LAST_CHECK_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Update last check timestamp
   */
  async updateLastCheckTimestamp(): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
    } catch (error) {
      console.error('Failed to update last check timestamp:', error);
    }
  }

  /**
   * Create a test notification (development only)
   */
  async createTestNotification(type: 'today' | 'upcoming' | 'new_event' | 'new_post' = 'today'): Promise<void> {
    if (!__DEV__) {
      console.warn('createTestNotification is only available in development mode');
      return;
    }

    const testMessages = {
      today: {
        title: 'Test Event Today',
        message: 'This is a test notification for an event happening today!',
      },
      upcoming: {
        title: 'Test Upcoming Event',
        message: 'This is a test notification for an upcoming event on ' + new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      },
      new_event: {
        title: 'Test New Event',
        message: 'This is a test notification for a new event that was added.',
      },
      new_post: {
        title: 'Test New Update',
        message: 'This is a test notification for a new update that was added.',
      },
    };

    const testMessage = testMessages[type];
    
    await this.addNotification({
      type: type,
      title: testMessage.title,
      message: testMessage.message,
      eventId: `test-event-${Date.now()}`,
      postId: type === 'new_post' ? `test-post-${Date.now()}` : undefined,
    });

    console.log('✅ Test notification created:', type);
  }
}

export default new NotificationService();

