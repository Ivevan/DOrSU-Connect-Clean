import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Pressable, SafeAreaView, TextInput, Image, FlatList, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AdminDataService from '../../services/AdminDataService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { theme as themeStyle } from '../../config/theme';
import { useThemeValues } from '../../contexts/ThemeContext';
import { formatDate, timeAgo } from '../../utils/dateUtils';
import PreviewModal from '../../modals/PreviewModal';

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
  PostUpdate: undefined;
  ManagePosts: undefined;
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
  
  // Lock header height to prevent layout shifts
  // Use a more accurate initial estimate based on typical header height
  const headerHeightRef = useRef<number>(56); // More accurate initial estimate (12px padding * 2 + 20px font + some spacing)
  const [headerHeight, setHeaderHeight] = useState(56);
  
  const [activeFilter, setActiveFilter] = useState<'week' | 'month' | 'semester'>('week');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUpdate, setPreviewUpdate] = useState<{ title: string; date: string; tag: string; image?: string; images?: string[]; description?: string; source?: string; pinned?: boolean } | null>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  type DashboardUpdate = { title: string; date: string; tag: string; image?: string; images?: string[]; description?: string; source?: string; pinned?: boolean };
  type DashboardData = { totalUpdates: number; pinned: number; urgent: number; recentUpdates: DashboardUpdate[] };
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalUpdates: 0,
    pinned: 0,
    urgent: 0,
    recentUpdates: [],
  });
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Animation values - DISABLED FOR PERFORMANCE DEBUGGING
  const fadeAnim = useRef(new Animated.Value(1)).current; // Set to 1 (visible) immediately
  const slideAnim = useRef(new Animated.Value(0)).current; // Set to 0 (no offset) immediately

  // Note: awaiting real data; dashboardData can be set from API by filter

  // Filter updates based on search query - memoized for performance
  const filteredUpdates = useMemo(() => {
    if (!searchQuery.trim()) return dashboardData.recentUpdates;
    const query = searchQuery.toLowerCase();
    return dashboardData.recentUpdates.filter(update =>
      update.title.toLowerCase().includes(query) ||
      update.tag.toLowerCase().includes(query)
    );
  }, [dashboardData.recentUpdates, searchQuery]);

  const handleFilterChange = useCallback((filter: 'week' | 'month' | 'semester') => {
    setActiveFilter(filter);
    setSearchQuery(''); // Clear search when filter changes
  }, []);

  // Placeholder: fetch dashboard data when filter changes
  useEffect(() => {
    let isCancelled = false;
    const fetchDashboard = async () => {
      try {
        setIsLoadingDashboard(true);
        setDashboardError(null);
        const json: DashboardData = await AdminDataService.getDashboard();
        if (!isCancelled) setDashboardData(json);
      } catch (e: any) {
        if (!isCancelled) setDashboardError(e?.message || 'Failed to load');
      } finally {
        if (!isCancelled) setIsLoadingDashboard(false);
      }
    };
    fetchDashboard();
    return () => { isCancelled = true; };
  }, [activeFilter]);

  const handleSearchPress = useCallback(() => {
    setIsSearchVisible(prev => {
      if (prev) {
        setSearchQuery(''); // Clear search when closing
      }
      return !prev;
    });
  }, []);

  const handleNotificationPress = useCallback(() => {
    // TODO: Implement notifications functionality
    setNotificationCount(0); // Clear notifications when pressed
  }, []);

  const handleUpdatePress = useCallback((update: { title: string; date: string; tag: string; image?: string; images?: string[]; description?: string; source?: string; pinned?: boolean }) => {
    // Open preview modal for all updates
    setPreviewUpdate(update);
    setActivePreviewIndex(0);
    setIsPreviewOpen(true);
  }, []);

  // Minimal shimmer component for skeletons
  const Shimmer = ({ height, borderRadius }: { height: number; borderRadius: number }) => {
    const translateX = React.useRef(new Animated.Value(-100)).current;
    useEffect(() => {
      const loop = Animated.loop(
        Animated.timing(translateX, {
          toValue: 300,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }, [translateX]);
    return (
      <View style={{ height, borderRadius, overflow: 'hidden', backgroundColor: theme.colors.surface }}>
        <Animated.View style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 120,
          transform: [{ translateX }],
        }}>
          <LinearGradient
            colors={isDarkMode ? ["rgba(255,255,255,0)", "rgba(255,255,255,0.1)", "rgba(255,255,255,0)"] : ["rgba(255,255,255,0)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={[styles.container, {
      backgroundColor: theme.colors.background,
    }]} collapsable={false}>
      <StatusBar
        backgroundColor={theme.colors.primary}
        barStyle="light-content"
        translucent={false}
        hidden={false}
      />

      {/* Safe Area Top Spacer - Fixed position */}
      <View style={[styles.safeAreaTop, {
        height: safeInsets.top,
        backgroundColor: theme.colors.primary,
      }]} collapsable={false} />

      {/* Header - Fixed position to prevent layout shifts */}
      <View
        style={[styles.header, {
          backgroundColor: theme.colors.primary,
          top: safeInsets.top,
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
        <View style={styles.headerLeft} collapsable={false}>
          <Text style={styles.headerTitle} numberOfLines={1}>DOrSU Connect</Text>
        </View>
        <View style={styles.headerRight} collapsable={false}>
          <Pressable style={styles.headerButton} onPress={handleNotificationPress}>
            <Ionicons name="notifications-outline" size={24} color="white" />
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{notificationCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.headerButton} onPress={handleSearchPress}>
            <Ionicons name={isSearchVisible ? "close-outline" : "search-outline"} size={24} color="white" />
          </Pressable>
        </View>
      </View>

      {/* Search Bar - Fixed position below header */}
      {isSearchVisible && (
        <View
          style={[styles.searchContainer, {
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.border,
            top: safeInsets.top + headerHeight,
          }]}
          collapsable={false}
        >
          <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search updates..."
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={[styles.content, {
          marginTop: safeInsets.top + headerHeight + (isSearchVisible ? 60 : 0), // Account for search bar height
          marginBottom: 0,
        }]}
        contentContainerStyle={[styles.scrollContent, {
          paddingBottom: safeInsets.bottom + 80, // Bottom nav bar height + safe area
        }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        scrollEventThrottle={16}
      >
        {/* Welcome Section */}
        <View 
          style={[
            styles.welcomeSection
          ]}
        >
          <View style={styles.welcomeText}>
            <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>Welcome back, Admin</Text>
            <Text style={[styles.welcomeSubtitle, { color: theme.colors.textMuted }]}>Here's a quick overview of today</Text>
          </View>
          <Pressable style={styles.newUpdateButton} onPress={() => navigation.navigate('PostUpdate')}>
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.newUpdateText}>New Update</Text>
          </Pressable>
        </View>

        {/* Time Period Filters */}
        <View 
          style={[
            styles.filtersContainer
          ]}
        >
          <Pressable 
            style={[styles.filterPill, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, activeFilter === 'week' && { backgroundColor: theme.colors.accent, borderColor: 'transparent' }]} 
            onPress={() => handleFilterChange('week')}
          >
            <Text style={[styles.filterPillText, { color: theme.colors.text }, activeFilter === 'week' && { color: '#fff' }]}>Week</Text>
          </Pressable>
          <Pressable 
            style={[styles.filterPill, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, activeFilter === 'month' && { backgroundColor: theme.colors.accent, borderColor: 'transparent' }]} 
            onPress={() => handleFilterChange('month')}
          >
            <Text style={[styles.filterPillText, { color: theme.colors.text }, activeFilter === 'month' && { color: '#fff' }]}>Month</Text>
          </Pressable>
          <Pressable 
            style={[styles.filterPill, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, activeFilter === 'semester' && { backgroundColor: theme.colors.accent, borderColor: 'transparent' }]} 
            onPress={() => handleFilterChange('semester')}
          >
            <Text style={[styles.filterPillText, { color: theme.colors.text }, activeFilter === 'semester' && { color: '#fff' }]}>Semester</Text>
          </Pressable>
        </View>

        {/* Stats Grid */}
        <View 
          style={[
            styles.statsGrid
          ]}
        >
          <View style={[styles.statCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: isDarkMode ? '#1E3A8A' : '#E0F2FE' }]}>
              <Ionicons name="bar-chart" size={24} color={isDarkMode ? '#60A5FA' : '#0284C7'} />
            </View>
            <Text style={[styles.statNumber, { color: isDarkMode ? '#60A5FA' : '#0284C7' }]}>{dashboardData.totalUpdates}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Total Updates</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: isDarkMode ? '#92400E' : '#FEF3C7' }]}>
              <Ionicons name="pin" size={24} color={isDarkMode ? '#FBBF24' : '#D97706'} />
            </View>
            <Text style={[styles.statNumber, { color: isDarkMode ? '#FBBF24' : '#D97706' }]}>{dashboardData.pinned}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Pinned</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: isDarkMode ? '#991B1B' : '#FEE2E2' }]}>
              <Ionicons name="alert-circle" size={24} color={isDarkMode ? '#F87171' : '#DC2626'} />
            </View>
            <Text style={[styles.statNumber, { color: isDarkMode ? '#F87171' : '#DC2626' }]}>{dashboardData.urgent}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Urgent</Text>
          </View>
        </View>

        {/* Recent Updates */}
        <View 
          style={[
            styles.recentUpdatesSection,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border
            }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Updates</Text>
          {dashboardError && (
            <Text style={{ color: '#DC2626', marginBottom: 8, fontSize: 12, fontWeight: '600' }}>{dashboardError}</Text>
          )}
          {isLoadingDashboard && (
            <View style={{ gap: 8 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <View key={`skeleton-${i}`} style={[styles.updateCard, styles.cardShadow]}>
                  <Shimmer height={44} borderRadius={10} />
                </View>
              ))}
            </View>
          )}
          
          {!isLoadingDashboard && filteredUpdates.length === 0 && !dashboardError && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Ionicons name="document-text-outline" size={40} color="#CBD5E1" />
            <Text style={{ marginTop: 6, fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' }}>No updates yet</Text>
              <Pressable style={styles.emptyCtaBtn} onPress={() => navigation.navigate('PostUpdate')}>
                <LinearGradient colors={[theme.colors.primary, '#1F2937']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyCtaGradient}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.emptyCtaText}>Create first update</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {!isLoadingDashboard && filteredUpdates.map((update, index) => (
            <Pressable key={index} style={[styles.updateCard, styles.cardShadow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={() => handleUpdatePress(update)}>
              <View style={styles.updateContent}>
                <Text style={[styles.updateTitle, { color: theme.colors.text }]}>{update.title}</Text>
                <Text style={[styles.updateDate, { color: theme.colors.textMuted }]}>{update.date}</Text>
              </View>
              <View style={[styles.updateTag, { backgroundColor: getTagColor(update.tag) }]}>
                <Text style={[styles.updateTagText, { color: getTagTextColor(update.tag) }]}>{update.tag}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      
      {/* Preview Modal */}
      <PreviewModal
        visible={isPreviewOpen}
        update={previewUpdate}
        onClose={() => setIsPreviewOpen(false)}
      />

      {/* Fullscreen viewer removed per request */}

      {/* Bottom Navigation Bar - Fixed position */}
      <View style={[styles.bottomNavContainer, {
        bottom: 0,
        paddingBottom: safeInsets.bottom,
      }]} collapsable={false}>
        <AdminBottomNavBar
        activeTab="dashboard"
        onDashboardPress={() => navigation.navigate('AdminDashboard')}
        onChatPress={() => navigation.navigate('AdminAIChat')}
        onAddPress={() => { /* future: open create flow */ }}
        onCalendarPress={() => navigation.navigate('AdminCalendar')}
        onSettingsPress={() => navigation.navigate('AdminSettings')}
        onPostUpdatePress={() => {
          navigation.navigate('PostUpdate');
        }}
        onManagePostPress={() => {
          navigation.navigate('ManagePosts');
        }}
        />
      </View>
    </View>
  );
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeStyle.colors.surfaceAlt,
  },
  safeAreaTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: themeStyle.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56, // Fixed min height to prevent layout shifts
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 4,
    position: 'relative', // Added for notification badge positioning
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 998,
  },
  searchContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 998,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  newUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeStyle.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  newUpdateText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
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
    borderWidth: 0,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  updateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  updateContent: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  updateDate: {
    fontSize: 12,
    marginTop: 2,
  },
  updateTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E8F0FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  updateTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A3E7A',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  previewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewMetaInline: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
  },
  previewCloseBtn: {
    padding: 6,
    borderRadius: 10,
  },
  previewImagePlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
  },
  previewImagePlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewBody: {
    marginBottom: 16,
  },
  previewDivider: {
    height: 1,
    marginVertical: 8,
  },
  previewUpdateTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  previewMetaRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  previewMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewUpdateDescription: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  previewSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewPrimaryBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 0,
    borderRadius: 8,
  },
  previewPrimaryGradient: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  previewButtonShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  previewPrimaryText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  pinnedRibbon: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: themeStyle.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedRibbonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  previewCarouselWrap: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  previewImagePressable: {
    width: '100%',
    height: '100%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewImageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  carouselDots: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.6,
  },
  emptyCtaBtn: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyCtaGradient: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyCtaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  // fullscreen viewer styles removed
});

export default AdminDashboard;
