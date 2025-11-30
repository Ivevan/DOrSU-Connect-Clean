import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import UserSidebar from '../../components/navigation/UserSidebar';
import { theme } from '../../config/theme';
import { useThemeValues } from '../../contexts/ThemeContext';
import MonthPickerModal from '../../modals/MonthPickerModal';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import { categoryToColors, formatDateKey, parseAnyDateToKey } from '../../utils/calendarUtils';

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
  
  // Lock header height to prevent layout shifts
  const headerHeightRef = useRef<number>(64);
  const [headerHeight, setHeaderHeight] = useState(64);
  
  // Calendar state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);
  
  // Load backend user photo on screen focus
  useFocusEffect(
    useCallback(() => {
      const loadBackendUserData = async () => {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const userPhoto = await AsyncStorage.getItem('userPhoto');
          setBackendUserPhoto(userPhoto);
        } catch (error) {
          console.error('Failed to load backend user data:', error);
        }
      };
      loadBackendUserData();
    }, [])
  );
  
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
  
  // Drawer animation values
  const drawerSlideAnim = useRef(new Animated.Value(0)).current;
  const drawerBackdropOpacity = useRef(new Animated.Value(0)).current;

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const formatEventTitle = (raw?: string) => {
    const title = String(raw || '').trim();
    if (title.length < 3) return 'Untitled';
    // Capitalize first letter, collapse spaces
    const cleaned = title.replace(/\s+/g, ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  // Data from AdminDataService (for backward compatibility) and CalendarService
  const [posts, setPosts] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);

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
      
      // Merge with existing events (avoid duplicates)
      setCalendarEvents(prevEvents => {
        const existingIds = new Set(prevEvents.map(e => e._id || e.id || `${e.isoDate}-${e.title}`));
        const newEvents = events.filter(e => {
          const id = e._id || e.id || `${e.isoDate}-${e.title}`;
          return !existingIds.has(id);
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

  // OPTIMIZED: Load calendar events and posts from backend
  // Only load current month ± 1 month for fast initial load (like AdminCalendar)
  // Load more data on-demand when user navigates to different months
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadData = async () => {
        try {
          setIsLoadingEvents(true);
          setIsLoadingPosts(true);
          
          // OPTIMIZED: Only load current month ± 1 month for fast loading (like AdminCalendar)
          // This is much faster than loading 10 years!
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
    }, [])
  );

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

  const getDaysInMonth = (date: Date) => {
    const start = dayjs.utc(date).tz(PH_TZ).startOf('month');
    const daysInMonth = start.daysInMonth();
    const firstDayOfMonth = start.day(); // 0=Sun..6=Sat in PH tz
    
    const days: Array<number | null> = [];
    
    // Add leading empty cells so week starts on Sunday
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    // Add trailing empty cells so total cells is multiple of 7 (complete rows)
    const remainder = days.length % 7;
    if (remainder !== 0) {
      const toAdd = 7 - remainder;
      for (let i = 0; i < toAdd; i++) days.push(null);
    }
    
    return days;
  };

  const getMonthName = (date: Date) => {
    return dayjs.utc(date).tz(PH_TZ).format('MMMM');
  };

  const getMonthEventCount = (dateRef: Date) => {
    const y = dateRef.getFullYear();
    const m = dateRef.getMonth() + 1;
    
    let count = 0;
    
    // Count events from posts (AdminDataService) - filtered by selected content types
    count += posts
      .filter(p => {
        if (p.source === 'CSV Upload') return false;
        const postType = String(p.category || 'Announcement').toLowerCase();
        return selectedContentTypesSet.has(postType);
      })
      .reduce((acc, p) => {
        const key = parseAnyDateToKey(p.isoDate || p.date);
        if (!key) return acc;
        const [yy, mm] = key.split('-');
        return acc + ((Number(yy) === y && Number(mm) === m) ? 1 : 0);
      }, 0);
    
    // Count events from calendarEvents (CalendarService) - filtered by selected content types
    // For date ranges, count if any date in range falls in the month
    // For week/month-only events, count if the month matches
    count += calendarEvents.reduce((acc, event) => {
      // Apply content type filter
      const eventType = String(event.category || 'Announcement').toLowerCase();
      if (!selectedContentTypesSet.has(eventType)) return acc;
      
      // Skip week/month-only events for calendar grid count
      if (event.dateType === 'week' || event.dateType === 'month') {
        // Only count if month matches
        if (event.month === m && event.year === y) {
          return acc + 1;
        }
        return acc;
      }
      
      if (event.dateType === 'date_range' && event.startDate && event.endDate) {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        // Check if range overlaps with the month
        const monthStart = new Date(y, m - 1, 1);
        const monthEnd = new Date(y, m, 0);
        if (startDate <= monthEnd && endDate >= monthStart) {
          return acc + 1;
        }
        return acc;
      }
      
      const key = parseAnyDateToKey(event.isoDate || event.date);
      if (!key) return acc;
      const [yy, mm] = key.split('-');
      return acc + ((Number(yy) === y && Number(mm) === m) ? 1 : 0);
    }, 0);
    
    return count;
  };

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
    const events: any[] = [];
    
    // Add posts/announcements from AdminDataService
    if (Array.isArray(posts)) {
      posts.forEach(p => {
        // Only include posts that are NOT from CSV uploads (to avoid duplicates)
        if (p.source !== 'CSV Upload') {
          // Apply content type filter
          const postType = String(p.category || 'Announcement').toLowerCase();
          if (!selectedContentTypesSet.has(postType)) return;
          
          const eventDateKey = parseAnyDateToKey(p.isoDate || p.date);
          if (eventDateKey === key) {
            events.push({
              id: p.id,
              title: p.title,
              dateKey: eventDateKey,
              time: p.time || '',
              type: p.category || 'Announcement',
              color: categoryToColors(p.category).dot,
              chip: categoryToColors(p.category),
              description: p.description,
              isPinned: p.isPinned,
              isUrgent: p.isUrgent,
              source: 'post', // Mark as post to distinguish from calendar events
            });
          }
        }
      });
    }
    
    // Add events from CalendarService (backend calendar events)
    if (Array.isArray(calendarEvents)) {
      calendarEvents.forEach(event => {
        // Skip week/month-only events for calendar grid (they only show in All tab)
        if (event.dateType === 'week' || event.dateType === 'month') {
          return;
        }
        
        // Apply content type filter
        const eventType = String(event.category || 'Announcement').toLowerCase();
        if (!selectedContentTypesSet.has(eventType)) return;
        
        // Handle date ranges - check if date falls within range
        if (event.dateType === 'date_range' && event.startDate && event.endDate) {
          const startDate = new Date(event.startDate);
          const endDate = new Date(event.endDate);
          const checkDate = new Date(date);
          
          // Normalize to start of day for comparison
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          checkDate.setHours(0, 0, 0, 0);
          
          if (checkDate >= startDate && checkDate <= endDate) {
            events.push({
              id: event._id || `calendar-${event.isoDate}-${event.title}`,
              title: event.title,
              dateKey: key,
              time: event.time || 'All Day',
              type: event.category || 'Announcement',
              color: categoryToColors(event.category).dot,
              chip: categoryToColors(event.category),
              dateType: event.dateType,
              category: event.category,
              description: event.description,
              startDate: event.startDate,
              endDate: event.endDate,
            });
          }
        } else {
          // Single date event
          const eventDateKey = parseAnyDateToKey(event.isoDate || event.date);
          if (eventDateKey === key) {
            events.push({
              id: event._id || `calendar-${event.isoDate}-${event.title}`,
              title: event.title,
              dateKey: eventDateKey,
              time: event.time || 'All Day',
              type: event.category || 'Announcement',
              color: categoryToColors(event.category).dot,
              chip: categoryToColors(event.category),
              dateType: event.dateType,
              category: event.category,
              description: event.description,
              startDate: event.startDate,
              endDate: event.endDate,
            });
          }
        }
      });
    }
    
    return events;
  }, [posts, calendarEvents, selectedContentTypesSet]);

  // Robust PH date-key comparison (avoids off-by-one no matter device tz)
  const getPHDateKey = (d: Date) => {
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
  
  const getUserInitials = () => {
    if (!currentUser?.displayName) return '?';
    const names = currentUser.displayName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return currentUser.displayName.substring(0, 2).toUpperCase();
  };

  const isToday = (date: Date) => {
    return getPHDateKey(date) === getPHDateKey(new Date());
  };

  const isSelected = (date: Date) => {
    return selectedDate ? getPHDateKey(date) === getPHDateKey(selectedDate) : false;
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
        fullEvent = calendarEvents.find((e: CalendarEvent) => {
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
      setSelectedEvent(eventData as CalendarEvent);
      
      // Set selectedDateEvents for the modal
      setSelectedDateEvents(events.map(e => ({
        id: e.id,
        title: e.title,
        color: e.color,
        type: e.type,
        category: e.category,
        description: e.description,
        isoDate: e.dateKey ? new Date(e.dateKey).toISOString() : undefined,
        date: e.dateKey,
        time: e.time,
        startDate: e.startDate,
        endDate: e.endDate,
      })));
      setSelectedDateForDrawer(date);
      setShowEventDrawer(true);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.selectionAsync();
    }
  }, [getEventsForDate, calendarEvents, posts]);

  // Open event modal
  const openEventDrawer = useCallback((event: any) => {
    // Check if it's a post (from AdminDataService)
    let matchingEvent = null;
    if (event.source === 'post') {
      matchingEvent = posts.find((p: any) => p.id === event.id) || event;
    } else {
      // It's a calendar event (from CalendarService)
      matchingEvent = calendarEvents.find((e: CalendarEvent) => {
        return e._id === event.id || 
               `calendar-${e.isoDate}-${e.title}` === event.id ||
               (e.title === event.title && parseAnyDateToKey(e.isoDate || e.date) === event.dateKey);
      }) || event;
    }
    
    if (matchingEvent) {
      setSelectedEvent(matchingEvent as CalendarEvent);
      // Get all events for the same date
      const dateKey = event.dateKey || parseAnyDateToKey(matchingEvent.isoDate || matchingEvent.date);
      const dateForDrawer = new Date(dateKey);
      const eventsForDate = getEventsForDate(dateForDrawer);
      setSelectedDateEvents(eventsForDate.map(e => ({
        id: e.id,
        title: e.title,
        color: e.color,
        type: e.type,
        category: e.category,
        description: e.description,
        isoDate: e.dateKey ? new Date(e.dateKey).toISOString() : undefined,
        date: e.dateKey,
        time: e.time,
        startDate: e.startDate,
        endDate: e.endDate,
      })));
      setSelectedDateForDrawer(dateForDrawer);
      setShowEventDrawer(true);
      
      Haptics.selectionAsync();
    }
  }, [calendarEvents, posts, getEventsForDate]);
  
  // Close event modal
  const closeEventDrawer = useCallback(() => {
    setShowEventDrawer(false);
    setSelectedEvent(null);
    setSelectedDateForDrawer(null);
    setSelectedDateEvents([]);
  }, []);


  // Memoized Calendar Day Component
  const CalendarDay = memo(({ date, day, isCurrentDay, isSelectedDay, index, eventsForDay, theme, onPress }: { date: Date; day: number | null; isCurrentDay: boolean; isSelectedDay: boolean; index: number; eventsForDay: any[]; theme: any; onPress: (date: Date) => void }) => {
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
        onPress={() => onPress(date)}
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
              accessibilityHint="Selects this date to view events"
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

  const renderCalendarDay = useCallback((date: Date, day: number | null, isCurrentDay: boolean, isSelectedDay: boolean, key: number) => {
    const eventsForDay = getEventsForDate(date);
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
      />
    );
  }, [getEventsForDate, t, handleDayPress]);

  const filteredEvents = React.useMemo(() => {
    if (!Array.isArray(calendarEvents)) return [];
    
    // Combine all events from calendarEvents (backend) - include ALL events including week/month-only
    // Use a Set to track date ranges we've already added (to avoid duplicates)
    const dateRangeKeys = new Set<string>();
    const allEvents: any[] = [];
    
    if (Array.isArray(calendarEvents)) {
      calendarEvents.forEach(event => {
        const eventType = String(event.category || 'Announcement').toLowerCase();
        
        // Apply filters - check if event type is in selected content types
        if (!selectedContentTypesSet.has(eventType)) return;
        
        // For date ranges, create a single entry with range info (avoid duplicates)
        if (event.dateType === 'date_range' && event.startDate && event.endDate) {
          const rangeKey = `${event.title}-${event.startDate}-${event.endDate}`;
          if (!dateRangeKeys.has(rangeKey)) {
            dateRangeKeys.add(rangeKey);
            allEvents.push({
              id: event._id || `calendar-${event.startDate}-${event.title}`,
              title: event.title,
              dateKey: parseAnyDateToKey(event.startDate),
              time: event.time || 'All Day',
              type: event.category || 'Announcement',
              color: categoryToColors(event.category).dot,
              chip: categoryToColors(event.category),
              dateType: event.dateType,
              startDate: event.startDate,
              endDate: event.endDate,
            });
          }
        } else if (event.dateType === 'week' || event.dateType === 'month') {
          // Week/month-only events
          allEvents.push({
            id: event._id || `calendar-${event.isoDate}-${event.title}`,
            title: event.title,
            dateKey: parseAnyDateToKey(event.isoDate || event.date),
            time: event.time || 'All Day',
            type: event.category || 'Announcement',
            color: categoryToColors(event.category).dot,
            chip: categoryToColors(event.category),
            dateType: event.dateType,
            weekOfMonth: event.weekOfMonth,
            month: event.month,
            year: event.year,
          });
        } else {
          // Single date events
          allEvents.push({
            id: event._id || `calendar-${event.isoDate}-${event.title}`,
            title: event.title,
            dateKey: parseAnyDateToKey(event.isoDate || event.date),
            time: event.time || 'All Day',
            type: event.category || 'Announcement',
            color: categoryToColors(event.category).dot,
            chip: categoryToColors(event.category),
            dateType: event.dateType,
          });
        }
      });
    }
    
    return allEvents;
  }, [calendarEvents, selectedContentTypesSet]);

  const getAllEventsGrouped = React.useCallback(() => {
    if (!Array.isArray(calendarEvents)) return [];
    
    const all: any[] = [];
    
    // Get current month and year for filtering
    const currentYear = currentMonth.getUTCFullYear();
    const currentMonthIndex = currentMonth.getUTCMonth() + 1; // 1-12
    
    // Add events from calendarEvents (CalendarService)
    // Use a Set to track date ranges we've already added (to avoid duplicates)
    const dateRangeKeys = new Set<string>();
    
    if (Array.isArray(calendarEvents)) {
      calendarEvents.forEach(event => {
        const eventType = String(event.category || 'Announcement').toLowerCase();
        
        // Apply filters - check if event type is in selected content types
        if (!selectedContentTypesSet.has(eventType)) return;
        
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
  }, [calendarEvents, selectedContentTypesSet, currentMonth]);


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

  const getMonthNames = () => {
    return [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
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

  React.useEffect(() => {
    listAnim.setValue(1);
    dotScale.setValue(1);
  }, [selectedDate]);

  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  const weekDays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []); // Sunday -> Saturday

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
            {backendUserPhoto ? (
              <View pointerEvents="none">
                <Image 
                  source={{ uri: backendUserPhoto }} 
                  style={styles.profileImage}
                />
              </View>
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

          <View style={styles.calendarGrid}>
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
      />

      <View style={[styles.bottomNavContainer, {
        bottom: 0,
        paddingBottom: safeInsets.bottom,
      }]} collapsable={false}>
      <UserBottomNavBar />
      </View>

      <UserSidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
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
  headerSpacer: {
    width: 40,
    height: 33,
    marginLeft: 4,
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
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
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
    // backgroundColor set dynamically via theme
  },
  todayText: {
    // color set dynamically via theme
    fontWeight: '700',
  },
  selectedContainer: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    // borderColor set dynamically via theme
  },
  selectedText: {
    // color set dynamically via theme
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
    shadowColor: theme.colors.text,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  eventFilterContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexShrink: 1,
    flex: 1,
    justifyContent: 'flex-end',
  },
  eventsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventTypeToggleContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
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
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  eventsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    color: theme.colors.text,
  },
  eventsSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
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
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor set dynamically via theme
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    // borderColor set dynamically via theme
    shadowColor: theme.colors.text,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
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
    // color set dynamically via theme
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
    // color set dynamically via theme
    fontWeight: '700',
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
    // color set dynamically via theme
    fontWeight: '700',
  },
  eventInnerDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 6,
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
});

export default CalendarScreen;
