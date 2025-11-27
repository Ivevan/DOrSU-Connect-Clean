import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, Image, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import UserSidebar from '../../components/navigation/UserSidebar';
import { useThemeValues } from '../../contexts/ThemeContext';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import NotificationService from '../../services/NotificationService';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import { categoryToColors } from '../../utils/calendarUtils';
import NotificationModal from '../../modals/NotificationModal';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
};

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

// Loading Skeleton Component for Calendar Events
const CalendarEventSkeleton = memo(({ theme }: { theme: any }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <View style={[styles.calendarEventCard, { 
      backgroundColor: theme.colors.surface, 
      borderColor: theme.colors.border,
      width: 280,
    }]}>
      <View style={[styles.calendarEventAccent, { backgroundColor: theme.colors.border }]} />
      <View style={styles.calendarEventContent}>
        <View style={styles.calendarEventHeader}>
          <Animated.View style={[
            styles.calendarEventIconWrapper, 
            { backgroundColor: theme.colors.border, opacity }
          ]} />
          <Animated.View style={[
            { width: 80, height: 12, borderRadius: 6, backgroundColor: theme.colors.border, opacity }
          ]} />
        </View>
        <Animated.View style={[
          { width: '100%', height: 16, borderRadius: 4, backgroundColor: theme.colors.border, marginBottom: 8, opacity }
        ]} />
        <Animated.View style={[
          { width: '70%', height: 12, borderRadius: 4, backgroundColor: theme.colors.border, marginBottom: 6, opacity }
        ]} />
        <Animated.View style={[
          { width: '100%', height: 12, borderRadius: 4, backgroundColor: theme.colors.border, marginBottom: 4, opacity }
        ]} />
        <Animated.View style={[
          { width: '85%', height: 12, borderRadius: 4, backgroundColor: theme.colors.border, opacity }
        ]} />
      </View>
    </View>
  );
});

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
CalendarEventSkeleton.displayName = 'CalendarEventSkeleton';

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

type LegendItem = {
  type: string;
  key: string;
  color: string;
};

const legendItemsData: LegendItem[] = [
  { type: 'Academic', key: 'academic', color: '#10B981' },
  { type: 'Institutional', key: 'institutional', color: '#2563EB' },
  { type: 'News', key: 'news', color: '#8B5CF6' },
  { type: 'Event', key: 'event', color: '#F59E0B' },
  { type: 'Announcement', key: 'announcement', color: '#3B82F6' },
];

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
            <Text style={[styles.eventTagText, { color: getTagTextColor(update.tag), fontSize: theme.fontSize.scaleSize(11) }]}>{update.tag}</Text>
          </View>
          <Text style={[styles.eventTitleOverlay, { fontSize: theme.fontSize.scaleSize(20) }]} numberOfLines={2}>{update.title}</Text>
          <View style={styles.eventDateTimeRow}>
            <Ionicons name="calendar-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={[styles.eventDateOverlay, { fontSize: theme.fontSize.scaleSize(14) }]}>{update.date}</Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
});

