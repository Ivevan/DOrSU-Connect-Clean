import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarGrid from '../../components/common/CalendarGrid';
import BottomNavBar from '../../components/navigation/BottomNavBar';
import Sidebar from '../../components/navigation/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useUpdates } from '../../contexts/UpdatesContext';
import { useCalendar } from '../../hooks/useCalendar';
import DeleteAllModal from '../../modals/DeleteAllModal';
import MonthPickerModal from '../../modals/MonthPickerModal';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import AdminFileService from '../../services/AdminFileService';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import CalendarService from '../../services/CalendarService';
import { formatDateKey, normalizeCategory, parseAnyDateToKey } from '../../utils/calendarUtils';

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


const AdminCalendar = () => {
  dayjs.extend(utc);
  dayjs.extend(timezone);
  const PH_TZ = 'Asia/Manila';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { isDarkMode, theme: t } = useThemeValues();
  const { isLoading: authLoading, userRole, isAdmin, isAuthenticated, userName, userEmail } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const isPendingAuthorization = isAuthorized === null;
  const scrollRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);
  const initialNow = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(Date.UTC(initialNow.getFullYear(), initialNow.getMonth(), 1)));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);
  const [profileImageError, setProfileImageError] = useState(false);
  
  // Background animation value (Copilot-style animated orb)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  
  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);
  
  // Calendar state
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([]);
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
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
  
  // Animation values
  const monthPickerScaleAnim = useRef(new Animated.Value(0)).current;
  const monthPickerOpacityAnim = useRef(new Animated.Value(0)).current;

  // Load user data immediately on mount for fast display
  useEffect(() => {
    let cancelled = false;
    const loadUserData = async () => {
      try {
        const user = getCurrentUser();
        if (user && !cancelled) {
          setCurrentUser(user);
        }
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        // Load photo first for immediate display
        const userPhoto = await AsyncStorage.getItem('userPhoto');
        if (!cancelled) {
        setBackendUserPhoto(userPhoto);
        }
      } catch (error) {
        if (!cancelled) {
        console.error('Failed to load user data:', error);
        }
      }
    };
    // Load immediately on mount
    loadUserData();
    return () => {
      cancelled = true;
    };
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

  // Track mount state to prevent alerts during unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Authorization check (admins only - moderators should use regular Calendar)
  useEffect(() => {
    if (authLoading) return;
    // Don't show alert if user is logging out (not authenticated), screen is not focused, or component is unmounting
    if (!isAuthenticated || !isFocused || !isMountedRef.current) {
      setIsAuthorized(false);
      return;
    }
    
    // Only admins can access AdminCalendar
    if (!isAdmin) {
      setIsAuthorized(false);
      
      // Add a small delay and re-check before showing alert to prevent showing during logout
      const timeoutId = setTimeout(() => {
        // Triple-check we're still mounted, focused, and authenticated before showing alert
        if (isMountedRef.current && isFocused && isAuthenticated) {
          // If user is moderator, redirect to regular Calendar
          if (userRole === 'moderator') {
            Alert.alert(
              'Access Redirected',
              'Moderators can only access the regular calendar. You have been redirected to the user calendar.',
              [{ 
                text: 'OK', 
                onPress: () => navigation.replace('Calendar' as any) 
              }]
            );
          } else {
            // Regular users or unauthorized
            Alert.alert(
              'Access Denied',
              'You do not have permission to access this page.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    
    setIsAuthorized(true);
  }, [authLoading, isAdmin, userRole, navigation, isAuthenticated, isFocused]);

  // Get current user's initials for profile icon
  const getCurrentUserInitials = () => {
    if (userName && userName.trim()) {
      const parts = userName.trim().split(' ').filter(p => p.length > 0);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      if (parts[0] && parts[0].length >= 2) {
        return parts[0].substring(0, 2).toUpperCase();
      }
      if (parts[0] && parts[0].length === 1) {
        return (parts[0][0] + parts[0][0]).toUpperCase();
      }
    }
    if (userEmail && userEmail.trim()) {
      const emailPrefix = userEmail.trim().split('@')[0];
      if (emailPrefix.length >= 2) {
        return emailPrefix.substring(0, 2).toUpperCase();
      }
      if (emailPrefix.length === 1) {
        return (emailPrefix[0] + emailPrefix[0]).toUpperCase();
      }
    }
    return 'U';
  };

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
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState<boolean>(false);
  const [isProcessingCSV, setIsProcessingCSV] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Use shared calendar hook
  const { eventsByDateMap, getMonthEventCount, getEventsForDate } = useCalendar({
    posts,
    calendarEvents,
    selectedContentTypesSet,
  });

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
      const postsData = await AdminDataService.getPosts();
      setPosts(Array.isArray(postsData) ? postsData : []);
    } catch (error) {
      console.error('Failed to load posts:', error);
      setPosts([]);
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
          // Normalize categories in events to ensure consistent casing
          const normalizedEvents = Array.isArray(events) ? events.map(e => {
            if (e.category) {
              return { ...e, category: normalizeCategory(e.category) };
            }
            return e;
          }) : [];
          
          setCalendarEvents(normalizedEvents);
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
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
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
      
      // Normalize categories in events
      const normalizedEvents = events.map(e => {
        if (e.category) {
          return { ...e, category: normalizeCategory(e.category) };
        }
        return e;
      });
      
      // If forceRefresh, replace events for the date range instead of merging
      if (forceRefresh) {
        // For force refresh, replace events in the date range but keep events outside the range
        setCalendarEvents(prevEvents => {
          const eventIds = new Set(
            normalizedEvents.map(e => (e as any)._id || (e as any).id || `${(e as any).isoDate}-${(e as any).title}`)
          );
          
          // Keep events outside the date range
          const eventsOutsideRange = prevEvents.filter((e: any) => {
            // Handle date range events
            if (e.startDate && e.endDate) {
              const start = new Date(e.startDate);
              const end = new Date(e.endDate);
              if (isNaN(start.getTime()) || isNaN(end.getTime())) return true; // Keep invalid dates
              // Keep if range doesn't overlap with refresh range
              return end < startDate || start > endDate;
            }
            
            // Handle month-only or week-only events
            if (e.year && e.month && (e.dateType === 'month_only' || e.dateType === 'week_in_month')) {
              const eventYear = e.year;
              const eventMonth = e.month - 1; // Convert to 0-indexed
              const refreshStartYear = startDate.getFullYear();
              const refreshStartMonth = startDate.getMonth();
              const refreshEndYear = endDate.getFullYear();
              const refreshEndMonth = endDate.getMonth();
              
              // Keep if event month is outside refresh range
              if (eventYear < refreshStartYear || eventYear > refreshEndYear) return true;
              if (eventYear === refreshStartYear && eventMonth < refreshStartMonth) return true;
              if (eventYear === refreshEndYear && eventMonth > refreshEndMonth) return true;
              return false; // Event is in range, should be replaced
            }
            
            // Handle single date events
            const eventDate = e.isoDate || e.date || e.startDate;
            if (!eventDate) return true; // Keep events without dates
            const eventDateObj = new Date(eventDate);
            if (isNaN(eventDateObj.getTime())) return true; // Keep invalid dates
            return eventDateObj < startDate || eventDateObj > endDate;
          });
          
          // Return events outside range + new events (this replaces events in the range)
          return [...eventsOutsideRange, ...normalizedEvents];
        });
      } else {
        // Merge with existing events (avoid duplicates and normalize categories)
        setCalendarEvents(prevEvents => {
          const existingIds = new Set(
            prevEvents.map(e => (e as any)._id || (e as any).id || `${(e as any).isoDate}-${(e as any).title}`)
          );
          const newEvents = normalizedEvents.filter(e => {
            const id = (e as any)._id || (e as any).id || `${(e as any).isoDate}-${(e as any).title}`;
            return !existingIds.has(id);
          });
          return [...prevEvents, ...newEvents];
        });
      }
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
      
      // Set the selected event
      setSelectedEvent(eventData);
      
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



  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Show loading state while checking authorization
  if (isPendingAuthorization || authLoading) {
    return (
      <View style={[
        styles.container,
        { 
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3',
        }
      ]}>
        <ActivityIndicator size="large" color={t.colors.accent} />
      </View>
    );
  }

  // Don't render if not authorized (will be redirected)
  if (!isAuthorized) {
    return (
      <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3' }} />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={[styles.container, {
      backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3',
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
            onPress={() => {
              // Moderators use UserSettings, admins use AdminSettings
              if (userRole === 'moderator') {
                navigation.navigate('UserSettings' as any);
              } else {
                navigation.navigate('AdminSettings');
              }
            }} 
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Admin profile - Go to settings"
            accessibilityRole="button"
          >
            {backendUserPhoto && !profileImageError ? (
              <Image 
                source={{ uri: backendUserPhoto }} 
                style={styles.profileIconCircle}
                resizeMode="cover"
                onError={() => setProfileImageError(true)}
              />
            ) : (
              <View style={[styles.profileIconCircle, { backgroundColor: t.colors.accent }]} pointerEvents="none">
                <Text style={[styles.profileInitials, { fontSize: t.fontSize.scaleSize(13) }]}>{getCurrentUserInitials()}</Text>
              </View>
            )}
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
          <CalendarGrid
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            eventsByDateMap={eventsByDateMap}
            theme={t}
            onDayPress={handleDayPress}
            onDayLongPress={handleOpenAddEvent}
          />

          {/* Event Type Legend - Inside Calendar Card */}
          <View style={styles.legendContainer}>
            <View style={styles.legendHeaderRow}>
              <Text style={[styles.eventCountText, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(11) }]}>
                {getMonthEventCount(currentMonth)} {getMonthEventCount(currentMonth) === 1 ? 'event' : 'events'} this month
              </Text>
            </View>
            <View style={styles.legendItems}>
              {[
                { type: 'Academic', key: 'academic', color: '#2563EB' }, // Blue
                { type: 'Institutional', key: 'institutional', color: '#4B5563' }, // Dark Gray
                { type: 'Announcement', key: 'announcement', color: '#EAB308' }, // Yellow
                { type: 'Event', key: 'event', color: '#10B981' }, // Green
                { type: 'News', key: 'news', color: '#EF4444' }, // Red
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
        showImage={false}
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
            const eventId = selectedEvent._id || selectedEvent.id;
            
            if (selectedEvent.source === 'post') {
              // Delete post using AdminDataService
              await AdminDataService.deletePost(selectedEvent.id);
              
              // Immediately remove from context for instant UI update
              setPosts(prevPosts => prevPosts.filter((p: any) => p.id !== selectedEvent.id));
              
              // Refresh posts to ensure consistency
              await loadPosts();
            } else {
              // Delete calendar event
              await CalendarService.deleteEvent(eventId);
              
              // Immediately remove from context for instant UI update
              setCalendarEvents(prevEvents => 
                prevEvents.filter((e: any) => {
                  const eId = e._id || e.id || `${e.isoDate}-${e.title}`;
                  return eId !== eventId && eId !== selectedEvent.id;
                })
              );
            }
            
            // Refresh calendar events to ensure consistency
            await refreshCalendarEvents(true, undefined, currentMonth);
            
            closeEventDrawer();
            setSelectedEvent(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
        <BottomNavBar
          tabType="admin"
          activeTab="calendar"
          onFirstPress={() => navigation.navigate('AdminAIChat')}
          onSecondPress={() => navigation.navigate('AdminDashboard')}
          onThirdPress={() => {
            // Moderators use regular Calendar, admins use AdminCalendar
            if (userRole === 'moderator') {
              navigation.navigate('Calendar' as any);
            } else {
              navigation.navigate('AdminCalendar');
            }
          }}
        />
      </View>

      {/* Sidebar Component */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        allowedRoles={['superadmin', 'admin', 'moderator']}
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
    overflow: 'hidden',
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
  legendContainer: {
    gap: 8,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekDayHeader: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
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
});

export default AdminCalendar;
