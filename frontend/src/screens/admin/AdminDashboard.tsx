import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EventDetailsDrawer from '../../components/calendar/EventDetailsDrawer';
// import AddPostDrawer from '../../components/dashboard/AddPostDrawer'; // Replaced with PostUpdate screen navigation
import PreviewEditDeleteModal from '../../modals/PreviewEditDeleteModal';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import AdminSidebar from '../../components/navigation/AdminSidebar';
import { useThemeValues } from '../../contexts/ThemeContext';
import AdminDataService from '../../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
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
  isoDate?: string 
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


const AdminDashboard = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const userName = useMemo(() => currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin', [currentUser]);
  
  // Dashboard data
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'recent'>('all');
  const [dashboardData, setDashboardData] = useState({
    recentUpdates: [] as DashboardUpdate[],
  });
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [allUpdates, setAllUpdates] = useState<DashboardUpdate[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendarEvents, setIsLoadingCalendarEvents] = useState(false);
  
  // Modal state (using PreviewEditDeleteModal instead of PostDetailsDrawer)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  
  // Event drawer state
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([]);
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const eventDrawerSlideAnim = useRef(new Animated.Value(0)).current;
  const eventDrawerBackdropOpacity = useRef(new Animated.Value(0)).current;
  const eventDrawerMonthPickerScaleAnim = useRef(new Animated.Value(0)).current;
  const eventDrawerMonthPickerOpacityAnim = useRef(new Animated.Value(0)).current;
  
  // Animated floating background orbs (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim2 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;

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

  // Filtered updates based on selected time filter
  const displayedUpdates = useMemo(() => {
    if (timeFilter === 'upcoming') return upcomingUpdates;
    if (timeFilter === 'recent') return recentUpdates;
    return allUpdates; // 'all'
  }, [timeFilter, upcomingUpdates, recentUpdates, allUpdates]);

  // Current month calendar events (separate from posts/announcements)
  const currentMonthEvents = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    return calendarEvents
      .filter(event => {
        const eventDate = event.isoDate || event.date;
        if (!eventDate) return false;
        const eventDateObj = new Date(eventDate);
        return eventDateObj.getFullYear() === currentYear &&
               eventDateObj.getMonth() === currentMonth;
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
      }))
      .sort((a, b) => {
        const dateA = new Date(a.isoDate || a.date).getTime();
        const dateB = new Date(b.isoDate || b.date).getTime();
        return dateA - dateB; // Sort ascending (earliest first)
      });
  }, [calendarEvents]);

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
          setBackendUserPhoto(userPhoto);
        } catch (error) {
          if (__DEV__) console.error('Failed to load backend user data:', error);
        }
      };
      
      loadBackendUserData();
    }, [])
  );

  const getUserInitials = () => {
    if (!userName) return '?';
    const names = userName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  };

  // Animate floating background orbs on mount
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
  }, []);

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
        forceRefresh,
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
  // Fetch calendar events on mount only
  useEffect(() => {
    refreshCalendarEvents(true); // Force refresh on mount
  }, []); // Empty deps - only run on mount
  
  // Initialize edit fields when event is selected
  useEffect(() => {
    if (selectedEvent && showEventDrawer) {
      if (isEditing) {
        setEditTitle(selectedEvent.title || '');
        setEditDescription(selectedEvent.description || '');
        setEditTime(selectedEvent.time || 'All Day');
        if (selectedEvent.isoDate || selectedEvent.date) {
          const eventDate = new Date(selectedEvent.isoDate || selectedEvent.date);
          setSelectedDateObj(eventDate);
          setEditDate(formatDate(eventDate));
        } else {
          setSelectedDateObj(null);
          setEditDate('');
        }
      }
    }
  }, [selectedEvent, showEventDrawer, isEditing]);
  
  // Open event drawer
  const openEventDrawer = useCallback((event: CalendarEvent, date?: Date) => {
    setSelectedEvent(event);
    if (date) {
      setSelectedDateForDrawer(date);
      // Find all events on this date
      const dateKey = formatDateKey(date);
      const eventsOnDate = calendarEvents.filter(e => {
        const eventDateKey = parseAnyDateToKey(e.isoDate || e.date);
        return eventDateKey === dateKey;
      });
      setSelectedDateEvents(eventsOnDate.map(e => ({
        id: e._id || `calendar-${e.isoDate}-${e.title}`,
        title: e.title,
        color: categoryToColors(e.category || 'Event').dot,
        type: e.category || 'Event',
      })));
    } else {
      setSelectedDateForDrawer(null);
      setSelectedDateEvents([]);
    }
    setShowEventDrawer(true);
    setIsEditing(false);
    Animated.parallel([
      Animated.spring(eventDrawerSlideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(eventDrawerBackdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [calendarEvents, eventDrawerSlideAnim, eventDrawerBackdropOpacity]);
  
  // Close event drawer
  const closeEventDrawer = useCallback(() => {
    Animated.parallel([
      Animated.spring(eventDrawerSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(eventDrawerBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowEventDrawer(false);
      setSelectedEvent(null);
      setSelectedDateForDrawer(null);
      setSelectedDateEvents([]);
      setIsEditing(false);
    });
  }, [eventDrawerSlideAnim, eventDrawerBackdropOpacity]);

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
      const posts = await AdminDataService.getPosts(forceRefresh);
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
  }, []); // Empty deps - only run on mount

  // Refresh dashboard data when screen comes into focus (with smart refresh)
  useFocusEffect(
    useCallback(() => {
      // Only refresh if data is older than 30 seconds
      const timeSinceLastFetch = Date.now() - lastFetchTime.current;
      const shouldRefresh = timeSinceLastFetch > 30 * 1000; // 30 seconds
      
      if (shouldRefresh) {
        fetchDashboardData(false); // Use cache if available
      }
    }, [fetchDashboardData])
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

      {/* Animated Floating Background Orbs (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none" collapsable={false}>
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

      {/* Header - Copilot Style */}
      <View style={[styles.header, { 
        marginTop: safeInsets.top,
        marginLeft: safeInsets.left,
        marginRight: safeInsets.right,
      }]} collapsable={false}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={() => setIsHistoryOpen(true)} 
            style={styles.menuButton}
            accessibilityLabel="Open menu"
          >
            <View style={styles.customHamburger} pointerEvents="none">
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
            </View>
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Dashboard</Text>
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
              <View style={[styles.profileIconCircle, { backgroundColor: isDarkMode ? '#FF9500' : '#FF9500' }]}>
                <Text style={styles.profileInitials}>{getUserInitials()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Admin Sidebar Component */}
      <AdminSidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Main Content - Scrollable */}
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={{ 
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: safeInsets.bottom + 100 
        }}
        showsVerticalScrollIndicator={true}
        bounces={true}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeText}>
            <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>Hello {userName},</Text>
            <Text style={[styles.welcomeSubtitle, { color: theme.colors.textMuted }]}>Here's your admin dashboard</Text>
          </View>
        </View>

        {/* Current Month Calendar Events Section */}
        {currentMonthEvents.length > 0 && (
          <View style={[styles.calendarEventsSection, { borderColor: theme.colors.border, marginBottom: 12, marginHorizontal: 0 }]} collapsable={false}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 20 : 15}
              tint={isDarkMode ? 'dark' : 'light'}
              style={styles.calendarEventsBlur}
            >
              <View style={[styles.calendarEventsContent, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]} collapsable={false}>
                <View style={styles.sectionHeaderEnhanced}>
                  <View style={[styles.sectionIconWrapper, { backgroundColor: '#FF9500' + '15' }]}>
                    <Ionicons 
                      name="calendar-outline" 
                      size={20} 
                      color="#FF9500" 
                    />
                  </View>
                  <View style={styles.sectionTitleWrapper}>
                    <Text style={[styles.sectionTitleEnhanced, { color: theme.colors.text }]}>
                      DOrSU Calendar - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
                      {currentMonthEvents.length} event{currentMonthEvents.length !== 1 ? 's' : ''} this month
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  contentContainerStyle={{ paddingRight: 12, gap: 12 }}
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
                    
                    // Find the full CalendarEvent object
                    const fullEvent = calendarEvents.find(e => 
                      e._id === event.id || 
                      `calendar-${e.isoDate}-${e.title}` === event.id
                    ) || null;
                    
                    return (
                      <TouchableOpacity
                        key={event.id}
                        style={[styles.calendarEventCard, { 
                          backgroundColor: theme.colors.surface, 
                          borderColor: theme.colors.border,
                          minWidth: 280,
                        }]}
                        activeOpacity={0.7}
                        delayPressIn={0}
                        onPress={() => {
                          if (fullEvent) {
                            const eventDate = fullEvent.isoDate || fullEvent.date 
                              ? new Date(fullEvent.isoDate || fullEvent.date)
                              : new Date();
                            openEventDrawer(fullEvent, eventDate);
                          }
                        }}
                      >
                        <View style={[styles.calendarEventAccent, { backgroundColor: accentColor }]} collapsable={false} />
                        <View style={styles.calendarEventContent} collapsable={false}>
                          <View style={styles.calendarEventHeader}>
                            <View style={[styles.calendarEventIconWrapper, { backgroundColor: accentColor + '20' }]}>
                              <Ionicons name="calendar" size={16} color={accentColor} />
                            </View>
                            <Text style={[styles.calendarEventTag, { color: accentColor }]}>{event.tag}</Text>
                          </View>
                          <Text style={[styles.calendarEventTitle, { color: theme.colors.text }]} numberOfLines={2}>
                            {event.title}
                          </Text>
                          <View style={styles.calendarEventDateRow}>
                            <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                            <Text style={[styles.calendarEventDate, { color: theme.colors.textMuted }]}>
                              {event.date}
                            </Text>
                          </View>
                          {event.description && (
                            <Text style={[styles.calendarEventDescription, { color: theme.colors.textMuted }]} numberOfLines={2}>
                              {event.description}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </BlurView>
          </View>
        )}

        {/* Recent Updates Section - Fixed Header */}
        <View style={[styles.recentUpdatesSection, { borderColor: theme.colors.border, marginHorizontal: 0 }]} collapsable={false}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 20 : 15}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.updatesSectionBlur}
          >
            <View style={[styles.updatesSectionContent, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]} collapsable={false}>
              {/* Fixed Header Section */}
              <View style={styles.sectionHeaderEnhanced}>
                <View style={[styles.sectionIconWrapper, { backgroundColor: '#FF9500' + '15' }]}>
                  <Ionicons 
                    name={timeFilter === 'upcoming' ? 'time-outline' : timeFilter === 'recent' ? 'calendar-outline' : 'grid-outline'} 
                    size={20} 
                    color="#FF9500" 
                  />
                </View>
                <View style={styles.sectionTitleWrapper}>
                  <Text style={[styles.sectionTitleEnhanced, { color: theme.colors.text }]}>Updates</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
                    {!isLoadingDashboard && !dashboardError && displayedUpdates.length > 0 
                      ? timeFilter === 'upcoming' 
                        ? `Upcoming · ${displayedUpdates.length}`
                        : timeFilter === 'recent'
                        ? `Recent · ${displayedUpdates.length}`
                        : `All · ${displayedUpdates.length}`
                      : timeFilter === 'upcoming' ? 'Upcoming' : timeFilter === 'recent' ? 'Recent' : 'All'}
                  </Text>
                </View>
              </View>

              {/* Time Filter Pills - Fixed */}
              <View style={[styles.filtersContainer, { flexShrink: 0 }]} collapsable={false}>
                <Pressable
                  style={[styles.filterPill, { borderColor: theme.colors.border }, timeFilter === 'all' && styles.filterPillActive]}
                  onPress={() => setTimeFilter('all')}
                >
                  <Text style={[styles.filterPillText, { color: theme.colors.textMuted }, timeFilter === 'all' && styles.filterPillTextActive]}>All</Text>
                </Pressable>
                <Pressable
                  style={[styles.filterPill, { borderColor: theme.colors.border }, timeFilter === 'upcoming' && styles.filterPillActive]}
                  onPress={() => setTimeFilter('upcoming')}
                >
                  <Text style={[styles.filterPillText, { color: theme.colors.textMuted }, timeFilter === 'upcoming' && styles.filterPillTextActive]}>Upcoming</Text>
                </Pressable>
                <Pressable
                  style={[styles.filterPill, { borderColor: theme.colors.border }, timeFilter === 'recent' && styles.filterPillActive]}
                  onPress={() => setTimeFilter('recent')}
                >
                  <Text style={[styles.filterPillText, { color: theme.colors.textMuted }, timeFilter === 'recent' && styles.filterPillTextActive]}>Recent</Text>
                </Pressable>
              </View>
              
              {/* Updates Cards Section - No nested scroll, part of main scroll */}
              <View style={styles.updatesCardsContainer}>
                {dashboardError && (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
                    <Text style={{ marginTop: 6, fontSize: 12, color: '#DC2626', fontWeight: '600' }}>{dashboardError}</Text>
                  </View>
                )}

                {isLoadingDashboard && (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <Ionicons name="hourglass-outline" size={40} color={theme.colors.textMuted} />
                    <Text style={{ marginTop: 6, fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' }}>Loading dashboard...</Text>
                  </View>
                )}

                {!isLoadingDashboard && !dashboardError && displayedUpdates.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <Ionicons name="document-text-outline" size={40} color={theme.colors.textMuted} />
                    <Text style={{ marginTop: 6, fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' }}>
                      {timeFilter === 'upcoming' ? 'No upcoming updates' : timeFilter === 'recent' ? 'No recent updates found' : 'No updates found'}
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
                        // Convert DashboardUpdate to Post format
                        const post: any = {
                          id: update.id,
                          title: update.title,
                          description: update.description,
                          category: update.tag,
                          date: update.isoDate || update.date,
                          isoDate: update.isoDate || update.date,
                          image: update.image,
                          images: update.images,
                        };
                        setSelectedPost(post);
                        setIsPostModalOpen(true);
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
                          <Text style={[styles.updateTitle, { color: theme.colors.text }]} numberOfLines={2}>{update.title}</Text>
                          <View style={styles.updateDateRow}>
                            <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                            <Text style={[styles.updateDate, { color: theme.colors.textMuted }]}>{update.date}</Text>
                          </View>
                          {update.description && (
                            <Text style={[styles.updateDescription, { color: theme.colors.textMuted }]} numberOfLines={2}>
                              {update.description}
                            </Text>
                          )}
                          <View style={styles.updateTagRow}>
                            <View style={styles.statusItem}>
                              <Ionicons name="pricetag-outline" size={12} color={accentColor} />
                              <Text style={[styles.updateTagText, { color: accentColor }]}>{update.tag}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </BlurView>
        </View>
      </ScrollView>

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
        <View style={[styles.floatingAddButtonIcon, { backgroundColor: '#FF9500' }]}>
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

      {/* Post Preview Edit Delete Modal */}
      <PreviewEditDeleteModal
        visible={isPostModalOpen}
        update={selectedPost ? {
          id: selectedPost.id,
          title: selectedPost.title,
          date: selectedPost.isoDate || selectedPost.date,
          tag: selectedPost.category,
          time: selectedPost.time,
          image: selectedPost.image,
          images: selectedPost.images,
          description: selectedPost.description,
          source: selectedPost.source,
          pinned: selectedPost.isPinned,
          isoDate: selectedPost.isoDate || selectedPost.date,
        } : null}
        onClose={() => {
          setIsPostModalOpen(false);
          setSelectedPost(null);
        }}
        onEdit={() => {
          // Navigate to PostUpdate screen for editing
          setIsPostModalOpen(false);
          navigation.navigate('PostUpdate', { postId: selectedPost?.id });
        }}
        onPostUpdated={(updatedPost) => {
          // Update selectedPost with the updated data immediately
          console.log('🔄 Updating selectedPost in AdminDashboard', { updatedPost });
          setSelectedPost(updatedPost);
        }}
        onRefresh={async () => {
          // Refresh dashboard data (force refresh on pull-to-refresh)
          await fetchDashboardData(true);
        }}
      />

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
        slideAnim={eventDrawerSlideAnim}
        backdropOpacity={eventDrawerBackdropOpacity}
        monthPickerScaleAnim={eventDrawerMonthPickerScaleAnim}
        monthPickerOpacityAnim={eventDrawerMonthPickerOpacityAnim}
        onSelectEvent={(event) => {
          if (!event) {
            setSelectedEvent(null);
            return;
          }
          setSelectedEvent(event);
          // Update edit fields when event changes
          setEditTitle(event.title || '');
          setEditDescription(event.description || '');
          setEditTime(event.time || 'All Day');
          if (event.isoDate || event.date) {
            const eventDate = new Date(event.isoDate || event.date);
            setSelectedDateObj(eventDate);
            setEditDate(formatDate(eventDate));
          } else {
            setSelectedDateObj(null);
            setEditDate('');
          }
        }}
        readOnly={false}
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
  cloudWrapper: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  lightSpot1: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  lightSpot2: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  lightSpot3: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  cloudPatch1: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  cloudPatch2: {
    width: 130,
    height: 130,
    borderRadius: 65,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
  },
  profileInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    zIndex: 1,
    width: '100%',
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
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexShrink: 0,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  welcomeSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
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
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    flex: 1,
  },
  updatesSectionBlur: {
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
  },
  updatesSectionContent: {
    padding: 12,
    borderRadius: 12,
    flex: 1,
  },
  sectionHeaderEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    flexShrink: 0,
  },
  sectionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleWrapper: {
    flex: 1,
  },
  sectionTitleEnhanced: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  updateCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  updateAccent: {
    width: 3,
    borderRadius: 0,
  },
  updateContent: {
    flex: 1,
    flexDirection: 'column',
    padding: 0,
  },
  updateImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  updateTextContent: {
    flex: 1,
    padding: 10,
  },
  updateTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 20,
  },
  updateDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  updateDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  updateDescription: {
    fontSize: 12,
    marginBottom: 6,
    lineHeight: 16,
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
    fontSize: 12,
    fontWeight: '700',
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: '#FF9500',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFF',
  },
  calendarEventsSection: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  calendarEventsBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  calendarEventsContent: {
    padding: 12,
    borderRadius: 12,
  },
  calendarEventCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  calendarEventAccent: {
    width: 3,
    borderRadius: 0,
  },
  calendarEventContent: {
    flex: 1,
    padding: 12,
  },
  calendarEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  calendarEventIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarEventTag: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarEventTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 20,
  },
  calendarEventDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  calendarEventDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarEventDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});

export default AdminDashboard;