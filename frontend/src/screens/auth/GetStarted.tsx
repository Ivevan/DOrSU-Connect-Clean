import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import { Animated, Dimensions, Easing, Image, Modal, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getGoogleSignInErrorMessage, signInWithGoogle } from '../../services/authService';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  AdminDashboard: undefined;
  AdminAIChat: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'GetStarted'>;

const { width, height } = Dimensions.get('window');

const GetStarted = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useTheme();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnline = isConnected && isInternetReachable;

  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const googleButtonScale = useRef(new Animated.Value(1)).current;
  const signUpButtonScale = useRef(new Animated.Value(1)).current;
  const signInButtonScale = useRef(new Animated.Value(1)).current;
  const googleLoadingOpacity = useRef(new Animated.Value(0)).current;
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [showErrorModal, setShowErrorModal] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const floatingAnimation = useRef(new Animated.Value(0)).current;
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;
  const techFloat1 = useRef(new Animated.Value(0)).current;
  const techFloat2 = useRef(new Animated.Value(0)).current;
  const techFloat3 = useRef(new Animated.Value(0)).current;
  const techFloat4 = useRef(new Animated.Value(0)).current;
  const techFloat5 = useRef(new Animated.Value(0)).current;
  const techFloat6 = useRef(new Animated.Value(0)).current;
  const techFloat7 = useRef(new Animated.Value(0)).current;
  const techFloat8 = useRef(new Animated.Value(0)).current;
  
  // Screen transition animations - REMOVED for performance debugging

  // Start floating animation on mount
  React.useEffect(() => {
    const startFloatingAnimation = () => {
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
    };
    startFloatingAnimation();

    // Start main orb animation
    const startOrbAnimations = () => {
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
      ).start();

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
      ).start();

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
      ).start();

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
      ).start();
    };
    startOrbAnimations();

    // Start tech floating animations
    const startTechAnimations = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(techFloat1, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(techFloat1, {
            toValue: 0,
            duration: 4000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(techFloat2, {
            toValue: 1,
            duration: 3500,
            delay: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(techFloat2, {
            toValue: 0,
            duration: 3500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(techFloat3, {
            toValue: 1,
            duration: 4500,
            delay: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(techFloat3, {
            toValue: 0,
            duration: 4500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Additional floating elements
      Animated.loop(
        Animated.sequence([
          Animated.timing(techFloat4, {
            toValue: 1,
            duration: 3800,
            delay: 500,
            useNativeDriver: true,
          }),
          Animated.timing(techFloat4, {
            toValue: 0,
            duration: 3800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(techFloat5, {
            toValue: 1,
            duration: 4200,
            delay: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(techFloat5, {
            toValue: 0,
            duration: 4200,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(techFloat6, {
            toValue: 1,
            duration: 3600,
            delay: 2500,
            useNativeDriver: true,
          }),
          Animated.timing(techFloat6, {
            toValue: 0,
            duration: 3600,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(techFloat7, {
            toValue: 1,
            duration: 4800,
            delay: 800,
            useNativeDriver: true,
          }),
          Animated.timing(techFloat7, {
            toValue: 0,
            duration: 4800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(techFloat8, {
            toValue: 1,
            duration: 3200,
            delay: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(techFloat8, {
            toValue: 0,
            duration: 3200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    startTechAnimations();
  }, []);

  // Animation functions
  const handleLogoPress = () => {
    // Haptic feedback for logo press (admin access)
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
    
    Animated.parallel([
      Animated.timing(googleButtonScale, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(googleLoadingOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const user = await signInWithGoogle();
      
      // Save Google user data to AsyncStorage for persistence
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
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
      // This ensures Google users are treated exactly like regular accounts
      // The backend will create/find the user in MongoDB and return a backend JWT
      let tokenExchangeSuccess = false;
      try {
        // Force refresh the token to ensure it's valid
        const idToken = await user.getIdToken(true);
        
        // Validate token format before sending
        if (!idToken || typeof idToken !== 'string' || idToken.length < 100) {
          console.error('❌ GetStarted: Invalid token format received from Firebase');
          throw new Error('Invalid token format');
        }
        
        // Check if token looks like a JWT (has 3 parts separated by dots)
        const tokenParts = idToken.split('.');
        if (tokenParts.length !== 3) {
          console.error('❌ GetStarted: Token does not appear to be a valid JWT');
          throw new Error('Invalid token format - expected JWT');
        }
        
        console.log('🔄 GetStarted: Attempting Firebase token exchange, token length:', idToken.length, 'parts:', tokenParts.length);
        
        const { API_BASE_URL } = require('../../config/api.config');
        const resp = await fetch(`${API_BASE_URL}/api/auth/firebase-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        
        const data = await resp.json();
        if (resp.ok && data?.token && data?.user?.id) {
          // Store backend JWT token (same as regular account creation)
          await AsyncStorage.setItem('userToken', data.token);
          
          // Store MongoDB userId from backend response (CRITICAL - same as CreateAccount.tsx)
          // This ensures Google users are saved to MongoDB just like regular users
          await AsyncStorage.setItem('userId', String(data.user.id));
          
          // Store user info from backend response
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
          // Don't throw here - we'll still navigate, but chat history might not work
        }
      } catch (ex: unknown) {
        const msg = ex instanceof Error ? ex.message : String(ex);
        console.error('❌ GetStarted: Failed to exchange Firebase token:', msg);
        // Don't throw here - we'll still navigate, but chat history might not work
      }
      
      // If token exchange failed, show a warning but still allow navigation
      // The AuthContext will try to exchange the token again on mount
      if (!tokenExchangeSuccess) {
        console.warn('⚠️ Token exchange failed - chat history may not work until token is exchanged');
      }
      
      // Note: AuthContext will pick up the Firebase user via checkAuthStatus() 
      // which is called on mount, ensuring getUserToken() can work properly
      
      // Success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate based on user role - check if admin email
      const userEmail = user.email?.toLowerCase().trim();
      const isAdminEmail = userEmail === 'admin@dorsu.edu.ph' || userEmail === 'admin';
      
      // Check AsyncStorage for admin status (set during token exchange if applicable)
      const storedIsAdmin = await AsyncStorage.getItem('isAdmin');
      
      if (isAdminEmail || storedIsAdmin === 'true') {
        // Navigate to Admin AI Chat
        navigation.navigate('AdminAIChat');
      } else {
        // Navigate to regular user AI Chat
        navigation.navigate('AIChat');
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      const errorMsg = getGoogleSignInErrorMessage(error);
      
      // Show styled error modal instead of Alert
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setIsGoogleLoading(false);
      Animated.parallel([
        Animated.timing(googleButtonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(googleLoadingOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleButtonPress = (scaleRef: Animated.Value, callback: () => void) => {
    // Haptic feedback for button press
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

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        translucent={true}
        animated={true}
      />
      
      {/* Background Gradient Layer */}
      <LinearGradient
        colors={[
          isDarkMode ? '#0B1220' : '#FBF8F3',
          isDarkMode ? '#111827' : '#F8F5F0',
          isDarkMode ? '#1F2937' : '#F5F2ED'
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

        {/* Orb 1 - Soft Orange Glow */}
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
      
      <View style={[
        styles.content,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}>
        {/* Logo Section */}
        <View style={styles.topSection}>
          <View
            accessibilityRole="image"
            accessibilityLabel="DOrSU Connect logo"
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
              {/* Glow Effect */}
              <Animated.View style={[
                styles.logoGlow,
                {
                  opacity: logoGlow,
                },
              ]} />
              
              <Image source={require('../../../../assets/DOrSU.png')} style={styles.logoImage} />
              
              {/* Animated sparkles around logo */}
              <View style={styles.sparkleContainer}>
                <Animated.View style={[styles.sparkle, styles.sparkle1, {
                  opacity: floatingAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 0.8, 0.3],
                  }),
                  transform: [{
                    scale: floatingAnimation.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.8, 1.2, 0.8],
                    })
                  }]
                }]} />
                <Animated.View style={[styles.sparkle, styles.sparkle2, {
                  opacity: floatingAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.5, 1, 0.5],
                  }),
                  transform: [{
                    scale: floatingAnimation.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 0.8, 1],
                    })
                  }]
                }]} />
                <Animated.View style={[styles.sparkle, styles.sparkle3, {
                  opacity: floatingAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.4, 0.9, 0.4],
                  }),
                  transform: [{
                    scale: floatingAnimation.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.9, 1.1, 0.9],
                    })
                  }]
                }]} />
              </View>
            </Animated.View>
          </View>
          <Text 
            style={[styles.title, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}
            accessibilityRole="header"
          >
            DOrSU CONNECT
          </Text>
          <Text 
            style={[styles.subtitle, { color: isDarkMode ? '#E5E7EB' : '#374151' }]}
            accessibilityRole="text"
          >
            Your Academic AI Assistant
          </Text>
          <Text 
            style={[styles.aiText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}
            accessibilityRole="text"
          >
            AI Powered
          </Text>
        </View>

        {/* Buttons Section */}
        <View style={styles.buttonsSection}>
          <View style={styles.buttonContainer}>
            {/* Sign In Button */}
            <Animated.View style={{ transform: [{ scale: signInButtonScale }] }}>
              <TouchableOpacity 
                style={styles.darkButton} 
                onPress={() => handleButtonPress(signInButtonScale, () => navigation.navigate('SignIn'))}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                accessibilityHint="Double tap to sign in to your DOrSU Connect account"
                accessibilityState={{ disabled: false }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 80 : 60}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={styles.buttonBlur}
                >
                  <View style={[
                    styles.buttonContent,
                    { backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(31, 41, 55, 0.15)' }
                  ]}>
                    <MaterialIcons name="login" size={24} color={isDarkMode ? '#60A5FA' : '#1F2937'} style={styles.buttonIcon} />
                    <Text style={[styles.darkButtonText, { color: isDarkMode ? '#E5E7EB' : '#1F2937' }]}>Sign In</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            </Animated.View>

            {/* Create Account Button */}
            <Animated.View style={{ transform: [{ scale: signUpButtonScale }] }}>
              <TouchableOpacity 
                style={styles.darkButton} 
                onPress={() => handleButtonPress(signUpButtonScale, () => navigation.navigate('CreateAccount'))}
                accessibilityRole="button"
                accessibilityLabel="Create account"
                accessibilityHint="Double tap to create a new DOrSU Connect account"
                accessibilityState={{ disabled: false }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 80 : 60}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={styles.buttonBlur}
                >
                  <View style={[
                    styles.buttonContent,
                    { backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(31, 41, 55, 0.15)' }
                  ]}>
                    <MaterialIcons name="person-add" size={24} color={isDarkMode ? '#60A5FA' : '#1F2937'} style={styles.buttonIcon} />
                    <Text style={[styles.darkButtonText, { color: isDarkMode ? '#E5E7EB' : '#1F2937' }]}>Create Account</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
            
            {/* Google Sign-In Button */}
            <Animated.View style={{ transform: [{ scale: googleButtonScale }] }}>
              <TouchableOpacity 
                style={styles.googleButton} 
                onPress={handleGoogleSignIn}
                disabled={isGoogleLoading || !isOnline}
                accessibilityRole="button"
                accessibilityLabel={!isOnline ? "Sign in with Google (No internet connection)" : "Sign in with Google"}
                accessibilityHint="Double tap to sign in with your Google account"
                accessibilityState={{ disabled: isGoogleLoading || !isOnline }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 80 : 60}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={styles.buttonBlur}
                >
                  <View style={[
                    styles.buttonContent,
                    { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.6)' }
                  ]}>
                    {!isGoogleLoading ? (
                      <>
                        <MaterialCommunityIcons name="google" size={24} color="#4285F4" style={styles.buttonIcon} />
                        <Text style={[styles.googleButtonText, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Continue with Google</Text>
                      </>
                    ) : (
                      <>
                        <Animated.View style={{ opacity: googleLoadingOpacity }}>
                          <MaterialCommunityIcons name="google" size={24} color="#4285F4" style={styles.buttonIcon} />
                        </Animated.View>
                        <Text style={[styles.googleButtonText, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Signing in...</Text>
                      </>
                    )}
                  </View>
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
        
        {/* University Branding Section */}
        <View style={styles.universityContainer}>
          <View style={styles.universityDivider} />
          <Text 
            style={[styles.universityText, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}
            accessibilityRole="text"
          >
            Davao Oriental State University
          </Text>
          <Text 
            style={[styles.universitySubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}
            accessibilityRole="text"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Empowering Minds • Connecting Futures
          </Text>
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
          <BlurView
            intensity={Platform.OS === 'ios' ? 80 : 60}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.errorModalBlur}
          >
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
          </BlurView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  // Floating background orbs container (Copilot-style)
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
  cloudWrapper: {
    position: 'absolute',
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
  floatingOrb1: {
    width: 500,
    height: 500,
    borderRadius: 250,
    opacity: 0.5,
    overflow: 'hidden',
  },
  techOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.4,
  },
  // Circuit-like lines
  techLine1: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    width: width * 0.3,
    height: 2,
    backgroundColor: '#2196F3',
    opacity: 0.6,
    transform: [{ rotate: '15deg' }],
  },
  techLine2: {
    position: 'absolute',
    top: '25%',
    right: '15%',
    width: width * 0.25,
    height: 2,
    backgroundColor: '#2196F3',
    opacity: 0.5,
    transform: [{ rotate: '-20deg' }],
  },
  techLine3: {
    position: 'absolute',
    bottom: '30%',
    left: '20%',
    width: width * 0.4,
    height: 2,
    backgroundColor: '#2196F3',
    opacity: 0.55,
    transform: [{ rotate: '10deg' }],
  },
  // Floating tech dots
  techDot1: {
    position: 'absolute',
    top: '20%',
    left: '25%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2196F3',
    opacity: 0.7,
  },
  techDot2: {
    position: 'absolute',
    top: '35%',
    right: '30%',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#2196F3',
    opacity: 0.6,
  },
  techDot3: {
    position: 'absolute',
    top: '45%',
    left: '15%',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#2196F3',
    opacity: 0.65,
  },
  techDot4: {
    position: 'absolute',
    bottom: '25%',
    right: '20%',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#2196F3',
    opacity: 0.6,
  },
  techDot5: {
    position: 'absolute',
    bottom: '40%',
    left: '70%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2196F3',
    opacity: 0.55,
  },
  techDot6: {
    position: 'absolute',
    top: '60%',
    right: '10%',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2196F3',
    opacity: 0.7,
  },
  // Grid pattern
  gridPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
  },
  // Animated floating tech elements
  techFloatElement1: {
    position: 'absolute',
    top: '30%',
    left: '40%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  techFloatElement2: {
    position: 'absolute',
    top: '65%',
    right: '35%',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
  },
  techFloatElement3: {
    position: 'absolute',
    bottom: '35%',
    left: '60%',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2196F3',
  },
  techFloatElement4: {
    position: 'absolute',
    top: '40%',
    right: '25%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  techFloatElement5: {
    position: 'absolute',
    top: '70%',
    left: '25%',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
  },
  techFloatElement6: {
    position: 'absolute',
    top: '15%',
    right: '45%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2196F3',
  },
  techFloatElement7: {
    position: 'absolute',
    bottom: '20%',
    right: '40%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  techFloatElement8: {
    position: 'absolute',
    top: '55%',
    left: '45%',
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#2196F3',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 32,
    paddingBottom: Platform.OS === 'android' ? 32 : 48,
    justifyContent: 'flex-start',
  },
  topSection: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 16,
    minHeight: height * 0.4,
  },
  logoImage: {
    width: width * 0.28,
    height: width * 0.28,
    marginBottom: 24,
    resizeMode: 'contain',
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  logoGlow: {
    position: 'absolute',
    width: width * 0.32,
    height: width * 0.32,
    borderRadius: width * 0.16,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 12,
    top: -width * 0.02,
    left: -width * 0.02,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  aiText: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  buttonsSection: {
    width: '100%',
    paddingHorizontal: 8,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  bottomSection: {
    width: '100%',
    paddingHorizontal: 8,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  googleButton: {
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  darkButton: {
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonBlur: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonContent: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    borderRadius: 16,
    minHeight: 56,
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  darkButtonText: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  buttonIcon: {
    marginRight: 8,
  },
  universityContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginTop: 'auto',
  },
  universityDivider: {
    width: 80,
    height: 2,
    backgroundColor: '#FF9500',
    borderRadius: 1,
    marginBottom: 16,
    opacity: 0.8,
  },
  universityText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 24,
    marginBottom: 8,
  },
  universitySubtext: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.6,
    lineHeight: 16,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  sparkleContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  sparkle: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: '#2196F3',
    borderRadius: 3,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  sparkle1: {
    top: '15%',
    right: '10%',
  },
  sparkle2: {
    bottom: '20%',
    left: '8%',
  },
  sparkle3: {
    top: '60%',
    right: '5%',
  },
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
  errorModalBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    width: '90%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  errorModalContainer: {
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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