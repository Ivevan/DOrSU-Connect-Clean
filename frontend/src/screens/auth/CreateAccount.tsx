import { StyleSheet, Text, View, TextInput, TouchableOpacity, Dimensions, Platform, StatusBar, Image, Animated, Easing, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { lightTheme as theme } from '../../config/theme';

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

  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const signUpButtonScale = useRef(new Animated.Value(1)).current;
  const floatingAnimation = useRef(new Animated.Value(0)).current;
  const techFloat1 = useRef(new Animated.Value(0)).current;
  const techFloat2 = useRef(new Animated.Value(0)).current;
  const techFloat3 = useRef(new Animated.Value(0)).current;
  const techFloat4 = useRef(new Animated.Value(0)).current;
  const techFloat5 = useRef(new Animated.Value(0)).current;
  
  // Screen transition animations
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(50)).current;
  const backgroundOpacity = useRef(new Animated.Value(0)).current;
  
  // Form state
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Input focus states
  const usernameFocus = useRef(new Animated.Value(0)).current;
  const emailFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;
  const confirmPasswordFocus = useRef(new Animated.Value(0)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;

  // Start screen transition animation on mount
  React.useEffect(() => {
    const startScreenTransition = () => {
      Animated.timing(backgroundOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

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

    // Start tech floating animations
    const startTechAnimations = () => {
      [techFloat1, techFloat2, techFloat3, techFloat4, techFloat5].forEach((floatRef, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(floatRef, {
              toValue: 1,
              duration: 4000 + index * 500,
              delay: index * 500,
              useNativeDriver: true,
            }),
            Animated.timing(floatRef, {
              toValue: 0,
              duration: 4000 + index * 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    };
    startTechAnimations();
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
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      loadingRotation.stopAnimation();
    navigation.navigate('GetStarted');
    }, 2000);
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
          animated={true}
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
          <View style={styles.techLine1} />
          <View style={styles.techLine2} />
          <View style={styles.techLine3} />
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
          
          <Animated.View style={[
            styles.techFloatElement4,
            {
              opacity: techFloat4.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
              transform: [
                {
                  translateY: techFloat4.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -20],
                  })
                },
                {
                  translateX: techFloat4.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 8],
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
                outputRange: [0.4, 0.8],
              }),
              transform: [
                {
                  scale: techFloat5.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1.2],
                  })
                },
                {
                  translateX: techFloat5.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -15],
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
              <Animated.View style={[
                styles.logoGlow,
                {
                  opacity: logoGlow,
                },
              ]} />
              <Image source={require('../../../../assets/DOrSU.png')} style={styles.logoImage} />
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
            <Text style={styles.welcomeText}>Create Account</Text>
            <Text style={styles.signInText}>Sign up to get started</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: usernameFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(0, 0, 0, 0.05)', '#2196F3'],
                }),
                shadowOpacity: usernameFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="person" 
                size={20} 
                color="#666" 
                style={styles.inputIcon} 
              />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#666"
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
                borderColor: emailFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(0, 0, 0, 0.05)', '#2196F3'],
                }),
                shadowOpacity: emailFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="email" 
                size={20} 
                color="#666" 
                style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#666"
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
                borderColor: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(0, 0, 0, 0.05)', '#2196F3'],
                }),
                shadowOpacity: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="lock" 
                size={20} 
                color="#666" 
                style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#666"
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
                  color="#666" 
                />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: confirmPasswordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(0, 0, 0, 0.05)', '#2196F3'],
                }),
                shadowOpacity: confirmPasswordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="lock-outline" 
                size={20} 
                color="#666" 
                style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#666"
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
                  color="#666" 
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Animated.View style={{ transform: [{ scale: signUpButtonScale }] }}>
          <TouchableOpacity 
              style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
              onPress={() => handleButtonPress(signUpButtonScale, handleSignUp)}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={isLoading ? "Creating account..." : "Sign up"}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <LinearGradient
                colors={isLoading ? ['#6B7280', '#9CA3AF'] : ['#1F2937', '#374151']}
                style={styles.signUpButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
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
                    <Text style={styles.signUpButtonText}>Creating Account...</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="person-add" size={24} color="white" style={styles.buttonIcon} />
                    <Text style={styles.signUpButtonText}>Sign Up</Text>
                  </>
                )}
              </LinearGradient>
          </TouchableOpacity>
          </Animated.View>

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Already have an account? </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('SignIn')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.signUpLink}>Sign In</Text>
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
    paddingBottom: Platform.OS === 'android' ? 20 : 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing(2.5),
    paddingTop: Platform.OS === 'android' ? theme.spacing(1) : theme.spacing(3),
    paddingBottom: Platform.OS === 'android' ? theme.spacing(2) : theme.spacing(4),
    justifyContent: 'space-between',
  },
  topSection: {
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
    marginBottom: theme.spacing(2),
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
  inputContainer: {
    marginBottom: theme.spacing(2),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing(2),
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
  signUpButton: {
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
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonGradient: {
    paddingVertical: theme.spacing(2.5),
    paddingHorizontal: theme.spacing(3),
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    borderRadius: theme.radii.lg,
    minHeight: 56,
  },
  signUpButtonText: {
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
});

export default CreateAccount; 