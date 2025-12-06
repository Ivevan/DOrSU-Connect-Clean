import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../config/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeValues } from '../../contexts/ThemeContext';
import LogoutModal from '../../modals/LogoutModal';
import { getCurrentUser, User } from '../../services/authService';
import ProfileService from '../../services/ProfileService';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scrollRef = useRef<ScrollView>(null);
  
  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);
  
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
  const [backendUserFirstName, setBackendUserFirstName] = useState<string | null>(null);
  const [backendUserLastName, setBackendUserLastName] = useState<string | null>(null);
  const [backendUserEmail, setBackendUserEmail] = useState<string | null>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  // Load backend user data on mount and screen focus
  useFocusEffect(
    useCallback(() => {
      const loadBackendUserData = async () => {
        try {
          const userName = await AsyncStorage.getItem('userName');
          const firstName = await AsyncStorage.getItem('userFirstName');
          const lastName = await AsyncStorage.getItem('userLastName');
          const userEmail = await AsyncStorage.getItem('userEmail');
          const userPhoto = await AsyncStorage.getItem('userPhoto');
          setBackendUserName(userName);
          setBackendUserFirstName(firstName);
          setBackendUserLastName(lastName);
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
    // Priority: Backend firstName + lastName -> Backend username -> Firebase displayName -> Firebase email username -> Backend email username -> Default
    if (backendUserFirstName && backendUserLastName) {
      return `${backendUserFirstName} ${backendUserLastName}`.trim();
    }
    if (backendUserName) return backendUserName;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    if (backendUserEmail) return backendUserEmail.split('@')[0];
    return 'User';
  }, [currentUser, backendUserName, backendUserFirstName, backendUserLastName, backendUserEmail]);
  
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
  
  // Animated floating background orb (Copilot-style)
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

      const maxSize = 5 * 1024 * 1024; // 5MB
      let finalUri = asset.uri;
      let finalMime = 'image/jpeg'; // Always use JPEG for better compression
      let finalFileName = `profile_${Date.now()}.jpg`;

      try {
        // Always compress images to ensure they meet size requirements
        try {
          // Dynamically import ImageManipulator (with error handling)
          let ImageManipulator: any;
          try {
            // @ts-ignore - expo-image-manipulator may not have types
            ImageManipulator = require('expo-image-manipulator');
          } catch (importError) {
            throw new Error('expo-image-manipulator module not found');
          }
          
          if (!ImageManipulator || !ImageManipulator.manipulateAsync) {
            throw new Error('expo-image-manipulator not properly loaded');
          }
          
          // Compression strategy: Progressive compression until under 5MB
          const compressionSteps = [
            { width: 1200, compress: 0.8 }, // Step 1: High quality, large size
            { width: 1000, compress: 0.7 }, // Step 2: Good quality, medium size
            { width: 800, compress: 0.6 },  // Step 3: Medium quality, smaller size
            { width: 600, compress: 0.5 },  // Step 4: Lower quality, small size
            { width: 500, compress: 0.4 },  // Step 5: Low quality, very small size
            { width: 400, compress: 0.3 },  // Step 6: Very low quality, tiny size
          ];
          
          let compressedUri = asset.uri;
          let compressionSuccessful = false;
          
          // Try each compression step until we get under 5MB
          for (const step of compressionSteps) {
            try {
              const manipResult = await ImageManipulator.manipulateAsync(
                asset.uri,
                [{ resize: { width: step.width } }],
                { 
                  compress: step.compress,
                  format: ImageManipulator.SaveFormat.JPEG 
                }
              );
              
              // Check compressed file size
              const compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
              if (compressedInfo.exists && compressedInfo.size) {
                const sizeInMB = compressedInfo.size / (1024 * 1024);
                if (compressedInfo.size <= maxSize) {
                  // Success! File is under 5MB
                  compressedUri = manipResult.uri;
                  finalMime = 'image/jpeg';
                  finalFileName = `profile_${Date.now()}.jpg`;
                  console.log(`✅ Image compressed successfully: ${(compressedInfo.size / 1024).toFixed(2)} KB (${step.width}px, ${step.compress * 100}% quality)`);
                  compressionSuccessful = true;
                  break;
                } else {
                  // Still too large, try next step
                  console.log(`⚠️ Compression step (${step.width}px, ${step.compress * 100}%) still too large: ${sizeInMB.toFixed(2)} MB`);
                }
              }
            } catch (stepError) {
              console.error(`Compression step failed:`, stepError);
              continue;
            }
          }
          
          // If compression was successful, use compressed image
          if (compressionSuccessful) {
            finalUri = compressedUri;
          } else {
            // All compression steps failed or still too large, use most aggressive compression
            console.log('⚠️ All compression steps exceeded limit, using most aggressive compression');
            const lastResort = await ImageManipulator.manipulateAsync(
              asset.uri,
              [{ resize: { width: 400 } }],
              { 
                compress: 0.3,
                format: ImageManipulator.SaveFormat.JPEG 
              }
            );
            finalUri = lastResort.uri;
            finalMime = 'image/jpeg';
            finalFileName = `profile_${Date.now()}.jpg`;
            
            // Final size check
            const finalCheck = await FileSystem.getInfoAsync(finalUri);
            if (finalCheck.exists && finalCheck.size && finalCheck.size > maxSize) {
              throw new Error('Image is too large even after maximum compression. Please select a smaller image.');
            }
          }
        } catch (compressError: any) {
          // Compression failed, check original size
          console.error('Image compression failed:', compressError);
          
          // Check if it's a module not found error
          if (compressError.message && (
            compressError.message.includes('expo-image-manipulator') || 
            compressError.message.includes('Unable to resolve') ||
            compressError.message.includes('not found')
          )) {
            console.warn('expo-image-manipulator not available, checking file size...');
            const originalInfo = await FileSystem.getInfoAsync(asset.uri);
            if (originalInfo.exists && originalInfo.size && originalInfo.size > maxSize) {
              setIsUploadingPhoto(false);
              Alert.alert(
                'Compression Unavailable',
                'Image compression is not available. Please select an image smaller than 5MB, or restart the app after installing dependencies.',
                [{ text: 'OK' }]
              );
              return;
            }
            // If original is under 5MB, continue with original
          } else {
            // Other compression errors - check original size
            const originalInfo = await FileSystem.getInfoAsync(asset.uri);
            if (originalInfo.exists && originalInfo.size && originalInfo.size > maxSize) {
              throw new Error('Image is too large and compression failed. Please select a smaller image.');
            }
            // If original is under 5MB, use it as-is
          }
        }

        // Optimistic update: Show selected image immediately
        setBackendUserPhoto(finalUri);
        await AsyncStorage.setItem('userPhoto', finalUri);

        // Upload in background
        const uploadResult = await ProfileService.uploadProfilePicture(
          finalUri,
          finalFileName,
          finalMime
        );

        // Update with server URL once upload completes
        setBackendUserPhoto(uploadResult.imageUrl);
        await AsyncStorage.setItem('userPhoto', uploadResult.imageUrl);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (uploadError: any) {
        console.error('Profile picture upload error:', uploadError);
        
        // Check if it's a file size error
        if (uploadError.message && uploadError.message.includes('5MB')) {
          Alert.alert(
            'File Too Large', 
            'The image is too large even after compression. Please select a smaller image.',
            [{ text: 'OK' }]
          );
          // Revert optimistic update
          const previousPhoto = await AsyncStorage.getItem('userPhoto');
          if (previousPhoto && previousPhoto !== finalUri) {
            setBackendUserPhoto(previousPhoto);
          } else {
            setBackendUserPhoto(null);
            await AsyncStorage.removeItem('userPhoto');
          }
        } else {
          // Keep the local image for other errors
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert(
            'Upload Warning', 
            'Image selected but upload failed. The image will be saved locally. Please try again later.',
            [{ text: 'OK' }]
          );
        }
      } finally {
        setIsUploadingPhoto(false);
      }
    } catch (error: any) {
      console.error('Profile picture selection error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to select profile picture');
      setIsUploadingPhoto(false);
    }
  }, []);


  const { logout: authLogout } = useAuth();

  const confirmLogout = useCallback(async () => {
    try {
      // Clear conversation data from AsyncStorage
      await AsyncStorage.multiRemove(['currentConversation', 'conversationLastSaveTime']);
      
      // Use AuthContext logout function which handles:
      // - Clearing UpdatesContext data
      // - Resetting session flags
      // - Clearing AsyncStorage (including userToken, userEmail, userName, userId, isAdmin, adminToken, adminEmail)
      // - Signing out from Firebase
      await authLogout();
      
      closeLogout();
      // Reset navigation stack to prevent back navigation to authenticated screens
      navigation.reset({
        index: 0,
        routes: [{ name: 'GetStarted' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Still reset navigation even if there's an error
      closeLogout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'GetStarted' }],
      });
    }
  }, [closeLogout, navigation, authLogout]);
  
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

      {/* Animated Floating Background Orb (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        {/* Orb 1 - Soft Blue Glow (Center area) */}
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
              colors={[t.colors.orbColors.orange1, t.colors.orbColors.orange2, t.colors.orbColors.orange3]}
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
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={28} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(17) }]}>Settings</Text>
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
            <TouchableOpacity
              onPress={handleProfilePictureUpload}
              disabled={isUploadingPhoto}
              activeOpacity={0.7}
              style={styles.profileAvatarTouchable}
            >
              <View style={[styles.profileAvatar, { backgroundColor: t.colors.primary + '20' }]}>
                {isUploadingPhoto ? (
                  <View style={styles.profileAvatarPlaceholder}>
                    <Ionicons name="hourglass-outline" size={40} color={t.colors.primary} />
                  </View>
                ) : userPhoto ? (
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
              style={[styles.profileName, { color: t.colors.text, fontSize: t.fontSize.scaleSize(18) }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {userName}
            </Text>
            <View style={styles.profileEmailContainer}>
              <Ionicons name="mail-outline" size={14} color={t.colors.textMuted} />
              <Text 
                style={[styles.profileEmail, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(14) }]}
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
              <Text style={[styles.sectionTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(16) }]}>General</Text>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => navigation.navigate('AccountSettings')}
            >
              <Text style={[styles.sectionTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(16) }]}>Account</Text>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButton}
              onPress={() => navigation.navigate('EmailSettings')}
            >
              <Text style={[styles.sectionTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(16) }]}>Email</Text>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionTitleButtonLast}
              onPress={() => navigation.navigate('About')}
            >
              <Text style={[styles.sectionTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(16) }]}>About</Text>
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
            <Text style={[styles.signOutText, { color: '#EF4444', fontSize: t.fontSize.scaleSize(14) }]}>Sign out</Text>
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
    zIndex: 1000,
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
  profileAvatarTouchable: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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