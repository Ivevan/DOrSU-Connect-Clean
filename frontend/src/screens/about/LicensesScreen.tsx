import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { theme } from '../../config/theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

type RootStackParamList = {
  UserSettings: undefined;
  Licenses: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Licenses'>;

const LicensesScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // Animated floating background orbs (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim2 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;

  // Animate floating background orbs on mount
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

  const licenses = [
    {
      name: 'React Native',
      version: '0.73.x',
      license: 'MIT',
      copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      description: 'A framework for building native apps using React.',
    },
    {
      name: 'Expo',
      version: '50.x',
      license: 'MIT',
      copyright: 'Copyright (c) 2015-present Expo',
      description: 'Tools and services for building React Native applications.',
    },
    {
      name: 'React Navigation',
      version: '6.x',
      license: 'MIT',
      copyright: 'Copyright (c) 2017 React Navigation Contributors',
      description: 'Routing and navigation for React Native apps.',
    },
    {
      name: 'Firebase',
      version: '10.x',
      license: 'Apache-2.0',
      copyright: 'Copyright (c) Google LLC',
      description: 'Backend platform for authentication, database, and cloud services.',
    },
    {
      name: '@react-native-firebase/app',
      version: '18.x',
      license: 'Apache-2.0',
      copyright: 'Copyright (c) Invertase Limited',
      description: 'React Native Firebase integration for native platforms.',
    },
    {
      name: '@react-native-firebase/auth',
      version: '18.x',
      license: 'Apache-2.0',
      copyright: 'Copyright (c) Invertase Limited',
      description: 'Firebase Authentication for React Native.',
    },
    {
      name: '@react-native-google-signin/google-signin',
      version: '10.x',
      license: 'MIT',
      copyright: 'Copyright (c) Google LLC',
      description: 'Google Sign-In for React Native applications.',
    },
    {
      name: 'expo-haptics',
      version: '12.x',
      license: 'MIT',
      copyright: 'Copyright (c) Expo',
      description: 'Provides haptic feedback for iOS and Android devices.',
    },
    {
      name: 'expo-linear-gradient',
      version: '12.x',
      license: 'MIT',
      copyright: 'Copyright (c) Expo',
      description: 'Linear gradient component for React Native.',
    },
    {
      name: 'react-native-safe-area-context',
      version: '4.x',
      license: 'MIT',
      copyright: 'Copyright (c) Th3rdwave',
      description: 'A flexible way to handle safe areas in React Native.',
    },
    {
      name: 'react-native-gesture-handler',
      version: '2.x',
      license: 'MIT',
      copyright: 'Copyright (c) Software Mansion',
      description: 'Declarative API exposing platform native touch and gesture system.',
    },
    {
      name: '@expo/vector-icons',
      version: '13.x',
      license: 'MIT',
      copyright: 'Copyright (c) Expo',
      description: 'Icon library with support for popular icon sets.',
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

      {/* Animated Floating Background Orbs (Copilot-style) */}
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
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Licenses</Text>
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
          <View style={[styles.descriptionCard, { borderColor: theme.colors.border }]}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 20 : 15}
              tint={isDarkMode ? 'dark' : 'light'}
              style={styles.descriptionBlur}
            >
              <View style={[styles.descriptionContent, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                <Text style={[styles.description, { color: theme.colors.textMuted }]}>
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
              style={[styles.licenseCardWrapper, { borderColor: theme.colors.border }]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 20 : 15}
                tint={isDarkMode ? 'dark' : 'light'}
                style={styles.licenseCardBlur}
              >
                <View style={[styles.licenseCard, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                  <View style={styles.licenseHeader}>
                    <Ionicons name="code-outline" size={20} color={theme.colors.accent} />
                    <View style={styles.licenseTitleContainer}>
                      <Text style={[styles.licenseName, { color: theme.colors.text }]}>
                        {license.name}
                      </Text>
                      <Text style={[styles.licenseVersion, { color: theme.colors.textMuted }]}>
                        v{license.version}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.licenseDescription, { color: theme.colors.textMuted }]}>
                    {license.description}
                  </Text>
                  <View style={styles.licenseFooter}>
                    <View style={[styles.licenseBadge, { backgroundColor: isDarkMode ? 'rgba(255, 149, 0, 0.15)' : 'rgba(255, 149, 0, 0.1)' }]}>
                      <Text style={[styles.licenseType, { color: theme.colors.accent }]}>
                        {license.license}
                      </Text>
                    </View>
                    <Text style={[styles.licenseCopyright, { color: theme.colors.textMuted }]}>
                      {license.copyright}
                    </Text>
                  </View>
                </View>
              </BlurView>
            </View>
          ))}
        </View>

        {/* Additional Info */}
        <View style={[styles.infoBoxWrapper, { borderColor: theme.colors.border }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 20 : 15}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.infoBoxBlur}
          >
            <View style={[styles.infoBox, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="information-circle-outline" size={20} color={theme.colors.accent} />
                <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Open Source</Text>
              </View>
              <Text style={[styles.infoText, { color: theme.colors.textMuted }]}>
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
    color: theme.colors.text,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  licenseVersion: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  licenseDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textMuted,
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
    color: theme.colors.accent,
    letterSpacing: 0.5,
  },
  licenseCopyright: {
    fontSize: 11,
    color: theme.colors.textMuted,
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

