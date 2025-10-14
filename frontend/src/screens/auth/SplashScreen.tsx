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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { lightTheme as theme } from '../../config/theme';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  SplashScreen: undefined;
  GetStarted: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SplashScreen'>;

const SplashScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const backgroundOpacity = useRef(new Animated.Value(0)).current;
  const loadingBarWidth = useRef(new Animated.Value(0)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  
  // Tech overlay animations
  const techFloat1 = useRef(new Animated.Value(0)).current;
  const techFloat2 = useRef(new Animated.Value(0)).current;
  const techFloat3 = useRef(new Animated.Value(0)).current;
  const techFloat4 = useRef(new Animated.Value(0)).current;
  const techFloat5 = useRef(new Animated.Value(0)).current;
  const techFloat6 = useRef(new Animated.Value(0)).current;
  const techFloat7 = useRef(new Animated.Value(0)).current;
  const techFloat8 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start the animation sequence
    const startAnimations = () => {
      // Background fade in
      Animated.timing(backgroundOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();

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

  // Start tech floating animations
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


  return (
    <View style={[styles.container, {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
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

      <View style={styles.content}>
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
          <View style={styles.loadingBarBackground}>
            <Animated.View
              style={[
                styles.loadingBar,
                {
                  width: loadingBarWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </Animated.View>

      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing(4),
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(3),
  },
  logoWrapper: {
    width: width * 0.4,
    height: width * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: theme.spacing(2),
  },
  loadingBarBackground: {
    width: width * 0.8,
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
});

export default SplashScreen;
