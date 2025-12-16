import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarGrid from '../../components/common/CalendarGrid';
import BottomNavBar from '../../components/navigation/BottomNavBar';
import Sidebar from '../../components/navigation/Sidebar';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useCalendar } from '../../hooks/useCalendar';
import MonthPickerModal from '../../modals/MonthPickerModal';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import { formatDateKey, normalizeCategory, parseAnyDateToKey } from '../../utils/calendarUtils';
import { useUpdates } from '../../contexts/UpdatesContext';

// Session-scoped flag so the calendar only does a full initial load once per app session.
// After that, data is updated via pull-to-refresh and month navigation, not on every mount.
let hasLoadedUserCalendarOnce = false;

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
};

const CalendarScreen = () => {
  dayjs.extend(utc);
  dayjs.extend(timezone);
  const PH_TZ = 'Asia/Manila';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode, theme: t } = useThemeValues();
  const scrollRef = useRef<ScrollView>(null);
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const initialNow = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(Date.UTC(initialNow.getFullYear(), initialNow.getMonth(), 1)));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date()); // Default to today
  
  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);
  
  // Calendar state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);
  const [backendUserFirstName, setBackendUserFirstName] = useState<string | null>(null);
  const [backendUserLastName, setBackendUserLastName] = useState<string | null>(null);
  const [backendUserName, setBackendUserName] = useState<string | null>(null);
  
  // Load backend user data immediately on mount for fast display
  useEffect(() => {
    let cancelled = false;
    const loadBackendUserData = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        // Load all user data in parallel for faster loading
        const [userPhoto, firstName, lastName, userName] = await Promise.all([
          AsyncStorage.getItem('userPhoto'),
          AsyncStorage.getItem('userFirstName'),
          AsyncStorage.getItem('userLastName'),
          AsyncStorage.getItem('userName'),
        ]);
        if (!cancelled) {
          setBackendUserPhoto(userPhoto);
          setBackendUserFirstName(firstName);
          setBackendUserLastName(lastName);
          if (userName) {
            setBackendUserName(userName);
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
          const [userPhoto, firstName, lastName, userName] = await Promise.all([
            AsyncStorage.getItem('userPhoto'),
            AsyncStorage.getItem('userFirstName'),
            AsyncStorage.getItem('userLastName'),
            AsyncStorage.getItem('userName'),
          ]);
          setBackendUserPhoto(userPhoto);
          setBackendUserFirstName(firstName);
          setBackendUserLastName(lastName);
          if (userName) {
            setBackendUserName(userName);
          }
        } catch (error) {
          // Silent fail on focus refresh
        }
      };
      loadBackendUserData();
    }, [])
  );

  // Get user photo (memoized) - matches AIChat.tsx pattern
  const userPhoto = useMemo(() => {
    // Priority: Backend photo
    if (backendUserPhoto) return backendUserPhoto;
    return null;
  }, [backendUserPhoto]);

  // Get user display name (memoized) - matches AIChat.tsx pattern
  const userName = useMemo(() => {
    // Priority: Backend username -> Default
    if (backendUserName) return backendUserName;
    return 'User';
  }, [backendUserName]);

  // Get user initials for fallback - matches AIChat.tsx pattern
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
  
  // Event Modal state (view-only)
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([]);
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<Date | null>(null);
  
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

  // Data from AdminDataService (for backward compatibility) and CalendarService
  const { posts, setPosts, calendarEvents, setCalendarEvents } = useUpdates();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);

  // Use shared calendar hook
  const { eventsByDateMap, getMonthEventCount, getEventsForDate } = useCalendar({
    posts,
    calendarEvents,
    selectedContentTypesSet,
  });

  // Track last calendar fetch time
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

  // OPTIMIZED: Refresh calendar events from backend
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
      
      // Merge with existing events (avoid duplicates and normalize categories)
      setCalendarEvents(prevEvents => {
        const existingIds = new Set(
          prevEvents.map(e => (e as any)._id || (e as any).id || `${(e as any).isoDate}-${(e as any).title}`)
        );
        const newEvents = events
          .filter(e => {
          const id = (e as any)._id || (e as any).id || `${(e as any).isoDate}-${(e as any).title}`;
          return !existingIds.has(id);
          })
          .map(e => {
            // Normalize category to ensure consistent casing
            if (e.category) {
              return { ...e, category: normalizeCategory(e.category) };
            }
            return e;
        });
        return [...prevEvents, ...newEvents];
      });
    } catch (error) {
      console.error('Failed to refresh calendar events:', error);
      // Don't clear events on error, keep what we have
    } finally {
      setIsLoadingEvents(false);
      isFetchingCalendar.current = false;
    }
  }, [hasEventsForMonth]);

  // Load calendar events and posts from backend (only once per app session; manual refresh via pull-to-refresh)
  // Initial load: current month only for fastest possible startup, plus staggered prefetch of neighbors.
  useEffect(() => {
    // If we've already done the initial session load, don't do it again on remount (e.g., web screen switches)
    if (hasLoadedUserCalendarOnce) {
      return;
    }
    hasLoadedUserCalendarOnce = true;

    let cancelled = false;
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;

    const loadData = async () => {
      try {
        setIsLoadingEvents(true);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Load ONLY the current month for fastest initial render
        const startDate = new Date(currentYear, currentMonth, 1);
        const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

        console.log(`📅 Initial load (user calendar): ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (current month only)`);

        const [events, postsData] = await Promise.all([
          CalendarService.getEvents({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            limit: 200,
          }),
          AdminDataService.getPosts(),
        ]);

        console.log(`✅ Initial load complete (user calendar): ${events.length} events, ${postsData.length} posts`);

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

          // Mark current month as loaded in cache
          const currentKey = `${currentYear}-${currentMonth}`;
          loadedMonthsRef.current.add(currentKey);

          // Background prefetch: load adjacent months one-by-one with a delay to keep UI fast
          const nextMonth = new Date(currentYear, currentMonth + 1, 1);
          const prevMonth = new Date(currentYear, currentMonth - 1, 1);

          // Prefetch next month after 1s
          t1 = setTimeout(() => {
            refreshCalendarEvents(false, undefined, nextMonth);
          }, 1000);

          // Prefetch previous month after 2s
          t2 = setTimeout(() => {
            refreshCalendarEvents(false, undefined, prevMonth);
          }, 2000);
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
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [refreshCalendarEvents]);

  // Pull-to-refresh handler for user calendar (reload current month + immediate neighbors)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const startDate = new Date(currentYear, currentMonth - 1, 1);
      const endDate = new Date(currentYear, currentMonth + 2, 0, 23, 59, 59);

      const [events, postsData] = await Promise.all([
        CalendarService.getEvents({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 500,
        }),
        AdminDataService.getPosts(),
      ]);

      // Normalize categories in events to ensure consistent casing
      const normalizedEvents = Array.isArray(events) ? events.map(e => {
        if (e.category) {
          return { ...e, category: normalizeCategory(e.category) };
        }
        return e;
      }) : [];

      setCalendarEvents(normalizedEvents);
      setPosts(Array.isArray(postsData) ? postsData : []);
    } catch (error) {
      console.error('Refresh error (user calendar):', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const getMonthName = (date: Date) => {
    return dayjs.utc(date).tz(PH_TZ).format('MMMM');
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
  


  const handleDayPress = useCallback((date: Date) => {
    setSelectedDate(date);
    const events = getEventsForDate(date);
    if (events && events.length > 0) {
      const firstEvent = events[0];
      
      let fullEvent = null;
      if (firstEvent.source === 'post') {
        fullEvent = posts.find((p: any) => p.id === firstEvent.id) || firstEvent;
      } else {
        fullEvent = calendarEvents.find((e: CalendarEvent) => {
          if (e._id === firstEvent.id) return true;
          if (`calendar-${e.isoDate}-${e.title}` === firstEvent.id) return true;
          const eventDateKey = parseAnyDateToKey(e.isoDate || e.date);
          const checkDateKey = formatDateKey(date);
          return eventDateKey === checkDateKey && e.title === firstEvent.title;
        }) || firstEvent;
      }
      
      setSelectedEvent(fullEvent || firstEvent as CalendarEvent);
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
    setSelectedEvent(null);
    setSelectedDateForDrawer(null);
    setSelectedDateEvents([]);
  }, []);





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

  React.useEffect(() => {
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

  const weekDays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);

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

      <View style={styles.floatingBgContainer} pointerEvents="none">
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

      <View style={[styles.header, { 
        marginTop: insets.top,
        marginLeft: insets.left,
        marginRight: insets.right,
      }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={() => setIsHistoryOpen(true)} 
            style={styles.menuButton}
            accessibilityLabel="Open sidebar"
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
          >
            <View style={styles.customHamburger} pointerEvents="none">
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: t.colors.text }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: t.colors.text }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: t.colors.text }]} />
            </View>
          </TouchableOpacity>
        </View>
        <Text 
          style={[styles.headerTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(17) }]}
          pointerEvents="none"
        >
          DOrSU Calendar
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={() => navigation.navigate('UserSettings')} 
            accessibilityLabel="User profile - Go to settings"
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
          >
            {userPhoto ? (
                <Image 
                source={{ uri: userPhoto }} 
                  style={styles.profileImage}
                resizeMode="cover"
                />
            ) : (
              <View style={[styles.profileIconCircle, { backgroundColor: t.colors.accent }]} pointerEvents="none">
                <Text style={[styles.profileInitials, { fontSize: t.fontSize.scaleSize(13) }]}>{getUserInitials()}</Text>
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
        <View>
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.calendarCard, { backgroundColor: isDarkMode ? t.colors.surface + '80' : t.colors.card + '4D' }]}
          >

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
                onPress={openMonthPicker}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open month picker"
                accessibilityHint="Opens a modal to select a month"
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

          <CalendarGrid
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            eventsByDateMap={eventsByDateMap}
            theme={t}
            onDayPress={handleDayPress}
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

        <MonthPickerModal
          visible={showMonthPicker}
          currentMonth={currentMonth}
          onClose={closeMonthPicker}
          onSelectMonth={selectMonth}
          scaleAnim={monthPickerScaleAnim}
          opacityAnim={monthPickerOpacityAnim}
        />
      </ScrollView>

      {/* View Event Modal - View Only */}
      <ViewEventModal
        visible={showEventDrawer}
        onClose={closeEventDrawer}
        selectedEvent={selectedEvent}
        selectedDateEvents={selectedDateEvents}
        selectedDate={selectedDateForDrawer}
        showImage={false}
      />

      <View style={[styles.bottomNavContainer, {
        bottom: 0,
        paddingBottom: safeInsets.bottom,
      }]} collapsable={false}>
      <BottomNavBar tabType="user" autoDetect />
      </View>

      <Sidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        allowedRoles={['user', 'moderator', 'admin', 'superadmin']}
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
    width: 32,
    height: 32,
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
    // backgroundColor set dynamically via theme
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
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 998,
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
});

export default CalendarScreen;
