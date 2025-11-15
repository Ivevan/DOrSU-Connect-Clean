import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import { useTheme } from '../../contexts/ThemeContext';
import InfoModal from '../../modals/InfoModal';
import AIService, { Message } from '../../services/AIService';
import { formatAIResponse, getMarkdownStyles } from '../../utils/markdownFormatter';

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
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    if (!textToSend || isLoading) return;

    // Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Call AI service
      const response = await AIService.sendMessage(textToSend);

      // Format the AI response with enhanced markdown formatting
      const formattedContent = formatAIResponse(response.reply);

      // Create assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: formattedContent,
        timestamp: new Date(),
      };

      // Add assistant message to chat
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      // Show error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please make sure the AI backend is running and try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

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
      {/* Content - Chat Messages */}
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          messages.length === 0 && styles.emptyScrollContent
        ]} 
        keyboardShouldPersistTaps="handled" 
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          // Empty state - show AI icon and welcome message
          <>
            <View style={styles.centerIconContainer}>
              <MaterialIcons name="support-agent" size={80} color={theme.colors.textMuted} style={styles.centerIcon} />
            </View>
            <Text style={[styles.askTitle, { color: theme.colors.text }]}>Ask DOrSU AI anything</Text>
            <Text style={[styles.disclaimer, { color: theme.colors.textMuted }]}>Responses are generated by AI and may be inaccurate.</Text>
          </>
        ) : (
          // Chat messages
          <>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageContainer,
                  message.role === 'user' ? styles.userMessage : styles.assistantMessage,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    message.role === 'user'
                      ? { backgroundColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 },
                  ]}
                >
                  {message.role === 'user' ? (
                    <Text
                      style={[styles.messageText, { color: '#fff' }]}
                    >
                      {message.content}
                    </Text>
                  ) : (
                    <Markdown
                      style={getMarkdownStyles(theme)}
                      onLinkPress={(url: string) => {
                        Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
                        return false;
                      }}
                    >
                      {message.content}
                    </Markdown>
                  )}
                </View>
              </View>
            ))}
            {isLoading && (
              <View style={[styles.messageContainer, styles.assistantMessage]}>
                <View style={[styles.messageBubble, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Suggestions - Only show when no messages */}
      {messages.length === 0 && (
        <View style={styles.suggestionsContainer}>
          {[SUGGESTIONS[0], SUGGESTIONS[1], SUGGESTIONS[2]].map((txt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.promptCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, isWide && { maxWidth: 640 }]}
              activeOpacity={0.9}
              onPress={() => handleSuggestionPress(txt)}
            >
              <View style={[styles.promptIconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
                <Ionicons name="reorder-three" size={16} color={theme.colors.accent} />
              </View>
              <Text style={[styles.promptCardText, { color: theme.colors.text }]}>{txt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Message Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
          placeholder="Type a message to DOrSU AI"
          placeholderTextColor={theme.colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSendMessage()}
          editable={!isLoading}
          multiline
        />
        <TouchableOpacity 
          style={[
            styles.sendBtn, 
            { backgroundColor: theme.colors.primary },
            (isLoading || !inputText.trim()) && styles.sendBtnDisabled
          ]}
          onPress={() => handleSendMessage()}
          disabled={isLoading || !inputText.trim()}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <AdminBottomNavBar
        activeTab="dashboard"
        onDashboardPress={() => navigation.navigate('AdminAIChat')}
        onChatPress={() => navigation.navigate('AdminDashboard')}
        onSettingsPress={() => navigation.navigate('AdminCalendar')}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  emptyScrollContent: {
    alignItems: 'center',
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
  sendBtnDisabled: {
    opacity: 0.5,
  },
  messageContainer: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  assistantMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
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
