import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Modal, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import UserSidebar from '../../components/navigation/UserSidebar';
import { useThemeValues } from '../../contexts/ThemeContext';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import NotificationService from '../../services/NotificationService';
import { useUpdates } from '../../contexts/UpdatesContext';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import { categoryToColors } from '../../utils/calendarUtils';
import { formatDate } from '../../utils/dateUtils';
import NotificationModal from '../../modals/NotificationModal';

// Session-scoped flags to avoid re-loading on every mount (especially on web)
// Initial data will load once per app session; further loads are manual (pull-to-refresh)
let hasLoadedSchoolUpdatesOnce = false;
let hasPrefetchedSchoolUpdatesCalendarWide = false;

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
};


// Memoized Calendar Event Card Component
interface CalendarEventCardProps {
  event: any;
  onPress: (event: CalendarEvent, date?: Date) => void;
  theme: any;
  accentColor: string;
  fullEvent: CalendarEvent | null;
}

const CalendarEventCard = memo<CalendarEventCardProps>(({ event, onPress, theme, accentColor, fullEvent }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.calendarEventCard, { 
          backgroundColor: theme.colors.surface, 
          borderColor: theme.colors.border,
          width: 280,
        }]}
        activeOpacity={0.7}
        delayPressIn={0}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          if (fullEvent) {
            const eventDate = fullEvent.isoDate || fullEvent.date 
              ? new Date(fullEvent.isoDate || fullEvent.date)
              : new Date();
            onPress(fullEvent, eventDate);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`Event: ${event.title}, Date: ${event.date}, Category: ${event.tag}`}
        accessibilityHint="Double tap to view event details"
      >
        <View style={[styles.calendarEventAccent, { backgroundColor: accentColor }]} collapsable={false} />
        <View style={styles.calendarEventContent} collapsable={false}>
          <View style={styles.calendarEventHeader}>
            <View style={[styles.calendarEventIconWrapper, { backgroundColor: accentColor + '20' }]}>
              <Ionicons name="calendar" size={18} color={accentColor} />
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
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return prevProps.event.id === nextProps.event.id &&
         prevProps.theme === nextProps.theme &&
         prevProps.accentColor === nextProps.accentColor;
});

CalendarEventCard.displayName = 'CalendarEventCard';

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


