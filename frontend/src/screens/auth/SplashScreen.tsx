import React, { useEffect, useRef } from 'react';
import {
  View,
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
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  SplashScreen: undefined;
  GetStarted: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SplashScreen'>;

const SplashScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();

  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const loadingBarWidth = useRef(new Animated.Value(0)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  

  useEffect(() => {
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
    const navigationTimeout = setTimeout(() => {
      navigation.replace('GetStarted');
    }, 3500);

    return () => clearTimeout(navigationTimeout);
  }, [navigation]);


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
                  backgroundColor: '#2563EB',
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
          colors={['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.5)', 'rgba(29, 78, 216, 0.7)']}
          style={styles.gradientOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        
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
