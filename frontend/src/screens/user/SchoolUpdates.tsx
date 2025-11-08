import React, { useMemo, useState, useRef, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform, TextInput, ScrollView, Pressable, Image, FlatList, Animated, InteractionManager, Easing, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { theme as themeStyle } from '../../config/theme';
import { useTheme } from '../../contexts/ThemeContext';
import AdminDataService from '../../services/AdminDataService';
import { formatDate, timeAgo } from '../../utils/dateUtils';
import PreviewModal from '../../modals/PreviewModal';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';

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

// Memoized Update Card Component
const UpdateCard = memo(({ update, onPress, theme }: { update: any; onPress: () => void; theme: any }) => (
  <Pressable style={[styles.updateCard, styles.cardShadow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={onPress}>
    <View style={styles.updateContent}>
      <Text style={[styles.updateTitle, { color: theme.colors.text }]}>{update.title}</Text>
      <Text style={[styles.updateDate, { color: theme.colors.textMuted }]}>{update.date}</Text>
    </View>
    <View style={[styles.updateTag, { backgroundColor: getTagColor(update.tag) }]}>
      <Text style={[styles.updateTagText, { color: getTagTextColor(update.tag) }]}>{update.tag}</Text>
    </View>
  </Pressable>
));

const SchoolUpdates = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [previewUpdate, setPreviewUpdate] = useState<{ title: string; date: string; tag: string; image?: string; images?: string[]; description?: string; source?: string; pinned?: boolean } | null>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const searchRef = useRef<TextInput>(null);

  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const userName = useMemo(() => currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User', [currentUser]);

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

  const handleUpdatePress = useCallback((update: { title: string; date: string; tag: string; image?: string; images?: string[]; description?: string; source?: string; pinned?: boolean }) => {
    // Open preview modal for all updates
    setPreviewUpdate(update);
    setActivePreviewIndex(0);
    setIsPreviewOpen(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
  }, []);

  // Fetch data from AdminDataService
  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const posts = await AdminDataService.getPosts();
        
        // Map AdminDataService posts to our component format
        const mappedUpdates = posts.map(post => ({
          id: post.id,
          title: post.title,
          body: post.description,
          date: formatDate(post.isoDate || post.date),
          isoDate: post.isoDate || post.date, // Store isoDate for accurate date comparison
          category: post.category as UpdateCategory,
          tag: post.category,
          description: post.description,
          pinned: post.isPinned,
          urgent: post.isUrgent,
          source: post.source,
          image: post.image,
          images: post.images,
          tags: [
            { label: post.category, color: getTagTextColor(post.category), bg: getTagColor(post.category) },
            ...(post.isUrgent ? [{ label: 'Urgent', color: '#8B2C2C', bg: '#FDECEC' }] : [])
          ]
        }));
        
        setUpdates(mappedUpdates);
      } catch (err: any) {
        setError(err?.message || 'Failed to load updates');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpdates();
  }, []);

  const filtered = useMemo(() => {
    return updates.filter(u => {
      const q = query.trim().toLowerCase();
      const byQuery = q.length === 0 || u.title.toLowerCase().includes(q) || u.body.toLowerCase().includes(q);
      return byQuery;
    });
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

  return (
    <View style={[styles.container, {
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
      paddingBottom: 0, // Remove bottom padding since UserBottomNavBar now handles it
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <StatusBar
        backgroundColor={theme.colors.primary}
        barStyle="light-content"
        translucent={false}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>School Updates</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerButton} onPress={handleNotificationsPress} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={24} color="white" />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={handleSearchPress}>
            <Ionicons name={isSearchVisible ? "close-outline" : "search-outline"} size={24} color="white" />
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      {isSearchVisible && (
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search updates..."
              placeholderTextColor={theme.colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus={true}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim }
            ],
          }}
        >
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
          <View style={styles.welcomeText}>
            <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>Hello {userName}, I’m DOrSU AI</Text>
            <Text style={[styles.welcomeSubtitle, { color: theme.colors.textMuted }]}>Here are your latest campus updates tailored for you</Text>
          </View>
        </View>

        {/* Filters removed */}

        {/* Totals removed */}

        {/* Today's Events */}
        <View style={[styles.recentUpdatesSection, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Today's Events</Text>

          {!isLoading && !error && todaysEvents.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Ionicons name="calendar-outline" size={28} color={theme.colors.textMuted} />
              <Text style={{ marginTop: 6, fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' }}>No events today</Text>
            </View>
          )}

          {!isLoading && !error && todaysEvents.map((update) => (
            <UpdateCard key={update.id} update={update} onPress={() => handleUpdatePress(update)} theme={theme} />
          ))}
        </View>

        {/* Recent Updates */}
        <View style={[styles.recentUpdatesSection, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Updates</Text>
          
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
          
          {!isLoading && !error && filtered.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Ionicons name="document-text-outline" size={40} color={theme.colors.textMuted} />
              <Text style={{ marginTop: 6, fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' }}>No updates found</Text>
            </View>
          )}

          {!isLoading && !error && filtered.map((update) => (
            <UpdateCard key={update.id} update={update} onPress={() => handleUpdatePress(update)} theme={theme} />
          ))}
        </View>
        </Animated.View>
      </ScrollView>
      
      {/* Preview Modal */}
      <PreviewModal
        visible={isPreviewOpen}
        update={previewUpdate}
        onClose={handleClosePreview}
      />

      <UserBottomNavBar />
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
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    marginBottom: 6,
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
    position: 'relative',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
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
  
});

export default SchoolUpdates; 