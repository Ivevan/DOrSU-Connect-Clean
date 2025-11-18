import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import { Animated, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config/api.config';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  AdminAIChat: undefined;
  AIChat: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

const { width, height } = Dimensions.get('window');

const SignIn = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnline = isConnected && isInternetReachable;

  // Simplified animation values
  const signInButtonScale = useRef(new Animated.Value(1)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;
  
  // Form state management
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errors, setErrors] = React.useState({ email: '', password: '', general: '' });
  
  // Input focus states
  const emailFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;

  // Animation functions
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

  // Function to handle sign in button press
  const handleSignIn = async () => {
    // Check network status first
    if (!isOnline) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors({ 
        email: '', 
        password: '', 
        general: 'No internet connection. Please check your network and try again.' 
      });
      return;
    }

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
      
      // Even admin login requires internet connection
      if (isAdminLogin && !isOnline) {
        setIsLoading(false);
        loadingRotation.stopAnimation();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrors({ 
          email: '', 
          password: '', 
          general: 'No internet connection. Please check your network and try again.' 
        });
        return;
      }
      
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
        
        // Success - navigate to admin AI chat
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate('AdminAIChat');
        return;
      }
      
      // For regular users, perform validation
      let hasErrors = false;
      const newErrors = { email: '', password: '', general: '' };
      
      if (!email.trim()) {
        newErrors.email = 'Try again with a valid email';
        hasErrors = true;
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        newErrors.email = 'Try again with a valid email';
        hasErrors = true;
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
        }
      }
      
      if (!password.trim()) {
        newErrors.password = 'Try again with a valid password';
        hasErrors = true;
      } else if (password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
        hasErrors = true;
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
      
      // Success - navigate to AI Chat for regular users
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      (navigation as any).navigate('AIChat');
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
      
      console.error('Sign in error:', error);
    }
  };

  const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

  const isMobile = width < 768;

  // Render form content (shared between mobile and desktop)
  const renderFormContent = () => {
    return (
      <>
        {/* Logo and Title Section */}
        <View style={styles.logoSection}>
          <Image 
            source={require('../../../../assets/DOrSU.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoTitle}>DOrSU CONNECT</Text>
            <Text style={styles.logoSubtitle}>Official University Portal</Text>
          </View>
        </View>

        {/* Welcome Text */}
        <Text style={styles.welcomeText}>Please sign in to continue</Text>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Registered E-mail Address</Text>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: emailFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.email ? '#EF4444' : '#E5E7EB', errors.email ? '#EF4444' : '#2563EB'],
                }),
                borderWidth: emailFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="email" 
                size={20} 
                color={errors.email ? '#EF4444' : '#9CA3AF'} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
                onFocus={() => {
                  Animated.timing(emailFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(emailFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                accessibilityLabel="Registered E-mail Address"
              />
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.email ? (
                <Text style={styles.errorText}>{errors.email}</Text>
              ) : null}
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.password ? '#EF4444' : '#E5E7EB', errors.password ? '#EF4444' : '#2563EB'],
                }),
                borderWidth: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="lock" 
                size={20} 
                color={errors.password ? '#EF4444' : '#9CA3AF'} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
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
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(passwordFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
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
                  color="#9CA3AF" 
                />
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.password ? (
                <Text style={styles.errorText}>{errors.password}</Text>
              ) : null}
            </View>
          </View>

          {/* General Error Message */}
          <View style={[
            styles.generalErrorContainer,
            !errors.general && styles.generalErrorContainerHidden
          ]}>
            {errors.general ? (
              <>
                <MaterialIcons name="error-outline" size={20} color="#EF4444" />
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </>
            ) : null}
          </View>

          {/* Login Button */}
          <Animated.View style={{ transform: [{ scale: signInButtonScale }] }}>
            <TouchableOpacity 
              style={[styles.loginButton, (isLoading || !isOnline) && styles.loginButtonDisabled]}
              onPress={() => handleButtonPress(signInButtonScale, handleSignIn)}
              disabled={isLoading || !isOnline}
              accessibilityRole="button"
              accessibilityLabel={isLoading ? "Signing in..." : !isOnline ? "Sign in (No internet connection)" : "Sign in"}
              activeOpacity={0.8}
            >
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
                    <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                  </Animated.View>
                  <Text style={styles.loginButtonText}>Signing In</Text>
                </>
              ) : (
                <Text style={styles.loginButtonText}>LOGIN</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Links Section */}
          <View style={styles.linksSection}>
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => navigation.navigate('CreateAccount')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.linkText}>Create New Account</Text>
            </TouchableOpacity>
          </View>
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
                  {/* Form Content - Same as desktop */}
                  {renderFormContent()}
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

          {/* Right Panel - Login Form */}
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
                {renderFormContent()}
              </View>
            </ScrollView>
          </KeyboardWrapper>
        </View>
        </View>
      )}
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
    marginBottom: 12,
  },
  // Form Section
  formSection: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    minHeight: 44,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  passwordToggle: {
    padding: 4,
    marginLeft: 6,
  },
  errorContainer: {
    minHeight: 16,
    marginTop: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    marginLeft: 4,
  },
  generalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    minHeight: 40,
  },
  generalErrorContainerHidden: {
    opacity: 0,
    height: 0,
    minHeight: 0,
    marginBottom: 0,
    padding: 0,
    borderWidth: 0,
  },
  generalErrorText: {
    color: '#DC2626',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  // Login Button
  loginButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#9CA3AF',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingSpinner: {
    marginRight: 8,
  },
  // Links Section
  linksSection: {
    marginBottom: 0,
  },
  linkButton: {
    marginBottom: 0,
  },
  linkText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
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
});

export default SignIn;