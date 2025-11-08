import * as React from 'react';
import { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Switch, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeValues, useThemeActions } from '../../contexts/ThemeContext';
import { theme as themeConfig } from '../../config/theme';
import LogoutModal from '../../modals/LogoutModal'; 

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
  UserHelpCenter: undefined;
  TermsOfUse: undefined;
  PrivacyPolicy: undefined;
  Licenses: undefined;
};

const AdminSettings = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Use split hooks to reduce re-renders
  const { isDarkMode, theme } = useThemeValues();
  const { toggleTheme } = useThemeActions();
  const scrollRef = useRef<ScrollView>(null);
  
  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);
  
  // State for various settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // Lock header height to prevent layout shifts
  const headerHeightRef = useRef<number>(64);
  const [headerHeight, setHeaderHeight] = useState(64);

  // Animation values - DISABLED FOR LAYOUT STABILITY
  const fadeAnim = useRef(new Animated.Value(1)).current; // Set to 1 (visible) immediately
  const slideAnim = useRef(new Animated.Value(0)).current; // Set to 0 (no offset) immediately

  const sheetY = useRef(new Animated.Value(300)).current;

  const openLogout = useCallback(() => {
    setIsLogoutOpen(true);
    // Wait for modal mount then animate
    setTimeout(() => {
      Animated.timing(sheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
  }, [sheetY]);

  const closeLogout = useCallback(() => {
    Animated.timing(sheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setIsLogoutOpen(false);
    });
  }, [sheetY]);

  const confirmLogout = useCallback(() => {
    closeLogout();
    navigation.navigate('GetStarted');
  }, [closeLogout, navigation]);

  // Navigation handlers for AdminBottomNavBar
  const handleDashboardPress = useCallback(() => navigation.navigate('AdminDashboard'), [navigation]);
  const handleChatPress = useCallback(() => navigation.navigate('AdminAIChat'), [navigation]);
  const handleCalendarPress = useCallback(() => navigation.navigate('AdminCalendar'), [navigation]);
  const handleSettingsPress = useCallback(() => navigation.navigate('AdminSettings'), [navigation]);
  const handlePostUpdatePress = useCallback(() => navigation.navigate('PostUpdate'), [navigation]);
  const handleManagePostPress = useCallback(() => navigation.navigate('ManagePosts'), [navigation]);
  const handleAddPress = useCallback(() => { /* future: open create flow */ }, []);

  // Navigation handlers for About section
  const handleUserHelpCenterPress = useCallback(() => navigation.navigate('UserHelpCenter'), [navigation]);
  const handleTermsOfUsePress = useCallback(() => navigation.navigate('TermsOfUse'), [navigation]);
  const handlePrivacyPolicyPress = useCallback(() => navigation.navigate('PrivacyPolicy'), [navigation]);
  const handleLicensesPress = useCallback(() => navigation.navigate('Licenses'), [navigation]);

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
        ref={scrollRef}
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
              backgroundColor: theme.colors.card,
              minHeight: 100, // Fixed minimum height to prevent layout shifts
            }
          ]}
        >
          <View style={styles.profileAvatarContainer}>
            <View style={[styles.profileAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
              <View style={styles.profileAvatarPlaceholder}>
                <Ionicons name="person" size={40} color={theme.colors.primary} />
              </View>
            </View>
            <View style={[styles.profileBadge, { backgroundColor: '#10B981' }]}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text
              style={[styles.profileName, { color: theme.colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Admin User
            </Text>
            <View style={styles.profileEmailContainer}>
              <Ionicons name="mail-outline" size={14} color={theme.colors.textMuted} />
              <Text
                style={[styles.profileEmail, { color: theme.colors.textMuted }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                admin@dorsu.edu.ph
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
          {/* App Settings */}
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>App Settings</Text>
            
            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.surface }]}>
                  <Ionicons name="moon-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Dark Mode</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={(value) => {
                  // Trigger haptic feedback immediately
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  // Toggle theme - state updates immediately, animation runs in background
                  toggleTheme();
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor={theme.colors.surface}
                // Optimize switch performance
                ios_backgroundColor={theme.colors.border}
              />
            </View>

            <View style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.surface }]}>
                  <Ionicons name="notifications-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor={notificationsEnabled ? theme.colors.surface : theme.colors.surface}
              />
            </View>
          </View>

          {/* Email Section */}
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Email</Text>
            
            <TouchableOpacity style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.surface }]}>
                  <Ionicons name="mail-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>admin@dorsu.edu.ph</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* About Section */}
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About</Text>
            
            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={handleUserHelpCenterPress}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.surface }]}>
                  <Ionicons name="help-circle-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Help Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={handleTermsOfUsePress}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.surface }]}>
                  <Ionicons name="document-text-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Terms of Use</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={handlePrivacyPolicyPress}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.surface }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={handleLicensesPress}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.surface }]}>
                  <Ionicons name="document-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Licenses</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.surface }]}>
                  <Ionicons name="information-circle-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>DOrSU Connect</Text>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textMuted }]}>v1.0.0</Text>
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
            onPress={openLogout}
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
        <AdminBottomNavBar
        activeTab="settings"
        onDashboardPress={handleDashboardPress}
        onChatPress={handleChatPress}
        onAddPress={handleAddPress}
        onCalendarPress={handleCalendarPress}
        onSettingsPress={handleSettingsPress}
        onPostUpdatePress={handlePostUpdatePress}
        onManagePostPress={handleManagePostPress}
        />
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
    backgroundColor: themeConfig.colors.surfaceAlt,
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
    backgroundColor: themeConfig.colors.primary,
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
    paddingHorizontal: themeConfig.spacing(1.5),
    paddingTop: themeConfig.spacing(2),
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
    backgroundColor: themeConfig.colors.surface,
    borderRadius: themeConfig.radii.md,
    padding: themeConfig.spacing(2.5),
    marginBottom: themeConfig.spacing(2),
    gap: themeConfig.spacing(2),
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
    borderColor: themeConfig.colors.primary + '30',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
    borderColor: themeConfig.colors.surface,
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
    color: themeConfig.colors.text,
    marginBottom: themeConfig.spacing(0.5),
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
    color: themeConfig.colors.textMuted,
    fontWeight: '400',
    minHeight: 20, // Fixed height to prevent text layout shift
  },
  settingsContainer: {
    gap: themeConfig.spacing(1.5),
  },
  sectionCard: {
    backgroundColor: themeConfig.colors.surface,
    borderRadius: themeConfig.radii.md,
    padding: themeConfig.spacing(1.5),
    ...themeConfig.shadow1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: themeConfig.colors.text,
    marginBottom: themeConfig.spacing(1.5),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeConfig.spacing(1.5),
    borderBottomWidth: 1,
    borderBottomColor: themeConfig.colors.border,
  },
  settingItemLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeConfig.spacing(1.5),
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: themeConfig.spacing(1.5),
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
    color: themeConfig.colors.text,
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
    paddingVertical: themeConfig.spacing(2.5),
    paddingHorizontal: themeConfig.spacing(3),
    borderRadius: themeConfig.radii.md,
    marginTop: themeConfig.spacing(2),
    marginBottom: 0,
    gap: themeConfig.spacing(1.5),
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default AdminSettings;
