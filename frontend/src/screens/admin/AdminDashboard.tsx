import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import AddPostDrawer from '../../components/dashboard/AddPostDrawer'; // Replaced with PostUpdate screen navigation
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import AdminSidebar from '../../components/navigation/AdminSidebar';
import { useThemeValues } from '../../contexts/ThemeContext';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import NotificationService from '../../services/NotificationService';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import { categoryToColors, formatDateKey, parseAnyDateToKey } from '../../utils/calendarUtils';
import NotificationModal from '../../modals/NotificationModal';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
  AdminDashboard: undefined;
  AdminAIChat: undefined;
  AdminCalendar: undefined;
  AdminSettings: undefined;
  PostUpdate: { postId?: string } | undefined;
  ManagePosts: undefined;
};

type DashboardUpdate = { 
  id: string;
  title: string; 
  date: string; 
  time?: string; 
  tag: string; 
  image?: string; 
  images?: string[]; 
  description?: string; 
  source?: string; 
  pinned?: boolean; 
  isoDate?: string;
  _id?: string; // For calendar events
};

// Helper function to get Philippines timezone date key (moved outside component for performance)
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

type LegendItem = {
  type: string;
  key: string;
  color: string;
};

const legendItemsData: LegendItem[] = [
  { type: 'Academic', key: 'academic', color: '#10B981' },
  { type: 'Institutional', key: 'institutional', color: '#2563EB' },
  { type: 'News', key: 'news', color: '#8B5CF6' },
  { type: 'Event', key: 'event', color: '#F59E0B' },
  { type: 'Announcement', key: 'announcement', color: '#3B82F6' },
];


