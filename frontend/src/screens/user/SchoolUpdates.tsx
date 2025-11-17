import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Easing, Image, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EventDetailsDrawer from '../../components/calendar/EventDetailsDrawer';
import PreviewModal from '../../modals/PreviewModal';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import UserSidebar from '../../components/navigation/UserSidebar';
import { theme as themeStyle } from '../../config/theme';
import { useThemeValues } from '../../contexts/ThemeContext';
import AdminDataService, { Post } from '../../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import { categoryToColors } from '../../utils/calendarUtils';
import { formatDate } from '../../utils/dateUtils';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
};

type UpdateCategory = 'Announcement' | 'Event' | 'Academic';

// Animated No Events Component
const NoEventsAnimation = memo(({ theme }: { theme: any }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -6,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.08,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [floatAnim, scaleAnim]);

  return (
    <Animated.View 
      style={{
        transform: [
          { translateY: floatAnim },
          { scale: scaleAnim }
        ],
      }}
    >
      <Ionicons name="calendar-clear-outline" size={100} color={theme.colors.textMuted} style={{ opacity: 0.4 }} />
    </Animated.View>
  );
});

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

// Helper functions for tag colors
const getTagColor = (tag: string) => {
  switch (tag.toLowerCase()) {
    case 'announcement':
      return '#E8F0FF';
    case 'academic':
      return '#F0F9FF';
    case 'event':
      return '#FEF3C7';
    case 'service':
      return '#ECFDF5';
    case 'infrastructure':
      return '#FEF2F2';
    default:
      return '#E8F0FF';
  }
};

const getTagTextColor = (tag: string) => {
  switch (tag.toLowerCase()) {
    case 'announcement':
      return '#1A3E7A';
    case 'academic':
      return '#0369A1';
    case 'event':
      return '#D97706';
    case 'service':
      return '#059669';
    case 'infrastructure':
      return '#DC2626';
    default:
      return '#1A3E7A';
  }
};

// Note: UpdateCard component is no longer used - cards are rendered inline to match AdminDashboard design

