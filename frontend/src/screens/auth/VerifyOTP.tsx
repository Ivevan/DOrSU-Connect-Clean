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
import { verifyResetOTP, requestPasswordResetOTP } from '../../services/authService';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  ForgotPassword: undefined;
  VerifyOTP: { email: string };
  ResetPassword: { resetToken?: string };
  AdminAIChat: undefined;
  AIChat: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'VerifyOTP'>;
type RouteProp = {
  key: string;
  name: 'VerifyOTP';
  params?: { email: string };
};

const { width } = Dimensions.get('window');
const OTP_LENGTH = 6;

const VerifyOTP = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnline = isConnected && isInternetReachable;

  // Get email from route params
  const email = route.params?.email || '';

  // Animation values
  const verifyButtonScale = useRef(new Animated.Value(1)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;
  
  // OTP state
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errors, setErrors] = useState({ otp: '', general: '' });
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Refs for OTP inputs
  const otpInputRefs = useRef<(TextInput | null)[]>([]);
  
  // Timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (otpInputRefs.current[0]) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, []);

  // Handle back button/gesture
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate('ForgotPassword');
        return true;
      };

      if (Platform.OS === 'android') {
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
      }
    }, [navigation])
  );

  // Handle navigation back button
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      navigation.navigate('ForgotPassword');
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

  // Handle OTP input change
  const handleOtpChange = (value: string, index: number) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '');
    
    if (digit.length > 1) {
      // Handle paste: fill multiple fields
      const digits = digit.slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = d;
        }
      });
      setOtp(newOtp);
      
      // Focus next empty field or last field
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      otpInputRefs.current[nextIndex]?.focus();
    } else {
      // Single digit input
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      
      // Auto-advance to next field
      if (digit && index < OTP_LENGTH - 1) {
        otpInputRefs.current[index + 1]?.focus();
      }
    }
    
    // Clear errors when user types
    if (errors.otp || errors.general) {
      setErrors({ otp: '', general: '' });
    }
  };

  // Handle backspace
  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!isOnline) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors({ 
        otp: '', 
        general: 'No internet connection. Please check your network and try again.' 
      });
      return;
    }

    const otpString = otp.join('');
    
    // Validate OTP
    if (otpString.length !== OTP_LENGTH) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors({ 
        otp: 'Please enter the complete 6-digit code', 
        general: '' 
      });
      return;
    }

    setIsLoading(true);
    setErrors({ otp: '', general: '' });

    // Start loading spinner
    Animated.loop(
      Animated.timing(loadingRotation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();

    try {
      const result = await verifyResetOTP(email, otpString);
      
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate to ResetPassword with reset token
      navigation.navigate('ResetPassword', { resetToken: result.resetToken });
    } catch (error: any) {
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let errorMessage = error.message || 'Failed to verify OTP. Please try again.';
      let otpError = '';
      
      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        otpError = error.message;
        errorMessage = '';
      }
      
      setErrors({
        otp: otpError,
        general: errorMessage,
      });
      
      // Clear OTP on error
      setOtp(Array(OTP_LENGTH).fill(''));
      otpInputRefs.current[0]?.focus();
      
      console.error('Verify OTP error:', error);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (resendCooldown > 0 || !isOnline || isResending) {
      return;
    }

    setIsResending(true);
    setErrors({ otp: '', general: '' });

    try {
      await requestPasswordResetOTP(email);
      
      // Set cooldown (60 seconds)
      setResendCooldown(60);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Clear OTP fields
      setOtp(Array(OTP_LENGTH).fill(''));
      otpInputRefs.current[0]?.focus();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors({
        otp: '',
        general: error.message || 'Failed to resend OTP. Please try again.',
      });
    } finally {
      setIsResending(false);
    }
  };

  const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent={true}
        animated={true}
      />
      
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
                {/* Logo Section */}
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
                <Text style={styles.welcomeText}>Enter Verification Code</Text>
                <Text style={styles.subtitleText}>
                  We've sent a 6-digit code to{'\n'}
                  <Text style={styles.emailText}>{email}</Text>
                </Text>

                {/* OTP Input Section */}
                <View style={styles.formSection}>
                  <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                      <TextInput
                        key={index}
                        ref={(ref) => { otpInputRefs.current[index] = ref; }}
                        style={[
                          styles.otpInput,
                          errors.otp && styles.otpInputError,
                          digit && styles.otpInputFilled
                        ]}
                        value={digit}
                        onChangeText={(value) => handleOtpChange(value, index)}
                        onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                        editable={!isLoading}
                        accessibilityLabel={`OTP digit ${index + 1}`}
                      />
                    ))}
                  </View>

                  {/* Error Messages */}
                  <View style={styles.errorContainer}>
                    {errors.otp ? (
                      <Text style={styles.errorText}>{errors.otp}</Text>
                    ) : null}
                  </View>

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

                  {/* Verify Button */}
                  <Animated.View style={{ transform: [{ scale: verifyButtonScale }] }}>
                    <TouchableOpacity 
                      style={[styles.verifyButton, (isLoading || !isOnline) && styles.verifyButtonDisabled]}
                      onPress={() => handleButtonPress(verifyButtonScale, handleVerifyOTP)}
                      disabled={isLoading || !isOnline}
                      accessibilityRole="button"
                      accessibilityLabel={isLoading ? "Verifying OTP..." : !isOnline ? "Verify OTP (No internet connection)" : "Verify OTP"}
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
                          <Text style={styles.verifyButtonText}>Verifying...</Text>
                        </>
                      ) : (
                        <Text style={styles.verifyButtonText}>VERIFY CODE</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Resend OTP */}
                  <View style={styles.resendSection}>
                    <Text style={styles.resendText}>Didn't receive the code?</Text>
                    <TouchableOpacity 
                      onPress={handleResendOTP}
                      disabled={resendCooldown > 0 || isResending || !isOnline}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.resendButton,
                        (resendCooldown > 0 || isResending || !isOnline) && styles.resendButtonDisabled
                      ]}>
                        {isResending 
                          ? 'Sending...' 
                          : resendCooldown > 0 
                            ? `Resend in ${resendCooldown}s` 
                            : 'Resend Code'
                        }
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Back to Forgot Password */}
                  <View style={styles.linksSection}>
                    <TouchableOpacity 
                      onPress={() => navigation.navigate('ForgotPassword')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.linkText}>Change Email Address</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
    textAlign: 'center',
  },
  emailText: {
    fontWeight: '600',
    color: '#2563EB',
  },
  formSection: {
    width: '100%',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  otpInputFilled: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  otpInputError: {
    borderColor: '#EF4444',
  },
  errorContainer: {
    minHeight: 16,
    marginTop: 2,
    marginBottom: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    textAlign: 'center',
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
  verifyButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#9CA3AF',
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingSpinner: {
    marginRight: 8,
  },
  resendSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  resendButton: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  resendButtonDisabled: {
    color: '#9CA3AF',
    opacity: 0.6,
  },
  linksSection: {
    marginTop: 8,
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

export default VerifyOTP;

