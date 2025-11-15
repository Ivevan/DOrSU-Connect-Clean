import * as React from 'react';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Switch, Alert, Animated, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  AdminAccountSettings: undefined;
  AdminGeneralSettings: undefined;
  AdminEmailSettings: undefined;
  AdminAbout: undefined;
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
  const { isDarkMode, theme } = useThemeValues();
  const { toggleTheme } = useThemeActions();
  const scrollRef = useRef<ScrollView>(null);
  
  // Animated floating background orbs
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim2 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;

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

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [floatAnim1, cloudAnim1, cloudAnim2, lightSpot1, lightSpot2, lightSpot3]);
  
  // State for various settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
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

  const confirmLogout = useCallback(() => {
    closeLogout();
    navigation.navigate('GetStarted');
  }, [closeLogout, navigation]);

  // Navigation handlers for About section
  const handleUserHelpCenterPress = useCallback(() => navigation.navigate('UserHelpCenter'), [navigation]);
  const handleTermsOfUsePress = useCallback(() => navigation.navigate('TermsOfUse'), [navigation]);
  const handlePrivacyPolicyPress = useCallback(() => navigation.navigate('PrivacyPolicy'), [navigation]);
  const handleLicensesPress = useCallback(() => navigation.navigate('Licenses'), [navigation]);

  return (
    <View style={[styles.container, {
      backgroundColor: 'transparent',
    }]} collapsable={false}>
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
      
      {/* Blur overlay on entire background */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint="default"
        style={styles.backgroundGradient}
      />

      {/* Animated Floating Background Orbs */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              transform: [
                {
                  translateY: cloudAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -30],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.cloudPatch1}>
            <LinearGradient
              colors={['rgba(255, 149, 0, 0.3)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              transform: [
                {
                  translateY: cloudAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 40],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.cloudPatch2}>
            <LinearGradient
              colors={['rgba(255, 149, 0, 0.2)', 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.lightSpot1,
            {
              transform: [
                {
                  scale: lightSpot1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255, 200, 100, 0.4)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>

      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: 'transparent',
        top: insets.top,
        marginLeft: insets.left,
        marginRight: insets.right,
      }]}
        collapsable={false}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={28} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Settings</Text>
      </View>

      <View
        style={[styles.contentContainer, {
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 20,
          paddingLeft: insets.left + 16,
          paddingRight: insets.right + 16,
        }]}
      >
        {/* User Profile Section */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[
            styles.profileSection,
            {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              minHeight: 100,
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
        </BlurView>

        {/* Settings Sections */}
        <View style={styles.settingsContainer}>
          {/* All Settings Section */}
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.sectionCard, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}
          >
            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => {
                navigation.navigate('AdminGeneralSettings');
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>General</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => {
                navigation.navigate('AdminAccountSettings');
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => {
                navigation.navigate('AdminEmailSettings');
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Email</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => {
                // TODO: Navigate to feedback screen or open feedback form
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Give Feedback</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButtonLast}
              onPress={() => {
                navigation.navigate('AdminAbout');
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </BlurView>

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
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginLeft: 8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: themeConfig.radii.md,
    padding: themeConfig.spacing(2.5),
    marginBottom: themeConfig.spacing(2),
    gap: themeConfig.spacing(2),
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
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
    minWidth: 0,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: themeConfig.colors.text,
    marginBottom: themeConfig.spacing(0.5),
    letterSpacing: 0.2,
    minHeight: 24,
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
    minHeight: 20,
  },
  settingsContainer: {
    gap: themeConfig.spacing(1.5),
  },
  sectionCard: {
    backgroundColor: 'transparent',
    borderRadius: themeConfig.radii.md,
    padding: themeConfig.spacing(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: themeConfig.colors.text,
    marginBottom: 0,
  },
  sectionTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeConfig.spacing(2),
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitleButtonLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeConfig.spacing(2),
    marginBottom: 0,
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
  cloudWrapper: {
    position: 'absolute',
  },
  cloudPatch1: {
    width: 350,
    height: 350,
    borderRadius: 175,
    opacity: 0.25,
    overflow: 'hidden',
  },
  cloudPatch2: {
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.22,
    overflow: 'hidden',
  },
  lightSpot1: {
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.2,
    overflow: 'hidden',
  },
});

export default AdminSettings;
