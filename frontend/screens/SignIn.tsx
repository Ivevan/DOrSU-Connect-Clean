import { StyleSheet, Text, View, TextInput, TouchableOpacity, Dimensions, Platform, StatusBar, Image, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';

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
  const techFloat1 = useRef(new Animated.Value(0)).current;
  const techFloat2 = useRef(new Animated.Value(0)).current;
  const techFloat3 = useRef(new Animated.Value(0)).current;
  const techFloat4 = useRef(new Animated.Value(0)).current;
  const techFloat5 = useRef(new Animated.Value(0)).current;
  const techFloat6 = useRef(new Animated.Value(0)).current;
  const techFloat7 = useRef(new Animated.Value(0)).current;
  const techFloat8 = useRef(new Animated.Value(0)).current;
  
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

  const handleClose = () => {
    navigation.navigate('GetStarted');
  };

  // Function to handle sign in button press
  const handleSignIn = () => {
    navigation.navigate('SchoolUpdates');
  };
  return (
    <View style={[styles.container, {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}
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
        
        {/* Additional floating tech elements */}
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
        
        <Animated.View style={[
          styles.techFloatElement6,
          {
            opacity: techFloat6.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 0.9],
            }),
            transform: [
              {
                translateY: techFloat6.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 18],
                })
              },
              {
                rotate: techFloat6.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                })
              }
            ]
          }
        ]} />
        
        <Animated.View style={[
          styles.techFloatElement7,
          {
            opacity: techFloat7.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.6],
            }),
            transform: [
              {
                translateX: techFloat7.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10],
                })
              },
              {
                scale: techFloat7.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.1],
                })
              }
            ]
          }
        ]} />
        
        <Animated.View style={[
          styles.techFloatElement8,
          {
            opacity: techFloat8.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 0.8],
            }),
            transform: [
              {
                translateY: techFloat8.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -12],
                })
              },
              {
                translateX: techFloat8.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 6],
                })
              },
              {
                rotate: techFloat8.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '90deg'],
                })
              }
            ]
          }
        ]} />
      </Animated.View>
      
      <Animated.View style={[
        styles.content,
        {
          opacity: screenOpacity,
          transform: [{ translateY: contentTranslateY }],
        },
      ]}>
        {/* Logo and Title Section */}
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <Image source={require('../../assets/DOrSU.png')} style={styles.logoImage} />
            <Text style={styles.title}>DOrSU Connect</Text>
            <Text style={styles.subtitle}>Your Academic AI Assistant</Text>
          </View>

          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.signInText}>Sign in to continue</Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#666"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#666"
              secureTextEntry
            />
            <TouchableOpacity 
              style={styles.forgotPassword}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={{ transform: [{ scale: signInButtonScale }] }}>
            <TouchableOpacity 
              style={styles.signInButton}
              onPress={() => handleButtonPress(signInButtonScale, handleSignIn)}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              accessibilityHint="Double tap to sign in to your DOrSU Connect account"
              accessibilityState={{ disabled: false }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <LinearGradient
                colors={['#1F2937', '#374151']}
                style={styles.signInButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialIcons name="login" size={24} color="white" style={styles.buttonIcon} />
                <Text style={styles.signInButtonText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('CreateAccount')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
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
    paddingHorizontal: theme.spacing(2.5),
    paddingTop: Platform.OS === 'android' ? theme.spacing(1) : theme.spacing(5.5),
    paddingBottom: Platform.OS === 'android' ? theme.spacing(2.5) : theme.spacing(4.25),
  },
  topSection: {
    marginTop: theme.spacing(2.5),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing(5),
  },
  logoImage: {
    width: width * 0.2,
    height: width * 0.2,
    marginBottom: theme.spacing(2),
    resizeMode: 'contain',
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: theme.spacing(5),
    marginTop: theme.spacing(2.5),
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  signInText: {
    fontSize: 17,
    color: theme.colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: theme.spacing(3),
  },
  input: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(2),
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing(2),
    fontSize: 16,
    ...theme.shadow1,
    fontWeight: '500',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: theme.colors.text,
    fontSize: 14,
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

export default SignIn; 