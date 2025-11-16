import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../config/theme';
import { useThemeActions, useThemeValues } from '../../contexts/ThemeContext';
import LogoutModal from '../../modals/LogoutModal';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

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
  About: undefined;
  AccountSettings: undefined;
  GeneralSettings: undefined;
  EmailSettings: undefined;
};

const UserSettings = () => {
  const insets = useSafeAreaInsets();
  // Use split hooks to reduce re-renders - only subscribe to what we need
  const { isDarkMode, theme: t } = useThemeValues();
  const { toggleTheme } = useThemeActions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getUserToken } = useAuth();
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
  
  // Backend auth user data from AsyncStorage
  const [backendUserName, setBackendUserName] = useState<string | null>(null);
  const [backendUserEmail, setBackendUserEmail] = useState<string | null>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);
  
  // Load backend user data on mount and screen focus
  useFocusEffect(
    useCallback(() => {
      const loadBackendUserData = async () => {
        try {
          const userName = await AsyncStorage.getItem('userName');
          const userEmail = await AsyncStorage.getItem('userEmail');
          const userPhoto = await AsyncStorage.getItem('userPhoto');
          setBackendUserName(userName);
          setBackendUserEmail(userEmail);
          setBackendUserPhoto(userPhoto);
        } catch (error) {
          console.error('Failed to load backend user data:', error);
        }
      };
      loadBackendUserData();
    }, [])
  );
  
  // Get user display name and email (memoized) - Check backend first, then Firebase
  const userName = useMemo(() => {
    // Priority: Backend username -> Firebase displayName -> Firebase email username -> Backend email username -> Default
    if (backendUserName) return backendUserName;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    if (backendUserEmail) return backendUserEmail.split('@')[0];
    return 'User';
  }, [currentUser, backendUserName, backendUserEmail]);
  
  const userEmail = useMemo(() => {
    // Priority: Backend email -> Firebase email -> Default
    if (backendUserEmail) return backendUserEmail;
    if (currentUser?.email) return currentUser.email;
    return 'No email';
  }, [currentUser, backendUserEmail]);
  
  const userPhoto = useMemo(() => {
    // Priority: Backend photo -> Firebase photo -> Default
    if (backendUserPhoto) return backendUserPhoto;
    if (currentUser?.photoURL) return currentUser.photoURL;
    return null;
  }, [currentUser, backendUserPhoto]);
  
  // ... existing code ...
  
  // Animated floating background orbs (Copilot-style)
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

  const confirmLogout = useCallback(async () => {
    try {
      // Clear backend auth data from AsyncStorage
      await AsyncStorage.multiRemove(['userToken', 'userEmail', 'userName', 'userId', 'userPhoto', 'authProvider']);
      
      // Sign out from Firebase if user is signed in
      if (currentUser) {
        try {
          const { getFirebaseAuth } = require('../../config/firebase');
          const auth = getFirebaseAuth();
          
          // Check if using Firebase JS SDK or React Native Firebase
          const isJSSDK = auth.signOut !== undefined;
          
          if (isJSSDK) {
            // Firebase JS SDK (Web/Expo Go)
            const { signOut } = require('firebase/auth');
            await signOut(auth);
          } else {
            // React Native Firebase (Native build)
            await auth.signOut();
          }
        } catch (firebaseError) {
          console.error('Firebase sign out error:', firebaseError);
          // Continue with logout even if Firebase sign out fails
        }
      }
      
      closeLogout();
      navigation.navigate('GetStarted');
    } catch (error) {
      console.error('Logout error:', error);
      // Still navigate to GetStarted even if there's an error
      closeLogout();
      navigation.navigate('GetStarted');
    }
  }, [closeLogout, navigation, currentUser]);
  
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

        {/* Cloud Patch 1 - Top left soft light patch */}
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

        {/* Cloud Patch 2 - Bottom right gentle tone */}
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

      {/* Header - Fixed position to prevent layout shifts */}
      <View 
        style={[styles.header, { 
          backgroundColor: 'transparent',
          top: safeInsets.top,
          marginLeft: safeInsets.left,
          marginRight: safeInsets.right,
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

      <ScrollView 
        style={[styles.scrollView, {
          marginTop: safeInsets.top + 64,
          marginBottom: 0,
        }]}
        contentContainerStyle={[styles.scrollContent, {
          paddingBottom: safeInsets.bottom + 20,
        }]} 
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        scrollEventThrottle={16}
      >
        {/* User Profile Section - Fixed height to prevent layout shifts */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[
            styles.profileSection,
            {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
        </BlurView>

        {/* Settings Categories */}
        <View 
          style={[
            styles.settingsContainer
          ]}
        >
          {/* All Settings Section */}
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.sectionCard, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}
          >
            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => navigation.navigate('GeneralSettings')}
            >
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>General</Text>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => navigation.navigate('AccountSettings')}
            >
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Account</Text>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => navigation.navigate('EmailSettings')}
            >
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Email</Text>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => {
                // TODO: Navigate to feedback screen or open feedback form
              }}
            >
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Give Feedback</Text>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButtonLast}
              onPress={() => navigation.navigate('About')}
            >
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>About</Text>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
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
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={[styles.signOutText, { color: '#EF4444' }]}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
  scrollView: {
    paddingHorizontal: theme.spacing(1.5),
    paddingTop: theme.spacing(2),
  },
  scrollContent: {
    paddingHorizontal: theme.spacing(1.5),
    paddingBottom: 20,
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
    backgroundColor: 'transparent',
    borderRadius: theme.radii.md,
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(2),
    gap: theme.spacing(2),
    minHeight: 100, // Fixed minimum height to prevent layout shifts
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 0,
  },
  sectionTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(2),
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitleButtonLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(2),
    marginBottom: 0,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(1.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingItemNoBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(1.5),
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
    paddingVertical: theme.spacing(1.5),
    paddingHorizontal: theme.spacing(2),
    borderRadius: theme.radii.md,
    marginTop: theme.spacing(2),
    marginBottom: 0,
    gap: theme.spacing(1),
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
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
  lightSpot2: {
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.18,
    overflow: 'hidden',
  },
  lightSpot3: {
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.16,
    overflow: 'hidden',
  },
  floatingOrbWrapper: {
    position: 'absolute',
    width: 500,
    height: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingOrb1: {
    width: 500,
    height: 500,
    borderRadius: 250,
    opacity: 0.5,
    overflow: 'hidden',
  },
});

export default UserSettings; 