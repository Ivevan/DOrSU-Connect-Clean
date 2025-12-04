import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import AddPostDrawer from '../../components/dashboard/AddPostDrawer'; // Replaced with PostUpdate screen navigation
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import AdminSidebar from '../../components/navigation/AdminSidebar';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useUpdates } from '../../contexts/UpdatesContext';
import NotificationModal from '../../modals/NotificationModal';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import NotificationService from '../../services/NotificationService';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import { categoryToColors, formatDateKey, parseAnyDateToKey } from '../../utils/calendarUtils';
import { formatDate } from '../../utils/dateUtils';

// Session-scoped flags to avoid re-loading on every mount (especially on web)
// Initial data will load once per app session; further loads are manual (pull-to-refresh)
let hasLoadedAdminDashboardOnce = false;
let hasPrefetchedAdminDashboardCalendarWide = false;

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

// Helper function to safely format dates (using same logic as AdminCalendar)
const formatDateSafe = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return 'No date';
  
  try {
    // Use formatDate from dateUtils for consistent formatting (e.g., "Sep 12, 2025")
    const formatted = formatDate(dateStr);
    return formatted || 'No date';
  } catch {
    return 'No date';
  }
};

type LegendItem = {
  type: string;
  key: string;
  color: string;
};

const legendItemsData: LegendItem[] = [
  { type: 'Academic', key: 'academic', color: '#2563EB' }, // Blue
  { type: 'Institutional', key: 'institutional', color: '#4B5563' }, // Dark Gray
  { type: 'Announcement', key: 'announcement', color: '#EAB308' }, // Yellow
  { type: 'Event', key: 'event', color: '#10B981' }, // Green
  { type: 'News', key: 'news', color: '#EF4444' }, // Red
];

const timeFilterOptions = [
  { key: 'thismonth' as const, label: 'This Month' },
  { key: 'lastmonth' as const, label: 'Last Month' },
  { key: 'upcomingmonth' as const, label: 'Upcoming Month' },
];

