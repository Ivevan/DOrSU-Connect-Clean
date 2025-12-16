import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../../components/common/BottomSheet';
import { theme as themeConfig } from '../../config/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeValues } from '../../contexts/ThemeContext';
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
  ActivityLog: undefined;
};

const AdminSettings = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { isDarkMode, theme } = useThemeValues();
  const { isLoading: authLoading, userRole, isAdmin, isAuthenticated } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const isPendingAuthorization = isAuthorized === null;
  const scrollRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);
  
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
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isKnowledgeBaseModalOpen, setIsKnowledgeBaseModalOpen] = useState(false);
  const [adminUserPhoto, setAdminUserPhoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [adminFirstName, setAdminFirstName] = useState<string | null>(null);
  const [adminLastName, setAdminLastName] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

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

  const { logout: authLogout } = useAuth();

  const confirmLogout = useCallback(async () => {
    try {
      // Close modal immediately (synchronously) to prevent state updates during navigation
      setIsLogoutOpen(false);
      
      // Clear conversation data from AsyncStorage
      await AsyncStorage.multiRemove(['adminCurrentConversation', 'adminConversationLastSaveTime']);
      
      // Use AuthContext logout function which handles:
      // - Clearing UpdatesContext data
      // - Resetting session flags
      // - Clearing AsyncStorage (including userToken, userEmail, userName, userId, isAdmin, adminToken, adminEmail)
      // - Signing out from Firebase
      await authLogout();
      
      // Use setTimeout to ensure state updates complete before navigation
      setTimeout(() => {
        // Reset navigation stack to prevent back navigation to authenticated screens
        navigation.reset({
          index: 0,
          routes: [{ name: 'GetStarted' }],
        });
      }, 0);
    } catch (error) {
      console.error('Logout error:', error);
      // Still reset navigation even if there's an error
      setIsLogoutOpen(false);
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'GetStarted' }],
        });
      }, 0);
    }
  }, [navigation, authLogout]);

  // Load admin profile data on mount and screen focus
  useFocusEffect(
    useCallback(() => {
      const loadAdminData = async () => {
        try {
          const userPhoto = await AsyncStorage.getItem('userPhoto');
          const firstName = await AsyncStorage.getItem('userFirstName');
          const lastName = await AsyncStorage.getItem('userLastName');
          const userName = await AsyncStorage.getItem('userName'); // Fallback for full name
          const email = await AsyncStorage.getItem('userEmail');
          setAdminUserPhoto(userPhoto);
          setAdminFirstName(firstName);
          setAdminLastName(lastName);
          setAdminEmail(email);
          
          // If firstName/lastName are not set but userName is, parse it
          if (!firstName && !lastName && userName) {
            const nameParts = userName.split(' ');
            setAdminFirstName(nameParts[0] || '');
            setAdminLastName(nameParts.slice(1).join(' ') || '');
          }
        } catch (error) {
          console.error('Failed to load admin data:', error);
        }
      };
      loadAdminData();
    }, [])
  );

  // Track mount state to prevent alerts during unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Authorization check (admins only - moderators should use UserSettings)
  useEffect(() => {
    if (authLoading) return;
    // Don't show alert if user is logging out (not authenticated), screen is not focused, or component is unmounting
    if (!isAuthenticated || !isFocused || !isMountedRef.current) {
      setIsAuthorized(false);
      return;
    }
    
    // Only admins can access AdminSettings
    if (!isAdmin) {
      setIsAuthorized(false);
      
      // Add a small delay and re-check before showing alert to prevent showing during logout
      const timeoutId = setTimeout(() => {
        // Triple-check we're still mounted, focused, and authenticated before showing alert
        if (isMountedRef.current && isFocused && isAuthenticated) {
          // If user is moderator, redirect to UserSettings
          if (userRole === 'moderator') {
            Alert.alert(
              'Access Redirected',
              'Moderators can only access the regular settings. You have been redirected to user settings.',
              [{ 
                text: 'OK', 
                onPress: () => navigation.replace('UserSettings' as any) 
              }]
            );
          } else {
            // Regular users or unauthorized
            Alert.alert(
              'Access Denied',
              'You do not have permission to access this page.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    
    setIsAuthorized(true);
  }, [authLoading, isAdmin, userRole, navigation, isAuthenticated, isFocused]);

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

  // Show loading state while checking authorization
  if (isPendingAuthorization || authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // Don't render if not authorized (will be redirected)
  if (!isAuthorized) {
    return (
      <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3' }} />
    );
  }

  return (
    <View style={[styles.container, {
      backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3',
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
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(17) }]} pointerEvents="none">Settings</Text>
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
              {adminFirstName && adminLastName 
                ? `${adminFirstName} ${adminLastName}`.trim()
                : adminFirstName || adminLastName || 'Admin User'}
            </Text>
            <View style={styles.profileEmailContainer}>
              <Ionicons name="mail-outline" size={14} color={theme.colors.textMuted} />
              <Text
                style={[styles.profileEmail, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(14) }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {adminEmail || 'admin@dorsu.edu.ph'}
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
                navigation.navigate('ActivityLog' as any);
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(16) }]}>Activity Log</Text>
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
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    zIndex: 10,
    // Ensure header blends with background - matches AdminCalendar
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
    marginLeft: 8,
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
