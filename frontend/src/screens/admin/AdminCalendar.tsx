import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import AdminSidebar from '../../components/navigation/AdminSidebar';
import { theme } from '../../config/theme';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useUpdates } from '../../contexts/UpdatesContext';
import DeleteAllModal from '../../modals/DeleteAllModal';
import MonthPickerModal from '../../modals/MonthPickerModal';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import AdminFileService from '../../services/AdminFileService';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import CalendarService from '../../services/CalendarService';
import { categoryToColors, formatDateKey, parseAnyDateToKey } from '../../utils/calendarUtils';
import { formatDate } from '../../utils/dateUtils';

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
  AdminSettings: undefined;
  AdminCalendar: undefined;
  CalendarHelp: undefined;
  PostUpdate: { postId?: string } | undefined;
  ManagePosts: undefined;
};

// Helper functions moved outside component for performance
const formatEventTitle = (raw?: string) => {
  const title = String(raw || '').trim();
  if (title.length < 3) return 'Untitled';
  const cleaned = title.replace(/\s+/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

// Get cell background color based on event types
const getCellColor = (events: any[]): string | null => {
  if (!events || events.length === 0) return null;
  
  // Priority order: Institutional > Academic > Event > News > Announcement
  const hasInstitutional = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'institutional';
  });
  
  const hasAcademic = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'academic';
  });
  
  const hasEvent = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'event';
  });
  
  const hasNews = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'news';
  });
  
  const hasAnnouncement = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'announcement';
  });
  
  // Return color based on priority
  if (hasInstitutional) return '#2563EB'; // Blue
  if (hasAcademic) return '#10B981'; // Green
  if (hasEvent) return '#D97706'; // Orange
  if (hasNews) return '#8B5CF6'; // Purple
  if (hasAnnouncement) return '#1A3E7A'; // Dark Blue
  
  // Fallback: use first event's category color
  const firstEvent = events[0];
  if (firstEvent) {
    const colors = categoryToColors(firstEvent.type || firstEvent.category);
    return colors.cellColor || null;
  }
  
  return null;
};

// OPTIMIZED: Build date range more efficiently
// For calendar display, we only need date keys, not full Date objects
const buildDateRange = (startISO?: string, endISO?: string): Date[] => {
  if (!startISO || !endISO) return [];
  
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }
  
  // Normalize to start of day
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  
  // Limit range to prevent performance issues (max 365 days)
  const daysDiff = Math.floor((endTime - startTime) / (1000 * 60 * 60 * 24));
  if (daysDiff > 365) {
    // For very long ranges, only include start and end dates
    return [new Date(startTime), new Date(endTime)];
  }
  
  // Optimized: Pre-allocate array and use setDate in a loop
  const dates: Date[] = [];
  const current = new Date(startTime);
  const maxDays = Math.min(daysDiff + 1, 365);
  
  for (let i = 0; i <= maxDays; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};


