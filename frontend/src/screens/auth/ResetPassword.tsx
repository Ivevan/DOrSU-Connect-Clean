import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';
import { resetPasswordWithToken } from '../../services/authService';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  ForgotPassword: undefined;
  ResetPassword: { resetToken?: string };
  AdminAIChat: undefined;
  AIChat: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;
type RouteProp = {
  key: string;
  name: 'ResetPassword';
  params?: { resetToken?: string };
};

const { width } = Dimensions.get('window');

const ResetPassword = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnline = isConnected && isInternetReachable;

  // Animation values
  const resetButtonScale = useRef(new Animated.Value(1)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;
  
  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [errors, setErrors] = useState({ password: '', confirmPassword: '', general: '' });
  
  // Input focus states
  const passwordFocus = useRef(new Animated.Value(0)).current;
  const confirmPasswordFocus = useRef(new Animated.Value(0)).current;

  // Extract reset token from route params
  useEffect(() => {
    if (route.params?.resetToken) {
      setResetToken(route.params.resetToken);
    }
  }, [route.params]);

  // Handle back button/gesture to navigate to SignIn
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate('SignIn');
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
      // Navigate to SignIn instead
      navigation.navigate('SignIn');
    });

    return unsubscribe;
  }, [navigation]);

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

  // Function to handle reset password button press
  const handleResetPassword = async () => {
    // Check if reset token is available
    if (!resetToken) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors({ 
        password: '', 
        confirmPassword: '',
        general: 'Invalid reset token. Please request a new OTP.' 
      });
      return;
    }

    // Check network status first
    if (!isOnline) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors({ 
        password: '', 
        confirmPassword: '',
        general: 'No internet connection. Please check your network and try again.' 
      });
      return;
    }

    // Clear previous errors
    setErrors({ password: '', confirmPassword: '', general: '' });
    
    // Validate passwords
    let hasErrors = false;
    const newErrors = { password: '', confirmPassword: '', general: '' };
    
    if (!password.trim()) {
      newErrors.password = 'Password is required';
      hasErrors = true;
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      hasErrors = true;
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    setIsLoading(true);
    
    // Start loading spinner animation
    Animated.loop(
      Animated.timing(loadingRotation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
    
    try {
      await resetPasswordWithToken(resetToken, password.trim());
      
      setIsLoading(false);
      loadingRotation.stopAnimation();
      setIsSuccess(true);
      
      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      // Handle errors
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let errorMessage = error.message || 'Failed to reset password. Please try again.';
      let passwordError = '';
      
      if (error.message.includes('Invalid or expired')) {
        errorMessage = 'Invalid or expired reset link. Please request a new password reset email.';
      } else if (error.message.includes('weak-password') || error.message.includes('too weak')) {
        passwordError = 'Password is too weak. Please use a stronger password.';
        errorMessage = '';
      }
      
      setErrors({
        password: passwordError,
        confirmPassword: '',
        general: errorMessage,
      });
      
      console.error('Reset password error:', error);
    }
  };

  const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

  // Render form content
  const renderFormContent = () => {
    if (isSuccess) {
      return (
        <>
          {/* Success Message */}
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

          <View style={styles.successContainer}>
            <MaterialIcons name="check-circle" size={64} color="#10B981" />
            <Text style={styles.successTitle}>Password Reset Successful</Text>
            <Text style={styles.successMessage}>
              Your password has been successfully reset.{'\n'}
              You can now sign in with your new password.
            </Text>
          </View>

          {/* Back to Sign In Button */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.navigate('SignIn')}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>Sign In</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (!resetToken) {
      return (
        <>
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

          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={48} color="#EF4444" />
            <Text style={styles.errorTitle}>Invalid Reset Token</Text>
            <Text style={styles.errorMessage}>
              This password reset token is invalid or has expired.{'\n'}
              Please request a new OTP code.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>Request New OTP</Text>
          </TouchableOpacity>
        </>
      );
    }

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

        {/* Title Text */}
        <Text style={styles.welcomeText}>Create New Password</Text>
        <Text style={styles.subtitleText}>
          Please enter your new password below.
        </Text>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password</Text>
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
                placeholder="Enter your new password"
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
                accessibilityLabel="New Password"
                editable={!isLoading}
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
            <Text style={styles.inputLabel}>Confirm New Password</Text>
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
                name="lock" 
                size={20} 
                color={errors.confirmPassword ? '#EF4444' : '#9CA3AF'} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm your new password"
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
                accessibilityLabel="Confirm New Password"
                editable={!isLoading}
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

          {/* Reset Password Button */}
          <Animated.View style={{ transform: [{ scale: resetButtonScale }] }}>
            <TouchableOpacity 
              style={[styles.resetButton, (isLoading || !isOnline) && styles.resetButtonDisabled]}
              onPress={() => handleButtonPress(resetButtonScale, handleResetPassword)}
              disabled={isLoading || !isOnline}
              accessibilityRole="button"
              accessibilityLabel={isLoading ? "Resetting password..." : !isOnline ? "Reset password (No internet connection)" : "Reset password"}
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
                  <Text style={styles.resetButtonText}>Resetting...</Text>
                </>
              ) : (
                <Text style={styles.resetButtonText}>RESET PASSWORD</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Back to Sign In Link */}
          <View style={styles.linksSection}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('SignIn')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>Back to Sign In</Text>
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
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 20,
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
  // Reset Button
  resetButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 0,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  resetButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#9CA3AF',
  },
  resetButtonText: {
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
  // Success Section
  successContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  backButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Error Section
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
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

export default ResetPassword;

