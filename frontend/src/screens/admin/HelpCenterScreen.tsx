import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const HelpCenterScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();

  const faqItems = [
    {
      question: 'How do I post an update?',
      answer: 'Go to Dashboard, tap the "+" button, fill out the form, and post your update.',
    },
    {
      question: 'How do I manage posts?',
      answer: 'Go to Dashboard, select "Manage Posts" to view, edit, or delete your posts.',
    },
    {
      question: 'How do I use AI Chat?',
      answer: 'Tap the chat icon in the bottom navigation and type your question.',
    },
    {
      question: 'How do I view calendar?',
      answer: 'Tap the calendar icon in the bottom navigation to see school events.',
    },
  ];

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom}]}> 
      {/* Minimalist Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{top: 16, bottom: 16, left: 16, right: 16}}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Help Center</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>FAQ</Text>
        </View>
      </View>
      <View style={[styles.divider, { borderBottomColor: theme.colors.border }]} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: theme.colors.textMuted }]}>Find answers to common questions about DOrSU Connect.</Text>
        <View style={styles.faqContainer}>
          {faqItems.map((item, index) => (
            <View key={index} style={[styles.faqCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }] }>
              <View style={styles.faqQuestionRow}>
                <Ionicons name="help-circle-outline" size={18} color={theme.colors.accent} style={styles.faqIcon} />
                <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>{item.question}</Text>
              </View>
              <Text style={[styles.faqAnswer, { color: theme.colors.textMuted }]}>{item.answer}</Text>
            </View>
          ))}
        </View>
        {/* Help Section */}
        <View style={[styles.helpBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }] }>
          <View style={styles.helpBoxHeader}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.accent} />
            <Text style={[styles.helpBoxTitle, { color: theme.colors.text }]}>Need more help?</Text>
          </View>
          <Text style={[styles.helpBoxText, { color: theme.colors.textMuted }]}>Contact our support team for personalized assistance.</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Minimalist modern header row:
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8, backgroundColor: 'transparent' },
  backButton: { 
    height: 40, width: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'transparent',
    marginRight: 4,
  },
  headerTextBlock: { marginLeft: 4, flex: 1, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: 0.1 },
  subtitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', opacity: 0.7, marginTop: 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: 0 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  faqContainer: { gap: 10, marginBottom: 18 },
  faqCard: { padding: 14, borderRadius: 10, borderWidth: 1 },
  faqQuestionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 7 },
  faqIcon: { marginRight: 8 },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 18 },
  faqAnswer: { fontSize: 12, lineHeight: 16, marginLeft: 26, opacity: 0.7 },
  helpBox: { padding: 12, borderRadius: 8, borderWidth: 1 },
  helpBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  helpBoxTitle: { fontSize: 14, fontWeight: '600' },
  helpBoxText: { fontSize: 13, lineHeight: 20, opacity: 0.7 },
});

export default HelpCenterScreen;
