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
import SuccessModal from '../../modals/SuccessModal';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateAccount'>;

const { width, height } = Dimensions.get('window');

const CreateAccount = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useTheme();

  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const signUpButtonScale = useRef(new Animated.Value(1)).current;
  const floatingAnimation = useRef(new Animated.Value(0)).current;
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;
  
  // Screen transition animations - REMOVED for performance debugging
  
  // Form state
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showSuccessModal, setShowSuccessModal] = React.useState(false);
  const [validationWarning, setValidationWarning] = React.useState('');
  
  // Input focus states
  const usernameFocus = useRef(new Animated.Value(0)).current;
  const emailFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;
  const confirmPasswordFocus = useRef(new Animated.Value(0)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;

  // Start screen transition animation on mount - REMOVED for performance debugging

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

    // Start orb animations
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

    // Light spot animations
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
  }, []);

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
    // Clear previous warnings
    setValidationWarning('');
    
    // Validation
    if (!username.trim()) {
      setValidationWarning('⚠️ Please enter a username');
      return;
    }
    if (!email.trim()) {
      setValidationWarning('⚠️ Please enter an email address');
      return;
    }
    
    // Email format validation
    if (!/\S+@\S+\.\S+/.test(email)) {
      setValidationWarning('⚠️ Please enter a valid email address');
      return;
    }
    
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
      setValidationWarning('⚠️ Temporary or disposable email addresses are not allowed. Please use a valid institutional or personal email.');
      return;
    }
    
    // Strong password validation
    if (password.length < 8) {
      setValidationWarning('⚠️ Password must be at least 8 characters long');
      return;
    }
    
    // Check for alphanumeric (letters + numbers + special chars)
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/'`~;]/.test(password);
    
    if (!hasUpperCase) {
      setValidationWarning('⚠️ Password must contain at least one uppercase letter (A-Z)');
      return;
    }
    if (!hasLowerCase) {
      setValidationWarning('⚠️ Password must contain at least one lowercase letter (a-z)');
      return;
    }
    if (!hasNumber) {
      setValidationWarning('⚠️ Password must contain at least one number (0-9)');
      return;
    }
    if (!hasSpecialChar) {
      setValidationWarning('⚠️ Password must contain at least one special character (!@#$%^&*...)');
      return;
    }
    
    if (password !== confirmPassword) {
      setValidationWarning('⚠️ Passwords do not match');
      return;
    }

    setIsLoading(true);
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
        navigation.navigate('SchoolUpdates' as any);
      }, 2500);
    } catch (error: any) {
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      let errorMessage = 'Failed to create account';
      
      if (error.message.includes('already exists')) {
        errorMessage = 'This email is already registered';
      } else if (error.message.includes('Invalid')) {
        errorMessage = 'Invalid email or password format';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setValidationWarning(`⚠️ ${errorMessage}`);
      console.error('Sign up error:', error);
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
        
        {/* Gradient Background */}
        <View style={styles.gradientBackground}>
          <LinearGradient
            colors={isDarkMode 
              ? ['#0B1220', '#111827', '#1F2937'] 
              : ['#FBF8F3', '#F8F5F0', '#F5F2ED']
            }
            style={styles.gradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
        
        {/* Blur overlay on entire background - very subtle */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 5 : 3}
          tint="default"
          style={styles.gradientBackground}
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
        {/* Logo and Title Section */}
        <View style={styles.topSection}>
          <TouchableOpacity 
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
              <Image source={require('../../../../assets/DOrSU.png')} style={styles.logoImage} />
            </Animated.View>
          </TouchableOpacity>
            <Text style={[styles.welcomeText, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Create Account</Text>
            <Text style={[styles.signInText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Sign up to get started</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Animated.View style={[
              styles.inputWrapper,
              {
                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: usernameFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', '#2196F3'],
                }),
              }
            ]}>
              <MaterialIcons 
                name="person" 
                size={20} 
                color={isDarkMode ? '#9CA3AF' : '#666'} 
                style={styles.inputIcon} 
              />
            <TextInput
              style={[styles.input, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}
              placeholder="Username"
              placeholderTextColor={isDarkMode ? '#9CA3AF' : '#666'}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                onFocus={() => {
                  Animated.timing(usernameFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(usernameFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }).start();
                }}
              />
            </Animated.View>

            <Animated.View style={[
              styles.inputWrapper,
              {
                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: emailFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', '#2196F3'],
                }),
              }
            ]}>
              <MaterialIcons 
                name="email" 
                size={20} 
                color={isDarkMode ? '#9CA3AF' : '#666'} 
                style={styles.inputIcon} 
            />
            <TextInput
              style={[styles.input, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}
              placeholder="Email"
              placeholderTextColor={isDarkMode ? '#9CA3AF' : '#666'}
              keyboardType="email-address"
              autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
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
              />
            </Animated.View>

            <Animated.View style={[
              styles.inputWrapper,
              {
                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', '#2196F3'],
                }),
              }
            ]}>
              <MaterialIcons 
                name="lock" 
                size={20} 
                color={isDarkMode ? '#9CA3AF' : '#666'} 
                style={styles.inputIcon} 
            />
            <TextInput
              style={[styles.input, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}
              placeholder="Password"
              placeholderTextColor={isDarkMode ? '#9CA3AF' : '#666'}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
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
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility-off" : "visibility"} 
                  size={20} 
                  color={isDarkMode ? '#9CA3AF' : '#666'} 
                />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[
              styles.inputWrapper,
              {
                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: confirmPasswordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', '#2196F3'],
                }),
              }
            ]}>
              <MaterialIcons 
                name="lock-outline" 
                size={20} 
                color={isDarkMode ? '#9CA3AF' : '#666'} 
                style={styles.inputIcon} 
            />
            <TextInput
              style={[styles.input, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}
              placeholder="Confirm Password"
              placeholderTextColor={isDarkMode ? '#9CA3AF' : '#666'}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => {
                  Animated.timing(confirmPasswordFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(confirmPasswordFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }).start();
                }}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.passwordToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons 
                  name={showConfirmPassword ? "visibility-off" : "visibility"} 
                  size={20} 
                  color={isDarkMode ? '#9CA3AF' : '#666'} 
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Validation Warning */}
          {validationWarning ? (
            <View style={styles.warningContainer}>
              <MaterialIcons name="warning" size={18} color="#F59E0B" />
              <Text style={styles.warningText}>{validationWarning}</Text>
            </View>
          ) : null}

          <Animated.View style={{ transform: [{ scale: signUpButtonScale }] }}>
          <TouchableOpacity 
              style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
              onPress={() => handleButtonPress(signUpButtonScale, handleSignUp)}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={isLoading ? "Creating account..." : "Sign up"}
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
                  { backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(31, 41, 55, 0.15)' }
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
                      <Text style={[styles.signUpButtonText, { color: isDarkMode ? '#E5E7EB' : '#1F2937' }]}>Creating Account...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="person-add" size={24} color={isDarkMode ? '#60A5FA' : '#1F2937'} style={styles.buttonIcon} />
                      <Text style={[styles.signUpButtonText, { color: isDarkMode ? '#E5E7EB' : '#1F2937' }]}>Sign Up</Text>
                    </>
                  )}
                </View>
              </BlurView>
          </TouchableOpacity>
          </Animated.View>

          <View style={styles.signUpContainer}>
            <Text style={[styles.signUpText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Already have an account? </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('SignIn')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.signUpLinkButton}
            >
              <Text style={[styles.signUpLink, { color: isDarkMode ? '#60A5FA' : '#1F2937' }]}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </KeyboardWrapper>
      
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
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  gradientBackground: {
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 8 : 24,
    paddingBottom: Platform.OS === 'android' ? 16 : 32,
    justifyContent: 'space-between',
  },
  topSection: {
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
  welcomeText: {
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
  inputContainer: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
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
  signUpButton: {
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  signUpButtonDisabled: {
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
  signUpButtonText: {
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
    transform: [{ rotate: '0deg' }],
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
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
    lineHeight: 18,
  },
});

export default CreateAccount; 