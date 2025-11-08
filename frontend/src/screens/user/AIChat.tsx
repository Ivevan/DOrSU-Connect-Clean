import React, { useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform, TouchableOpacity, TextInput, ScrollView, useWindowDimensions, Modal, Pressable, Animated, InteractionManager, Easing } from 'react-native';
import { theme } from '../../config/theme';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
};

const SUGGESTIONS = [
  'How do I apply for a scholarship?',
  'Where is the library located?',
  'What\'s the enrollment schedule?',
  'How do I access my student portal?',
  'How do I reset my password?'
] as const;

// Memoized Suggestion Card Component
const SuggestionCard = memo(({ text, theme, isWide }: { text: string; theme: any; isWide: boolean }) => (
  <TouchableOpacity
    style={[styles.promptCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, isWide && { maxWidth: 640 }]}
    activeOpacity={0.9}
  >
    <View style={[styles.promptIconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
      <Ionicons name="reorder-three" size={16} color={theme.colors.accent} />
    </View>
    <Text style={[styles.promptCardText, { color: theme.colors.text }]}>{text}</Text>
  </TouchableOpacity>
));

const AIChat = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useThemeValues();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const isWide = width > 600;
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);

  const handleInfoOpen = useCallback(() => setIsInfoOpen(true), []);
  const handleInfoClose = useCallback(() => setIsInfoOpen(false), []);

  const displayedSuggestions = useMemo(() => SUGGESTIONS.slice(0, 3), []);

  // Animation values for smooth entrance - DISABLED FOR DEBUGGING
  const fadeAnim = useRef(new Animated.Value(1)).current; // Set to 1 (visible) immediately
  const slideAnim = useRef(new Animated.Value(0)).current; // Set to 0 (no offset) immediately

  // Entrance animation - DISABLED FOR DEBUGGING
  // useEffect(() => {
  //   const handle = InteractionManager.runAfterInteractions(() => {
  //     Animated.parallel([
  //       Animated.timing(fadeAnim, {
  //         toValue: 1,
  //         duration: 250,
  //         easing: Easing.out(Easing.ease),
  //         useNativeDriver: true,
  //       }),
  //       Animated.timing(slideAnim, {
  //         toValue: 0,
  //         duration: 250,
  //         easing: Easing.out(Easing.ease),
  //         useNativeDriver: true,
  //       }),
  //     ]).start();
  //   });
  //   return () => handle.cancel();
  // }, []);

  return (
    <View style={[styles.container, {
      backgroundColor: t.colors.background,
      paddingTop: insets.top,
      paddingBottom: 0, // Remove bottom padding since UserBottomNavBar handles it
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <StatusBar
        backgroundColor={t.colors.primary}
        barStyle={'light-content'}
        translucent={false}
      />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: t.colors.primary }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>DOrSU AI</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={handleInfoOpen} accessibilityLabel="AI chat information">
            <Ionicons name="information-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      {/* Info Modal */}
      <Modal visible={isInfoOpen} transparent animationType="fade" onRequestClose={handleInfoClose}>
        <View style={styles.infoModalOverlay}>
          <View style={[styles.infoCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <View style={styles.infoHeader}>
              <Text style={[styles.infoTitle, { color: t.colors.text }]}>About DOrSU AI</Text>
              <Pressable onPress={handleInfoClose} style={styles.infoCloseBtn} accessibilityLabel="Close info">
                <Ionicons name="close" size={20} color={t.colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.infoBodyText, { color: t.colors.textMuted }]}>DOrSU AI can help you:</Text>
            <View style={styles.infoCards}>
              <View style={[styles.infoCardBox, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                <View style={[styles.infoCardIconWrap, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                  <Ionicons name="help-circle" size={18} color={t.colors.primary} />
                </View>
                <Text style={[styles.infoCardText, { color: t.colors.text }]}>Answer questions about enrollment and policies</Text>
              </View>
              <View style={[styles.infoCardBox, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                <View style={[styles.infoCardIconWrap, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                  <Ionicons name="location" size={18} color={t.colors.primary} />
                </View>
                <Text style={[styles.infoCardText, { color: t.colors.text }]}>Find campus locations and facilities</Text>
              </View>
              <View style={[styles.infoCardBox, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                <View style={[styles.infoCardIconWrap, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                  <Ionicons name="school" size={18} color={t.colors.primary} />
                </View>
                <Text style={[styles.infoCardText, { color: t.colors.text }]}>Get information about academic programs</Text>
              </View>
            </View>
            <View style={[styles.infoNote, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={t.colors.textMuted} />
              <Text style={[styles.infoNoteText, { color: t.colors.textMuted }]}>Avoid sharing sensitive or personal data.</Text>
            </View>
          </View>
        </View>
      </Modal>
      {/* Main Content */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim }
            ],
            width: '100%',
          }}
        >
          {/* AI Assistant Section */}
          <View style={styles.centerIconContainer}>
          <MaterialIcons name="support-agent" size={80} color={t.colors.textMuted} style={styles.centerIcon} />
        </View>
        <Text style={[styles.askTitle, { color: t.colors.text }]}>Ask DOrSU AI anything</Text>
        <Text style={[styles.disclaimer, { color: t.colors.textMuted }]}>Responses are generated by AI and may be inaccurate.</Text>
        </Animated.View>
      </ScrollView>

      {/* Suggestions */}
      <View style={styles.suggestionsContainer}>
        {displayedSuggestions.map((txt, idx) => (
          <SuggestionCard key={idx} text={txt} theme={t} isWide={isWide} />
        ))}
      </View>

      {/* Message Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: t.colors.background, borderTopColor: t.colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.border, color: t.colors.text }]}
          placeholder="Type a message to DOrSU AI"
          placeholderTextColor={t.colors.textMuted}
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: t.colors.primary }]}>
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <UserBottomNavBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 4,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#fff',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  centerIconContainer: {
    marginTop: 8,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIcon: {
    opacity: 0.2,
  },
  askTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  disclaimer: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  suggestionsContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  promptIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  promptCardText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  infoCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  infoCloseBtn: {
    padding: 6,
    borderRadius: 10,
    position: 'absolute',
    right: 0,
  },
  infoBodyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 10,
    lineHeight: 20,
    letterSpacing: 0.2,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoCards: {
    gap: 10,
    marginBottom: 12,
  },
  infoCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoCardIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '600',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CBD5FF',
    marginBottom: 12,
  },
  infoNoteText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
});

export default AIChat; 