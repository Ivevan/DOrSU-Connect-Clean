import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
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
import Sidebar from '../../components/navigation/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useUpdates } from '../../contexts/UpdatesContext';
import ConfirmationModal from '../../modals/ConfirmationModal';
import OptionsModal from '../../modals/OptionsModal';
import ViewEventModal from '../../modals/ViewEventModal';
import AdminDataService from '../../services/AdminDataService';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import { categoryToColors } from '../../utils/calendarUtils';
import { formatDate } from '../../utils/dateUtils';

// Helper function to convert Post to SchoolUpdates/AdminDashboard format
const convertPostToUpdateFormat = (post: Post): any => {
  // Ensure images array is properly set
  let images = post.images;
  if (!images || !Array.isArray(images) || images.length === 0) {
    if (post.image) {
      images = [post.image];
    } else {
      images = [];
    }
  }
  
  const dateValue = post.isoDate || post.date;
  const formattedDate = dateValue ? formatDate(dateValue) : 'No date';
  
  return {
    id: post.id,
    title: post.title,
    date: formattedDate,
    tag: post.category || 'Announcement',
    description: post.description,
    image: post.image,
    images: images,
    pinned: (post as any).pinned || post.isPinned || false,
    isoDate: dateValue || '',
    time: (post as any).time || '', // Include time field for AdminDashboard
    source: 'post', // Mark as post/update to distinguish from calendar events
    // Preserve approval fields for filtering
    isApproved: post.isApproved,
    status: post.status,
    creatorRole: post.creatorRole,
    approvedAt: post.approvedAt,
    approvedBy: post.approvedBy,
  };
};

type RootStackParamList = {
  AdminDashboard: undefined;
  PostUpdate: undefined;
  ManagePosts: undefined;
  ModeratorPosts: undefined;
};

type ModeratorPostsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ModeratorPosts'>;

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

