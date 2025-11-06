import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { theme } from '../../config/theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  UserSettings: undefined;
  Licenses: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Licenses'>;

const LicensesScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();

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
    <View style={[
      styles.container,
      {
        backgroundColor: theme.colors.surfaceAlt,
        paddingTop: insets.top,
        paddingBottom: 0,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }
    ]}>
      <StatusBar
        backgroundColor={theme.colors.primary}
        barStyle={'light-content'}
        translucent={false}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Licenses</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.descriptionContainer}>
          <Text style={[styles.description, { color: theme.colors.textMuted }]}>
            DOrSU Connect is built using open-source software. This page lists the licenses for the third-party libraries used in this application.
          </Text>
        </View>
        
        <View style={styles.licensesContainer}>
          {licenses.map((license, index) => (
            <View 
              key={index} 
              style={[
                styles.licenseCard, 
                { 
                  backgroundColor: theme.colors.card, 
                  borderColor: theme.colors.border 
                }
              ]}
            >
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
                <View style={[styles.licenseBadge, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.licenseType, { color: theme.colors.accent }]}>
                    {license.license}
                  </Text>
                </View>
                <Text style={[styles.licenseCopyright, { color: theme.colors.textMuted }]}>
                  {license.copyright}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Additional Info */}
        <View style={[
          styles.infoBox, 
          { 
            backgroundColor: theme.colors.card, 
            borderColor: theme.colors.border 
          }
        ]}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.accent} />
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Open Source</Text>
          </View>
          <Text style={[styles.infoText, { color: theme.colors.textMuted }]}>
            DOrSU Connect is built with open-source technologies. We are grateful to the open-source community for their contributions. Full license texts are available in the source code repository.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  headerSpacer: {
    width: 40,
    height: 33,
    marginLeft: 4,
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  descriptionContainer: {
    marginBottom: 18,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
  licensesContainer: {
    gap: 12,
    marginBottom: 18,
  },
  licenseCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    backgroundColor: theme.colors.surface,
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
  infoBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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

