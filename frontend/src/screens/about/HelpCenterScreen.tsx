import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { theme } from '../../config/theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  UserSettings: undefined;
  HelpCenter: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'HelpCenter'>;

const HelpCenterScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const faqItems = [
    {
      question: 'How do I view school updates?',
      answer: 'Go to the Home tab to see all the latest school announcements and updates.',
    },
    {
      question: 'How do I use AI Chat?',
      answer: 'Tap the chat icon in the bottom navigation and type your question. The AI assistant will help you with academic queries.',
    },
    {
      question: 'How do I view calendar events?',
      answer: 'Tap the calendar icon in the bottom navigation to see all school events and important dates.',
    },
    {
      question: 'How do I change my settings?',
      answer: 'Go to Settings tab to customize your app preferences, including dark mode and language.',
    },
    {
      question: 'How do I update my profile?',
      answer: 'Your profile is automatically synced with your Google account. Changes to your Google profile will reflect here.',
    },
    {
      question: 'How do I contact support?',
      answer: 'Go to Settings > About > Contact Support to reach out to our support team for assistance.',
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
          <Text style={styles.headerTitle}>Help Center</Text>
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
            Find answers to common questions about DOrSU Connect.
          </Text>
        </View>
        
        <View style={styles.faqContainer}>
          {faqItems.map((item, index) => (
            <View 
              key={index} 
              style={[
                styles.faqCard, 
                { 
                  backgroundColor: theme.colors.card, 
                  borderColor: theme.colors.border 
                }
              ]}
            >
              <View style={styles.faqQuestionRow}>
                <Ionicons 
                  name="help-circle-outline" 
                  size={20} 
                  color={theme.colors.accent} 
                  style={styles.faqIcon} 
                />
                <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>
                  {item.question}
                </Text>
              </View>
              <Text style={[styles.faqAnswer, { color: theme.colors.textMuted }]}>
                {item.answer}
              </Text>
            </View>
          ))}
        </View>

        {/* Help Section */}
        <View style={[
          styles.helpBox, 
          { 
            backgroundColor: theme.colors.card, 
            borderColor: theme.colors.border 
          }
        ]}>
          <View style={styles.helpBoxHeader}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.accent} />
            <Text style={[styles.helpBoxTitle, { color: theme.colors.text }]}>Need more help?</Text>
          </View>
          <Text style={[styles.helpBoxText, { color: theme.colors.textMuted }]}>
            Contact our support team for personalized assistance.
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
  faqContainer: {
    gap: 12,
    marginBottom: 18,
  },
  faqCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  faqIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 30,
    opacity: 0.8,
  },
  helpBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  helpBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  helpBoxTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  helpBoxText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.8,
    marginLeft: 30,
  },
});

export default HelpCenterScreen;

