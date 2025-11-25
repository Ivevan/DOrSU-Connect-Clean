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
import { Alert, Animated, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../../components/common/BottomSheet';
import { theme as themeConfig } from '../../config/theme';
import { useThemeActions, useThemeValues } from '../../contexts/ThemeContext';
import LogoutModal from '../../modals/LogoutModal';
import AdminFileService from '../../services/AdminFileService';
import ProfileService from '../../services/ProfileService';

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
  const [isKnowledgeBaseModalOpen, setIsKnowledgeBaseModalOpen] = useState(false);
  const [adminUserPhoto, setAdminUserPhoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Lock header height to prevent layout shifts
  const headerHeightRef = useRef<number>(64);
  const [headerHeight, setHeaderHeight] = useState(64);

  // Animation values - DISABLED FOR LAYOUT STABILITY
  const fadeAnim = useRef(new Animated.Value(1)).current; // Set to 1 (visible) immediately
  const slideAnim = useRef(new Animated.Value(0)).current; // Set to 0 (no offset) immediately

  const sheetY = useRef(new Animated.Value(300)).current;
  const knowledgeBaseSheetY = useRef(new Animated.Value(300)).current;

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

  const openKnowledgeBaseModal = useCallback(() => {
    setIsKnowledgeBaseModalOpen(true);
    setTimeout(() => {
      Animated.timing(knowledgeBaseSheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
  }, [knowledgeBaseSheetY]);

  const closeKnowledgeBaseModal = useCallback(() => {
    Animated.timing(knowledgeBaseSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setIsKnowledgeBaseModalOpen(false);
    });
  }, [knowledgeBaseSheetY]);

  const confirmLogout = useCallback(async () => {
    try {
      // Clear conversation data from AsyncStorage
      await AsyncStorage.multiRemove(['adminCurrentConversation', 'adminConversationLastSaveTime']);
      
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

  // Load admin profile photo on mount and screen focus
  useEffect(() => {
    const loadAdminPhoto = async () => {
      try {
        const userPhoto = await AsyncStorage.getItem('userPhoto');
        setAdminUserPhoto(userPhoto);
      } catch (error) {
        console.error('Failed to load admin photo:', error);
      }
    };
    loadAdminPhoto();
  }, []);

  // Handle profile picture upload
  const handleProfilePictureUpload = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = Array.isArray((result as any).assets)
        ? (result as any).assets[0]
        : (result as any);

      if (!asset || !asset.uri) {
        Alert.alert('Error', 'Failed to select image');
        return;
      }

      const mime = asset.mimeType || 'image/jpeg';
      if (!mime.startsWith('image/')) {
        Alert.alert('Invalid file', 'Please select a JPEG or PNG image.');
        return;
      }

      setIsUploadingPhoto(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const fileName = asset.name || `profile_${Date.now()}.jpg`;
      const uploadResult = await ProfileService.uploadProfilePicture(
        asset.uri,
        fileName,
        mime
      );

      // Update local state
      setAdminUserPhoto(uploadResult.imageUrl);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error: any) {
      console.error('Profile picture upload error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload profile picture');
    } finally {
      setIsUploadingPhoto(false);
    }
  }, []);

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
        [{ 
          text: 'OK',
          onPress: () => {
            closeKnowledgeBaseModal();
          }
        }]
      );
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Failed to upload file');
    } finally {
      setIsUploadingFile(false);
    }
  }, [closeKnowledgeBaseModal]);


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
              colors={[theme.colors.orbColors.orange1, theme.colors.orbColors.orange2, theme.colors.orbColors.orange3]}
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

      {/* Header - Copilot Style matching AdminCalendar */}
      <View style={[styles.header, { 
        marginTop: insets.top,
        marginLeft: insets.left,
        marginRight: insets.right,
      }]}>
        <View style={styles.headerLeft} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(17) }]} pointerEvents="none">Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, {
          paddingTop: 12,
          paddingBottom: insets.bottom + 80, // Extra space for bottom navigation bar
          paddingLeft: insets.left + 16,
          paddingRight: insets.right + 16,
        }]}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled"
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
            <TouchableOpacity
              onPress={handleProfilePictureUpload}
              disabled={isUploadingPhoto}
              activeOpacity={0.7}
              style={styles.profileAvatarTouchable}
            >
              <View style={[styles.profileAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
                {isUploadingPhoto ? (
                  <View style={styles.profileAvatarPlaceholder}>
                    <Ionicons name="hourglass-outline" size={40} color={theme.colors.primary} />
                  </View>
                ) : adminUserPhoto ? (
                  <Image 
                    source={{ uri: adminUserPhoto }} 
                    style={styles.profileAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.profileAvatarPlaceholder}>
                    <Ionicons name="person" size={40} color={theme.colors.primary} />
                  </View>
                )}
              </View>
              <View style={[styles.profileBadge, { backgroundColor: '#10B981' }]}>
                {isUploadingPhoto ? (
                  <Ionicons name="hourglass-outline" size={12} color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text
              style={[styles.profileName, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(18) }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Admin User
            </Text>
            <View style={styles.profileEmailContainer}>
              <Ionicons name="mail-outline" size={14} color={theme.colors.textMuted} />
              <Text
                style={[styles.profileEmail, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(14) }]}
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
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(16) }]}>General</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => {
                navigation.navigate('AdminAccountSettings');
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(16) }]}>Account</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => {
                navigation.navigate('AdminEmailSettings');
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(16) }]}>Email</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => {
                navigation.navigate('AdminAbout');
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(16) }]}>About</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.sectionTitleButton, styles.sectionTitleButtonLast]}
              onPress={openKnowledgeBaseModal}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(16) }]}>Update</Text>
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
                marginTop: themeConfig.spacing(1.5),
              }
            ]}
            onPress={openLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={[styles.signOutText, { color: '#EF4444', fontSize: theme.fontSize.scaleSize(14) }]}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LogoutModal
        visible={isLogoutOpen}
        onClose={closeLogout}
        onConfirm={confirmLogout}
        sheetY={sheetY}
      />

      {/* Knowledge Base Upload Modal */}
      <BottomSheet
        visible={isKnowledgeBaseModalOpen}
        onClose={closeKnowledgeBaseModal}
        sheetY={knowledgeBaseSheetY}
        backgroundColor={theme.colors.surface}
        sheetPaddingBottom={0}
        autoSize={true}
      >
        <View style={styles.modalHeader}>
          <View style={styles.uploadSectionHeader}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.uploadSectionTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(16) }]}>Knowledge Base</Text>
          </View>
          <TouchableOpacity
            onPress={closeKnowledgeBaseModal}
            style={styles.modalCloseButton}
            accessibilityLabel="Close modal"
          >
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.uploadSectionDescription, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(13) }]}>
          Upload .txt, .csv, or .json files to update the knowledge base
        </Text>
        <TouchableOpacity 
          style={[
            styles.uploadButton,
            { 
              backgroundColor: isUploadingFile ? theme.colors.textMuted : theme.colors.primary,
              opacity: isUploadingFile ? 0.6 : 1,
            }
          ]}
          onPress={handleFileUpload}
          disabled={isUploadingFile}
          activeOpacity={0.7}
        >
          {isUploadingFile ? (
            <>
              <Ionicons name="hourglass-outline" size={18} color="#FFFFFF" />
              <Text style={[styles.uploadButtonText, { fontSize: theme.fontSize.scaleSize(14) }]}>Uploading...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              <Text style={[styles.uploadButtonText, { fontSize: theme.fontSize.scaleSize(14) }]}>Upload File</Text>
            </>
          )}
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeConfig.colors.surfaceAlt,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    zIndex: 10,
    // Ensure header blends with background - matches AdminCalendar
  },
  headerLeft: {
    width: 44,
    zIndex: 11,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
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
    width: 44,
    alignItems: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
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
  profileAvatarTouchable: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
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
  inlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeConfig.spacing(1.75),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    gap: themeConfig.spacing(1.5),
  },
  inlineActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: themeConfig.spacing(1.5),
    flex: 1,
  },
  inlineActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActionTitle: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  inlineActionSubtitle: {
    marginTop: 2,
    fontWeight: '400',
    letterSpacing: 0.1,
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
  signOutButtonInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: themeConfig.spacing(1.5),
    paddingHorizontal: themeConfig.spacing(2),
    borderRadius: themeConfig.radii.md,
    marginTop: themeConfig.spacing(1.5),
    marginBottom: 0,
    gap: themeConfig.spacing(1),
    borderWidth: 1,
  },
  sectionDivider: {
    height: 1,
    width: '100%',
    marginTop: themeConfig.spacing(2),
    marginBottom: 0,
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
  uploadSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: themeConfig.spacing(1),
    marginBottom: themeConfig.spacing(1),
  },
  uploadSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: themeConfig.colors.text,
  },
  uploadSectionDescription: {
    fontSize: 13,
    color: themeConfig.colors.textMuted,
    marginBottom: themeConfig.spacing(2),
    lineHeight: 18,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: themeConfig.spacing(1.5),
    paddingHorizontal: themeConfig.spacing(2),
    borderRadius: themeConfig.radii.md,
    gap: themeConfig.spacing(1),
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdminSettings;