// Event Card with Image Preview (Horizontal Scrollable)
const EventCard = memo(({ update, onPress, theme }: { update: any; onPress: () => void; theme: any }) => {
  const imageUrl = update.images?.[0] || update.image;
  
  return (
    <Pressable style={[styles.eventCardHorizontal, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={onPress}>
      {imageUrl ? (
        <Image 
          source={{ uri: imageUrl }} 
          style={styles.eventImageHorizontal}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.eventImagePlaceholder, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="calendar-outline" size={40} color={theme.colors.textMuted} />
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.eventGradient}
      >
        <View style={styles.eventOverlayContent}>
          <View style={[styles.eventTagOverlay, { backgroundColor: getTagColor(update.tag) }]}>
            <Text style={[styles.eventTagText, { color: getTagTextColor(update.tag) }]}>{update.tag}</Text>
          </View>
          <Text style={styles.eventTitleOverlay} numberOfLines={2}>{update.title}</Text>
          <View style={styles.eventDateTimeRow}>
            <Ionicons name="calendar-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.eventDateOverlay}>{update.date}</Text>
            {update.time && (
              <>
                <Text style={styles.eventTimeSeparator}>•</Text>
                <Ionicons name="time-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.eventDateOverlay}>{update.time}</Text>
              </>
            )}
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
});

const SchoolUpdates = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'recent'>('all');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendarEvents, setIsLoadingCalendarEvents] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const searchRef = useRef<TextInput>(null);
  
  // Event Details Drawer state (view-only)
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<Date | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const drawerSlideAnim = useRef(new Animated.Value(0)).current;
  const drawerBackdropOpacity = useRef(new Animated.Value(0)).current;
  const monthPickerScaleAnim = useRef(new Animated.Value(0)).current;
  const monthPickerOpacityAnim = useRef(new Animated.Value(0)).current;

  // Post Preview Modal state (view-only)
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<any | null>(null);

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
  const userName = useMemo(() => currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User', [currentUser]);

  // Animated floating background orbs (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim2 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;

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

  const handleSearchPress = useCallback(() => {
    setIsSearchVisible(prev => {
      if (prev) {
        setQuery(''); // Clear search when closing
      }
      return !prev;
    });
  }, []);

  const handleNotificationsPress = useCallback(() => {
    Alert.alert('Notifications', 'Notifications feature coming soon.');
  }, []);

  const handleUpdatePress = useCallback((update: { id?: string; title: string; date: string; tag: string; time?: string; image?: string; images?: string[]; description?: string; source?: string; pinned?: boolean; isoDate?: string; category?: string }) => {
    // Set update and open PreviewModal
    setSelectedUpdate(update);
    setShowPostModal(true);
  }, []);

  // Fetch data from AdminDataService
  const fetchUpdates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const posts = await AdminDataService.getPosts();
      
      console.log('📥 Fetched posts from AdminDataService:', posts.length);
      
      // Map AdminDataService posts to our component format (matching AdminDashboard pattern)
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
          body: post.description,
          date: formatDate(post.isoDate || post.date),
          time: post.time,
          isoDate: post.isoDate || post.date, // Store isoDate for accurate date comparison
          category: post.category as UpdateCategory,
          tag: post.category,
          description: post.description,
          source: post.source,
          image: post.image,
          images: images,
        };
      });
      
      // Remove duplicates (matching AdminDashboard pattern)
      const uniqueUpdates = postsData.filter((update, index, self) =>
        index === self.findIndex(u => u.id === update.id)
      );
      
      // Sort by date (newest first) - matching AdminDashboard pattern
      uniqueUpdates.sort((a, b) => {
        const dateA = new Date(a.isoDate || a.date).getTime();
        const dateB = new Date(b.isoDate || b.date).getTime();
        return dateB - dateA; // Newest first
      });
      
      console.log('✅ Mapped updates:', uniqueUpdates.length, '(removed', posts.length - uniqueUpdates.length, 'duplicates)');
      if (uniqueUpdates.length > 0) {
        console.log('📝 Sample update:', { 
          id: uniqueUpdates[0].id, 
          title: uniqueUpdates[0].title, 
          isoDate: uniqueUpdates[0].isoDate,
          tag: uniqueUpdates[0].tag 
        });
      }
      setUpdates(uniqueUpdates);
      console.log('✅ State updated with', uniqueUpdates.length, 'updates');
    } catch (err: any) {
      console.error('❌ Error fetching updates:', err);
      setError(err?.message || 'Failed to load updates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch updates on mount
  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  // Refresh updates when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUpdates();
    }, [fetchUpdates])
  );

  const filtered = useMemo(() => {
    const result = updates.filter(u => {
      const q = query.trim().toLowerCase();
      const byQuery = q.length === 0 || u.title.toLowerCase().includes(q) || (u.body && u.body.toLowerCase().includes(q));
      return byQuery;
    });
    console.log('🔍 Filtered updates:', { 
      total: updates.length, 
      query: query.trim(), 
      filtered: result.length 
    });
    return result;
  }, [updates, query]);

  // Today's events (category Event occurring today) - using timezone-aware comparison
  const todaysEvents = useMemo(() => {
    const todayKey = getPHDateKey(new Date());
    return updates.filter(u => {
      if (u.category !== 'Event') return false;
      if (!u.isoDate) return false;
      const eventKey = getPHDateKey(u.isoDate);
      return eventKey === todayKey;
    });
  }, [updates]);

  // Upcoming updates (future dates)
  const upcomingUpdates = useMemo(() => {
    const todayKey = getPHDateKey(new Date());
    return filtered.filter(u => {
      if (!u.isoDate) return false;
      const eventKey = getPHDateKey(u.isoDate);
      return eventKey > todayKey;
    });
  }, [filtered]);

  // Recent updates (today and past dates)
  const recentUpdates = useMemo(() => {
    const todayKey = getPHDateKey(new Date());
    return filtered.filter(u => {
      if (!u.isoDate) return false;
      const eventKey = getPHDateKey(u.isoDate);
      return eventKey <= todayKey;
    });
  }, [filtered]);

  // Filtered by time (all, upcoming, or recent)
  const displayedUpdates = useMemo(() => {
    console.log('🔍 Computing displayedUpdates:', {
      timeFilter,
      updatesCount: updates.length,
      filteredCount: filtered.length,
      upcomingCount: upcomingUpdates.length,
      recentCount: recentUpdates.length,
    });
    
    let result;
    if (timeFilter === 'upcoming') {
      result = [...upcomingUpdates];
    } else if (timeFilter === 'recent') {
      result = [...recentUpdates];
    } else {
      // 'all' - show all posts, including those without dates
      result = [...filtered];
    }
    
    console.log('📋 Result before sorting:', result.length, 'items');
    
    // Sort by date (newest first) - posts without dates go to the end
    result.sort((a, b) => {
      if (!a.isoDate && !b.isoDate) return 0;
      if (!a.isoDate) return 1; // Posts without dates go to end
      if (!b.isoDate) return -1; // Posts without dates go to end
      
      try {
        const dateA = new Date(a.isoDate).getTime();
        const dateB = new Date(b.isoDate).getTime();
        if (isNaN(dateA) || isNaN(dateB)) return 0;
        return dateB - dateA; // Newest first
      } catch {
        return 0;
      }
    });
    
    console.log(`📊 Displayed updates (${timeFilter}):`, result.length, 'out of', updates.length, 'total');
    if (result.length > 0) {
      console.log('📝 First update:', { id: result[0].id, title: result[0].title, isoDate: result[0].isoDate });
    }
    return result;
  }, [timeFilter, upcomingUpdates, recentUpdates, filtered, updates.length]);

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

  // Calculate available height for scrollable cards section (after currentMonthEvents is defined)
  const cardsScrollViewHeight = useMemo(() => {
    const headerHeight = safeInsets.top + 60; // Header height
    const welcomeSectionHeight = 60; // Welcome section approximate height
    const calendarSectionHeight = currentMonthEvents.length > 0 ? 200 : 0; // Calendar events section approximate height (if visible)
    const updatesHeaderHeight = 120; // Updates header + filters approximate height
    const bottomNavHeight = safeInsets.bottom + 80; // Bottom nav + safe area
    const calculatedHeight = screenHeight - headerHeight - welcomeSectionHeight - calendarSectionHeight - updatesHeaderHeight - bottomNavHeight - 50; // 50 for padding/margins
    const finalHeight = Math.max(calculatedHeight, 300); // Ensure minimum 300px height
    console.log('📏 ScrollView height calculation:', {
      screenHeight,
      calculatedHeight,
      finalHeight,
      calendarSectionHeight,
    });
    return finalHeight;
  }, [screenHeight, safeInsets.top, safeInsets.bottom, currentMonthEvents.length]);

  // Refresh calendar events function
  const refreshCalendarEvents = useCallback(async () => {
    try {
      setIsLoadingCalendarEvents(true);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // Get first and last day of current month
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      
      const events = await CalendarService.getEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 1000,
      });
      
      setCalendarEvents(Array.isArray(events) ? events : []);
    } catch (error) {
      console.error('Failed to load calendar events:', error);
      setCalendarEvents([]);
    } finally {
      setIsLoadingCalendarEvents(false);
    }
  }, []);

  // Fetch calendar events for current month
  useEffect(() => {
    refreshCalendarEvents();
  }, [refreshCalendarEvents]);

  // Open event drawer (view-only)
  const openEventDrawer = useCallback((event: CalendarEvent, date?: Date) => {
    setSelectedEvent(event);
    if (date) {
      setSelectedDateForDrawer(date);
      // Find all events on this date
      const eventsOnDate = calendarEvents.filter(e => {
        const eventDate = new Date(e.isoDate || e.date);
        return eventDate.toDateString() === date.toDateString();
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
    // Set edit fields for display (read-only)
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
  }, [calendarEvents, drawerSlideAnim, drawerBackdropOpacity]);
  
  // Close event drawer
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
      setSelectedEvent(null);
      setSelectedDateForDrawer(null);
      setSelectedDateEvents([]);
      setIsEditing(false);
    });
  }, [drawerSlideAnim, drawerBackdropOpacity]);

  // Close post modal
  const closePostModal = useCallback(() => {
    setShowPostModal(false);
    setSelectedUpdate(null);
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
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>School Updates</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={() => navigation.navigate('UserSettings')} 
            accessibilityLabel="User profile - Go to settings"
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
      
      {/* User Sidebar Component */}
      <UserSidebar
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
            <Text style={[styles.welcomeSubtitle, { color: theme.colors.textMuted }]}>Here are your latest campus updates</Text>
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
        <View style={[styles.recentUpdatesSection, { borderColor: theme.colors.border }]} collapsable={false}>
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
                    {!isLoading && !error && displayedUpdates.length > 0 
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
                {error && (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
                    <Text style={{ marginTop: 6, fontSize: 12, color: '#DC2626', fontWeight: '600' }}>{error}</Text>
                  </View>
                )}

                {isLoading && (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <Ionicons name="hourglass-outline" size={40} color={theme.colors.textMuted} />
                    <Text style={{ marginTop: 6, fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' }}>Loading updates...</Text>
                  </View>
                )}

                {(() => {
                  console.log('🎨 Render check:', {
                    isLoading,
                    error,
                    displayedUpdatesLength: displayedUpdates.length,
                    willShowEmpty: !isLoading && !error && displayedUpdates.length === 0,
                    willShowPosts: !isLoading && !error && displayedUpdates.length > 0,
                  });
                  return null;
                })()}

                {!isLoading && !error && displayedUpdates.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <Ionicons name="document-text-outline" size={40} color={theme.colors.textMuted} />
                    <Text style={{ marginTop: 6, fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' }}>
                      {timeFilter === 'upcoming' ? 'No upcoming updates' : timeFilter === 'recent' ? 'No recent updates found' : 'No updates found'}
                    </Text>
                  </View>
                )}

                {!isLoading && !error && displayedUpdates.length > 0 && displayedUpdates.map((update) => {
                  console.log('🎨 Rendering update:', update.id, update.title);
                  // Get color for category tag based on category
                  const tagLower = update.tag?.toLowerCase() || '';
                  let tagColor = '#E8F0FF'; // Default light blue
                  let tagTextColor = '#1A3E7A'; // Default dark blue
                  
                  if (tagLower === 'event') {
                    tagColor = '#FEF3C7'; // Yellow
                    tagTextColor = '#D97706';
                  } else if (tagLower === 'academic') {
                    tagColor = '#F0F9FF'; // Light blue
                    tagTextColor = '#0369A1';
                  } else if (tagLower === 'announcement') {
                    tagColor = '#E8F0FF'; // Light purple/blue
                    tagTextColor = '#1A3E7A';
                  } else {
                    // For other categories, use categoryToColors
                    const colors = categoryToColors(update.tag);
                    tagColor = colors.chipBg || '#E8F0FF';
                    tagTextColor = colors.chipText || '#1A3E7A';
                  }
                  
                  return (
                    <TouchableOpacity
                      key={update.id}
                      style={[styles.updateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                      activeOpacity={0.7}
                      delayPressIn={0}
                      onPress={() => handleUpdatePress(update)}
                    >
                      {(update.images?.[0] || update.image) ? (
                        <Image 
                          source={{ uri: update.images?.[0] || update.image || '' }} 
                          style={styles.updateImage}
                          resizeMode="cover"
                          onError={(error) => {
                            console.error('Image load error:', error.nativeEvent.error);
                            console.log('Failed image URL:', update.images?.[0] || update.image);
                          }}
                        />
                      ) : (
                        <View style={[styles.updateImagePlaceholder, { backgroundColor: theme.colors.surface }]}>
                          <Ionicons name="image-outline" size={24} color={theme.colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.updateCardContent}>
                        <View style={styles.updateCardHeader}>
                          <View style={styles.updateCardHeaderLeft}>
                            <Text style={[styles.updateTitle, { color: theme.colors.text }]} numberOfLines={2}>
                              {update.title}
                            </Text>
                            <View style={styles.updateDateRow}>
                              <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                              <Text style={[styles.updateDate, { color: theme.colors.textMuted }]}>
                                {update.date}
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.updateTagBadge, { backgroundColor: tagColor }]}>
                            <Text style={[styles.updateTagBadgeText, { color: tagTextColor }]}>
                              {update.tag}
                            </Text>
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
      
      {/* Post Preview Modal - View Only */}
      <PreviewModal
        visible={showPostModal}
        update={selectedUpdate ? {
          title: selectedUpdate.title,
          date: selectedUpdate.isoDate || selectedUpdate.date,
          tag: selectedUpdate.tag || selectedUpdate.category,
          time: selectedUpdate.time,
          image: selectedUpdate.image,
          images: selectedUpdate.images,
          description: selectedUpdate.description,
          source: selectedUpdate.source,
          pinned: selectedUpdate.pinned,
        } : null}
        onClose={closePostModal}
      />

      {/* Event Details Drawer - View Only */}
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
            setSelectedEvent(null);
            return;
          }
          setSelectedEvent(event);
        }}
        readOnly={true}
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
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexShrink: 0,
  },
  filterPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  filterPillActive: {
    backgroundColor: themeStyle.colors.accent,
    borderColor: 'transparent',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '700',
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
  recentUpdatesSection: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 0,
    overflow: 'hidden',
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
  updatesSectionBlur: {
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
  },
  updatesSectionContent: {
    padding: 12,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
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
    flexDirection: 'column',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  updateImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  updateImagePlaceholder: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  updateCardContent: {
    padding: 12,
  },
  updateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  updateCardHeaderLeft: {
    flex: 1,
    flexShrink: 1,
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
  },
  updateDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  updateTagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexShrink: 0,
  },
  updateTagBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  clearButton: {
    padding: 4,
  },
  todaysEventsSection: {
    marginBottom: 16,
  },
  eventCardContainer: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  eventCardBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  todaysEventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  todaysEventsTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  todaysEventsSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  noEventsContainer: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  noEventsBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  noEventsCard: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  noEventsText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  eventCardHorizontal: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0,
  },
  eventImageHorizontal: {
    width: '100%',
    height: '100%',
  },
  eventImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  eventOverlayContent: {
    gap: 4,
  },
  eventTagOverlay: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  eventTitleOverlay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  eventDateOverlay: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  eventDateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  eventTimeSeparator: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.7,
    marginHorizontal: 6,
  },
  eventTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  
});

export default SchoolUpdates; 