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
  PrivacyPolicy: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PrivacyPolicy'>;

const PrivacyPolicyScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();

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
          <Text style={styles.headerTitle}>Privacy Policy</Text>
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
            Your privacy is important to us. This Privacy Policy explains how DOrSU Connect collects, uses, and protects your personal information.
          </Text>
        </View>
        
        <View style={styles.sectionsContainer}>
          {sections.map((section, index) => (
            <View 
              key={index} 
              style={[
                styles.sectionCard, 
                { 
                  backgroundColor: theme.colors.card, 
                  borderColor: theme.colors.border 
                }
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {section.title}
              </Text>
              <Text style={[styles.sectionContent, { color: theme.colors.textMuted }]}>
                {section.content}
              </Text>
            </View>
          ))}
        </View>

        {/* Last Updated */}
        <View style={[
          styles.lastUpdatedBox, 
          { 
            backgroundColor: theme.colors.card, 
            borderColor: theme.colors.border 
          }
        ]}>
          <View style={styles.lastUpdatedHeader}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.accent} />
            <Text style={[styles.lastUpdatedTitle, { color: theme.colors.text }]}>Last Updated</Text>
          </View>
          <Text style={[styles.lastUpdatedText, { color: theme.colors.textMuted }]}>
            This Privacy Policy was last updated on January 1, 2024.
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
  sectionsContainer: {
    gap: 12,
    marginBottom: 18,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  lastUpdatedBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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

