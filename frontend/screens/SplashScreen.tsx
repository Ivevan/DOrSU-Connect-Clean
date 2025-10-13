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
import { lightTheme as theme } from '../theme';

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
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(20)).current;
  const backgroundOpacity = useRef(new Animated.Value(0)).current;

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
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          delay: 200,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Title animation
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          delay: 600,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 600,
          delay: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Subtitle animation
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 500,
          delay: 800,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 500,
          delay: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Navigate to GetStarted after animation completes
      setTimeout(() => {
        navigation.replace('GetStarted');
      }, 2500);
    };

    startAnimations();
  }, [navigation]);


  return (
    <View style={[styles.container, {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent={true}
        animated={true}
      />
      
      <Animated.View style={[styles.background, { opacity: backgroundOpacity }]}>
        <LinearGradient
          colors={['#0B1220', '#1F2937', '#374151']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
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
              source={require('../../assets/DOrSU.png')}
              style={styles.logoImage as any}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Title */}
        <Animated.View
          style={[
            styles.titleContainer,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          <Text style={styles.title}>DOrSU CONNECT</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View
          style={[
            styles.subtitleContainer,
            {
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }],
            },
          ]}
        >
          <Text style={styles.subtitle}>Your Academic AI Assistant</Text>
          <Text style={styles.aiText}>AI Powered • Connected • Smart</Text>
        </Animated.View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradient: {
    flex: 1,
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
    marginBottom: theme.spacing(6),
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
  titleContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing(4),
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitleContainer: {
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#E5E7EB',
    textAlign: 'center',
    marginBottom: theme.spacing(1),
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  aiText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 1,
  },
});

export default SplashScreen;
