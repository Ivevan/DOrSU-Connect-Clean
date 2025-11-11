import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import { Animated, Dimensions, Easing, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config/api.config';
import { theme } from '../../config/theme';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined; // Added new screen
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

const { width, height } = Dimensions.get('window');

const SignIn = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

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
  
  // Screen transition animations
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(50)).current;
  const backgroundOpacity = useRef(new Animated.Value(0)).current;

  // Start screen transition animation on mount
  React.useEffect(() => {
    const startScreenTransition = () => {
      // Background fade in
      Animated.timing(backgroundOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      // Screen content fade in and slide up
      Animated.parallel([
        Animated.timing(screenOpacity, {
          toValue: 1,
          duration: 1000,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 1000,
          delay: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    };

    startScreenTransition();
  }, []);

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
    
    // Basic validation
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
      setErrors(newErrors);
      return;
    }
    
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
      // Call backend API to login user
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
    <View style={[styles.container, {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <KeyboardWrapper 
        style={styles.keyboardAvoidingView}
        {...keyboardProps}
    >
      <StatusBar
        backgroundColor="transparent"
        barStyle="dark-content"
        translucent={true}
      />
      
      {/* Gradient Background */}
      <Animated.View style={[styles.gradientBackgroundContainer, { opacity: backgroundOpacity }]}>
        <LinearGradient
          colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']}
          style={styles.gradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      
      {/* Tech Overlay Pattern */}
      <Animated.View style={[styles.techOverlay, { opacity: backgroundOpacity }]}>
        {/* Circuit-like lines */}
        <View style={styles.techLine1} />
        <View style={styles.techLine2} />
        <View style={styles.techLine3} />
        
        {/* Floating tech dots */}
        <View style={styles.techDot1} />
        <View style={styles.techDot2} />
        <View style={styles.techDot3} />
        <View style={styles.techDot4} />
        <View style={styles.techDot5} />
        <View style={styles.techDot6} />
        
        {/* Animated floating tech elements */}
        <Animated.View style={[
          styles.techFloatElement1,
          {
            opacity: techFloat1.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 0.8],
            }),
            transform: [{
              translateY: techFloat1.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -15],
              })
            }]
          }
        ]} />
        
        <Animated.View style={[
          styles.techFloatElement2,
          {
            opacity: techFloat2.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 0.9],
            }),
            transform: [{
              translateX: techFloat2.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 12],
              })
            }]
          }
        ]} />
        
        <Animated.View style={[
          styles.techFloatElement3,
          {
            opacity: techFloat3.interpolate({
              inputRange: [0, 1],
              outputRange: [0.6, 1.0],
            }),
            transform: [{
              scale: techFloat3.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1.3],
              })
            }]
          }
        ]} />
        
        {/* Simplified floating tech elements - only 2 additional */}
        <Animated.View style={[
          styles.techFloatElement4,
          {
            opacity: techFloat4.interpolate({
              inputRange: [0, 1],
              outputRange: [0.2, 0.5],
            }),
            transform: [
              {
                translateY: techFloat4.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -15],
                })
              },
              {
                translateX: techFloat4.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 6],
                })
              }
            ]
          }
        ]} />
        
        <Animated.View style={[
          styles.techFloatElement5,
          {
            opacity: techFloat5.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.6],
            }),
            transform: [
              {
                scale: techFloat5.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.1],
                })
              }
            ]
          }
        ]} />
      </Animated.View>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        keyboardDismissMode="interactive"
        style={styles.scrollView}
      >
        <Animated.View style={[
          styles.content,
          {
            opacity: screenOpacity,
            transform: [{ translateY: contentTranslateY }],
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
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.signInText}>Sign in to your account</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: emailFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.email ? '#EF4444' : 'rgba(0, 0, 0, 0.05)', errors.email ? '#EF4444' : '#2196F3'],
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
                color={errors.email ? '#EF4444' : '#666'} 
                style={styles.inputIcon} 
              />
            <TextInput
              style={styles.input}
                placeholder="Username or Email"
              placeholderTextColor="#666"
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
                borderColor: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.password ? '#EF4444' : 'rgba(0, 0, 0, 0.05)', errors.password ? '#EF4444' : '#2196F3'],
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
                color={errors.password ? '#EF4444' : '#666'} 
                style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#666"
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
                  color="#666" 
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
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
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
              <LinearGradient
                colors={isLoading ? ['#6B7280', '#9CA3AF'] : ['#1F2937', '#374151']}
                style={styles.signInButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                pointerEvents="none"
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
                      <MaterialIcons name="refresh" size={24} color="white" />
                    </Animated.View>
                    <Text style={styles.signInButtonText}>Signing In...</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="login" size={24} color="white" style={styles.buttonIcon} />
            <Text style={styles.signInButtonText}>Sign In</Text>
                  </>
                )}
              </LinearGradient>
          </TouchableOpacity>
          </Animated.View>
          </View>

          {/* Bottom Section - Always Accessible */}
          <View style={styles.bottomSection}>
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('CreateAccount')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Create new account"
              style={styles.signUpLinkButton}
            >
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Animated.View>
      </ScrollView>
      </KeyboardWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  gradientBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientBackground: {
    flex: 1,
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
    paddingHorizontal: theme.spacing(2.5),
    paddingTop: Platform.OS === 'android' ? theme.spacing(1) : theme.spacing(3),
    paddingBottom: Platform.OS === 'android' ? theme.spacing(2) : theme.spacing(4),
    justifyContent: 'space-between',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  logoImage: {
    width: width * 0.28,
    height: width * 0.28,
    marginBottom: theme.spacing(2),
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
    color: theme.colors.text,
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
    color: theme.colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: theme.spacing(1),
  },
  formContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },
  bottomSection: {
    marginTop: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  },
  inputContainer: {
    marginBottom: theme.spacing(2),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginBottom: 0, // Remove bottom margin to bring error closer
    paddingHorizontal: theme.spacing(2),
    ...theme.shadow1,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  inputIcon: {
    marginRight: theme.spacing(1.5),
  },
  input: {
    flex: 1,
    paddingVertical: theme.spacing(2),
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  passwordToggle: {
    padding: theme.spacing(1),
    marginLeft: theme.spacing(1),
  },
  errorContainer: {
    height: 20, // Fixed height to prevent layout shifts
    justifyContent: 'center',
    marginTop: 1, // Negative margin to move error UP closer to input
    marginBottom: theme.spacing(1.5), // Add spacing below error for next element
    paddingHorizontal: theme.spacing(2),
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
    marginRight: theme.spacing(1),
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
    padding: theme.spacing(2),
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing(2),
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  generalErrorText: {
    color: '#EF4444',
    fontSize: 14,
    marginLeft: theme.spacing(1),
    flex: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: theme.spacing(1),
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  forgotPasswordText: {
    color: 'black',
    fontSize: 15,
    fontWeight: '600',
  },
  signInButton: {
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: theme.spacing(2),
    ...theme.shadow2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  signInButtonGradient: {
    paddingVertical: theme.spacing(2.5),
    paddingHorizontal: theme.spacing(3),
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    borderRadius: theme.radii.lg,
    minHeight: 56,
  },
  signInButtonText: {
    color: theme.colors.surface,
    fontSize: 17,
    fontWeight: '600',
    marginLeft: theme.spacing(1.5),
    letterSpacing: 0.3,
  },
  buttonIcon: {
    marginRight: theme.spacing(1),
  },
  loadingSpinner: {
    marginRight: theme.spacing(1),
    transform: [{ rotate: '0deg' }],
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  signUpLink: {
    color: theme.colors.text,
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