const SchoolUpdates = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  const resolvedLegendItems = useMemo<LegendItem[]>(() => (
    legendItemsData.map(item => {
      if (item.key === 'institutional') {
        return { ...item, color: theme.colors.accent };
      }
      return item;
    })
  ), [theme.colors.accent]);
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
  const [updates, setUpdates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'recent' | 'thismonth'>('all');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendarEvents, setIsLoadingCalendarEvents] = useState(false);
  const [calendarEventsError, setCalendarEventsError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const calendarEventsScrollRef = useRef<ScrollView>(null);
  
  // Content type filter - multiple selection: 'academic', 'institutional', 'event', 'announcement', 'news'
  const [selectedLegendType, setSelectedLegendType] = useState<string | null>(null);
  const selectedContentTypes = useMemo(() => (
    selectedLegendType ? [selectedLegendType] : ['academic', 'institutional', 'event', 'announcement', 'news']
  ), [selectedLegendType]);
  
  // Event Modal state (view-only) - used for both calendar events and updates
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<Date | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([]);
  
  // Notification modal state
  const [showNotificationModal, setShowNotificationModal] = useState(false);


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
  const userName = useMemo(
    () => backendUserName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User',
    [backendUserName, currentUser]
  );

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

  // Load backend user photo on screen focus
  useFocusEffect(
    useCallback(() => {
      const loadBackendUserData = async () => {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const userPhoto = await AsyncStorage.getItem('userPhoto');
          const storedUserName = await AsyncStorage.getItem('userName');
          setBackendUserPhoto(userPhoto);
          if (storedUserName) {
            setBackendUserName(storedUserName);
          }
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
      setIsLoading(true);
      setError(null);
      
      // Fetch recent updates (posts/announcements) - use cache if available
      const posts = await AdminDataService.getPosts();
      
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
      
      setUpdates(uniqueUpdates);
    } catch (err: any) {
      setError(err?.message || 'Failed to load updates');
      if (__DEV__) console.error('Error fetching updates:', err);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, []);

  // Fetch updates on mount
  useEffect(() => {
    fetchUpdates(true);
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

  // Refresh updates when screen comes into focus (always refresh to show new posts)
  useFocusEffect(
    useCallback(() => {
      // Always refresh when screen comes into focus to ensure new posts appear immediately
      // Force refresh (bypass cache) to get the latest data including newly created posts
      // The fetchUpdates function has its own cooldown to prevent too many requests
      fetchUpdates(true); // Force refresh to bypass cache and get latest posts
    }, [fetchUpdates])
  );

  const filtered = useMemo(() => {
    const result = updates.filter(u => {
      const q = searchQuery.trim().toLowerCase();
      const byQuery = q.length === 0 || u.title.toLowerCase().includes(q) || (u.body && u.body.toLowerCase().includes(q));
      return byQuery;
    });
    if (__DEV__) {
      console.log('🔍 Filtered updates:', { 
        total: updates.length, 
        query: searchQuery.trim(), 
        filtered: result.length 
      });
    }
    return result;
  }, [updates, searchQuery]);

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

  // Filtered by time (all, upcoming, or recent) and content type
  // Includes both posts and calendar events
  // Only show Event, Announcement, and News entries that are in the current month or next month
  const displayedUpdates = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayKey = getPHDateKey(now);
    
    // Calculate next month and year (handle year rollover)
    const nextMonth = currentMonth + 1;
    const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
    const normalizedNextMonth = nextMonth > 11 ? 0 : nextMonth;
    
    // Categories that should be filtered by current month and next month
    const monthFilteredCategories = new Set(['event', 'announcement', 'news']);
    
    console.log('🔍 Computing displayedUpdates:', {
      timeFilter,
      selectedContentTypes,
      updatesCount: updates.length,
      filteredCount: filtered.length,
      upcomingCount: upcomingUpdates.length,
      recentCount: recentUpdates.length,
    });
    
    // Start with posts based on time filter
    let result;
    if (timeFilter === 'upcoming') {
      result = [...upcomingUpdates];
    } else if (timeFilter === 'recent') {
      result = [...recentUpdates];
    } else if (timeFilter === 'thismonth') {
      // Filter by current month only
      result = filtered.filter(u => {
        if (!u.isoDate) return false;
        try {
          const updateDate = new Date(u.isoDate);
          const updateYear = updateDate.getFullYear();
          const updateMonth = updateDate.getMonth();
          return updateYear === currentYear && updateMonth === currentMonth;
        } catch {
          return false;
        }
      });
    } else {
      // 'all' - show all posts, including those without dates
      result = [...filtered];
    }
    
    // Add calendar events based on time filter
    const calendarEventsForUpdates = calendarEvents
      .filter(event => {
        const eventDate = event.isoDate || event.date;
        if (!eventDate) return false;
        
        const eventDateObj = new Date(eventDate);
        const eventKey = getPHDateKey(eventDate);
        const eventYear = eventDateObj.getFullYear();
        const eventMonth = eventDateObj.getMonth();
        
        // Apply time filter
        if (timeFilter === 'upcoming') {
          return eventKey > todayKey;
        } else if (timeFilter === 'recent') {
          return eventKey <= todayKey;
        } else if (timeFilter === 'thismonth') {
          return eventYear === currentYear && eventMonth === currentMonth;
        } else {
          // 'all' - include all calendar events
          return true;
        }
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
      return selectedContentTypes.includes(updateType);
    });
    
    // Filter by current month or next month for Event, Announcement, and News categories
    result = result.filter(update => {
      const updateType = String(update.tag || 'Announcement').toLowerCase();
      
      // Only apply month filter to Event, Announcement, and News
      if (monthFilteredCategories.has(updateType)) {
        if (!update.isoDate) return false; // Exclude entries without dates
        try {
          const updateDate = new Date(update.isoDate);
          const updateYear = updateDate.getFullYear();
          const updateMonth = updateDate.getMonth();
          
          // Check if date is in current month or next month
          const isCurrentMonth = updateYear === currentYear && updateMonth === currentMonth;
          const isNextMonth = updateYear === nextYear && updateMonth === normalizedNextMonth;
          
          return isCurrentMonth || isNextMonth;
        } catch {
          return false; // Exclude entries with invalid dates
        }
      }
      
      // For other categories (Academic, Institutional), show all (no month filter)
      return true;
    });
    
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
  }, [timeFilter, selectedContentTypes, upcomingUpdates, recentUpdates, filtered, updates.length, calendarEvents]);

  // Current month events - combines calendar events and posts/updates
  // Filtered by selectedContentTypes and search query
  const currentMonthEvents = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const events: any[] = [];
    
    // Add calendar events for current month
    calendarEvents
      .filter(event => {
        const eventDate = event.isoDate || event.date;
        if (!eventDate) return false;
        const eventDateObj = new Date(eventDate);
        const isCurrentMonth = eventDateObj.getFullYear() === currentYear &&
                               eventDateObj.getMonth() === currentMonth;
        
        if (!isCurrentMonth) return false;
        
        // Apply content type filter
        const eventType = String(event.category || 'Event').toLowerCase();
        return selectedContentTypes.includes(eventType);
      })
      .forEach(event => {
        events.push({
          id: event._id || `calendar-${event.isoDate}-${event.title}`,
          title: event.title,
          date: new Date(event.isoDate || event.date).toLocaleDateString(),
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
    
    // Add posts/updates for current month (events, announcements, news)
    updates
      .filter(update => {
        if (!update.isoDate) return false;
        const updateDate = new Date(update.isoDate);
        const isCurrentMonth = updateDate.getFullYear() === currentYear &&
                              updateDate.getMonth() === currentMonth;
        
        if (!isCurrentMonth) return false;
        
        // Apply content type filter
        const updateType = String(update.tag || 'Announcement').toLowerCase();
        return selectedContentTypes.includes(updateType);
      })
      .forEach(update => {
        events.push({
          id: update.id,
          title: update.title,
          date: new Date(update.isoDate || update.date).toLocaleDateString(),
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
  }, [calendarEvents, updates, selectedContentTypes, searchQuery]);

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

  // Refresh calendar events function with error handling and retry
  const refreshCalendarEvents = useCallback(async (isRetry: boolean = false) => {
    try {
      setIsLoadingCalendarEvents(true);
      setCalendarEventsError(null);
      
      // Fetch from API
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

  // Fetch calendar events for current month
  useEffect(() => {
    refreshCalendarEvents();
  }, [refreshCalendarEvents]);

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
        
        // Debug: Log all events and their dates
        if (__DEV__) {
          console.log('📅 Calendar Events Debug:', {
            totalEvents: currentMonthEvents.length,
            todayKey,
            currentDate: now.toISOString(),
            events: currentMonthEvents.map((e, idx) => ({
              index: idx,
              title: e.title,
              isoDate: e.isoDate,
              eventKey: e.isoDate ? getPHDateKey(e.isoDate) : null,
              isToday: e.isoDate ? getPHDateKey(e.isoDate) === todayKey : false
            }))
          });
        }
        
        // Find the index of the first today's event
        const todayEventIndex = currentMonthEvents.findIndex(event => {
          if (!event.isoDate) return false;
          try {
            const eventKey = getPHDateKey(event.isoDate);
            const isToday = eventKey === todayKey;
            if (__DEV__ && isToday) {
              console.log('✅ Found today\'s event:', {
                title: event.title,
                isoDate: event.isoDate,
                eventKey,
                todayKey,
                match: isToday
              });
            }
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
          
          if (__DEV__) {
            console.log('📅 Auto-scrolling to today\'s event:', {
              todayEventIndex,
              firstTodayEventPosition,
              screenWidth,
              centerPosition,
              scrollPosition,
              eventTitle: currentMonthEvents[todayEventIndex]?.title
            });
          }
          
          // Scroll with animation
          calendarEventsScrollRef.current.scrollTo({ x: scrollPosition, animated: true });
          
          // Also try a second scroll after a short delay to ensure it locks
          setTimeout(() => {
            if (calendarEventsScrollRef.current) {
              calendarEventsScrollRef.current.scrollTo({ x: scrollPosition, animated: false });
            }
          }, 600);
        } else {
          if (__DEV__) {
            console.log('⚠️ No today\'s events found. Total events:', currentMonthEvents.length);
            console.log('📅 Today key:', todayKey, 'Current date:', now.toISOString());
          }
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

        {/* Events This Month Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionDivider}>
            <Text style={[styles.sectionDividerLabel, { fontSize: theme.fontSize.scaleSize(11) }]}>EVENTS THIS MONTH</Text>
          </View>

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
                {currentMonthEvents.length} {currentMonthEvents.length === 1 ? 'event' : 'events'} this month
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
                          {item.type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </BlurView>

          {isLoadingCalendarEvents ? (
            <View style={[styles.eventsLoadingContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={[styles.eventsLoadingText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }]}>
                Loading events...
              </Text>
            </View>
          ) : calendarEventsError ? (
            <View style={[styles.eventsErrorContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.eventsErrorText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(12) }]}>
                  {calendarEventsError}
                </Text>
                <TouchableOpacity
                  onPress={() => refreshCalendarEvents()}
                  style={[styles.eventsRetryButton, { backgroundColor: theme.colors.accent }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.eventsRetryText, { fontSize: theme.fontSize.scaleSize(11) }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : currentMonthEvents.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 20, gap: 12, paddingLeft: 0 }}
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
                
                // Find the full event object (calendar event or post)
                let fullEvent: any = null;
                if (event.source === 'calendar') {
                  // Calendar event
                  fullEvent = calendarEvents.find(e => 
                    e._id === event.id || 
                    `calendar-${e.isoDate}-${e.title}` === event.id
                  ) || null;
                } else if (event.source === 'post') {
                  // Post/Update - create event data format
                  fullEvent = {
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    category: event.tag,
                    type: event.tag,
                    date: event.isoDate || event.date,
                    isoDate: event.isoDate || event.date,
                    image: event.image,
                    images: event.images,
                  };
                }
                
                // Create a subtle background color based on accent color
                const cardBackgroundColor = isDarkMode 
                  ? accentColor + '08' // Very subtle in dark mode
                  : accentColor + '12'; // Slightly more visible in light mode
                
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.calendarEventCard, { 
                      backgroundColor: cardBackgroundColor, 
                      borderColor: accentColor + '30',
                      minWidth: 260,
                    }]}
                    activeOpacity={0.7}
                    delayPressIn={0}
                    onPress={() => {
                      if (fullEvent) {
                        if (event.source === 'calendar') {
                          // Calendar event
                          const eventDate = fullEvent.isoDate || fullEvent.date 
                            ? new Date(fullEvent.isoDate || fullEvent.date)
                            : new Date();
                          openEventDrawer(fullEvent, eventDate);
                        } else if (event.source === 'post') {
                          // Post/Update - use ViewEventModal format
                          const eventDate = fullEvent.isoDate || fullEvent.date 
                            ? new Date(fullEvent.isoDate || fullEvent.date)
                            : new Date();
                          setSelectedEvent(fullEvent);
                          setSelectedDateForDrawer(eventDate);
                          setSelectedDateEvents([{
                            id: fullEvent.id,
                            title: fullEvent.title,
                            color: accentColor,
                            type: fullEvent.category,
                            category: fullEvent.category,
                            description: fullEvent.description,
                            isoDate: fullEvent.isoDate || fullEvent.date,
                            date: fullEvent.isoDate || fullEvent.date,
                            image: fullEvent.image,
                            images: fullEvent.images,
                          }]);
                          setShowEventDrawer(true);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }
                    }}
                  >
                    <View style={[styles.calendarEventAccent, { backgroundColor: accentColor }]} collapsable={false} />
                    <View style={styles.calendarEventContent} collapsable={false}>
                      <View style={styles.calendarEventHeader}>
                        <View style={[styles.calendarEventIconWrapper, { backgroundColor: accentColor + '20' }]}>
                          <Ionicons 
                            name={event.source === 'post' ? 'document-text' : 'calendar'} 
                            size={16} 
                            color={accentColor} 
                          />
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
                );
              })}
            </ScrollView>
          ) : (
            <View style={[styles.emptyEventsContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="calendar-outline" size={24} color={theme.colors.textMuted} />
              <Text style={[styles.emptyEventsText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }]}>
                No events match your filters this month
              </Text>
            </View>
          )}
        </View>

        {/* Updates Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionDivider}>
              <Text style={[styles.sectionDividerLabel, { fontSize: theme.fontSize.scaleSize(11) }]}>UPDATES</Text>
          </View>
          
          {/* Time Filter Pills */}
          <View style={[styles.filtersContainer, { flexShrink: 0, marginBottom: 12 }]} collapsable={false}>
            <Pressable
              style={[
                styles.filterPill, 
                { borderColor: theme.colors.border }, 
                timeFilter === 'all' && {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.accent,
                  shadowColor: theme.colors.accent,
                }
              ]}
              onPress={() => setTimeFilter('all')}
            >
              <Text style={[styles.filterPillText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }, timeFilter === 'all' && { color: '#FFF' }]}>All</Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterPill, 
                { borderColor: theme.colors.border }, 
                timeFilter === 'thismonth' && {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.accent,
                  shadowColor: theme.colors.accent,
                }
              ]}
              onPress={() => setTimeFilter('thismonth')}
            >
              <Text style={[styles.filterPillText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }, timeFilter === 'thismonth' && { color: '#FFF' }]}>This month</Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterPill, 
                { borderColor: theme.colors.border }, 
                timeFilter === 'recent' && {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.accent,
                  shadowColor: theme.colors.accent,
                }
              ]}
              onPress={() => setTimeFilter('recent')}
            >
              <Text style={[styles.filterPillText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }, timeFilter === 'recent' && { color: '#FFF' }]}>Recent</Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterPill, 
                { borderColor: theme.colors.border }, 
                timeFilter === 'upcoming' && {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.accent,
                  shadowColor: theme.colors.accent,
                }
              ]}
              onPress={() => setTimeFilter('upcoming')}
            >
              <Text style={[styles.filterPillText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }, timeFilter === 'upcoming' && { color: '#FFF' }]}>Upcoming</Text>
            </Pressable>
          </View>
          
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
                  {timeFilter === 'upcoming' ? 'No upcoming updates' : timeFilter === 'recent' ? 'No recent updates found' : timeFilter === 'thismonth' ? 'No updates this month' : 'No updates found'}
                </Text>
              </View>
            )}

            {!isLoading && !error && displayedUpdates.map((update) => {
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
                        <View style={[styles.updateCategoryBadge, { backgroundColor: accentColor + '20' }]}>
                          <Text style={[styles.updateCategoryText, { color: accentColor, fontSize: theme.fontSize.scaleSize(10) }]}>{update.tag}</Text>
                        </View>
                      </View>
                      <Text style={[styles.updateSubtitle, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>
                        {update.date}
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
    marginBottom: 12,
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
  },
  updateTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: -0.2,
    flex: 1,
  },
  updateCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    flexShrink: 0,
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