// Robust PH date-key comparison (avoids off-by-one no matter device tz)
const getPHDateKey = (d: Date, PH_TZ: string) => {
  try {
    const dtf = new Intl.DateTimeFormat('en-PH', {
      timeZone: PH_TZ,
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
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
};

const AdminCalendar = () => {
  dayjs.extend(utc);
  dayjs.extend(timezone);
  const PH_TZ = 'Asia/Manila';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode, theme: t } = useThemeValues();
  const scrollRef = useRef<ScrollView>(null);
  const initialNow = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(Date.UTC(initialNow.getFullYear(), initialNow.getMonth(), 1)));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);
  
  // Background animation value (Copilot-style animated orb)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  
  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);
  
  // Lock header height to prevent layout shifts
  const headerHeightRef = useRef<number>(64);
  const [headerHeight, setHeaderHeight] = useState(64);
  
  // Calendar state
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([]);
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  
  // Delete all modal animation values
  const deleteAllModalSlideAnim = useRef(new Animated.Value(0)).current;
  const deleteAllModalBackdropOpacity = useRef(new Animated.Value(0)).current;
  
  // Legend filter state - null means show all types, otherwise show only selected type
  const [selectedLegendType, setSelectedLegendType] = useState<string | null>(null);
  
  // Get selected content types based on legend selection - memoized as Set for fast lookups
  const selectedContentTypesSet = React.useMemo(() => {
    const types = selectedLegendType 
      ? [selectedLegendType] 
      : ['academic', 'institutional', 'event', 'announcement', 'news'];
    return new Set(types.map(t => t.toLowerCase()));
  }, [selectedLegendType]);
  
  // Keep array version for backward compatibility with existing code
  const selectedContentTypes = React.useMemo(() => {
    return selectedLegendType 
      ? [selectedLegendType] 
      : ['academic', 'institutional', 'event', 'announcement', 'news'];
  }, [selectedLegendType]);
  
  // Animation values
  const monthPickerScaleAnim = useRef(new Animated.Value(0)).current;
  const monthPickerOpacityAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.8)).current;

  const getUserInitials = () => {
    if (!currentUser?.displayName) return '?';
    const names = currentUser.displayName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return currentUser.displayName.substring(0, 2).toUpperCase();
  };

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const userPhoto = await AsyncStorage.getItem('userPhoto');
        setBackendUserPhoto(userPhoto);
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };
    loadUserData();
  }, []);

  // Subscribe to auth changes
  useFocusEffect(
    useCallback(() => {
      let unsubscribe: (() => void) | null = null;
      const timeoutId = setTimeout(() => {
        unsubscribe = onAuthStateChange((user: User | null) => {
          setCurrentUser((prevUser: any) => {
            if (prevUser?.uid !== user?.uid) {
              return user;
            }
            return prevUser;
          });
        });
      }, 50);
      
      return () => {
        clearTimeout(timeoutId);
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }, [])
  );

  // Animate floating background orb (Copilot-style)
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


  // Shared posts & calendarEvents via UpdatesContext (kept in memory across screens)
  const { posts, setPosts, calendarEvents, setCalendarEvents } = useUpdates();
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState<boolean>(false);
  const [isProcessingCSV, setIsProcessingCSV] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const postsForCalendar = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    return posts.filter(post => {
      if (post.source === 'CSV Upload') return false;
      const postType = String(post.category || 'Announcement').toLowerCase();
      return selectedContentTypesSet.has(postType);
    });
  }, [posts, selectedContentTypesSet]);

  const calendarEventsForCalendar = useMemo(() => {
    if (!Array.isArray(calendarEvents)) return [];
    return calendarEvents.filter(event => {
      const eventType = String(event.category || 'Announcement').toLowerCase();
      return selectedContentTypesSet.has(eventType);
    });
  }, [calendarEvents, selectedContentTypesSet]);

  // OPTIMIZED: Memoize category colors to avoid repeated lookups
  const categoryColorsCache = React.useMemo(() => {
    const cache = new Map<string, ReturnType<typeof categoryToColors>>();
    return {
      get: (category: string) => {
        if (!cache.has(category)) {
          cache.set(category, categoryToColors(category));
        }
        return cache.get(category)!;
      }
    };
  }, []);

  // OPTIMIZED: Process events more efficiently with early returns and batching
  const { eventsByDateMap, monthEventCountMap } = useMemo(() => {
    const startTime = performance.now();
    const dateMap = new Map<string, any[]>();
    const monthMap = new Map<string, number>();

    // Optimized incrementMonth - inline for performance
    const incrementMonth = (year: number, month: number) => {
      const key = `${year}-${month}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    };

    // Optimized addEventInstance - use date key directly instead of Date object
    const addEventInstance = (dateKey: string, year: number, month: number, payload: any) => {
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(payload);
      incrementMonth(year, month);
    };

    // Process posts (usually fewer, so less optimization needed)
    for (let i = 0; i < postsForCalendar.length; i++) {
      const post = postsForCalendar[i];
      const dateObj = new Date(post.isoDate || post.date);
      if (Number.isNaN(dateObj.getTime())) continue;
      
      const dateKey = formatDateKey(dateObj);
      const colors = categoryColorsCache.get(post.category || 'Announcement');
      
      const payload = {
        id: post.id,
        title: post.title,
        dateKey,
        time: post.time || '',
        type: post.category || 'Announcement',
        color: colors.dot,
        chip: colors,
        description: post.description,
        isPinned: post.isPinned,
        isUrgent: post.isUrgent,
        source: 'post',
      };
      
      addEventInstance(dateKey, dateObj.getFullYear(), dateObj.getMonth() + 1, payload);
    }

    // Process calendar events (OPTIMIZED: batch process and limit date range expansion)
    for (let i = 0; i < calendarEventsForCalendar.length; i++) {
      const event = calendarEventsForCalendar[i];
      const colors = categoryColorsCache.get(event.category || 'Announcement');
      
      const payload = {
        ...event,
        id: event._id || `calendar-${event.isoDate || event.startDate}-${event.title}`,
        type: event.category || 'Announcement',
        color: colors.dot,
        chip: colors,
        source: 'calendar',
      };

      // Handle month-only and week-only events (no date range expansion needed)
      const dateType = String(event.dateType || '');
      if (dateType === 'month_only' || dateType === 'week_in_month' || 
          dateType === 'week' || dateType === 'month') {
        if (event.year && event.month) {
          incrementMonth(event.year, event.month);
        }
        continue; // Skip date range processing for month/week events
      }

      // Handle date ranges (OPTIMIZED: limit expansion for very long ranges)
      if (event.dateType === 'date_range' && event.startDate && event.endDate) {
        const start = new Date(event.startDate);
        const end = new Date(event.endDate);
        
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          
          // OPTIMIZATION: For very long ranges (>90 days), only mark start and end dates
          if (daysDiff > 90) {
            const startKey = formatDateKey(start);
            const endKey = formatDateKey(end);
            addEventInstance(startKey, start.getFullYear(), start.getMonth() + 1, payload);
            if (startKey !== endKey) {
              addEventInstance(endKey, end.getFullYear(), end.getMonth() + 1, payload);
            }
          } else {
            // For shorter ranges, expand fully
            const rangeDates = buildDateRange(event.startDate, event.endDate);
            for (let j = 0; j < rangeDates.length; j++) {
              const dateObj = rangeDates[j];
              const dateKey = formatDateKey(dateObj);
              addEventInstance(dateKey, dateObj.getFullYear(), dateObj.getMonth() + 1, payload);
            }
          }
        }
      } else {
        // Single date event
        const fallbackDate = event.isoDate || event.date || event.startDate;
        if (fallbackDate) {
          const dateObj = new Date(fallbackDate);
          if (!Number.isNaN(dateObj.getTime())) {
            const dateKey = formatDateKey(dateObj);
            addEventInstance(dateKey, dateObj.getFullYear(), dateObj.getMonth() + 1, payload);
          }
        }
      }
    }

    const endTime = performance.now();
    if (__DEV__) {
      console.log(`⚡ Event processing: ${(endTime - startTime).toFixed(2)}ms for ${calendarEventsForCalendar.length} events, ${postsForCalendar.length} posts`);
    }

    return { eventsByDateMap: dateMap, monthEventCountMap: monthMap };
  }, [postsForCalendar, calendarEventsForCalendar, categoryColorsCache]);

  // Calculate min/max years from events and posts to dynamically adjust calendar range
  const eventYearRange = React.useMemo(() => {
    const years = new Set<number>();
    
    // Add years from calendar events
    calendarEvents.forEach(event => {
      if (event.year) {
        years.add(event.year);
      } else if (event.isoDate || event.date) {
        const date = new Date(event.isoDate || event.date);
        if (!isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }
      }
      // Also check startDate and endDate for date ranges
      if (event.startDate) {
        const date = new Date(event.startDate);
        if (!isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }
      }
      if (event.endDate) {
        const date = new Date(event.endDate);
        if (!isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }
      }
    });
    
    // Add years from posts/announcements
    posts.forEach(post => {
      if (post.isoDate || post.date) {
        const date = new Date(post.isoDate || post.date);
        if (!isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }
      }
    });
    
    // Add current year as fallback
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    
    const yearArray = Array.from(years).sort((a, b) => a - b);
    return {
      min: yearArray.length > 0 ? yearArray[0] : currentYear,
      max: yearArray.length > 0 ? yearArray[yearArray.length - 1] : currentYear,
      all: yearArray
    };
  }, [calendarEvents, posts]);

  
  
  // Load posts/announcements from AdminDataService
  const loadPosts = useCallback(async () => {
    try {
      setIsLoadingPosts(true);
      const postsData = await AdminDataService.getPosts();
      setPosts(Array.isArray(postsData) ? postsData : []);
    } catch (error) {
      console.error('Failed to load posts:', error);
      setPosts([]);
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  // OPTIMIZED: Load calendar events and posts from backend (run once on mount)
  // Only load current month ± 1 month for fast initial load (like AdminDashboard)
  // Further sync is done manually via pull-to-refresh
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setIsLoadingEvents(true);
        setIsLoadingPosts(true);

        // OPTIMIZED: Only load current month ± 1 month for fast loading (like AdminDashboard)
        // This is much faster than loading 5 years!
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Load current month ± 1 month for smooth navigation
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth + 2, 0, 23, 59, 59); // Last day of next month

        console.log(`📅 Fast load: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (3 months)`);

        const [events, postsData] = await Promise.all([
          CalendarService.getEvents({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            limit: 500, // Reduced limit for 3 months
          }),
          AdminDataService.getPosts(),
        ]);

        console.log(`✅ Fast load complete: ${events.length} events, ${postsData.length} posts`);

        if (!cancelled) {
          setCalendarEvents(Array.isArray(events) ? events : []);
          setPosts(Array.isArray(postsData) ? postsData : []);

          // Mark loaded months in cache (for smart navigation)
          for (let i = -1; i <= 1; i++) {
            const checkMonth = new Date(currentYear, currentMonth + i, 1);
            loadedMonthsRef.current.add(`${checkMonth.getFullYear()}-${checkMonth.getMonth()}`);
          }
        }
      } catch (error) {
        console.error('Failed to load calendar data:', error);
        if (!cancelled) {
          setCalendarEvents([]);
          setPosts([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingEvents(false);
          setIsLoadingPosts(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Entrance animation disabled for debugging



  // OPTIMIZED: Pre-allocate array for better performance
  const getDaysInMonth = React.useCallback((date: Date) => {
    const start = dayjs.utc(date).tz(PH_TZ).startOf('month');
    const daysInMonth = start.daysInMonth();
    const firstDayOfMonth = start.day(); // 0=Sun..6=Sat in PH tz
    
    // Pre-calculate total cells needed
    const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;
    const days: Array<number | null> = new Array(totalCells);
    
    // Add leading empty cells so week starts on Sunday
    for (let i = 0; i < firstDayOfMonth; i++) {
      days[i] = null;
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days[firstDayOfMonth + i - 1] = i;
    }
    
    // Fill remaining cells with null
    for (let i = firstDayOfMonth + daysInMonth; i < totalCells; i++) {
      days[i] = null;
    }
    
    return days;
  }, []);

  const getMonthName = (date: Date) => {
    return dayjs.utc(date).tz(PH_TZ).format('MMMM');
  };

  // Track last calendar fetch time (moved before refreshCalendarEvents)
  const lastCalendarFetchTime = useRef<number>(0);
  const isFetchingCalendar = useRef<boolean>(false);
  const CALENDAR_FETCH_COOLDOWN = 3000; // 3 seconds cooldown for calendar events
  
  // OPTIMIZED: Track which months are already loaded to avoid unnecessary fetches
  const loadedMonthsRef = useRef<Set<string>>(new Set());
  
  // Helper: Check if events for a specific month are already loaded
  const hasEventsForMonth = useCallback((month: Date): boolean => {
    const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
    
    // Check if we've marked this month as loaded
    return loadedMonthsRef.current.has(monthKey);
  }, []);

  // OPTIMIZED: Refresh calendar events from backend (moved before navigation functions)
  // Smart loading: Only fetch if month is not already loaded, load wider range for buffer
  const refreshCalendarEvents = useCallback(async (forceRefresh: boolean = false, yearRange?: { startYear: number; endYear: number }, targetMonth?: Date) => {
    // Prevent duplicate simultaneous fetches
    if (isFetchingCalendar.current && !forceRefresh) {
      return;
    }

    // Cooldown check
    const now = Date.now();
    if (!forceRefresh && now - lastCalendarFetchTime.current < CALENDAR_FETCH_COOLDOWN) {
      return;
    }

    try {
      setIsLoadingEvents(true);
      
      let startDate: Date;
      let endDate: Date;
      let monthsToLoad: string[] = [];
      
      if (yearRange) {
        // Use provided range (e.g., from CSV upload) - load full year range
        startDate = new Date(yearRange.startYear, 0, 1);
        endDate = new Date(yearRange.endYear, 11, 31, 23, 59, 59);
        console.log(`📅 Loading calendar events: ${yearRange.startYear}-${yearRange.endYear} (${yearRange.endYear - yearRange.startYear + 1} years)`);
        // Mark all months in range as loaded
        for (let year = yearRange.startYear; year <= yearRange.endYear; year++) {
          for (let month = 0; month < 12; month++) {
            loadedMonthsRef.current.add(`${year}-${month}`);
          }
        }
      } else if (targetMonth) {
        // OPTIMIZED: Check if we already have events for this month
        if (!forceRefresh && hasEventsForMonth(targetMonth)) {
          console.log(`✅ Events for ${targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} already loaded, skipping fetch`);
          setIsLoadingEvents(false);
          return;
        }
        
        // Load target month ± 2 months for buffer (so navigation is smooth)
        const targetYear = targetMonth.getFullYear();
        const targetMonthIndex = targetMonth.getMonth();
        startDate = new Date(targetYear, targetMonthIndex - 2, 1);
        endDate = new Date(targetYear, targetMonthIndex + 3, 0, 23, 59, 59);
        
        // Mark loaded months
        for (let i = -2; i <= 2; i++) {
          const checkMonth = new Date(targetYear, targetMonthIndex + i, 1);
          monthsToLoad.push(`${checkMonth.getFullYear()}-${checkMonth.getMonth()}`);
        }
        
        console.log(`📅 Loading calendar events for month: ${targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (5 months buffer)`);
      } else {
        // Default: Load current month ± 2 months for buffer (fast initial load with navigation buffer)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        startDate = new Date(currentYear, currentMonth - 2, 1);
        endDate = new Date(currentYear, currentMonth + 3, 0, 23, 59, 59);
        
        // Mark loaded months
        for (let i = -2; i <= 2; i++) {
          const checkMonth = new Date(currentYear, currentMonth + i, 1);
          monthsToLoad.push(`${checkMonth.getFullYear()}-${checkMonth.getMonth()}`);
        }
        
        console.log(`📅 Loading calendar events: current month ± 2 (5 months buffer)`);
      }
      
      // Mark months as loaded
      monthsToLoad.forEach(monthKey => loadedMonthsRef.current.add(monthKey));
      
      isFetchingCalendar.current = true;
      lastCalendarFetchTime.current = now;
      
      // Use caching - CalendarService now supports caching
      const events = await CalendarService.getEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 500, // Reduced limit for 5 months
      });
      
      console.log(`✅ Loaded ${events.length} calendar events`);
      
      // Merge with existing events (avoid duplicates)
      setCalendarEvents(prevEvents => {
        const existingIds = new Set(
          prevEvents.map(e => (e as any)._id || (e as any).id || `${(e as any).isoDate}-${(e as any).title}`)
        );
        const newEvents = events.filter(e => {
          const id = (e as any)._id || (e as any).id || `${(e as any).isoDate}-${(e as any).title}`;
          return !existingIds.has(id);
        });
        return [...prevEvents, ...newEvents];
      });
    } catch (error) {
      if (__DEV__) console.error('Failed to refresh calendar events:', error);
      // Don't clear events on error, keep what we have
    } finally {
      setIsLoadingEvents(false);
      isFetchingCalendar.current = false;
    }
  }, [hasEventsForMonth]);

  const selectMonth = (monthIndex: number, year?: number) => {
    const targetYear = year || currentMonth.getUTCFullYear();
    const newMonth = new Date(Date.UTC(targetYear, monthIndex, 1));
    setCurrentMonth(newMonth);
    // Ensure the selected date moves into the chosen month so the week view reflects it
    setSelectedDate(new Date(Date.UTC(newMonth.getUTCFullYear(), newMonth.getUTCMonth(), 1)));
    closeMonthPicker();
    
    // OPTIMIZED: Only load if month not already loaded (smart caching)
    refreshCalendarEvents(false, undefined, newMonth);
  };

  const navigateToNextMonth = useCallback(() => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    setCurrentMonth(nextMonth);
    setSelectedDate(new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 1)));
    Haptics.selectionAsync();
    
    // OPTIMIZED: Only load if month not already loaded (no fetch if already cached)
    refreshCalendarEvents(false, undefined, nextMonth);
  }, [currentMonth, refreshCalendarEvents]);

  const navigateToPreviousMonth = useCallback(() => {
    const prevMonth = new Date(currentMonth);
    prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
    setCurrentMonth(prevMonth);
    setSelectedDate(new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth(), 1)));
    Haptics.selectionAsync();
    
    // OPTIMIZED: Only load if month not already loaded (no fetch if already cached)
    refreshCalendarEvents(false, undefined, prevMonth);
  }, [currentMonth, refreshCalendarEvents]);

  const openMonthPicker = () => {
    setShowMonthPicker(true);
    Animated.parallel([
      Animated.spring(monthPickerScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(monthPickerOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeMonthPicker = () => {
    Animated.parallel([
      Animated.spring(monthPickerScaleAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(monthPickerOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowMonthPicker(false);
    });
  };

  // Single tap handler for month/year
  const handleMonthYearTap = useCallback(() => {
    openMonthPicker();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [openMonthPicker]);

  const transformPostToEvent = (p: any) => ({
    id: p.id,
    title: p.title,
    dateKey: parseAnyDateToKey(p.isoDate || p.date),
    time: p.time || '',
    type: p.category || 'Announcement',
    color: categoryToColors(p.category).dot,
    chip: categoryToColors(p.category),
    isPinned: !!p.isPinned,
    isUrgent: !!p.isUrgent,
  });

  const getEventsForDate = useCallback((date: Date) => {
    const key = formatDateKey(date);
    return eventsByDateMap.get(key) || [];
  }, [eventsByDateMap]);

  const isToday = (date: Date) => {
    return getPHDateKey(date, PH_TZ) === getPHDateKey(new Date(), PH_TZ);
  };

  const isSelected = (date: Date) => {
    return selectedDate ? getPHDateKey(date, PH_TZ) === getPHDateKey(selectedDate, PH_TZ) : false;
  };

  const handleDayPress = useCallback((date: Date) => {
    setSelectedDate(date);
    const events = getEventsForDate(date);
    if (events && events.length > 0) {
      // Get the first event and find its full data from calendarEvents or posts
      const firstEvent = events[0];
      
      // Check if it's a post (from AdminDataService)
      let fullEvent = null;
      if (firstEvent.source === 'post') {
        fullEvent = posts.find((p: any) => p.id === firstEvent.id) || firstEvent;
      } else {
        // It's a calendar event (from CalendarService)
        fullEvent = calendarEvents.find((e: any) => {
          // Try to match by _id first
          if (e._id === firstEvent.id) return true;
          // Try to match by constructed ID
          if (`calendar-${e.isoDate}-${e.title}` === firstEvent.id) return true;
          // Try to match by date and title
          const eventDateKey = parseAnyDateToKey(e.isoDate || e.date);
          const checkDateKey = formatDateKey(date);
          return eventDateKey === checkDateKey && e.title === firstEvent.title;
        }) || firstEvent;
      }
      
      const eventData = fullEvent || firstEvent;
      
      // Set the selected event and initialize edit fields
      setSelectedEvent(eventData);
      setEditTitle(eventData?.title || '');
      setEditDescription(eventData?.description || '');
      
      // Set date and time for editing
      if (eventData?.isoDate || eventData?.date) {
        const eventDate = new Date(eventData.isoDate || eventData.date);
        setSelectedDateObj(eventDate);
        setEditDate(formatDate(eventDate));
      } else {
        // If no date in event, use the clicked date
        setSelectedDateObj(date);
        setEditDate(formatDate(date));
      }
      setEditTime(eventData?.time || '');
      setIsEditing(false);
      
      // Also keep selectedDateEvents for backward compatibility
      setSelectedDateEvents(events);
      setSelectedDateForDrawer(date);
      setShowEventDrawer(true);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.selectionAsync();
    }
  }, [getEventsForDate, calendarEvents, posts]);
  
  const closeEventDrawer = useCallback(() => {
    setShowEventDrawer(false);
  }, []);

  const openDeleteAllModal = useCallback(() => {
    if (calendarEvents.length === 0) {
      Alert.alert('No Events', 'There are no events to delete.');
      return;
    }
    
    setShowDeleteAllModal(true);
    
    // Animate modal opening
    Animated.parallel([
      Animated.spring(deleteAllModalSlideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(deleteAllModalBackdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [calendarEvents.length, deleteAllModalSlideAnim, deleteAllModalBackdropOpacity]);

  const closeDeleteAllModal = useCallback(() => {
    Animated.parallel([
      Animated.spring(deleteAllModalSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(deleteAllModalBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowDeleteAllModal(false);
    });
  }, [deleteAllModalSlideAnim, deleteAllModalBackdropOpacity]);

  const getAllEventsGrouped = React.useCallback(() => {
    if (!Array.isArray(calendarEventsForCalendar) && !Array.isArray(postsForCalendar)) return [];
    
    const all: any[] = [];
    
    // Add posts/announcements from AdminDataService
    postsForCalendar.forEach((post: any) => {
      const eventDateKey = parseAnyDateToKey(post.isoDate || post.date);
      if (eventDateKey) {
        const dateObj = new Date(post.isoDate || post.date);
        all.push({
          id: post.id,
          title: post.title,
          dateKey: eventDateKey,
          time: post.time || 'All Day',
          type: post.category || 'Announcement',
          color: categoryToColors(post.category).dot,
          chip: categoryToColors(post.category),
          dateObj: dateObj,
          year: dateObj.getFullYear(),
          description: post.description,
          source: 'post',
        });
      }
    });
    
    // Add events from calendarEvents (CalendarService)
    // Use a Set to track date ranges we've already added (to avoid duplicates)
    const dateRangeKeys = new Set<string>();
    
    if (Array.isArray(calendarEventsForCalendar)) {
      calendarEventsForCalendar.forEach(event => {
        // For date ranges, use start date as the key and avoid duplicates
        let eventDateKey: string | null = null;
        let dateObj: Date | null = null;
        let eventYear: number | null = null;
        
        if (event.dateType === 'date_range' && event.startDate && event.endDate) {
          const rangeKey = `${event.title}-${event.startDate}-${event.endDate}`;
          if (dateRangeKeys.has(rangeKey)) {
            return; // Skip duplicate date range
          }
          dateRangeKeys.add(rangeKey);
          eventDateKey = parseAnyDateToKey(event.startDate);
          dateObj = new Date(event.startDate);
          eventYear = dateObj.getFullYear();
        } else if (event.dateType === 'week' || event.dateType === 'month') {
          // Week/month-only events - use placeholder date for grouping
          eventDateKey = parseAnyDateToKey(event.isoDate || event.date);
          dateObj = new Date(event.isoDate || event.date);
          eventYear = event.year || dateObj.getFullYear();
        } else {
          eventDateKey = parseAnyDateToKey(event.isoDate || event.date);
          dateObj = new Date(event.isoDate || event.date);
          eventYear = dateObj.getFullYear();
        }
        
        if (eventDateKey) {
          all.push({
            id: event._id || `calendar-${event.isoDate}-${event.title}`,
            title: event.title,
            dateKey: eventDateKey,
            time: event.time || 'All Day',
            type: event.category || 'Announcement',
            color: categoryToColors(event.category).dot,
            chip: categoryToColors(event.category),
            dateObj: dateObj,
            year: eventYear,
            dateType: event.dateType,
            startDate: event.startDate,
            endDate: event.endDate,
            weekOfMonth: event.weekOfMonth,
            month: event.month,
          });
        }
      });
    }
    
    // Group by year first, then by date
    const yearMap = new Map<number, Map<string, any[]>>();
    
    all.forEach(e => {
      const year = e.year || new Date(e.dateKey).getFullYear();
      const dateKey = e.dateKey;
      
      if (!yearMap.has(year)) {
        yearMap.set(year, new Map());
      }
      const dateMap = yearMap.get(year)!;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(e);
    });
    
    // Convert to nested structure: year -> dates -> events
    const result: Array<{ year: number; dates: Array<{ key: string; items: any[] }> }> = [];
    
    Array.from(yearMap.entries())
      .sort((a, b) => a[0] - b[0]) // Sort years ascending
      .forEach(([year, dateMap]) => {
        const dates = Array.from(dateMap.entries())
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()) // Sort dates ascending
          .map(([key, items]) => ({ key, items }));
        result.push({ year, dates });
      });
    
    return result;
  }, [calendarEventsForCalendar, postsForCalendar]); // Only recompute when filtered data changes

  const getMonthEventCount = (dateRef: Date) => {
    const key = `${dateRef.getFullYear()}-${dateRef.getMonth() + 1}`;
    return monthEventCountMap.get(key) || 0;
  };


  // OPTIMIZED: Don't fetch on mount - useFocusEffect handles initial load
  // This prevents double loading when screen first mounts
  // useEffect(() => {
  //   refreshCalendarEvents(true); // Force refresh on mount
  // }, []); // Empty deps - only run on mount

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Refresh both calendar events and posts
      await Promise.all([
        refreshCalendarEvents(true, undefined, currentMonth),
        loadPosts(),
      ]);
    } catch (error) {
      if (__DEV__) console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshCalendarEvents, loadPosts, currentMonth]);

  // CSV upload handler
  const handleCSVUpload = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = Array.isArray((result as any).assets) ? (result as any).assets[0] : (result as any);
      const fileName = asset.name || 'unknown';
      const fileUri = asset?.fileCopyUri || asset?.uri;

      if (!fileName.toLowerCase().endsWith('.csv')) {
        Alert.alert('Invalid File', 'Please select a CSV file');
        return;
      }

      if (!fileUri) {
        Alert.alert('File Unavailable', 'Unable to access the selected CSV file. Please try selecting it again.');
        return;
      }

      setIsUploadingCSV(true);
      setIsProcessingCSV(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Step 1: Upload CSV file
      const uploadResult = await AdminFileService.uploadCalendarCSV(fileUri, fileName);
      
      // Upload complete - switch to processing state
      setIsUploadingCSV(false);
      setIsProcessingCSV(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Step 2: Refresh calendar events to show new dates (OPTIMIZED: only refresh relevant years)
      // Extract year from uploaded events if available, otherwise use current year ± 1
      const currentYear = new Date().getFullYear();
      const uploadYear = uploadResult.year || currentYear; // If backend returns the year of uploaded events
      
      // Only refresh events for the upload year ± 1 year (much faster than 10 years!)
      await refreshCalendarEvents(true, {
        startYear: Math.max(uploadYear - 1, currentYear - 2),
        endYear: Math.min(uploadYear + 1, currentYear + 2)
      });
      
      // Processing complete
      setIsProcessingCSV(false);
      
      // Show success message after refresh
      const eventsAdded = uploadResult.eventsAdded || 0;
      const eventsUpdated = uploadResult.eventsUpdated || 0;
      const totalEvents = eventsAdded + eventsUpdated;
      
      Alert.alert(
        'CSV Successfully Uploaded!',
        `CSV successfully uploaded!\n\n${eventsAdded} new event${eventsAdded !== 1 ? 's' : ''} added.\n${eventsUpdated} event${eventsUpdated !== 1 ? 's' : ''} updated.\n\nTotal: ${totalEvents} event${totalEvents !== 1 ? 's' : ''} processed.\n\nThe calendar has been refreshed.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMessage = error.message || 'Failed to upload CSV file';
      let displayMessage = 'CSV failed to upload. Please check your CSV file format and try again.';
      let alertTitle = 'CSV Failed to Upload';
      
      if (errorMessage.includes('must contain at least 3')) {
        displayMessage = 'CSV failed to upload.\n\nYour CSV must contain at least 3 of the required fields:\n\n• Type (Institutional or Academic)\n• Event (Required)\n• DateType\n• StartDate\n• EndDate\n• Year\n• Month\n• WeekOfMonth\n• Description';
      } else if (errorMessage.includes('must contain "Event"')) {
        displayMessage = 'CSV failed to upload.\n\nYour CSV must contain an "Event" column (or "Title"/"Name"). The Event field is required.';
      } else if (errorMessage.includes('HTTP error')) {
        displayMessage = 'CSV failed to upload.\n\nFailed to connect to the server. Please check your internet connection and try again.';
      } else {
        displayMessage = `CSV failed to upload.\n\n${errorMessage}\nPlease check your CSV file format and try again.`;
      }
      
      Alert.alert(alertTitle, displayMessage);
    } finally {
      setIsUploadingCSV(false);
      setIsProcessingCSV(false);
    }
  }, [refreshCalendarEvents]);

  const handleDeleteAllConfirm = useCallback(async () => {
    setIsDeletingAll(true);
    try {
      const result = await CalendarService.deleteAllEvents();
      
      if (result.success) {
        // Refresh calendar events
        await refreshCalendarEvents(true); // Force refresh after delete
        
        // Close modal
        closeDeleteAllModal();
        
        // Show success message
        Alert.alert('Success', `All ${result.deletedCount || calendarEvents.length} events deleted successfully.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', 'Failed to delete all events. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('Failed to delete all events:', error);
      Alert.alert('Error', 'Failed to delete all events. Please check your connection and try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDeletingAll(false);
    }
  }, [refreshCalendarEvents, closeDeleteAllModal, calendarEvents.length]);

  // Handler for opening PostUpdate screen when long pressing a date
  const handleOpenAddEvent = useCallback((date?: Date) => {
    // Navigate to PostUpdate screen (it will handle date selection internally)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('PostUpdate');
  }, [navigation]);

  // OPTIMIZED: Memoized Calendar Day Component with long press detection for unmarked cells
  // Using React.memo with custom comparison to prevent unnecessary re-renders
  const CalendarDay = memo(({ date, day, isCurrentDay, isSelectedDay, index, eventsForDay, theme, onPress, onLongPress }: { date: Date; day: number | null; isCurrentDay: boolean; isSelectedDay: boolean; index: number; eventsForDay: any[]; theme: any; onPress: (date: Date) => void; onLongPress: (date: Date) => void }) => {
    const hasEvents = eventsForDay && eventsForDay.length > 0;
    
    const handlePress = () => {
      onPress(date);
    };
    
    const handleLongPress = () => {
      // Only allow long press on unmarked cells (no events)
      if (!hasEvents) {
        onLongPress(date);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    };
    if (!day) return (
      <View
        style={[
          styles.calendarDay,
          {
            backgroundColor: theme.colors.surfaceAlt,
            borderRightColor: theme.colors.border,
            borderBottomColor: theme.colors.border,
            borderRightWidth: (index % 7) === 6 ? 0 : StyleSheet.hairlineWidth,
          },
        ]}
      />
    );
    
    // Get cell color based on event types
    const cellColor = getCellColor(eventsForDay);
    
    // Determine border styling
    const isLastColumn = (index % 7) === 6;
    const isSelected = isSelectedDay && !isCurrentDay;
    
    return (
      <TouchableOpacity 
        style={[
          styles.calendarDay,
          { 
            backgroundColor: cellColor || theme.colors.card,
            // Selected day: blue border around entire cell (2px)
            // Non-selected: normal grid borders (hairline)
            borderTopWidth: isSelected ? 2 : 0,
            borderTopColor: isSelected ? theme.colors.accent : 'transparent',
            borderLeftWidth: isSelected ? 2 : 0,
            borderLeftColor: isSelected ? theme.colors.accent : 'transparent',
            borderRightWidth: isLastColumn ? (isSelected ? 2 : 0) : (isSelected ? 2 : StyleSheet.hairlineWidth),
            borderRightColor: isSelected ? theme.colors.accent : theme.colors.border,
            borderBottomWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
            borderBottomColor: isSelected ? theme.colors.accent : theme.colors.border,
            opacity: cellColor ? 0.85 : 1,
          }
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
      >
        <View style={styles.dayContent}>
          <View style={[
            styles.dayNumberContainer,
            isCurrentDay && styles.todayContainer,
            isCurrentDay && { backgroundColor: theme.colors.accent }, // Theme color for current day
            !isCurrentDay && cellColor && { backgroundColor: cellColor }, // Only apply cell color if not current day
          ]}>
            <Text
              accessibilityRole="button"
              accessibilityLabel={`Select ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
              accessibilityHint={hasEvents ? "Tap to view events for this date" : "Selects this date"}
              style={[
                styles.dayNumber,
                { fontSize: theme.fontSize.scaleSize(12) },
                isCurrentDay && { color: '#FFFFFF', fontWeight: '700' }, // White text for current day (blue background)
                !isCurrentDay && { color: cellColor ? '#FFFFFF' : theme.colors.text }, // White if cell has color, otherwise theme text
                isCurrentDay && styles.todayText,
                !isCurrentDay && cellColor && { color: '#FFFFFF', fontWeight: '700' } // White text for colored cells (non-current day)
              ]}
            >
              {day}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  // OPTIMIZED: Use direct map lookup instead of function call for better performance
  const renderCalendarDay = useCallback((date: Date, day: number | null, isCurrentDay: boolean, isSelectedDay: boolean, key: number) => {
    // Direct map lookup - faster than calling getEventsForDate
    const dateKey = formatDateKey(date);
    const eventsForDay = eventsByDateMap.get(dateKey) || [];
    
    return (
      <CalendarDay
        key={key}
        date={date}
        day={day}
        isCurrentDay={isCurrentDay}
        isSelectedDay={isSelectedDay}
        index={key}
        eventsForDay={eventsForDay}
        theme={t}
        onPress={handleDayPress}
        onLongPress={handleOpenAddEvent}
      />
    );
  }, [eventsByDateMap, t, handleDayPress, handleOpenAddEvent]);


  // List animation - DISABLED FOR PERFORMANCE DEBUGGING
  React.useEffect(() => {
    // Set values immediately without animation
    listAnim.setValue(1);
    dotScale.setValue(1);
  }, [selectedDate]);

  // OPTIMIZED: Memoize days calculation
  const days = React.useMemo(() => getDaysInMonth(currentMonth), [currentMonth, getDaysInMonth]);
  
  // Static array - no need for useMemo (constant value)
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={[styles.container, {
      backgroundColor: 'transparent',
    }]} collapsable={false}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        translucent={true}
      />

      {/* Background Gradient - Soft beige (Copilot-style) */}
      <LinearGradient
        colors={[
          isDarkMode ? '#0B1220' : '#FBF8F3',
          isDarkMode ? '#111827' : '#F8F5F0',
          isDarkMode ? '#1F2937' : '#F5F2ED'
        ]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint={isDarkMode ? 'dark' : 'light'}
        style={styles.backgroundGradient}
      />

      {/* Animated Floating Background Orb (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
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
              colors={[t.colors.orbColors.orange1, t.colors.orbColors.orange2, t.colors.orbColors.orange3]}
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

      {/* Header - Copilot Style matching user Calendar */}
      <View style={[styles.header, { 
        marginTop: insets.top,
        marginLeft: insets.left,
        marginRight: insets.right,
      }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={() => setIsSidebarOpen(true)} 
            style={styles.menuButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Open sidebar"
            accessibilityRole="button"
          >
            <View style={styles.customHamburger} pointerEvents="none">
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
            </View>
          </TouchableOpacity>
        </View>
        <Text 
          style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(17) }]}
          pointerEvents="none"
        >
          DOrSU Calendar
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={() => navigation.navigate('AdminSettings')} 
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Admin profile - Go to settings"
            accessibilityRole="button"
          >
            <View style={[styles.profileIconCircle, { backgroundColor: t.colors.accent }]} pointerEvents="none">
              <Text style={[styles.profileInitials, { fontSize: t.fontSize.scaleSize(13) }]}>AD</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>


      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, {
          paddingTop: 12,
          paddingBottom: safeInsets.bottom + 80, // Bottom nav bar height + safe area
        }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.colors.accent}
            colors={[t.colors.accent]}
          />
        }
      >
        {/* Calendar Card - Fixed below header */}
        {/* Animation wrapper removed for debugging */}
        <View>
          {/* Calendar Card - Glassmorphic */}
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.calendarCard, { backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)' }]}
          >

          {/* Month selector at top of calendar */}
          <View style={[styles.calendarMonthHeader, { backgroundColor: 'transparent', borderBottomColor: 'rgba(255, 255, 255, 0.2)' }]}>
            <View style={styles.monthSelectorContent}>
              <TouchableOpacity
                style={styles.monthNavButton}
                onPress={navigateToPreviousMonth}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                accessibilityHint="Navigate to previous month"
              >
                <Text style={[styles.angleBrackets, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(18) }]}>
                  {'<'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.monthSelectorButton}
                onPress={handleMonthYearTap}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open month picker"
                accessibilityHint="Tap to open month and year picker"
              >
                <Text style={[styles.monthHeaderText, { color: t.colors.text, fontSize: t.fontSize.scaleSize(16) }]}>
                  {getMonthName(currentMonth)} {currentMonth.getFullYear()}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.monthNavButton}
                onPress={navigateToNextMonth}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                accessibilityHint="Navigate to next month"
              >
                <Text style={[styles.angleBrackets, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(18) }]}>
                  {'>'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Week day headers */}
          <View style={[styles.weekHeader, { backgroundColor: 'transparent' }]}>
            {weekDays && Array.isArray(weekDays) && weekDays.map((day, index) => (
              <View key={index} style={[styles.weekDayHeader, { borderRightColor: t.colors.border }]}>
                <Text
                  style={[styles.weekDayText, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(12) }]}
                  accessibilityElementsHidden={true}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {/* Show full month */}
            {days && Array.isArray(days) && days.map((day, index) => {
              const currentDate = day ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day) : null;
              const isCurrentDay = currentDate ? isToday(currentDate) : false;
              const isSelectedDay = currentDate ? isSelected(currentDate) : false;
              return renderCalendarDay(currentDate || new Date(), day, isCurrentDay, !!isSelectedDay, index);
            })}
          </View>

          {/* Event Type Legend - Inside Calendar Card */}
          <View style={styles.legendContainer}>
            <View style={styles.legendHeaderRow}>
              <Text style={[styles.eventCountText, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(11) }]}>
                {getMonthEventCount(currentMonth)} {getMonthEventCount(currentMonth) === 1 ? 'event' : 'events'} this month
              </Text>
            </View>
            <View style={styles.legendItems}>
              {[
                { type: 'Academic', key: 'academic', color: '#10B981' },
                { type: 'Institutional', key: 'institutional', color: t.colors.accent },
                { type: 'Event', key: 'event', color: '#F59E0B' },
                { type: 'Announcement', key: 'announcement', color: '#3B82F6' },
                { type: 'News', key: 'news', color: '#8B5CF6' },
              ].map((item) => {
                const isSelected = selectedLegendType === item.key;
                return (
                  <TouchableOpacity
                    key={item.type}
                    style={[
                      styles.legendItem,
                      isSelected && styles.legendItemSelected,
                      isSelected && { 
                        backgroundColor: item.color + '20',
                        borderColor: item.color
                      }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      // Toggle: if already selected, deselect (show all), otherwise select this type
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
                    <Text style={[
                      styles.legendItemText,
                      { color: t.colors.text, fontSize: t.fontSize.scaleSize(12) },
                      isSelected && { fontWeight: '700', color: item.color }
                    ]}>
                      {item.type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          </BlurView>
        </View>

        {/* Admin Actions Section - Info Icon, Upload CSV & Delete All */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.adminActionsCard, { backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)' }]}
        >
          <View style={styles.adminActionsTitleRow}>
            <Text style={[styles.adminActionsTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(16) }]}>
              CSV Calendar file upload
            </Text>
            <TouchableOpacity
              style={styles.helpButtonInline}
              onPress={() => {
                navigation.navigate('CalendarHelp');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="information-circle-outline" size={18} color={t.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.adminActionsRow}>
            <TouchableOpacity
              style={[styles.csvUploadButton, { 
                backgroundColor: t.colors.surface,
                borderColor: t.colors.border,
                opacity: (isUploadingCSV || isProcessingCSV) ? 0.6 : 1
              }]}
              onPress={handleCSVUpload}
              disabled={isUploadingCSV || isProcessingCSV}
              activeOpacity={0.7}
            >
              {isUploadingCSV ? (
                <>
                  <ActivityIndicator size="small" color={t.colors.accent} />
                  <Text style={[styles.csvUploadText, { color: t.colors.accent, fontSize: t.fontSize.scaleSize(11) }]}>Uploading...</Text>
                </>
              ) : isProcessingCSV ? (
                <>
                  <ActivityIndicator size="small" color={t.colors.accent} />
                  <Text style={[styles.csvUploadText, { color: t.colors.accent, fontSize: t.fontSize.scaleSize(11) }]}>Processing...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={14} color={t.colors.accent} />
                  <Text style={[styles.csvUploadText, { color: t.colors.accent, fontSize: t.fontSize.scaleSize(11) }]}>Upload CSV</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteAllButton, { 
                backgroundColor: t.colors.surface,
                borderColor: '#DC2626',
                opacity: isDeletingAll ? 0.6 : 1
              }]}
              onPress={openDeleteAllModal}
              disabled={isDeletingAll || calendarEvents.length === 0}
              activeOpacity={0.7}
            >
              {isDeletingAll ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  <Text style={[styles.deleteAllText, { color: '#DC2626', fontSize: t.fontSize.scaleSize(11) }]}>Delete All</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Month Picker Modal */}
        <MonthPickerModal
          visible={showMonthPicker}
          currentMonth={currentMonth}
          onClose={closeMonthPicker}
          onSelectMonth={selectMonth}
          scaleAnim={monthPickerScaleAnim}
          opacityAnim={monthPickerOpacityAnim}
          minYear={eventYearRange.min}
          maxYear={eventYearRange.max}
        />
      </ScrollView>

      {/* View Event Modal */}
      <ViewEventModal
        visible={showEventDrawer}
        onClose={closeEventDrawer}
        selectedEvent={selectedEvent}
        selectedDateEvents={selectedDateEvents}
        selectedDate={selectedDateForDrawer}
        onEdit={() => {
          // Navigate to PostUpdate for editing if it's a post
          if (selectedEvent?.source === 'post') {
            navigation.navigate('PostUpdate', { postId: selectedEvent.id });
            closeEventDrawer();
          } else {
            // For calendar events, you might want to implement edit functionality
            // For now, just close the modal
            Alert.alert('Edit Event', 'Event editing functionality coming soon');
          }
        }}
        onDelete={async () => {
          if (!selectedEvent) return;
          
          // ViewEventModal handles confirmation, just execute deletion
          try {
            setIsDeleting(true);
            if (selectedEvent.source === 'post') {
              // Delete post using AdminDataService
              await AdminDataService.deletePost(selectedEvent.id);
            } else {
              // Delete calendar event
              await CalendarService.deleteEvent(selectedEvent._id || selectedEvent.id);
            }
            await refreshCalendarEvents(true);
            closeEventDrawer();
            setSelectedEvent(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } finally {
            setIsDeleting(false);
          }
        }}
      />

      {/* Delete All Confirmation Modal */}
      <DeleteAllModal
        visible={showDeleteAllModal}
        onClose={closeDeleteAllModal}
        onConfirm={handleDeleteAllConfirm}
        eventCount={calendarEvents.length}
        isDeleting={isDeletingAll}
        slideAnim={deleteAllModalSlideAnim}
        backdropOpacity={deleteAllModalBackdropOpacity}
      />

      {/* Bottom Navigation Bar - Fixed position */}
      <View style={[styles.bottomNavContainer, {
        bottom: 0,
        paddingBottom: safeInsets.bottom,
      }]} collapsable={false}>
        <AdminBottomNavBar
          activeTab="calendar"
          onChatPress={() => navigation.navigate('AdminAIChat')}
          onDashboardPress={() => navigation.navigate('AdminDashboard')}
          onCalendarPress={() => navigation.navigate('AdminCalendar')}
        />
      </View>

      {/* Admin Sidebar Component */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  floatingOrb1: {
    width: 500,
    height: 500,
    borderRadius: 250,
    opacity: 0.5,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    zIndex: 10,
    position: 'relative',
  },
  headerLeft: {
    width: 44,
    zIndex: 11,
  },
  menuButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
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
  profileButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
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
    backgroundColor: 'transparent', // Will be set dynamically via theme
    pointerEvents: 'none',
  },
  profileInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 1,
    pointerEvents: 'none',
  },
  headerRight: {
    width: 44,
    alignItems: 'flex-end',
    zIndex: 11,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 998,
  },
  adminActionsCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
  },
  adminActionsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  adminActionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  helpButtonInline: {
    padding: 2,
    marginLeft: -2,
  },
  adminActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  legendWrapper: {
    position: 'relative',
    zIndex: 2000,
    marginBottom: 12,
    elevation: 20,
  },
  legendCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
  },
  legendContainer: {
    gap: 8,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 8,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  legendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
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
  },
  eventCountText: {
    fontSize: 11,
    fontWeight: '500',
    fontStyle: 'italic',
    opacity: 0.7,
  },
  calendarCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  calendarMonthHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  monthSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  monthSelectorButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  monthNavButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthHeaderText: {
    fontSize: 16,
    fontWeight: '700',
  },
  angleBrackets: {
    fontSize: 18,
    fontWeight: '700',
  },
  weekHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekDayHeader: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  calendarDay: {
    width: '14.285%', // 100% / 7 days
    aspectRatio: 1,
    // Border widths and colors are set dynamically in the component
  },
  dayContent: {
    flex: 1,
    padding: 2,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  todayContainer: {
    backgroundColor: 'transparent', // Will be set dynamically via theme // Blue for current day
  },
  todayText: {
    color: '#fff',
    fontWeight: '700',
  },
  selectedContainer: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  selectedText: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  eventIndicators: {
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  eventsSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  emptyStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
  emptyStateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  emptyStateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyStateBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventsHeader: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  eventsHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventsHeaderTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  eventsHeaderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eventsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterEventsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventFilterContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexShrink: 1,
    flex: 1,
    justifyContent: 'flex-end',
  },
  timeRangeToggleContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  timeRangeDropdownWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  timeRangeDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
  },
  timeRangeDropdownText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeRangeDropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 1000,
  },
  timeRangeDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  timeRangeDropdownOptionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  eventTypeToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    minWidth: 80,
  },
  eventTypeToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  segmentedToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  segmentItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segmentItemActive: {
    // Background color applied inline for theme awareness
  },
  segmentText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: theme.colors.accent,
  },
  infoIconButton: {
    padding: 2,
    marginLeft: -6,
  },
  eventTypeToggleContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  eventsIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  eventsBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  eventsBadgeCompact: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 6,
  },
  eventsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eventsSubtitle: {
    fontSize: 12,
    marginTop: -6,
    marginBottom: 12,
  },
  eventsSubtitleRowEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: -6,
    marginBottom: 12,
  },
  eventsHeaderDivider: {
    height: 1,
    marginBottom: 10,
  },
  monthHelperText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  groupContainer: {
    marginBottom: 12,
  },
  groupHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  eventDateRow: {
    marginBottom: 4,
  },
  eventDateText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventSmallTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  eventSmallTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  addEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  addEventText: {
    fontSize: 14,
    fontWeight: '600',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  eventAccent: {
    width: 2,
    height: '100%',
    borderRadius: 1,
    marginRight: 10,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  eventTimeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusSep: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  eventTypeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  eventTypeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  daySummarySection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  daySummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  daySummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  daySummaryDate: {
    fontSize: 24,
    fontWeight: '800',
  },
  daySummaryInfo: {
    flex: 1,
  },
  daySummaryDay: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  daySummaryCount: {
    fontSize: 12,
  },
  eventInnerDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 6,
  },
  inlineCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  inlineCalloutText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  inlineCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  inlineCreateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  csvUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
  },
  csvUploadText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
  },
  deleteAllText: {
    fontSize: 11,
    fontWeight: '600',
  },
  helpButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedControlContainer: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  segmentedSelector: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentedOptionsContainer: {
    flexDirection: 'row',
    width: '100%',
    zIndex: 1,
  },
  segmentedOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  yearGroupContainer: {
    marginBottom: 24,
  },
  yearHeaderText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 4,
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawerContentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  drawerHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  drawerHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  drawerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  drawerScrollView: {
    flex: 1,
  },
  drawerScrollContent: {
    padding: 20,
    paddingTop: 16,
  },
  drawerEventCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  drawerEventAccent: {
    width: 3,
    borderRadius: 2,
    marginRight: 12,
  },
  drawerEventContent: {
    flex: 1,
  },
  drawerEventTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  drawerEventDivider: {
    height: 1,
    marginVertical: 8,
  },
  drawerEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  drawerEventText: {
    fontSize: 14,
    flex: 1,
  },
  drawerEventDescription: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  drawerEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  drawerEmptyText: {
    fontSize: 14,
  },
  drawerSection: {
    marginBottom: 20,
  },
  drawerEditField: {
    marginBottom: 20,
  },
  drawerFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  drawerInputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  drawerTextAreaContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 120,
  },
  drawerTextArea: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    minHeight: 100,
  },
  drawerCharCount: {
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  drawerAttachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  drawerAttachmentItem: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAttachmentImage: {
    width: '100%',
    height: '100%',
  },
  drawerAttachmentIcon: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  drawerActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  drawerDeleteButton: {
    backgroundColor: '#DC2626',
  },
  drawerEditButton: {
    backgroundColor: 'transparent', // Will be set dynamically via theme
  },
  drawerSaveButton: {
    backgroundColor: '#10B981',
  },
  drawerCancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  drawerActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAllWarningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  deleteAllWarningText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  deleteAllDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  deleteAllSubtext: {
    fontSize: 13,
    lineHeight: 18,
  },
  drawerEventSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  drawerEventSelectorAccent: {
    width: 3,
    height: 24,
    borderRadius: 2,
  },
  drawerEventSelectorText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AdminCalendar;
