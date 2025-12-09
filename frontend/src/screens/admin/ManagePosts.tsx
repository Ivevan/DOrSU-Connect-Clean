import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import ConfirmationModal from '../../modals/ConfirmationModal';
import InfoModal from '../../modals/InfoModal';
import OptionsModal from '../../modals/OptionsModal';
import AdminDataService from '../../services/AdminDataService';

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
};

const ManagePosts: React.FC = () => {
  const navigation = useNavigation<ManagePostsNavigationProp>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const isMountedRef = useRef(true);
  const { isDarkMode, theme } = useThemeValues();
  const { isLoading: authLoading, userRole, isAdmin, refreshUser, isAuthenticated } = useAuth();
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
  const headerHeightRef = useRef<number>(64);
  const [headerHeight, setHeaderHeight] = useState(64);
  
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
  
  // Animated background orbs (Copilot-style) - Simplified
  const bgFade1 = useRef(new Animated.Value(0)).current;
  const bgFade2 = useRef(new Animated.Value(0)).current;
  
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

  // Track last fetch time
  const lastFetchTime = useRef<number>(0);
  const isFetching = useRef<boolean>(false);
  const FETCH_COOLDOWN = 1000; // 1 second cooldown

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
      }));
      setPosts(mappedPosts);
    } catch (e: any) {
      setPostsError(e?.message || 'Failed to load posts');
    } finally {
      setIsLoadingPosts(false);
      isFetching.current = false;
    }
  }, [isAuthorized]);

  // Load posts on mount
  useEffect(() => {
    fetchPosts(true); // Force refresh on mount
  }, [fetchPosts]);

  // Refresh posts when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      if (isAuthorized !== true) return;
      // Force refresh when screen comes into focus to show updated posts
      fetchPosts(true);
    }, [fetchPosts, isAuthorized])
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
      await fetchPosts(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthorized, isRefreshing, fetchPosts]);

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
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const approvedBy = await AsyncStorage.getItem('userEmail');
      const updated: any = await AdminDataService.approvePost(postId, approvedBy || undefined);
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
            status: updated.status || 'approved',
            isApproved: updated.isApproved ?? true,
            approvedAt: updated.approvedAt || new Date().toISOString(),
            approvedBy: updated.approvedBy ?? approvedBy ?? null,
          } : {
            ...p,
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
    }
  };

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
    setFilterDate('');
    setSelectedDateObj(null);
    setSelectedSort('Newest');
    setSelectedCreatorRole('all');
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || post.category === selectedCategory;
    // Filter by creator role (only if admin and filter is set)
    const matchesCreatorRole = !isAdmin || selectedCreatorRole === 'all' || 
      (selectedCreatorRole === 'admin' && (post.creatorRole === 'admin' || (!post.creatorRole && post.source !== 'Moderator'))) ||
      (selectedCreatorRole === 'moderator' && (post.creatorRole === 'moderator' || post.source === 'Moderator'));
    return matchesSearch && matchesCategory && matchesCreatorRole;
  });

  const sortedPosts = useMemo(() => {
    const sorted = [...filteredPosts];
    const parsePostDate = (dateStr: string): number => {
      if (!dateStr) return 0;
      const t = Date.parse(dateStr);
      if (!isNaN(t)) return t;
      const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) {
        const dd = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10) - 1;
        const yyyy = parseInt(m[3], 10);
        const d = new Date(yyyy, mm, dd);
        return d.getTime();
      }
      return 0;
    };
    switch (selectedSort) {
      case 'Newest':
        return sorted.sort((a, b) => parsePostDate(b.date) - parsePostDate(a.date));
      case 'Oldest':
        return sorted.sort((a, b) => parsePostDate(a.date) - parsePostDate(b.date));
      case 'Title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'Last Modified':
        // For demo purposes, using date as last modified
        return sorted.sort((a, b) => parsePostDate(b.date) - parsePostDate(a.date));
      default:
        return sorted;
    }
  }, [filteredPosts, selectedSort]);

  // Animate floating background orbs on mount
  useEffect(() => {
    const animations = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bgFade1, {
            toValue: 1,
            duration: 10000,
            useNativeDriver: true,
          }),
          Animated.timing(bgFade1, {
            toValue: 0,
            duration: 10000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bgFade2, {
            toValue: 1,
            duration: 15000,
            useNativeDriver: true,
          }),
          Animated.timing(bgFade2, {
            toValue: 0,
            duration: 15000,
            useNativeDriver: true,
          }),
        ])
      ),
    ];
    animations.forEach(anim => anim.start());
  }, []);
  
  // Measure header height immediately on layout
  useLayoutEffect(() => {
    // Set initial header height estimate
    if (headerHeightRef.current === 64) {
      // This will be updated by onLayout callback
    }
  }, []);

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
      
      {/* Simplified Animated Background */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        {/* Subtle gradient overlays */}
        <Animated.View
          style={[
            styles.gradientOverlay1,
            {
              opacity: bgFade1.interpolate({
                inputRange: [0, 1],
                outputRange: [0.15, 0.3],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={[theme.colors.orbColors.orange5, theme.colors.orbColors.orange2, 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.gradientOverlay2,
            {
              opacity: bgFade2.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1, 0.25],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', theme.colors.orbColors.orange4, theme.colors.orbColors.orange1]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>
      </View>
      
      {/* Status Bar Background Overlay */}
      <View style={[styles.statusBarOverlay, {
        height: safeInsets.top,
        backgroundColor: isDarkMode ? 'rgba(31, 31, 31, 0.95)' : 'rgba(251, 248, 243, 0.95)',
      }]} />
      
      {/* Header - Clean transparent style matching AIChat */}
      <View
        style={[styles.header, {
          backgroundColor: isDarkMode ? 'rgba(31, 31, 31, 0.95)' : 'rgba(251, 248, 243, 0.95)',
          marginTop: safeInsets.top,
          borderBottomWidth: 0,
        }]}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          // Only update if height actually changed to prevent unnecessary re-renders
          if (height > 0 && Math.abs(height - headerHeightRef.current) > 1) {
            headerHeightRef.current = height;
            setHeaderHeight(height);
          }
        }}
        collapsable={false}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => {
            if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
              navigation.goBack();
            } else {
              (navigation as any).navigate('AdminDashboard');
            }
          }} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back" accessibilityHint="Returns to the previous screen">
            <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(20) }]} numberOfLines={1}>Manage Posts</Text>
        <View style={styles.headerRight} collapsable={false}>
          <TouchableOpacity style={[styles.newButton, { backgroundColor: theme.colors.primary }]} onPress={handleNewPost}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={[styles.newButtonText, { color: '#fff', fontSize: theme.fontSize.scaleSize(13) }]}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={[styles.scrollView, {
          marginTop: 0,
        }]}
        contentContainerStyle={[styles.content, {
          paddingTop: safeInsets.top + headerHeight + 12,
          paddingBottom: 12 + safeInsets.bottom,
        }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={true}
        removeClippedSubviews={true}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={isDarkMode ? '#1F2937' : '#F9FAFB'}
          />
        }
      >

        {/* Filter Posts Section */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.filterContainer, {
            backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
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
                  selectedCreatorRole !== 'all' && { borderColor: '#10B981', backgroundColor: isDarkMode ? theme.colors.surfaceAlt : '#F0FDF4', borderWidth: 2 }
                ]} 
                onPress={() => setIsCreatorRoleOpen(true)}
              >
                <View style={styles.categoryFilterLeft}>
                  <View style={[styles.categoryFilterIconWrap, { backgroundColor: selectedCreatorRole === 'moderator' ? '#10B98122' : selectedCreatorRole === 'admin' ? '#3B82F622' : '#6B728022' }]}>
                    <Ionicons 
                      name={selectedCreatorRole === 'moderator' ? 'shield-outline' : selectedCreatorRole === 'admin' ? 'person-circle-outline' : 'people-outline'} 
                      size={16} 
                      color={selectedCreatorRole === 'moderator' ? '#10B981' : selectedCreatorRole === 'admin' ? '#3B82F6' : '#6B7280'} 
                    />
                  </View>
                  <Text 
                    style={[
                      styles.categoryText, 
                      { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) },
                      selectedCreatorRole !== 'all' && { color: selectedCreatorRole === 'moderator' ? '#10B981' : '#3B82F6', fontWeight: '700' }
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
                  color={selectedCreatorRole !== 'all' ? (selectedCreatorRole === 'moderator' ? '#10B981' : '#3B82F6') : theme.colors.textMuted} 
                />
                {selectedCreatorRole !== 'all' && (
                  <View style={[styles.activeFilterBadge, { backgroundColor: selectedCreatorRole === 'moderator' ? '#10B981' : '#3B82F6' }]}>
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
          <Text style={[styles.postsTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}>Posts ({sortedPosts.length})</Text>
          
          {isLoadingPosts && !isRefreshing ? (
            Array.from({ length: 4 }).map((_, index) => (
              <BlurView
                key={`loading-${index}`}
                intensity={Platform.OS === 'ios' ? 50 : 40}
                tint={isDarkMode ? 'dark' : 'light'}
                style={[styles.postCard, {
                  backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }]}
              />
            ))
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
              // Actual Posts
              sortedPosts.map((post) => {
                const categoryOption = CATEGORY_OPTIONS.find(o => o.key === post.category) || CATEGORY_OPTIONS[1];
                return (
            <BlurView
              key={post.id}
              intensity={Platform.OS === 'ios' ? 50 : 40}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[styles.postCard, {
                backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              }]}
            >
              <View style={styles.postHeader}>
                  <View style={styles.postTitleContainer}>
                  <Text style={[styles.postTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}>{post.title}</Text>
                    <View style={styles.tagsContainer}>
                      {post.isPinned && (
                        <View style={styles.pinnedTag}>
                          <Ionicons name="pin" size={10} color="#fff" />
                          <Text style={[styles.pinnedText, { fontSize: theme.fontSize.scaleSize(11) }]}>Pinned</Text>
                        </View>
                      )}
                      {post.isUrgent && (
                        <View style={styles.urgentTag}>
                          <Ionicons name="alert-circle" size={10} color="#fff" />
                          <Text style={[styles.urgentText, { fontSize: theme.fontSize.scaleSize(11) }]}>Urgent</Text>
                        </View>
                      )}
                      <View style={[styles.categoryTag, { backgroundColor: categoryOption.color }]}>
                        <Ionicons name={categoryOption.icon as any} size={10} color="#fff" />
                        <Text style={[styles.categoryTagText, { fontSize: theme.fontSize.scaleSize(11) }]}>{post.category}</Text>
                      </View>
                      {/* Creator Role Badge - Show for moderator posts */}
                      {(post.creatorRole === 'moderator' || post.source === 'Moderator') && (
                        <View style={[styles.categoryTag, { backgroundColor: '#10B981' }]}>
                          <Ionicons name="shield" size={10} color="#fff" />
                          <Text style={[styles.categoryTagText, { fontSize: theme.fontSize.scaleSize(11) }]}>Moderator</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.postActions}>
                  <TouchableOpacity 
                    style={styles.moreOptionsBtn} 
                    onPress={() => handleMoreOptions(post.id)}
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.postMetadata}>
                <Text style={[styles.postDate, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(13) }]}>Posted: {post.date}</Text>
                </View>
              </BlurView>
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
          ...(activePostForOptions && activePostForOptions.status !== 'approved' && !activePostForOptions.isApproved ? [{
            id: 'approve',
            label: 'Approve Post',
            icon: 'checkmark-done',
            iconColor: '#2563EB'
          }] : []),
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
                  { key: 'admin', label: 'Admin Posts', icon: 'person-circle-outline', color: '#3B82F6', description: 'Show only posts created by admins' },
                  { key: 'moderator', label: 'Moderator Posts', icon: 'shield-outline', color: '#10B981', description: 'Show only posts created by moderators' },
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
    zIndex: 0,
  },
  floatingBgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  gradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOverlay2: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeAreaTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  statusBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 998,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 12,
    minHeight: 64,
  },
  headerLeft: {
    width: 40,
    alignItems: 'flex-start',
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  headerRight: {
    width: 120,
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  content: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    marginTop: 2,
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
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoLoadingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  demoLoadingBtnActive: {
    backgroundColor: '#E8F0FF',
    borderColor: '#1976D2',
  },
  demoLoadingText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  demoLoadingTextActive: {
    color: '#1976D2',
    fontWeight: '600',
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
  },
  activeFilterContainer: {
    borderColor: '#1976D2',
    backgroundColor: '#F0F8FF',
    borderWidth: 2,
  },
  activeFilterText: {
    color: '#1976D2',
    fontWeight: '700',
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
  dateFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateFilterText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 8,
    fontWeight: '600',
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
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
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
    shadowColor: '#1976D2',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
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
    shadowColor: '#D32F2F',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  urgentText: {
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
  },
  postDate: {
    fontSize: 13,
    color: '#666',
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
  optionsCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  optionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  optionsPostHeader: {
    marginBottom: 12,
  },
  optionsPostTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  optionsChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  optionsList: {
    marginTop: 4,
  },
  optionsRowEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  optionsRowEnhancedDestructive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: '#FEF2F2',
  },
  optionsRowPressed: {
    backgroundColor: '#F9FAFB',
  },
  optionsRowPressedDestructive: {
    backgroundColor: '#FFE4E6',
  },
  optionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionsRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
  },
  optionsRowSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
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
  // Date picker styles
  dateModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  dateModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  calendarMonthYear: {
    fontSize: 16,
    fontWeight: '700',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    alignItems: 'center',
  },
  calendarWeekdayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 12,
  },
  calendarDayCell: {
    width: '14.28%',
    paddingVertical: 6,
    alignItems: 'center',
  },
  calendarDayPlaceholder: {
    width: 40,
    height: 40,
  },
  calendarDayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '700',
  },
  datePickersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  datePickerCol: {
    flex: 1,
  },
  datePickerLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
    textAlign: 'center',
  },
  datePickerList: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  datePickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  datePickerItemActive: {
    backgroundColor: '#E8F0FF',
  },
  datePickerText: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  datePickerTextActive: {
    fontWeight: '700',
    color: '#1A3E7A',
  },
  dateModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  cancelText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  primaryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  publishBtn: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  publishText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
  },
  confirmIconWrapInfo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  confirmIconWrapDanger: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 6,
  },
  confirmHint: {
    fontSize: 12,
    color: '#DC2626',
    marginBottom: 10,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  dangerBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  dangerText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  successCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 13,
    color: '#065F46',
    textAlign: 'center',
    marginBottom: 10,
  },
  successBtn: {
    width: '100%',
    backgroundColor: '#1D4ED8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  successBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  // Enhanced Success Modal Styles
  successCardEnhanced: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  successIconWrapEnhanced: {
    position: 'relative',
    marginBottom: 16,
  },
  successIconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  successIconRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#16A34A',
    opacity: 0.3,
    zIndex: 1,
  },
  successTitleEnhanced: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitleEnhanced: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  successDetails: {
    width: '100%',
    marginBottom: 24,
  },
  successDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  successDetailText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  successBtnEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  successBtnTextEnhanced: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  // Refresh Success Modal Styles
  refreshSuccessCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  refreshIconWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  refreshIconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  refreshIconRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#059669',
    opacity: 0.3,
    zIndex: 1,
  },
  refreshTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 8,
    textAlign: 'center',
  },
  refreshSubtitle: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  refreshDetails: {
    width: '100%',
    marginBottom: 24,
  },
  refreshDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  refreshDetailText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  refreshBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  // Skeleton loader styles
  skeletonTitle: {
    height: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
    width: '80%',
  },
  skeletonTag: {
    height: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    width: 60,
    marginRight: 6,
  },
  skeletonMoreBtn: {
    width: 20,
    height: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    marginBottom: 8,
  },
  
  skeletonDate: {
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    width: '40%',
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
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ManagePosts;
