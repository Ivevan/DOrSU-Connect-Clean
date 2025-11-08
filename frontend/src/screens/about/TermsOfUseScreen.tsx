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
  TermsOfUse: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'TermsOfUse'>;

const TermsOfUseScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: 'By accessing and using DOrSU Connect, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Use, please do not use this application.',
    },
    {
      title: '2. Use License',
      content: 'Permission is granted to temporarily access and use DOrSU Connect for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not: modify or copy the materials; use the materials for any commercial purpose or for any public display; attempt to reverse engineer any software contained in the application; remove any copyright or other proprietary notations from the materials.',
    },
    {
      title: '3. User Accounts',
      content: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.',
    },
    {
      title: '4. User Conduct',
      content: 'You agree to use DOrSU Connect only for lawful purposes and in a way that does not infringe the rights of, restrict or inhibit anyone else\'s use and enjoyment of the application. Prohibited behavior includes harassing or causing distress or inconvenience to any person, transmitting obscene or offensive content, or disrupting the normal flow of dialogue within the application.',
    },
    {
      title: '5. Content and Intellectual Property',
      content: 'All content, features, and functionality of DOrSU Connect, including but not limited to text, graphics, logos, icons, images, and software, are the exclusive property of the application and its licensors. The content is protected by copyright, trademark, and other intellectual property laws.',
    },
    {
      title: '6. Privacy Policy',
      content: 'Your use of DOrSU Connect is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices regarding the collection and use of your personal information.',
    },
    {
      title: '7. Disclaimer',
      content: 'The materials on DOrSU Connect are provided on an \'as is\' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.',
    },
    {
      title: '8. Limitations',
      content: 'In no event shall DOrSU Connect or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on DOrSU Connect, even if authorized representative has been notified orally or in writing of the possibility of such damage.',
    },
    {
      title: '9. Revisions and Errata',
      content: 'The materials appearing on DOrSU Connect could include technical, typographical, or photographic errors. We do not warrant that any of the materials on its website are accurate, complete, or current. We may make changes to the materials contained on its website at any time without notice.',
    },
    {
      title: '10. Modifications',
      content: 'We reserve the right to revise these Terms of Use at any time without notice. By using DOrSU Connect, you are agreeing to be bound by the then current version of these Terms of Use.',
    },
    {
      title: '11. Termination',
      content: 'We may terminate or suspend your account and access to DOrSU Connect immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms of Use.',
    },
    {
      title: '12. Governing Law',
      content: 'These Terms of Use shall be governed by and construed in accordance with the laws of the Philippines, without regard to its conflict of law provisions. Any disputes arising under or in connection with these Terms of Use shall be subject to the exclusive jurisdiction of the courts of the Philippines.',
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
          <Text style={styles.headerTitle}>Terms of Use</Text>
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
            Please read these Terms of Use carefully before using DOrSU Connect. By using this application, you agree to be bound by these terms.
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
            These Terms of Use were last updated on January 1, 2024.
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

export default TermsOfUseScreen;

