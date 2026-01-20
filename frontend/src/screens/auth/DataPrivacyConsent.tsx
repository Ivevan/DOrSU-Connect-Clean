import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Animated, BackHandler, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

type RootStackParamList = {
  DataPrivacyConsent: {
    isAdmin?: boolean;
    userRole?: string;
  };
  AIChat: undefined;
  AdminAIChat: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DataPrivacyConsent'>;
type RouteProp = RouteProp<RootStackParamList, 'DataPrivacyConsent'>;

const DataPrivacyConsent = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { login } = useAuth();
  
  const [isAccepted, setIsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const acceptButtonScale = React.useRef(new Animated.Value(1)).current;
  const loadingRotation = React.useRef(new Animated.Value(0)).current;
  
  const { isAdmin, userRole } = route.params || {};
  
  // Start loading spinner animation when loading
  React.useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(loadingRotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      loadingRotation.stopAnimation();
      loadingRotation.setValue(0);
    }
  }, [isLoading]);
  
  // Prevent back navigation
  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true; // Prevent back navigation
    });
    return () => backHandler.remove();
  }, []);

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

  const handleAccept = async () => {
    if (!isAccepted || isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Store acceptance in AsyncStorage
      await AsyncStorage.setItem('dataPrivacyConsentAccepted', 'true');
      await AsyncStorage.setItem('dataPrivacyConsentAcceptedDate', new Date().toISOString());
      
      // Get user data from AsyncStorage to complete login
      const userToken = await AsyncStorage.getItem('userToken');
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userName = await AsyncStorage.getItem('userName');
      const userId = await AsyncStorage.getItem('userId');
      
      if (userToken && userEmail && userName && userId) {
        // Complete the login process
        await login(userToken, userEmail, userName, userId);
      }
      
      setIsLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate based on user role
      if (isAdmin || userRole === 'admin' || userRole === 'superadmin' || userRole === 'moderator') {
        navigation.replace('AdminAIChat');
      } else {
        navigation.replace('AIChat');
      }
    } catch (error) {
      console.error('Error accepting privacy consent:', error);
      setIsLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const privacyContent = [
    {
      title: 'Data Collection',
      content: 'DOrSU Connect collects and processes personal information including your name, email address, profile information, and usage data to provide and improve our services.',
    },
    {
      title: 'Data Usage',
      content: 'Your personal information is used to authenticate your account, provide personalized services, send notifications, and improve the application experience.',
    },
    {
      title: 'Data Security',
      content: 'We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.',
    },
    {
      title: 'Data Sharing',
      content: 'We do not sell, trade, or rent your personal information to third parties. We may share information only with your consent, to comply with legal obligations, or to protect our rights and safety.',
    },
    {
      title: 'Your Rights',
      content: 'You have the right to access, update, correct, or delete your personal information at any time through the app settings or by contacting support.',
    },
    {
      title: 'Consent',
      content: 'By accepting this Data Privacy Consent, you acknowledge that you have read, understood, and agree to the collection, use, and processing of your personal information as described above.',
    },
  ];

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
          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={Platform.OS === 'ios'}
            >
              <View style={styles.mobileFormCard}>
                {/* Logo and Title Section */}
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

                {/* Title */}
                <Text style={styles.title}>DOrSU Connect – Data Privacy Consent</Text>
                <Text style={styles.subtitle}>Please read and accept the data privacy consent to continue</Text>

                {/* Privacy Content */}
                <ScrollView 
                  style={styles.contentScroll}
                  contentContainerStyle={styles.contentContainer}
                  showsVerticalScrollIndicator={true}
                >
                  {privacyContent.map((section, index) => (
                    <View key={index} style={styles.section}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      <Text style={styles.sectionContent}>{section.content}</Text>
                    </View>
                  ))}
                </ScrollView>

                {/* Checkbox */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => {
                    setIsAccepted(!isAccepted);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    isAccepted && styles.checkboxChecked,
                    isAccepted && { backgroundColor: '#2563EB', borderColor: '#2563EB' }
                  ]}>
                    {isAccepted && (
                      <MaterialIcons name="check" size={20} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    I have read and agree to the Data Privacy Consent
                  </Text>
                </TouchableOpacity>

                {/* Accept Button */}
                <Animated.View style={{ transform: [{ scale: acceptButtonScale }] }}>
                  <TouchableOpacity 
                    style={[
                      styles.acceptButton,
                      (!isAccepted || isLoading) && styles.acceptButtonDisabled
                    ]}
                    onPress={() => handleButtonPress(acceptButtonScale, handleAccept)}
                    disabled={!isAccepted || isLoading}
                    accessibilityRole="button"
                    accessibilityLabel={isLoading ? "Processing..." : "Accept and Continue"}
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
                        <Text style={styles.acceptButtonText}>Processing...</Text>
                      </>
                    ) : (
                      <Text style={styles.acceptButtonText}>ACCEPT & CONTINUE</Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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
    marginBottom: 20,
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  contentScroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  contentContainer: {
    paddingBottom: 10,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  acceptButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#9CA3AF',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingSpinner: {
    marginRight: 8,
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    maxHeight: '90%',
  },
});

export default DataPrivacyConsent;

