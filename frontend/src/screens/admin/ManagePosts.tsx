import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  InteractionManager,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useUpdates } from '../../contexts/UpdatesContext';
import ConfirmationModal from '../../modals/ConfirmationModal';
import OptionsModal from '../../modals/OptionsModal';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import { categoryToColors, formatDateKey, parseAnyDateToKey } from '../../utils/calendarUtils';
import { formatDate } from '../../utils/dateUtils';

type RootStackParamList = {
  AdminDashboard: undefined;
  PostUpdate: undefined;
  ManagePosts: undefined;
};

type ManagePostsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ManagePosts'>;

type Post = {
  id: string;
  title: string;
  category: string;
  date: string;
  description?: string;
  isPinned: boolean;
  isUrgent: boolean;
  status?: string;
  isApproved?: boolean;
  approvedAt?: string;
  approvedBy?: string | null;
  creatorRole?: 'admin' | 'moderator'; // Creator role for filtering
  source?: string; // Source field (Admin/Moderator)
  isoDate?: string; // ISO date for sorting
  _id?: string; // For calendar events
  image?: string;
  images?: string[];
};

type CombinedItem = Post & {
  isCalendarEvent?: boolean;
};

const ManagePosts: React.FC = () => {
  const navigation = useNavigation<ManagePostsNavigationProp>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const isMountedRef = useRef(true);
  const { isDarkMode, theme } = useThemeValues();
  const { isLoading: authLoading, userRole, isAdmin, refreshUser, isAuthenticated } = useAuth();
  const { calendarEvents, setCalendarEvents } = useUpdates();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const isPendingAuthorization = isAuthorized === null;
  
  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);
  
  // Lock header height to prevent layout shifts
  const headerHeightRef = useRef<number>(72);
  const [headerHeight, setHeaderHeight] = useState(72);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  
  // Creator role filter (only for admins)
  const [selectedCreatorRole, setSelectedCreatorRole] = useState<'all' | 'admin' | 'moderator'>('all');
  const [isCreatorRoleOpen, setIsCreatorRoleOpen] = useState(false);

  // Loading and refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Sorting state
  const [selectedSort, setSelectedSort] = useState('Newest');
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Track if filters are active
  const hasActiveFilters = searchQuery.trim() !== '' || selectedCategory !== 'All Categories' || selectedSort !== 'Newest' || (isAdmin && selectedCreatorRole !== 'all');

  // Category picker state
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  
  // Modal: More Options
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(false);
  const [activePostForOptions, setActivePostForOptions] = useState<Post | null>(null);
  // Action modals
  const [isPinConfirmOpen, setIsPinConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [actionPost, setActionPost] = useState<Post | null>(null);
  
  // Animation values for confirmation modals
  const pinSheetY = useRef(new Animated.Value(300)).current;
  const deleteSheetY = useRef(new Animated.Value(300)).current;
  
  // Animated floating background orb (Copilot-style)
  const bgFade1 = useRef(new Animated.Value(0)).current;
  
  // Inline, dependency-free date data
  // Category meta aligned with AdminDashboard legend
  const CATEGORY_OPTIONS = useMemo(() => ([
    { key: 'All Categories', icon: 'apps', color: '#6B7280', description: 'Show all categories' },
    { key: 'Academic', icon: 'school', color: '#2563EB', description: 'Classes, exams, academics' },
    { key: 'Institutional', icon: 'business', color: '#4B5563', description: 'Institutional / campus-wide' },
    { key: 'Announcement', icon: 'megaphone', color: '#EAB308', description: 'General updates and notices' },
    { key: 'Event', icon: 'calendar-outline', color: '#10B981', description: 'Schedules and activities' },
    { key: 'News', icon: 'newspaper-outline', color: '#EF4444', description: 'Campus news' },
  ]), []);

  // Sort options
  const SORT_OPTIONS = useMemo(() => ([
    { key: 'Newest', icon: 'arrow-down', color: '#1976D2', description: 'Most recent first' },
    { key: 'Oldest', icon: 'arrow-up', color: '#2E7D32', description: 'Oldest first' },
    { key: 'Title', icon: 'text', color: '#5E35B1', description: 'Alphabetical by title' },
    { key: 'Last Modified', icon: 'time', color: '#E65100', description: 'Recently updated first' },
  ]), []);

  const currentCategory = CATEGORY_OPTIONS.find(o => o.key === selectedCategory) || CATEGORY_OPTIONS[0];
  const currentSort = SORT_OPTIONS.find(o => o.key === selectedSort) || SORT_OPTIONS[0];

  // Posts data (to be filled from real API)
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  
  // Calendar events state
  const [isLoadingCalendarEvents, setIsLoadingCalendarEvents] = useState(false);
  
  // Event modal state
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | any>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([]);
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<Date | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track last fetch time
  const lastFetchTime = useRef<number>(0);
  const isFetching = useRef<boolean>(false);
  const FETCH_COOLDOWN = 1000; // 1 second cooldown
  
  // Calendar events fetch tracking
  const lastCalendarFetchTime = useRef<number>(0);
  const isFetchingCalendar = useRef<boolean>(false);
  const CALENDAR_FETCH_COOLDOWN = 2000; // 2 seconds cooldown for calendar events

  // Refresh user role on focus to ensure latest role is loaded
  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        refreshUser().catch(() => {
          // Silent fail - role will be checked in authorization useEffect
        });
      }
    }, [authLoading, refreshUser])
  );

  // Track mount state to prevent alerts during unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Authorization check (admins and moderators) via AuthContext
  useEffect(() => {
    if (authLoading) return;
    // Don't show alert if user is logging out (not authenticated), screen is not focused, or component is unmounting
    if (!isAuthenticated || !isFocused || !isMountedRef.current) {
      setIsAuthorized(false);
      return;
    }
    const hasAccess = isAdmin || userRole === 'moderator';
    if (!hasAccess) {
      setIsAuthorized(false);
      // Add a small delay and re-check before showing alert to prevent showing during logout
      const timeoutId = setTimeout(() => {
        // Triple-check we're still mounted, focused, and authenticated before showing alert
        if (isMountedRef.current && isFocused && isAuthenticated) {
          Alert.alert(
            'Access Denied',
            'You do not have permission to access this page. If you were recently assigned as a moderator, please log out and log back in.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    setIsAuthorized(true);
  }, [authLoading, isAdmin, userRole, navigation, isAuthenticated, isFocused]);

  // Fetch calendar events function - only current month
  const refreshCalendarEvents = useCallback(async (forceRefresh: boolean = false) => {
    if (isAuthorized !== true) return;
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
      
      // Fetch from API - Load current month only
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59); // Last day of current month
      
      if (__DEV__) {
        console.log(`📅 Loading calendar events (current month only): ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
      }
      
      const events = await CalendarService.getEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 1000,
      });
      
      if (__DEV__) {
        console.log(`✅ Loaded ${events.length} calendar events for current month`);
      }
      
      setCalendarEvents(Array.isArray(events) ? events : []);
    } catch (error) {
      if (__DEV__) console.error('Failed to load calendar events:', error);
      setCalendarEvents([]);
    } finally {
      setIsLoadingCalendarEvents(false);
      isFetchingCalendar.current = false;
    }
  }, [isAuthorized, setCalendarEvents]);

  // Fetch posts function - reusable for both mount and focus
  const fetchPosts = useCallback(async (forceRefresh: boolean = false) => {
    if (isAuthorized !== true) return;
    // Prevent duplicate simultaneous fetches
    if (isFetching.current && !forceRefresh) {
      return;
    }

    // Cooldown check - skip if not forcing refresh
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime.current < FETCH_COOLDOWN) {
      return;
    }

    isFetching.current = true;
    lastFetchTime.current = now;

    try {
      setIsLoadingPosts(true);
      setPostsError(null);
      // Fetch posts from backend (always fresh data)
      const json = await AdminDataService.getPosts();
      // Map the API response to include isPinned, isUrgent, and approval fields
      const mappedPosts: Post[] = json.map((post: any) => ({
        ...post,
        isPinned: post.isPinned || false,
        isUrgent: post.isUrgent || false,
        isApproved: post.isApproved ?? post.status === 'approved',
        status: post.status || (post.isApproved ? 'approved' : 'draft'),
        approvedAt: post.approvedAt,
        approvedBy: post.approvedBy ?? null,
        isoDate: post.isoDate || post.date,
      }));
      setPosts(mappedPosts);
    } catch (e: any) {
      setPostsError(e?.message || 'Failed to load posts');
    } finally {
      setIsLoadingPosts(false);
      isFetching.current = false;
    }
  }, [isAuthorized]);

  // Load posts and calendar events on mount
  useEffect(() => {
    if (isAuthorized === true) {
    fetchPosts(true); // Force refresh on mount
      refreshCalendarEvents(true);
    }
  }, [fetchPosts, refreshCalendarEvents, isAuthorized]);

  // Refresh posts and calendar events when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      if (isAuthorized !== true) return;
      // Force refresh when screen comes into focus to show updated posts
      fetchPosts(true);
      refreshCalendarEvents(true);
    }, [fetchPosts, refreshCalendarEvents, isAuthorized])
  );

  const handleNewPost = useCallback(() => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    setIsAnimating(true);
    navigation.navigate('PostUpdate');
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating, navigation]);

  const handleRefresh = useCallback(async () => {
    if (isAuthorized !== true || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchPosts(true),
        refreshCalendarEvents(true),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthorized, isRefreshing, fetchPosts, refreshCalendarEvents]);

  const handleEditPost = useCallback((postId: string) => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    setIsAnimating(true);
    // Navigate to editor with postId param
    (navigation as any).navigate('PostUpdate', { postId });
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating, navigation]);

  const handleMoreOptions = (postId: string) => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    setIsAnimating(true);
    const post = posts.find(p => p.id === postId) || null;
    setActivePostForOptions(post);
    setIsMoreOptionsOpen(true);
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  };

  const closeMoreOptionsModal = () => {
    setIsMoreOptionsOpen(false);
    setActivePostForOptions(null);
  };

  const openPinConfirm = (postId: string) => {
    const post = posts.find(p => p.id === postId) || null;
    setActionPost(post);
    setIsPinConfirmOpen(true);
    setIsMoreOptionsOpen(false);
    setTimeout(() => {
      Animated.timing(pinSheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
  };

  const closePinConfirm = () => {
    Animated.timing(pinSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      InteractionManager.runAfterInteractions(() => {
        setIsPinConfirmOpen(false);
      });
    });
  };

  const openDeleteConfirm = (postId: string) => {
    const post = posts.find(p => p.id === postId) || null;
    setActionPost(post);
    setIsDeleteConfirmOpen(true);
    setIsMoreOptionsOpen(false);
    setTimeout(() => {
      Animated.timing(deleteSheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
  };

  const closeDeleteConfirm = () => {
    Animated.timing(deleteSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setIsDeleteConfirmOpen(false);
    });
  };

  const handleDeletePost = async (postId: string) => {
    await AdminDataService.deletePost(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    if (activePostForOptions?.id === postId) {
      setIsMoreOptionsOpen(false);
      setActivePostForOptions(null);
    }
  };

  const handleTogglePin = async (postId: string) => {
    const updated = await AdminDataService.togglePin(postId);
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        if (updated) {
          const convertedPost: Post = {
            id: updated.id,
            title: updated.title,
            category: updated.category,
            date: updated.date,
            description: updated.description,
            isPinned: updated.isPinned ?? false,
            isUrgent: updated.isUrgent ?? false,
          };
          return convertedPost;
        }
        return { ...p, isPinned: !p.isPinned };
      }
      return p;
    }));
    if (activePostForOptions && activePostForOptions.id === postId) {
      if (updated) {
        const convertedPost: Post = {
          id: updated.id,
          title: updated.title,
          category: updated.category,
          date: updated.date,
          description: updated.description,
          isPinned: updated.isPinned ?? false,
          isUrgent: updated.isUrgent ?? false,
        };
        setActivePostForOptions(convertedPost);
      } else {
        setActivePostForOptions({ ...activePostForOptions, isPinned: !activePostForOptions.isPinned });
      }
    }
  };

  const handleApprovePost = async (postId: string) => {
    try {
      // Find the current post to get all its data
      const currentPost = posts.find(p => p.id === postId);
      if (!currentPost) {
        console.error('Post not found:', postId);
        return;
      }

      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const approvedBy = await AsyncStorage.getItem('userEmail');
      
      // Include all post data along with approval fields
      // Preserve the original creator (moderator) - don't change creatorRole or source
      // First update the post with its current data plus approval fields
      const updatePayload: any = {
        title: currentPost.title,
        description: currentPost.description,
        category: currentPost.category,
        date: currentPost.date,
        isoDate: currentPost.isoDate || currentPost.date,
        isPinned: currentPost.isPinned,
        isUrgent: currentPost.isUrgent,
        // Preserve original creator information
        source: currentPost.source, // Keep original source (Moderator/Admin)
        creatorRole: currentPost.creatorRole, // Keep original creator role
        // Add approval fields
        status: 'approved',
        isApproved: true,
        approvedAt: new Date().toISOString(),
        approvedBy: approvedBy || null,
      };
      const updated: any = await AdminDataService.updatePost(postId, updatePayload);
      
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          const next: Post = updated ? {
            id: updated.id,
            title: updated.title,
            category: updated.category,
            date: updated.date,
            description: updated.description,
            isPinned: updated.isPinned ?? false,
            isUrgent: updated.isUrgent ?? false,
            // Preserve original creator information
            source: updated.source ?? currentPost.source, // Keep original source
            creatorRole: updated.creatorRole ?? currentPost.creatorRole, // Keep original creator role
            // Update approval status
            status: updated.status || 'approved',
            isApproved: updated.isApproved ?? true,
            approvedAt: updated.approvedAt || new Date().toISOString(),
            approvedBy: updated.approvedBy ?? approvedBy ?? null,
            isoDate: updated.isoDate || updated.date,
          } : {
            ...p,
            // Preserve original creator information
            source: p.source, // Keep original source
            creatorRole: p.creatorRole, // Keep original creator role
            // Update approval status
            status: 'approved',
            isApproved: true,
            approvedAt: new Date().toISOString(),
            approvedBy: approvedBy ?? null,
          };
          return next;
        }
        return p;
      }));
      if (activePostForOptions && activePostForOptions.id === postId) {
        setActivePostForOptions(prev => prev ? { ...prev, status: 'approved', isApproved: true } : prev);
      }
    } catch (error: any) {
      console.error('Failed to approve post:', error);
      Alert.alert('Error', error.message || 'Failed to approve post');
    }
  };

  const handleRejectPost = async (postId: string) => {
    try {
      // Find the current post to get all its data
      const currentPost = posts.find(p => p.id === postId);
      if (!currentPost) {
        console.error('Post not found:', postId);
        return;
      }

      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const rejectedBy = await AsyncStorage.getItem('userEmail');
      
      // Include all post data along with rejection fields
      // Preserve the original creator (moderator) - don't change creatorRole or source
      const updatePayload: any = {
        title: currentPost.title,
        description: currentPost.description,
        category: currentPost.category,
        date: currentPost.date,
        isoDate: currentPost.isoDate || currentPost.date,
        isPinned: currentPost.isPinned,
        isUrgent: currentPost.isUrgent,
        // Preserve original creator information
        source: currentPost.source, // Keep original source (Moderator/Admin)
        creatorRole: currentPost.creatorRole, // Keep original creator role
        // Add rejection fields
        status: 'rejected',
        isApproved: false,
        approvedAt: undefined,
        approvedBy: null,
      };
      const updated: any = await AdminDataService.updatePost(postId, updatePayload);
      
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          const next: Post = updated ? {
            id: updated.id,
            title: updated.title,
            category: updated.category,
            date: updated.date,
            description: updated.description,
            isPinned: updated.isPinned ?? false,
            isUrgent: updated.isUrgent ?? false,
            // Preserve original creator information
            source: updated.source ?? currentPost.source, // Keep original source
            creatorRole: updated.creatorRole ?? currentPost.creatorRole, // Keep original creator role
            // Update rejection status
            status: updated.status || 'rejected',
            isApproved: updated.isApproved ?? false,
            approvedAt: updated.approvedAt || undefined,
            approvedBy: updated.approvedBy ?? null,
            isoDate: updated.isoDate || updated.date,
          } : {
            ...p,
            // Preserve original creator information
            source: p.source, // Keep original source
            creatorRole: p.creatorRole, // Keep original creator role
            // Update rejection status
            status: 'rejected',
            isApproved: false,
            approvedAt: undefined,
            approvedBy: null,
          };
          return next;
        }
        return p;
      }));
      if (activePostForOptions && activePostForOptions.id === postId) {
        setActivePostForOptions(prev => prev ? { ...prev, status: 'rejected', isApproved: false } : prev);
      }
      
      // Close the options modal after rejection
      closeMoreOptionsModal();
    } catch (error: any) {
      console.error('Failed to reject post:', error);
      Alert.alert('Error', error.message || 'Failed to reject post');
    }
  };

  // Open event modal - optimized for performance
  const openEventDrawer = useCallback((event: CalendarEvent, date?: Date) => {
    if (date) {
      const dateKey = formatDateKey(date);
      const eventsOnDate = calendarEvents.filter(e => {
        const eventDateKey = parseAnyDateToKey(e.isoDate || e.date);
        return eventDateKey === dateKey;
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
      
      setSelectedEvent(event);
      setSelectedDateForDrawer(date);
      setSelectedDateEvents(mappedEvents);
      setShowEventDrawer(true);
    } else {
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

  const openCategoryMenu = () => setIsCategoryOpen(true);
  const closeCategoryMenu = () => setIsCategoryOpen(false);
  const selectCategory = (value: string) => {
    setSelectedCategory(value);
    closeCategoryMenu();
  };

  const openCreatorRoleMenu = () => setIsCreatorRoleOpen(true);
  const closeCreatorRoleMenu = () => setIsCreatorRoleOpen(false);
  const selectCreatorRole = (value: 'all' | 'admin' | 'moderator') => {
    setSelectedCreatorRole(value);
    closeCreatorRoleMenu();
  };

  const openSortMenu = () => setIsSortOpen(true);
  const closeSortMenu = () => setIsSortOpen(false);
  const selectSort = (value: string) => {
    setSelectedSort(value);
    closeSortMenu();
  };

  const handleCategoryChange = () => {
    openCategoryMenu();
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All Categories');
    setSelectedSort('Newest');
    setSelectedCreatorRole('all');
  };

  // Combine posts and calendar events for filtering - filter calendar events to current month only
  // Filter out rejected posts - only show approved and pending posts
  const allItems = useMemo(() => {
    // Filter out rejected posts - only show approved and pending posts
    const visiblePosts = posts.filter(post => {
      // Check if post is rejected
      const isRejected = post.status === 'rejected' || 
                        post.status === 'disapproved' || 
                        post.status === 'cancelled' ||
                        (post.isApproved === false && post.status !== 'pending' && post.status !== 'draft');
      
      // Exclude rejected posts
      return !isRejected;
    });
    
    const postsList: CombinedItem[] = visiblePosts.map(post => ({
      ...post,
      isCalendarEvent: false,
    }));
    
    // Filter calendar events to current month only
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const currentMonthEvents = calendarEvents.filter(event => {
      // Handle month-only and week-only events
      const dateType = String(event.dateType || '');
      if (dateType === 'month_only' || dateType === 'week_in_month' || 
          dateType === 'week' || dateType === 'month') {
        if (event.year && event.month) {
          // event.month is 1-indexed (1 = January, 12 = December)
          const eventMonth0Indexed = event.month - 1;
          return event.year === currentYear && eventMonth0Indexed === currentMonth;
        }
        return false;
      }
      
      // For date range events, check if the range overlaps with current month
      if (dateType === 'date_range' && event.startDate && event.endDate) {
        const start = new Date(event.startDate);
        const end = new Date(event.endDate);
        
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();
        const endYear = end.getFullYear();
        const endMonth = end.getMonth();
        
        // Check if the range overlaps with current month
        const rangeStart = new Date(startYear, startMonth, 1).getTime();
        const rangeEnd = new Date(endYear, endMonth + 1, 0, 23, 59, 59).getTime();
        const targetStart = new Date(currentYear, currentMonth, 1).getTime();
        const targetEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();
        
        return !(rangeEnd < targetStart || rangeStart > targetEnd);
      }
      
      // For single date events, use the event date
      const fallbackDate = event.isoDate || event.date || event.startDate;
      if (!fallbackDate) return false;
      
      const dateObj = new Date(fallbackDate);
      if (Number.isNaN(dateObj.getTime())) return false;
      
      const eventYear = dateObj.getFullYear();
      const eventMonth = dateObj.getMonth(); // 0-indexed
      
      return eventYear === currentYear && eventMonth === currentMonth;
    });
    
    // Map filtered calendar events to CombinedItem format
    const calendarItems: CombinedItem[] = currentMonthEvents.map(event => ({
      id: event._id || `calendar-${event.isoDate}-${event.title}`,
      title: event.title,
      category: event.category || 'Event',
      date: formatDate(event.isoDate || event.date) || 'No date',
      description: event.description,
      isPinned: false,
      isUrgent: false,
      isoDate: event.isoDate || event.date,
      _id: event._id,
      isCalendarEvent: true,
    }));
    
    return [...postsList, ...calendarItems];
  }, [posts, calendarEvents]);

  const filteredPosts = allItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
    // Filter by creator role (only if admin and filter is set)
    let matchesCreatorRole = true;
    
    // Skip role filtering if user is not admin (filter shouldn't be visible anyway)
    if (!isAdmin) {
      matchesCreatorRole = true;
    }
    // Show all if filter is set to "all"
    else if (selectedCreatorRole === 'all') {
      matchesCreatorRole = true;
    }
    // Filter by admin role - include calendar events (they're posted by admin)
    else if (selectedCreatorRole === 'admin') {
      matchesCreatorRole = item.isCalendarEvent || (
        item.creatorRole === 'admin' || 
        item.source === 'Admin' || 
        (!item.creatorRole && item.source !== 'Moderator' && item.source !== 'moderator')
      );
    }
    // Filter by moderator role - exclude calendar events (they're admin posts)
    else if (selectedCreatorRole === 'moderator') {
      matchesCreatorRole = !item.isCalendarEvent && (
        item.creatorRole === 'moderator' || 
        item.source === 'Moderator' || 
        item.source === 'moderator'
      );
    }
    return matchesSearch && matchesCategory && matchesCreatorRole;
  });

  const sortedPosts = useMemo(() => {
    const sorted = [...filteredPosts];
    const parsePostDate = (item: CombinedItem): number => {
      // Use isoDate if available (more reliable)
      if (item.isoDate) {
        const t = Date.parse(item.isoDate);
      if (!isNaN(t)) return t;
      }
      // Fallback to date string
      if (item.date) {
        const t = Date.parse(item.date);
        if (!isNaN(t)) return t;
        const m = item.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) {
        const dd = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10) - 1;
        const yyyy = parseInt(m[3], 10);
        const d = new Date(yyyy, mm, dd);
        return d.getTime();
        }
      }
      return 0;
    };
    switch (selectedSort) {
      case 'Newest':
        return sorted.sort((a, b) => parsePostDate(b) - parsePostDate(a));
      case 'Oldest':
        return sorted.sort((a, b) => parsePostDate(a) - parsePostDate(b));
      case 'Title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'Last Modified':
        // For demo purposes, using date as last modified
        return sorted.sort((a, b) => parsePostDate(b) - parsePostDate(a));
      default:
        return sorted;
    }
  }, [filteredPosts, selectedSort]);

  // Animate floating background orb on mount (matching AIChat style)
  useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bgFade1, {
            toValue: 1,
          duration: 8000,
            useNativeDriver: true,
          }),
          Animated.timing(bgFade1, {
            toValue: 0,
          duration: 8000,
            useNativeDriver: true,
          }),
        ])
    ).start();
  }, [bgFade1]);
  

  if (authLoading || isPendingAuthorization) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3' }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (isAuthorized === false) {
    return (
      <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3' }} />
    );
  }

  return (
    <View style={[styles.container, {
      backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3',
    }]} collapsable={false}>
      <StatusBar 
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        translucent={true}
        hidden={false}
      />
      
      {/* Warm Gradient Background */}
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
      
      {/* Blur overlay on entire background - very subtle */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint="default"
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      {/* Animated Floating Background Orb (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        {/* Orb 1 - Soft Glow (Center area) */}
        <Animated.View
          style={[
            styles.floatingOrbWrapper,
            {
              top: '35%',
              left: '50%',
              marginLeft: -250,
              transform: [
                {
                  translateX: bgFade1.interpolate({
                inputRange: [0, 1],
                    outputRange: [-30, 30],
              }),
            },
                {
                  translateY: bgFade1.interpolate({
                inputRange: [0, 1],
                    outputRange: [-20, 20],
                  }),
                },
                {
                  scale: bgFade1.interpolate({
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
      
      {/* Header - Copilot Style matching AIChat */}
      <View style={[styles.header, { 
        top: 0,
        paddingTop: safeInsets.top,
        left: safeInsets.left,
        right: safeInsets.right,
        backgroundColor: isDarkMode ? 'rgba(11, 18, 32, 0.95)' : 'rgba(251, 248, 243, 0.95)',
        }]}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          // Only update if height actually changed to prevent unnecessary re-renders
          // Include safe area top in the total header height
          const totalHeight = safeInsets.top + Math.max(height, 64);
          if (totalHeight > 0 && Math.abs(totalHeight - headerHeightRef.current) > 1) {
            headerHeightRef.current = totalHeight;
            setHeaderHeight(totalHeight);
          }
        }}
        collapsable={false}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 80 : 60}
          tint={isDarkMode ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
            <TouchableOpacity 
              onPress={() => {
            if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
              navigation.goBack();
            } else {
              (navigation as any).navigate('AdminDashboard');
            }
              }} 
              style={styles.backButton}
              accessibilityLabel="Go back"
              activeOpacity={0.7}
            >
            <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
          </TouchableOpacity>
        </View>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(17) }]} numberOfLines={1}>
              Manage Posts
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.newButton, { backgroundColor: theme.colors.accent }]} 
              onPress={handleNewPost}
              activeOpacity={0.8}
            >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={[styles.newButtonText, { color: '#fff', fontSize: theme.fontSize.scaleSize(13) }]}>New</Text>
          </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[{
          paddingHorizontal: 16 + safeInsets.left,
          paddingTop: Math.max(headerHeight, 72) + 24,
          paddingBottom: 20 + safeInsets.bottom,
          paddingRight: 16 + safeInsets.right,
        }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={true}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
            progressBackgroundColor={isDarkMode ? '#1F2937' : '#F9FAFB'}
          />
        }
      >

        {/* Filter Posts Section */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.filterContainer, {
            backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.6)' : 'rgba(255, 255, 255, 0.7)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            marginTop: 0,
          }]}
        >
          <View style={styles.filterHeaderRow}>
            <Text style={[styles.filterTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}>Filter Posts</Text>
              {hasActiveFilters && (
                <TouchableOpacity style={[styles.clearFiltersBtn, { backgroundColor: isDarkMode ? '#7F1D1D' : '#FEF2F2' }]} onPress={clearAllFilters}>
                  <Ionicons name="close-circle" size={16} color={isDarkMode ? '#FCA5A5' : '#DC2626'} />
                  <Text style={[styles.clearFiltersText, { color: isDarkMode ? '#FCA5A5' : '#DC2626', fontSize: theme.fontSize.scaleSize(12) }]}>Clear All</Text>
                </TouchableOpacity>
              )}
          </View>
          
          {/* Search Bar */}
          <View style={[styles.searchContainer, {
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
          }]}>
            <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}
              placeholder="Search posts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.colors.textMuted}
            />
            {searchQuery.trim() !== '' && (
              <TouchableOpacity 
                style={[styles.clearSearchBtn, { backgroundColor: theme.colors.surfaceAlt }]} 
                onPress={() => setSearchQuery('')}
              >
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category, Date, and Sort Filter Row */}
          <View style={styles.filterRow}>
            <TouchableOpacity 
              style={[
                styles.categoryContainer, 
                {
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                },
                selectedCategory !== 'All Categories' && { borderColor: theme.colors.primary, backgroundColor: isDarkMode ? theme.colors.surfaceAlt : '#F0F8FF', borderWidth: 2 }
              ]} 
              onPress={handleCategoryChange}
            >
              <View style={styles.categoryFilterLeft}>
                <View style={[styles.categoryFilterIconWrap, { backgroundColor: currentCategory.color + '22' }]}>
                  <Ionicons name={currentCategory.icon as any} size={16} color={currentCategory.color} />
                </View>
                <Text 
                  style={[
                  styles.categoryText, 
                  { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) },
                  selectedCategory !== 'All Categories' && { color: theme.colors.primary, fontWeight: '700' }
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {selectedCategory}
                </Text>
              </View>
              <Ionicons 
                name="chevron-down" 
                size={18} 
                color={selectedCategory !== 'All Categories' ? currentCategory.color : theme.colors.textMuted} 
              />
              {selectedCategory !== 'All Categories' && (
                <View style={[styles.activeFilterBadge, { backgroundColor: currentCategory.color }]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Creator Role Filter - Only for Admins */}
            {isAdmin && (
            <TouchableOpacity 
              style={[
                  styles.categoryContainer, 
                {
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                },
                  selectedCreatorRole !== 'all' && { borderColor: selectedCreatorRole === 'moderator' ? '#F59E0B' : '#EF4444', backgroundColor: isDarkMode ? theme.colors.surfaceAlt : (selectedCreatorRole === 'moderator' ? '#FEF3C7' : '#FEE2E2'), borderWidth: 2 }
              ]} 
                onPress={() => setIsCreatorRoleOpen(true)}
            >
                <View style={styles.categoryFilterLeft}>
                  <View style={[styles.categoryFilterIconWrap, { backgroundColor: selectedCreatorRole === 'moderator' ? '#F59E0B22' : selectedCreatorRole === 'admin' ? '#EF444422' : '#6B728022' }]}>
              <Ionicons 
                      name={selectedCreatorRole === 'moderator' ? 'shield-outline' : selectedCreatorRole === 'admin' ? 'person-circle-outline' : 'people-outline'} 
                      size={16} 
                      color={selectedCreatorRole === 'moderator' ? '#F59E0B' : selectedCreatorRole === 'admin' ? '#EF4444' : '#6B7280'} 
                    />
                  </View>
                  <Text 
                    style={[
                      styles.categoryText, 
                { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) },
                      selectedCreatorRole !== 'all' && { color: selectedCreatorRole === 'moderator' ? '#F59E0B' : '#EF4444', fontWeight: '700' }
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {selectedCreatorRole === 'all' ? 'All Posts' : selectedCreatorRole === 'moderator' ? 'Moderator' : 'Admin'}
              </Text>
                </View>
                <Ionicons 
                  name="chevron-down" 
                  size={18} 
                  color={selectedCreatorRole !== 'all' ? (selectedCreatorRole === 'moderator' ? '#F59E0B' : '#EF4444') : theme.colors.textMuted} 
                />
                {selectedCreatorRole !== 'all' && (
                  <View style={[styles.activeFilterBadge, { backgroundColor: selectedCreatorRole === 'moderator' ? '#F59E0B' : '#EF4444' }]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            )}
          </View>

          {/* Sort Row */}
          <View style={styles.sortRow}>
            <TouchableOpacity 
              style={[
                styles.sortContainer, 
                {
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                },
                selectedSort !== 'Newest' && { borderColor: theme.colors.primary, backgroundColor: isDarkMode ? theme.colors.surfaceAlt : '#F0F8FF', borderWidth: 2 }
              ]} 
              onPress={openSortMenu}
            >
              <View style={styles.sortFilterLeft}>
                <View style={[styles.sortFilterIconWrap, { backgroundColor: currentSort.color + '22' }]}>
                  <Ionicons name={currentSort.icon as any} size={16} color={currentSort.color} />
                </View>
                <Text style={[
                  styles.sortText, 
                  { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) },
                  selectedSort !== 'Newest' && { color: theme.colors.primary, fontWeight: '700' }
                ]}>
                  Sort by: {selectedSort}
                </Text>
              </View>
              <Ionicons 
                name="chevron-down" 
                size={18} 
                color={selectedSort !== 'Newest' ? currentSort.color : theme.colors.textMuted} 
              />
              {selectedSort !== 'Newest' && (
                <View style={[styles.activeFilterBadge, { backgroundColor: currentSort.color }]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Posts List */}
        <View style={styles.postsContainer} collapsable={false}>
          <Text style={[styles.postsTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}>Posts & Events ({sortedPosts.length})</Text>
          
          {(isLoadingPosts || isLoadingCalendarEvents) && !isRefreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={[styles.loadingText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(14) }]}>
                Loading posts & events...
              </Text>
                    </View>
          ) : postsError ? (
            <View style={styles.emptyStateContainer}>
              <Text style={[styles.emptyStateSubtitle, { color: '#DC2626', fontSize: theme.fontSize.scaleSize(14) }]}>Failed to load posts</Text>
            </View>
          ) : filteredPosts.length === 0 ? (
            // Empty State
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="document-text-outline" size={48} color={theme.colors.textMuted} />
            </View>
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(18) }]}>
                {hasActiveFilters ? 'No posts found' : 'No posts yet'}
              </Text>
            <Text style={[styles.emptyStateSubtitle, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(14) }]}>
                {hasActiveFilters 
                  ? 'Try adjusting your filters or search terms'
                  : 'Create your first post to get started'
                }
              </Text>
              {!hasActiveFilters && (
              <TouchableOpacity style={[styles.emptyStateButton, { backgroundColor: theme.colors.primary }]} onPress={handleNewPost}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={[styles.emptyStateButtonText, { fontSize: theme.fontSize.scaleSize(14) }]}>Create First Post</Text>
                </TouchableOpacity>
              )}
            </View>
                      ) : (
              // Actual Posts and Events
              sortedPosts.map((item) => {
                const categoryOption = CATEGORY_OPTIONS.find(o => o.key === item.category) || CATEGORY_OPTIONS[1];
                const colors = categoryToColors(item.category);
                const accentColor = colors.dot || categoryOption.color;
                const isCalendarEvent = item.isCalendarEvent || !!item._id;
                
                return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => {
                if (isCalendarEvent) {
                  // Find the full calendar event
                  const fullEvent = calendarEvents.find(e => 
                    e._id === item._id || 
                    e._id === item.id ||
                    `calendar-${e.isoDate}-${e.title}` === item.id
                  );
                  if (fullEvent) {
                    const eventDate = fullEvent.isoDate || fullEvent.date 
                      ? new Date(fullEvent.isoDate || fullEvent.date)
                      : new Date();
                    openEventDrawer(fullEvent, eventDate);
                  }
                } else {
                  // Regular post - open options or navigate to edit
                  handleMoreOptions(item.id);
                }
              }}
            >
            <View style={[styles.postCard, {
              backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.6)' : 'rgba(255, 255, 255, 0.7)',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }]}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 50 : 40}
              tint={isDarkMode ? 'dark' : 'light'}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={[styles.updateAccent, { backgroundColor: accentColor }]} />
              <View style={styles.postContent}>
                {(item.images?.[0] || item.image) && (
                  <Image 
                    source={{ uri: item.images?.[0] || item.image || '' }} 
                    style={styles.updateImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.postTextContent}>
              <View style={styles.postHeader}>
                  <View style={styles.postTitleContainer}>
                      <Text style={[styles.postTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(15) }]}>{item.title}</Text>
                    <View style={styles.tagsContainer}>
                        {!isCalendarEvent && item.isPinned && (
                        <View style={styles.pinnedTag}>
                          <Ionicons name="pin" size={10} color="#fff" />
                          <Text style={[styles.pinnedText, { fontSize: theme.fontSize.scaleSize(11) }]}>Pinned</Text>
                        </View>
                      )}
                      {!isCalendarEvent && item.isUrgent && (
                        <View style={styles.urgentTag}>
                          <Ionicons name="alert-circle" size={10} color="#fff" />
                          <Text style={[styles.urgentText, { fontSize: theme.fontSize.scaleSize(11) }]}>Urgent</Text>
                        </View>
                      )}
                      {/* Category Badge - Show for both regular posts and calendar events */}
                      <View style={[styles.categoryTag, { backgroundColor: accentColor }]}>
                        <Ionicons name={categoryOption.icon as any} size={10} color="#fff" />
                        <Text style={[styles.categoryTagText, { fontSize: theme.fontSize.scaleSize(11) }]}>{item.category}</Text>
                      </View>
                      {/* Creator Role Badge - Show for admin posts (not calendar events) */}
                      {!isCalendarEvent && (item.creatorRole === 'admin' || item.source === 'Admin' || (!item.creatorRole && item.source !== 'Moderator' && item.source !== 'moderator')) && (
                        <View style={[styles.categoryTag, { backgroundColor: '#EF4444' }]}>
                          <Ionicons name="person-circle" size={10} color="#fff" />
                          <Text style={[styles.categoryTagText, { fontSize: theme.fontSize.scaleSize(11) }]}>Admin</Text>
                    </View>
                      )}
                      {/* Creator Role Badge - Show for moderator posts (not calendar events) */}
                      {!isCalendarEvent && (item.creatorRole === 'moderator' || item.source === 'Moderator' || item.source === 'moderator') && (
                        <View style={[styles.categoryTag, { backgroundColor: '#F59E0B' }]}>
                          <Ionicons name="shield" size={10} color="#fff" />
                          <Text style={[styles.categoryTagText, { fontSize: theme.fontSize.scaleSize(11) }]}>Moderator</Text>
                  </View>
                      )}
                      {/* Approval Status Badge - Show for regular posts only */}
                      {!isCalendarEvent && (() => {
                        // Admin posts are auto-approved, so show check mark
                        const isAdminPost = item.creatorRole === 'admin' || item.source === 'Admin' || (!item.creatorRole && item.source !== 'Moderator' && item.source !== 'moderator');
                        const isApproved = item.isApproved === true || item.status === 'approved' || isAdminPost;
                        const isRejected = item.status === 'rejected' || item.status === 'cancelled' || item.status === 'disapproved';
                        const isPending = !isApproved && !isRejected;
                        
                        if (isApproved) {
                          return (
                            <View style={[styles.approvalTag, { backgroundColor: '#10B981' }]}>
                              <Ionicons name="checkmark-circle" size={10} color="#fff" />
                              <Text style={[styles.approvalTagText, { fontSize: theme.fontSize.scaleSize(11) }]}>Approved</Text>
                            </View>
                          );
                        } else if (isRejected) {
                          return (
                            <View style={[styles.approvalTag, { backgroundColor: '#EF4444' }]}>
                              <Ionicons name="close-circle" size={10} color="#fff" />
                              <Text style={[styles.approvalTagText, { fontSize: theme.fontSize.scaleSize(11) }]}>Rejected</Text>
                            </View>
                          );
                        } else if (isPending) {
                          return (
                            <View style={[styles.approvalTag, { backgroundColor: '#6366F1' }]}>
                              <Ionicons name="time-outline" size={10} color="#fff" />
                              <Text style={[styles.approvalTagText, { fontSize: theme.fontSize.scaleSize(11) }]}>Pending</Text>
                            </View>
                          );
                        }
                        return null;
                      })()}
                    </View>
                  </View>
                  
                    {!isCalendarEvent && (
                  <View style={styles.postActions}>
                  <TouchableOpacity 
                    style={styles.moreOptionsBtn} 
                          onPress={() => handleMoreOptions(item.id)}
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                  </View>
                    )}
                </View>
                
                <View style={styles.postMetadata}>
                    <View style={styles.postMetadataLeft}>
                      <Text style={[styles.postDate, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(13) }]}>
                        {isCalendarEvent ? 'Event' : 'Posted'}: {item.date}
                      </Text>
                      {item.description && (
                        <Text style={[styles.postDescription, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }]} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                </View>
                    {/* Approval Status Indicator - Display directly in card */}
                    {!isCalendarEvent && (() => {
                      const isAdminPost = item.creatorRole === 'admin' || item.source === 'Admin' || (!item.creatorRole && item.source !== 'Moderator' && item.source !== 'moderator');
                      const isApproved = item.isApproved === true || item.status === 'approved' || isAdminPost;
                      const isRejected = item.status === 'rejected' || item.status === 'cancelled' || item.status === 'disapproved';
                      const isPending = !isApproved && !isRejected;
                      
                      if (isApproved) {
                        return (
                          <View style={[styles.approvalIndicator, { backgroundColor: '#10B981' }]}>
                            <Ionicons name="checkmark-circle" size={18} color="#fff" />
                          </View>
                        );
                      } else if (isRejected) {
                        return (
                          <View style={[styles.approvalIndicator, { backgroundColor: '#EF4444' }]}>
                            <Ionicons name="close-circle" size={18} color="#fff" />
                          </View>
                        );
                      } else if (isPending) {
                        return (
                          <View style={[styles.approvalIndicator, { backgroundColor: '#6366F1' }]}>
                            <Ionicons name="time-outline" size={18} color="#fff" />
                          </View>
                        );
                      }
                      return null;
                    })()}
                </View>
                </View>
              </View>
            </View>
            </TouchableOpacity>
            );
              })
          )}
        </View>
      </ScrollView>

      {/* More Options Modal */}
      <OptionsModal
        visible={isMoreOptionsOpen}
        onClose={closeMoreOptionsModal}
        title="Post Actions"
        subtitle={activePostForOptions ? activePostForOptions.title : ''}
        options={[
          {
            id: 'edit',
            label: 'Edit Post',
            icon: 'create-outline',
            iconColor: '#059669'
          },
          // Show approve/reject options for pending posts (not approved, not rejected)
          ...(activePostForOptions ? (() => {
            const isAdminPost = activePostForOptions.creatorRole === 'admin' || 
                               activePostForOptions.source === 'Admin' || 
                               (!activePostForOptions.creatorRole && activePostForOptions.source !== 'Moderator' && activePostForOptions.source !== 'moderator');
            const isApproved = activePostForOptions.isApproved === true || activePostForOptions.status === 'approved' || isAdminPost;
            const isRejected = activePostForOptions.status === 'rejected' || 
                              activePostForOptions.status === 'disapproved' || 
                              activePostForOptions.status === 'cancelled';
            const isPending = !isApproved && !isRejected;
            
            if (isPending) {
              return [
                {
                  id: 'approve',
                  label: 'Approve Post',
                  icon: 'checkmark-done',
                  iconColor: '#10B981'
                },
                {
                  id: 'reject',
                  label: 'Reject Post',
                  icon: 'close-circle',
                  iconColor: '#EF4444',
                  destructive: true
                }
              ];
            }
            return [];
          })() : []),
          {
            id: 'delete',
            label: 'Delete Post',
            icon: 'trash',
            iconColor: '#DC2626',
            destructive: true
          }
        ]}
        onOptionSelect={(optionId) => {
          if (activePostForOptions) {
            switch (optionId) {
              case 'edit':
                closeMoreOptionsModal();
                handleEditPost(activePostForOptions.id);
                break;
              case 'approve':
                closeMoreOptionsModal();
                handleApprovePost(activePostForOptions.id);
                break;
              case 'reject':
                handleRejectPost(activePostForOptions.id);
                break;
              case 'delete':
                openDeleteConfirm(activePostForOptions.id);
                break;
            }
          }
        }}
      />

      {/* Pin Confirm Modal */}
      <ConfirmationModal
        visible={isPinConfirmOpen}
        onClose={closePinConfirm}
        onConfirm={() => {
          if (actionPost) {
            handleTogglePin(actionPost.id);
          }
          closePinConfirm();
        }}
        title={actionPost?.isPinned ? 'Unpin post?' : 'Pin post?'}
        message={actionPost?.title || ''}
        confirmText={actionPost?.isPinned ? 'Unpin' : 'Pin'}
        icon={actionPost?.isPinned ? 'pin' : 'pin-outline'}
        iconColor="#1D4ED8"
        sheetY={pinSheetY}
      />

      {/* Delete Confirm Modal */}
      <ConfirmationModal
        visible={isDeleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={() => {
          if (actionPost) {
            handleDeletePost(actionPost.id);
            closeDeleteConfirm();
          }
        }}
        title="Delete post?"
        message={actionPost?.title || ''}
        confirmText="Delete"
        icon="trash"
        iconColor="#DC2626"
        confirmButtonColor="#DC2626"
        sheetY={deleteSheetY}
      />

      {/* View Event Modal - Used for calendar events */}
      <ViewEventModal
        visible={showEventDrawer}
        onClose={closeEventDrawer}
        selectedEvent={selectedEvent}
        selectedDateEvents={selectedDateEvents}
        selectedDate={selectedDateForDrawer}
        onEdit={() => {
          // Check if it's a calendar event (has _id) or an update/post
          const event = selectedEvent as any;
          if (event?._id) {
            // Calendar event - show alert for now
            Alert.alert('Edit Event', 'Event editing functionality coming soon');
          } else if (event?.id) {
            // Update/Post - navigate to PostUpdate screen for editing
            closeEventDrawer();
            navigation.navigate('PostUpdate' as any, { postId: event.id });
          }
        }}
        onDelete={async () => {
          if (!selectedEvent) return;
          
          // Check if it's a calendar event (has _id) or an update/post
          const event = selectedEvent as any;
          if (event._id) {
            // Calendar event deletion
            try {
              setIsDeleting(true);
              const eventId = event._id || '';
              await CalendarService.deleteEvent(eventId);
              
              // Immediately remove from context for instant UI update
              setCalendarEvents(prevEvents => 
                prevEvents.filter((e: any) => {
                  const eId = e._id || e.id || `${e.isoDate}-${e.title}`;
                  return eId !== eventId;
                })
              );
              
              await refreshCalendarEvents(true);
              closeEventDrawer();
              setSelectedEvent(null);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete event');
            } finally {
              setIsDeleting(false);
            }
          } else if (event.id) {
            // Post/Update deletion - handled by options modal
            closeEventDrawer();
          }
        }}
      />

      {/* Removed Edit Modal (redundant) */}
      {/* Category Menu Modal */}
      <Modal visible={isCategoryOpen} transparent animationType="fade" onRequestClose={closeCategoryMenu}>
        <View style={styles.modalOverlay}>
          <View style={styles.categoryMenuCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.categoryMenuTitle, { fontSize: theme.fontSize.scaleSize(14) }]}>Select Category</Text>
              <TouchableOpacity onPress={closeCategoryMenu} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#555" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {CATEGORY_OPTIONS.map(opt => {
                const active = selectedCategory === opt.key;
                return (
                  <TouchableOpacity key={opt.key} onPress={() => selectCategory(opt.key)} style={[styles.categoryRow, active && { backgroundColor: opt.color + '0F', borderColor: opt.color }]}> 
                    <View style={[styles.categoryIconWrap, { backgroundColor: opt.color + '22' }]}>
                      <Ionicons name={opt.icon as any} size={18} color={opt.color} />
                    </View>
                    <View style={styles.categoryTextWrap}>
                      <Text style={[styles.categoryRowTitle, { fontSize: theme.fontSize.scaleSize(13) }, active && { color: '#111' }]}>{opt.key}</Text>
                      <Text style={[styles.categoryRowSub, { fontSize: theme.fontSize.scaleSize(11) }]}>{opt.description}</Text>
                    </View>
                    {active && (
                      <Ionicons name="checkmark-circle" size={20} color={opt.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Creator Role Menu Modal - Only for Admins */}
      {isAdmin && (
        <Modal visible={isCreatorRoleOpen} transparent animationType="fade" onRequestClose={closeCreatorRoleMenu}>
        <View style={styles.modalOverlay}>
          <View style={styles.categoryMenuCard}>
            <View style={styles.modalHeaderRow}>
                <Text style={[styles.categoryMenuTitle, { fontSize: theme.fontSize.scaleSize(14) }]}>Filter by Creator</Text>
                <TouchableOpacity onPress={closeCreatorRoleMenu} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#555" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
                {[
                  { key: 'all', label: 'All Posts', icon: 'people-outline', color: '#6B7280', description: 'Show all posts from admins and moderators' },
                  { key: 'admin', label: 'Admin Posts', icon: 'person-circle-outline', color: '#EF4444', description: 'Show only posts created by admins' },
                  { key: 'moderator', label: 'Moderator Posts', icon: 'shield-outline', color: '#F59E0B', description: 'Show only posts created by moderators' },
                ].map(opt => {
                  const active = selectedCreatorRole === opt.key;
                return (
                    <TouchableOpacity key={opt.key} onPress={() => selectCreatorRole(opt.key as 'all' | 'admin' | 'moderator')} style={[styles.categoryRow, active && { backgroundColor: opt.color + '0F', borderColor: opt.color }]}> 
                    <View style={[styles.categoryIconWrap, { backgroundColor: opt.color + '22' }]}>
                      <Ionicons name={opt.icon as any} size={18} color={opt.color} />
                    </View>
                    <View style={styles.categoryTextWrap}>
                        <Text style={[styles.categoryRowTitle, { fontSize: theme.fontSize.scaleSize(13) }, active && { color: '#111' }]}>{opt.label}</Text>
                      <Text style={[styles.categoryRowSub, { fontSize: theme.fontSize.scaleSize(11) }]}>{opt.description}</Text>
                    </View>
                    {active && (
                      <Ionicons name="checkmark-circle" size={20} color={opt.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}

      {/* Sort Menu Modal */}
      <Modal visible={isSortOpen} transparent animationType="fade" onRequestClose={closeSortMenu}>
          <View style={styles.modalOverlay}>
          <View style={styles.categoryMenuCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.categoryMenuTitle, { fontSize: theme.fontSize.scaleSize(14) }]}>Sort Posts</Text>
              <TouchableOpacity onPress={closeSortMenu} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#555" />
                      </TouchableOpacity>
                </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {SORT_OPTIONS.map(opt => {
                const active = selectedSort === opt.key;
                return (
                  <TouchableOpacity key={opt.key} onPress={() => selectSort(opt.key)} style={[styles.categoryRow, active && { backgroundColor: opt.color + '0F', borderColor: opt.color }]}> 
                    <View style={[styles.categoryIconWrap, { backgroundColor: opt.color + '22' }]}>
                      <Ionicons name={opt.icon as any} size={18} color={opt.color} />
                </View>
                    <View style={styles.categoryTextWrap}>
                      <Text style={[styles.categoryRowTitle, { fontSize: theme.fontSize.scaleSize(13) }, active && { color: '#111' }]}>{opt.key}</Text>
                      <Text style={[styles.categoryRowSub, { fontSize: theme.fontSize.scaleSize(11) }]}>{opt.description}</Text>
                    </View>
                    {active && (
                      <Ionicons name="checkmark-circle" size={20} color={opt.color} />
                    )}
                      </TouchableOpacity>
                );
              })}
                  </ScrollView>
            </View>
          </View>
        </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  floatingBgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 0,
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
  scrollView: {
    flex: 1,
  },
  header: {
    zIndex: 10,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    minHeight: 64,
    overflow: 'hidden',
    paddingTop: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flex: 1,
  },
  headerLeft: {
    width: 40,
  },
  backButton: {
    padding: 6,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 120,
    alignItems: 'flex-end',
    zIndex: 11,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  newButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  filterContainer: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
    marginBottom: 12,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  clearFiltersText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 12,
    borderWidth: 1,
    paddingVertical: 10,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
  },
  clearSearchBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sortRow: {
    marginBottom: 0,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    minHeight: 44,
  },
  sortFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  sortFilterIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 44,
  },
  activeFilterBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  categoryText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  postsContainer: {
    marginBottom: 16,
  },
  postsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
    marginBottom: 12,
  },
  postCard: {
    borderRadius: 20,
    padding: 0,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  postContent: {
    flex: 1,
    flexDirection: 'column',
    padding: 0,
    paddingLeft: 3, // Account for 3px accent bar
  },
  postTextContent: {
    flex: 1,
    padding: 10,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  postTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  postTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pinnedTag: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#1565C0',
  },
  pinnedText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  categoryTagText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  urgentTag: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#B71C1C',
  },
  urgentText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  approvalTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  approvalTagText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  postActions: {
    alignItems: 'flex-end',
  },
  moreOptionsBtn: {
    padding: 8,
    marginBottom: 8,
  },
  
  postMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  postMetadataLeft: {
    flex: 1,
    minWidth: 0,
  },
  approvalIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  postDate: {
    fontSize: 13,
    color: '#666',
  },
  postDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    lineHeight: 16,
  },
  updateAccent: {
    width: 3,
    borderRadius: 0,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
  },
  updateImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
    borderTopRightRadius: 12,
  },
  // Category filter styles
  categoryFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  categoryFilterIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  categoryMenuCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryMenuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  categoryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryTextWrap: {
    flex: 1,
  },
  categoryRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  categoryRowSub: {
    fontSize: 11,
    color: '#777',
  },
  // Empty state styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateIcon: {
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ManagePosts;
