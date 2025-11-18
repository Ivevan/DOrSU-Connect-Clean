import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme as themeConfig } from '../../config/theme';
import { useThemeActions, useThemeValues } from '../../contexts/ThemeContext';
import LogoutModal from '../../modals/LogoutModal';
import AdminFileService from '../../services/AdminFileService';

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
  
  // Animated floating background orb
  const floatAnim1 = useRef(new Animated.Value(0)).current;

  // Animate floating background orb on mount
  useEffect(() => {
    const animation = Animated.loop(
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
    );
    animation.start();
    return () => animation.stop();
  }, [floatAnim1]);
  
  // State for various settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Lock header height to prevent layout shifts
  const headerHeightRef = useRef<number>(64);
  const [headerHeight, setHeaderHeight] = useState(64);

  // Animation values - DISABLED FOR LAYOUT STABILITY
  const fadeAnim = useRef(new Animated.Value(1)).current; // Set to 1 (visible) immediately
  const slideAnim = useRef(new Animated.Value(0)).current; // Set to 0 (no offset) immediately

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

  const confirmLogout = useCallback(async () => {
    try {
      // Clear all admin and user data from AsyncStorage
      await AsyncStorage.multiRemove([
        'userToken', 
        'userEmail', 
        'userName', 
        'userId', 
        'isAdmin',
        'authProvider'
      ]);
      
      closeLogout();
      navigation.navigate('GetStarted');
    } catch (error) {
      console.error('Logout error:', error);
      // Still navigate to GetStarted even if there's an error
      closeLogout();
      navigation.navigate('GetStarted');
    }
  }, [closeLogout, navigation]);

  // Navigation handlers for About section
  const handleUserHelpCenterPress = useCallback(() => navigation.navigate('UserHelpCenter'), [navigation]);
  const handleTermsOfUsePress = useCallback(() => navigation.navigate('TermsOfUse'), [navigation]);
  const handlePrivacyPolicyPress = useCallback(() => navigation.navigate('PrivacyPolicy'), [navigation]);
  const handleLicensesPress = useCallback(() => navigation.navigate('Licenses'), [navigation]);

  // File upload handler
  const handleFileUpload = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv', 'application/json'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = Array.isArray((result as any).assets) ? (result as any).assets[0] : (result as any);
      const fileName = asset.name || 'unknown';
      const fileUri = asset.uri;
      const mimeType = asset.mimeType || 'application/octet-stream';

      // Validate file extension
      const allowedExtensions = ['.txt', '.docx', '.csv', '.json'];
      const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        Alert.alert('Invalid File', `File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`);
        return;
      }

      setIsUploadingFile(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const uploadResult = await AdminFileService.uploadFile(fileUri, fileName, mimeType);

      Alert.alert(
        'Upload Successful',
        `File "${fileName}" uploaded successfully.\n\n${uploadResult.chunksAdded} chunks added to knowledge base.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Failed to upload file');
    } finally {
      setIsUploadingFile(false);
    }
  }, []);

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

      {/* Animated Floating Background Orb */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
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
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
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
  settingSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: themeConfig.spacing(1.5),
    paddingHorizontal: themeConfig.spacing(2),
    borderRadius: themeConfig.radii.md,
    marginTop: themeConfig.spacing(2),
    marginBottom: 0,
    gap: themeConfig.spacing(1),
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
});

export default AdminSettings;
