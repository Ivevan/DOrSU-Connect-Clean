/**
 * Notification Service
 * Handles local notifications for:
 * - New Added Posts
 * - Today's Events
 * - Upcoming Events
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdminDataService, { Post } from './AdminDataService';
import CalendarService, { CalendarEvent } from './CalendarService';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Storage keys
const STORAGE_KEYS = {
  LAST_POST_CHECK: 'notification_last_post_check',
  LAST_TODAY_EVENT_CHECK: 'notification_last_today_event_check',
  LAST_UPCOMING_EVENT_CHECK: 'notification_last_upcoming_event_check',
  NOTIFICATIONS_ENABLED: 'notifications_enabled',
};

// Helper function to get Philippines timezone date key
const getPHDateKey = (d: Date | string) => {
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    const dtf = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = dtf.formatToParts(date);
    const y = Number(parts.find(p => p.type === 'year')?.value);
    const m = Number(parts.find(p => p.type === 'month')?.value) - 1;
    const day = Number(parts.find(p => p.type === 'day')?.value);
    return Date.UTC(y, m, day);
  } catch {
    const date = typeof d === 'string' ? new Date(d) : d;
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }
};

class NotificationService {
  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Notification permissions not granted');
        return false;
      }

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF9500',
        });
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
      return enabled !== 'false'; // Default to true
    } catch {
      return true;
    }
  }

  /**
   * Set notifications enabled/disabled
   */
  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, String(enabled));
    } catch (error) {
      console.error('Error setting notifications enabled:', error);
    }
  }

  /**
   * Get last check timestamp
   */
  private async getLastCheck(key: string): Promise<number> {
    try {
      const lastCheck = await AsyncStorage.getItem(key);
      return lastCheck ? parseInt(lastCheck, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Set last check timestamp
   */
  private async setLastCheck(key: string, timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(key, String(timestamp));
    } catch (error) {
      console.error('Error setting last check:', error);
    }
  }

  /**
   * Schedule a notification
   */
  private async scheduleNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<string | null> {
    try {
      const enabled = await this.areNotificationsEnabled();
      if (!enabled) {
        return null;
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Check for new posts and send notifications
   */
  async checkNewPosts(): Promise<void> {
    try {
      const enabled = await this.areNotificationsEnabled();
      if (!enabled) {
        return;
      }

      const lastCheck = await this.getLastCheck(STORAGE_KEYS.LAST_POST_CHECK);
      const now = Date.now();

      // Fetch posts
      const posts = await AdminDataService.getPosts();
      
      // Filter for new posts (created after last check)
      const newPosts = posts.filter((post: Post) => {
        if (!post.date) return false;
        const postDate = new Date(post.date).getTime();
        return postDate > lastCheck;
      });

      // Send notifications for new posts
      for (const post of newPosts) {
        await this.scheduleNotification(
          '📢 New Post Added',
          post.title || 'A new post has been added',
          {
            type: 'new_post',
            postId: post.id,
            category: post.category,
          }
        );
      }

      // Update last check time
      if (newPosts.length > 0) {
        await this.setLastCheck(STORAGE_KEYS.LAST_POST_CHECK, now);
      }
    } catch (error) {
      console.error('Error checking new posts:', error);
    }
  }

  /**
   * Check for today's events and send notifications
   */
  async checkTodaysEvents(): Promise<void> {
    try {
      const enabled = await this.areNotificationsEnabled();
      if (!enabled) {
        return;
      }

      const lastCheck = await this.getLastCheck(STORAGE_KEYS.LAST_TODAY_EVENT_CHECK);
      const todayKey = getPHDateKey(new Date());
      const now = Date.now();

      // Only check once per day (after midnight)
      const lastCheckDate = new Date(lastCheck);
      const today = new Date();
      if (
        lastCheckDate.getDate() === today.getDate() &&
        lastCheckDate.getMonth() === today.getMonth() &&
        lastCheckDate.getFullYear() === today.getFullYear()
      ) {
        return; // Already checked today
      }

      // Fetch events for today
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const events = await CalendarService.getEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100,
      });

      // Filter for today's events
      const todaysEvents = events.filter((event: CalendarEvent) => {
        if (!event.isoDate && !event.date) return false;
        const eventKey = getPHDateKey(event.isoDate || event.date);
        return eventKey === todayKey;
      });

      // Send notification for today's events
      if (todaysEvents.length > 0) {
        const eventCount = todaysEvents.length;
        const eventText = eventCount === 1 
          ? `"${todaysEvents[0].title}"` 
          : `${eventCount} events`;

        await this.scheduleNotification(
          '📅 Today\'s Events',
          `You have ${eventText} scheduled for today`,
          {
            type: 'todays_events',
            eventCount,
            events: todaysEvents.map(e => ({ id: e._id, title: e.title })),
          }
        );
      }

      // Update last check time
      await this.setLastCheck(STORAGE_KEYS.LAST_TODAY_EVENT_CHECK, now);
    } catch (error) {
      console.error('Error checking today\'s events:', error);
    }
  }

  /**
   * Check for upcoming events and send notifications
   */
  async checkUpcomingEvents(): Promise<void> {
    try {
      const enabled = await this.areNotificationsEnabled();
      if (!enabled) {
        return;
      }

      const lastCheck = await this.getLastCheck(STORAGE_KEYS.LAST_UPCOMING_EVENT_CHECK);
      const now = Date.now();
      const todayKey = getPHDateKey(new Date());

      // Check for upcoming events (next 7 days, starting from tomorrow)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1); // Tomorrow
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // 7 days from now
      endDate.setHours(23, 59, 59, 999);

      const events = await CalendarService.getEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100,
      });

      // Filter for upcoming events (future events only, not today, not past)
      const upcomingEvents = events.filter((event: CalendarEvent) => {
        if (!event.isoDate && !event.date) return false;
        const eventKey = getPHDateKey(event.isoDate || event.date);
        const eventDate = new Date(event.isoDate || event.date).getTime();
        // Only include events that are in the future (not today, not past)
        return eventKey > todayKey && eventDate > now;
      });

      // Only notify if there are new upcoming events since last check
      const newUpcomingEvents = upcomingEvents.filter((event: CalendarEvent) => {
        if (!event.date) return false;
        const eventDate = new Date(event.date).getTime();
        return eventDate > lastCheck;
      });

      // Send notification for upcoming events
      if (newUpcomingEvents.length > 0) {
        const eventCount = newUpcomingEvents.length;
        const eventText = eventCount === 1 
          ? `"${newUpcomingEvents[0].title}"` 
          : `${eventCount} upcoming events`;

        await this.scheduleNotification(
          '🔔 Upcoming Events',
          `You have ${eventText} coming up soon`,
          {
            type: 'upcoming_events',
            eventCount,
            events: newUpcomingEvents.map(e => ({ 
              id: e._id, 
              title: e.title,
              date: e.isoDate || e.date 
            })),
          }
        );
      }

      // Update last check time
      if (newUpcomingEvents.length > 0) {
        await this.setLastCheck(STORAGE_KEYS.LAST_UPCOMING_EVENT_CHECK, now);
      }
    } catch (error) {
      console.error('Error checking upcoming events:', error);
    }
  }

  /**
   * Check all notifications (new posts, today's events, upcoming events)
   */
  async checkAllNotifications(): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return;
      }

      // Run all checks in parallel
      await Promise.all([
        this.checkNewPosts(),
        this.checkTodaysEvents(),
        this.checkUpcomingEvents(),
      ]);
    } catch (error) {
      console.error('Error checking all notifications:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling notifications:', error);
    }
  }

  /**
   * Get notification count (for badge)
   */
  async getNotificationCount(): Promise<number> {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      return notifications.length;
    } catch {
      return 0;
    }
  }
}

export default new NotificationService();

