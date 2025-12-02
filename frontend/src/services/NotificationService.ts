/**
 * Notification Service
 * Handles local notifications for:
 * - New Added Posts
 * - Today's Events
 * - Upcoming Events
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import AdminDataService, { Post } from './AdminDataService';
import CalendarService, { CalendarEvent } from './CalendarService';

// Lazy getter for expo-notifications (not available on web)
// This prevents Metro from trying to resolve the module at bundle time on web
let _notificationsModule: any = null;
let _notificationsInitialized = false;

function getNotifications(): any {
  // Return null on web immediately
  if (Platform.OS === 'web') {
    return null;
  }

  // Lazy load the module only when needed
  if (!_notificationsInitialized) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _notificationsModule = require('expo-notifications');
      
      // Configure notification handler (only on native platforms)
      if (_notificationsModule && _notificationsModule.setNotificationHandler) {
        _notificationsModule.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
      }
    } catch (error) {
      console.warn('expo-notifications not available:', error);
      _notificationsModule = null;
    } finally {
      _notificationsInitialized = true;
    }
  }

  return _notificationsModule;
}

// Storage keys
const STORAGE_KEYS = {
  LAST_POST_CHECK: 'notification_last_post_check',
  LAST_TODAY_EVENT_CHECK: 'notification_last_today_event_check',
  LAST_UPCOMING_EVENT_CHECK: 'notification_last_upcoming_event_check',
  NOTIFICATIONS_ENABLED: 'notifications_enabled',
  NOTIFIED_POST_IDS: 'notification_notified_post_ids',
  NOTIFIED_EVENT_IDS: 'notification_notified_event_ids',
  NOTIFIED_TODAY_EVENTS_DATE: 'notification_notified_today_events_date',
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
    const Notifications = getNotifications();
    
    // Notifications not available on web
    if (!Notifications) {
      console.log('Notifications not available on web platform');
      return false;
    }

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
   * Get notified post IDs
   */
  private async getNotifiedPostIds(): Promise<Set<string>> {
    try {
      const idsJson = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFIED_POST_IDS);
      if (idsJson) {
        const ids = JSON.parse(idsJson);
        return new Set(ids);
      }
      return new Set<string>();
    } catch {
      return new Set<string>();
    }
  }

  /**
   * Add post ID to notified list
   */
  private async addNotifiedPostId(postId: string): Promise<void> {
    try {
      const ids = await this.getNotifiedPostIds();
      ids.add(postId);
      // Keep only last 1000 notified posts to avoid storage bloat
      const idsArray = Array.from(ids);
      if (idsArray.length > 1000) {
        idsArray.splice(0, idsArray.length - 1000);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFIED_POST_IDS, JSON.stringify(idsArray));
    } catch (error) {
      console.error('Error adding notified post ID:', error);
    }
  }

  /**
   * Get notified event IDs
   */
  private async getNotifiedEventIds(): Promise<Set<string>> {
    try {
      const idsJson = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFIED_EVENT_IDS);
      if (idsJson) {
        const ids = JSON.parse(idsJson);
        return new Set(ids);
      }
      return new Set<string>();
    } catch {
      return new Set<string>();
    }
  }

  /**
   * Add event ID to notified list
   */
  private async addNotifiedEventId(eventId: string): Promise<void> {
    try {
      const ids = await this.getNotifiedEventIds();
      ids.add(eventId);
      // Keep only last 1000 notified events to avoid storage bloat
      const idsArray = Array.from(ids);
      if (idsArray.length > 1000) {
        idsArray.splice(0, idsArray.length - 1000);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFIED_EVENT_IDS, JSON.stringify(idsArray));
    } catch (error) {
      console.error('Error adding notified event ID:', error);
    }
  }

  /**
   * Get last notified today events date
   */
  private async getNotifiedTodayEventsDate(): Promise<number | null> {
    try {
      const dateStr = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFIED_TODAY_EVENTS_DATE);
      return dateStr ? parseInt(dateStr, 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Set last notified today events date
   */
  private async setNotifiedTodayEventsDate(dateKey: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFIED_TODAY_EVENTS_DATE, String(dateKey));
    } catch (error) {
      console.error('Error setting notified today events date:', error);
    }
  }

  /**
   * Schedule a notification (for immediate display, use presentNotificationAsync)
   */
  private async scheduleNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<string | null> {
    const Notifications = getNotifications();
    
    // Notifications not available on web
    if (!Notifications) {
      console.log('Notifications not available on web platform');
      return null;
    }

    try {
      const enabled = await this.areNotificationsEnabled();
      if (!enabled) {
        console.log('Notifications are disabled');
        return null;
      }

      // Check permissions first
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permissions not granted');
        return null;
      }

      // Use presentNotificationAsync for immediate notifications
      const notificationContent: any = {
        title,
        body,
        data: data || {},
        sound: true,
      };

      // Add Android-specific priority
      if (Platform.OS === 'android') {
        notificationContent.priority = Notifications.AndroidNotificationPriority.HIGH;
      }

      const identifier = await Notifications.presentNotificationAsync(notificationContent);

      console.log('Notification sent:', { title, body, identifier });
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
        console.log('Notifications are disabled, skipping new posts check');
        return;
      }

      const lastCheck = await this.getLastCheck(STORAGE_KEYS.LAST_POST_CHECK);
      const now = Date.now();
      const notifiedPostIds = await this.getNotifiedPostIds();

      console.log('Checking for new posts...', { lastCheck, now, notifiedCount: notifiedPostIds.size });

      // Fetch posts
      const posts = await AdminDataService.getPosts();
      console.log(`Fetched ${posts.length} posts`);
      
      // Filter for new posts that haven't been notified yet
      const newPosts = posts.filter((post: Post) => {
        if (!post.date || !post.id) return false;
        const postDate = new Date(post.date).getTime();
        // Only notify if:
        // 1. Post is created after last check AND
        // 2. Post ID hasn't been notified before
        const isNew = postDate > lastCheck && !notifiedPostIds.has(post.id);
        return isNew;
      });

      console.log(`Found ${newPosts.length} new posts to notify`);

      // Send notifications for new posts
      for (const post of newPosts) {
        if (!post.id) continue;
        
        const notificationId = await this.scheduleNotification(
          '📢 New Post Added',
          post.title || 'A new post has been added',
          {
            type: 'new_post',
            postId: post.id,
            category: post.category,
          }
        );
        
        if (notificationId) {
          console.log('Notification sent for post:', post.id, post.title);
        } else {
          console.warn('Failed to send notification for post:', post.id);
        }
        
        // Mark this post as notified
        await this.addNotifiedPostId(post.id);
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
        console.log('Notifications are disabled, skipping today\'s events check');
        return;
      }

      const todayKey = getPHDateKey(new Date());
      const now = Date.now();
      const notifiedTodayDate = await this.getNotifiedTodayEventsDate();

      console.log('Checking for today\'s events...', { todayKey, notifiedTodayDate });

      // Only notify once per day (if already notified for today's date, skip)
      if (notifiedTodayDate === todayKey) {
        console.log('Already notified for today, skipping');
        return; // Already notified for today
      }

      // Fetch events for today
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      let events: CalendarEvent[] = [];
      try {
        events = await CalendarService.getEvents({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 100,
        });
        console.log(`📅 checkTodaysEvents: Fetched ${events.length} events from API`);
      } catch (error: any) {
        console.error('❌ checkTodaysEvents: Failed to fetch events:', error.message);
        // Don't throw - just log and continue with empty array
        events = [];
      }

      // Filter for today's events
      const todaysEvents = events.filter((event: CalendarEvent) => {
        if (!event.isoDate && !event.date) return false;
        const eventKey = getPHDateKey(event.isoDate || event.date);
        return eventKey === todayKey;
      });

      // Send notification for today's events (only if there are events and we haven't notified today)
      if (todaysEvents.length > 0) {
        const eventCount = todaysEvents.length;
        const eventText = eventCount === 1 
          ? `"${todaysEvents[0].title}"` 
          : `${eventCount} events`;

        console.log(`Found ${eventCount} event(s) for today, sending notification...`);
        const notificationId = await this.scheduleNotification(
          '📅 Today\'s Events',
          `You have ${eventText} scheduled for today`,
          {
            type: 'todays_events',
            eventCount,
            events: todaysEvents.map(e => ({ id: e._id, title: e.title })),
          }
        );
        
        if (notificationId) {
          console.log('Notification sent for today\'s events');
        } else {
          console.warn('Failed to send notification for today\'s events');
        }
        
        // Mark today's date as notified
        await this.setNotifiedTodayEventsDate(todayKey);
      } else {
        console.log('No events found for today');
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
      const notifiedEventIds = await this.getNotifiedEventIds();

      // Check for upcoming events (next 7 days, starting from tomorrow)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1); // Tomorrow
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // 7 days from now
      endDate.setHours(23, 59, 59, 999);

      let events: CalendarEvent[] = [];
      try {
        events = await CalendarService.getEvents({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 100,
        });
        console.log(`📅 checkUpcomingEvents: Fetched ${events.length} events from API`);
      } catch (error: any) {
        console.error('❌ checkUpcomingEvents: Failed to fetch events:', error.message);
        // Don't throw - just log and continue with empty array
        // This prevents the notification check from crashing
        events = [];
      }

      // Filter for upcoming events (future events only, not today, not past)
      const upcomingEvents = events.filter((event: CalendarEvent) => {
        if (!event.isoDate && !event.date) return false;
        const eventKey = getPHDateKey(event.isoDate || event.date);
        const eventDate = new Date(event.isoDate || event.date).getTime();
        // Only include events that are in the future (not today, not past)
        return eventKey > todayKey && eventDate > now;
      });

      // Filter for new upcoming events that haven't been notified yet
      const newUpcomingEvents = upcomingEvents.filter((event: CalendarEvent) => {
        if (!event.date || !event._id) return false;
        const eventDate = new Date(event.date).getTime();
        const eventId = event._id.toString();
        // Only notify if:
        // 1. Event is created/updated after last check AND
        // 2. Event ID hasn't been notified before
        return eventDate > lastCheck && !notifiedEventIds.has(eventId);
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
        
        // Mark these events as notified
        for (const event of newUpcomingEvents) {
          if (event._id) {
            await this.addNotifiedEventId(event._id.toString());
          }
        }
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
      console.log('Starting notification check...');
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions not granted, skipping checks');
        return;
      }

      console.log('Notification permissions granted, running checks...');
      
      // Run all checks in parallel
      await Promise.all([
        this.checkNewPosts().catch(err => console.error('Error in checkNewPosts:', err)),
        this.checkTodaysEvents().catch(err => console.error('Error in checkTodaysEvents:', err)),
        this.checkUpcomingEvents().catch(err => console.error('Error in checkUpcomingEvents:', err)),
      ]);
      
      console.log('Notification checks completed');
    } catch (error) {
      console.error('Error checking all notifications:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    const Notifications = getNotifications();
    
    if (!Notifications) {
      return;
    }

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
    const Notifications = getNotifications();
    
    if (!Notifications) {
      return 0;
    }

    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      return notifications.length;
    } catch {
      return 0;
    }
  }
}

export default new NotificationService();

