import * as React from 'react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform, TouchableOpacity, ScrollView, Switch, Alert, Animated, Image, InteractionManager, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../config/theme';
import { useTheme } from '../../contexts/ThemeContext';
import LogoutModal from '../../modals/LogoutModal';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
  UserHelpCenter: undefined;
  TermsOfUse: undefined;
  PrivacyPolicy: undefined;
  Licenses: undefined;
};

const UserSettings = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t, toggleTheme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scrollRef = useRef<ScrollView>(null);
  
  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);
  
  // State for various settings
  const [language, setLanguage] = useState('English');
  
  // User state from Firebase Auth - Initialize with current user to prevent layout shift
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Initialize synchronously to prevent layout shift
    try {
      return getCurrentUser();
    } catch {
      return null;
    }
  });
  
  // Get user display name and email (memoized)
  const userName = useMemo(() => currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User', [currentUser]);
  const userEmail = useMemo(() => currentUser?.email || 'No email', [currentUser]);
  const userPhoto = useMemo(() => currentUser?.photoURL || null, [currentUser]);
  
  // Lock header height to prevent layout shifts
  const headerHeightRef = useRef<number>(64);
  const [headerHeight, setHeaderHeight] = useState(64);

  // Animation values for smooth entrance - DISABLED FOR DEBUGGING
  const fadeAnim = useRef(new Animated.Value(1)).current; // Set to 1 (visible) immediately
  const slideAnim = useRef(new Animated.Value(0)).current; // Set to 0 (no offset) immediately

  // Use useFocusEffect to only update when screen is focused, preventing layout shifts during navigation
  useFocusEffect(
    useCallback(() => {
      // Subscribe to auth changes only when screen is focused
      // Use InteractionManager to defer until after navigation animation completes
      // This prevents the callback from firing immediately and causing layout shifts
      let unsubscribe: (() => void) | null = null;
      const interactionHandle = InteractionManager.runAfterInteractions(() => {
        unsubscribe = onAuthStateChange((user) => {
          // Only update if user actually changed to avoid unnecessary re-renders
          setCurrentUser(prevUser => {
            if (prevUser?.uid !== user?.uid) {
              return user;
            }
            return prevUser;
          });
        });
      });
      
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
        interactionHandle.cancel();
      };
    }, [])
  );
  
  // Function to handle logout
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const sheetY = useRef(new Animated.Value(300)).current;

  const openLogout = useCallback(() => {
    setIsLogoutOpen(true);
    setTimeout(() => {
      Animated.timing(sheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
  }, [sheetY]);

  const closeLogout = useCallback(() => {
    Animated.timing(sheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setIsLogoutOpen(false);
    });
  }, [sheetY]);

  const handleLogout = useCallback(() => openLogout(), [openLogout]);

  const confirmLogout = useCallback(() => {
    closeLogout();
    navigation.navigate('GetStarted');
  }, [closeLogout, navigation]);
  
  return (
    <View style={[styles.container, {
      backgroundColor: t.colors.background,
    }]} collapsable={false}>
      <StatusBar
        backgroundColor={t.colors.primary}
        barStyle={'light-content'}
        translucent={false}
        hidden={false}
      />

      {/* Safe Area Top Spacer - Fixed position */}
      <View style={[styles.safeAreaTop, { 
        height: safeInsets.top,
        backgroundColor: t.colors.primary,
      }]} collapsable={false} />

      {/* Header - Fixed position to prevent layout shifts */}
      <View 
        style={[styles.header, { 
          backgroundColor: t.colors.primary,
          top: safeInsets.top,
        }]}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          if (height > 0 && height !== headerHeightRef.current) {
            headerHeightRef.current = height;
            setHeaderHeight(height);
          }
        }}
        collapsable={false}
      >
        <View style={styles.headerLeft} collapsable={false}>
          <Text style={styles.headerTitle} numberOfLines={1}>Settings</Text>
        </View>
        <View style={styles.headerRight} collapsable={false}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView 
        style={[styles.scrollView, {
          marginTop: safeInsets.top + headerHeight,
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
        {/* User Profile Section - Fixed height to prevent layout shifts */}
        <View 
          style={[
            styles.profileSection,
            {
              backgroundColor: t.colors.card,
              minHeight: 100, // Fixed minimum height to prevent layout shifts
            }
          ]}
        >
          <View style={styles.profileAvatarContainer}>
            <View style={[styles.profileAvatar, { backgroundColor: t.colors.primary + '20' }]}>
              {userPhoto ? (
                <Image 
                  source={{ uri: userPhoto }} 
                  style={styles.profileAvatarImage}
                  resizeMode="cover"
                  // Prevent layout shift by loading image in background
                  onLoadStart={() => {
                    // Image is starting to load, but layout is already fixed
                  }}
                />
              ) : (
                <View style={styles.profileAvatarPlaceholder}>
                  <Ionicons name="person" size={40} color={t.colors.primary} />
                </View>
              )}
            </View>
            <View style={[styles.profileBadge, { backgroundColor: '#10B981' }]}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text 
              style={[styles.profileName, { color: t.colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {userName}
            </Text>
            <View style={styles.profileEmailContainer}>
              <Ionicons name="mail-outline" size={14} color={t.colors.textMuted} />
              <Text 
                style={[styles.profileEmail, { color: t.colors.textMuted }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {userEmail}
              </Text>
            </View>
          </View>
        </View>

        {/* Settings Categories */}
        <View 
          style={[
            styles.settingsContainer
          ]}
        >
          {/* General Section */}
          <View style={[styles.sectionCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>General</Text>
            
            <View style={[styles.settingItem, { borderBottomColor: t.colors.border }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="moon-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Dark Mode</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  toggleTheme();
                }}
                trackColor={{ false: t.colors.border, true: t.colors.accent }}
                thumbColor={t.colors.surface}
              />
            </View>

            <TouchableOpacity style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="language-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Language</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: t.colors.textMuted }]}>{language}</Text>
                <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Email Section */}
          <View style={[styles.sectionCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Email</Text>
            
            <TouchableOpacity style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="mail-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>{userEmail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* About Section */}
          <View style={[styles.sectionCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>About</Text>
            
            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: t.colors.border }]}
              onPress={() => navigation.navigate('UserHelpCenter')}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="help-circle-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Help Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: t.colors.border }]}
              onPress={() => navigation.navigate('TermsOfUse')}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="document-text-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Terms of Use</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: t.colors.border }]}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: t.colors.border }]}
              onPress={() => navigation.navigate('Licenses')}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="document-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Licenses</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="information-circle-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>DOrSU Connect</Text>
              </View>
              <Text style={[styles.settingValue, { color: t.colors.textMuted }]}>v1.0.0</Text>
            </View>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity 
            style={[
              styles.signOutButton, 
              { 
                backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
              }
            ]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={[styles.signOutText, { color: '#EF4444' }]}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar - Fixed position */}
      <View style={[styles.bottomNavContainer, {
        bottom: 0,
        paddingBottom: safeInsets.bottom,
      }]} collapsable={false}>
        <UserBottomNavBar />
      </View>

      <LogoutModal
        visible={isLogoutOpen}
        onClose={closeLogout}
        onConfirm={confirmLogout}
        sheetY={sheetY}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
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
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  scrollView: {
    flex: 1,
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
  headerSpacer: {
    width: 40,
    height: 33,
    marginLeft: 4,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing(1.5),
    paddingTop: theme.spacing(2),
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 998,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(2),
    gap: theme.spacing(2),
    minHeight: 100, // Fixed minimum height to prevent layout shifts
  },
  profileAvatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: theme.colors.primary + '30',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  profileBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileInfo: {
    flex: 1,
    alignItems: 'flex-start',
    minWidth: 0, // Prevent flex overflow
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing(0.5),
    letterSpacing: 0.2,
    minHeight: 24, // Fixed height to prevent text layout shift
  },
  profileEmailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileEmail: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '400',
    minHeight: 20, // Fixed height to prevent text layout shift
  },
  settingsContainer: {
    gap: theme.spacing(1.5),
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing(1.5),
    ...theme.shadow1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing(1.5),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(1.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingItemLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(1.5),
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing(1.5),
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '400',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing(2.5),
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.md,
    marginTop: theme.spacing(2),
    marginBottom: 0,
    gap: theme.spacing(1.5),
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default UserSettings; 