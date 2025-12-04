import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

type RootStackParamList = {
  UserSettings: undefined;
  AdminSettings: undefined;
  Licenses: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Licenses'>;

const LicensesScreen = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useThemeValues();
  const navigation = useNavigation<NavigationProp>();

  // Helper function to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Animated floating background orb (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;

  // Animate floating background orb on mount
  useEffect(() => {
    const animation = Animated.loop(
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
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const licenses = [
    {
      name: 'React',
      version: '19.0.0',
      license: 'MIT',
      copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      description: 'A JavaScript library for building user interfaces.',
    },
    {
      name: 'React Native',
      version: '0.79.5',
      license: 'MIT',
      copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      description: 'A framework for building native apps using React.',
    },
    {
      name: 'Expo',
      version: '53.0.10',
      license: 'MIT',
      copyright: 'Copyright (c) 2015-present Expo',
      description: 'Tools and services for building React Native applications.',
    },
    {
      name: '@react-navigation/native',
      version: '7.1.14',
      license: 'MIT',
      copyright: 'Copyright (c) 2017 React Navigation Contributors',
      description: 'Routing and navigation for React Native apps.',
    },
    {
      name: '@react-navigation/native-stack',
      version: '7.3.21',
      license: 'MIT',
      copyright: 'Copyright (c) 2017 React Navigation Contributors',
      description: 'Native stack navigator for React Navigation.',
    },
    {
      name: 'Firebase',
      version: '9.23.0',
      license: 'Apache-2.0',
      copyright: 'Copyright (c) Google LLC',
      description: 'Backend platform for authentication, database, and cloud services.',
    },
    {
      name: '@react-native-firebase/app',
      version: '23.5.0',
      license: 'Apache-2.0',
      copyright: 'Copyright (c) Invertase Limited',
      description: 'React Native Firebase integration for native platforms.',
    },
    {
      name: '@react-native-firebase/auth',
      version: '23.5.0',
      license: 'Apache-2.0',
      copyright: 'Copyright (c) Invertase Limited',
      description: 'Firebase Authentication for React Native.',
    },
    {
      name: '@react-native-google-signin/google-signin',
      version: '12.2.1',
      license: 'MIT',
      copyright: 'Copyright (c) Google LLC',
      description: 'Google Sign-In for React Native applications.',
    },
    {
      name: '@expo/vector-icons',
      version: '14.1.0',
      license: 'MIT',
      copyright: 'Copyright (c) Expo',
      description: 'Icon library with support for popular icon sets.',
    },
    {
      name: 'expo-blur',
      version: '14.1.5',
      license: 'MIT',
      copyright: 'Copyright (c) Expo',
      description: 'Provides blur effects for React Native.',
    },
    {
      name: 'expo-haptics',
      version: '14.1.4',
      license: 'MIT',
      copyright: 'Copyright (c) Expo',
      description: 'Provides haptic feedback for iOS and Android devices.',
    },
    {
      name: 'expo-linear-gradient',
      version: '14.1.5',
      license: 'MIT',
      copyright: 'Copyright (c) Expo',
      description: 'Linear gradient component for React Native.',
    },
    {
      name: 'expo-document-picker',
      version: '13.1.6',
      license: 'MIT',
      copyright: 'Copyright (c) Expo',
      description: 'Document picker for selecting files from device.',
    },
    {
      name: 'react-native-safe-area-context',
      version: '5.4.0',
      license: 'MIT',
      copyright: 'Copyright (c) Th3rdwave',
      description: 'A flexible way to handle safe areas in React Native.',
    },
    {
      name: 'react-native-gesture-handler',
      version: '2.24.0',
      license: 'MIT',
      copyright: 'Copyright (c) Software Mansion',
      description: 'Declarative API exposing platform native touch and gesture system.',
    },
    {
      name: 'react-native-reanimated',
      version: '3.17.4',
      license: 'MIT',
      copyright: 'Copyright (c) Software Mansion',
      description: 'React Native Reanimated library for smooth animations.',
    },
    {
      name: 'react-native-screens',
      version: '4.11.1',
      license: 'MIT',
      copyright: 'Copyright (c) Software Mansion',
      description: 'Native navigation primitives for React Native.',
    },
    {
      name: '@react-native-async-storage/async-storage',
      version: '2.1.2',
      license: 'MIT',
      copyright: 'Copyright (c) React Native Community',
      description: 'Asynchronous, persistent, key-value storage for React Native.',
    },
    {
      name: 'react-native-markdown-display',
      version: '7.0.2',
      license: 'MIT',
      copyright: 'Copyright (c) React Native Markdown Display Contributors',
      description: 'Markdown renderer for React Native.',
    },
    {
      name: 'dayjs',
      version: '1.11.11',
      license: 'MIT',
      copyright: 'Copyright (c) dayjs Contributors',
      description: 'Fast 2KB immutable date library alternative to Moment.js.',
    },
    {
      name: 'lottie-react-native',
      version: '7.2.2',
      license: 'Apache-2.0',
      copyright: 'Copyright (c) Airbnb',
      description: 'Lottie animations for React Native.',
    },
    {
      name: '@react-native-community/netinfo',
      version: '11.4.1',
      license: 'MIT',
      copyright: 'Copyright (c) React Native Community',
      description: 'Network information API for React Native.',
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        translucent={true}
      />

      {/* Background Gradient Layer */}
      <LinearGradient
        colors={[
          isDarkMode ? '#0B1220' : '#FBF8F3',
          isDarkMode ? '#111827' : '#F8F5F0',
          isDarkMode ? '#1F2937' : '#F5F2ED'
        ]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      
      {/* Blur overlay on entire background - very subtle */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint="default"
        style={styles.backgroundGradient}
      />

      {/* Animated Floating Background Orb (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
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
              colors={[t.colors.orbColors.orange1, t.colors.orbColors.orange2, t.colors.orbColors.orange3]}
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

      {/* Header - Copilot Style */}
      <View style={[styles.header, { 
        marginTop: insets.top,
        marginLeft: insets.left,
        marginRight: insets.right,
      }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(17) }]}>Licenses</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.descriptionContainer}>
          <View style={[styles.descriptionCard, { borderColor: t.colors.border }]}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 20 : 15}
              tint={isDarkMode ? 'dark' : 'light'}
              style={styles.descriptionBlur}
            >
              <View style={[styles.descriptionContent, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                <Text style={[styles.description, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(14) }]}>
                  DOrSU Connect is built using open-source software. This page lists the licenses for the third-party libraries used in this application.
                </Text>
              </View>
            </BlurView>
          </View>
        </View>
        
        <View style={styles.licensesContainer}>
          {licenses.map((license, index) => (
            <View 
              key={index} 
              style={[styles.licenseCardWrapper, { borderColor: t.colors.border }]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 20 : 15}
                tint={isDarkMode ? 'dark' : 'light'}
                style={styles.licenseCardBlur}
              >
                <View style={[styles.licenseCard, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                  <View style={styles.licenseHeader}>
                    <Ionicons name="code-outline" size={20} color={t.colors.accent} />
                    <View style={styles.licenseTitleContainer}>
                      <Text style={[styles.licenseName, { color: t.colors.text, fontSize: t.fontSize.scaleSize(16) }]}>
                        {license.name}
                      </Text>
                      <Text style={[styles.licenseVersion, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(12) }]}>
                        v{license.version}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.licenseDescription, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(13) }]}>
                    {license.description}
                  </Text>
                  <View style={styles.licenseFooter}>
                    <View style={[styles.licenseBadge, { 
                      backgroundColor: isDarkMode 
                        ? hexToRgba(t.colors.accent, 0.15) 
                        : hexToRgba(t.colors.accent, 0.1)
                    }]}>
                      <Text style={[styles.licenseType, { color: t.colors.accent, fontSize: t.fontSize.scaleSize(11) }]}>
                        {license.license}
                      </Text>
                    </View>
                    <Text style={[styles.licenseCopyright, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(11) }]}>
                      {license.copyright}
                    </Text>
                  </View>
                </View>
              </BlurView>
            </View>
          ))}
        </View>

        {/* Additional Info */}
        <View style={[styles.infoBoxWrapper, { borderColor: t.colors.border }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 20 : 15}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.infoBoxBlur}
          >
            <View style={[styles.infoBox, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="information-circle-outline" size={20} color={t.colors.accent} />
                <Text style={[styles.infoTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(15) }]}>Open Source</Text>
              </View>
              <Text style={[styles.infoText, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(13) }]}>
                DOrSU Connect is built with open-source technologies. We are grateful to the open-source community for their contributions. Full license texts are available in the source code repository.
              </Text>
            </View>
          </BlurView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
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
  floatingOrb1: {
    width: 500,
    height: 500,
    borderRadius: 250,
    opacity: 0.5,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerLeft: {
    width: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  descriptionCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  descriptionBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  descriptionContent: {
    padding: 16,
    borderRadius: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  licensesContainer: {
    gap: 12,
    marginBottom: 18,
  },
  licenseCardWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  licenseCardBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  licenseCard: {
    padding: 16,
    borderRadius: 12,
  },
  licenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  licenseTitleContainer: {
    flex: 1,
  },
  licenseName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  licenseVersion: {
    fontSize: 12,
    fontWeight: '500',
  },
  licenseDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
    marginBottom: 12,
  },
  licenseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  licenseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  licenseType: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  licenseCopyright: {
    fontSize: 11,
    opacity: 0.8,
    flex: 1,
    textAlign: 'right',
  },
  infoBoxWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoBoxBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.8,
    marginLeft: 30,
  },
});

export default LicensesScreen;

