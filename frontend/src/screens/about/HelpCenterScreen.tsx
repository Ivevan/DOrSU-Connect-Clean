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
  HelpCenter: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'HelpCenter'>;

const HelpCenterScreen = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useThemeValues();
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
  }, []);

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
    <View style={styles.container}>
      <StatusBar backgroundColor="transparent" barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent={true} />
      <LinearGradient colors={[isDarkMode ? '#0B1220' : '#FBF8F3', isDarkMode ? '#111827' : '#F8F5F0', isDarkMode ? '#1F2937' : '#F5F2ED']} style={styles.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <BlurView intensity={Platform.OS === 'ios' ? 5 : 3} tint="default" style={styles.backgroundGradient} />
      <View style={styles.floatingBgContainer} pointerEvents="none">
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
      <View style={[styles.header, { marginTop: insets.top, marginLeft: insets.left, marginRight: insets.right }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={isDarkMode ? '#F9FAFB' : '#1F2937'} /></TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(17) }]}>Help Center</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <View style={styles.descriptionContainer}>
          <View style={[styles.descriptionCard, { borderColor: t.colors.border }]}>
            <BlurView intensity={Platform.OS === 'ios' ? 20 : 15} tint={isDarkMode ? 'dark' : 'light'} style={styles.descriptionBlur}>
              <View style={[styles.descriptionContent, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                <Text style={[styles.description, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(14) }]}>Find answers to common questions about DOrSU Connect.</Text>
              </View>
            </BlurView>
          </View>
        </View>
        
        <View style={styles.faqContainer}>
          {faqItems.map((item, index) => (
            <View key={index} style={[styles.faqCardWrapper, { borderColor: t.colors.border }]}>
              <BlurView intensity={Platform.OS === 'ios' ? 20 : 15} tint={isDarkMode ? 'dark' : 'light'} style={styles.faqCardBlur}>
                <View style={[styles.faqCard, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                  <View style={styles.faqQuestionRow}>
                    <Ionicons name="help-circle-outline" size={20} color={t.colors.accent} style={styles.faqIcon} />
                    <Text style={[styles.faqQuestion, { color: t.colors.text, fontSize: t.fontSize.scaleSize(15) }]}>{item.question}</Text>
                  </View>
                  <Text style={[styles.faqAnswer, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(13) }]}>{item.answer}</Text>
                </View>
              </BlurView>
            </View>
          ))}
        </View>

        {/* Help Section */}
        <View style={[styles.helpBoxWrapper, { borderColor: t.colors.border }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 20 : 15} tint={isDarkMode ? 'dark' : 'light'} style={styles.helpBoxBlur}>
            <View style={[styles.helpBox, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
              <View style={styles.helpBoxHeader}>
                <Ionicons name="information-circle-outline" size={20} color={t.colors.accent} />
                <Text style={[styles.helpBoxTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(15) }]}>Need more help?</Text>
              </View>
              <Text style={[styles.helpBoxText, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(13) }]}>Contact our support team for personalized assistance.</Text>
            </View>
          </BlurView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  floatingBgContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0 },
  floatingOrbWrapper: { position: 'absolute' },
  floatingOrb1: { width: 500, height: 500, borderRadius: 250, opacity: 0.5, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: 'transparent', zIndex: 10 },
  headerLeft: { width: 40 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  headerRight: { width: 40 },
  content: { flex: 1 },
  descriptionContainer: { marginBottom: 20 },
  descriptionCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  descriptionBlur: { borderRadius: 12, overflow: 'hidden' },
  descriptionContent: { padding: 16, borderRadius: 12 },
  description: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  faqContainer: { gap: 12, marginBottom: 18 },
  faqCardWrapper: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  faqCardBlur: { borderRadius: 12, overflow: 'hidden' },
  faqCard: { padding: 16, borderRadius: 12 },
  faqQuestionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  faqIcon: { marginRight: 10, marginTop: 2 },
  faqQuestion: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  faqAnswer: { fontSize: 13, lineHeight: 18, marginLeft: 30, opacity: 0.8 },
  helpBoxWrapper: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  helpBoxBlur: { borderRadius: 12, overflow: 'hidden' },
  helpBox: { padding: 16, borderRadius: 12 },
  helpBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  helpBoxTitle: { fontSize: 15, fontWeight: '600' },
  helpBoxText: { fontSize: 13, lineHeight: 20, opacity: 0.8, marginLeft: 30 },
});

export default HelpCenterScreen;

