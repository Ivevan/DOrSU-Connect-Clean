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

// Event Card with Image Preview
const TodaysEventCard = memo(({ event, onPress, theme }: { event: any; onPress: () => void; theme: any }) => {
  const imageUrl = event.images?.[0] || event.image;
  
  return (
    <Pressable style={[styles.todaysEventCardHorizontal, styles.todaysEventCardShadow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={onPress}>
      {imageUrl ? (
        <Image 
          source={{ uri: imageUrl }} 
          style={styles.todaysEventImageHorizontal}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.todaysEventImagePlaceholder, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="calendar-outline" size={40} color={theme.colors.textMuted} />
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.todaysEventGradient}
      >
        <View style={styles.todaysEventOverlayContent}>
          <View style={[styles.todaysEventTagOverlay, { backgroundColor: getTagColor(event.tag) }]}>
            <Text style={[styles.todaysEventTagText, { color: getTagTextColor(event.tag) }]}>{event.tag}</Text>
          </View>
          <Text style={styles.todaysEventTitleOverlay} numberOfLines={2}>{event.title}</Text>
          <View style={styles.todaysEventDateTimeRow}>
            <Ionicons name="calendar-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.todaysEventDateOverlay}>{event.date}</Text>
            {event.time && (
              <>
                <Text style={styles.todaysEventTimeSeparator}>•</Text>
                <Ionicons name="time-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.todaysEventDateOverlay}>{event.time}</Text>
              </>
            )}
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
});

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
  
  const [query, setQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'recent'>('all');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUpdate, setPreviewUpdate] = useState<{ title: string; date: string; time?: string; tag: string; image?: string; images?: string[]; description?: string; source?: string; pinned?: boolean; isoDate?: string } | null>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  type DashboardUpdate = { title: string; date: string; time?: string; tag: string; image?: string; images?: string[]; description?: string; source?: string; pinned?: boolean; isoDate?: string };
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

  // Today's events (category Event occurring today) - using timezone-aware comparison
  const todaysEvents = useMemo(() => {
    const todayKey = getPHDateKey(new Date());
    
    return dashboardData.recentUpdates.filter(update => {
      if (update.tag !== 'Event') return false;
      if (!update.isoDate) return false;
      
      try {
        // Use isoDate for accurate comparison (same as SchoolUpdates.tsx)
        const eventKey = getPHDateKey(update.isoDate);
        return eventKey === todayKey;
      } catch {
        return false;
      }
    });
  }, [dashboardData.recentUpdates]);

  // Upcoming updates (future dates)
  const upcomingUpdates = useMemo(() => {
    const todayKey = getPHDateKey(new Date());
    return filteredUpdates.filter(u => {
      if (!u.isoDate) return false;
      const eventKey = getPHDateKey(u.isoDate);
      return eventKey > todayKey;
    });
  }, [filteredUpdates]);

  // Recent updates (today and past dates)
  const recentUpdates = useMemo(() => {
    const todayKey = getPHDateKey(new Date());
    return filteredUpdates.filter(u => {
      if (!u.isoDate) return false;
      const eventKey = getPHDateKey(u.isoDate);
      return eventKey <= todayKey;
    });
  }, [filteredUpdates]);

  // Filtered by time (all, upcoming, or recent)
  const displayedUpdates = useMemo(() => {
    if (timeFilter === 'upcoming') return upcomingUpdates;
    if (timeFilter === 'recent') return recentUpdates;
    return filteredUpdates; // 'all'
  }, [timeFilter, upcomingUpdates, recentUpdates, filteredUpdates]);

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

  // Fetch dashboard data
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
  }, []);

  const handleUpdatePress = useCallback((update: { title: string; date: string; time?: string; tag: string; image?: string; images?: string[]; description?: string; source?: string; pinned?: boolean; isoDate?: string }) => {
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

        {/* Today's Events - Single Card Display */}
        {!isLoadingDashboard && (
          <View style={styles.todaysEventsSection}>
            <View style={styles.todaysEventsHeader}>
              <View style={[styles.sectionIconWrapper, { backgroundColor: theme.colors.accent + '15' }]}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.accent} />
              </View>
              <View style={styles.sectionTitleWrapper}>
                <Text style={[styles.todaysEventsTitle, { color: theme.colors.text }]}>Today's Events</Text>
                <Text style={[styles.todaysEventsSubtitle, { color: theme.colors.textMuted }]}>
                  {todaysEvents.length > 0 ? 'Happening now' : 'No events today'}
                </Text>
              </View>
            </View>
            {todaysEvents.length > 0 ? (
              <TodaysEventCard event={todaysEvents[0]} onPress={() => handleUpdatePress(todaysEvents[0])} theme={theme} />
            ) : (
              <View style={[styles.noEventsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <NoEventsAnimation theme={theme} />
                <Text style={[styles.noEventsText, { color: theme.colors.textMuted }]}>No events scheduled for today</Text>
              </View>
            )}
          </View>
        )}

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
          <View style={styles.sectionHeaderEnhanced}>
            <View style={[styles.sectionIconWrapper, { backgroundColor: theme.colors.accent + '15' }]}>
              <Ionicons 
                name={timeFilter === 'upcoming' ? 'time-outline' : timeFilter === 'recent' ? 'calendar-outline' : 'grid-outline'} 
                size={20} 
                color={theme.colors.accent} 
              />
            </View>
            <View style={styles.sectionTitleWrapper}>
              <Text style={[styles.sectionTitleEnhanced, { color: theme.colors.text }]}>Updates</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
                {timeFilter === 'upcoming' ? 'Coming soon' : timeFilter === 'recent' ? 'Past events' : 'All events'}
              </Text>
            </View>
          </View>

          {/* Time Filter Pills */}
          <View style={styles.filtersContainer}>
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
          
          {!isLoadingDashboard && displayedUpdates.length === 0 && !dashboardError && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Ionicons name="document-text-outline" size={40} color="#CBD5E1" />
            <Text style={{ marginTop: 6, fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' }}>
              {timeFilter === 'upcoming' ? 'No upcoming updates' : timeFilter === 'recent' ? 'No recent updates found' : 'No updates yet'}
            </Text>
              <Pressable style={styles.emptyCtaBtn} onPress={() => navigation.navigate('PostUpdate')}>
                <LinearGradient colors={[theme.colors.primary, '#1F2937']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyCtaGradient}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.emptyCtaText}>Create first update</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {!isLoadingDashboard && displayedUpdates.map((update, index) => (
            <Pressable key={index} style={[styles.updateCard, styles.cardShadow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={() => handleUpdatePress(update)}>
              {(update.images?.[0] || update.image) && (
                <Image 
                  source={{ uri: update.images?.[0] || update.image }} 
                  style={styles.updateImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.updateContentWrapper}>
                <View style={styles.updateContent}>
                  <Text style={[styles.updateTitle, { color: theme.colors.text }]}>{update.title}</Text>
                  <Text style={[styles.updateDate, { color: theme.colors.textMuted }]}>{update.date}</Text>
                </View>
                <View style={[styles.updateTag, { backgroundColor: getTagColor(update.tag) }]}>
                  <Text style={[styles.updateTagText, { color: getTagTextColor(update.tag) }]}>{update.tag}</Text>
                </View>
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
        activeTab="chat"
        onDashboardPress={() => navigation.navigate('AdminAIChat')}
        onChatPress={() => navigation.navigate('AdminDashboard')}
        onSettingsPress={() => navigation.navigate('AdminCalendar')}
        />
      </View>
    </View>
  );
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
  sectionHeaderEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
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
  filterPillActive: {
    backgroundColor: themeStyle.colors.accent,
    borderColor: 'transparent',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  updateCard: {
    flexDirection: 'column',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  updateImage: {
    width: '100%',
    height: 120,
  },
  updateContentWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  updateContent: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 6,
  },
  updateDate: {
    fontSize: 13,
    fontWeight: '600',
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
  // Today's Events Section Styles
  todaysEventsSection: {
    marginBottom: 12,
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
  noEventsCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  noEventsText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  todaysEventCardHorizontal: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0,
  },
  todaysEventCardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  todaysEventImageHorizontal: {
    width: '100%',
    height: '100%',
  },
  todaysEventImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todaysEventGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  todaysEventOverlayContent: {
    gap: 4,
  },
  todaysEventTagOverlay: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  todaysEventTitleOverlay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  todaysEventDateOverlay: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  todaysEventDateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  todaysEventTimeSeparator: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.7,
    marginHorizontal: 6,
  },
  todaysEventTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // fullscreen viewer styles removed
});

export default AdminDashboard;
