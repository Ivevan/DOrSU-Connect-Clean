import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config/api.config';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getGoogleSignInErrorMessage, signInWithGoogle } from '../../services/authService';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  AdminAIChat: undefined;
  AIChat: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'GetStarted'>;

const { width } = Dimensions.get('window');

const GetStarted = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnline = isConnected && isInternetReachable;

  // Simplified animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const googleButtonScale = useRef(new Animated.Value(1)).current;
  const signUpButtonScale = useRef(new Animated.Value(1)).current;
  const signInButtonScale = useRef(new Animated.Value(1)).current;
  const googleLoadingRotation = useRef(new Animated.Value(0)).current;
  const floatingAnimation = useRef(new Animated.Value(0)).current;
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Start floating animation on mount
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnimation, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnimation, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatingAnimation]);

  // Animation functions
  const handleLogoPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(logoGlow, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(logoGlow, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      navigation.navigate('AdminAIChat');
    });
  };

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
      
      // Save Google user data to AsyncStorage for persistence
      if (user.email) {
        await AsyncStorage.setItem('userEmail', user.email);
      }
      if (user.displayName) {
        await AsyncStorage.setItem('userName', user.displayName);
      }
      if (user.photoURL) {
        await AsyncStorage.setItem('userPhoto', user.photoURL);
      }
      // Mark as Google Sign-In user
      await AsyncStorage.setItem('authProvider', 'google');

      // Exchange Firebase ID token for backend JWT and save user to MongoDB
      let tokenExchangeSuccess = false;
      try {
        const idToken = await user.getIdToken(true);
        
        if (!idToken || typeof idToken !== 'string' || idToken.length < 100) {
          console.error('❌ GetStarted: Invalid token format received from Firebase');
          throw new Error('Invalid token format');
        }
        
        const tokenParts = idToken.split('.');
        if (tokenParts.length !== 3) {
          console.error('❌ GetStarted: Token does not appear to be a valid JWT');
          throw new Error('Invalid token format - expected JWT');
        }
        
        console.log('🔄 GetStarted: Attempting Firebase token exchange, token length:', idToken.length, 'parts:', tokenParts.length);
        
        const resp = await fetch(`${API_BASE_URL}/api/auth/firebase-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        
        const data = await resp.json();
        if (resp.ok && data?.token && data?.user?.id) {
          await AsyncStorage.setItem('userToken', data.token);
          await AsyncStorage.setItem('userId', String(data.user.id));
          await AsyncStorage.setItem('userEmail', data.user.email || user.email);
          if (data?.user?.username) {
            await AsyncStorage.setItem('userName', data.user.username);
          }
          
          tokenExchangeSuccess = true;
          console.log('✅ GetStarted: Google user saved to MongoDB and backend JWT stored', {
            userId: data.user.id,
            email: data.user.email,
            username: data.user.username
          });
        } else {
          console.error('❌ GetStarted: Firebase login exchange failed:', {
            status: resp.status,
            statusText: resp.statusText,
            error: data?.error,
            details: data?.details
          });
        }
      } catch (ex: unknown) {
        const msg = ex instanceof Error ? ex.message : String(ex);
        console.error('❌ GetStarted: Failed to exchange Firebase token:', msg);
      }
      
      if (!tokenExchangeSuccess) {
        console.warn('⚠️ Token exchange failed - chat history may not work until token is exchanged');
      }
      
      // Success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      googleLoadingRotation.stopAnimation();
      
      // Navigate based on user role
      const userEmail = user.email?.toLowerCase().trim();
      const isAdminEmail = userEmail === 'admin@dorsu.edu.ph' || userEmail === 'admin';
      
      const storedIsAdmin = await AsyncStorage.getItem('isAdmin');
      
      if (isAdminEmail || storedIsAdmin === 'true') {
        navigation.navigate('AdminAIChat');
      } else {
        navigation.navigate('AIChat');
      }
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

  const isMobile = width < 768;

  // Render content (shared between mobile and desktop)
  const renderContent = () => {
    return (
      <>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <TouchableOpacity 
            onPress={handleLogoPress}
            activeOpacity={1}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Animated.View style={{
              transform: [
                { scale: logoScale },
                { 
                  translateY: floatingAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -8],
                  })
                }
              ],
            }}>
              <Animated.View style={[
                styles.logoGlow,
                {
                  opacity: logoGlow,
                },
              ]} />
              <Image source={require('../../../../assets/DOrSU.png')} style={styles.logoImage} />
            </Animated.View>
          </TouchableOpacity>
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoTitle}>DOrSU CONNECT</Text>
            <Text style={styles.logoSubtitle}>Official University Portal</Text>
          </View>
        </View>

        {/* Welcome Text */}
        <Text style={styles.welcomeText}>Your Academic AI Assistant</Text>
        <Text style={styles.subtitleText}>Get started with DOrSU Connect</Text>

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
          
          {/* Google Sign-In Button */}
          <Animated.View style={{ transform: [{ scale: googleButtonScale }] }}>
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
          </Animated.View>
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
    <View style={styles.container}>
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent={true}
        animated={true}
      />
      
      {/* Split Screen Layout - Desktop/Tablet, Stacked - Mobile */}
      {isMobile ? (
        // Mobile Layout - Full screen form with background
        <View style={styles.mobileContainer}>
          <Image 
            source={require('../../../../assets/DOrSU_STATUE.png')} 
            style={styles.mobileBackgroundImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(101, 67, 33, 0.2)', 'rgba(139, 90, 43, 0.5)', 'rgba(101, 67, 33, 0.7)']}
            style={styles.gradientOverlay}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={[styles.mobileOverlay, { paddingTop: insets.top }]}>
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
                <View style={styles.mobileFormCard}>
                  {renderContent()}
                </View>
              </ScrollView>
            </KeyboardWrapper>
          </View>
        </View>
      ) : (
        // Desktop/Tablet Layout - Split Screen
        <View style={styles.splitContainer}>
          {/* Left Panel - Background Image with University Name */}
          <View style={styles.leftPanel}>
            <Image 
              source={require('../../../../assets/DOrSU_STATUE.png')} 
              style={styles.backgroundImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(101, 67, 33, 0.15)', 'rgba(139, 90, 43, 0.4)', 'rgba(101, 67, 33, 0.6)']}
              style={styles.gradientOverlay}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.overlay}>
              <View style={styles.universityTextContainer}>
                <Text style={styles.universityText}>DAVAO ORIENTAL STATE</Text>
                <Text style={styles.universityText}>UNIVERSITY</Text>
              </View>
              <View style={styles.portalBanner}>
                <Text style={styles.portalText}>-STUDENT PORTAL-</Text>
              </View>
            </View>
          </View>

          {/* Right Panel - Content */}
          <View style={styles.rightPanel}>
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
      )}

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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  // Left Panel Styles
  leftPanel: {
    flex: 1,
    position: 'relative',
    ...Platform.select({
      web: {
        minWidth: width * 0.5,
      },
    }),
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 2,
  },
  universityTextContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  universityText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  portalBanner: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  portalText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 1,
  },
  // Right Panel Styles
  rightPanel: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    ...Platform.select({
      web: {
        minWidth: width * 0.5,
      },
    }),
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
    marginHorizontal: 40,
    marginVertical: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      web: {
        maxWidth: 500,
        alignSelf: 'center',
        width: '100%',
      },
    }),
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
  logoGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 12,
    top: -5,
    left: -5,
  },
  logoTextContainer: {
    flex: 1,
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 2,
  },
  logoSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
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
    backgroundColor: '#FF9500',
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
  // Mobile Styles
  mobileContainer: {
    flex: 1,
    position: 'relative',
  },
  mobileBackgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  mobileOverlay: {
    flex: 1,
    zIndex: 2,
  },
  mobileFormCard: {
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
