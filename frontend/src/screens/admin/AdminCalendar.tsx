import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, default as React, default as React, useCallback, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import { theme } from '../../config/theme';
import { useThemeValues } from '../../contexts/ThemeContext';
import MonthPickerModal from '../../modals/MonthPickerModal';
import AdminDataService from '../../services/AdminDataService';
import AdminFileService from '../../services/AdminFileService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
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


const categoryToColors = (category?: string) => {
  const key = String(category || '').toLowerCase();
  switch (key) {
    case 'announcement':
      return { dot: '#1A3E7A', chipBg: '#E8F0FF', chipBorder: '#CCE0FF', chipText: '#1A3E7A' };
    case 'academic':
      return { dot: '#0369A1', chipBg: '#F0F9FF', chipBorder: '#CFF3FF', chipText: '#0369A1' };
    case 'event':
      return { dot: '#D97706', chipBg: '#FEF3C7', chipBorder: '#FDE68A', chipText: '#92400E' };
    case 'service':
      return { dot: '#059669', chipBg: '#ECFDF5', chipBorder: '#BBF7D0', chipText: '#065F46' };
    case 'infrastructure':
      return { dot: '#DC2626', chipBg: '#FEE2E2', chipBorder: '#FECACA', chipText: '#991B1B' };
    default:
      return { dot: '#2563EB', chipBg: '#EEF2FF', chipBorder: '#E0E7FF', chipText: '#1D4ED8' };
  }
};