const AdminDashboard = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  const resolvedLegendItems = useMemo<LegendItem[]>(() => (
    legendItemsData.map(item => {
      if (item.key === 'institutional') {
        return { ...item, color: theme.colors.accent };
      }
      return item;
    })
  ), [theme.colors.accent]);
  const legendRows = useMemo<(LegendItem | null)[][]>(() => {
    const firstRow: (LegendItem | null)[] = resolvedLegendItems.slice(0, 3);
    const secondRow: (LegendItem | null)[] = resolvedLegendItems.slice(3, 5);
    while (secondRow.length < 3) {
      secondRow.push(null);
    }
    return [firstRow, secondRow];
  }, [resolvedLegendItems]);
  
  // Get header gradient colors based on theme
  const getHeaderGradientColors = (): [string, string, string] => {
    // DOrSU theme (Royal Blue)
    if (theme.colors.accent === '#2563EB') {
      return ['#93C5FD', '#60A5FA', '#2563EB'];
    }
    // Facet theme (Orange)
    if (theme.colors.accent === '#FF9500') {
      return ['#FFCC80', '#FFA726', '#FF9500'];
    }
    // Default: use theme colors
    return [
      theme.colors.accentLight || '#93C5FD',
      theme.colors.accent || '#2563EB',
      theme.colors.accentDark || '#1E3A8A'
    ] as [string, string, string];
  };
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scrollRef = useRef<ScrollView>(null);
  
  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);

  
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);
  const [backendUserFirstName, setBackendUserFirstName] = useState<string | null>(null);
  const [backendUserLastName, setBackendUserLastName] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const userName = useMemo(() => {
    // Priority: Backend firstName + lastName -> Backend userName -> Firebase displayName -> Firebase email username -> Default
    if (backendUserFirstName && backendUserLastName) {
      return `${backendUserFirstName} ${backendUserLastName}`.trim();
    }
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    // Try to get from AsyncStorage synchronously (will be updated by useFocusEffect)
    try {
      // This is a fallback - the actual value will be set by useFocusEffect
    } catch {}
    return currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';
  }, [currentUser, backendUserFirstName, backendUserLastName]);
  
  // Dashboard data
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'recent' | 'thismonth'>('all');
  const [dashboardData, setDashboardData] = useState({
    recentUpdates: [] as DashboardUpdate[],
  });
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [allUpdates, setAllUpdates] = useState<DashboardUpdate[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendarEvents, setIsLoadingCalendarEvents] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Content type legend filter - matches AdminCalendar behavior (single select, null = show all)
  const [selectedLegendType, setSelectedLegendType] = useState<string | null>(null);
  const selectedContentTypes = useMemo(() => (
    selectedLegendType ? [selectedLegendType] : ['academic', 'institutional', 'event', 'announcement', 'news']
  ), [selectedLegendType]);
  const selectedContentTypesSet = useMemo(
    () => new Set(selectedContentTypes.map(type => type.toLowerCase())),
    [selectedContentTypes]
  );
  
  // Event modal state
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([]);
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<Date | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Notification modal state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  
  // Animated floating background orb (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;

  // Upcoming updates (future dates)
  const upcomingUpdates = useMemo(() => {
    const todayKey = getPHDateKey(new Date());
    return allUpdates.filter(u => {
      if (!u.isoDate) return false;
      const eventKey = getPHDateKey(u.isoDate);
      return eventKey > todayKey;
    });
  }, [allUpdates]);

  // Recent updates (today and past dates)
  const recentUpdates = useMemo(() => {
    const todayKey = getPHDateKey(new Date());
    return allUpdates.filter(u => {
      if (!u.isoDate) return false;
      const eventKey = getPHDateKey(u.isoDate);
      return eventKey <= todayKey;
    });
  }, [allUpdates]);

  // Filtered updates based on selected time filter, content type, and search query
  // Includes both posts and calendar events
  // Only show Event, Announcement, and News entries that are in the current month or next month
  const displayedUpdates = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayKey = getPHDateKey(now);
    
    // Calculate next month and year (handle year rollover)
    const nextMonth = currentMonth + 1;
    const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
    const normalizedNextMonth = nextMonth > 11 ? 0 : nextMonth;
    
    // Categories that should be filtered by current month and next month
    const monthFilteredCategories = new Set(['event', 'announcement', 'news']);
    
    // Start with posts based on time filter
    let result;
    if (timeFilter === 'upcoming') {
      result = [...upcomingUpdates];
    } else if (timeFilter === 'recent') {
      result = [...recentUpdates];
    } else if (timeFilter === 'thismonth') {
      // Filter by current month only
      result = allUpdates.filter(u => {
        if (!u.isoDate) return false;
        try {
          const updateDate = new Date(u.isoDate);
          const updateYear = updateDate.getFullYear();
          const updateMonth = updateDate.getMonth();
          return updateYear === currentYear && updateMonth === currentMonth;
        } catch {
          return false;
        }
      });
    } else {
      result = [...allUpdates]; // 'all'
    }
    
    // Add calendar events based on time filter
    const calendarEventsForUpdates = calendarEvents
      .filter(event => {
        const eventDate = event.isoDate || event.date;
        if (!eventDate) return false;
        
        const eventDateObj = new Date(eventDate);
        const eventKey = getPHDateKey(eventDate);
        const eventYear = eventDateObj.getFullYear();
        const eventMonth = eventDateObj.getMonth();
        
        // Apply time filter
        if (timeFilter === 'upcoming') {
          return eventKey > todayKey;
        } else if (timeFilter === 'recent') {
          return eventKey <= todayKey;
        } else if (timeFilter === 'thismonth') {
          return eventYear === currentYear && eventMonth === currentMonth;
        } else {
          // 'all' - include all calendar events
          return true;
        }
      })
      .map(event => ({
        id: event._id || `calendar-${event.isoDate}-${event.title}`,
        title: event.title,
        date: new Date(event.isoDate || event.date).toLocaleDateString(),
        tag: event.category || 'Event',
        description: event.description || '',
        image: undefined,
        images: undefined,
        pinned: false,
        isoDate: event.isoDate || event.date,
        source: 'calendar', // Mark as calendar event
        _id: event._id,
      }));
    
    // Combine posts and calendar events
    result = [...result, ...calendarEventsForUpdates];
    
    // Remove duplicates (same ID or same title + date)
    const seen = new Set<string>();
    result = result.filter(update => {
      const key = update.id || `${update.title}-${update.isoDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Apply content type filter
    result = result.filter(update => {
      const updateType = String(update.tag || 'Announcement').toLowerCase();
      return selectedContentTypesSet.has(updateType);
    });
    
    // Filter by current month or next month for Event, Announcement, and News categories
    result = result.filter(update => {
      const updateType = String(update.tag || 'Announcement').toLowerCase();
      
      // Only apply month filter to Event, Announcement, and News
      if (monthFilteredCategories.has(updateType)) {
        if (!update.isoDate) return false; // Exclude entries without dates
        try {
          const updateDate = new Date(update.isoDate);
          const updateYear = updateDate.getFullYear();
          const updateMonth = updateDate.getMonth();
          
          // Check if date is in current month or next month
          const isCurrentMonth = updateYear === currentYear && updateMonth === currentMonth;
          const isNextMonth = updateYear === nextYear && updateMonth === normalizedNextMonth;
          
          return isCurrentMonth || isNextMonth;
        } catch {
          return false; // Exclude entries with invalid dates
        }
      }
      
      // For other categories (Academic, Institutional), show all (no month filter)
      return true;
    });
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(update => {
        const title = (update.title || '').toLowerCase();
        const description = (update.description || '').toLowerCase();
        const tag = (update.tag || '').toLowerCase();
        return title.includes(query) || description.includes(query) || tag.includes(query);
      });
    }
    
    // Sort by date (newest first)
    result.sort((a, b) => {
      if (!a.isoDate && !b.isoDate) return 0;
      if (!a.isoDate) return 1;
      if (!b.isoDate) return -1;
      try {
        const dateA = new Date(a.isoDate).getTime();
        const dateB = new Date(b.isoDate).getTime();
        return dateB - dateA; // Newest first
      } catch {
        return 0;
      }
    });
    
    return result;
  }, [timeFilter, selectedContentTypesSet, searchQuery, upcomingUpdates, recentUpdates, allUpdates, calendarEvents]);

  // Current month events - combines calendar events and posts/updates
  // Filtered by selectedContentTypes and search query
  const currentMonthEvents = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const events: any[] = [];
    
    // Add calendar events for current month
    calendarEvents
      .filter(event => {
        const eventDate = event.isoDate || event.date;
        if (!eventDate) return false;
        const eventDateObj = new Date(eventDate);
        const isCurrentMonth = eventDateObj.getFullYear() === currentYear &&
                               eventDateObj.getMonth() === currentMonth;
        
        if (!isCurrentMonth) return false;
        
        // Apply content type filter
        const eventType = String(event.category || 'Event').toLowerCase();
        return selectedContentTypesSet.has(eventType);
      })
      .forEach(event => {
        events.push({
          id: event._id || `calendar-${event.isoDate}-${event.title}`,
          title: event.title,
          date: new Date(event.isoDate || event.date).toLocaleDateString(),
          tag: event.category || 'Event',
          description: event.description || '',
          image: undefined,
          images: undefined,
          pinned: false,
          isoDate: event.isoDate || event.date,
          source: 'calendar', // Mark as calendar event
          _id: event._id,
        });
      });
    
    // Add posts/updates for current month
    allUpdates
      .filter(update => {
        if (!update.isoDate) return false;
        const updateDate = new Date(update.isoDate);
        const isCurrentMonth = updateDate.getFullYear() === currentYear &&
                              updateDate.getMonth() === currentMonth;
        
        if (!isCurrentMonth) return false;
        
        // Apply content type filter
        const updateType = String(update.tag || 'Announcement').toLowerCase();
        return selectedContentTypesSet.has(updateType);
      })
      .forEach(update => {
        events.push({
          id: update.id,
          title: update.title,
          date: new Date(update.isoDate || update.date).toLocaleDateString(),
          tag: update.tag || 'Announcement',
          description: update.description || '',
          image: update.image,
          images: update.images,
          pinned: update.pinned || false,
          isoDate: update.isoDate || update.date,
          source: 'post', // Mark as post/update
        });
      });
    
    // Apply search filter if search query exists
    let filteredEvents = events;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredEvents = events.filter(event => {
        const title = (event.title || '').toLowerCase();
        const description = (event.description || '').toLowerCase();
        const tag = (event.tag || '').toLowerCase();
        return title.includes(query) || description.includes(query) || tag.includes(query);
      });
    }
    
    // Sort by date (earliest first)
    return filteredEvents.sort((a, b) => {
      const dateA = new Date(a.isoDate || a.date).getTime();
      const dateB = new Date(b.isoDate || b.date).getTime();
      return dateA - dateB;
    });
  }, [calendarEvents, allUpdates, selectedContentTypesSet, searchQuery]);

  // Load current user and subscribe to auth changes
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    const unsubscribe = onAuthStateChange((u) => setCurrentUser(u));
    return () => unsubscribe();
  }, []);

  // Load backend user photo on screen focus (separate from data fetching)
  useFocusEffect(
    useCallback(() => {
      const loadBackendUserData = async () => {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const userPhoto = await AsyncStorage.getItem('userPhoto');
          const firstName = await AsyncStorage.getItem('userFirstName');
          const lastName = await AsyncStorage.getItem('userLastName');
          setBackendUserPhoto(userPhoto);
          setBackendUserFirstName(firstName);
          setBackendUserLastName(lastName);
        } catch (error) {
          if (__DEV__) console.error('Failed to load backend user data:', error);
        }
      };
      
      loadBackendUserData();
    }, [])
  );

  const getUserInitials = () => {
    // Use firstName and lastName directly if available
    if (backendUserFirstName && backendUserLastName) {
      return (backendUserFirstName[0] + backendUserLastName[0]).toUpperCase();
    }
    if (!userName) return '?';
    const names = userName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  };

  const handleNotificationsPress = useCallback(() => {
    setShowNotificationModal(true);
  }, []);

  // Animate floating background orb on mount
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim1, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [floatAnim1]);

  // Refresh calendar events function
  // Track last calendar fetch time
  const lastCalendarFetchTime = useRef<number>(0);
  const isFetchingCalendar = useRef<boolean>(false);
  const CALENDAR_FETCH_COOLDOWN = 2000; // 2 seconds cooldown for calendar events

  const refreshCalendarEvents = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent duplicate simultaneous fetches
    if (isFetchingCalendar.current && !forceRefresh) {
      return;
    }

    // Cooldown check
    const now = Date.now();
    if (!forceRefresh && now - lastCalendarFetchTime.current < CALENDAR_FETCH_COOLDOWN) {
      return;
    }

    isFetchingCalendar.current = true;
    lastCalendarFetchTime.current = now;

    try {
      setIsLoadingCalendarEvents(true);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // Get first and last day of current month
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      
      // Use caching - CalendarService now supports caching
      const events = await CalendarService.getEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 1000,
      });
      
      setCalendarEvents(Array.isArray(events) ? events : []);
    } catch (error) {
      if (__DEV__) console.error('Failed to load calendar events:', error);
      setCalendarEvents([]);
    } finally {
      setIsLoadingCalendarEvents(false);
      isFetchingCalendar.current = false;
    }
  }, []);

  // Fetch calendar events for current month
  useEffect(() => {
    refreshCalendarEvents(true);
  }, []);
  
  
  // Open event modal - optimized for performance
  const openEventDrawer = useCallback((event: CalendarEvent, date?: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Batch state updates for better performance
    if (date) {
      const dateKey = formatDateKey(date);
      const eventsOnDate = calendarEvents.filter(e => {
        const eventDateKey = parseAnyDateToKey(e.isoDate || e.date);
        return eventDateKey === dateKey;
      });
      const mappedEvents = eventsOnDate.map(e => ({
        id: e._id || `calendar-${e.isoDate}-${e.title}`,
        title: e.title,
        color: categoryToColors(e.category || 'Event').dot,
        type: e.category || 'Event',
        category: e.category,
        description: e.description,
        isoDate: e.isoDate,
        date: e.date,
        time: e.time,
        startDate: e.startDate,
        endDate: e.endDate,
      }));
      
      // Batch all state updates together
      setSelectedEvent(event);
      setSelectedDateForDrawer(date);
      setSelectedDateEvents(mappedEvents);
      setShowEventDrawer(true);
    } else {
      // Batch all state updates together
      setSelectedEvent(event);
      setSelectedDateForDrawer(null);
      setSelectedDateEvents([]);
      setShowEventDrawer(true);
    }
  }, [calendarEvents]);
  
  // Close event modal
  const closeEventDrawer = useCallback(() => {
    setShowEventDrawer(false);
    setSelectedEvent(null);
    setSelectedDateForDrawer(null);
    setSelectedDateEvents([]);
  }, []);

  // Track last fetch time to prevent unnecessary refetches
  const lastFetchTime = useRef<number>(0);
  const isFetching = useRef<boolean>(false);
  const FETCH_COOLDOWN = 1000; // 1 second cooldown between fetches

  // Fetch dashboard data (posts/announcements) - combines with calendar events
  const fetchDashboardData = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent duplicate simultaneous fetches
    if (isFetching.current && !forceRefresh) {
      return;
    }

    // Cooldown check - prevent too frequent fetches
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime.current < FETCH_COOLDOWN) {
      return;
    }

    isFetching.current = true;
    lastFetchTime.current = now;

    try {
      setIsLoadingDashboard(true);
      setDashboardError(null);
      
      // Fetch dashboard statistics
      const dashboardStats = await AdminDataService.getDashboard();
      
      // Fetch recent updates (posts/announcements) - use cache if available
      const posts = await AdminDataService.getPosts();
        const postsData = posts.map(post => {
          // Ensure images array is properly set
          let images = post.images;
          if (!images || !Array.isArray(images) || images.length === 0) {
            // If images array is empty but image field exists, create array from it
            if (post.image) {
              images = [post.image];
            } else {
              images = [];
            }
          }
          
          return {
            id: post.id,
            title: post.title,
            date: new Date(post.date).toLocaleDateString(),
            tag: post.category,
            description: post.description,
            image: post.image,
            images: images,
            pinned: (post as any).pinned || false,
            isoDate: post.date,
          };
        });
        
        // Only use posts data - calendar events are shown in separate section
        // Remove duplicates from posts only
        const uniqueUpdates = postsData.filter((update, index, self) =>
          index === self.findIndex(u => u.id === update.id)
        );
        
        // Sort by date (newest first)
        uniqueUpdates.sort((a, b) => {
          const dateA = new Date(a.isoDate || a.date).getTime();
          const dateB = new Date(b.isoDate || b.date).getTime();
          return dateB - dateA;
        });
        
        setAllUpdates(uniqueUpdates);
        setDashboardData({
          recentUpdates: uniqueUpdates.slice(0, 5),
        });
      } catch (err: any) {
        setDashboardError(err?.message || 'Failed to load dashboard data');
        if (__DEV__) console.error('Dashboard data fetch error:', err);
      } finally {
        setIsLoadingDashboard(false);
        isFetching.current = false;
      }
  }, []);

  // Fetch dashboard data on mount only
  useEffect(() => {
    fetchDashboardData(true); // Force refresh on mount
    
    // Request notification permissions and check notifications on mount
    const setupNotifications = async () => {
      try {
        await NotificationService.requestPermissions();
        // Check notifications after a short delay to allow data to load
        setTimeout(() => {
          NotificationService.checkAllNotifications();
        }, 2000);
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };
    
    setupNotifications();
  }, []); // Empty deps - only run on mount

  // Refresh dashboard data when screen comes into focus (always refresh to show new posts)
  useFocusEffect(
    useCallback(() => {
      // Add a small delay to ensure backend has processed any updates
      // This is especially important when coming back from PostUpdate screen
      const refreshTimer = setTimeout(() => {
        // Always refresh when screen comes into focus to ensure new posts appear immediately
        // Force refresh (bypass cache) to get the latest data including newly created posts
        // The fetchDashboardData function has its own cooldown to prevent too many requests
        fetchDashboardData(true); // Force refresh to bypass cache and get latest posts
        // Also refresh calendar events in case posts appear there
        refreshCalendarEvents(true);
      }, 100); // Small delay to ensure backend has processed updates
      
      return () => {
        clearTimeout(refreshTimer);
      };
    }, [fetchDashboardData, refreshCalendarEvents])
  );

  return (
    <View style={styles.container} collapsable={false}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        translucent={true}
      />

      {/* Background Gradient Layer */}
      <LinearGradient
        colors={[
          isDarkMode
            ? '#0B1220'
            : '#FBF8F3',
          isDarkMode
            ? '#111827'
            : '#F8F5F0',
          isDarkMode
            ? '#1F2937'
            : '#F5F2ED'
        ]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />
      {/* Blur overlay on entire background - very subtle */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint="default"
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      {/* Animated Floating Background Orb (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none" collapsable={false}>
        {/* Orb 1 - Soft Blue Glow (Center area) */}
        <Animated.View
          style={[
            styles.floatingOrbWrapper,
            {
              top: '35%',
              left: '50%',
              marginLeft: -250,
              transform: [
                {
                  translateX: floatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-30, 30],
                  }),
                },
                {
                  translateY: floatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 20],
                  }),
                },
                {
                  scale: floatAnim1.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.05, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.floatingOrb1}>
            <LinearGradient
              colors={[theme.colors.orbColors.orange1, theme.colors.orbColors.orange2, theme.colors.orbColors.orange3]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 45}
              tint="default"
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        </Animated.View>
      </View>

      {/* Blue Header Area with Profile Section */}
      <LinearGradient
        colors={getHeaderGradientColors()}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.blueHeader, { 
          paddingTop: safeInsets.top + 12,
          paddingLeft: Math.max(safeInsets.left, 20),
          paddingRight: Math.max(safeInsets.right, 20),
        }]}
        collapsable={false}
      >
        {/* DOrSU Statue Background Image */}
        <Image
          source={require('../../../../assets/DOrSU_STATUE.png')}
          style={styles.headerStatueImage}
          resizeMode="cover"
          defaultSource={require('../../../../assets/DOrSU_STATUE.png')}
        />
        
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            onPress={() => setIsHistoryOpen(true)} 
            style={styles.menuButton}
            accessibilityLabel="Open menu"
          >
            <View style={styles.customHamburger} pointerEvents="none">
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: '#FFF' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: '#FFF' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: '#FFF' }]} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleNotificationsPress} 
            style={styles.notificationButton}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
        
        {/* Welcome Section inside Blue Header */}
        <View style={styles.welcomeSectionInHeader}>
          <View style={styles.welcomeContent}>
            {backendUserPhoto ? (
              <Image 
                source={{ uri: backendUserPhoto }} 
                style={styles.welcomeProfileImage}
              />
            ) : (
              <View style={[styles.welcomeProfileIconCircle, { backgroundColor: '#FFF' }]}>
                <Text style={[styles.welcomeProfileInitials, { color: theme.colors.accent, fontSize: theme.fontSize.scaleSize(20) }]}>{getUserInitials()}</Text>
              </View>
            )}
            <View style={styles.welcomeText}>
              <Text style={[styles.welcomeGreetingInHeader, { fontSize: theme.fontSize.scaleSize(14) }]}>Hello!</Text>
              <Text style={[styles.welcomeTitleInHeader, { fontSize: theme.fontSize.scaleSize(18) }]}>{userName}</Text>
              <Text style={[styles.welcomeSubtitleInHeader, { fontSize: theme.fontSize.scaleSize(13) }]}>Here's your dashboard</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
      
      {/* Admin Sidebar Component */}
      <AdminSidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Main Content - Scrollable with Curved Top */}
      <View style={styles.contentWrapper}>
        
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={{ 
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: safeInsets.bottom + 100 + 20
          }}
          showsVerticalScrollIndicator={true}
          bounces={true}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
        {/* Search Bar */}
        <View style={styles.sectionContainer}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.searchBarContainer, {
              backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }]}
          >
            <Ionicons name="search-outline" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, {
                color: theme.colors.text,
                fontSize: theme.fontSize.scaleSize(14),
              }]}
              placeholder="Search updates..."
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={styles.searchClearButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </BlurView>
        </View>

        {/* Events This Month Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionDivider}>
            <Text style={[styles.sectionDividerLabel, { fontSize: theme.fontSize.scaleSize(11) }]}>EVENTS THIS MONTH</Text>
          </View>

          {/* Event Type Legend (merged into Events section) */}
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.legendContainer, {
              backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }]}
          >
            <View style={styles.legendHeaderRow}>
              <Text style={[styles.eventCountText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>
                {currentMonthEvents.length} {currentMonthEvents.length === 1 ? 'event' : 'events'} this month
              </Text>
            </View>
            <View style={styles.legendItems}>
              {legendRows.map((rowItems, rowIndex) => (
                <View
                  key={`legend-row-${rowIndex}`}
                  style={[
                    styles.legendRow,
                    rowIndex === 0 ? styles.legendRowThree : styles.legendRowTwo,
                  ]}
                >
                  {rowItems.map((item, colIndex) => {
                    if (!item) {
                      return (
                        <View
                          key={`legend-placeholder-${rowIndex}-${colIndex}`}
                          style={[
                            styles.legendItem,
                            styles.legendItemThird,
                            styles.legendItemPlaceholder,
                          ]}
                        />
                      );
                    }
                    const isSelected = selectedLegendType === item.key;
                    return (
                      <TouchableOpacity
                        key={`${item.type}-${rowIndex}-${colIndex}`}
                        style={[
                          styles.legendItem,
                          styles.legendItemThird,
                          isSelected && styles.legendItemSelected,
                          isSelected && { 
                            backgroundColor: item.color + '20',
                            borderColor: item.color
                          }
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedLegendType(isSelected ? null : item.key);
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.type} event type - ${isSelected ? 'selected, tap to show all' : 'tap to filter'}`}
                      >
                        <View style={[
                          styles.legendColorDot,
                          { backgroundColor: item.color },
                          isSelected && styles.legendColorDotSelected
                        ]} />
                        <Text
                          style={[
                            styles.legendItemText,
                            { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(11) },
                            isSelected && { fontWeight: '700', color: item.color }
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </BlurView>
          {isLoadingCalendarEvents ? (
            <View style={[styles.eventsLoadingContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={[styles.eventsLoadingText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }]}>
                Loading events...
              </Text>
            </View>
          ) : currentMonthEvents.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 20, gap: 12, paddingLeft: 0 }}
              style={{ flexShrink: 0 }}
            >
              {currentMonthEvents.map((event) => {
                const tagLower = event.tag?.toLowerCase() || '';
                let accentColor = '#93C5FD';
                
                if (tagLower === 'institutional') {
                  accentColor = '#2563EB';
                } else if (tagLower === 'academic') {
                  accentColor = '#10B981';
                } else {
                  const colors = categoryToColors(event.tag);
                  accentColor = colors.dot || '#93C5FD';
                }
                
                // Find the full event object (calendar event or post)
                let fullEvent: any = null;
                if (event.source === 'calendar') {
                  // Calendar event
                  fullEvent = calendarEvents.find(e => 
                    e._id === event.id || 
                    `calendar-${e.isoDate}-${e.title}` === event.id
                  ) || null;
                } else if (event.source === 'post') {
                  // Post/Update - create event data format
                  fullEvent = {
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    category: event.tag,
                    type: event.tag,
                    date: event.isoDate || event.date,
                    isoDate: event.isoDate || event.date,
                    image: event.image,
                    images: event.images,
                  };
                }
                
                // Create a subtle background color based on accent color
                const cardBackgroundColor = isDarkMode 
                  ? accentColor + '08' // Very subtle in dark mode
                  : accentColor + '12'; // Slightly more visible in light mode
                
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.calendarEventCard, { 
                      backgroundColor: cardBackgroundColor, 
                      borderColor: accentColor + '30',
                      minWidth: 260,
                    }]}
                    activeOpacity={0.7}
                    delayPressIn={0}
                    onPress={() => {
                      if (fullEvent) {
                        if (event.source === 'calendar') {
                          // Calendar event
                          const eventDate = fullEvent.isoDate || fullEvent.date 
                            ? new Date(fullEvent.isoDate || fullEvent.date)
                            : new Date();
                          openEventDrawer(fullEvent, eventDate);
                        } else if (event.source === 'post') {
                          // Post/Update - use ViewEventModal format
                          setSelectedEvent(fullEvent);
                          setSelectedDateEvents([fullEvent]);
                          setShowEventDrawer(true);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }
                    }}
                  >
                    <View style={[styles.calendarEventAccent, { backgroundColor: accentColor }]} collapsable={false} />
                    <View style={styles.calendarEventContent} collapsable={false}>
                      <View style={styles.calendarEventHeader}>
                        <View style={[styles.calendarEventIconWrapper, { backgroundColor: accentColor + '20' }]}>
                          <Ionicons 
                            name={event.source === 'post' ? 'document-text' : 'calendar'} 
                            size={16} 
                            color={accentColor} 
                          />
                        </View>
                        <Text style={[styles.calendarEventTag, { color: accentColor, fontSize: theme.fontSize.scaleSize(9) }]}>{event.tag}</Text>
                      </View>
                      <Text style={[styles.calendarEventTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]} numberOfLines={2}>
                        {event.title}
                      </Text>
                      <View style={styles.calendarEventDateRow}>
                        <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                        <Text style={[styles.calendarEventDate, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(10) }]}>
                          {event.date}
                        </Text>
                      </View>
                      {event.description && (
                        <Text style={[styles.calendarEventDescription, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(10) }]} numberOfLines={2}>
                          {event.description}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={[styles.emptyEventsContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="calendar-outline" size={24} color={theme.colors.textMuted} />
              <Text style={[styles.emptyEventsText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }]}>
                No events match your filters this month
              </Text>
            </View>
          )}
        </View>

        {/* Updates Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionDivider}>
              <Text style={[styles.sectionDividerLabel, { fontSize: theme.fontSize.scaleSize(11) }]}>UPDATES</Text>
          </View>
          
          {/* Time Filter Pills */}
          <View style={[styles.filtersContainer, { flexShrink: 0, marginBottom: 12 }]} collapsable={false}>
            <Pressable
              style={[
                styles.filterPill, 
                { borderColor: theme.colors.border }, 
                timeFilter === 'all' && {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.accent,
                  shadowColor: theme.colors.accent,
                }
              ]}
              onPress={() => setTimeFilter('all')}
            >
              <Text style={[styles.filterPillText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }, timeFilter === 'all' && { color: '#FFF' }]}>All</Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterPill, 
                { borderColor: theme.colors.border }, 
                timeFilter === 'thismonth' && {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.accent,
                  shadowColor: theme.colors.accent,
                }
              ]}
              onPress={() => setTimeFilter('thismonth')}
            >
              <Text style={[styles.filterPillText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }, timeFilter === 'thismonth' && { color: '#FFF' }]}>This month</Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterPill, 
                { borderColor: theme.colors.border }, 
                timeFilter === 'recent' && {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.accent,
                  shadowColor: theme.colors.accent,
                }
              ]}
              onPress={() => setTimeFilter('recent')}
            >
              <Text style={[styles.filterPillText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }, timeFilter === 'recent' && { color: '#FFF' }]}>Recent</Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterPill, 
                { borderColor: theme.colors.border }, 
                timeFilter === 'upcoming' && {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.accent,
                  shadowColor: theme.colors.accent,
                }
              ]}
              onPress={() => setTimeFilter('upcoming')}
            >
              <Text style={[styles.filterPillText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }, timeFilter === 'upcoming' && { color: '#FFF' }]}>Upcoming</Text>
            </Pressable>
          </View>
          
          {/* Updates Cards Section - Direct display without container */}
          <View style={styles.updatesCardsContainer}>
            {dashboardError && (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
                <Text style={{ marginTop: 6, fontSize: theme.fontSize.scaleSize(12), color: '#DC2626', fontWeight: '600' }}>{dashboardError}</Text>
              </View>
            )}

            {isLoadingDashboard && (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="hourglass-outline" size={40} color={theme.colors.textMuted} />
                <Text style={{ marginTop: 6, fontSize: theme.fontSize.scaleSize(12), color: theme.colors.textMuted, fontWeight: '600' }}>Loading dashboard...</Text>
              </View>
            )}

            {!isLoadingDashboard && !dashboardError && displayedUpdates.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="document-text-outline" size={40} color={theme.colors.textMuted} />
                <Text style={{ marginTop: 6, fontSize: theme.fontSize.scaleSize(12), color: theme.colors.textMuted, fontWeight: '600' }}>
                  {timeFilter === 'upcoming' ? 'No upcoming updates' : timeFilter === 'recent' ? 'No recent updates found' : timeFilter === 'thismonth' ? 'No updates this month' : 'No updates found'}
                </Text>
              </View>
            )}

            {!isLoadingDashboard && !dashboardError && displayedUpdates.map((update) => {
              // Get color for accent bar based on category (institutional/academic)
              const tagLower = update.tag?.toLowerCase() || '';
              let accentColor = '#93C5FD'; // Default blue
              
              if (tagLower === 'institutional') {
                accentColor = '#2563EB'; // Blue for Institutional
              } else if (tagLower === 'academic') {
                accentColor = '#10B981'; // Green for Academic
              } else {
                // For other categories (event, announcement, etc.), use categoryToColors
                const colors = categoryToColors(update.tag);
                accentColor = colors.dot || '#93C5FD';
              }
              
              return (
                <TouchableOpacity
                  key={update.id}
                  style={[styles.updateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  activeOpacity={0.7}
                  delayPressIn={0}
                  onPress={() => {
                    // Check if it's a calendar event (has _id) or a post
                    if (update.source === 'calendar' && update._id) {
                      // Calendar event - find the full event object
                      const fullEvent = calendarEvents.find(e => 
                        e._id === update._id || 
                        e._id === update.id ||
                        `calendar-${e.isoDate}-${e.title}` === update.id
                      );
                      if (fullEvent) {
                        const eventDate = fullEvent.isoDate || fullEvent.date 
                          ? new Date(fullEvent.isoDate || fullEvent.date)
                          : new Date();
                        openEventDrawer(fullEvent, eventDate);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        return;
                      }
                    }
                    
                    // Post/Update - convert to Event format for ViewEventModal
                    const eventData: any = {
                      id: update.id,
                      title: update.title,
                      description: update.description,
                      category: update.tag,
                      type: update.tag,
                      date: update.isoDate || update.date,
                      isoDate: update.isoDate || update.date,
                      image: update.image,
                      images: update.images,
                    };
                    console.log('📅 Event data for ViewEventModal:', { 
                      title: eventData.title, 
                      time: eventData.time, 
                      updateTime: (update as any).time,
                      hasTime: !!(update as any).time 
                    });
                    setSelectedEvent(eventData);
                    setSelectedDateEvents([eventData]);
                    setShowEventDrawer(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={[styles.updateAccent, { backgroundColor: accentColor }]} collapsable={false} />
                  <View style={styles.updateContent} collapsable={false}>
                    {(update.images?.[0] || update.image) && (
                      <Image 
                        source={{ uri: update.images?.[0] || update.image || '' }} 
                        style={styles.updateImage}
                        resizeMode="cover"
                        onError={(error) => {
                          console.error('Image load error:', error.nativeEvent.error);
                          console.log('Failed image URL:', update.images?.[0] || update.image);
                        }}
                      />
                    )}
                    <View style={styles.updateTextContent}>
                      <View style={styles.updateTitleRow}>
                        <Text style={[styles.updateTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]} numberOfLines={2}>{update.title}</Text>
                        <View style={[styles.updateCategoryBadge, { backgroundColor: accentColor + '20' }]}>
                          <Text style={[styles.updateCategoryText, { color: accentColor, fontSize: theme.fontSize.scaleSize(10) }]}>{update.tag}</Text>
                        </View>
                      </View>
                      <Text style={[styles.updateSubtitle, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>
                        {update.date}
                      </Text>
                      {update.description && (
                        <Text style={[styles.updateDescription, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(10) }]} numberOfLines={2}>
                          {update.description}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        </ScrollView>
      </View>

      {/* Floating Plus Icon Button - Bottom Right */}
      <TouchableOpacity
        style={[styles.floatingAddButton, {
          bottom: safeInsets.bottom + 80, // Above nav bar
        }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          navigation.navigate('PostUpdate');
        }}
        activeOpacity={0.8}
      >
        <View style={[styles.floatingAddButtonIcon, { backgroundColor: theme.colors.accent }]}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* Bottom Navigation Bar - Fixed position */}
      <View style={[styles.bottomNavContainer, {
        bottom: 0,
        paddingBottom: safeInsets.bottom,
      }]} collapsable={false}>
        <AdminBottomNavBar
          activeTab="dashboard"
          onChatPress={() => navigation.navigate('AdminAIChat')}
          onDashboardPress={() => navigation.navigate('AdminDashboard')}
          onCalendarPress={() => navigation.navigate('AdminCalendar')}
        />
      </View>

      {/* AddPostDrawer removed - using PostUpdate screen navigation instead */}

      {/* View Event Modal - Used for both calendar events and updates */}
      <ViewEventModal
        visible={showEventDrawer}
        onClose={closeEventDrawer}
        selectedEvent={selectedEvent}
        selectedDateEvents={selectedDateEvents}
        onEdit={() => {
          // Check if it's a calendar event (has _id) or an update/post
          const event = selectedEvent as any;
          if (event?._id) {
            // Calendar event - show alert for now
            Alert.alert('Edit Event', 'Event editing functionality coming soon');
          } else if (event?.id) {
            // Update/Post - navigate to PostUpdate screen for editing
            closeEventDrawer();
            navigation.navigate('PostUpdate', { postId: event.id });
          }
        }}
        onDelete={async () => {
          if (!selectedEvent) return;
          
          // Check if it's a calendar event (has _id) or an update/post
          const event = selectedEvent as any;
          if (event._id) {
            // Calendar event deletion - still use Alert for calendar events
            Alert.alert(
              'Delete Event',
              `Are you sure you want to delete "${selectedEvent.title}"?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setIsDeleting(true);
                      await CalendarService.deleteEvent(event._id || '');
                      await refreshCalendarEvents(true);
                      closeEventDrawer();
                      setSelectedEvent(null);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (error) {
                      Alert.alert('Error', 'Failed to delete event');
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    } finally {
                      setIsDeleting(false);
                    }
                  },
                },
              ]
            );
          } else if (event.id) {
            // Post/Update deletion - modal handles confirmation, just execute deletion
            try {
              setIsDeleting(true);
              await AdminDataService.deletePost(event.id);
              // Refresh dashboard data after deletion
              await fetchDashboardData(true);
              closeEventDrawer();
              setSelectedEvent(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete post');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setIsDeleting(false);
            }
          }
        }}
      />

      {/* Notification Modal */}
      <NotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  floatingBgContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: 'hidden',
  },
  floatingOrbWrapper: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    overflow: 'hidden',
  },
  floatingOrb1: {
    width: 500,
    height: 500,
    borderRadius: 250,
    overflow: 'hidden',
  },
  blueHeader: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    zIndex: 10,
    position: 'relative',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  bodyCurveContainer: {
    height: 20,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    zIndex: 9,
    overflow: 'hidden',
  },
  bodyCurve: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    overflow: 'hidden',
  },
  bodyCurvePath: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    position: 'relative',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerLeft: {
    width: 40,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customHamburger: {
    width: 24,
    height: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hamburgerLine: {
    height: 2.5,
    borderRadius: 2,
  },
  hamburgerLineShort: {
    width: 18,
  },
  hamburgerLineLong: {
    width: 24,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profileIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  contentWrapper: {
    flex: 1,
    zIndex: 1,
    width: '100%',
    position: 'relative',
    marginTop: -20,
    paddingTop: 20,
  },
  blueGradientBackground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  content: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  bodyCurveBottomContainer: {
    height: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  bodyCurveBottom: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    height: 20,
    overflow: 'hidden',
  },
  bodyCurveBottomPath: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  sectionContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  sectionDividerLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#6B7280',
    opacity: 0.8,
  },
  updatesCardsContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 998,
  },
  headerStatueImage: {
    position: 'absolute',
    top: -30,
    left: -50,
    right: -10,
    bottom: -100,
    width: '130%',
    height: '320%',
    opacity: 0.35,
    zIndex: 0,
    pointerEvents: 'none',
  },
  welcomeSectionInHeader: {
    marginTop: 8,
    position: 'relative',
    zIndex: 1,
  },
  welcomeSection: {
    marginBottom: 20,
    flexShrink: 0,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeGreetingInHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#FFF',
    opacity: 0.9,
  },
  welcomeTitleInHeader: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
    color: '#FFF',
  },
  welcomeSubtitleInHeader: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFF',
    opacity: 0.9,
  },
  welcomeGreeting: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.8,
  },
  welcomeProfileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  welcomeProfileIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeProfileInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: 'transparent', // Will be set dynamically via theme
    letterSpacing: -0.3,
  },
  floatingAddButton: {
    position: 'absolute',
    right: 20,
    zIndex: 999,
  },
  floatingAddButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statCardContent: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
  },
  recentUpdatesSection: {
    borderWidth: 0,
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  updatesSectionBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    flex: 1,
  },
  updatesSectionContent: {
    padding: 16,
    borderRadius: 20,
    flex: 1,
  },
  sectionHeaderEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 14,
    flexShrink: 0,
  },
  sectionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent', // Will be set dynamically via theme
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitleWrapper: {
    flex: 1,
  },
  sectionTitleEnhanced: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.7,
  },
  updateCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  updateAccent: {
    width: 3,
    borderRadius: 0,
  },
  updateContent: {
    flex: 1,
    flexDirection: 'column',
    padding: 0,
    backgroundColor: 'transparent',
  },
  updateImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
    borderTopRightRadius: 12,
  },
  updateTextContent: {
    flex: 1,
    padding: 10,
  },
  updateTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  updateTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: -0.2,
    flex: 1,
  },
  updateCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  updateCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  updateSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
    opacity: 0.8,
  },
  updateDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  updateDate: {
    fontSize: 10,
    fontWeight: '600',
  },
  updateDescription: {
    fontSize: 10,
    marginBottom: 6,
    lineHeight: 14,
    opacity: 0.8,
  },
  updateTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  updateTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: 'transparent', // Will be set dynamically via theme
    borderColor: 'transparent', // Will be set dynamically via theme
    shadowColor: 'transparent', // Will be set dynamically via theme
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#FFF',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    minHeight: 52,
    width: '100%',
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 14,
  },
  searchClearButton: {
    padding: 4,
    marginLeft: 8,
  },
  calendarEventCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    borderWidth: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  calendarEventAccent: {
    width: 3,
    borderRadius: 0,
  },
  calendarEventContent: {
    flex: 1,
    padding: 10,
  },
  calendarEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  calendarEventIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarEventTag: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  calendarEventTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  calendarEventDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  calendarEventDate: {
    fontSize: 10,
    fontWeight: '600',
  },
  calendarEventDescription: {
    fontSize: 10,
    lineHeight: 14,
    opacity: 0.8,
  },
  calendarEventImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  emptyEventsContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyEventsText: {
    fontWeight: '600',
  },
  eventsLoadingContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventsLoadingText: {
    fontWeight: '600',
  },
  legendContainer: {
    gap: 8,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  legendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'column',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  legendRowThree: {
    justifyContent: 'space-between',
  },
  legendRowTwo: {
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 0,
  },
  legendItemThird: {
    flex: 1,
  },
  legendItemPlaceholder: {
    opacity: 0,
  },
  legendItemSelected: {
    borderWidth: 1,
  },
  legendColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendColorDotSelected: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  legendItemText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
  },
  eventCountText: {
    fontSize: 11,
    fontWeight: '500',
    fontStyle: 'italic',
    opacity: 0.7,
  },
});

export default AdminDashboard;