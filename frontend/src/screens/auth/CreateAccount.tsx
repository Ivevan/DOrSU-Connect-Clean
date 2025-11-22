import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config/api.config';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';
import SuccessModal from '../../modals/SuccessModal';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateAccount'>;

const { width } = Dimensions.get('window');

const CreateAccount = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnline = isConnected && isInternetReachable;

  // Simplified animation values
  const signUpButtonScale = useRef(new Animated.Value(1)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;
  
  // Form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState({ username: '', email: '', password: '', confirmPassword: '', general: '' });
  
  // Input focus states
  const usernameFocus = useRef(new Animated.Value(0)).current;
  const emailFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;
  const confirmPasswordFocus = useRef(new Animated.Value(0)).current;

  // Handle back button/gesture to navigate to GetStarted
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate('GetStarted');
        return true; // Prevent default behavior
      };

      if (Platform.OS === 'android') {
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
      }
    }, [navigation])
  );

  // Handle navigation back button and iOS swipe back gesture
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Prevent default behavior of leaving the screen
      e.preventDefault();
      // Navigate to GetStarted instead
      navigation.navigate('GetStarted');
    });

    return unsubscribe;
  }, [navigation]);

  // Button press handler
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

  const handleSignUp = async () => {
    // Check network status first
    if (!isOnline) {
      setErrors({ username: '', email: '', password: '', confirmPassword: '', general: 'No internet connection. Please check your network and try again.' });
      return;
    }

    // Clear previous errors
    setErrors({ username: '', email: '', password: '', confirmPassword: '', general: '' });
    
    // Validation
    let hasErrors = false;
    const newErrors = { username: '', email: '', password: '', confirmPassword: '', general: '' };
    
    if (!username.trim()) {
      newErrors.username = 'Please enter a username';
      hasErrors = true;
    }
    
    if (!email.trim()) {
      newErrors.email = 'Please enter your email address';
      hasErrors = true;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
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
    
    // Strong password validation
    if (!password.trim()) {
      newErrors.password = 'Please enter your password';
      hasErrors = true;
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      hasErrors = true;
    } else {
      // Check for alphanumeric (letters + numbers + special chars)
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/'`~;]/.test(password);
      
      if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
        newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
        hasErrors = true;
      }
    }
    
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
      hasErrors = true;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      hasErrors = true;
    }
    
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    Animated.loop(
      Animated.timing(loadingRotation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
    
    try {
      // Call backend API to register user
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      // Store user data and token locally
      await AsyncStorage.setItem('userToken', data.token);
      await AsyncStorage.setItem('userEmail', data.user.email);
      await AsyncStorage.setItem('userName', data.user.username);
      await AsyncStorage.setItem('userId', data.user.id);
      
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      // Show success modal
      setShowSuccessModal(true);
      
      // Navigate after modal shows
      setTimeout(() => {
        setShowSuccessModal(false);
        navigation.navigate('SchoolUpdates');
      }, 2500);
    } catch (error: any) {
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      let errorMessage = 'Failed to create account';
      
      if (error.message.includes('already exists')) {
        setErrors({ username: '', email: 'This email is already registered', password: '', confirmPassword: '', general: '' });
      } else if (error.message.includes('Invalid')) {
        setErrors({ username: '', email: 'Invalid email or password format', password: '', confirmPassword: '', general: '' });
      } else {
        setErrors({ username: '', email: '', password: '', confirmPassword: '', general: error.message || errorMessage });
      }
      
      console.error('Sign up error:', error);
    }
  };

  const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

  // Render form content
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
            <Text style={styles.logoSubtitle}>AI-Powered Academic Assistant</Text>
          </View>
        </View>

        {/* Welcome Text */}
        <Text style={styles.welcomeText}>Create your account</Text>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: usernameFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.username ? '#EF4444' : '#E5E7EB', errors.username ? '#EF4444' : '#2563EB'],
                }),
                borderWidth: usernameFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="person" 
                size={20} 
                color={errors.username ? '#EF4444' : '#9CA3AF'} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (errors.username) setErrors(prev => ({ ...prev, username: '' }));
                }}
                onFocus={() => {
                  Animated.timing(usernameFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(usernameFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                accessibilityLabel="Username"
              />
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.username ? (
                <Text style={styles.errorText}>{errors.username}</Text>
              ) : null}
            </View>
          </View>

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

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: confirmPasswordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.confirmPassword ? '#EF4444' : '#E5E7EB', errors.confirmPassword ? '#EF4444' : '#2563EB'],
                }),
                borderWidth: confirmPasswordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="lock-outline" 
                size={20} 
                color={errors.confirmPassword ? '#EF4444' : '#9CA3AF'} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
                }}
                onFocus={() => {
                  Animated.timing(confirmPasswordFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(confirmPasswordFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                accessibilityLabel="Confirm Password"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.passwordToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
              >
                <MaterialIcons 
                  name={showConfirmPassword ? "visibility-off" : "visibility"} 
                  size={20} 
                  color="#9CA3AF" 
                />
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.confirmPassword ? (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
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

          {/* Sign Up Button */}
          <Animated.View style={{ transform: [{ scale: signUpButtonScale }] }}>
            <TouchableOpacity 
              style={[styles.signUpButton, (isLoading || !isOnline) && styles.signUpButtonDisabled]}
              onPress={() => handleButtonPress(signUpButtonScale, handleSignUp)}
              disabled={isLoading || !isOnline}
              accessibilityRole="button"
              accessibilityLabel={isLoading ? "Creating account..." : !isOnline ? "Sign up (No internet connection)" : "Sign up"}
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
                  <Text style={styles.signUpButtonText}>Creating Account</Text>
                </>
              ) : (
                <Text style={styles.signUpButtonText}>CREATE ACCOUNT</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Links Section */}
          <View style={styles.linksSection}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('SignIn')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>Already have an account? Sign In</Text>
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
      
      {/* Mobile Layout - Full screen form with background */}
      <View style={styles.mobileContainer}>
        <Image 
          source={require('../../../../assets/DOrSU_STATUE.png')} 
          style={styles.mobileBackgroundImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.5)', 'rgba(29, 78, 216, 0.7)']}
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
                {renderFormContent()}
              </View>
            </ScrollView>
          </KeyboardWrapper>
        </View>
      </View>
      
      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Account Created!"
        message="Welcome to DOrSU Connect. Your account has been successfully created."
        icon="checkmark-circle"
        iconColor="#10B981"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
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
    marginBottom: 16,
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
  // Sign Up Button
  signUpButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#9CA3AF',
  },
  signUpButtonText: {
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
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },
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

export default CreateAccount;
