import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useRef, useState } from 'react';
import { Animated, BackHandler, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config/api.config';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getGoogleSignInErrorMessage, signInWithGoogle } from '../../services/authService';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  DataPrivacyConsent: { isAdmin?: boolean; userRole?: string };
  AdminAIChat: undefined;
  AIChat: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'GetStarted'>;

const GetStarted = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnline = isConnected && isInternetReachable;

  // Simplified animation values
  const googleButtonScale = useRef(new Animated.Value(1)).current;
  const signUpButtonScale = useRef(new Animated.Value(1)).current;
  const signInButtonScale = useRef(new Animated.Value(1)).current;
  const googleLoadingRotation = useRef(new Animated.Value(0)).current;
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasAuthData, setHasAuthData] = useState<boolean | null>(null);

  // Check auth status when screen focuses
  useFocusEffect(
    useCallback(() => {
      const checkAuthStatus = async () => {
        try {
          const userToken = await AsyncStorage.getItem('userToken');
          const userEmail = await AsyncStorage.getItem('userEmail');
          setHasAuthData(!!(userToken && userEmail));
        } catch (error) {
          console.error('Error checking auth status:', error);
          setHasAuthData(false);
        }
      };
      checkAuthStatus();
    }, [])
  );

  // Prevent back navigation to authenticated screens after logout
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // If no auth data, exit app on Android or prevent back on iOS
        if (hasAuthData === false) {
          if (Platform.OS === 'android') {
            BackHandler.exitApp();
            return true;
          }
          // On iOS, prevent back navigation
          return true;
        }
        // Allow default back behavior if logged in (shouldn't happen on GetStarted)
        // Also allow if we haven't checked yet (hasAuthData === null)
        return false;
      };

      if (Platform.OS === 'android') {
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
      }
    }, [hasAuthData])
  );


  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    // Check network status first
    if (!isOnline) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('No internet connection. Please check your network and try again.');
      setShowErrorModal(true);
      return;
    }

    setIsGoogleLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Start loading animation
    Animated.loop(
      Animated.timing(googleLoadingRotation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();

    Animated.timing(googleButtonScale, {
      toValue: 0.98,
      duration: 100,
      useNativeDriver: true,
    }).start();

    try {
      const user = await signInWithGoogle();
      
      // Batch AsyncStorage operations for better performance
      const storageUpdates: Array<[string, string]> = [];
      
      if (user.email) {
        storageUpdates.push(['userEmail', user.email]);
      }
      if (user.displayName) {
        storageUpdates.push(['userName', user.displayName]);
      }
      if (user.photoURL) {
        storageUpdates.push(['userPhoto', user.photoURL]);
      }
      storageUpdates.push(['authProvider', 'google']);

      // Get Firebase ID token (don't force refresh for speed)
      const idToken = await user.getIdToken(false);
      
      // Exchange token for backend JWT in parallel with storage operations
      // Use Promise.allSettled to ensure we don't block even if exchange fails
      const [storedIsAdmin] = await Promise.allSettled([
        AsyncStorage.getItem('isAdmin'),
        // Token exchange with timeout (max 3 seconds)
        Promise.race([
          (async () => {
            try {
              if (!idToken || idToken.length < 100) {
                throw new Error('Invalid token format');
              }
              
              const resp = await fetch(`${API_BASE_URL}/api/auth/firebase-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
              });
              
              const data = await resp.json();
              if (resp.ok && data?.token && data?.user?.id) {
                // Batch save backend token data
                const userRole = (data.user?.role || 'user') as 'user' | 'moderator' | 'admin' | 'superadmin';
                const adminFlag = userRole === 'admin' || userRole === 'superadmin';
                const superAdminFlag = userRole === 'superadmin';
                const backendUpdates: Array<[string, string]> = [
                  ['userToken', data.token],
                  ['userId', String(data.user.id)],
                  ['userRole', userRole],
                  ['isAdmin', adminFlag ? 'true' : 'false'],
                  ['isSuperAdmin', superAdminFlag ? 'true' : 'false'],
                ];
                if (data.user.email) {
                  backendUpdates.push(['userEmail', data.user.email]);
                }
                if (data.user.username) {
                  backendUpdates.push(['userName', data.user.username]);
                }
                await Promise.all(
                  backendUpdates.map(([key, value]) => AsyncStorage.setItem(key, value))
                );
                console.log('✅ GetStarted: Token exchange successful');
                return true;
              } else {
                throw new Error(data?.error || 'Token exchange failed');
              }
            } catch (error) {
              console.warn('⚠️ Token exchange failed:', error instanceof Error ? error.message : String(error));
              return false;
            }
          })(),
          // Timeout after 3 seconds
          new Promise<boolean>((resolve) => {
            setTimeout(() => {
              console.warn('⚠️ Token exchange timed out, continuing without backend token');
              resolve(false);
            }, 3000);
          }),
        ]),
      ]);

      // Save user data to AsyncStorage
      await Promise.all(
        storageUpdates.map(([key, value]) => AsyncStorage.setItem(key, value))
      );

      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      googleLoadingRotation.stopAnimation();
      
      // Navigate based on user role - always show consent screen on every login
      const userEmail = user.email?.toLowerCase().trim();
      const isAdminEmail = userEmail === 'admin@dorsu.edu.ph' || userEmail === 'admin';
      const adminStatus = storedIsAdmin.status === 'fulfilled' ? storedIsAdmin.value : null;
      const userRole = await AsyncStorage.getItem('userRole');
      const isAdmin = isAdminEmail || adminStatus === 'true' || userRole === 'admin' || userRole === 'superadmin' || userRole === 'moderator';
      
      // Navigate to data privacy consent screen (required on every login)
      navigation.navigate('DataPrivacyConsent', { 
        isAdmin: isAdmin, 
        userRole: userRole || 'user' 
      });
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      googleLoadingRotation.stopAnimation();
      
      const errorMsg = getGoogleSignInErrorMessage(error);
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setIsGoogleLoading(false);
      Animated.timing(googleButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleButtonPress = (scaleRef: Animated.Value, callback: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.sequence([
      Animated.timing(scaleRef, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleRef, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

  // Render content
  const renderContent = () => {
    return (
      <>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View>
            <Image source={require('../../../../assets/DOrSU.png')} style={styles.logoImage} />
          </View>
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoTitle}>DOrSU CONNECT</Text>
            <Text style={styles.logoSubtitle}>AI-Powered Academic Assistant</Text>
          </View>
        </View>

        {/* Buttons Section */}
        <View style={styles.buttonsSection}>
          {/* Sign In Button */}
          <Animated.View style={{ transform: [{ scale: signInButtonScale }] }}>
            <TouchableOpacity 
              style={[styles.actionButton, (!isOnline) && styles.actionButtonDisabled]}
              onPress={() => handleButtonPress(signInButtonScale, () => navigation.navigate('SignIn'))}
              disabled={!isOnline}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              activeOpacity={0.8}
            >
              <MaterialIcons name="login" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.actionButtonText}>SIGN IN</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Create Account Button */}
          <Animated.View style={{ transform: [{ scale: signUpButtonScale }] }}>
            <TouchableOpacity 
              style={[styles.actionButton, (!isOnline) && styles.actionButtonDisabled]}
              onPress={() => handleButtonPress(signUpButtonScale, () => navigation.navigate('CreateAccount'))}
              disabled={!isOnline}
              accessibilityRole="button"
              accessibilityLabel="Create account"
              activeOpacity={0.8}
            >
              <MaterialIcons name="person-add" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.actionButtonText}>CREATE ACCOUNT</Text>
            </TouchableOpacity>
          </Animated.View>
          
          {/* Google Sign-In Button - Temporarily Removed */}
          {/* <Animated.View style={{ transform: [{ scale: googleButtonScale }] }}>
            <TouchableOpacity 
              style={[styles.googleButton, (isGoogleLoading || !isOnline) && styles.actionButtonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading || !isOnline}
              accessibilityRole="button"
              accessibilityLabel={!isOnline ? "Sign in with Google (No internet connection)" : "Sign in with Google"}
              activeOpacity={0.8}
            >
              {isGoogleLoading ? (
                <>
                  <Animated.View style={[
                    styles.loadingSpinner,
                    {
                      transform: [{
                        rotate: googleLoadingRotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        })
                      }]
                    }
                  ]}>
                    <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
                  </Animated.View>
                  <Text style={styles.googleButtonText}>Signing in...</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="google" size={20} color="#4285F4" style={styles.buttonIcon} />
                  <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View> */}
        </View>

        {/* University Branding Section */}
        <View style={styles.universityContainer}>
          <View style={styles.universityDivider} />
          <Text style={styles.universityBrandingText}>DAVAO ORIENTAL STATE UNIVERSITY</Text>
          <Text style={styles.universitySubtext}>Empowering Minds • Connecting Futures</Text>
        </View>
      </>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent={true}
        animated={true}
      />
      
      {/* Full screen form with background */}
      <View style={styles.container}>
        <Image 
          source={require('../../../../assets/DOrSU_STATUE.png')} 
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.5)', 'rgba(29, 78, 216, 0.7)']}
          style={styles.gradientOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          <KeyboardWrapper 
            style={styles.keyboardAvoidingView}
            {...keyboardProps}
          >
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={Platform.OS === 'ios'}
            >
              <View style={styles.formCard}>
                {renderContent()}
              </View>
            </ScrollView>
          </KeyboardWrapper>
        </View>
      </View>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowErrorModal(false)}
          />
          <View style={[styles.errorModalContainer, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
            <View style={[styles.errorIconCircle, { backgroundColor: isDarkMode ? '#7F1D1D' : '#FEE2E2' }]}>
              <MaterialIcons name="error-outline" size={32} color={isDarkMode ? '#FCA5A5' : '#DC2626'} />
            </View>
            <Text style={[styles.errorModalTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>
              Sign-In Failed
            </Text>
            <Text style={[styles.errorModalMessage, { color: isDarkMode ? '#D1D5DB' : '#6B7280' }]}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={[styles.errorModalButton, { backgroundColor: isDarkMode ? '#DC2626' : '#EF4444' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowErrorModal(false);
              }}
            >
              <Text style={styles.errorModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  overlay: {
    flex: 1,
    zIndex: 2,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    margin: 16,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  // Logo Section
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoImage: {
    width: 50,
    height: 50,
    marginRight: 10,
  },
  logoTextContainer: {
    flex: 1,
  },
  logoTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 2,
    textShadowColor: 'rgba(30, 58, 138, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.5,
  },
  logoSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  // Buttons Section
  buttonsSection: {
    width: '100%',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#9CA3AF',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  loadingSpinner: {
    marginRight: 8,
  },
  // University Branding
  universityContainer: {
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  universityDivider: {
    width: 80,
    height: 2,
    backgroundColor: '#1E3A8A',
    borderRadius: 1,
    marginBottom: 6,
    opacity: 0.8,
  },
  universityBrandingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  universitySubtext: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  // Error Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  errorModalContainer: {
    borderRadius: 24,
    padding: 32,
    width: '90%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  errorModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  errorModalMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 12,
    fontWeight: '400',
  },
  errorModalButton: {
    paddingVertical: 16,
    paddingHorizontal: 56,
    borderRadius: 14,
    minWidth: 160,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  errorModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});

export default GetStarted;
