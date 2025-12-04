/**
 * Notification Modal
 * Displays notification center with:
 * - New Posts notifications
 * - Today's Events notifications
 * - Upcoming Events notifications
 * - Notification settings
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, RefreshControl, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

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
    } catch (error) {
      console.warn('expo-notifications not available:', error);
      _notificationsModule = null;
    } finally {
      _notificationsInitialized = true;
    }
  }

  return _notificationsModule;
}
import BottomSheet from '../components/common/BottomSheet';
import { useThemeValues } from '../contexts/ThemeContext';
import { useUpdates } from '../contexts/UpdatesContext';
import NotificationService from '../services/NotificationService';
import AdminDataService, { Post } from '../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../services/CalendarService';
import { formatDate } from '../utils/dateUtils';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

interface NotificationItem {
  id: string;
  type: 'new_post' | 'todays_event' | 'upcoming_event';
  title: string;
  message: string;
  timestamp: number;
  data?: any;
  read?: boolean;
}

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

const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useThemeValues();
  const { posts, setPosts, calendarEvents, setCalendarEvents } = useUpdates();
  const sheetY = useRef(new Animated.Value(600)).current;

  // Helper function to convert hex to rgba
  const hexToRgba = (hex: string | undefined, alpha: number) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
      // Fallback to a default color if hex is invalid
      return `rgba(37, 99, 235, ${alpha})`; // Default blue
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'new_post' | 'upcoming_event'>('all');

  // Load read notification IDs from AsyncStorage
  const loadReadNotifications = useCallback(async () => {
    try {
      const readIdsJson = await AsyncStorage.getItem('readNotificationIds');
      if (readIdsJson) {
        const readIds = JSON.parse(readIdsJson);
        setReadNotificationIds(new Set(readIds));
        return new Set(readIds);
      }
      return new Set<string>();
    } catch (error) {
      console.error('Error loading read notifications:', error);
      return new Set<string>();
    }
  }, []);

  // Save read notification IDs to AsyncStorage
  const saveReadNotifications = useCallback(async (readIds: Set<string>) => {
    try {
      const readIdsArray = Array.from(readIds);
      await AsyncStorage.setItem('readNotificationIds', JSON.stringify(readIdsArray));
      setReadNotificationIds(readIds);
    } catch (error) {
      console.error('Error saving read notifications:', error);
    }
  }, []);

  // Mark a notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    setReadNotificationIds(prev => {
      const newReadIds = new Set(prev);
      newReadIds.add(notificationId);
      // Save to AsyncStorage
      const readIdsArray = Array.from(newReadIds);
      AsyncStorage.setItem('readNotificationIds', JSON.stringify(readIdsArray)).catch(console.error);
      return newReadIds;
    });
    
    // Update the notification item's read status
    setNotificationItems(prev => 
      prev.map(item => 
        item.id === notificationId ? { ...item, read: true } : item
      )
    );
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    const allIds = new Set(notificationItems.map(item => item.id));
    await saveReadNotifications(allIds);
    
    // Update all notification items' read status
    setNotificationItems(prev => 
      prev.map(item => ({ ...item, read: true }))
    );
  }, [notificationItems, saveReadNotifications]);

  // Process notifications from existing context data (no fetch)
  const processNotifications = useCallback(async (postsData: any[], eventsData: CalendarEvent[], currentReadIds: Set<string>) => {
    console.log('📬 NotificationModal: Processing notifications from context data...');
    
    // Use provided data (from context or fetched)
    const postsToProcess = postsData || [];
    const eventsToProcess = eventsData || [];
    
    console.log(`📊 NotificationModal: Processing ${postsToProcess.length} posts, ${eventsToProcess.length} events from context`);

    const items: NotificationItem[] = [];
    const now = new Date();
    const todayKey = getPHDateKey(now);
    const nowTime = Date.now();
    
    // Mirror AdminDashboard/SchoolUpdates approach:
    // 1. Convert all posts to notification items (for "All Updates" and "Added Post")
    // 2. Convert all calendar events to notification items (for "All Updates" and "Upcoming Updates")
    // 3. Use same date filtering logic as displayedUpdates
    
    // Process posts - include ALL posts for "All Updates", categorize for filters
    // Mirror AdminDashboard: ALL posts are shown, categorized by date
    let newPostCount = 0;
    let upcomingPostCount = 0;
    
    postsToProcess.forEach((post: any, index: number) => {
        if (!post.id) {
          console.warn(`⚠️ NotificationModal: Post missing ID at index ${index}`);
          return;
        }
        
        const postDateStr = post.isoDate || post.date;
        if (!postDateStr) {
          // Posts without dates - include as "new_post" for "All Updates" and "Added Post"
          items.push({
            id: `new_post_${post.id}`,
            type: 'new_post',
            title: '📢 New Post',
            message: post.title || 'A new post has been added',
            timestamp: nowTime, // Use current time if no date
            data: { postId: post.id, post },
          });
          newPostCount++;
          return;
        }
        
        const postDate = new Date(postDateStr).getTime();
        if (isNaN(postDate)) {
          console.warn(`⚠️ NotificationModal: Invalid timestamp for post ${post.id}, date: ${postDateStr}`);
          // Still include it as "new_post"
          items.push({
            id: `new_post_${post.id}`,
            type: 'new_post',
            title: '📢 New Post',
            message: post.title || 'A new post has been added',
            timestamp: nowTime,
            data: { postId: post.id, post },
          });
          newPostCount++;
          return;
        }
        
        // ALL posts should be categorized as 'new_post' for "Added Post" filter
        // This ensures ALL posts appear in "Added Post" regardless of their date
        // Future posts will also be duplicated as 'upcoming_event' for "Upcoming Updates" filter
        const postKey = getPHDateKey(postDateStr);
        const isFuture = postDate > nowTime;
        const isToday = postKey === todayKey;
        
        // Always add as 'new_post' first (for "Added Post" and "All Updates")
        items.push({
          id: `new_post_${post.id}`,
          type: 'new_post',
          title: '📢 New Post',
          message: post.title || 'A new post has been added',
          timestamp: postDate,
          data: { postId: post.id, post },
        });
        newPostCount++;
        
        // If it's a future post (not today), also add as 'upcoming_event' (for "Upcoming Updates")
        if (isFuture && !isToday) {
          items.push({
            id: `upcoming_post_${post.id}`,
            type: 'upcoming_event', // Use same type as upcoming events
            title: '🔔 Upcoming',
            message: post.title || 'An upcoming post',
            timestamp: postDate,
            data: { postId: post.id, post },
          });
          upcomingPostCount++;
        }
      });
      
    console.log(`📬 NotificationModal: Processed ${postsToProcess.length} posts - ${newPostCount} new_post items, ${upcomingPostCount} upcoming_post items`);
    if (postsToProcess.length > 0) {
      console.log(`📬 Sample posts:`, postsToProcess.slice(0, 3).map(p => ({
        id: p.id,
        title: p.title,
        date: p.date,
        isoDate: p.isoDate,
        hasDate: !!p.date,
        hasIsoDate: !!p.isoDate,
      })));
    }

    // Process calendar events - include ALL events for "All Updates", categorize for filters
    // Mirror AdminDashboard: ALL calendar events are shown, categorized by date
    let todaysEventCount = 0;
    let upcomingEventCount = 0;
    
    eventsToProcess.forEach((event: CalendarEvent, index: number) => {
        // Skip events without any identifier or date
        if (!event._id && !event.isoDate && !event.date) {
          console.warn(`⚠️ NotificationModal: Event missing ID and date at index ${index}`);
          return;
        }
        
        const eventDateStr = event.isoDate || event.date;
        if (!eventDateStr) {
          // Events without dates - include as "upcoming_event" for "All Updates" and "Upcoming Updates"
          items.push({
            id: `upcoming_event_${event._id || `event_${index}`}`,
            type: 'upcoming_event',
            title: '🔔 Upcoming',
            message: event.title || 'An upcoming event',
            timestamp: nowTime,
            data: { eventId: event._id, event },
          });
          upcomingEventCount++;
          return;
        }
        
        const eventDate = new Date(eventDateStr).getTime();
        if (isNaN(eventDate)) {
          console.warn(`⚠️ NotificationModal: Invalid timestamp for event ${event._id}, date: ${eventDateStr}`);
          // Still include it
          items.push({
            id: `upcoming_event_${event._id || `event_${index}`}`,
            type: 'upcoming_event',
            title: '🔔 Upcoming',
            message: event.title || 'An upcoming event',
            timestamp: nowTime,
            data: { eventId: event._id, event },
          });
          upcomingEventCount++;
          return;
        }
        
        const eventKey = getPHDateKey(eventDateStr);
        const isToday = eventKey === todayKey;
        const isFuture = eventDate > nowTime;
        const isPast = eventDate <= nowTime && !isToday;
        
        if (isToday) {
          // Today's event - shows in "All Updates" and "Upcoming Updates"
          items.push({
            id: `todays_event_${event._id || `event_${index}`}`,
            type: 'todays_event',
            title: '📅 Today',
            message: event.title || 'An event is scheduled for today',
            timestamp: eventDate,
            data: { eventId: event._id, event },
          });
          todaysEventCount++;
        } else if (isFuture) {
          // Upcoming event (future date, not today) - shows in "Upcoming Updates" and "All Updates"
          items.push({
            id: `upcoming_event_${event._id || `event_${index}`}`,
            type: 'upcoming_event',
            title: '🔔 Upcoming',
            message: event.title || 'An upcoming event',
            timestamp: eventDate,
            data: { eventId: event._id, event },
          });
          upcomingEventCount++;
        } else if (isPast) {
          // Past event - still include in "All Updates" as "upcoming_event" for visibility
          items.push({
            id: `upcoming_event_${event._id || `event_${index}`}`,
            type: 'upcoming_event',
            title: '📅 Past Event',
            message: event.title || 'A past event',
            timestamp: eventDate,
            data: { eventId: event._id, event },
          });
          upcomingEventCount++;
        }
      });
      
    console.log(`📬 NotificationModal: Processed ${eventsToProcess.length} events - ${todaysEventCount} today's, ${upcomingEventCount} upcoming`);

    // Mark items as read based on stored read IDs
    const itemsWithReadStatus = items.map(item => ({
      ...item,
      read: currentReadIds.has(item.id),
    }));

    // Sort by timestamp in DESCENDING order (latest created/uploaded first)
    itemsWithReadStatus.sort((a, b) => {
      // Primary sort: DESCENDING by timestamp (latest/newest first)
      // b.timestamp - a.timestamp = descending (newest to oldest)
      const timeDiff = b.timestamp - a.timestamp;
      if (timeDiff !== 0) return timeDiff;
      
      // Secondary sort: by type (new_post first, then todays_event, then upcoming_event)
      const typeOrder = { 'new_post': 0, 'todays_event': 1, 'upcoming_event': 2 };
      return (typeOrder[a.type] || 3) - (typeOrder[b.type] || 3);
    });

    // Log summary of what was loaded
    const summary = {
      newPosts: itemsWithReadStatus.filter(i => i.type === 'new_post').length,
      todaysEvents: itemsWithReadStatus.filter(i => i.type === 'todays_event').length,
      upcomingPosts: itemsWithReadStatus.filter(i => i.type === 'upcoming_event' && (i.data?.postId || i.data?.post)).length,
      upcomingEvents: itemsWithReadStatus.filter(i => i.type === 'upcoming_event' && (i.data?.eventId || i.data?.event)).length,
      total: itemsWithReadStatus.length,
      sampleNewPosts: itemsWithReadStatus.filter(i => i.type === 'new_post').slice(0, 3).map(i => ({ id: i.id, title: i.message })),
      sampleUpcomingPosts: itemsWithReadStatus.filter(i => i.type === 'upcoming_event' && (i.data?.postId || i.data?.post)).slice(0, 3).map(i => ({ id: i.id, title: i.message })),
      sampleUpcomingEvents: itemsWithReadStatus.filter(i => i.type === 'upcoming_event' && (i.data?.eventId || i.data?.event)).slice(0, 3).map(i => ({ id: i.id, title: i.message })),
    };
    console.log(`✅ NotificationModal: Processed ${itemsWithReadStatus.length} notification items:`, JSON.stringify(summary, null, 2));
    
    setNotificationItems(itemsWithReadStatus);
  }, []);

  // Load notifications from context data (no fetch)
  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('📬 NotificationModal: Loading notifications from context data...');
      
      // Load read status asynchronously
      let currentReadIds: Set<string>;
      try {
        const readIdsJson = await AsyncStorage.getItem('readNotificationIds');
        if (readIdsJson) {
          const readIds = JSON.parse(readIdsJson);
          currentReadIds = new Set(readIds);
          setReadNotificationIds(currentReadIds);
        } else {
          currentReadIds = new Set<string>();
        }
      } catch (error) {
        console.error('Error loading read notifications:', error);
        currentReadIds = new Set<string>();
      }
      
      // Use data from context (already loaded by AdminDashboard/SchoolUpdates)
      await processNotifications(posts, calendarEvents, currentReadIds);
    } catch (error) {
      console.error('❌ NotificationModal: Error loading notifications:', error);
      setNotificationItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [posts, calendarEvents, processNotifications]);

  // Fetch fresh data and update context (only when explicitly requested)
  const refreshNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('📬 NotificationModal: Refreshing notifications from server...');
      
      // Load read status first
      let currentReadIds: Set<string>;
      try {
        const readIdsJson = await AsyncStorage.getItem('readNotificationIds');
        if (readIdsJson) {
          const readIds = JSON.parse(readIdsJson);
          currentReadIds = new Set(readIds);
          setReadNotificationIds(currentReadIds);
        } else {
          currentReadIds = new Set<string>();
        }
      } catch (error) {
        console.error('Error loading read notifications:', error);
        currentReadIds = new Set<string>();
      }
      
      // Fetch fresh data from server
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // Fetch calendar events: current month ± 2 months (same as AdminDashboard/SchoolUpdates)
      const startDate = new Date(currentYear, currentMonth - 2, 1);
      const endDate = new Date(currentYear, currentMonth + 3, 0, 23, 59, 59); // Last day of month + 2
      
      const [postsResult, eventsResult] = await Promise.allSettled([
        AdminDataService.getPosts(), // Fetch ALL posts (no date filter)
        CalendarService.getEvents({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 1000, // Same limit as AdminDashboard
        }),
      ]);
      
      // Handle posts result
      let fetchedPosts: Post[] = [];
      if (postsResult.status === 'fulfilled') {
        fetchedPosts = postsResult.value || [];
        console.log(`✅ NotificationModal: Fetched ${fetchedPosts.length} posts`);
        // Update context so other screens stay in sync
        setPosts(fetchedPosts as any[]);
      } else {
        console.error('❌ NotificationModal: Failed to fetch posts:', postsResult.reason);
        // Use existing context data as fallback
        fetchedPosts = posts as any[];
      }
      
      // Handle events result
      let fetchedEvents: CalendarEvent[] = [];
      if (eventsResult.status === 'fulfilled') {
        fetchedEvents = Array.isArray(eventsResult.value) ? eventsResult.value : [];
        console.log(`✅ NotificationModal: Fetched ${fetchedEvents.length} calendar events`);
        // Update context so other screens stay in sync
        setCalendarEvents(fetchedEvents);
      } else {
        console.error('❌ NotificationModal: Failed to fetch events:', eventsResult.reason);
        // Use existing context data as fallback
        fetchedEvents = calendarEvents;
      }
      
      // Process the fetched data
      await processNotifications(fetchedPosts, fetchedEvents, currentReadIds);
    } catch (error) {
      console.error('❌ NotificationModal: Error refreshing notifications:', error);
      // Fallback to processing existing context data
      let fallbackReadIds: Set<string>;
      try {
        const readIdsJson = await AsyncStorage.getItem('readNotificationIds');
        if (readIdsJson) {
          const readIds = JSON.parse(readIdsJson);
          fallbackReadIds = new Set(readIds);
        } else {
          fallbackReadIds = new Set<string>();
        }
      } catch {
        fallbackReadIds = new Set<string>();
      }
      await processNotifications(posts, calendarEvents, fallbackReadIds);
    } finally {
      setIsLoading(false);
    }
  }, [posts, calendarEvents, setPosts, setCalendarEvents, processNotifications]);

  // Memoize checkPermissions to avoid recreating on every render
  const checkPermissions = useCallback(async () => {
    try {
      const Notifications = getNotifications();
      
      if (!Notifications) {
        setHasPermission(false);
        const enabled = await NotificationService.areNotificationsEnabled();
        setNotificationsEnabled(enabled);
        return;
      }

      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === 'granted');
      const enabled = await NotificationService.areNotificationsEnabled();
      setNotificationsEnabled(enabled);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }, []);

  const handleClose = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: 600,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [sheetY, onClose]);

  // Process notifications when context data changes (sync with existing knowledge base)
  useEffect(() => {
    if (visible && (posts.length > 0 || calendarEvents.length > 0)) {
      // Only process if we have data in context (don't fetch)
      console.log('📬 NotificationModal: Context data available, processing notifications...');
      loadNotifications();
    } else if (visible && posts.length === 0 && calendarEvents.length === 0) {
      // If no data in context, show empty state (don't fetch automatically)
      console.log('📬 NotificationModal: No context data available, showing empty state');
      setNotificationItems([]);
      setIsLoading(false);
    }
  }, [visible, posts, calendarEvents, loadNotifications]);

  // Animate sheet when visible changes
  useEffect(() => {
    if (visible) {
      console.log('📬 NotificationModal: Modal opened');
      Animated.spring(sheetY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      // Check permissions (don't load data - that's handled by context effect above)
      checkPermissions().catch((error) => {
        console.error('❌ NotificationModal: Error in checkPermissions:', error);
      });
    } else {
      Animated.timing(sheetY, {
        toValue: 600,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]); // Only depend on visible - checkPermissions is stable

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      console.log('📬 NotificationModal: Refreshing notifications from server...');
      // Fetch fresh data and update context
      await refreshNotifications();
      await NotificationService.checkAllNotifications();
      console.log('✅ NotificationModal: Refresh completed');
    } catch (error) {
      console.error('❌ NotificationModal: Error refreshing notifications:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await NotificationService.setNotificationsEnabled(value);
    if (value) {
      const permission = await NotificationService.requestPermissions();
      setHasPermission(permission);
      if (permission) {
        await NotificationService.checkAllNotifications();
      }
    }
  };

  const handleRequestPermissions = async () => {
    const permission = await NotificationService.requestPermissions();
    setHasPermission(permission);
    if (permission) {
      await NotificationService.checkAllNotifications();
      // Refresh to get latest data after permission granted
      await refreshNotifications();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_post':
        return 'document-text';
      case 'todays_event':
        return 'calendar';
      case 'upcoming_event':
        return 'notifications';
      default:
        return 'information-circle';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'new_post':
        return theme.colors.accent || '#2563EB'; // Theme accent color
      case 'todays_event':
        return theme.colors.success || '#10B981'; // Green (for today's events)
      case 'upcoming_event':
        return theme.colors.secondary || theme.colors.accent || '#FBBF24'; // Secondary color with fallback
      default:
        return theme.colors.accent || '#2563EB';
    }
  };

  // Helper function to check if an item's date is in the current month
  const isInCurrentMonth = useCallback((timestamp: number): boolean => {
    const itemDate = new Date(timestamp);
    const now = new Date();
    return itemDate.getFullYear() === now.getFullYear() && 
           itemDate.getMonth() === now.getMonth();
  }, []);

  // Filter notifications based on selected filter, then sort by upload time (DESCENDING - latest first)
  // Mirror AdminDashboard/SchoolUpdates filter behavior
  const filteredNotifications = useMemo(() => {
    const filtered = notificationItems
      .filter(item => {
        if (filter === 'all') {
          // All Updates - shows ALL notification types from current month only
          // Filter by current month
          return isInCurrentMonth(item.timestamp);
        }
      if (filter === 'new_post') {
        // Added Post - only shows posts (type 'new_post')
        // This matches AdminDashboard showing only posts
        // All posts should be type 'new_post' except future posts (which are 'upcoming_event')
        return item.type === 'new_post';
      }
        if (filter === 'upcoming_event') {
          // Upcoming Updates - shows both upcoming posts AND upcoming calendar events from current month only
          // Both use type 'upcoming_event', also include today's events
          // This matches AdminDashboard "Upcoming Month" filter showing both posts and events
          const isUpcoming = item.type === 'upcoming_event' || item.type === 'todays_event';
          // Also filter by current month
          return isUpcoming && isInCurrentMonth(item.timestamp);
        }
        return true;
      })
      .sort((a, b) => {
        // DESCENDING sort: Latest created/uploaded first (b.timestamp - a.timestamp)
        // This ensures the most recently created post/event appears at the top
        const timeDiff = b.timestamp - a.timestamp;
        if (timeDiff !== 0) return timeDiff;
        
        // Secondary sort: by type for consistency when timestamps are equal
        const typeOrder = { 'new_post': 0, 'todays_event': 1, 'upcoming_event': 2 };
        return (typeOrder[a.type] || 3) - (typeOrder[b.type] || 3);
      });
    
    // Debug logging
    console.log(`🔍 NotificationModal Filter Debug:`);
    console.log(`  - Filter: "${filter}"`);
    console.log(`  - Total items: ${notificationItems.length}`);
    console.log(`  - Filtered items: ${filtered.length}`);
    console.log(`  - Breakdown by type:`);
    console.log(`    * new_post: ${notificationItems.filter(i => i.type === 'new_post').length} total, ${filtered.filter(i => i.type === 'new_post').length} filtered`);
    console.log(`    * todays_event: ${notificationItems.filter(i => i.type === 'todays_event').length} total, ${filtered.filter(i => i.type === 'todays_event').length} filtered`);
    console.log(`    * upcoming_event (posts): ${notificationItems.filter(i => i.type === 'upcoming_event' && (i.data?.postId || i.data?.post)).length} total, ${filtered.filter(i => i.type === 'upcoming_event' && (i.data?.postId || i.data?.post)).length} filtered`);
    console.log(`    * upcoming_event (events): ${notificationItems.filter(i => i.type === 'upcoming_event' && (i.data?.eventId || i.data?.event)).length} total, ${filtered.filter(i => i.type === 'upcoming_event' && (i.data?.eventId || i.data?.event)).length} filtered`);
    
    return filtered;
  }, [notificationItems, filter, isInCurrentMonth])
    .sort((a, b) => {
      // DESCENDING sort: Latest created/uploaded first (b.timestamp - a.timestamp)
      // This ensures the most recently created post/event appears at the top
      const timeDiff = b.timestamp - a.timestamp;
      if (timeDiff !== 0) return timeDiff;
      
      // Secondary sort: by type for consistency when timestamps are equal
      const typeOrder = { 'new_post': 0, 'todays_event': 1, 'upcoming_event': 2 };
      return (typeOrder[a.type] || 3) - (typeOrder[b.type] || 3);
    });
  
  // Debug: Log filtered results
  useEffect(() => {
    if (notificationItems.length > 0) {
      const filterSummary = {
        filter,
        totalItems: notificationItems.length,
        filteredCount: filteredNotifications.length,
        byType: {
          new_post: notificationItems.filter(i => i.type === 'new_post').length,
          todays_event: notificationItems.filter(i => i.type === 'todays_event').length,
          upcoming_event: notificationItems.filter(i => i.type === 'upcoming_event').length,
        },
        upcomingBreakdown: filter === 'upcoming_event' ? {
          totalUpcoming: filteredNotifications.length,
          posts: filteredNotifications.filter(i => i.type === 'upcoming_event' && (i.data?.postId || i.data?.post)).length,
          calendarEvents: filteredNotifications.filter(i => i.type === 'upcoming_event' && (i.data?.eventId || i.data?.event)).length,
          todaysEvents: filteredNotifications.filter(i => i.type === 'todays_event').length,
        } : null,
        allUpdatesBreakdown: filter === 'all' ? {
          newPosts: filteredNotifications.filter(i => i.type === 'new_post').length,
          todaysEvents: filteredNotifications.filter(i => i.type === 'todays_event').length,
          upcomingPosts: filteredNotifications.filter(i => i.type === 'upcoming_event' && (i.data?.postId || i.data?.post)).length,
          upcomingEvents: filteredNotifications.filter(i => i.type === 'upcoming_event' && (i.data?.eventId || i.data?.event)).length,
        } : null
      };
      console.log(`🔍 NotificationModal: Filter "${filter}" results:`, filterSummary);
    }
  }, [filter, filteredNotifications, notificationItems]);

  if (!visible) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      sheetY={sheetY}
      maxHeight="85%"
      backgroundColor={theme.colors.card}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIcon, { backgroundColor: hexToRgba(theme.colors.accent, 0.2) }]}>
              <Ionicons name="notifications" size={24} color={theme.colors.accent} />
            </View>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Notifications</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
        >
          {/* Permission Status */}
          {!hasPermission && (
            <View style={[styles.permissionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.colors.secondary} />
              <View style={styles.permissionContent}>
                <Text style={[styles.permissionTitle, { color: theme.colors.text }]}>Enable Notifications</Text>
                <Text style={[styles.permissionMessage, { color: theme.colors.textMuted }]}>
                  Allow notifications for new posts and events
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.permissionButton, { backgroundColor: theme.colors.accent }]}
                onPress={handleRequestPermissions}
              >
                <Text style={styles.permissionButtonText}>Enable</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Notification Toggle */}
          <View style={[styles.settingsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.settingsRow}>
              <View style={styles.settingsLeft}>
                <Ionicons name="notifications-outline" size={20} color={theme.colors.accent} />
                <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor={theme.colors.surface}
                ios_backgroundColor={theme.colors.border}
              />
            </View>
            <Text style={[styles.settingsDescription, { color: theme.colors.textMuted }]}>
              Get notified about new posts and events
            </Text>
          </View>

          {/* Filter Pills */}
          {notificationItems.length > 0 && (
            <View style={styles.filtersContainer}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { borderColor: theme.colors.border },
                  filter === 'all' && {
                    backgroundColor: theme.colors.accent,
                    borderColor: theme.colors.accent,
                  }
                ]}
                onPress={() => setFilter('all')}
              >
                <Text style={[
                  styles.filterPillText,
                  { color: theme.colors.textMuted },
                  filter === 'all' && { color: '#FFF' }
                ]}>All Updates</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { borderColor: theme.colors.border },
                  filter === 'new_post' && {
                    backgroundColor: theme.colors.accent,
                    borderColor: theme.colors.accent,
                  }
                ]}
                onPress={() => setFilter('new_post')}
              >
                <Text style={[
                  styles.filterPillText,
                  { color: theme.colors.textMuted },
                  filter === 'new_post' && { color: '#FFF' }
                ]}>Added Post</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { borderColor: theme.colors.border },
                  filter === 'upcoming_event' && {
                    backgroundColor: theme.colors.accent,
                    borderColor: theme.colors.accent,
                  }
                ]}
                onPress={() => setFilter('upcoming_event')}
              >
                <Text style={[
                  styles.filterPillText,
                  { color: theme.colors.textMuted },
                  filter === 'upcoming_event' && { color: '#FFF' }
                ]}>Upcoming Updates</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Mark All as Read Button */}
          {filteredNotifications.length > 0 && filteredNotifications.some(item => !item.read) && (
            <TouchableOpacity
              style={[styles.markAllReadButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={markAllAsRead}
            >
              <Ionicons name="checkmark-done" size={18} color={theme.colors.accent} />
              <Text style={[styles.markAllReadText, { color: theme.colors.accent }]}>Mark all as read</Text>
            </TouchableOpacity>
          )}

          {/* Notification Items */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>Loading notifications...</Text>
            </View>
          ) : filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.colors.textMuted} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Notifications</Text>
              <Text style={[styles.emptyMessage, { color: theme.colors.textMuted }]}>
                {filter === 'all' 
                  ? 'All caught up! No posts or events found.'
                  : filter === 'new_post'
                  ? 'No posts found.'
                  : 'No upcoming posts or events found.'}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={handleRefresh}
              >
                <Ionicons name="refresh" size={16} color={theme.colors.accent} />
                <Text style={[styles.retryButtonText, { color: theme.colors.accent }]}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.notificationsList}>
              {filteredNotifications.map((item) => {
                const iconColor = getNotificationColor(item.type);
                const isRead = item.read || false;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.notificationCard, 
                      { 
                        backgroundColor: theme.colors.surface, 
                        borderColor: theme.colors.border,
                        opacity: isRead ? 0.7 : 1,
                      }
                    ]}
                    onPress={() => !isRead && markAsRead(item.id)}
                    activeOpacity={0.7}
                  >
                    {!isRead && (
                      <View style={[styles.unreadIndicator, { backgroundColor: theme.colors.accent }]} />
                    )}
                    <View style={[styles.notificationIcon, { backgroundColor: hexToRgba(iconColor, 0.2) }]}>
                      <Ionicons name={getNotificationIcon(item.type) as any} size={24} color={iconColor} />
                    </View>
                    <View style={styles.notificationContent}>
                      <View style={styles.notificationTitleRow}>
                        <Text style={[styles.notificationTitle, { color: theme.colors.text }]}>{item.title}</Text>
                        {!isRead && (
                          <TouchableOpacity
                            onPress={() => markAsRead(item.id)}
                            style={styles.markReadButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.accent} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={[styles.notificationMessage, { color: theme.colors.text }]} numberOfLines={2}>
                        {item.message}
                      </Text>
                      {item.data && (
                        <View style={styles.notificationMeta}>
                          {(item.data.post || (item.type === 'upcoming_event' && item.data.postId)) && (
                            <Text style={[styles.notificationMetaText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                              {(() => {
                                const post = item.data.post;
                                if (!post) return '';
                                const postDate = post.isoDate || post.date;
                                if (!postDate) return '';
                                const formatted = formatDate(postDate);
                                return formatted || '';
                              })()}
                            </Text>
                          )}
                          {item.data.event && (
                            <Text style={[styles.notificationMetaText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                              {(() => {
                                const eventDate = item.data.event.isoDate || item.data.event.date;
                                if (!eventDate) return '';
                                const formatted = formatDate(eventDate);
                                return formatted || '';
                              })()}
                              {item.data.event.time && item.data.event.time.trim() && ` • ${item.data.event.time}`}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Manual Check Button */}
          <TouchableOpacity
            style={[styles.checkButton, { backgroundColor: theme.colors.accent }]}
            onPress={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.checkButtonText}>Check for Updates</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  permissionMessage: {
    fontSize: 11,
    lineHeight: 14,
  },
  permissionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  settingsCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsDescription: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyMessage: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  notificationsList: {
    gap: 8,
    marginBottom: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    position: 'relative',
  },
  unreadIndicator: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  markReadButton: {
    padding: 4,
  },
  markAllReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  markAllReadText: {
    fontSize: 13,
    fontWeight: '700',
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    opacity: 0.8,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
    fontWeight: '600',
  },
  notificationMeta: {
    marginTop: 2,
  },
  notificationMetaText: {
    fontSize: 11,
    lineHeight: 14,
    opacity: 0.7,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 6,
    marginBottom: 12,
  },
  checkButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    gap: 6,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default NotificationModal;

