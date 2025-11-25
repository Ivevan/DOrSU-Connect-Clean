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
import { ActivityIndicator, Alert, Animated, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import AdminSidebar from '../../components/navigation/AdminSidebar';
import { theme } from '../../config/theme';
import { useThemeValues } from '../../contexts/ThemeContext';
import DeleteAllModal from '../../modals/DeleteAllModal';
import MonthPickerModal from '../../modals/MonthPickerModal';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import AdminFileService from '../../services/AdminFileService';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import { categoryToColors, formatDateKey, parseAnyDateToKey } from '../../utils/calendarUtils';
import { formatCalendarDate, formatDate } from '../../utils/dateUtils';

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
  
  // Content type filter - multiple selection: 'academic', 'institutional', 'event', 'announcement', 'news'
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(['academic', 'institutional', 'event', 'announcement', 'news']);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterButtonRef = useRef<View>(null);
  const [filterButtonLayout, setFilterButtonLayout] = useState({ x: 16, y: 100, width: 200, height: 44 });
  
  // Animation values
  const monthPickerScaleAnim = useRef(new Animated.Value(0)).current;
  const monthPickerOpacityAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.8)).current;
  
  // Toggle content type filter
  const toggleContentType = useCallback((type: string) => {
    setSelectedContentTypes(prev => {
      if (prev.includes(type)) {
        // Don't allow deselecting all - at least one must be selected
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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


  // Data from AdminDataService
  const [posts, setPosts] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState<boolean>(false);
  
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

  // Load calendar events and posts from backend
  // Refresh when screen comes into focus to show newly created posts/events
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadData = async () => {
        try {
          setIsLoadingEvents(true);
          setIsLoadingPosts(true);
          // Load events for a wide range (2020-2030) to cover all possible dates
          // This ensures we get all events regardless of year
          const startDate = new Date(2020, 0, 1).toISOString(); // January 1, 2020
          const endDate = new Date(2030, 11, 31).toISOString(); // December 31, 2030
          
          const [events, postsData] = await Promise.all([
            CalendarService.getEvents({
              startDate,
              endDate,
              limit: 2000, // Increased limit to get more events
            }),
            AdminDataService.getPosts(),
          ]);
          
          if (!cancelled) {
            setCalendarEvents(Array.isArray(events) ? events : []);
            setPosts(Array.isArray(postsData) ? postsData : []);
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

  // Entrance animation disabled for debugging



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

  const selectMonth = (monthIndex: number, year?: number) => {
    const targetYear = year || currentMonth.getUTCFullYear();
    const newMonth = new Date(Date.UTC(targetYear, monthIndex, 1));
    setCurrentMonth(newMonth);
    // Ensure the selected date moves into the chosen month so the week view reflects it
    setSelectedDate(new Date(Date.UTC(newMonth.getUTCFullYear(), newMonth.getUTCMonth(), 1)));
    closeMonthPicker();
  };

  const navigateToNextMonth = useCallback(() => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    setCurrentMonth(nextMonth);
    setSelectedDate(new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 1)));
    Haptics.selectionAsync();
  }, [currentMonth]);

  const navigateToPreviousMonth = useCallback(() => {
    const prevMonth = new Date(currentMonth);
    prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
    setCurrentMonth(prevMonth);
    setSelectedDate(new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth(), 1)));
    Haptics.selectionAsync();
  }, [currentMonth]);

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

  const getEventsForDate = React.useCallback((date: Date) => {
    const key = formatDateKey(date);
    const events: any[] = [];
    
    // Add posts/announcements from AdminDataService
    if (Array.isArray(posts)) {
      posts.forEach(p => {
        // Only include posts that are NOT from CSV uploads (to avoid duplicates)
        if (p.source !== 'CSV Upload') {
          // Apply content type filter
          const postType = String(p.category || 'Announcement').toLowerCase();
          if (!selectedContentTypes.includes(postType)) return;
          
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
        if (!selectedContentTypes.includes(eventType)) return;
        
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
  }, [posts, calendarEvents, selectedContentTypes]); // Only recompute when posts, calendarEvents, or selectedContentTypes change

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
    if (!Array.isArray(calendarEvents) && !Array.isArray(posts)) return [];
    
    const all: any[] = [];
    
    // Get current month and year for filtering
    const currentYear = currentMonth.getUTCFullYear();
    const currentMonthIndex = currentMonth.getUTCMonth() + 1; // 1-12
    
    // Add posts/announcements from AdminDataService
    if (Array.isArray(posts)) {
      posts.forEach((post: any) => {
        // Only include posts that are NOT from CSV uploads (to avoid duplicates)
        if (post.source !== 'CSV Upload') {
          const eventType = String(post.category || 'Announcement').toLowerCase();
          
          // Apply content type filter
          if (!selectedContentTypes.includes(eventType)) return;
          
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
        }
      });
    }
    
    // Add events from calendarEvents (CalendarService)
    // Use a Set to track date ranges we've already added (to avoid duplicates)
    const dateRangeKeys = new Set<string>();
    
    if (Array.isArray(calendarEvents)) {
      calendarEvents.forEach(event => {
        const eventType = String(event.category || 'Announcement').toLowerCase();
        
        // Apply content type filter
        if (!selectedContentTypes.includes(eventType)) return;
        
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
  }, [calendarEvents, posts, selectedContentTypes, currentMonth]); // Only recompute when calendarEvents, posts, filters, or currentMonth change

  const getMonthEventCount = (dateRef: Date) => {
    const y = dateRef.getFullYear();
    const m = dateRef.getMonth() + 1;
    
    let count = 0;
    
    // Count events from posts (AdminDataService) - filtered by selected content types
    count += posts
      .filter(p => {
        if (p.source === 'CSV Upload') return false;
        const postType = String(p.category || 'Announcement').toLowerCase();
        return selectedContentTypes.includes(postType);
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
      if (!selectedContentTypes.includes(eventType)) return acc;
      
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

  // Track last calendar fetch time
  const lastCalendarFetchTime = useRef<number>(0);
  const isFetchingCalendar = useRef<boolean>(false);
  const CALENDAR_FETCH_COOLDOWN = 3000; // 3 seconds cooldown for calendar events (larger range)

  // Refresh calendar events from backend
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
      setIsLoadingEvents(true);
      // Load events for a wide range (2020-2030) to cover all possible dates
      const startDate = new Date(2020, 0, 1).toISOString(); // January 1, 2020
      const endDate = new Date(2030, 11, 31).toISOString(); // December 31, 2030
      
      // Use caching - CalendarService now supports caching
      const events = await CalendarService.getEvents({
        startDate,
        endDate,
        limit: 2000, // Increased limit to get more events
      });
      
      setCalendarEvents(Array.isArray(events) ? events : []);
    } catch (error) {
      if (__DEV__) console.error('Failed to refresh calendar events:', error);
      setCalendarEvents([]);
    } finally {
      setIsLoadingEvents(false);
      isFetchingCalendar.current = false;
    }
  }, []);

  // Fetch calendar events on mount only
  useEffect(() => {
    refreshCalendarEvents(true); // Force refresh on mount
  }, []); // Empty deps - only run on mount

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
      const fileUri = asset.uri;

      if (!fileName.toLowerCase().endsWith('.csv')) {
        Alert.alert('Invalid File', 'Please select a CSV file');
        return;
      }

      setIsUploadingCSV(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const uploadResult = await AdminFileService.uploadCalendarCSV(fileUri, fileName);

      // Upload successful - refresh calendar immediately
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Refresh calendar events to show new dates (force refresh after upload)
      await refreshCalendarEvents(true);
      
      // Show success message after refresh
      const eventsAdded = uploadResult.eventsAdded || 0;
      const eventsUpdated = uploadResult.eventsUpdated || 0;
      const totalEvents = eventsAdded + eventsUpdated;
      
      Alert.alert(
        'Upload Successful',
        `File uploaded successfully!\n\n${eventsAdded} new event${eventsAdded !== 1 ? 's' : ''} added.\n${eventsUpdated} event${eventsUpdated !== 1 ? 's' : ''} updated.\n\nTotal: ${totalEvents} event${totalEvents !== 1 ? 's' : ''} processed.\n\nThe calendar has been refreshed.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMessage = error.message || 'Failed to upload CSV file';
      let displayMessage = 'Upload Failed - Wrong Format';
      let alertTitle = 'Upload Failed';
      
      if (errorMessage.includes('must contain at least 3')) {
        displayMessage = 'Your CSV must contain at least 3 of the required fields:\n\n• Type (Institutional or Academic)\n• Event (Required)\n• DateType\n• StartDate\n• EndDate\n• Year\n• Month\n• WeekOfMonth\n• Description';
        alertTitle = 'Upload Failed - Wrong Format';
      } else if (errorMessage.includes('must contain "Event"')) {
        displayMessage = 'Your CSV must contain an "Event" column (or "Title"/"Name").\n\nThe Event field is required.';
        alertTitle = 'Upload Failed - Missing Event Field';
      } else if (errorMessage.includes('HTTP error')) {
        displayMessage = 'Failed to connect to the server. Please check your internet connection and try again.';
        alertTitle = 'Upload Failed - Connection Error';
      } else {
        displayMessage = `Upload failed: ${errorMessage}\n\nPlease check your CSV file format and try again.`;
        alertTitle = 'Upload Failed';
      }
      
      Alert.alert(alertTitle, displayMessage);
    } finally {
      setIsUploadingCSV(false);
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

  // Memoized Calendar Day Component with long press detection for unmarked cells
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
        onLongPress={handleOpenAddEvent}
      />
    );
  }, [getEventsForDate, t, handleDayPress, handleOpenAddEvent]);


  // List animation - DISABLED FOR PERFORMANCE DEBUGGING
  React.useEffect(() => {
    // Set values immediately without animation
    listAnim.setValue(1);
    dotScale.setValue(1);
  }, [selectedDate]);

  const days = React.useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  const weekDays = React.useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);

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
      >
        {/* Content Type Filters - Dropdown */}
        <View style={styles.filterDropdownWrapper}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.filterCard, { backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)' }]}
          >
            <View style={styles.filterContainer}>
              <View style={styles.filterHeaderRow}>
                <Text style={[styles.filterLabel, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(11) }]}>FILTER BY TYPE</Text>
                <Text style={[styles.eventCountText, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(11) }]}>
                  {getMonthEventCount(currentMonth)} {getMonthEventCount(currentMonth) === 1 ? 'event' : 'events'} this month
                </Text>
              </View>
              <View ref={filterButtonRef}>
                <TouchableOpacity
                  style={[styles.filterDropdownButton, {
                    backgroundColor: t.colors.surface,
                    borderColor: t.colors.border,
                  }]}
                  onPress={() => {
                    if (filterButtonRef.current) {
                      filterButtonRef.current.measure((x, y, width, height, pageX, pageY) => {
                        if (typeof pageX === 'number' && typeof pageY === 'number' && 
                            typeof width === 'number' && typeof height === 'number' &&
                            !isNaN(pageX) && !isNaN(pageY) && !isNaN(width) && !isNaN(height)) {
                          setFilterButtonLayout({ x: pageX, y: pageY, width, height });
                        } else {
                          // Fallback to default values if measurement fails
                          setFilterButtonLayout({ x: 16, y: 100, width: 200, height: 44 });
                        }
                        setShowFilterDropdown(!showFilterDropdown);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      });
                    } else {
                      setShowFilterDropdown(!showFilterDropdown);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  activeOpacity={0.7}
                >
                <View style={styles.filterDropdownButtonContent}>
                  <View style={styles.filterDropdownSelectedChips}>
                    {selectedContentTypes.length === 5 ? (
                      <Text style={[styles.filterDropdownButtonText, { color: t.colors.text, fontSize: t.fontSize.scaleSize(12) }]}>All Types</Text>
                    ) : (
                      <View style={styles.filterChipsRow}>
                        {selectedContentTypes.slice(0, 2).map((type) => {
                          const typeName = type.charAt(0).toUpperCase() + type.slice(1);
                          const getTypeColor = (typeStr: string) => {
                            switch (typeStr.toLowerCase()) {
                              case 'academic': return '#10B981';
                              case 'institutional': return t.colors.accent;
                              case 'event': return '#F59E0B';
                              case 'announcement': return '#3B82F6';
                              case 'news': return '#8B5CF6';
                              default: return t.colors.accent;
                            }
                          };
                          const typeColor = getTypeColor(type);
                          return (
                            <View key={type} style={[styles.filterChip, { backgroundColor: typeColor + '20', borderColor: typeColor }]}>
                              <Text style={[styles.filterChipText, { color: typeColor, fontSize: t.fontSize.scaleSize(9) }]}>{typeName}</Text>
                            </View>
                          );
                        })}
                        {selectedContentTypes.length > 2 && (
                          <Text style={[styles.filterDropdownButtonText, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(12) }]}>
                            +{selectedContentTypes.length - 2} more
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  <Ionicons 
                    name={showFilterDropdown ? 'chevron-up' : 'chevron-down'} 
                    size={16} 
                    color={t.colors.textMuted} 
                  />
                </View>
              </TouchableOpacity>
              </View>
              
              {/* Dropdown Options - Modal Overlay */}
              <Modal
                visible={showFilterDropdown}
                transparent
                animationType="fade"
                onRequestClose={() => setShowFilterDropdown(false)}
              >
                <Pressable 
                  style={styles.modalOverlay}
                  onPress={() => setShowFilterDropdown(false)}
                >
                  <View 
                    style={[
                      styles.filterDropdownOptionsModal,
                      {
                        top: (isNaN(filterButtonLayout.y) || isNaN(filterButtonLayout.height)) ? 100 : filterButtonLayout.y + filterButtonLayout.height + 8,
                        left: isNaN(filterButtonLayout.x) ? 16 : Math.max(0, filterButtonLayout.x),
                        width: isNaN(filterButtonLayout.width) || filterButtonLayout.width <= 0 ? '90%' : Math.max(200, filterButtonLayout.width),
                        backgroundColor: t.colors.surface,
                        borderColor: t.colors.border,
                      }
                    ]}
                    onStartShouldSetResponder={() => true}
                  >
                    {['Academic', 'Institutional', 'Event', 'Announcement', 'News'].map((type) => {
                      const typeLower = type.toLowerCase();
                      const isSelected = selectedContentTypes.includes(typeLower);
                      const getTypeColor = (typeStr: string) => {
                        switch (typeStr.toLowerCase()) {
                          case 'academic': return '#10B981';
                          case 'institutional': return t.colors.accent;
                          case 'event': return '#F59E0B';
                          case 'announcement': return '#3B82F6';
                          case 'news': return '#8B5CF6';
                          default: return t.colors.accent;
                        }
                      };
                      const typeColor = getTypeColor(type);
                      
                      return (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.filterDropdownOption,
                            { borderBottomColor: t.colors.border },
                            isSelected && { backgroundColor: t.colors.surfaceAlt }
                          ]}
                          onPress={() => toggleContentType(typeLower)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.filterDropdownOptionContent}>
                            <View style={[styles.filterDropdownCheckbox, {
                              backgroundColor: isSelected ? typeColor : 'transparent',
                              borderColor: isSelected ? typeColor : t.colors.border,
                            }]}>
                              <View style={styles.checkboxInner}>
                                {isSelected && (
                                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                                )}
                              </View>
                            </View>
                            <Text style={[styles.filterDropdownOptionText, { 
                              color: t.colors.text, 
                              fontSize: t.fontSize.scaleSize(12) 
                            }]}>
                              {type}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Pressable>
              </Modal>
            </View>
          </BlurView>
        </View>

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
          </BlurView>
        </View>

        {/* Admin Actions Section - Info Icon, Upload CSV & Delete All */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.adminActionsCard, { backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)' }]}
        >
          <View style={styles.adminActionsRow}>
            <TouchableOpacity
              style={[styles.helpButton, { 
                backgroundColor: t.colors.surface,
                borderColor: t.colors.border,
              }]}
              onPress={() => {
                navigation.navigate('CalendarHelp');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={16} color={t.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.csvUploadButton, { 
                backgroundColor: t.colors.surface,
                borderColor: t.colors.border,
                opacity: isUploadingCSV ? 0.6 : 1
              }]}
              onPress={handleCSVUpload}
              disabled={isUploadingCSV}
              activeOpacity={0.7}
            >
              {isUploadingCSV ? (
                <ActivityIndicator size="small" color={t.colors.accent} />
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
                    Alert.alert('Error', 'Failed to delete event');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  } finally {
                    setIsDeleting(false);
                  }
                },
              },
            ]
          );
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
  adminActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterDropdownWrapper: {
    position: 'relative',
    zIndex: 2000,
    marginBottom: 12,
    elevation: 20,
  },
  filterCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
  },
  filterContainer: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  filterDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  filterDropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    gap: 8,
  },
  filterDropdownSelectedChips: {
    flex: 1,
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 9,
    fontWeight: '600',
  },
  filterDropdownButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  filterDropdownOptionsModal: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 20,
  },
  filterDropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 2001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 20,
  },
  filterDropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterDropdownOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterDropdownCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    minHeight: 20,
  },
  checkboxInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDropdownOptionText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