const SchoolUpdates = () => {
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
      return ['#DBEAFE', '#93C5FD', '#2563EB'];
    }
    // Facet theme (Orange)
    if (theme.colors.accent === '#FF9500') {
      return ['#FFE0B2', '#FFCC80', '#FF9500'];
    }
    // Default: use theme colors
    return [
      theme.colors.accentLight || '#DBEAFE',
      theme.colors.accent || '#2563EB',
      theme.colors.accentDark || '#1E3A8A'
    ] as [string, string, string];
  };
  
  // Get content gradient overlay colors based on theme
  const getContentGradientColors = (): [string, string, string] => {
    // DOrSU theme (Royal Blue)
    if (theme.colors.accent === '#2563EB') {
      return isDarkMode
        ? ['rgba(59, 130, 246, 0.08)', 'rgba(37, 99, 235, 0.03)', 'rgba(29, 78, 216, 0.01)']
        : ['rgba(59, 130, 246, 0.1)', 'rgba(37, 99, 235, 0.05)', 'rgba(29, 78, 216, 0.02)'];
    }
    // Facet theme (Orange)
    if (theme.colors.accent === '#FF9500') {
      return isDarkMode
        ? ['rgba(255, 204, 128, 0.08)', 'rgba(255, 167, 38, 0.03)', 'rgba(255, 149, 0, 0.01)']
        : ['rgba(255, 204, 128, 0.1)', 'rgba(255, 167, 38, 0.05)', 'rgba(255, 149, 0, 0.02)'];
    }
    // Default: use theme colors with opacity
    const lightColor = theme.colors.accentLight || '#93C5FD';
    const mainColor = theme.colors.accent || '#2563EB';
    const darkColor = theme.colors.accentDark || '#1E3A8A';
    return isDarkMode
      ? [`${lightColor}14`, `${mainColor}08`, `${darkColor}03`]
      : [`${lightColor}1A`, `${mainColor}0D`, `${darkColor}05`] as [string, string, string];
  };
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [searchQuery, setSearchQuery] = useState('');
  const { posts: updates, setPosts: setUpdates, calendarEvents, setCalendarEvents } = useUpdates();
  // Initialize loading state based on whether shared data already exists
  const [isLoading, setIsLoading] = useState(() => updates.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcomingmonth' | 'lastmonth' | 'thismonth'>('thismonth');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingCalendarEvents, setIsLoadingCalendarEvents] = useState(() => calendarEvents.length === 0);
  const [calendarEventsError, setCalendarEventsError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const calendarEventsScrollRef = useRef<ScrollView>(null);
  
  // Content type filter - matches AdminCalendar behavior (single select, null = show all)
  const [selectedLegendType, setSelectedLegendType] = useState<string | null>(null);
  const selectedContentTypes = useMemo(() => (
    selectedLegendType ? [selectedLegendType] : ['academic', 'institutional', 'event', 'announcement', 'news']
  ), [selectedLegendType]);
  const selectedContentTypesSet = useMemo(
    () => new Set(selectedContentTypes.map(type => type.toLowerCase())),
    [selectedContentTypes]
  );
  
  // Event Modal state (view-only) - used for both calendar events and updates
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<Date | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([]);
  
  // Notification modal state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  
  // Time filter dropdown state
  const [showTimeFilterDropdown, setShowTimeFilterDropdown] = useState(false);

  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);

  // Calculate available height for scrollable cards section (will be recalculated after currentMonthEvents is defined)
  const screenHeight = Dimensions.get('window').height;

  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);
  const [backendUserName, setBackendUserName] = useState<string | null>(null);
  const [backendUserFirstName, setBackendUserFirstName] = useState<string | null>(null);
  const [backendUserLastName, setBackendUserLastName] = useState<string | null>(null);
  const userName = useMemo(() => {
    // Priority: Backend firstName + lastName -> Backend userName -> Firebase displayName -> Firebase email username -> Default
    if (backendUserFirstName && backendUserLastName) {
      return `${backendUserFirstName} ${backendUserLastName}`.trim();
    }
    return backendUserName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  }, [backendUserName, backendUserFirstName, backendUserLastName, currentUser]);

  // Animated floating background orb (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;

  // Animation values for smooth entrance - DISABLED FOR DEBUGGING
  const fadeAnim = useRef(new Animated.Value(1)).current; // Set to 1 (visible) immediately
  const slideAnim = useRef(new Animated.Value(0)).current; // Set to 0 (no offset) immediately

  // Entrance animation - DISABLED FOR DEBUGGING
  // useEffect(() => {
  //   const handle = InteractionManager.runAfterInteractions(() => {
  //     Animated.parallel([
  //       Animated.timing(fadeAnim, {
  //         toValue: 1,
  //         duration: 250,
  //         easing: Easing.out(Easing.ease),
  //         useNativeDriver: true,
  //       }),
  //       Animated.timing(slideAnim, {
  //         toValue: 0,
  //         duration: 250,
  //         easing: Easing.out(Easing.ease),
  //         useNativeDriver: true,
  //       }),
  //     ]).start();
  //   });
  //   return () => handle.cancel();
  // }, []);

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
        const [userPhoto, storedUserName, firstName, lastName] = await Promise.all([
          AsyncStorage.getItem('userPhoto'),
          AsyncStorage.getItem('userName'),
          AsyncStorage.getItem('userFirstName'),
          AsyncStorage.getItem('userLastName'),
        ]);
        if (!cancelled) {
          setBackendUserPhoto(userPhoto);
          if (storedUserName) {
            setBackendUserName(storedUserName);
          }
          if (firstName) {
            setBackendUserFirstName(firstName);
          }
          if (lastName) {
            setBackendUserLastName(lastName);
          }
        }
      } catch (error) {
        if (!cancelled) {
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
          const storedUserName = await AsyncStorage.getItem('userName');
          const firstName = await AsyncStorage.getItem('userFirstName');
          const lastName = await AsyncStorage.getItem('userLastName');
          setBackendUserPhoto(userPhoto);
          if (storedUserName) {
            setBackendUserName(storedUserName);
          }
          if (firstName) {
            setBackendUserFirstName(firstName);
          }
          if (lastName) {
            setBackendUserLastName(lastName);
          }
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

  // Animate floating background orb on mount
  useEffect(() => {
    Animated.loop(
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
    ).start();
  }, [floatAnim1]);

  const handleNotificationsPress = useCallback(() => {
    setShowNotificationModal(true);
  }, []);

  // Track last fetch time to prevent unnecessary refetches
  const lastFetchTime = useRef<number>(0);
  const isFetching = useRef<boolean>(false);
  const FETCH_COOLDOWN = 1000; // 1 second cooldown between fetches

  // Fetch data from AdminDataService (matching AdminDashboard pattern)
  const fetchUpdates = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent duplicate simultaneous fetches (unless force refresh)
    // When force refresh is true, we allow it to proceed even if a fetch is in progress
    // to ensure we get the latest data after returning from PostUpdate screen
    if (isFetching.current && !forceRefresh) {
      return;
    }

    // Cooldown check - prevent too frequent fetches (bypassed on force refresh)
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime.current < FETCH_COOLDOWN) {
      return;
    }

    isFetching.current = true;
    lastFetchTime.current = now;

    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch recent updates (posts/announcements) - use cache if available
      const posts = await AdminDataService.getPosts();
      
      // Debug logging removed for performance in development (large payloads can cause noticeable lag)
      
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
        
          // Use same date handling as AdminDashboard - formatDate handles ISO strings correctly
          const dateValue = post.isoDate || post.date;
          const formattedDate = dateValue ? formatDate(dateValue) : 'No date';
          
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
            source: 'post', // Mark as post/update to distinguish from calendar events
          };
      });
      
      // Only use posts data - calendar events are shown in separate section
      // Remove duplicates from posts only
      const uniqueUpdates = postsData.filter((update, index, self) =>
        index === self.findIndex(u => u.id === update.id)
      );
      
      // Sort by date (ascending - earliest first)
      uniqueUpdates.sort((a, b) => {
        const dateA = new Date(a.isoDate || a.date).getTime();
        const dateB = new Date(b.isoDate || b.date).getTime();
        return dateA - dateB;
      });
      
      setUpdates(uniqueUpdates);
    } catch (err: any) {
      console.error('❌ Error fetching updates:', err);
      setError(err?.message || 'Failed to load updates');
      if (__DEV__) console.error('Error fetching updates:', err);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, []);

  // Request notification permissions and check notifications on mount
  useEffect(() => {
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

  // Note: Further updates are fetched manually via pull-to-refresh

  const filtered = useMemo(() => {
    const result = updates.filter(u => {
      const q = searchQuery.trim().toLowerCase();
      if (q.length === 0) return true;
      
      // Search in title, description, and tag
      const titleMatch = u.title?.toLowerCase().includes(q) || false;
      const descriptionMatch = u.description?.toLowerCase().includes(q) || false;
      const tagMatch = u.tag?.toLowerCase().includes(q) || false;
      
      return titleMatch || descriptionMatch || tagMatch;
    });
    return result;
  }, [updates, searchQuery]);


  // Filtered updates based on selected time filter, content type, and search query
  // Includes both posts and calendar events
  // Uses the same date processing logic as AdminCalendar (matching AdminDashboard)
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
    
    // Start with posts based on time filter (same approach as AdminCalendar)
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
    
    // Apply search filter (matching AdminDashboard)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(update => {
        const title = (update.title || '').toLowerCase();
        const description = (update.description || '').toLowerCase();
        const tag = (update.tag || '').toLowerCase();
        return title.includes(query) || description.includes(query) || tag.includes(query);
      });
    }
    
    // Sort by date (ascending - earliest first) - matching user requirement
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

  // Current month events - combines calendar events and posts/updates
  // Filtered by selectedContentTypes and search query
  // Uses Philippines timezone for calendar month calculations
  const currentMonthEvents = useMemo(() => {
    // Get current date in Philippines timezone
    const now = new Date();
    const phNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentYear = phNow.getFullYear();
    const currentMonth = phNow.getMonth();
    
    // Helper function to get month/year in Philippines timezone
    const getPHMonthYear = (date: Date | string) => {
      try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const phDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        return {
          year: phDate.getFullYear(),
          month: phDate.getMonth(),
        };
      } catch {
        return null;
      }
    };
    
    const events: any[] = [];
    
    // Add calendar events for current month (based on Philippines timezone)
    calendarEvents
      .filter(event => {
        const eventDate = event.isoDate || event.date;
        if (!eventDate) return false;
        const phDate = getPHMonthYear(eventDate);
        if (!phDate) return false;
        const isCurrentMonth = phDate.year === currentYear && phDate.month === currentMonth;
        
        if (!isCurrentMonth) return false;
        
        // Apply content type filter
        const eventType = String(event.category || 'Event').toLowerCase();
        return selectedContentTypesSet.has(eventType);
      })
      .forEach(event => {
        events.push({
          id: event._id || `calendar-${event.isoDate}-${event.title}`,
          title: event.title,
          date: formatDate(event.isoDate || event.date) || 'No date',
          tag: event.category || 'Event',
          description: event.description || '',
          image: undefined,
          images: undefined,
          pinned: false,
          isoDate: event.isoDate || event.date,
          time: event.time, // Preserve time for sorting
          source: 'calendar', // Mark as calendar event
          _id: event._id,
        });
      });
    
    // Add posts/updates for current month (based on Philippines timezone)
    updates
      .filter(update => {
        if (!update.isoDate) return false;
        const phDate = getPHMonthYear(update.isoDate);
        if (!phDate) return false;
        const isCurrentMonth = phDate.year === currentYear && phDate.month === currentMonth;
        
        if (!isCurrentMonth) return false;
        
        // Apply content type filter
        const updateType = String(update.tag || 'Announcement').toLowerCase();
        return selectedContentTypesSet.has(updateType);
      })
      .forEach(update => {
        events.push({
          id: update.id,
          title: update.title,
          date: formatDate(update.isoDate || update.date) || 'No date',
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
    
    // Sort chronologically by date (day 1 to 31), then by time if same date
    filteredEvents.sort((a, b) => {
      const dateA = new Date(a.isoDate || a.date).getTime();
      const dateB = new Date(b.isoDate || b.date).getTime();
      
      // If dates are the same, sort by time if available
      if (dateA === dateB && a.time && b.time) {
        // Parse time strings (e.g., "8:00 AM" or "14:30")
        const parseTime = (timeStr: string | undefined): number => {
          if (!timeStr) return 9999; // Events without time go to the end
          
          const lower = timeStr.toLowerCase();
          if (lower.includes('all day') || lower.includes('all-day')) return 0;
          
          // Try to parse "HH:MM AM/PM" format
          const amPmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (amPmMatch) {
            let hours = parseInt(amPmMatch[1], 10);
            const minutes = parseInt(amPmMatch[2], 10);
            const isPM = amPmMatch[3].toUpperCase() === 'PM';
            if (isPM && hours !== 12) hours += 12;
            if (!isPM && hours === 12) hours = 0;
            return hours * 60 + minutes;
          }
          
          // Try to parse "HH:MM" format (24-hour)
          const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            return hours * 60 + minutes;
          }
          
          return 9999; // Unparseable time goes to the end
        };
        
        const timeA = parseTime(a.time);
        const timeB = parseTime(b.time);
        return timeA - timeB; // Ascending (earliest time first)
      }
      
      // Sort by date ascending (day 1 to 31)
      return dateA - dateB;
    });
    
    return filteredEvents;
  }, [calendarEvents, updates, selectedContentTypesSet, searchQuery]);

  // Calculate available height for scrollable cards section (after currentMonthEvents is defined)
  const cardsScrollViewHeight = useMemo(() => {
    const headerHeight = safeInsets.top + 60; // Header height
    const welcomeSectionHeight = 60; // Welcome section approximate height
    const calendarSectionHeight = currentMonthEvents.length > 0 ? 200 : 0; // Calendar events section approximate height (if visible)
    const updatesHeaderHeight = 120; // Updates header + filters approximate height
    const bottomNavHeight = safeInsets.bottom + 80; // Bottom nav + safe area
    const calculatedHeight = screenHeight - headerHeight - welcomeSectionHeight - calendarSectionHeight - updatesHeaderHeight - bottomNavHeight - 50; // 50 for padding/margins
    const finalHeight = Math.max(calculatedHeight, 300); // Ensure minimum 300px height
    return finalHeight;
  }, [screenHeight, safeInsets.top, safeInsets.bottom, currentMonthEvents.length]);

  // Refresh calendar events function with error handling and retry
  // Initial load: current month ± 1 month (3 months total) to match user Calendar behavior
  // Wider range is prefetched in the background after UI is rendered
  const refreshCalendarEvents = useCallback(async (isRetry: boolean = false) => {
    try {
      setIsLoadingCalendarEvents(true);
      setCalendarEventsError(null);
      
      // Fetch from API - Load current month ± 1 month (3 months) for fast initial load
      // Wider ranges will be prefetched in the background
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // Load current month ± 1 month for buffer (so filtering by last/next month works)
      const startDate = new Date(currentYear, currentMonth - 1, 1);
      const endDate = new Date(currentYear, currentMonth + 2, 0, 23, 59, 59); // Last day of next month
      
      const events = await CalendarService.getEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 500,
      });
      
      setCalendarEvents(Array.isArray(events) ? events : []);
      setRetryCount(0);
    } catch (error: any) {
      console.error('Failed to load calendar events:', error);
      const errorMessage = error?.message || 'Failed to load calendar events. Please try again.';
      setCalendarEventsError(errorMessage);
      setCalendarEvents([]);
      
      // Auto-retry with exponential backoff (max 3 retries)
      if (!isRetry && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          refreshCalendarEvents(true);
        }, delay);
      }
    } finally {
      setIsLoadingCalendarEvents(false);
    }
  }, [retryCount]);

  // Fetch updates and calendar events once per app session (no re-load on screen switch)
  useEffect(() => {
    if (hasLoadedSchoolUpdatesOnce) {
      // If we've already loaded once this session, ensure loading flags reflect existing shared data
      if (updates.length > 0) {
        setIsLoading(false);
      }
      if (calendarEvents.length > 0) {
        setIsLoadingCalendarEvents(false);
      }
      return;
    }
    hasLoadedSchoolUpdatesOnce = true;
    fetchUpdates(true);
    refreshCalendarEvents();
  }, [fetchUpdates, refreshCalendarEvents]);

  // Note: further calendar event sync is handled via pull-to-refresh

  // Background prefetch: once we have initial calendar events,
  // load a wider 5‑month window in the background and merge into shared context.
  useEffect(() => {
    if (hasPrefetchedSchoolUpdatesCalendarWide) return;
    if (!calendarEvents || calendarEvents.length === 0) return;

    let cancelled = false;

    const prefetchWideRange = async () => {
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Wider range: current month ± 2 months (5 months total)
        const startDate = new Date(currentYear, currentMonth - 2, 1);
        const endDate = new Date(currentYear, currentMonth + 3, 0, 23, 59, 59);

        const wideEvents = await CalendarService.getEvents({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 1000,
        });

        if (cancelled || !Array.isArray(wideEvents) || wideEvents.length === 0) return;

        // Merge into shared calendarEvents without duplicates
        setCalendarEvents(prev => {
          const existingIds = new Set(
            prev.map(e => (e as any)._id || (e as any).id || `${(e as any).isoDate}-${(e as any).title}`)
          );
          const newOnes = wideEvents.filter(e => {
            const id = (e as any)._id || (e as any).id || `${(e as any).isoDate}-${(e as any).title}`;
            return !existingIds.has(id);
          });
          return [...prev, ...newOnes];
        });

        hasPrefetchedSchoolUpdatesCalendarWide = true;
      } catch {
        // Silent failure; we keep initial range
      }
    };

    // Small delay to avoid competing with initial render
    const t = setTimeout(prefetchWideRange, 800);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [calendarEvents, setCalendarEvents]);

  // Auto-scroll to center today's events when events load
  // Layout: Past events (left) -> Today's events (center) -> Future events (right)
  useEffect(() => {
    if (currentMonthEvents.length > 0 && calendarEventsScrollRef.current) {
      // Function to perform the scroll
      const performScroll = () => {
        if (!calendarEventsScrollRef.current) return;
        
        const now = new Date();
        const todayKey = getPHDateKey(now);
        const screenWidth = Dimensions.get('window').width;
        
        // Find the index of the first today's event
        const todayEventIndex = currentMonthEvents.findIndex(event => {
          if (!event.isoDate) return false;
          try {
            const eventKey = getPHDateKey(event.isoDate);
            const isToday = eventKey === todayKey;
            return isToday;
          } catch (error) {
            console.error('Error in findIndex for today:', error);
            return false;
          }
        });
        
        // Calculate card dimensions
        const cardWidth = 280; // Card width
        const cardGap = 14; // Gap between cards
        const cardWithGap = cardWidth + cardGap; // Total width per card including gap
        const leftPadding = 4;
        
        if (todayEventIndex >= 0) {
          // Calculate the position of the first today's event
          const firstTodayEventPosition = todayEventIndex * cardWithGap + leftPadding;
          
          // Calculate center position: event position - (screen width / 2) + (card width / 2)
          // This centers the first today's event in the viewport
          const centerPosition = firstTodayEventPosition - (screenWidth / 2) + (cardWidth / 2);
          
          // Ensure we don't scroll to negative position
          const scrollPosition = Math.max(0, centerPosition);
          
          // Scroll with animation
          calendarEventsScrollRef.current.scrollTo({ x: scrollPosition, animated: true });
          
          // Also try a second scroll after a short delay to ensure it locks
          setTimeout(() => {
            if (calendarEventsScrollRef.current) {
              calendarEventsScrollRef.current.scrollTo({ x: scrollPosition, animated: false });
            }
          }, 600);
        } else {
          // If no today's events, check if we have future events
          // If future events exist, scroll to show the transition from past to future
          // Otherwise, just show past events from the start
          const hasFutureEvents = currentMonthEvents.some(event => {
            if (!event.isoDate) return false;
            const eventKey = getPHDateKey(event.isoDate);
            if (eventKey === todayKey) return false;
            const eventTime = new Date(event.isoDate).getTime();
            return eventTime >= now.getTime();
          });
          
          if (hasFutureEvents) {
            // Find the first future event index
            const firstFutureIndex = currentMonthEvents.findIndex(event => {
              if (!event.isoDate) return false;
              const eventKey = getPHDateKey(event.isoDate);
              if (eventKey === todayKey) return false;
              const eventTime = new Date(event.isoDate).getTime();
              return eventTime >= now.getTime();
            });
            
            if (firstFutureIndex >= 0) {
              // Scroll to show the transition point (end of past events, start of future events)
              const transitionPosition = firstFutureIndex * cardWithGap + leftPadding - (screenWidth / 2) + (cardWidth / 2);
              const scrollPosition = Math.max(0, transitionPosition);
              calendarEventsScrollRef.current.scrollTo({ x: scrollPosition, animated: true });
            } else {
              // Fallback: scroll to start
              calendarEventsScrollRef.current.scrollTo({ x: leftPadding, animated: true });
            }
          } else {
            // Only past events, scroll to start
            calendarEventsScrollRef.current.scrollTo({ x: leftPadding, animated: true });
          }
        }
      };
      
      // Try scrolling multiple times with increasing delays to ensure it works
      const timeout1 = setTimeout(performScroll, 300);
      const timeout2 = setTimeout(performScroll, 600);
      const timeout3 = setTimeout(performScroll, 1000);
      
      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
      };
    }
  }, [currentMonthEvents.length]); // Use length to avoid unnecessary re-renders

  // Open event modal (view-only) - optimized for performance
  const openEventDrawer = useCallback((event: CalendarEvent, date?: Date) => {
    // Batch state updates for better performance
    if (date) {
      // Find all events on this date
      const eventsOnDate = calendarEvents.filter(e => {
        const eventDate = new Date(e.isoDate || e.date);
        return eventDate.toDateString() === date.toDateString();
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



  return (
    <View style={styles.container}>
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
        style={[styles.orangeHeader, { 
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
              <Text style={[styles.welcomeSubtitleInHeader, { fontSize: theme.fontSize.scaleSize(13) }]}>Here are your latest campus updates</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
      
      {/* User Sidebar Component */}
      <UserSidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Main Content - Scrollable with Curved Top */}
      <View style={styles.contentWrapper}>
        {/* Blue Gradient Background */}
        <LinearGradient
          colors={getContentGradientColors()}
          style={styles.orangeGradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />
        
        {/* Curved Top of Body - Creates transition from header */}
        <View style={styles.bodyCurveContainer}>
          <View style={styles.bodyCurve}>
            <LinearGradient
              colors={
                isDarkMode
                  ? ['rgba(255, 237, 213, 0.08)', 'rgba(255, 237, 213, 0.08)']
                  : ['rgba(255, 237, 213, 0.4)', 'rgba(255, 237, 213, 0.4)']
              }
              style={styles.bodyCurvePath}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </View>
        </View>
        
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
            refreshing={isRefreshing}
            onRefresh={async () => {
              setIsRefreshing(true);
              try {
                await Promise.all([
                  refreshCalendarEvents(),
                  fetchUpdates(true),
                ]);
              } finally {
                setIsRefreshing(false);
              }
            }}
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

        {/* Legend/Filter Section - Hide when searching */}
        {searchQuery.trim().length === 0 && (
        <View style={styles.sectionContainer}>
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
                        accessibilityLabel={`${item.type} event type - ${isSelected ? 'selected, tap to hide' : 'tap to show'}`}
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
        </View>
        )}

        {/* Updates Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionDivider}>
              <Text style={[styles.sectionDividerLabel, { fontSize: theme.fontSize.scaleSize(11) }]}>
                {searchQuery.trim().length > 0 ? 'SEARCH RESULTS' : 'UPDATES'}
              </Text>
          </View>
          
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
                {timeFilterOptions.find(opt => opt.key === timeFilter)?.label || 'This Month'}
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
            {error && (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
                <Text style={{ marginTop: 6, fontSize: theme.fontSize.scaleSize(12), color: '#DC2626', fontWeight: '600' }}>{error}</Text>
              </View>
            )}

            {isLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="hourglass-outline" size={40} color={theme.colors.textMuted} />
                <Text style={{ marginTop: 6, fontSize: theme.fontSize.scaleSize(12), color: theme.colors.textMuted, fontWeight: '600' }}>Loading updates...</Text>
              </View>
            )}

            {!isLoading && !error && displayedUpdates.length === 0 && (
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

            {!isLoading && !error && displayedUpdates.map((update) => {
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
                    
                    // Post/Update - convert to CalendarEvent format for ViewEventModal
                    const eventDate = update.isoDate || update.date 
                      ? new Date(update.isoDate || update.date)
                      : new Date();
                    
                    const event: any = {
                      _id: update.id,
                      title: update.title,
                      description: update.description,
                      category: update.tag,
                      date: update.isoDate || update.date,
                      isoDate: update.isoDate || update.date,
                      image: update.image,
                      images: update.images,
                    };
                    
                    setSelectedEvent(event);
                    setSelectedDateForDrawer(eventDate);
                    setSelectedDateEvents([{
                      id: update.id,
                      title: update.title,
                      color: accentColor,
                      type: update.tag,
                      category: update.tag,
                      description: update.description,
                      isoDate: update.isoDate || update.date,
                      date: update.isoDate || update.date,
                      time: update.time || undefined, // Pass through time if available
                      image: update.image,
                      images: update.images,
                    }]);
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
                        {update.tag && (
                          <View style={[styles.updateCategoryBadge, { backgroundColor: accentColor + '20' }]}>
                            <Text 
                              style={[styles.updateCategoryText, { color: accentColor, fontSize: theme.fontSize.scaleSize(10) }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {update.tag}
                            </Text>
                          </View>
                        )}
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
        
        {/* Curved Bottom of Body */}
        <View style={styles.bodyCurveBottomContainer}>
          <View style={styles.bodyCurveBottom}>
            <LinearGradient
              colors={
                isDarkMode
                  ? ['rgba(255, 237, 213, 0.01)', 'rgba(255, 237, 213, 0.01)']
                  : ['rgba(255, 237, 213, 0.1)', 'rgba(255, 237, 213, 0.1)']
              }
              style={styles.bodyCurveBottomPath}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </View>
        </View>
      </View>
      
      {/* View Event Modal - View Only (for both calendar events and updates) */}
      <ViewEventModal
        visible={showEventDrawer}
        onClose={closeEventDrawer}
        selectedEvent={selectedEvent}
        selectedDateEvents={selectedDateEvents}
        selectedDate={selectedDateForDrawer}
      />

      {/* Notification Modal */}
      <NotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />


      {/* Bottom Navigation Bar - Fixed position */}
      <View style={[styles.bottomNavContainer, {
        bottom: 0,
        paddingBottom: safeInsets.bottom,
      }]} collapsable={false}>
        <UserBottomNavBar />
      </View>
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
  // Floating background orbs container (Copilot-style)
  floatingBgContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: 'hidden',
  },
  floatingOrbWrapper: {
    position: 'absolute',
  },
  floatingOrb1: {
    width: 500,
    height: 500,
    borderRadius: 250,
    opacity: 0.5,
    overflow: 'hidden',
  },
  orangeHeader: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    zIndex: 10,
    position: 'relative',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    position: 'relative',
    zIndex: 1,
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
  welcomeSectionInHeader: {
    marginTop: 8,
    position: 'relative',
    zIndex: 1,
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
  contentWrapper: {
    flex: 1,
    zIndex: 1,
    width: '100%',
    position: 'relative',
    marginTop: -20,
    paddingTop: 20,
  },
  orangeGradientBackground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  content: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
    zIndex: 1,
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
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
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
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 4,
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
    borderWidth: 0,
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
  eventsErrorContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  eventsErrorText: {
    fontWeight: '600',
    marginBottom: 4,
  },
  eventsRetryButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  eventsRetryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarErrorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    minHeight: 120,
  },
  calendarErrorText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  calendarErrorSubtext: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  calendarRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  calendarRetryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  calendarEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    minHeight: 150,
  },
  calendarEmptyText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
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
    flexWrap: 'wrap',
  },
  updateTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: -0.2,
    flex: 1,
    minWidth: 0,
  },
  updateCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    flexShrink: 0,
    overflow: 'hidden',
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
  
});

export default SchoolUpdates; 