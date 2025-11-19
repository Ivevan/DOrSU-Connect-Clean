import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  Image,
  Easing,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  SplashScreen: undefined;
  GetStarted: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SplashScreen'>;

const SplashScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useTheme();

  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const loadingBarWidth = useRef(new Animated.Value(0)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  
  // Floating background orbs (Copilot-style) - same as AIChat
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim2 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start the animation sequence
    const startAnimations = () => {
      // Logo entrance animation
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          delay: 300,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          delay: 300,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Start loading bar animation after logo appears
        Animated.parallel([
          Animated.timing(loadingOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(loadingBarWidth, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ]).start();
      });

      // Navigate to GetStarted after loading completes
      setTimeout(() => {
        navigation.replace('GetStarted');
      }, 3500);
    };

    startAnimations();
  }, [navigation]);

  // Animate floating background orbs on mount (same as AIChat)
  useEffect(() => {
    const animations = [
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
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(cloudAnim1, {
            toValue: 1,
            duration: 15000,
            useNativeDriver: true,
          }),
          Animated.timing(cloudAnim1, {
            toValue: 0,
            duration: 15000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(cloudAnim2, {
            toValue: 1,
            duration: 20000,
            useNativeDriver: true,
          }),
          Animated.timing(cloudAnim2, {
            toValue: 0,
            duration: 20000,
            useNativeDriver: true,
          }),
        ])
      ),
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
      ),
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
      ),
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
      ),
    ];

    animations.forEach(anim => anim.start());
  }, []);


  // Render splash content
  const renderSplashContent = () => {
    return (
      <>
        {/* Logo Container */}
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require('../../../../assets/DOrSU.png')}
              style={styles.logoImage as any}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Loading Bar */}
        <Animated.View
          style={[
            styles.loadingContainer,
            {
              opacity: loadingOpacity,
            },
          ]}
        >
          <View style={[styles.loadingBarBackground, {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }]}>
            <Animated.View
              style={[
                styles.loadingBar,
                {
                  backgroundColor: '#FF9500',
                  width: loadingBarWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </Animated.View>
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
      
      {/* Mobile Layout - Full screen with background */}
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
        
        {/* Animated Floating Background Orbs */}
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

            {/* Cloud variation 1 - Top left soft light patch */}
            <Animated.View
              style={[
                styles.cloudWrapper,
                {
                  top: '15%',
                  left: '10%',
                  transform: [
                    {
                      translateX: cloudAnim1.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 20],
                      }),
                    },
                    {
                      translateY: cloudAnim1.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -15],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.cloudPatch1}>
                <LinearGradient
                  colors={['rgba(255, 200, 150, 0.4)', 'rgba(255, 210, 170, 0.22)', 'rgba(255, 230, 200, 0.1)']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              </View>
            </Animated.View>

            {/* Cloud variation 2 - Bottom right gentle tone */}
            <Animated.View
              style={[
                styles.cloudWrapper,
                {
                  bottom: '20%',
                  right: '15%',
                  transform: [
                    {
                      translateX: cloudAnim2.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -25],
                      }),
                    },
                    {
                      translateY: cloudAnim2.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 10],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.cloudPatch2}>
                <LinearGradient
                  colors={['rgba(255, 190, 140, 0.32)', 'rgba(255, 200, 160, 0.18)', 'rgba(255, 220, 190, 0.08)']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0.3, y: 0.3 }}
                  end={{ x: 1, y: 1 }}
                />
              </View>
            </Animated.View>

            {/* Orb 1 - Soft Orange Glow (Center area) */}
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

          <View style={[styles.mobileOverlay, { paddingTop: insets.top }]}>
            <View style={styles.mobileContentCard}>
              {renderSplashContent()}
            </View>
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
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
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
  cloudPatch1: {
    width: 350,
    height: 350,
    borderRadius: 175,
    opacity: 0.25,
    overflow: 'hidden',
  },
  cloudPatch2: {
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.22,
    overflow: 'hidden',
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
  // Logo and Loading Styles
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    width: width * 0.3,
    height: width * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        width: 200,
        height: 200,
      },
    }),
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
  },
  loadingBarBackground: {
    width: '100%',
    maxWidth: 400,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    borderRadius: 4,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileContentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    margin: 16,
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    width: width * 0.9,
    maxWidth: 400,
  },
});

export default SplashScreen;
