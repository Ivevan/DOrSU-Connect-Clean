import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import { Animated, Dimensions, Easing, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config/api.config';
import { useTheme } from '../../contexts/ThemeContext';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AdminDashboard: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

const { width, height } = Dimensions.get('window');

const SignIn = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useTheme();

  // Animation values
  const signInButtonScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const floatingAnimation = useRef(new Animated.Value(0)).current;
  
  // Form state management
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errors, setErrors] = React.useState({ email: '', password: '', general: '' });
  
  // Input focus states
  const emailFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;
  
  // Vibration animation states
  const emailVibration = useRef(new Animated.Value(0)).current;
  const passwordVibration = useRef(new Animated.Value(0)).current;
  const techFloat1 = useRef(new Animated.Value(0)).current;
  const techFloat2 = useRef(new Animated.Value(0)).current;
  const techFloat3 = useRef(new Animated.Value(0)).current;
  const techFloat4 = useRef(new Animated.Value(0)).current;
  const techFloat5 = useRef(new Animated.Value(0)).current;
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;
  
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
  }, []);

  // Start floating animation on mount
  React.useEffect(() => {
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

      // Simplified floating elements - only 2 additional
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
    };
    startTechAnimations();
  }, []);

  // Animation functions
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

  // Function to trigger vibration animation
  const triggerVibrationAnimation = (field: 'email' | 'password') => {
    const vibrationRef = field === 'email' ? emailVibration : passwordVibration;
    
    // Phone vibration
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    
    // Container vibration animation
    Animated.sequence([
      Animated.timing(vibrationRef, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(vibrationRef, {
        toValue: -1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(vibrationRef, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(vibrationRef, {
        toValue: -1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(vibrationRef, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Function to handle sign in button press
  const handleSignIn = async () => {
    // Clear previous errors
    setErrors({ email: '', password: '', general: '' });
    
    setIsLoading(true);
    
    // Start loading spinner animation
    const startLoadingAnimation = () => {
      Animated.loop(
        Animated.timing(loadingRotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    };
    startLoadingAnimation();
    
    try {
      // Check for static admin credentials FIRST (before validation)
      const normalizedEmail = email.toLowerCase().trim();
      const isAdminLogin = (normalizedEmail === 'admin' || normalizedEmail === 'admin@dorsu.edu.ph') && password === '12345';
      
      if (isAdminLogin) {
        // Generate admin token (simple token for admin)
        const adminToken = `admin_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        // Store admin data locally
        await AsyncStorage.setItem('userToken', adminToken);
        await AsyncStorage.setItem('userEmail', 'admin@dorsu.edu.ph');
        await AsyncStorage.setItem('userName', 'admin');
        await AsyncStorage.setItem('userId', 'admin');
        await AsyncStorage.setItem('isAdmin', 'true');
        
        setIsLoading(false);
        loadingRotation.stopAnimation();
        
        // Success - navigate to admin dashboard
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate('AdminDashboard');
        return;
      }
      
      // For regular users, perform validation
      let hasErrors = false;
      const newErrors = { email: '', password: '', general: '' };
      
      if (!email.trim()) {
        newErrors.email = 'Try again with a valid email';
        hasErrors = true;
        triggerVibrationAnimation('email');
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        newErrors.email = 'Try again with a valid email';
        hasErrors = true;
        triggerVibrationAnimation('email');
      } else {
        // Block temporary/disposable email services
        const tempEmailDomains = [
          'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
          'mailinator.com', 'maildrop.cc', 'temp-mail.org', 'yopmail.com',
          'fakeinbox.com', 'trashmail.com', 'getnada.com', 'mailnesia.com',
          'dispostable.com', 'throwawaymail.com', 'tempinbox.com', 'emailondeck.com',
          'sharklasers.com', 'guerrillamail.info', 'grr.la', 'guerrillamail.biz',
          'guerrillamail.de', 'spam4.me', 'mailtemp.com', 'tempsky.com'
        ];
        
        const emailDomain = email.toLowerCase().split('@')[1];
        if (tempEmailDomains.includes(emailDomain)) {
          newErrors.email = 'Temporary emails not allowed';
          hasErrors = true;
          triggerVibrationAnimation('email');
        }
      }
      
      if (!password.trim()) {
        newErrors.password = 'Try again with a valid password';
        hasErrors = true;
        triggerVibrationAnimation('password');
      } else if (password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
        hasErrors = true;
        triggerVibrationAnimation('password');
      }
      
      if (hasErrors) {
        setIsLoading(false);
        loadingRotation.stopAnimation();
        setErrors(newErrors);
        return;
      }
      
      // Call backend API to login regular user
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      // Store user data and token locally
      await AsyncStorage.setItem('userToken', data.token);
      await AsyncStorage.setItem('userEmail', data.user.email);
      await AsyncStorage.setItem('userName', data.user.username);
      await AsyncStorage.setItem('userId', data.user.id);
      await AsyncStorage.setItem('isAdmin', 'false'); // Explicitly set as non-admin
      
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      // Success - navigate to main app
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('SchoolUpdates');
    } catch (error: any) {
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      // Handle errors
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let errorMessage = 'Invalid email or password. Please try again.';
      
      if (error.message.includes('Invalid')) {
        errorMessage = 'Invalid email or password';
      } else if (error.message.includes('deactivated')) {
        errorMessage = 'This account has been deactivated';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrors(prev => ({ ...prev, general: errorMessage }));
      
      // Trigger vibration for both fields
      triggerVibrationAnimation('email');
      setTimeout(() => triggerVibrationAnimation('password'), 200);
      
      console.error('Sign in error:', error);
    }
  };

  const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

  return (
    <View style={styles.container}>
      <KeyboardWrapper 
        style={styles.keyboardAvoidingView}
        {...keyboardProps}
    >
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
      
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        keyboardDismissMode="interactive"
        style={styles.scrollView}
      >
        <View style={[
          styles.content,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}>
          {/* Header Section - Simplified */}
          <View style={styles.headerSection}>
            <TouchableOpacity 
              onPress={() => {
                // Add haptic feedback for logo press
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={1}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              accessibilityRole="button"
              accessibilityLabel="DOrSU Connect logo"
              accessibilityHint="Tap to see logo animation"
              accessibilityState={{ disabled: false }}
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
            </TouchableOpacity>
            <Text style={[styles.welcomeText, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Welcome Back</Text>
            <Text style={[styles.signInText, { color: isDarkMode ? '#E5E7EB' : '#374151' }]}>Sign in to your account</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Animated.View style={[
              styles.inputWrapper,
              {
                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: emailFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.email ? '#EF4444' : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'), errors.email ? '#EF4444' : '#2196F3'],
                }),
                shadowOpacity: emailFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.2],
                }),
                transform: [{
                  translateX: emailVibration.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-8, 0, 8],
                  })
                }]
              }
            ]}>
              <MaterialIcons 
                name="person" 
                size={20} 
                color={errors.email ? '#EF4444' : (isDarkMode ? '#9CA3AF' : '#666')} 
                style={styles.inputIcon} 
              />
            <TextInput
              style={[styles.input, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}
                placeholder="Username or Email"
              placeholderTextColor={isDarkMode ? '#9CA3AF' : '#666'}
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
                   onFocus={() => {
                     Animated.timing(emailFocus, {
                       toValue: 1,
                       duration: 200,
                       useNativeDriver: true,
                     }).start();
                   }}
                   onBlur={() => {
                     Animated.timing(emailFocus, {
                       toValue: 0,
                       duration: 200,
                       useNativeDriver: true,
                     }).start();
                   }}
                accessibilityLabel="Username or Email"
              />
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.email ? (
                <View style={styles.errorMessageContainer}>
                  <View style={styles.errorIcon}>
                    <Text style={styles.errorIconText}>!</Text>
                  </View>
                  <Text style={styles.errorText}>{errors.email}</Text>
                </View>
              ) : null}
            </View>
            
            <Animated.View style={[
              styles.inputWrapper,
              {
                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.password ? '#EF4444' : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'), errors.password ? '#EF4444' : '#2196F3'],
                }),
                shadowOpacity: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.2],
                }),
                transform: [{
                  translateX: passwordVibration.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-8, 0, 8],
                  })
                }]
              }
            ]}>
              <MaterialIcons 
                name="lock" 
                size={20} 
                color={errors.password ? '#EF4444' : (isDarkMode ? '#9CA3AF' : '#666')} 
                style={styles.inputIcon} 
            />
            <TextInput
              style={[styles.input, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}
              placeholder="Password"
              placeholderTextColor={isDarkMode ? '#9CA3AF' : '#666'}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                }}
                   onFocus={() => {
                     Animated.timing(passwordFocus, {
                       toValue: 1,
                       duration: 200,
                       useNativeDriver: true,
                     }).start();
                   }}
                   onBlur={() => {
                     Animated.timing(passwordFocus, {
                       toValue: 0,
                       duration: 200,
                       useNativeDriver: true,
                     }).start();
                   }}
                accessibilityLabel="Password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility-off" : "visibility"} 
                  size={20} 
                  color={isDarkMode ? '#9CA3AF' : '#666'} 
                />
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.password ? (
                <View style={styles.errorMessageContainer}>
                  <View style={styles.errorIcon}>
                    <Text style={styles.errorIconText}>!</Text>
                  </View>
                  <Text style={styles.errorText}>{errors.password}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity 
              style={styles.forgotPassword}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.forgotPasswordText, { color: isDarkMode ? '#9CA3AF' : '#1F2937' }]}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* General Error Message */}
          {errors.general ? (
            <View style={styles.generalErrorContainer}>
              <MaterialIcons name="error-outline" size={20} color="#EF4444" />
              <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
          ) : null}
          
          <Animated.View style={{ transform: [{ scale: signInButtonScale }] }}>
          <TouchableOpacity 
              style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
              onPress={() => handleButtonPress(signInButtonScale, handleSignIn)}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={isLoading ? "Signing in..." : "Sign in"}
              accessibilityHint="Double tap to sign in to your DOrSU Connect account"
              accessibilityState={{ disabled: isLoading }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.8}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 80 : 60}
                tint={isDarkMode ? 'dark' : 'light'}
                style={styles.buttonBlur}
              >
                <View style={[
                  styles.buttonContent,
                  { backgroundColor: isLoading ? (isDarkMode ? 'rgba(107, 114, 128, 0.3)' : 'rgba(107, 114, 128, 0.5)') : (isDarkMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(31, 41, 55, 0.15)') }
                ]}>
                  {isLoading ? (
                    <>
                      <Animated.View style={[
                        styles.loadingSpinner,
                        {
                          transform: [{
                            rotate: loadingRotation.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg'],
                            })
                          }]
                        }
                      ]}>
                        <MaterialIcons name="refresh" size={24} color={isDarkMode ? '#60A5FA' : '#1F2937'} />
                      </Animated.View>
                      <Text style={[styles.signInButtonText, { color: isDarkMode ? '#E5E7EB' : '#1F2937' }]}>Signing In...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="login" size={24} color={isDarkMode ? '#60A5FA' : '#1F2937'} style={styles.buttonIcon} />
                      <Text style={[styles.signInButtonText, { color: isDarkMode ? '#E5E7EB' : '#1F2937' }]}>Sign In</Text>
                    </>
                  )}
                </View>
              </BlurView>
          </TouchableOpacity>
          </Animated.View>
          </View>

          {/* Bottom Section - Always Accessible */}
          <View style={styles.bottomSection}>
          <View style={styles.signUpContainer}>
            <Text style={[styles.signUpText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Don't have an account? </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('CreateAccount')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Create new account"
              style={styles.signUpLinkButton}
            >
              <Text style={[styles.signUpLink, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </ScrollView>
      </KeyboardWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'android' ? 20 : 0, // Small padding for Android
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 32,
    paddingBottom: Platform.OS === 'android' ? 32 : 48,
    justifyContent: 'space-between',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  logoImage: {
    width: width * 0.28,
    height: width * 0.28,
    marginBottom: 16,
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
  welcomeText: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  signInText: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  formContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bottomSection: {
    marginTop: 16,
    paddingBottom: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 0, // Remove bottom margin to bring error closer
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  passwordToggle: {
    padding: 8,
    marginLeft: 8,
  },
  errorContainer: {
    height: 20, // Fixed height to prevent layout shifts
    justifyContent: 'center',
    marginTop: 1, // Negative margin to move error UP closer to input
    marginBottom: 12, // Add spacing below error for next element
    paddingHorizontal: 0,
  },
  errorMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  errorIconText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
    flex: 1,
  },
  generalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  generalErrorText: {
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  forgotPasswordText: {
    fontSize: 15,
    fontWeight: '600',
  },
  signInButton: {
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      },
    }),
  },
  signInButtonDisabled: {
    opacity: 0.7,
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
  signInButtonText: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  buttonIcon: {
    marginRight: 8,
  },
  loadingSpinner: {
    marginRight: 8,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
  signUpLink: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  signUpLinkButton: {
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
});

export default SignIn; 