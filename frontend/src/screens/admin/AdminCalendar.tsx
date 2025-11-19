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
import { ActivityIndicator, Alert, Animated, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddEventDrawer from '../../components/calendar/AddEventDrawer';
import EventDetailsDrawer from '../../components/calendar/EventDetailsDrawer';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import AdminSidebar from '../../components/navigation/AdminSidebar';
import { theme } from '../../config/theme';
import { useThemeValues } from '../../contexts/ThemeContext';
import CalendarHelpModal from '../../modals/CalendarHelpModal';
import DeleteAllModal from '../../modals/DeleteAllModal';
import MonthPickerModal from '../../modals/MonthPickerModal';
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
  
  // Check for Institutional events (blue)
  const hasInstitutional = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'institutional';
  });
  
  // Check for Academic events (green)
  const hasAcademic = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'academic';
  });
  
  // Priority: Institutional (blue) > Academic (green)
  if (hasInstitutional) return '#2563EB'; // Blue
  if (hasAcademic) return '#10B981'; // Green
  
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
  
  // Background animation values (Copilot-style animated orbs)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim2 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;
  
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
  const [showAddEventDrawer, setShowAddEventDrawer] = useState(false);
  const [addEventInitialDate, setAddEventInitialDate] = useState<Date | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Drawer animation values (shared between EventDetailsDrawer and AddEventDrawer)
  const drawerSlideAnim = useRef(new Animated.Value(0)).current; // 0 = closed, 1 = open
  const drawerBackdropOpacity = useRef(new Animated.Value(0)).current;
  
  // Help modal animation values (same as EventDetailsDrawer)
  const helpModalSlideAnim = useRef(new Animated.Value(0)).current; // 0 = closed, 1 = open
  const helpModalBackdropOpacity = useRef(new Animated.Value(0)).current;
  
  // Delete all modal animation values
  const deleteAllModalSlideAnim = useRef(new Animated.Value(0)).current;
  const deleteAllModalBackdropOpacity = useRef(new Animated.Value(0)).current;
  
  // Event type filter - single selection: 'institutional' or 'academic'
  const [selectedEventType, setSelectedEventType] = useState<'institutional' | 'academic'>('institutional');
  
  // Segmented control animation and width tracking
  const segmentAnim = useRef(new Animated.Value(0)).current; // 0 = institutional, 1 = academic
  const segmentWidth = useRef(0);
  
  // Animation values
  const monthPickerScaleAnim = useRef(new Animated.Value(0)).current;
  const monthPickerOpacityAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.8)).current;
  
  // Update segment animation when selection changes
  useEffect(() => {
    if (segmentWidth.current > 0) {
      const targetX = selectedEventType === 'academic' 
        ? segmentWidth.current / 2 - 2 
        : 2;
      Animated.spring(segmentAnim, {
        toValue: targetX,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [selectedEventType, segmentAnim]);
  
  // Derived filter states for compatibility with existing code
  const showInstitutional = selectedEventType === 'institutional';
  const showAcademic = selectedEventType === 'academic';

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

  // Animate floating background orbs (Copilot-style)
  useEffect(() => {
    const animations = [
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
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(cloudAnim1, {
            toValue: 1,
            duration: 15000,
            useNativeDriver: true,
          }),
          Animated.timing(cloudAnim1, {
            toValue: 0,
            duration: 15000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(cloudAnim2, {
            toValue: 1,
            duration: 20000,
            useNativeDriver: true,
          }),
          Animated.timing(cloudAnim2, {
            toValue: 0,
            duration: 20000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lightSpot1, {
            toValue: 1,
            duration: 12000,
            useNativeDriver: true,
          }),
          Animated.timing(lightSpot1, {
            toValue: 0,
            duration: 12000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lightSpot2, {
            toValue: 1,
            duration: 18000,
            useNativeDriver: true,
          }),
          Animated.timing(lightSpot2, {
            toValue: 0,
            duration: 18000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lightSpot3, {
            toValue: 1,
            duration: 14000,
            useNativeDriver: true,
          }),
          Animated.timing(lightSpot3, {
            toValue: 0,
            duration: 14000,
            useNativeDriver: true,
          }),
        ])
      ),
    ];
    animations.forEach(anim => anim.start());
    return () => animations.forEach(anim => anim.stop());
  }, []);


  // Data from AdminDataService
  const [posts, setPosts] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState<boolean>(false);
  
  // Calculate min/max years from events to dynamically adjust calendar range
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

  
  
  // Set posts to empty array - only CSV calendar events will be shown
  React.useEffect(() => {
    setPosts([]);
    setIsLoadingPosts(false);
  }, []);

  // Load calendar events from backend - load all events (or wide range)
  // Refresh when screen comes into focus to show newly created posts/events
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadEvents = async () => {
        try {
          setIsLoadingEvents(true);
          // Load events for a wide range (2020-2030) to cover all possible dates
          // This ensures we get all events regardless of year
          const startDate = new Date(2020, 0, 1).toISOString(); // January 1, 2020
          const endDate = new Date(2030, 11, 31).toISOString(); // December 31, 2030
          
          const events = await CalendarService.getEvents({
            startDate,
            endDate,
            limit: 2000, // Increased limit to get more events
          });
          
          if (!cancelled) {
            setCalendarEvents(Array.isArray(events) ? events : []);
          }
        } catch (error) {
          console.error('Failed to load calendar events:', error);
          if (!cancelled) setCalendarEvents([]);
        } finally {
          if (!cancelled) setIsLoadingEvents(false);
        }
      };
      
      loadEvents();
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
    
    // DISABLED: Posts from AdminDataService - Only showing CSV calendar events
    // if (Array.isArray(posts)) {
    //   posts.forEach(p => {
    //     // Only include posts that are NOT from CSV uploads (to avoid duplicates)
    //     if (p.source !== 'CSV Upload') {
    //       const eventDateKey = parseAnyDateToKey(p.isoDate || p.date);
    //       if (eventDateKey === key) {
    //         events.push({
    //           id: p.id,
    //           title: p.title,
    //           dateKey: eventDateKey,
    //           time: p.time || '',
    //           type: p.category || 'Announcement',
    //           color: categoryToColors(p.category).dot,
    //           chip: categoryToColors(p.category),
    //         });
    //       }
    //     }
    //   });
    // }
    
    // Add events from CalendarService (backend calendar events)
    if (Array.isArray(calendarEvents)) {
      calendarEvents.forEach(event => {
        // Skip week/month-only events for calendar grid (they only show in All tab)
        if (event.dateType === 'week' || event.dateType === 'month') {
          return;
        }
        
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
  }, [posts, calendarEvents]); // Only recompute when posts or calendarEvents change

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
      // Get the first event and find its full data from calendarEvents
      const firstEvent = events[0];
      const fullEvent = calendarEvents.find((e: any) => {
        // Try to match by _id first
        if (e._id === firstEvent.id) return true;
        // Try to match by constructed ID
        if (`calendar-${e.isoDate}-${e.title}` === firstEvent.id) return true;
        // Try to match by date and title
        const eventDateKey = parseAnyDateToKey(e.isoDate || e.date);
        const checkDateKey = formatDateKey(date);
        return eventDateKey === checkDateKey && e.title === firstEvent.title;
      });
      
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
      
      // Animate drawer opening
      Animated.parallel([
        Animated.spring(drawerSlideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(drawerBackdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.selectionAsync();
    }
  }, [getEventsForDate, calendarEvents, drawerSlideAnim, drawerBackdropOpacity]);
  
  const closeEventDrawer = useCallback(() => {
    Animated.parallel([
      Animated.spring(drawerSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(drawerBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowEventDrawer(false);
    });
  }, [drawerSlideAnim, drawerBackdropOpacity]);

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

  const filteredEvents = React.useMemo(() => {
    if (!Array.isArray(calendarEvents)) return [];
    
    // Combine all events from calendarEvents (backend) - include ALL events including week/month-only
    // Use a Set to track date ranges we've already added (to avoid duplicates)
    const dateRangeKeys = new Set<string>();
    const allEvents: any[] = [];
    
    if (Array.isArray(calendarEvents)) {
      calendarEvents.forEach(event => {
        const eventType = String(event.category || 'Announcement').toLowerCase();
        
        // Apply filters
        if (!showInstitutional && eventType === 'institutional') return;
        if (!showAcademic && eventType === 'academic') return;
        
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
  }, [calendarEvents, showInstitutional, showAcademic]);

  const getAllEventsGrouped = React.useCallback(() => {
    if (!Array.isArray(calendarEvents)) return [];
    
    const all: any[] = [];
    
    // Add events from calendarEvents (CalendarService)
    // Use a Set to track date ranges we've already added (to avoid duplicates)
    const dateRangeKeys = new Set<string>();
    
    if (Array.isArray(calendarEvents)) {
      calendarEvents.forEach(event => {
        const eventType = String(event.category || 'Announcement').toLowerCase();
        
        // Apply filters
        if (!showInstitutional && eventType === 'institutional') return;
        if (!showAcademic && eventType === 'academic') return;
        
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
  }, [calendarEvents, showInstitutional, showAcademic]); // Only recompute when calendarEvents or filters change
  
  const groupedEvents = React.useMemo(() => getAllEventsGrouped(), [getAllEventsGrouped]);

  const getMonthEventCount = (dateRef: Date) => {
    const y = dateRef.getFullYear();
    const m = dateRef.getMonth() + 1;
    
    let count = 0;
    
    // DISABLED: Count events from posts (AdminDataService) - Only counting CSV calendar events
    // count += posts
    //   .filter(p => p.source !== 'CSV Upload')
    //   .reduce((acc, p) => {
    //     const key = parseAnyDateToKey(p.isoDate || p.date);
    //     if (!key) return acc;
    //     const [yy, mm] = key.split('-');
    //     return acc + ((Number(yy) === y && Number(mm) === m) ? 1 : 0);
    //   }, 0);
    
    // Count events from calendarEvents (CalendarService)
    // For date ranges, count if any date in range falls in the month
    // For week/month-only events, count if the month matches
    count += calendarEvents.reduce((acc, event) => {
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

  // Refresh calendar events from backend
  const refreshCalendarEvents = useCallback(async () => {
    try {
      setIsLoadingEvents(true);
      // Load events for a wide range (2020-2030) to cover all possible dates
      const startDate = new Date(2020, 0, 1).toISOString(); // January 1, 2020
      const endDate = new Date(2030, 11, 31).toISOString(); // December 31, 2030
      
      const events = await CalendarService.getEvents({
        startDate,
        endDate,
        limit: 2000, // Increased limit to get more events
      });
      
      setCalendarEvents(Array.isArray(events) ? events : []);
    } catch (error) {
      console.error('Failed to refresh calendar events:', error);
      setCalendarEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

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
      
      // Refresh calendar events to show new dates
      await refreshCalendarEvents();
      
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
        await refreshCalendarEvents();
        
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

  // Handler for opening add event drawer
  const handleOpenAddEvent = useCallback((date?: Date) => {
    const targetDate = date || selectedDate || new Date();
    setAddEventInitialDate(targetDate);
    setShowAddEventDrawer(true);
    
    // Animate drawer opening - same as EventDetailsDrawer
    Animated.parallel([
      Animated.spring(drawerSlideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(drawerBackdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [selectedDate, drawerSlideAnim, drawerBackdropOpacity]);

  const handleCloseAddEvent = useCallback(() => {
    // Animate drawer closing - same as EventDetailsDrawer
    Animated.parallel([
      Animated.spring(drawerSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(drawerBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowAddEventDrawer(false);
      setAddEventInitialDate(null);
    });
  }, [drawerSlideAnim, drawerBackdropOpacity]);

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
            // Selected day: orange border around entire cell (2px)
            // Non-selected: normal grid borders (hairline)
            borderTopWidth: isSelected ? 2 : 0,
            borderTopColor: isSelected ? '#FF9500' : 'transparent',
            borderLeftWidth: isSelected ? 2 : 0,
            borderLeftColor: isSelected ? '#FF9500' : 'transparent',
            borderRightWidth: isLastColumn ? (isSelected ? 2 : 0) : (isSelected ? 2 : StyleSheet.hairlineWidth),
            borderRightColor: isSelected ? '#FF9500' : theme.colors.border,
            borderBottomWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
            borderBottomColor: isSelected ? '#FF9500' : theme.colors.border,
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
            isCurrentDay && { backgroundColor: '#FF9500' }, // Always orange for current day
            !isCurrentDay && cellColor && { backgroundColor: cellColor }, // Only apply cell color if not current day
          ]}>
            <Text
              accessibilityRole="button"
              accessibilityLabel={`Select ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
              accessibilityHint={hasEvents ? "Tap to view events for this date" : "Selects this date"}
              style={[
                styles.dayNumber,
                isCurrentDay && { color: '#FFFFFF', fontWeight: '700' }, // White text for current day (orange background)
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
        colors={isDarkMode ? ['#1F1F1F', '#2A2A2A', '#1A1A1A'] : ['#FBF8F3', '#F8F5F0', '#F5F2ED']}
        style={styles.backgroundGradient}
      />
      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint={isDarkMode ? 'dark' : 'light'}
        style={styles.backgroundGradient}
      />

      {/* Animated Floating Background Orbs (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        {/* Light Spot 1 - Top right gentle glow */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              top: '8%',
              right: '12%',
              transform: [
                {
                  translateX: lightSpot1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -15],
                  }),
                },
                {
                  translateY: lightSpot1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 12],
                  }),
                },
                {
                  scale: lightSpot1.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.08, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.lightSpot1}>
            <LinearGradient
              colors={['rgba(255, 220, 180, 0.35)', 'rgba(255, 200, 150, 0.18)', 'rgba(255, 230, 200, 0.08)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0.2, y: 0.2 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        {/* Light Spot 2 - Middle left soft circle */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              top: '45%',
              left: '8%',
              transform: [
                {
                  translateX: lightSpot2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 18],
                  }),
                },
                {
                  translateY: lightSpot2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -10],
                  }),
                },
                {
                  scale: lightSpot2.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.06, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.lightSpot2}>
            <LinearGradient
              colors={['rgba(255, 210, 170, 0.28)', 'rgba(255, 200, 160, 0.15)', 'rgba(255, 220, 190, 0.06)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0.3, y: 0.3 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        {/* Light Spot 3 - Bottom center blurry glow */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              bottom: '12%',
              left: '55%',
              transform: [
                {
                  translateX: lightSpot3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -20],
                  }),
                },
                {
                  translateY: lightSpot3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 8],
                  }),
                },
                {
                  scale: lightSpot3.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.1, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.lightSpot3}>
            <LinearGradient
              colors={['rgba(255, 190, 140, 0.25)', 'rgba(255, 180, 130, 0.12)', 'rgba(255, 210, 170, 0.05)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0.4, y: 0.4 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        {/* Cloud variation 1 - Top left soft light patch */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              top: '15%',
              left: '10%',
              transform: [
                {
                  translateX: cloudAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 20],
                  }),
                },
                {
                  translateY: cloudAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -15],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.cloudPatch1}>
            <LinearGradient
              colors={['rgba(255, 200, 150, 0.4)', 'rgba(255, 210, 170, 0.22)', 'rgba(255, 230, 200, 0.1)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        {/* Cloud variation 2 - Bottom right gentle tone */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              bottom: '20%',
              right: '15%',
              transform: [
                {
                  translateX: cloudAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -25],
                  }),
                },
                {
                  translateY: cloudAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 10],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.cloudPatch2}>
            <LinearGradient
              colors={['rgba(255, 190, 140, 0.32)', 'rgba(255, 200, 160, 0.18)', 'rgba(255, 220, 190, 0.08)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0.3, y: 0.3 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        {/* Orb 1 - Soft Orange Glow (Center area) */}
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
              colors={['rgba(255, 165, 100, 0.45)', 'rgba(255, 149, 0, 0.3)', 'rgba(255, 180, 120, 0.18)']}
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
            accessibilityLabel="Open sidebar"
          >
            <View style={styles.customHamburger} pointerEvents="none">
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
            </View>
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>DOrSU Calendar</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={() => {
              setShowHelpModal(true);
              Animated.parallel([
                Animated.spring(helpModalSlideAnim, {
                  toValue: 1,
                  useNativeDriver: true,
                  tension: 65,
                  friction: 11,
                }),
                Animated.timing(helpModalBackdropOpacity, {
                  toValue: 1,
                  duration: 300,
                  useNativeDriver: true,
                }),
              ]).start();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            accessibilityLabel="Calendar help and instructions"
          >
            <View style={[styles.profileIconCircle, { backgroundColor: '#FF9500' }]}>
              <Text style={styles.profileInitials}>?</Text>
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
                <Text style={[styles.angleBrackets, { color: t.colors.textMuted }]}>
                  {'<'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.monthSelectorButton}
                onPress={navigateToNextMonth}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                accessibilityHint="Navigate to next month"
              >
                <Text style={[styles.monthHeaderText, { color: t.colors.text }]}>
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
                <Text style={[styles.angleBrackets, { color: t.colors.textMuted }]}>
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
                  style={[styles.weekDayText, { color: t.colors.textMuted }]}
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


        {/* Day Summary removed by request (Events section already shows count) */}

        {/* Events Section - Glassmorphic */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[
            styles.eventsSection,
            {
              backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)'
            }
          ]}
        >
          <View style={styles.eventsHeader}>
            <View style={styles.eventsHeaderLeft}>
              <View style={[styles.eventsIconWrap, { borderColor: t.colors.border }]}>
                <Ionicons name="calendar-outline" size={14} color={t.colors.accent} />
        </View>
              <Text style={[styles.eventsTitle, { color: t.colors.text }]}>Events</Text>
            </View>
            <View style={styles.eventsHeaderRight}>
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
                    <Text style={[styles.csvUploadText, { color: t.colors.accent }]}>Upload CSV</Text>
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
                    <Text style={[styles.deleteAllText, { color: '#DC2626' }]}>Delete All</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Event Type Segmented Control */}
          <View style={styles.segmentedControlContainer}>
            <View 
              style={[styles.segmentedControl, { backgroundColor: selectedEventType === 'institutional' ? '#2563EB' : '#10B981' }]}
              onLayout={(e) => {
                segmentWidth.current = e.nativeEvent.layout.width;
                // Initialize animation position
                const targetX = selectedEventType === 'academic' 
                  ? segmentWidth.current / 2 - 2 
                  : 2;
                segmentAnim.setValue(targetX);
              }}
            >
              <Animated.View
                style={[
                  styles.segmentedSelector,
                  {
                    transform: [
                      {
                        translateX: segmentAnim,
                      },
                    ],
                  }
                ]}
              />
              <View style={styles.segmentedOptionsContainer}>
                <TouchableOpacity
                  style={styles.segmentedOption}
                  onPress={() => {
                    setSelectedEventType('institutional');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.segmentedOptionText,
                    { color: selectedEventType === 'institutional' ? '#2563EB' : '#FFFFFF' }
                  ]}>
                    Institutional
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.segmentedOption}
                  onPress={() => {
                    setSelectedEventType('academic');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.segmentedOptionText,
                    { color: selectedEventType === 'academic' ? '#10B981' : '#FFFFFF' }
                  ]}>
                    Academic
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          <View style={styles.eventsSubtitleRowEnhanced}>
            <Text style={[styles.eventsSubtitle, { color: t.colors.textMuted }]} numberOfLines={1}>
              All events — {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
            </Text>
          </View>
          <LinearGradient colors={[t.colors.border, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ height: 1, marginBottom: 10 }} />

          {filteredEvents.length === 0 && !isLoadingEvents && (
            <View style={[styles.emptyStateCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <View style={[styles.emptyStateIconWrap, { backgroundColor: t.colors.surfaceAlt }]}>
                <Ionicons name="calendar-outline" size={20} color={t.colors.accent} />
              </View>
              <Text style={[styles.emptyStateTitle, { color: t.colors.text }]}>No events yet</Text>
              <Text style={[styles.emptyStateSubtitle, { color: t.colors.textMuted }]}>
                {!showInstitutional && !showAcademic
                  ? 'Please enable at least one event type filter.'
                  : 'Upload a CSV file to add calendar events.'}
              </Text>
              <TouchableOpacity 
                style={[
                  styles.emptyStateBtn, 
                  { 
                    borderColor: t.colors.border,
                    backgroundColor: t.colors.surface,
                  }
                ]} 
                onPress={() => handleOpenAddEvent()}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={14} color={t.colors.accent} />
                <Text style={[styles.emptyStateBtnText, { color: t.colors.accent }]}>Add Event</Text>
          </TouchableOpacity>
            </View>
          )}

          {isLoadingEvents && (
            <View style={[styles.emptyStateCard, { paddingVertical: 16, overflow: 'hidden', backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <LinearGradient colors={[t.colors.surfaceAlt, t.colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ ...StyleSheet.absoluteFillObject, opacity: 0.6 }} />
              <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Loading…</Text>
            </View>
          )}

          {/* All Events List - Flat list with dates inside cards */}
          <View>
            {Array.isArray(groupedEvents) && groupedEvents.map((yearGroup) => (
              <View key={yearGroup.year} style={styles.yearGroupContainer}>
                <Text style={[styles.yearHeaderText, { color: t.colors.text }]}>
                  {yearGroup.year}
                </Text>
                {Array.isArray(yearGroup.dates) && yearGroup.dates.map((dateGroup) => (
                  <View key={dateGroup.key}>
                    {Array.isArray(dateGroup.items) && dateGroup.items.map((event: any) => (
                      <TouchableOpacity
                        key={event.id}
                        style={[styles.eventCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
                        onPress={() => {
                          // Find the full event from calendarEvents
                          const fullEvent = calendarEvents.find((e: any) => e._id === event.id || `calendar-${e.isoDate}-${e.title}` === event.id);
                          const eventData = fullEvent || event;
                          setSelectedEvent(eventData);
                          setEditTitle(eventData?.title || '');
                          setEditDescription(eventData?.description || '');
                          
                          // Set date and time for editing
                          if (eventData?.isoDate || eventData?.date) {
                            const eventDate = new Date(eventData.isoDate || eventData.date);
                            setSelectedDateObj(eventDate);
                            setEditDate(formatDate(eventDate));
                          } else {
                            setSelectedDateObj(null);
                            setEditDate('');
                          }
                          setEditTime(eventData?.time || '');
                          
                          setIsEditing(false);
                          setShowEventDrawer(true);
                          
                          // Animate drawer opening
                          Animated.parallel([
                            Animated.spring(drawerSlideAnim, {
                              toValue: 1,
                              useNativeDriver: true,
                              tension: 65,
                              friction: 11,
                            }),
                            Animated.timing(drawerBackdropOpacity, {
                              toValue: 1,
                              duration: 300,
                              useNativeDriver: true,
                            }),
                          ]).start();
                          
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Open event ${event.title}`}
                        accessibilityHint="Opens the event to view or edit"
                        activeOpacity={0.7}
                      >
                        <View style={[styles.eventAccent, { backgroundColor: event.color }]} />
                        <View style={styles.eventContent}>
                          {/* Date inside the card */}
                          <View style={styles.eventDateRow}>
                            <Text style={[styles.eventDateText, { color: t.colors.textMuted }]}>
                              {formatCalendarDate(new Date(dateGroup.key))}
                            </Text>
                          </View>
                          <Text style={[styles.eventTitle, { color: t.colors.text }]} numberOfLines={2}>
                            {event.title}
                          </Text>
                          <View style={styles.eventInnerDivider} />
                          <View style={styles.eventTimeRow}>
                            <Ionicons name="time-outline" size={12} color={t.colors.textMuted} />
                            <Text style={[styles.eventTimeText, { color: t.colors.textMuted }]}>
                              {event.dateType === 'date_range' && event.startDate && event.endDate
                                ? `${formatDate(new Date(event.startDate))} - ${formatDate(new Date(event.endDate))}`
                                : event.dateType === 'week' && event.weekOfMonth && event.month
                                ? `Week ${event.weekOfMonth} of ${new Date(2000, event.month - 1, 1).toLocaleString('default', { month: 'long' })}`
                                : event.dateType === 'month' && event.month
                                ? new Date(2000, event.month - 1, 1).toLocaleString('default', { month: 'long' })
                                : event.time || 'All Day'}
                            </Text>
                          </View>
                          <View style={styles.statusInline}>
                            {!!event.type && (
                              <View style={styles.statusItem}>
                                <Ionicons name="pricetag-outline" size={12} color={event.color} />
                                <Text style={[styles.statusText, { color: event.color }]}>
                                  {String(event.type || '').charAt(0).toUpperCase() + String(event.type || '').slice(1)}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </BlurView>
      </ScrollView>

      {/* Event Details Drawer */}
      <EventDetailsDrawer
        visible={showEventDrawer}
        onClose={closeEventDrawer}
        selectedEvent={selectedEvent}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        editDate={editDate}
        setEditDate={setEditDate}
        editTime={editTime}
        setEditTime={setEditTime}
        selectedDateObj={selectedDateObj}
        setSelectedDateObj={setSelectedDateObj}
        showDatePicker={showDatePicker}
        setShowDatePicker={setShowDatePicker}
        isDeleting={isDeleting}
        setIsDeleting={setIsDeleting}
        isUpdating={isUpdating}
        setIsUpdating={setIsUpdating}
        selectedDateEvents={selectedDateEvents}
        selectedDateForDrawer={selectedDateForDrawer}
        calendarEvents={calendarEvents}
        refreshCalendarEvents={refreshCalendarEvents}
        slideAnim={drawerSlideAnim}
        backdropOpacity={drawerBackdropOpacity}
        monthPickerScaleAnim={monthPickerScaleAnim}
        monthPickerOpacityAnim={monthPickerOpacityAnim}
        onSelectEvent={(event) => {
          if (!event) {
            // Clear selected event if null is passed (e.g., after deletion)
            setSelectedEvent(null);
            setEditTitle('');
            setEditDescription('');
            setSelectedDateObj(null);
            setEditDate('');
            setEditTime('');
            // Also clear selected date events to refresh the list
            setSelectedDateEvents([]);
            return;
          }
          setSelectedEvent(event);
          setEditTitle(event?.title || '');
          setEditDescription(event?.description || '');
          if (event?.isoDate || event?.date) {
            const eventDate = new Date(event.isoDate || event.date);
            setSelectedDateObj(eventDate);
            setEditDate(formatDate(eventDate));
          } else if (selectedDateForDrawer) {
            setSelectedDateObj(selectedDateForDrawer);
            setEditDate(formatDate(selectedDateForDrawer));
          }
          setEditTime(event?.time || '');
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

      {/* Add Event Drawer */}
      <AddEventDrawer
        visible={showAddEventDrawer}
        onClose={handleCloseAddEvent}
        initialDate={addEventInitialDate}
        refreshCalendarEvents={refreshCalendarEvents}
        slideAnim={drawerSlideAnim}
        backdropOpacity={drawerBackdropOpacity}
        monthPickerScaleAnim={monthPickerScaleAnim}
        monthPickerOpacityAnim={monthPickerOpacityAnim}
        eventYearRange={{ minYear: eventYearRange.min, maxYear: eventYearRange.max }}
      />

      {/* Help Modal */}
      {showHelpModal && (
        <CalendarHelpModal
          visible={showHelpModal}
          onClose={() => {
            Animated.parallel([
              Animated.spring(helpModalSlideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
              }),
              Animated.timing(helpModalBackdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => {
              setShowHelpModal(false);
            });
          }}
          slideAnim={helpModalSlideAnim}
          backdropOpacity={helpModalBackdropOpacity}
        />
      )}

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
  cloudWrapper: {
    position: 'absolute',
  },
  cloudPatch1: {
    width: 350,
    height: 350,
    borderRadius: 175,
    opacity: 0.25,
    overflow: 'hidden',
  },
  cloudPatch2: {
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.22,
    overflow: 'hidden',
  },
  lightSpot1: {
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.2,
    overflow: 'hidden',
  },
  lightSpot2: {
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.18,
    overflow: 'hidden',
  },
  lightSpot3: {
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.16,
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
  },
  headerLeft: {
    width: 44,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 18,
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
    backgroundColor: '#FF9500',
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
  },
  headerRight: {
    width: 44,
    alignItems: 'flex-end',
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
    backgroundColor: '#FF9500', // Orange for current day
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
    shadowColor: '#000',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  eventsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventsHeaderRight: {
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
    shadowColor: '#000',
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
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  csvUploadText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteAllText: {
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: '#2563EB',
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