const AdminDashboard = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  const resolvedLegendItems = useMemo<LegendItem[]>(() => legendItemsData, []);
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
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcomingmonth' | 'lastmonth' | 'thismonth'>('thismonth');
  const [showTimeFilterDropdown, setShowTimeFilterDropdown] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    recentUpdates: [] as DashboardUpdate[],
  });
  const { posts, setPosts, calendarEvents, setCalendarEvents } = useUpdates();
  // Initialize loading state based on whether shared data already exists
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(() => posts.length === 0);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [allUpdates, setAllUpdates] = useState<DashboardUpdate[]>([]);
  // Initialize loading state based on whether shared data already exists
  const [isLoadingCalendarEvents, setIsLoadingCalendarEvents] = useState(() => calendarEvents.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  
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


  // Pre-filter updates by search query (matching SchoolUpdates.tsx approach exactly)
  const filtered = useMemo(() => {
    const result = allUpdates.filter(u => {
      const q = searchQuery.trim().toLowerCase();
      if (q.length === 0) return true;
      
      // Search in title, description, and tag
      const titleMatch = u.title?.toLowerCase().includes(q) || false;
      const descriptionMatch = u.description?.toLowerCase().includes(q) || false;
      const tagMatch = u.tag?.toLowerCase().includes(q) || false;
      
      return titleMatch || descriptionMatch || tagMatch;
    });
    if (__DEV__) {
      console.log('🔍 Filtered updates:', { 
        total: allUpdates.length, 
        query: searchQuery.trim(), 
        filtered: result.length,
        sampleUpdate: allUpdates.length > 0 ? {
          id: allUpdates[0].id,
          title: allUpdates[0].title,
          isoDate: allUpdates[0].isoDate,
          hasDescription: !!allUpdates[0].description
        } : null
      });
    }
    return result;
  }, [allUpdates, searchQuery]);

  // Filtered updates based on selected time filter, content type, and search query
  // Includes both posts and calendar events
  // Uses the same date processing logic as AdminCalendar (matching SchoolUpdates.tsx)
  const displayedUpdates = useMemo(() => {
    const now = new Date();
    
    // Use same approach as AdminCalendar: Date object's native methods
    // AdminCalendar uses dateObj.getFullYear() and dateObj.getMonth() directly
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11 (0 = January, 11 = December)
    
    // Calculate last month (previous month)
    // If current month is January (0), last month is December of previous year
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    // Calculate next month (upcoming month)
    // If current month is December (11), next month is January of next year
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    
    // Start with posts based on time filter (same approach as AdminCalendar, matching SchoolUpdates.tsx)
    let result;
    if (timeFilter === 'upcomingmonth') {
      // Filter by next month only - strictly exclude current month
      result = filtered.filter(u => {
        if (!u.isoDate) return false;
        // Same as AdminCalendar: create Date object directly from isoDate
        const dateObj = new Date(u.isoDate);
        if (Number.isNaN(dateObj.getTime())) return false;
        
        const eventYear = dateObj.getFullYear();
        const eventMonth = dateObj.getMonth(); // 0-indexed
        
        // Strict comparison: must match next month exactly
        const matches = eventYear === nextMonthYear && eventMonth === nextMonth;
        // Also ensure it's NOT current month
        const notCurrentMonth = !(eventYear === currentYear && eventMonth === currentMonth);
        return matches && notCurrentMonth;
      });
    } else if (timeFilter === 'lastmonth') {
      // Filter by last month only - strictly exclude current month
      result = filtered.filter(u => {
        if (!u.isoDate) return false;
        // Same as AdminCalendar: create Date object directly from isoDate
        const dateObj = new Date(u.isoDate);
        if (Number.isNaN(dateObj.getTime())) return false;
        
        const eventYear = dateObj.getFullYear();
        const eventMonth = dateObj.getMonth(); // 0-indexed
        
        // Strict comparison: must match last month exactly
        const matches = eventYear === lastMonthYear && eventMonth === lastMonth;
        // Also ensure it's NOT current month
        const notCurrentMonth = !(eventYear === currentYear && eventMonth === currentMonth);
        return matches && notCurrentMonth;
      });
    } else if (timeFilter === 'thismonth') {
      // Filter by current month only
      result = filtered.filter(u => {
        if (!u.isoDate) return false;
        // Same as AdminCalendar: create Date object directly from isoDate
        const dateObj = new Date(u.isoDate);
        if (Number.isNaN(dateObj.getTime())) return false;
        
        const eventYear = dateObj.getFullYear();
        const eventMonth = dateObj.getMonth(); // 0-indexed
        return eventYear === currentYear && eventMonth === currentMonth;
      });
    } else {
      result = [...filtered]; // 'all'
    }
    
    // Add calendar events based on time filter (same approach as AdminCalendar)
    // Handle month-only, week-only, date ranges, and single date events
    const calendarEventsForUpdates = calendarEvents
      .filter(event => {
        // Handle month-only and week-only events (same as AdminCalendar lines 406-411)
        const dateType = String(event.dateType || '');
        if (dateType === 'month_only' || dateType === 'week_in_month' || 
            dateType === 'week' || dateType === 'month') {
          if (event.year && event.month) {
            // event.month is 1-indexed (1 = January, 12 = December) in AdminCalendar
            // Convert to 0-indexed for comparison
            const eventMonth0Indexed = event.month - 1;
            
            if (timeFilter === 'upcomingmonth') {
              return event.year === nextMonthYear && eventMonth0Indexed === nextMonth;
            } else if (timeFilter === 'lastmonth') {
              return event.year === lastMonthYear && eventMonth0Indexed === lastMonth;
            } else if (timeFilter === 'thismonth') {
              return event.year === currentYear && eventMonth0Indexed === currentMonth;
            } else {
              return true; // 'all' - include all
            }
          }
          return false;
        }
        
        // For date range events, check if the range overlaps with the target month
        // Same approach as AdminCalendar: use Date objects directly
        if (dateType === 'date_range' && event.startDate && event.endDate) {
          const start = new Date(event.startDate);
          const end = new Date(event.endDate);
          
          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
          
          const startYear = start.getFullYear();
          const startMonth = start.getMonth();
          const endYear = end.getFullYear();
          const endMonth = end.getMonth();
          
          // Check if the range overlaps with the target month
          if (timeFilter === 'upcomingmonth') {
            // Check if range overlaps with next month (and not only current month)
            const rangeStart = new Date(startYear, startMonth, 1).getTime();
            const rangeEnd = new Date(endYear, endMonth + 1, 0, 23, 59, 59).getTime();
            const targetStart = new Date(nextMonthYear, nextMonth, 1).getTime();
            const targetEnd = new Date(nextMonthYear, nextMonth + 1, 0, 23, 59, 59).getTime();
            const currentStart = new Date(currentYear, currentMonth, 1).getTime();
            const currentEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();
            
            // Must overlap with next month
            const overlapsTarget = !(rangeEnd < targetStart || rangeStart > targetEnd);
            // Must NOT be entirely within current month
            const notOnlyCurrentMonth = !(rangeStart >= currentStart && rangeEnd <= currentEnd);
            return overlapsTarget && notOnlyCurrentMonth;
          } else if (timeFilter === 'lastmonth') {
            // Check if range overlaps with last month (and not only current month)
            const rangeStart = new Date(startYear, startMonth, 1).getTime();
            const rangeEnd = new Date(endYear, endMonth + 1, 0, 23, 59, 59).getTime();
            const targetStart = new Date(lastMonthYear, lastMonth, 1).getTime();
            const targetEnd = new Date(lastMonthYear, lastMonth + 1, 0, 23, 59, 59).getTime();
            const currentStart = new Date(currentYear, currentMonth, 1).getTime();
            const currentEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();
            
            // Must overlap with last month
            const overlapsTarget = !(rangeEnd < targetStart || rangeStart > targetEnd);
            // Must NOT be entirely within current month
            const notOnlyCurrentMonth = !(rangeStart >= currentStart && rangeEnd <= currentEnd);
            return overlapsTarget && notOnlyCurrentMonth;
          } else if (timeFilter === 'thismonth') {
            // Check if range overlaps with current month
            const rangeStart = new Date(startYear, startMonth, 1).getTime();
            const rangeEnd = new Date(endYear, endMonth + 1, 0, 23, 59, 59).getTime();
            const targetStart = new Date(currentYear, currentMonth, 1).getTime();
            const targetEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();
            return !(rangeEnd < targetStart || rangeStart > targetEnd);
          } else {
            return true; // 'all' - include all
          }
        }
        
        // For single date events, use the event date (same as AdminCalendar)
        const fallbackDate = event.isoDate || event.date || event.startDate;
        if (!fallbackDate) return false;
        
        // Same as AdminCalendar: create Date object directly
        const dateObj = new Date(fallbackDate);
        if (Number.isNaN(dateObj.getTime())) return false;
        
        const eventYear = dateObj.getFullYear();
        const eventMonth = dateObj.getMonth(); // 0-indexed
        
        // Apply time filter
        if (timeFilter === 'upcomingmonth') {
          // Must match next month exactly and NOT be current month
          const matches = eventYear === nextMonthYear && eventMonth === nextMonth;
          const notCurrentMonth = !(eventYear === currentYear && eventMonth === currentMonth);
          return matches && notCurrentMonth;
        } else if (timeFilter === 'lastmonth') {
          // Must match last month exactly and NOT be current month
          const matches = eventYear === lastMonthYear && eventMonth === lastMonth;
          const notCurrentMonth = !(eventYear === currentYear && eventMonth === currentMonth);
          return matches && notCurrentMonth;
        } else if (timeFilter === 'thismonth') {
          // Must match current month exactly
          return eventYear === currentYear && eventMonth === currentMonth;
        } else {
          // 'all' - include all calendar events
          return true;
        }
      })
      .map(event => ({
        id: event._id || `calendar-${event.isoDate}-${event.title}`,
        title: event.title,
        date: formatDate(event.isoDate || event.date) || 'No date',
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
    
    // Apply search filter (matching SchoolUpdates.tsx - though filtered already has search applied, this ensures consistency)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(update => {
        const title = (update.title || '').toLowerCase();
        const description = (update.description || '').toLowerCase();
        const tag = (update.tag || '').toLowerCase();
        return title.includes(query) || description.includes(query) || tag.includes(query);
      });
    }
    
    // Sort by date (ascending - earliest first) - matching SchoolUpdates.tsx
    result.sort((a, b) => {
      if (!a.isoDate && !b.isoDate) return 0;
      if (!a.isoDate) return 1; // Posts without dates go to end
      if (!b.isoDate) return -1; // Posts without dates go to end
      try {
        const dateA = new Date(a.isoDate).getTime();
        const dateB = new Date(b.isoDate).getTime();
        if (isNaN(dateA) || isNaN(dateB)) return 0;
        return dateA - dateB; // Ascending - earliest first
      } catch {
        return 0;
      }
    });
    
    return result;
  }, [timeFilter, selectedContentTypes, searchQuery, filtered, calendarEvents]);

  // Calculate counts per legend type based on displayedUpdates (respects time filter)
  const legendTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    legendItemsData.forEach(item => {
      counts[item.key] = displayedUpdates.filter(update => {
        const updateType = String(update.tag || 'Announcement').toLowerCase();
        return updateType === item.key.toLowerCase();
      }).length;
    });
    return counts;
  }, [displayedUpdates]);


  // Load current user and subscribe to auth changes
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    const unsubscribe = onAuthStateChange((u) => setCurrentUser(u));
    return () => unsubscribe();
  }, []);

  // Load backend user data immediately on mount for fast display
  useEffect(() => {
    let cancelled = false;
    const loadBackendUserData = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        // Load photo first for immediate display, then other data in parallel
        const [userPhoto, firstName, lastName] = await Promise.all([
          AsyncStorage.getItem('userPhoto'),
          AsyncStorage.getItem('userFirstName'),
          AsyncStorage.getItem('userLastName'),
        ]);
        if (!cancelled) {
          setBackendUserPhoto(userPhoto);
          setBackendUserFirstName(firstName);
          setBackendUserLastName(lastName);
        }
      } catch (error) {
        if (!cancelled && __DEV__) {
          console.error('Failed to load backend user data:', error);
        }
      }
    };
    // Load immediately on mount
    loadBackendUserData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Also refresh on focus to catch updates
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
          // Silent fail on focus refresh
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
      
      // Fetch from API - Load current month ± 2 months to support filtering by last month and next month
      // This matches the pattern used in SchoolUpdates.tsx and Calendar.tsx
      // Load current month ± 2 months for buffer (so filtering by last/next month works)
      const startDate = new Date(currentYear, currentMonth - 2, 1);
      const endDate = new Date(currentYear, currentMonth + 3, 0, 23, 59, 59); // Last day of month + 2
      
      if (__DEV__) {
        console.log(`📅 Loading calendar events: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (5 months buffer)`);
      }
      
      // Use caching - CalendarService now supports caching
      const events = await CalendarService.getEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 1000,
      });
      
      if (__DEV__) {
        console.log(`✅ Loaded ${events.length} calendar events for filtering`);
      }
      
      setCalendarEvents(Array.isArray(events) ? events : []);
    } catch (error) {
      if (__DEV__) console.error('Failed to load calendar events:', error);
      setCalendarEvents([]);
    } finally {
      setIsLoadingCalendarEvents(false);
      isFetchingCalendar.current = false;
    }
  }, []);

  // Note: Calendar events are loaded once per session via the main useEffect above
  // Further calendar event sync is handled via pull-to-refresh
  
  
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
      const rawPosts = await AdminDataService.getPosts();
        const postsData = rawPosts.map(post => {
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
          
          // Use same date handling as PostUpdate.tsx - PostUpdate sends both date and isoDate as ISO strings
          // Backend returns: date: post.date || post.isoDate || new Date().toISOString()
          // Both should be ISO strings, prioritize isoDate (same as calendar events)
          const dateValue = post.isoDate || post.date;
          
          // Handle empty strings and invalid dates - formatDate handles ISO strings correctly
          let formattedDate = 'No date';
          if (dateValue && typeof dateValue === 'string' && dateValue.trim() !== '') {
            const formatted = formatDate(dateValue);
            if (formatted && formatted.trim() !== '') {
              formattedDate = formatted;
            } else {
              // formatDate returned empty string - date might be invalid
              if (__DEV__) {
                console.warn('⚠️ Post has invalid date format:', { 
                  id: post.id, 
                  title: post.title,
                  dateValue,
                  date: post.date,
                  isoDate: post.isoDate
                });
              }
            }
          } else if (!dateValue) {
            // No date field at all
            if (__DEV__) {
              console.warn('⚠️ Post missing date field:', { 
                id: post.id, 
                title: post.title,
                hasDate: !!post.date,
                hasIsoDate: !!post.isoDate
              });
            }
          }
          
          return {
            id: post.id,
            title: post.title,
            date: formattedDate,
            tag: post.category,
            description: post.description,
            image: post.image,
            images: images,
            pinned: (post as any).pinned || false,
            isoDate: dateValue || '',
            time: (post as any).time || '',
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
        // Also update shared posts context so other screens (SchoolUpdates/Calendar/admin)
        // see the same processed posts without refetching.
        setPosts(uniqueUpdates as any[]);
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

  // Sync allUpdates when posts change (from context or after fetch)
  useEffect(() => {
    if (posts.length > 0) {
      setIsLoadingDashboard(false);
      // Process existing posts into allUpdates format
      const postsData = posts.map((post: any) => {
        let images = post.images;
        if (!images || !Array.isArray(images) || images.length === 0) {
          if (post.image) {
            images = [post.image];
          } else {
            images = [];
          }
        }
        
        const dateValue = post.isoDate || post.date;
        let formattedDate = 'No date';
        if (dateValue && typeof dateValue === 'string' && dateValue.trim() !== '') {
          const formatted = formatDate(dateValue);
          if (formatted && formatted.trim() !== '') {
            formattedDate = formatted;
          }
        }
        
        return {
          id: post.id,
          title: post.title,
          date: formattedDate,
          tag: post.category,
          description: post.description,
          image: post.image,
          images: images,
          pinned: (post as any).pinned || false,
          isoDate: dateValue || '',
          time: (post as any).time || '',
        };
      });
      
      const uniqueUpdates = postsData.filter((update, index, self) =>
        index === self.findIndex(u => u.id === update.id)
      );
      
      uniqueUpdates.sort((a, b) => {
        const dateA = new Date(a.isoDate || a.date).getTime();
        const dateB = new Date(b.isoDate || b.date).getTime();
        return dateB - dateA;
      });
      
      setAllUpdates(uniqueUpdates);
    }
  }, [posts]);

  // Sync calendar events loading state when context data changes
  useEffect(() => {
    if (calendarEvents.length > 0) {
      setIsLoadingCalendarEvents(false);
    }
  }, [calendarEvents]);

  // Fetch dashboard data and calendar events once per app session (no re-load on screen switch)
  useEffect(() => {
    if (hasLoadedAdminDashboardOnce) {
      // If we've already loaded once this session, just ensure loading flags reflect existing shared data
      if (posts.length > 0) {
        setIsLoadingDashboard(false);
      }
      if (calendarEvents.length > 0) {
        setIsLoadingCalendarEvents(false);
      }
      return;
    }
    hasLoadedAdminDashboardOnce = true;
    fetchDashboardData(true);
    refreshCalendarEvents(true);
    
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once per session - fetchDashboardData and refreshCalendarEvents are stable

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Refresh both dashboard data and calendar events
      await Promise.all([
        fetchDashboardData(true),
        refreshCalendarEvents(true),
      ]);
    } catch (error) {
      if (__DEV__) console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchDashboardData, refreshCalendarEvents]);

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
                resizeMode="cover"
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
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

        {/* Updates Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionDivider}>
              <Text style={[styles.sectionDividerLabel, { fontSize: theme.fontSize.scaleSize(11) }]}>
                {searchQuery.trim().length > 0 ? 'SEARCH RESULTS' : 'UPDATES'}
              </Text>
          </View>
          
          {/* Event Type Legend - Hide when searching */}
          {searchQuery.trim().length === 0 && (
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
                {displayedUpdates.length} {displayedUpdates.length === 1 ? 'update' : 'updates'}
                {` (${timeFilterOptions.find(opt => opt.key === timeFilter)?.label || ''})`}
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
                          {item.type} ({legendTypeCounts[item.key] || 0})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </BlurView>
          )}
          
          {/* Time Filter Dropdown - Hide when searching */}
          {searchQuery.trim().length === 0 && (
          <View style={[styles.filterDropdownContainer, { marginBottom: 12 }]}>
            <TouchableOpacity
              style={[styles.filterDropdownButton, {
                backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
              }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowTimeFilterDropdown(!showTimeFilterDropdown);
              }}
              activeOpacity={0.7}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 50 : 40}
                tint={isDarkMode ? 'dark' : 'light'}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={[styles.filterDropdownButtonText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}>
                {timeFilterOptions.find(opt => opt.key === timeFilter)?.label || 'All'}
              </Text>
              <Ionicons 
                name={showTimeFilterDropdown ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={theme.colors.textMuted} 
              />
            </TouchableOpacity>

            {/* Dropdown Modal */}
            <Modal
              visible={showTimeFilterDropdown}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowTimeFilterDropdown(false)}
            >
              <TouchableOpacity
                style={styles.dropdownOverlay}
                activeOpacity={1}
                onPress={() => setShowTimeFilterDropdown(false)}
              >
                <View style={styles.dropdownContentWrapper}>
                  <BlurView
                    intensity={Platform.OS === 'ios' ? 80 : 60}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.dropdownContent, {
                      backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    }]}
                  >
                    {timeFilterOptions.map((option, index) => {
                      const isSelected = timeFilter === option.key;
                      const isLast = index === timeFilterOptions.length - 1;
                      return (
                        <TouchableOpacity
                          key={option.key}
                          style={[
                            styles.dropdownItem,
                            isLast && { borderBottomWidth: 0 },
                            isSelected && {
                              backgroundColor: theme.colors.accent + '20',
                            }
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setTimeFilter(option.key);
                            setShowTimeFilterDropdown(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) },
                            isSelected && { color: theme.colors.accent, fontWeight: '700' }
                          ]}>
                            {option.label}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark" size={20} color={theme.colors.accent} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </BlurView>
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
          )}
          
          {/* Search Results Count - Show when searching */}
          {searchQuery.trim().length > 0 && (
            <View style={styles.searchResultsHeader}>
              <Text style={[styles.searchResultsCount, { 
                color: theme.colors.textMuted, 
                fontSize: theme.fontSize.scaleSize(12) 
              }]}>
                {displayedUpdates.length} {displayedUpdates.length === 1 ? 'result' : 'results'} found for "{searchQuery}"
              </Text>
            </View>
          )}
          
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
                  {searchQuery.trim().length > 0 
                    ? `No results found for "${searchQuery}"`
                    : timeFilter === 'upcomingmonth' 
                      ? 'No updates for upcoming month' 
                      : timeFilter === 'lastmonth' 
                        ? 'No updates for last month' 
                        : timeFilter === 'thismonth' 
                          ? 'No updates this month' 
                          : 'No updates found'}
                </Text>
              </View>
            )}

            {!isLoadingDashboard && !dashboardError && displayedUpdates.map((update) => {
              // Get color for accent bar based on category using categoryToColors
              const colors = categoryToColors(update.tag);
              const accentColor = colors.dot || '#2563EB'; // Default to Academic Blue
              
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
                    const eventDate = update.isoDate || update.date 
                      ? new Date(update.isoDate || update.date)
                      : new Date();
                    const eventData: any = {
                      id: update.id,
                      title: update.title,
                      description: update.description,
                      category: update.tag,
                      type: update.tag,
                      date: update.isoDate || update.date,
                      isoDate: update.isoDate || update.date,
                      time: (update as any).time || '',
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
                    setSelectedDateForDrawer(eventDate);
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
                          <Text 
                            style={[styles.updateCategoryText, { color: accentColor, fontSize: theme.fontSize.scaleSize(10) }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {update.tag}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.updateSubtitle, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>
                        {formatDate(update.isoDate || update.date) || update.date}
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
        selectedDate={selectedDateForDrawer}
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
            // Calendar event deletion - ViewEventModal handles confirmation, just execute deletion
            try {
              setIsDeleting(true);
              await CalendarService.deleteEvent(event._id || '');
              await refreshCalendarEvents(true);
              closeEventDrawer();
              setSelectedEvent(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setIsDeleting(false);
            }
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
  searchResultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  searchResultsCount: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
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
  filterDropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  filterDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    overflow: 'hidden',
  },
  filterDropdownButtonText: {
    flex: 1,
    fontWeight: '600',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  dropdownContentWrapper: {
    paddingHorizontal: 20,
  },
  dropdownContent: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  dropdownItemText: {
    flex: 1,
    fontWeight: '500',
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  calendarEventAccent: {
    width: 3,
    borderRadius: 0,
  },
  calendarEventContent: {
    flex: 1,
    padding: 14,
  },
  calendarEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  calendarEventIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarEventTagContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  calendarEventTag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  calendarEventTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  calendarEventDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  calendarEventDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarEventDescription: {
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.75,
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