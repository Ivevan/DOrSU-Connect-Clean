import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform, TouchableOpacity, TextInput, ScrollView, useWindowDimensions, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import InfoModal from '../../modals/InfoModal';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
  AdminDashboard: undefined;
  AdminAIChat: undefined;
  AdminCalendar: undefined;
  AdminSettings: undefined;
  PostUpdate: undefined;
  ManagePosts: undefined;
};

const SUGGESTIONS = [
  'Review pending announcements',
  'Draft a new update',
  'Schedule an event',
  'Show recent student queries',
  'Help with policy wording'
];

const AdminAIChat = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode, theme } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width > 600;
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);

  // Animation values for smooth entrance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Entrance animation for AI Chat - Slide from bottom with scale
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, {
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
      paddingBottom: 0, // Remove bottom padding since AdminBottomNavBar now handles it
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}
    >
      <StatusBar
        backgroundColor={theme.colors.primary}
        barStyle={isDarkMode ? "light-content" : "light-content"}
        translucent={false}
      />
      {/* Header (match AdminDashboard layout; keep info button) */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>DOrSU AI</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setIsInfoOpen(true)} accessibilityLabel="AI chat information">
            <Ionicons name="information-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      {/* Info Modal */}
      <InfoModal
        visible={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        title="About DOrSU AI"
        subtitle="DOrSU AI can help you:"
        cards={[
          {
            icon: 'megaphone',
            iconColor: '#0284C7',
            iconBgColor: '#E0F2FE',
            text: 'Draft announcements and events faster'
          },
          {
            icon: 'document-text',
            iconColor: '#4F46E5',
            iconBgColor: '#E0E7FF',
            text: 'Summarize long updates into key points'
          },
          {
            icon: 'help-circle',
            iconColor: '#059669',
            iconBgColor: '#ECFDF5',
            text: 'Answer common student questions'
          }
        ]}
        description="Avoid sharing sensitive or personal data."
      />
      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View 
          style={[
            styles.centerIconContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <MaterialIcons name="support-agent" size={80} color={theme.colors.textMuted} style={styles.centerIcon} />
        </Animated.View>
        <Animated.Text 
          style={[
            styles.askTitle,
            { 
              color: theme.colors.text,
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          Ask DOrSU AI anything
        </Animated.Text>
        <Animated.Text 
          style={[
            styles.disclaimer,
            { 
              color: theme.colors.textMuted,
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          Responses are generated by AI and may be inaccurate.
        </Animated.Text>
      </ScrollView>

      {/* Suggestions */}
      <Animated.View 
        style={[
          styles.suggestionsContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        {[SUGGESTIONS[0], SUGGESTIONS[1], SUGGESTIONS[2]].map((txt, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.promptCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, isWide && { maxWidth: 640 }]}
            activeOpacity={0.9}
          >
            <View style={[styles.promptIconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Ionicons name="reorder-three" size={16} color={theme.colors.accent} />
            </View>
            <Text style={[styles.promptCardText, { color: theme.colors.text }]}>{txt}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Message Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
          placeholder="Type a message to DOrSU AI"
          placeholderTextColor={theme.colors.textMuted}
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.colors.primary }]}>
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <AdminBottomNavBar
        activeTab="chat"
        onDashboardPress={() => navigation.navigate('AdminDashboard')}
        onChatPress={() => navigation.navigate('AdminAIChat')}
        onCalendarPress={() => navigation.navigate('AdminCalendar')}
        onSettingsPress={() => navigation.navigate('AdminSettings')}  
        onAddPress={() => {}}
        onPostUpdatePress={() => navigation.navigate('PostUpdate')}
        onManagePostPress={() => navigation.navigate('ManagePosts')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    gap: 10,
  },
  headerIcon: {
    padding: 4,
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
    textAlign: 'center',
    marginBottom: 6,
  },
  disclaimer: {
    fontSize: 12,
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
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  promptCardText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    marginRight: 8,
    borderWidth: 1,
  },
  sendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
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
    borderRadius: 16,
    borderWidth: 1,
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
  },
  infoCloseBtn: {
    padding: 6,
    borderRadius: 10,
    position: 'absolute',
    right: 0,
  },
  infoBodyText: {
    fontSize: 14,
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
    borderWidth: 1,
  },
  infoCardIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
    borderWidth: 1,
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
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

export default AdminAIChat;