const parseAnyDateToKey = (input: any): string | null => {
  if (!input) return null;
  const maybe = new Date(input);
  if (!isNaN(maybe.getTime())) return formatDateKey(maybe);
  if (typeof input === 'string' && input.includes('/')) {
    const parts = input.split('/');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      const d = Number(dd), m = Number(mm) - 1, y = Number(yyyy);
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) return formatDateKey(dt);
    }
  }
  return null;
};

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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
        unsubscribe = onAuthStateChange((user) => {
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

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoadingPosts(true);
        const data = await AdminDataService.getPosts();
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load posts:', error);
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setIsLoadingPosts(false);
      }
    };
    // Use requestAnimationFrame to defer to next frame, allowing screen to render immediately
    const rafId = requestAnimationFrame(() => {
      load();
    });
    return () => { 
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Load calendar events from backend - only load once on component mount
  React.useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      try {
        setIsLoadingEvents(true);
        // Get events for current year (or all events if no date range specified)
        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear, 0, 1).toISOString(); // January 1
        const endDate = new Date(currentYear, 11, 31).toISOString(); // December 31
        
        const events = await CalendarService.getEvents({
          startDate,
          endDate,
          limit: 500, // Get up to 500 events
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
  }, []); // Empty dependency array means this runs only once on mount

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

  const selectMonth = (monthIndex: number) => {
    const newMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), monthIndex, 1));
    setCurrentMonth(newMonth);
    // Ensure the selected date moves into the chosen month so the week view reflects it
    setSelectedDate(new Date(Date.UTC(newMonth.getUTCFullYear(), newMonth.getUTCMonth(), 1)));
    closeMonthPicker();
  };

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
    
    // Add events from AdminDataService (posts)
    if (Array.isArray(posts)) {
      posts.forEach(p => {
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
          });
        }
      });
    }
    
    // Add events from CalendarService (backend calendar events)
    if (Array.isArray(calendarEvents)) {
      calendarEvents.forEach(event => {
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
          });
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
    Haptics.selectionAsync();
  }, []);

  const filteredEvents = React.useMemo(() => {
    if (!Array.isArray(posts) && !Array.isArray(calendarEvents)) return [];
    if (selectedDate && !showAllEvents) {
      return getEventsForDate(selectedDate);
    }
    
    // Combine all events from both sources when showing all events
    const allEvents: any[] = [];
    
    // Add events from posts (AdminDataService)
    if (Array.isArray(posts)) {
      allEvents.push(...posts.map(transformPostToEvent));
    }
    
    // Add events from calendarEvents (backend)
    if (Array.isArray(calendarEvents)) {
      calendarEvents.forEach(event => {
        allEvents.push({
          id: event._id || `calendar-${event.isoDate}-${event.title}`,
          title: event.title,
          dateKey: parseAnyDateToKey(event.isoDate || event.date),
          time: event.time || 'All Day',
          type: event.category || 'Announcement',
          color: categoryToColors(event.category).dot,
          chip: categoryToColors(event.category),
        });
      });
    }
    
    return allEvents;
  }, [selectedDate, showAllEvents, posts, calendarEvents, getEventsForDate]);

  const getAllEventsGrouped = React.useCallback(() => {
    if (!Array.isArray(posts) && !Array.isArray(calendarEvents)) return [];
    
    const all: any[] = [];
    
    // Add events from posts (AdminDataService)
    if (Array.isArray(posts)) {
      posts.forEach(p => {
        const eventDateKey = parseAnyDateToKey(p.isoDate || p.date);
        if (eventDateKey) {
          all.push({
            ...transformPostToEvent(p),
            dateKey: eventDateKey,
            dateObj: new Date(eventDateKey)
          });
        }
      });
    }
    
    // Add events from calendarEvents (CalendarService)
    if (Array.isArray(calendarEvents)) {
      calendarEvents.forEach(event => {
        const eventDateKey = parseAnyDateToKey(event.isoDate || event.date);
        if (eventDateKey) {
          all.push({
            id: event._id || `calendar-${event.isoDate}-${event.title}`,
            title: event.title,
            dateKey: eventDateKey,
            time: event.time || 'All Day',
            type: event.category || 'Announcement',
            color: categoryToColors(event.category).dot,
            chip: categoryToColors(event.category),
            dateObj: new Date(eventDateKey)
          });
        }
      });
    }
    
    const groupedMap = new Map();
    all.forEach(e => {
      const key = e.dateKey;
      if (!groupedMap.has(key)) groupedMap.set(key, []);
      groupedMap.get(key).push(e);
    });
    
    return Array.from(groupedMap.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([key, items]) => ({ key, items: items as any[] }));
  }, [posts, calendarEvents]); // Only recompute when posts or calendarEvents change
  
  const groupedEvents = React.useMemo(() => getAllEventsGrouped(), [getAllEventsGrouped]);

  const getMonthEventCount = (dateRef: Date) => {
    const y = dateRef.getFullYear();
    const m = dateRef.getMonth() + 1;
    
    let count = 0;
    
    // Count events from posts (AdminDataService)
    count += posts.reduce((acc, p) => {
      const key = parseAnyDateToKey(p.isoDate || p.date);
      if (!key) return acc;
      const [yy, mm] = key.split('-');
      return acc + ((Number(yy) === y && Number(mm) === m) ? 1 : 0);
    }, 0);
    
    // Count events from calendarEvents (CalendarService)
    count += calendarEvents.reduce((acc, event) => {
      const key = parseAnyDateToKey(event.isoDate || event.date);
      if (!key) return acc;
      const [yy, mm] = key.split('-');
      return acc + ((Number(yy) === y && Number(mm) === m) ? 1 : 0);
    }, 0);
    
    return count;
  };

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

      Alert.alert(
        'Upload Successful',
        `Calendar CSV uploaded successfully.\n\n${uploadResult.eventsAdded} new events added.\n${uploadResult.eventsUpdated} events updated.`,
        [
          { 
            text: 'OK',
            onPress: () => {
              // Reload calendar events to show new events
              refreshCalendarEvents();
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Failed to upload CSV file');
    } finally {
      setIsUploadingCSV(false);
    }
  }, []);

  // Refresh calendar events from backend
  const refreshCalendarEvents = useCallback(async () => {
    try {
      setIsLoadingEvents(true);
      // Get events for current year
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, 0, 1).toISOString(); // January 1
      const endDate = new Date(currentYear, 11, 31).toISOString(); // December 31
      
      const events = await CalendarService.getEvents({
        startDate,
        endDate,
        limit: 500, // Get up to 500 events
      });
      
      setCalendarEvents(Array.isArray(events) ? events : []);
    } catch (error) {
      console.error('Failed to refresh calendar events:', error);
      setCalendarEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
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
    
    return (
      <TouchableOpacity 
        style={[
          styles.calendarDay,
          { 
            backgroundColor: theme.colors.card,
            borderRightColor: theme.colors.border, 
            borderBottomColor: theme.colors.border,
            borderRightWidth: (index % 7) === 6 ? 0 : StyleSheet.hairlineWidth
          }
        ]}
        onPress={() => onPress(date)}
      >
        <View style={styles.dayContent}>
          <View style={[
            styles.dayNumberContainer,
            isCurrentDay && styles.todayContainer,
            isCurrentDay && { backgroundColor: theme.colors.accent },
            isSelectedDay && [styles.selectedContainer, { borderColor: theme.colors.accent }]
          ]}>
            <Text
              accessibilityRole="button"
              accessibilityLabel={`Select ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
              accessibilityHint="Selects this date to view events"
              style={[
                styles.dayNumber,
                { color: theme.colors.text },
                isCurrentDay && styles.todayText,
                isSelectedDay && styles.selectedText
              ]}
            >
              {day}
            </Text>
          </View>
          {eventsForDay && eventsForDay.length > 0 && (
            <View style={styles.eventIndicators}>
              {eventsForDay.slice(0, 3).map((event, eventIndex) => (
                <View 
                  key={eventIndex} 
                  style={[styles.eventDot, { backgroundColor: event.color }]} 
                />
              ))}
            </View>
          )}
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


  // List animation - DISABLED FOR PERFORMANCE DEBUGGING
  React.useEffect(() => {
    // Set values immediately without animation
    listAnim.setValue(1);
    dotScale.setValue(1);
  }, [showAllEvents, selectedDate, posts]);

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
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>School Calendar</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={() => navigation.navigate('AdminSettings')} 
            accessibilityLabel="Admin profile - Go to settings"
          >
            {backendUserPhoto ? (
              <Image 
                source={{ uri: backendUserPhoto }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.profileIconCircle, { backgroundColor: '#FF9500' }]}>
                <Text style={styles.profileInitials}>{getUserInitials()}</Text>
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
            <TouchableOpacity
              style={styles.monthSelectorButton}
              onPress={openMonthPicker}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open month picker"
              accessibilityHint="Opens a modal to select a month"
            >
              <View style={styles.monthSelectorContent}>
                <Ionicons name="calendar" size={18} color={t.colors.text} />
                <Text style={[styles.monthHeaderText, { color: t.colors.text }]}>
                  {getMonthName(currentMonth)} {currentMonth.getFullYear()}
                </Text>
                <Ionicons name="chevron-down" size={14} color={t.colors.textMuted} />
              </View>
            </TouchableOpacity>
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
              <View style={[styles.segmentedToggle, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
              <TouchableOpacity
                style={[styles.segmentItem, !showAllEvents && [styles.segmentItemActive, { backgroundColor: t.colors.surfaceAlt }]]}
                onPress={() => { setShowAllEvents(false); AccessibilityInfo.announceForAccessibility?.('Switched to Day view'); Haptics.selectionAsync(); }}
                accessibilityRole="button"
                accessibilityLabel="Day view"
              >
                <Text style={[styles.segmentText, { color: t.colors.textMuted }, !showAllEvents && styles.segmentTextActive]}>Day</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentItem, showAllEvents && [styles.segmentItemActive, { backgroundColor: t.colors.surfaceAlt }]]}
                onPress={() => { setShowAllEvents(true); AccessibilityInfo.announceForAccessibility?.('Switched to All events'); Haptics.selectionAsync(); }}
                accessibilityRole="button"
                accessibilityLabel="All events"
              >
                <Text style={[styles.segmentText, { color: t.colors.textMuted }, showAllEvents && styles.segmentTextActive]}>All</Text>
              </TouchableOpacity>
            </View>
            </View>
          </View>
          <View style={styles.eventsSubtitleRowEnhanced}>
            <Text style={[styles.eventsSubtitle, { color: t.colors.textMuted }]} numberOfLines={1}>
              {showAllEvents
                ? 'All dates'
                : selectedDate
                  ? formatDate(selectedDate)
                  : 'All dates'} — {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
            </Text>
          </View>
          <LinearGradient colors={[t.colors.border, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ height: 1, marginBottom: 10 }} />

          {filteredEvents.length === 0 && !isLoadingPosts && (
            <View style={[styles.emptyStateCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <View style={[styles.emptyStateIconWrap, { backgroundColor: t.colors.surfaceAlt }]}>
                <Ionicons name="calendar-outline" size={20} color={t.colors.accent} />
              </View>
              <Text style={[styles.emptyStateTitle, { color: t.colors.text }]}>No events yet</Text>
              <Text style={[styles.emptyStateSubtitle, { color: t.colors.textMuted }]}>
                {showAllEvents
                  ? 'Create your first event or announcement.'
                  : `No events for ${selectedDate ? formatDate(selectedDate) : 'this day'}`}
              </Text>
              <TouchableOpacity 
                style={[
                  styles.emptyStateBtn, 
                  { 
                    borderColor: t.colors.border,
                    backgroundColor: t.colors.surface,
                  }
                ]} 
                onPress={() => navigation.navigate('PostUpdate')}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={14} color={t.colors.accent} />
                <Text style={[styles.emptyStateBtnText, { color: t.colors.accent }]}>Add Event</Text>
          </TouchableOpacity>
            </View>
          )}

          {isLoadingPosts && (
            <View style={[styles.emptyStateCard, { paddingVertical: 16, overflow: 'hidden', backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <LinearGradient colors={[t.colors.surfaceAlt, t.colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ ...StyleSheet.absoluteFillObject, opacity: 0.6 }} />
              <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Loading…</Text>
            </View>
          )}

          {!showAllEvents && (
            <View>
            {Array.isArray(filteredEvents) && filteredEvents.map((event: any) => (
            <TouchableOpacity
              key={event.id}
              style={[styles.eventCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
              onPress={() => navigation.navigate('PostUpdate', { postId: event.id })}
              accessibilityRole="button"
              accessibilityLabel={`Open event ${event.title}`}
              accessibilityHint="Opens the event to view or edit"
              activeOpacity={0.7}
            >
              <View style={[styles.eventAccent, { backgroundColor: event.color }]} />
              <View style={styles.eventContent}>
                <Text style={[styles.eventTitle, { color: t.colors.text }]} numberOfLines={1}>{formatEventTitle(event.title)}</Text>
                <View style={styles.eventInnerDivider} />
                <View style={styles.eventTimeRow}>
                  <Ionicons name="time-outline" size={12} color={t.colors.textMuted} />
                  <Text style={[styles.eventTimeText, { color: t.colors.textMuted }]}>{event.time || '—'}</Text>
                </View>
                <View style={styles.statusInline}>
                  {event.isPinned && (
                    <View style={styles.statusItem}>
                      <Ionicons name="pin" size={12} color="#0284C7" />
                      <Text style={[styles.statusText, { color: '#0369A1' }]}>Pinned</Text>
                    </View>
                  )}
                  {event.isPinned && (event.isUrgent || event.type) && <Text style={styles.statusSep}>•</Text>}
                  {event.isUrgent && (
                    <View style={styles.statusItem}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={[styles.statusText, { color: '#B91C1C' }]}>Urgent</Text>
                    </View>
                  )}
                  {event.isUrgent && event.type && <Text style={[styles.statusSep, { color: t.colors.textMuted }]}>•</Text>}
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
          )}

          {showAllEvents && (
            <View>
            {Array.isArray(groupedEvents) && groupedEvents.map(group => (
            <View key={group.key} style={styles.groupContainer}>
              <Text style={[styles.groupHeaderText, { color: t.colors.textMuted }]}>
                {formatCalendarDate(new Date(group.key))}
              </Text>
              {Array.isArray(group.items) && group.items.map((event: any) => (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
                  onPress={() => navigation.navigate('PostUpdate', { postId: event.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open event ${event.title}`}
                  accessibilityHint="Opens the event to view or edit"
                  activeOpacity={0.7}
                >
                  <View style={[styles.eventAccent, { backgroundColor: event.color }]} />
                  <View style={styles.eventContent}>
                    <Text style={[styles.eventTitle, { color: t.colors.text }]} numberOfLines={1}>{event.title}</Text>
                    <View style={styles.eventInnerDivider} />
                    <View style={styles.eventTimeRow}>
                      <Ionicons name="time-outline" size={12} color={t.colors.textMuted} />
                      <Text style={[styles.eventTimeText, { color: t.colors.textMuted }]}>{event.time || '—'}</Text>
                    </View>
                    <View style={styles.statusInline}>
                      {event.isPinned && (
                        <View style={styles.statusItem}>
                          <Ionicons name="pin" size={12} color="#0284C7" />
                          <Text style={[styles.statusText, { color: '#0369A1' }]}>Pinned</Text>
                        </View>
                      )}
                      {event.isPinned && (event.isUrgent || event.type) && <Text style={styles.statusSep}>•</Text>}
                      {event.isUrgent && (
                        <View style={styles.statusItem}>
                          <Ionicons name="alert-circle" size={12} color="#DC2626" />
                          <Text style={[styles.statusText, { color: '#B91C1C' }]}>Urgent</Text>
                        </View>
                      )}
                      {event.isUrgent && event.type && <Text style={[styles.statusSep, { color: t.colors.textMuted }]}>•</Text>}
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
          )}
        </BlurView>
      </ScrollView>

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
  monthSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthHeaderText: {
    fontSize: 16,
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
    backgroundColor: '#2563EB',
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
});

export default AdminCalendar;