const ModeratorPosts: React.FC = () => {
  const navigation = useNavigation<ModeratorPostsNavigationProp>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const isMountedRef = useRef(true);
  const { isDarkMode, theme } = useThemeValues();
  const { isLoading: authLoading, userRole, isAdmin, refreshUser, isAuthenticated } = useAuth();
  const { posts: sharedPosts, setPosts: setSharedPosts, calendarEvents, setCalendarEvents } = useUpdates();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const isPendingAuthorization = isAuthorized === null;
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'manage' | 'approve'>('manage');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  
  // Note: Creator role filter removed for moderators - they can only see their own posts

  // Loading and refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render on refresh

  // Sorting state
  const [selectedSort, setSelectedSort] = useState('Newest');
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Track if filters are active (no creator role filter for moderators)
  const hasActiveFilters = searchQuery.trim() !== '' || selectedCategory !== 'All Categories' || selectedSort !== 'Newest';

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

  // Load current user email for filtering posts
  useEffect(() => {
    const loadUserEmail = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const email = await AsyncStorage.getItem('userEmail');
        setCurrentUserEmail(email);
      } catch (error) {
        console.error('Failed to load user email:', error);
      }
    };
    loadUserEmail();
  }, []);

  // Authorization check (moderators only) via AuthContext
  useEffect(() => {
    if (authLoading) return;
    // Don't show alert if user is logging out (not authenticated), screen is not focused, or component is unmounting
    if (!isAuthenticated || !isFocused || !isMountedRef.current) {
      setIsAuthorized(false);
      return;
    }
    // Only moderators can access this screen (not admins - they use ManagePosts)
    const hasAccess = userRole === 'moderator' && !isAdmin;
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
    // Prevent duplicate simultaneous fetches (unless forcing refresh)
    if (isFetchingCalendar.current && !forceRefresh) {
      return;
    }

    // Cooldown check - skip if not forcing refresh
    const now = Date.now();
    if (!forceRefresh && now - lastCalendarFetchTime.current < CALENDAR_FETCH_COOLDOWN) {
      return;
    }

    // Reset fetching state if forcing refresh
    if (forceRefresh) {
      isFetchingCalendar.current = false;
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
    // Prevent duplicate simultaneous fetches (unless forcing refresh)
    if (isFetching.current && !forceRefresh) {
      return;
    }

    // Cooldown check - skip if not forcing refresh
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime.current < FETCH_COOLDOWN) {
      return;
    }

    // Reset fetching state if forcing refresh
    if (forceRefresh) {
      isFetching.current = false;
    }

    isFetching.current = true;
    lastFetchTime.current = now;

    try {
      setIsLoadingPosts(true);
      setPostsError(null);
      // Fetch posts from backend (always fresh data)
      const json = await AdminDataService.getPosts();
      // Map the API response to include isPinned, isUrgent, and approval fields
      // Note: We don't merge with sharedPosts here to avoid dependency issues
      // The sync effect will handle updating approval status from shared context
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
      // Update local posts state - this will trigger allItems to recalculate
      setPosts(mappedPosts);
      // Also update shared context so AdminDashboard and SchoolUpdates stay in sync
      // Filter to only approved posts and convert to SchoolUpdates/AdminDashboard format
      const approvedPosts = mappedPosts.filter(post => {
        const isApproved = post.isApproved === true || post.status === 'approved';
        const isAdminPost = post.creatorRole === 'admin' || 
                           post.source === 'Admin' || 
                           (!post.creatorRole && post.source !== 'Moderator' && post.source !== 'moderator');
        return isApproved || isAdminPost;
      });
      // Convert to shared format with all required fields
      const formattedPosts = approvedPosts.map(post => {
        const formatted = convertPostToUpdateFormat(post);
        // Ensure approval fields are preserved
        formatted.isApproved = post.isApproved ?? (post.status === 'approved');
        formatted.status = post.status || (post.isApproved ? 'approved' : 'draft');
        formatted.approvedAt = post.approvedAt;
        formatted.approvedBy = post.approvedBy;
        formatted.creatorRole = post.creatorRole;
        return formatted;
      });
      setSharedPosts(formattedPosts);
    } catch (e: any) {
      setPostsError(e?.message || 'Failed to load posts');
    } finally {
      setIsLoadingPosts(false);
      isFetching.current = false;
    }
  }, [isAuthorized, setSharedPosts]);

  // Load posts and calendar events on mount
  useEffect(() => {
    if (isAuthorized === true) {
    fetchPosts(true); // Force refresh on mount
      refreshCalendarEvents(true);
    }
  }, [fetchPosts, refreshCalendarEvents, isAuthorized]);

  // Sync local posts state with shared context when shared context changes
  // This ensures that when an admin approves a post, it immediately reflects in ModeratorPosts
  useEffect(() => {
    if (!isAuthorized || !sharedPosts) return;
    
    // Update local posts state with approval status from shared context
    // Only update posts that exist in local state and are in shared context (approved posts)
    setPosts(prevPosts => {
      let hasChanges = false;
      const updatedPosts = prevPosts.map(localPost => {
        // Find matching post in shared context
        const sharedPost = sharedPosts.find((sp: any) => sp.id === localPost.id);
        if (sharedPost) {
          // Check if approval status actually changed
          const newIsApproved = sharedPost.isApproved ?? true;
          const newStatus = sharedPost.status || 'approved';
          if (localPost.isApproved !== newIsApproved || localPost.status !== newStatus) {
            hasChanges = true;
            if (__DEV__) {
              console.log('🔄 Syncing approved post in ModeratorPosts:', {
                id: localPost.id,
                title: localPost.title,
                oldStatus: localPost.status,
                newStatus: newStatus,
                oldIsApproved: localPost.isApproved,
                newIsApproved: newIsApproved,
              });
            }
            // Update approval status from shared context
            return {
              ...localPost,
              isApproved: newIsApproved,
              status: newStatus,
              approvedAt: sharedPost.approvedAt,
              approvedBy: sharedPost.approvedBy,
            };
          }
        }
        return localPost;
      });
      // Only return new array if there were actual changes to prevent unnecessary re-renders
      return hasChanges ? updatedPosts : prevPosts;
    });
  }, [sharedPosts, isAuthorized]);

  // Refresh posts and calendar events when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      if (isAuthorized !== true) return;
      // Force refresh when screen comes into focus to show updated posts
      // The sync effect will handle updating approval status from shared context
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
    if (isAuthorized !== true) return;
    // Prevent multiple simultaneous refreshes
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Force refresh both posts and calendar events
      await Promise.all([
        fetchPosts(true),
        refreshCalendarEvents(true),
      ]);
      // Increment refresh key to force re-render of cards
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        setIsRefreshing(false);
      }, 100);
    }
  }, [isAuthorized, fetchPosts, refreshCalendarEvents]);

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
    // Also remove from shared context so AdminDashboard reflects the deletion
    setSharedPosts(prevShared => prevShared.filter((p: any) => p.id !== postId));
    if (activePostForOptions?.id === postId) {
      setIsMoreOptionsOpen(false);
      setActivePostForOptions(null);
    }
  };

  const handleTogglePin = async (postId: string) => {
    const updated = await AdminDataService.togglePin(postId);
    const updatePost = (p: Post) => {
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
    };
    
    setPosts(prev => prev.map(updatePost));
    // Also update shared context so AdminDashboard reflects the pin change
    setSharedPosts(prevShared => prevShared.map((p: any) => updatePost(p as Post)));
    
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

  // Moderators cannot approve or reject posts - these functions are removed
  // Only admins can approve/reject posts (in ManagePosts.tsx)

  // Open event modal - optimized for performance
  const openEventDrawer = useCallback((event: CalendarEvent, date?: Date) => {
    // Only display the single selected event, not all events on the date
    const singleEvent = {
      id: event._id || `calendar-${event.isoDate}-${event.title}`,
      title: event.title,
      color: categoryToColors(event.category || 'Event').dot,
      type: event.category || 'Event',
      category: event.category,
      description: event.description,
      isoDate: event.isoDate,
      date: event.date,
      time: event.time,
      startDate: event.startDate,
      endDate: event.endDate,
    };
    
    setSelectedEvent(event);
    setSelectedDateForDrawer(date || null);
    setSelectedDateEvents([singleEvent]); // Only include the clicked event
    setShowEventDrawer(true);
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

  // Creator role menu removed for moderators

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

  const filteredPosts = useMemo(() => {
    return allItems.filter(item => {
    // Tab-based filtering
    if (activeTab === 'approve') {
      // In "Pending Approval" tab, only show pending posts created by this moderator (read-only)
      const isModeratorPost = !item.isCalendarEvent && (
        item.creatorRole === 'moderator' || 
        item.source === 'Moderator' || 
        item.source === 'moderator'
      );
      
      if (!isModeratorPost) return false;
      
      // Check if post is pending (not approved, not rejected)
      const isAdminPost = item.creatorRole === 'admin' || 
                         item.source === 'Admin' || 
                         (!item.creatorRole && item.source !== 'Moderator' && item.source !== 'moderator');
      const isApproved = item.isApproved === true || item.status === 'approved' || isAdminPost;
      const isRejected = item.status === 'rejected' || 
                        item.status === 'cancelled' || 
                        item.status === 'disapproved';
      const isPending = !isApproved && !isRejected;
      
      if (!isPending) return false;
    } else {
      // In "Manage Post" tab, only show posts created by this moderator
      // Exclude rejected posts
      const isRejected = item.status === 'rejected' || 
                        item.status === 'cancelled' || 
                        item.status === 'disapproved';
      if (isRejected) return false;
      
      // Filter to only show posts created by the current moderator
      // Check if post was created by current user (by email or creator role)
      const isModeratorPost = !item.isCalendarEvent && (
        item.creatorRole === 'moderator' || 
        item.source === 'Moderator' || 
        item.source === 'moderator'
      );
      
      if (!isModeratorPost) return false;
      
      // Additional check: if post has creator email, match it with current user email
      // This ensures moderators only see their own posts
      // Note: We assume posts created by moderators have the creator's email stored
      // If the backend stores creator email, we can add that check here
    }
    
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
    });
  }, [allItems, activeTab, searchQuery, selectedCategory, currentUserEmail]);

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
              onPress={() => setIsSidebarOpen(true)} 
              style={styles.menuButton}
              accessibilityLabel="Open sidebar"
              activeOpacity={0.7}
            >
            <View style={styles.customHamburger} pointerEvents="none">
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
            </View>
          </TouchableOpacity>
        </View>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(17) }]} numberOfLines={1}>
              My Posts
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
        {/* Tabs Section */}
        <View style={styles.tabsContainer}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.tabsBlurView, {
              backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.6)' : 'rgba(255, 255, 255, 0.7)',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }]}
          >
              <TouchableOpacity 
              style={[
                styles.tabButton,
                activeTab === 'manage' && styles.tabButtonActive,
                activeTab === 'manage' && { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('manage');
              }}
              activeOpacity={0.7}
              >
                <Ionicons 
                name="document-text-outline" 
                size={18} 
                color={activeTab === 'manage' ? theme.colors.accent : theme.colors.textMuted} 
              />
              <Text style={[
                styles.tabButtonText,
                { 
                  color: activeTab === 'manage' ? theme.colors.accent : theme.colors.textMuted,
                  fontSize: theme.fontSize.scaleSize(14),
                  fontWeight: activeTab === 'manage' ? '700' : '500'
                }
              ]}>
                Manage Post
                </Text>
              </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'approve' && styles.tabButtonActive,
                activeTab === 'approve' && { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('approve');
              }}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="checkmark-circle-outline" 
                size={18} 
                color={activeTab === 'approve' ? theme.colors.accent : theme.colors.textMuted} 
              />
              <Text style={[
                styles.tabButtonText,
                { 
                  color: activeTab === 'approve' ? theme.colors.accent : theme.colors.textMuted,
                  fontSize: theme.fontSize.scaleSize(14),
                  fontWeight: activeTab === 'approve' ? '700' : '500'
                }
              ]}>
                Pending Approval
              </Text>
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* Filter Posts Section - Only show in Manage Post tab */}
        {activeTab === 'manage' && (
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.filterContainer, {
            backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.6)' : 'rgba(255, 255, 255, 0.7)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            marginTop: 12,
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

            {/* Creator Role Filter removed for moderators - they can only see their own posts */}
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
        )}

        {/* Posts List */}
        <View style={styles.postsContainer} collapsable={false}>
          <View style={styles.postsTitleRow}>
            <Text style={[styles.postsTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}>
              {activeTab === 'approve' 
                ? `Pending Posts (${sortedPosts.length})` 
                : `Posts & Events (${sortedPosts.length})`}
            </Text>
            {isRefreshing && (
              <View style={styles.refreshingIndicator}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <Text style={[styles.refreshingText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }]}>
                  Refreshing...
                </Text>
              </View>
            )}
          </View>
          
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
              <Ionicons 
                name={activeTab === 'approve' ? 'checkmark-circle-outline' : 'document-text-outline'} 
                size={48} 
                color={theme.colors.textMuted} 
              />
            </View>
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(18) }]}>
                {activeTab === 'approve' 
                  ? 'No pending posts' 
                  : hasActiveFilters ? 'No posts found' : 'No posts yet'}
              </Text>
            <Text style={[styles.emptyStateSubtitle, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(14) }]}>
                {activeTab === 'approve'
                  ? 'All moderator posts have been reviewed'
                  : hasActiveFilters 
                  ? 'Try adjusting your filters or search terms'
                  : 'Create your first post to get started'
                }
              </Text>
              {!hasActiveFilters && activeTab === 'manage' && (
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
              key={`${item.id}-${refreshKey}`}
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
                  // Regular post - convert to CalendarEvent format for ViewEventModal (same as AdminDashboard)
                  const eventDate = item.isoDate || item.date 
                    ? new Date(item.isoDate || item.date)
                    : new Date();
                  
                  const event: any = {
                    _id: item.id,
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    category: item.category,
                    date: item.isoDate || item.date,
                    isoDate: item.isoDate || item.date,
                    image: item.image,
                    images: item.images,
                    time: (item as any).time || undefined,
                    source: item.source,
                    creatorRole: item.creatorRole,
                  };
                  
                  setSelectedEvent(event);
                  setSelectedDateForDrawer(eventDate);
                  setSelectedDateEvents([{
                    id: item.id,
                    title: item.title,
                    color: accentColor,
                    type: item.category,
                    category: item.category,
                    description: item.description,
                    isoDate: item.isoDate || item.date,
                    date: item.isoDate || item.date,
                    time: (item as any).time || undefined,
                    image: item.image,
                    images: item.images,
                  }]);
                  setShowEventDrawer(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
            >
            <View style={[styles.postCard, {
              backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.6)' : 'rgba(255, 255, 255, 0.7)',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              opacity: isRefreshing ? 0.6 : 1,
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
                  
                    {/* Only show more options in "Manage Post" tab - "Pending Approval" tab is read-only */}
                    {!isCalendarEvent && activeTab === 'manage' && (
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
          // Only show edit/delete for posts in "Manage Post" tab (not in "Pending Approval" tab)
          // In "Pending Approval" tab, posts are read-only - no options shown
          ...(activeTab === 'manage' && activePostForOptions ? [
            {
              id: 'edit',
              label: 'Edit Post',
              icon: 'create-outline',
              iconColor: '#059669'
            },
            {
              id: 'delete',
              label: 'Delete Post',
              icon: 'trash',
              iconColor: '#DC2626',
              destructive: true
            }
          ] : [])
        ]}
        onOptionSelect={(optionId) => {
          if (activePostForOptions) {
            switch (optionId) {
              case 'edit':
                closeMoreOptionsModal();
                handleEditPost(activePostForOptions.id);
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
            // Calendar event deletion - ViewEventModal handles confirmation, just execute deletion
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
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete event');
            } finally {
              setIsDeleting(false);
            }
          } else if (event.id) {
            // Post/Update deletion - ViewEventModal handles confirmation, just execute deletion
            try {
              setIsDeleting(true);
              await AdminDataService.deletePost(event.id);
              
              // Immediately remove from context for instant UI update
              setPosts(prevPosts => prevPosts.filter((p: any) => p.id !== event.id));
              
              // Refresh dashboard data after deletion
              await fetchPosts(true);
              closeEventDrawer();
              setSelectedEvent(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete post');
            } finally {
              setIsDeleting(false);
            }
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

      {/* Creator Role Menu Modal removed for moderators */}

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

      {/* Sidebar Component */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        allowedRoles={['superadmin', 'admin', 'moderator']}
      />

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
  menuButton: {
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
  tabsContainer: {
    marginBottom: 12,
  },
  tabsBlurView: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabButtonActive: {
    borderWidth: 1,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
  postsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  postsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
    flex: 1,
  },
  refreshingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  refreshingText: {
    fontSize: 12,
    fontWeight: '500',
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

export default ModeratorPosts;
