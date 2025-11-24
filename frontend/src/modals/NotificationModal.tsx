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
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, RefreshControl, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../components/common/BottomSheet';
import { useThemeValues } from '../contexts/ThemeContext';
import NotificationService from '../services/NotificationService';
import AdminDataService, { Post } from '../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../services/CalendarService';

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
  const { theme, isDarkMode } = useThemeValues();
  const insets = useSafeAreaInsets();
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
      }
    } catch (error) {
      console.error('Error loading read notifications:', error);
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
    const newReadIds = new Set(readNotificationIds);
    newReadIds.add(notificationId);
    await saveReadNotifications(newReadIds);
    
    // Update the notification item's read status
    setNotificationItems(prev => 
      prev.map(item => 
        item.id === notificationId ? { ...item, read: true } : item
      )
    );
  }, [readNotificationIds, saveReadNotifications]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    const allIds = new Set(notificationItems.map(item => item.id));
    await saveReadNotifications(allIds);
    
    // Update all notification items' read status
    setNotificationItems(prev => 
      prev.map(item => ({ ...item, read: true }))
    );
  }, [notificationItems, saveReadNotifications]);

  // Animate sheet when visible changes
  useEffect(() => {
    if (visible) {
      Animated.spring(sheetY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      loadNotifications();
      checkPermissions();
    } else {
      Animated.timing(sheetY, {
        toValue: 600,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, sheetY, loadNotifications]);

  const handleClose = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: 600,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [sheetY, onClose]);

  const checkPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === 'granted');
      const enabled = await NotificationService.areNotificationsEnabled();
      setNotificationsEnabled(enabled);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load read status first
      let currentReadIds = readNotificationIds;
      try {
        const readIdsJson = await AsyncStorage.getItem('readNotificationIds');
        if (readIdsJson) {
          const readIds = JSON.parse(readIdsJson);
          currentReadIds = new Set(readIds);
          setReadNotificationIds(currentReadIds);
        }
      } catch (error) {
        console.error('Error loading read notifications:', error);
      }
      
      // Fetch current data to show what would trigger notifications
      const [posts, events] = await Promise.all([
        AdminDataService.getPosts().catch(() => []),
        CalendarService.getEvents({
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 50,
        }).catch(() => []),
      ]);

      const items: NotificationItem[] = [];
      const todayKey = getPHDateKey(new Date());
      const now = Date.now();

      // Add individual new posts (last 24 hours)
      const recentPosts = posts.filter((post: Post) => {
        if (!post.date) return false;
        const postDate = new Date(post.date).getTime();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        return postDate > oneDayAgo;
      });

      // Create individual notification for each new post
      recentPosts.forEach((post: Post, index: number) => {
        // Use createdAt if available (actual creation time), otherwise use date
        const postDate = (post as any).createdAt || post.date || post.isoDate;
        items.push({
          id: `new_post_${post.id || index}`,
          type: 'new_post',
          title: '📢 New Post',
          message: post.title || 'A new post has been added',
          timestamp: new Date(postDate).getTime(),
          data: { postId: post.id, post },
        });
      });

      // Add individual today's events (only if event date is today)
      const todaysEvents = events.filter((event: CalendarEvent) => {
        if (!event.isoDate && !event.date) return false;
        const eventKey = getPHDateKey(event.isoDate || event.date);
        return eventKey === todayKey;
      });

      // Create individual notification for each today's event
      todaysEvents.forEach((event: CalendarEvent, index: number) => {
        items.push({
          id: `todays_event_${event._id || index}`,
          type: 'todays_event',
          title: '📅 Today',
          message: event.title || 'An event is scheduled for today',
          timestamp: new Date(event.isoDate || event.date).getTime(),
          data: { eventId: event._id, event },
        });
      });

      // Add individual upcoming events (only future events, not past)
      const upcomingEvents = events.filter((event: CalendarEvent) => {
        if (!event.isoDate && !event.date) return false;
        const eventKey = getPHDateKey(event.isoDate || event.date);
        const eventDate = new Date(event.isoDate || event.date).getTime();
        // Only include events that are in the future (not today, not past)
        return eventKey > todayKey && eventDate > now;
      });

      // Create individual notification for each upcoming event
      upcomingEvents.forEach((event: CalendarEvent, index: number) => {
        items.push({
          id: `upcoming_event_${event._id || index}`,
          type: 'upcoming_event',
          title: '🔔 Upcoming',
          message: event.title || 'An upcoming event',
          timestamp: new Date(event.isoDate || event.date).getTime(),
          data: { eventId: event._id, event },
        });
      });

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

      setNotificationItems(itemsWithReadStatus);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [readNotificationIds]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    await NotificationService.checkAllNotifications();
    setIsRefreshing(false);
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
      await loadNotifications();
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

  // Filter notifications based on selected filter, then sort by upload time (DESCENDING - latest first)
  // This applies to: All Updates, Added Post, and Upcoming Updates filters
  const filteredNotifications = notificationItems
    .filter(item => {
      if (filter === 'all') return true; // All Updates - shows all notification types
      if (filter === 'new_post') return item.type === 'new_post'; // Added Post - only new posts
      if (filter === 'upcoming_event') return item.type === 'upcoming_event' || item.type === 'todays_event'; // Upcoming Updates - events only
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
                  ? 'All caught up! No new posts or events.'
                  : filter === 'new_post'
                  ? 'No new posts found.'
                  : 'No upcoming events found.'}
              </Text>
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
                          {item.data.post && (
                            <Text style={[styles.notificationMetaText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                              {new Date(item.data.post.date).toLocaleDateString()}
                            </Text>
                          )}
                          {item.data.event && (
                            <Text style={[styles.notificationMetaText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                              {new Date(item.data.event.isoDate || item.data.event.date).toLocaleDateString()}
                              {item.data.event.time && ` • ${item.data.event.time}`}
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
            disabled={isRefreshing}
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

