import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Linking, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import { theme } from '../../config/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import AIService, { ChatHistoryItem, Message } from '../../services/AIService';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import { formatAIResponse, getMarkdownStyles } from '../../utils/markdownFormatter';

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
];

const AIChat = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useTheme();
  const { getUserToken, userEmail: authUserEmail, checkAuthStatus } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const isWide = width > 600;
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const sidebarAnim = useRef(new Animated.Value(-300)).current;
  const sessionId = useRef<string>('');

  // Animated floating background orbs (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;

  // User state from Firebase Auth - Initialize with current user to prevent layout shift
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      return getCurrentUser();
    } catch {
      return null;
    }
  });
  
  // Backend auth user data from AsyncStorage
  const [backendUserName, setBackendUserName] = useState<string | null>(null);
  const [backendUserEmail, setBackendUserEmail] = useState<string | null>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);

  // Load backend user data on mount and screen focus
  useFocusEffect(
    useCallback(() => {
      const loadBackendUserData = async () => {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const userName = await AsyncStorage.getItem('userName');
          const userEmail = await AsyncStorage.getItem('userEmail');
          const userPhoto = await AsyncStorage.getItem('userPhoto');
          setBackendUserName(userName);
          setBackendUserEmail(userEmail);
          setBackendUserPhoto(userPhoto);
        } catch (error) {
          console.error('Failed to load backend user data:', error);
        }
      };
      loadBackendUserData();
    }, [])
  );
  
  // Get user display name, email, and photo (memoized) - Check backend first, then Firebase
  const userName = useMemo(() => {
    // Priority: Backend username -> Firebase displayName -> Firebase email username -> Backend email username -> Default
    if (backendUserName) return backendUserName;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    if (backendUserEmail) return backendUserEmail.split('@')[0];
    return 'User';
  }, [currentUser, backendUserName, backendUserEmail]);
  
  const userEmail = useMemo(() => {
    // Priority: Backend email -> Firebase email -> Default
    if (backendUserEmail) return backendUserEmail;
    if (currentUser?.email) return currentUser.email;
    return 'No email';
  }, [currentUser, backendUserEmail]);
  
  const userPhoto = useMemo(() => {
    // Priority: Backend photo -> Firebase photo -> Default
    if (backendUserPhoto) return backendUserPhoto;
    if (currentUser?.photoURL) return currentUser.photoURL;
    return null;
  }, [currentUser, backendUserPhoto]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Refresh auth status and load chat history on component mount
  // This ensures we have the latest token, especially after Google sign-in
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Refresh auth status to ensure we have the latest token
        await checkAuthStatus();
        // Then load chat history
        await loadChatHistory();
      } catch (error) {
        console.error('Failed to initialize chat:', error);
      }
    };
    initializeChat();
  }, []);

  // Subscribe to auth changes when screen is focused
  useFocusEffect(
    useCallback(() => {
      let unsubscribe: (() => void) | null = null;
      const timeoutId = setTimeout(() => {
        unsubscribe = onAuthStateChange((user) => {
          setCurrentUser(prevUser => {
            if (prevUser?.uid !== user?.uid) {
              return user;
            }
            return prevUser;
          });
        });
      }, 50);
      
      return () => {
        clearTimeout(timeoutId);
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }, [])
  );

  // Animate sidebar when opening/closing
  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: isHistoryOpen ? 0 : -300,
      duration: 300,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isHistoryOpen, sidebarAnim]);

  // Animate floating background orbs on mount
  useEffect(() => {
    const animations = [
      Animated.loop(
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
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim2, {
            toValue: 1,
            duration: 10000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim2, {
            toValue: 0,
            duration: 10000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim3, {
            toValue: 1,
            duration: 12000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim3, {
            toValue: 0,
            duration: 12000,
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    animations.forEach(anim => anim.start());
  }, []);

  // Save chat when messages change (only if there are messages)
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory();
    }
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const token = await getUserToken();
      if (token) {
        const history = await AIService.getChatHistory(token);
        setChatHistory(history);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const getUserInitials = () => {
    if (!userName) return '?';
    const names = userName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  };

  const saveChatHistory = async () => {
    try {
      const token = await getUserToken();
      console.log('💾 saveChatHistory: Token available?', !!token, 'Token length:', token?.length || 0, 'Token prefix:', token?.substring(0, 30) || 'none', 'Messages:', messages.length, 'SessionId:', sessionId.current);
      
      if (!token) {
        console.error('❌ saveChatHistory: No token available - cannot save chat history');
        // Try to get Firebase token as fallback
        const user = getCurrentUser();
        if (user && typeof user.getIdToken === 'function') {
          try {
            const firebaseToken = await user.getIdToken(true); // Force refresh
            console.log('✅ saveChatHistory: Using Firebase token as fallback, length:', firebaseToken?.length || 0);
            if (messages.length > 0 && sessionId.current) {
              await AIService.saveChatHistory(sessionId.current, messages, firebaseToken);
              await loadChatHistory();
            }
          } catch (err) {
            console.error('❌ saveChatHistory: Failed to get Firebase token:', err);
          }
        }
        return;
      }
      
      if (messages.length > 0 && sessionId.current) {
        const success = await AIService.saveChatHistory(sessionId.current, messages, token);
        if (success) {
          console.log('✅ saveChatHistory: Chat history saved successfully');
          // Refresh chat history list
          await loadChatHistory();
        } else {
          console.error('❌ saveChatHistory: Failed to save - AIService returned false');
        }
      } else {
        console.warn('⚠️ saveChatHistory: Skipping save - no messages or sessionId', {
          messagesCount: messages.length,
          sessionId: sessionId.current
        });
      }
    } catch (error) {
      console.error('❌ saveChatHistory: Error saving chat history:', error);
    }
  };

  const loadChatFromHistory = async (chatId: string) => {
    try {
      const token = await getUserToken();
      if (!token) return;
      
      setIsLoading(true);
      const chatMessages = await AIService.getChatSession(chatId, token);
      setMessages(chatMessages);
      sessionId.current = chatId; // Set the session ID to the loaded chat
      setIsHistoryOpen(false);
    } catch (error) {
      console.error('Failed to load chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    if (!textToSend || isLoading) return;

    // Generate a new session ID if this is the first message
    if (!sessionId.current) {
      sessionId.current = Date.now().toString();
    }

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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        translucent={true}
      />

      {/* Background Gradient Layer */}
      <LinearGradient
        colors={
          isDarkMode
            ? ['#0B1220', '#111827', '#1F2937']
            : ['#F8FAFC', '#FFFFFF', '#F1F5F9']
        }
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Animated Floating Background Orbs (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        {/* Orb 1 - Orange (Main Copilot color) */}
        <Animated.View
          style={[
            styles.floatingOrbWrapper,
            {
              top: '10%',
              right: '20%',
              transform: [
                {
                  translateX: floatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 100],
                  }),
                },
                {
                  translateY: floatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -80],
                  }),
                },
                {
                  scale: floatAnim1.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.2, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#FF9500', '#FF6B00', '#FF9500']}
            style={styles.floatingOrb1}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 50}
              tint={isDarkMode ? 'dark' : 'light'}
              style={styles.blurOverlay}
            />
          </LinearGradient>
        </Animated.View>

        {/* Orb 2 - Blue */}
        <Animated.View
          style={[
            styles.floatingOrbWrapper,
            {
              bottom: '20%',
              left: '10%',
              transform: [
                {
                  translateX: floatAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [80, -60],
                  }),
                },
                {
                  translateY: floatAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-40, 60],
                  }),
                },
                {
                  scale: floatAnim2.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 0.9, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#3B82F6', '#2563EB', '#3B82F6']}
            style={styles.floatingOrb2}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 55 : 45}
              tint={isDarkMode ? 'dark' : 'light'}
              style={styles.blurOverlay}
            />
          </LinearGradient>
        </Animated.View>

        {/* Orb 3 - Purple */}
        <Animated.View
          style={[
            styles.floatingOrbWrapper,
            {
              top: '50%',
              right: '5%',
              transform: [
                {
                  translateX: floatAnim3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, -80],
                  }),
                },
                {
                  translateY: floatAnim3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [60, -40],
                  }),
                },
                {
                  scale: floatAnim3.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.1, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED', '#8B5CF6']}
            style={styles.floatingOrb3}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 50 : 40}
              tint={isDarkMode ? 'dark' : 'light'}
              style={styles.blurOverlay}
            />
          </LinearGradient>
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
            onPress={() => setIsHistoryOpen(true)} 
            style={styles.menuButton}
            accessibilityLabel="Open chat history"
          >
            <Ionicons name="menu" size={24} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>New Conversation</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={() => navigation.navigate('UserSettings')} 
            accessibilityLabel="User profile - Go to settings"
          >
            {userPhoto ? (
              <Image 
                source={{ uri: userPhoto }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.profileIconCircle, { backgroundColor: isDarkMode ? '#FF9500' : '#FF9500' }]}>
                <Text style={styles.profileInitials}>{getUserInitials()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Chat History Sidebar */}
      <Animated.View 
        style={[
          styles.sidebar, 
          { 
            transform: [{ translateX: sidebarAnim }],
            backgroundColor: t.colors.background,
            borderRightColor: t.colors.border
          }
        ]}
      >
        <View style={styles.sidebarHeader}>
          <Text style={[styles.sidebarTitle, { color: t.colors.text }]}>Chat History</Text>
          <TouchableOpacity onPress={() => setIsHistoryOpen(false)} style={styles.closeSidebarButton}>
            <Ionicons name="close" size={24} color={t.colors.text} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.sidebarContent}>
          {chatHistory.length === 0 ? (
            <View style={styles.emptyHistoryContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={t.colors.textMuted} />
              <Text style={[styles.emptyHistoryText, { color: t.colors.textMuted }]}>
                No chat history yet
              </Text>
              <Text style={[styles.emptyHistorySubtext, { color: t.colors.textMuted }]}>
                Your conversations will appear here
              </Text>
            </View>
          ) : (
            chatHistory.map((chat, idx) => (
              <View key={`${chat.id}:${idx}`} style={[styles.historyItem, { borderBottomColor: t.colors.border }]}>
                <TouchableOpacity onPress={() => loadChatFromHistory(chat.id)}>
                  <Text style={[styles.historyTitle, { color: t.colors.text }]} numberOfLines={1}>
                    {chat.title}
                  </Text>
                  <Text style={[styles.historyPreview, { color: t.colors.textMuted }]} numberOfLines={1}>
                    {chat.preview}
                  </Text>
                  <View style={styles.historyFooter}>
                    <Text style={[styles.historyDate, { color: t.colors.textMuted }]}>
                      {formatDate(new Date(chat.timestamp))}
                    </Text>
                    <Text style={[styles.historyTime, { color: t.colors.textMuted }]}>
                      {formatTime(new Date(chat.timestamp))}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteHistoryBtn}
                  onPress={async () => {
                    try {
                      let token = await getUserToken();
                      if (!token) {
                        const user = getCurrentUser();
                        if (user && typeof user.getIdToken === 'function') {
                          token = await user.getIdToken();
                        }
                      }
                      if (!token) return;
                      const ok = await AIService.deleteChatSession(chat.id, token);
                      if (ok) {
                        setChatHistory(prev => prev.filter(h => h.id !== chat.id));
                        if (sessionId.current === chat.id) {
                          sessionId.current = '';
                          setMessages([]);
                        }
                      }
                    } catch (e) {
                      console.error('Failed to delete chat:', e);
                    }
                  }}
                  accessibilityLabel="Delete chat"
                >
                  <Ionicons name="trash-outline" size={18} color={t.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>
      
      {/* Overlay for sidebar */}
      {isHistoryOpen && (
        <TouchableOpacity 
          style={styles.sidebarOverlay} 
          onPress={() => setIsHistoryOpen(false)}
          activeOpacity={1}
        />
      )}
      
      {/* Info Modal */}
      <Modal visible={isInfoOpen} transparent animationType="fade" onRequestClose={() => setIsInfoOpen(false)}>
        <View style={styles.infoModalOverlay}>
          <View style={[styles.infoCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <View style={styles.infoHeader}>
              <Text style={[styles.infoTitle, { color: t.colors.text }]}>About DOrSU AI</Text>
              <Pressable onPress={() => setIsInfoOpen(false)} style={styles.infoCloseBtn} accessibilityLabel="Close info">
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
      
      {/* Main Content - Chat Messages */}
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={[{
          paddingHorizontal: 16 + insets.left,
          paddingTop: 12,
          paddingBottom: 20,
          paddingRight: 16 + insets.right,
        },
          messages.length === 0 && styles.emptyScrollContent
        ]} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          // Empty state - show AI icon and welcome message
          <>
            <View style={styles.centerIconContainer}>
              <MaterialIcons name="support-agent" size={80} color={t.colors.textMuted} style={styles.centerIcon} />
            </View>
            <Text style={[styles.askTitle, { color: t.colors.text }]}>Ask DOrSU AI anything</Text>
            <Text style={[styles.disclaimer, { color: t.colors.textMuted }]}>Responses are generated by AI and may be inaccurate.</Text>
          </>
        ) : (
          // Chat messages
          <>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  message.role === 'user' ? styles.userMessageRow : styles.assistantMessageRow,
                ]}
              >
                {message.role === 'assistant' && (
                  <View style={[styles.aiAvatar, { backgroundColor: isDarkMode ? '#FF9500' : '#FF9500' }]}>
                    <MaterialIcons name="auto-awesome" size={14} color="#FFF" />
                  </View>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    message.role === 'user'
                      ? { backgroundColor: isDarkMode ? '#2563EB' : '#2563EB' }
                      : { backgroundColor: isDarkMode ? '#1F2937' : '#F8FAFC', borderColor: isDarkMode ? '#374151' : '#E5E7EB', borderWidth: 1 },
                  ]}
                >
                  {message.role === 'user' ? (
                    <Text
                      style={[styles.messageText, { color: '#FFFFFF' }]}
                    >
                      {message.content}
                    </Text>
                  ) : (
                    <Markdown
                      style={getMarkdownStyles(t)}
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
              <View style={styles.assistantMessageRow}>
                <View style={[styles.aiAvatar, { backgroundColor: isDarkMode ? '#FF9500' : '#FF9500' }]}>
                  <MaterialIcons name="auto-awesome" size={14} color="#FFF" />
                </View>
                <View style={[styles.messageBubble, { backgroundColor: isDarkMode ? '#1F2937' : '#F8FAFC', borderColor: isDarkMode ? '#374151' : '#E5E7EB', borderWidth: 1 }]}>
                  <ActivityIndicator size="small" color={isDarkMode ? '#3B82F6' : '#2563EB'} />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Suggestions - Only show when no messages */}
      {messages.length === 0 && (
        <View style={[styles.suggestionsContainer, {
          paddingHorizontal: 12 + insets.left,
        }]}>
          {[SUGGESTIONS[0], SUGGESTIONS[1], SUGGESTIONS[2]].map((txt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.promptCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }, isWide && { maxWidth: 640 }]}
              activeOpacity={0.9}
              onPress={() => handleSuggestionPress(txt)}
            >
              <View style={[styles.promptIconWrap, { backgroundColor: t.colors.surfaceAlt }]}>
                <Ionicons name="reorder-three" size={16} color={t.colors.accent} />
              </View>
              <Text style={[styles.promptCardText, { color: t.colors.text }]}>{txt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Message Input Bar - Copilot Style Floating */}
      <View style={[styles.inputBarContainer, { 
        paddingLeft: 16 + insets.left,
        paddingRight: 16 + insets.right,
        paddingBottom: 12 + insets.bottom,
      }]}>
        <View style={[styles.inputBar, {
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          borderColor: isDarkMode ? '#374151' : '#E5E7EB',
          shadowColor: '#000',
        }]}>
          <TextInput
            style={[styles.input, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}
            placeholder="Message DOrSU AI"
            placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSendMessage()}
            editable={!isLoading}
            multiline
            maxLength={2000}
          />
          
          {inputText.trim() && (
            <TouchableOpacity 
              style={[
                styles.sendBtn, 
                { backgroundColor: '#2563EB' },
                isLoading && styles.sendBtnDisabled
              ]}
              onPress={() => handleSendMessage()}
              disabled={isLoading}
              accessibilityLabel="Send message"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
      <UserBottomNavBar />
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
  // Floating background orbs container (Copilot-style)
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
    width: 350,
    height: 350,
    borderRadius: 175,
    opacity: 0.4,
  },
  floatingOrb2: {
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.35,
  },
  floatingOrb3: {
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.3,
  },
  blurOverlay: {
    flex: 1,
    borderRadius: 200,
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
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    alignItems: 'flex-end',
  },
  profileButton: {
    width: 32,
    height: 32,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profileIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  // Sidebar styles
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    borderRightWidth: 1,
    zIndex: 20,
    elevation: 20,
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 15,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeSidebarButton: {
    padding: 4,
  },
  sidebarContent: {
    flex: 1,
  },
  historyItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyPreview: {
    fontSize: 14,
    marginBottom: 8,
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deleteHistoryBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
    padding: 6,
    borderRadius: 8,
  },
  historyDate: {
    fontSize: 12,
  },
  historyTime: {
    fontSize: 12,
  },
  emptyHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    textAlign: 'center',
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
    elevation: 2,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 3px 6px rgba(0,0,0,0.06)' }
      : {
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
        }),
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
  inputBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 6,
    maxHeight: 100,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 4,
    gap: 10,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  assistantMessageRow: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.1,
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
    elevation: 4,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 8px rgba(0,0,0,0.1)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        }),
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