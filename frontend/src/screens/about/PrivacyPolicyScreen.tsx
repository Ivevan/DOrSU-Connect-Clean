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
  PrivacyPolicy: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PrivacyPolicy'>;

const PrivacyPolicyScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();

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
  }, [floatAnim1]);

  const sections = [
    {
      title: '1. Information We Collect',
      content: 'DOrSU Connect collects information that you provide directly to us, including your name, email address, and profile information when you create an account or use Google Sign-In. We also collect information about how you use the application, including your interactions with features, posts, and other users.',
    },
    {
      title: '2. How We Use Your Information',
      content: 'We use the information we collect to provide, maintain, and improve our services, process your transactions, send you notifications, respond to your inquiries, and communicate with you about updates and important information related to your account and the DOrSU Connect platform.',
    },
    {
      title: '3. Information Sharing and Disclosure',
      content: 'We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances: with your consent, to comply with legal obligations, to protect our rights and safety, or with service providers who assist us in operating our platform (under strict confidentiality agreements).',
    },
    {
      title: '4. Google Sign-In',
      content: 'When you use Google Sign-In, we collect your Google account information (name, email, profile picture) as provided by Google. This information is used solely for account creation and authentication purposes. Your use of Google Sign-In is also subject to Google\'s Privacy Policy.',
    },
    {
      title: '5. Data Security',
      content: 'We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.',
    },
    {
      title: '6. Data Retention',
      content: 'We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When you delete your account, we will delete or anonymize your personal information, subject to legal retention requirements.',
    },
    {
      title: '7. Your Rights and Choices',
      content: 'You have the right to access, update, correct, or delete your personal information at any time through the app settings or by contacting us. You can also opt out of certain communications from us. Please note that some information may be retained in our records as required by law or for legitimate business purposes.',
    },
    {
      title: '8. Children\'s Privacy',
      content: 'DOrSU Connect is intended for use by students and faculty of DOrSU. We do not knowingly collect personal information from children under the age of 13 without parental consent. If we become aware that we have collected such information, we will take steps to delete it promptly.',
    },
    {
      title: '9. Third-Party Services',
      content: 'Our application may contain links to third-party websites or services that are not owned or controlled by us. We are not responsible for the privacy practices of these third-party services. We encourage you to review their privacy policies before providing any information.',
    },
    {
      title: '10. Changes to This Privacy Policy',
      content: 'We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the new Privacy Policy in the app and updating the "Last Updated" date. Your continued use of the app after such changes constitutes your acceptance of the updated Privacy Policy.',
    },
    {
      title: '11. Contact Us',
      content: 'If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us through the Contact Support feature in the app or via the contact information provided in the Terms of Use.',
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
        {/* Orb 1 */}
        <Animated.View
          style={[
            styles.floatingOrbWrapper,
            {
              top: '35%',
              left: '50%',
              marginLeft: -250,
              transform: [
                { translateX: floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] }) },
                { translateY: floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [-20, 20] }) },
                { scale: floatAnim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] }) },
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
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Privacy Policy</Text>
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
                  Your privacy is important to us. This Privacy Policy explains how DOrSU Connect collects, uses, and protects your personal information.
                </Text>
              </View>
            </BlurView>
          </View>
        </View>
        
        <View style={styles.sectionsContainer}>
          {sections.map((section, index) => (
            <View 
              key={index} 
              style={[styles.sectionCardWrapper, { borderColor: theme.colors.border }]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 20 : 15}
                tint={isDarkMode ? 'dark' : 'light'}
                style={styles.sectionCardBlur}
              >
                <View style={[styles.sectionCard, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    {section.title}
                  </Text>
                  <Text style={[styles.sectionContent, { color: theme.colors.textMuted }]}>
                    {section.content}
                  </Text>
                </View>
              </BlurView>
            </View>
          ))}
        </View>

        {/* Last Updated */}
        <View style={[styles.lastUpdatedBoxWrapper, { borderColor: theme.colors.border }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 20 : 15}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.lastUpdatedBoxBlur}
          >
            <View style={[styles.lastUpdatedBox, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
              <View style={styles.lastUpdatedHeader}>
                <Ionicons name="information-circle-outline" size={20} color={theme.colors.accent} />
                <Text style={[styles.lastUpdatedTitle, { color: theme.colors.text }]}>Last Updated</Text>
              </View>
              <Text style={[styles.lastUpdatedText, { color: theme.colors.textMuted }]}>
                This Privacy Policy was last updated on January 1, 2024.
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
  sectionsContainer: {
    gap: 12,
    marginBottom: 18,
  },
  sectionCardWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionCardBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: theme.colors.text,
    letterSpacing: 0.2,
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
    opacity: 0.9,
  },
  lastUpdatedBoxWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  lastUpdatedBoxBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  lastUpdatedBox: {
    padding: 16,
    borderRadius: 12,
  },
  lastUpdatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  lastUpdatedTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  lastUpdatedText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.8,
    marginLeft: 30,
  },
});

export default PrivacyPolicyScreen;

