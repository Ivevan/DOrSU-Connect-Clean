import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Platform, StatusBar, Image, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useRef } from 'react';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { lightTheme as theme } from '../theme';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  AdminDashboard: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'GetStarted'>;

const { width, height } = Dimensions.get('window');

const GetStarted = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const emailButtonScale = useRef(new Animated.Value(1)).current;
  const signUpButtonScale = useRef(new Animated.Value(1)).current;
  const signInButtonScale = useRef(new Animated.Value(1)).current;
  const emailLoadingOpacity = useRef(new Animated.Value(0)).current;
  const [isEmailLoading, setIsEmailLoading] = React.useState(false);
  const floatingAnimation = useRef(new Animated.Value(0)).current;
  const techFloat1 = useRef(new Animated.Value(0)).current;
  const techFloat2 = useRef(new Animated.Value(0)).current;
  const techFloat3 = useRef(new Animated.Value(0)).current;

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
      navigation.navigate('AdminDashboard');
    });
  };

  const handleEmailPress = () => {
    // Haptic feedback for email button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setIsEmailLoading(true);
    Animated.parallel([
      Animated.timing(emailButtonScale, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(emailLoadingOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Simulate loading for 2 seconds
    setTimeout(() => {
      setIsEmailLoading(false);
      // Success haptic feedback when loading completes
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Animated.parallel([
        Animated.timing(emailButtonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(emailLoadingOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }, 2000);
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
        animated={true}
      />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Tech Overlay Pattern */}
      <View style={styles.techOverlay}>
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
      </View>
      
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.topSection}>
          <TouchableOpacity 
            onPress={handleLogoPress}
            activeOpacity={1}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            accessibilityRole="button"
            accessibilityLabel="DOrSU Connect logo"
            accessibilityHint="Double tap to access admin dashboard"
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
              
              <Image source={require('../../assets/DOrSU.png')} style={styles.logoImage} />
              
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
          <Text 
            style={styles.title}
            accessibilityRole="header"
          >
            DOrSU CONNECT
          </Text>
          <Text 
            style={styles.subtitle}
            accessibilityRole="text"
          >
            Your Academic AI Assistant
          </Text>
          <Text 
            style={styles.aiText}
            accessibilityRole="text"
          >
            AI Powered
          </Text>
        </View>

        {/* Buttons Section */}
        <View style={styles.buttonsSection}>
          <View style={styles.buttonContainer}>
            <Animated.View style={{ transform: [{ scale: emailButtonScale }] }}>
              <TouchableOpacity 
                style={styles.emailButton} 
                onPress={handleEmailPress}
                disabled={isEmailLoading}
                accessibilityRole="button"
                accessibilityLabel="Quick start with email"
                accessibilityHint="Double tap to quickly set up your account with email"
                accessibilityState={{ disabled: isEmailLoading }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F8FAFC']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {!isEmailLoading ? (
                    <>
                      <MaterialCommunityIcons name="email-fast" size={24} color="black" style={styles.buttonIcon} />
                      <Text style={styles.emailButtonText}>Quick Start with Email</Text>
                    </>
                  ) : (
                    <>
                      <Animated.View style={{ opacity: emailLoadingOpacity }}>
                        <MaterialCommunityIcons name="loading" size={24} color="black" style={styles.buttonIcon} />
                      </Animated.View>
                      <Text style={styles.emailButtonText}>Setting up your account...</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            
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
                <LinearGradient
                  colors={['#1F2937', '#374151']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialIcons name="person-add" size={24} color="white" style={styles.buttonIcon} />
                  <Text style={styles.darkButtonText}>Create Account</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

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
                <LinearGradient
                  colors={['#1F2937', '#374151']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialIcons name="login" size={24} color="white" style={styles.buttonIcon} />
                  <Text style={styles.darkButtonText}>Sign In</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
        
        {/* University Branding Section */}
        <View style={styles.universityContainer}>
          <View style={styles.universityDivider} />
          <Text 
            style={styles.universityText}
            accessibilityRole="text"
          >
            Davao Oriental State University
          </Text>
          <Text 
            style={styles.universitySubtext}
            accessibilityRole="text"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Empowering Minds • Connecting Futures
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing(2.5),
    paddingTop: Platform.OS === 'android' ? theme.spacing(2) : theme.spacing(4),
    paddingBottom: Platform.OS === 'android' ? theme.spacing(4) : theme.spacing(6),
    justifyContent: 'flex-start', // Changed to ensure branding section is visible
  },
  topSection: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(5), // Further reduced for better space distribution
    paddingBottom: theme.spacing(2), // Further reduced for better space distribution
    minHeight: height * 0.4, // Reduced from 50% to 40% for more button space
  },
  logoImage: {
    width: width * 0.28,
    height: width * 0.28,
    marginBottom: theme.spacing(3), // Reduced for more compact layout
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
    color: theme.colors.text,
    marginBottom: theme.spacing(2), // Increased for better hierarchy
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
    color: theme.colors.text,
    marginBottom: theme.spacing(1.5), // Increased for better separation
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  aiText: {
    fontSize: 15,
    fontWeight: '400',
    color: theme.colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: theme.spacing(1), // Further reduced for tighter spacing
  },
  buttonsSection: {
    width: '100%',
    paddingHorizontal: theme.spacing(1),
    justifyContent: 'flex-start',
    paddingTop: theme.spacing(1), // Reduced for tighter spacing
  },
  bottomSection: {
    width: '100%',
    paddingHorizontal: theme.spacing(1), // Add horizontal padding for better button alignment
  },
  buttonContainer: {
    width: '100%',
    gap: theme.spacing(1.5), // Reduced gap for tighter button spacing
  },
  emailButton: {
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    ...theme.shadow2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  buttonGradient: {
    paddingVertical: theme.spacing(2.5), // Reduced vertical padding
    paddingHorizontal: theme.spacing(3),
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    borderRadius: theme.radii.lg,
    minHeight: 56, // Reduced height for more compact buttons
  },
  emailButtonText: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginLeft: theme.spacing(1.5),
    letterSpacing: 0.3,
  },
  darkButton: {
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    ...theme.shadow2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  darkButtonText: {
    color: theme.colors.surface,
    fontSize: 17,
    fontWeight: '600',
    marginLeft: theme.spacing(1.5),
    letterSpacing: 0.3,
  },
  buttonIcon: {
    marginRight: theme.spacing(1),
  },
  universityContainer: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(2), // Reduced for tighter spacing
    marginTop: 'auto', // Push to bottom of available space
  },
  universityDivider: {
    width: 80, // Increased width for better visual impact
    height: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: 1,
    marginBottom: theme.spacing(2), // Reduced for tighter spacing
    opacity: 0.8, // Increased opacity for better visibility
  },
  universityText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 24,
    marginBottom: theme.spacing(1), // Reduced for tighter spacing
  },
  universitySubtext: {
    fontSize: 12, // Slightly reduced for single line
    fontWeight: '400',
    color: theme.colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.6, // Reduced letter spacing for single line
    lineHeight: 16, // Reduced line height
    textTransform: 'uppercase',
    marginBottom: theme.spacing(2),
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
});

export default GetStarted; 