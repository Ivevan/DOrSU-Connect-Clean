import React, { useMemo, useState, useRef, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform, ScrollView, Animated, Easing, TouchableOpacity, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import AdminSidebar from '../../components/navigation/AdminSidebar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useThemeValues } from '../../contexts/ThemeContext';
import AdminDataService from '../../services/AdminDataService';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';

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
  PostUpdate: undefined;
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

// Event Card with Image Preview (Horizontal Scrollable)
const EventCard = memo(({ update, onPress, theme }: { update: any; onPress: () => void; theme: any }) => {
  const imageUrl = update.images?.[0] || update.image;
  
  return (
    <Pressable style={[styles.eventCardHorizontal, styles.cardShadow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={onPress}>
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

const AdminDashboard = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scrollRef = useRef<ScrollView>(null);
  
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
  
  // Animated floating background orbs (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim2 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;

  // Today's events (category Event occurring today) - using timezone-aware comparison
  const todaysEvents = useMemo(() => {
    const todayKey = getPHDateKey(new Date());
    return allUpdates.filter(u => {
      if (u.tag.toLowerCase() !== 'event') return false;
      if (!u.isoDate) return false;
      const eventKey = getPHDateKey(u.isoDate);
      return eventKey === todayKey;
    });
  }, [allUpdates]);

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

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoadingDashboard(true);
        setDashboardError(null);
        
        // Fetch dashboard statistics
        const dashboardStats = await AdminDataService.getDashboard();
        
        // Fetch recent updates
        const posts = await AdminDataService.getPosts();
        const allUpdatesData = posts.map(post => ({
          id: post.id,
          title: post.title,
          date: new Date(post.date).toLocaleDateString(),
          tag: post.category,
          description: post.description,
          image: post.image,
          images: post.images,
          pinned: (post as any).pinned || false,
          isoDate: post.date,
        }));
        
        setAllUpdates(allUpdatesData);
        setDashboardData({
          recentUpdates: allUpdatesData.slice(0, 5),
        });
      } catch (err: any) {
        setDashboardError(err?.message || 'Failed to load dashboard data');
        console.error('Dashboard data fetch error:', err);
      } finally {
        setIsLoadingDashboard(false);
      }
    };

    fetchDashboardData();
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
      />
        
      {/* Blur overlay on entire background - very subtle */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint="default"
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

      {/* Header - Copilot Style */}
      <View style={[styles.header, { 
        marginTop: insets.top,
        marginLeft: insets.left,
        marginRight: insets.right,
      }]}>
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

      {/* Main Content */}
      <ScrollView 
        ref={scrollRef} 
        style={styles.content} 
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeText}>
            <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>Hello {userName},</Text>
            <Text style={[styles.welcomeSubtitle, { color: theme.colors.textMuted }]}>Here's your admin dashboard</Text>
          </View>
        </View>

        {/* Today's Events - Single Card Display */}
        {!isLoadingDashboard && !dashboardError && (
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
              <View style={[styles.eventCardContainer, { borderColor: theme.colors.border }]}>
                <BlurView
                  intensity={Platform.OS === 'ios' ? 20 : 15}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={styles.eventCardBlur}
                >
                  <View style={{ backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.5)' : 'rgba(255, 255, 255, 0.5)' }}>
                    <EventCard update={todaysEvents[0]} onPress={() => {}} theme={theme} />
                  </View>
                </BlurView>
              </View>
            ) : (
              <View style={[styles.noEventsContainer, { borderColor: theme.colors.border }]}>
                <BlurView
                  intensity={Platform.OS === 'ios' ? 20 : 15}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={styles.noEventsBlur}
                >
                  <View style={[styles.noEventsCard, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.5)' : 'rgba(255, 255, 255, 0.5)' }]}>
                    <NoEventsAnimation theme={theme} />
                    <Text style={[styles.noEventsText, { color: theme.colors.textMuted }]}>No events scheduled for today</Text>
                  </View>
                </BlurView>
              </View>
            )}
          </View>
        )}

        {/* Recent Updates Section */}
        <View style={[styles.recentUpdatesSection, { borderColor: theme.colors.border }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 20 : 15}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.updatesSectionBlur}
          >
            <View style={[styles.updatesSectionContent, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
              <View style={styles.sectionHeaderEnhanced}>
                <View style={[styles.sectionIconWrapper, { backgroundColor: theme.colors.accent + '15' }]}>
                  <Ionicons name="time-outline" size={20} color={theme.colors.accent} />
                </View>
                <View style={styles.sectionTitleWrapper}>
                  <Text style={[styles.sectionTitleEnhanced, { color: theme.colors.text }]}>Recent Updates</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>Latest posts and announcements</Text>
                </View>
              </View>

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

              {!isLoadingDashboard && !dashboardError && dashboardData.recentUpdates.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Ionicons name="document-text-outline" size={40} color={theme.colors.textMuted} />
                  <Text style={{ marginTop: 6, fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' }}>
                    No recent updates found
                  </Text>
                </View>
              )}

              {!isLoadingDashboard && !dashboardError && dashboardData.recentUpdates.map((update) => (
                <View key={update.id} style={[styles.updateCard, styles.cardShadow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  {update.images?.[0] && (
                    <Image 
                      source={{ uri: update.images[0] }} 
                      style={styles.updateImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.updateContentWrapper}>
                    <View style={styles.updateContent}>
                      <Text style={[styles.updateTitle, { color: theme.colors.text }]} numberOfLines={2}>{update.title}</Text>
                      <View style={styles.updateDateRow}>
                        <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={[styles.updateDate, { color: theme.colors.textMuted }]}>{update.date}</Text>
                      </View>
                    </View>
                    <View style={[styles.updateTag, { backgroundColor: getTagColor(update.tag) }]}>
                      <Text style={[styles.updateTagText, { color: getTagTextColor(update.tag) }]}>{update.tag}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </BlurView>
        </View>
      </ScrollView>

      <AdminBottomNavBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingBgContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
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
  },
  updatesSectionBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  updatesSectionContent: {
    padding: 12,
    borderRadius: 12,
  },
  sectionHeaderEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
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
    flexDirection: 'column',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  updateImage: {
    width: '100%',
    height: 140,
  },
  updateContentWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  updateContent: {
    flex: 1,
    marginRight: 8,
  },
  updateTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  updateDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  updateDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  updateTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  updateTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A3E7A',
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

export default AdminDashboard;