import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import AdminSidebar from '../../components/navigation/AdminSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';
import InfoModal from '../../modals/InfoModal';
import AIService, { ChatHistoryItem, Message, NetworkError, isNetworkError } from '../../services/AIService';
import ReconnectionService from '../../services/ReconnectionService';
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

// No default suggestions - FAQs will be empty until populated from backend

const AdminAIChat = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode, theme } = useTheme();
  const { getUserToken } = useAuth();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnline = isConnected && isInternetReachable;
  const { width } = useWindowDimensions();
  const isWide = width > 600;
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [topQueries, setTopQueries] = useState<string[]>([]);
  const [isLoadingTopQueries, setIsLoadingTopQueries] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<'student' | 'faculty'>('student');
  const [isFaqsExpanded, setIsFaqsExpanded] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const sessionId = useRef<string>('');

  // Segmented control animation and width tracking
  const segmentAnim = useRef(new Animated.Value(0)).current;
  const segmentWidth = useRef(0);

  // Animated floating background orbs (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim2 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;

  // Typing indicator animations
  const typingDot1 = useRef(new Animated.Value(0)).current;
  const typingDot2 = useRef(new Animated.Value(0)).current;
  const typingDot3 = useRef(new Animated.Value(0)).current;

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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
          Animated.timing(cloudAnim1, {
            toValue: 1,
            duration: 15000,
            useNativeDriver: true,
          }),
          Animated.timing(cloudAnim1, {
            toValue: 0,
            duration: 15000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(cloudAnim2, {
            toValue: 1,
            duration: 20000,
            useNativeDriver: true,
          }),
          Animated.timing(cloudAnim2, {
            toValue: 0,
            duration: 20000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lightSpot1, {
            toValue: 1,
            duration: 12000,
            useNativeDriver: true,
          }),
          Animated.timing(lightSpot1, {
            toValue: 0,
            duration: 12000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lightSpot2, {
            toValue: 1,
            duration: 18000,
            useNativeDriver: true,
          }),
          Animated.timing(lightSpot2, {
            toValue: 0,
            duration: 18000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lightSpot3, {
            toValue: 1,
            duration: 14000,
            useNativeDriver: true,
          }),
          Animated.timing(lightSpot3, {
            toValue: 0,
            duration: 14000,
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    animations.forEach(anim => anim.start());
  }, []);

  // Animate typing indicator dots when loading
  useEffect(() => {
    if (isLoading) {
      const typingAnimations = [
        Animated.loop(
          Animated.sequence([
            Animated.timing(typingDot1, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(typingDot1, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.delay(150),
            Animated.timing(typingDot2, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(typingDot2, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.delay(300),
            Animated.timing(typingDot3, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(typingDot3, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        ),
      ];
      typingAnimations.forEach(anim => anim.start());
    } else {
      // Reset animations when not loading
      typingDot1.setValue(0);
      typingDot2.setValue(0);
      typingDot3.setValue(0);
    }
  }, [isLoading, typingDot1, typingDot2, typingDot3]);

  // Update segment animation when selection changes
  useEffect(() => {
    if (segmentWidth.current > 0) {
      const targetX = selectedUserType === 'faculty' 
        ? segmentWidth.current / 2 - 2 
        : 2;
      Animated.spring(segmentAnim, {
        toValue: targetX,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [selectedUserType, segmentAnim]);

  // Load top queries from backend
  const loadTopQueries = async () => {
    try {
      setIsLoadingTopQueries(true);
      const token = await getUserToken();
      if (token) {
        // Pass selectedUserType to filter FAQs (shared across all users)
        const queries = await AIService.getTopQueries(token, selectedUserType);
        if (queries && queries.length > 0) {
          setTopQueries(queries);
        } else {
          // No default suggestions - leave empty
          setTopQueries([]);
        }
      } else {
        // No default suggestions - leave empty
        setTopQueries([]);
      }
    } catch (error) {
      console.error('Failed to load top queries:', error);
      // No default suggestions - leave empty
      setTopQueries([]);
    } finally {
      setIsLoadingTopQueries(false);
    }
  };

  // Load chat history on component mount
  useEffect(() => {
    loadChatHistory();
    loadTopQueries();
  }, []);

  // Reload top queries when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Reload top queries when screen is focused to get latest data
      loadTopQueries();
    }, [selectedUserType])
  );

  // Reload top queries when userType changes
  useEffect(() => {
    loadTopQueries();
  }, [selectedUserType]);

  // Save chat when messages change
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

  const saveChatHistory = async () => {
    try {
      const token = await getUserToken();
      if (!token) return;
      
      if (messages.length > 0 && sessionId.current) {
        await AIService.saveChatHistory(sessionId.current, messages, token, selectedUserType);
        await loadChatHistory();
      }
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  const loadChatFromHistory = async (chatId: string) => {
    try {
      const token = await getUserToken();
      if (!token) return;
      
      setIsLoading(true);
      const chatMessages = await AIService.getChatSession(chatId, token);
      setMessages(chatMessages);
      sessionId.current = chatId;
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

    // Check network status before sending
    if (!isOnline) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '⚠️ No internet connection. Please check your network and try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

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
      // Call AI service with selected userType
      const token = await getUserToken();
      const response = await AIService.sendMessage(textToSend, token || undefined, selectedUserType);

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
    } catch (error: any) {
      // Show appropriate error message based on error type
      let errorContent = 'Sorry, I encountered an error. Please try again.';
      
      if (isNetworkError(error) || error instanceof NetworkError) {
        errorContent = '⚠️ No internet connection. This message will be sent automatically when connection is restored.';
        
        // Queue the message for retry when connection is restored
        const queuedMessage = textToSend;
        const queuedUserType = selectedUserType;
        const queuedUserMessage = userMessage;
        
        ReconnectionService.queueRequest({
          execute: async () => {
            const token = await getUserToken();
            const response = await AIService.sendMessage(queuedMessage, token || undefined, queuedUserType);
            
            // Format the AI response
            const formattedContent = formatAIResponse(response.reply);
            
            // Create assistant message
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: formattedContent,
              timestamp: new Date(),
            };
            
            // Add assistant message to chat
            setMessages(prev => {
              // Check if user message is already in the list
              const hasUserMessage = prev.some(msg => msg.id === queuedUserMessage.id);
              if (!hasUserMessage) {
                return [...prev, queuedUserMessage, assistantMessage];
              }
              // If user message exists, just add assistant response
              return [...prev, assistantMessage];
            });
          },
          retryCount: 0,
          maxRetries: 3,
        });
        
        console.log('📦 Message queued for retry when connection is restored');
      } else if (error?.message) {
        errorContent = `⚠️ ${error.message}`;
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAllChats = async () => {
    try {
      const token = await getUserToken();
      if (!token) return;
      
      const success = await AIService.deleteAllChatHistory(token);
      if (success) {
        setChatHistory([]);
        sessionId.current = '';
        setMessages([]);
        await loadChatHistory();
      }
    } catch (error) {
      console.error('Failed to delete all chats:', error);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    handleSendMessage(suggestion);
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
        colors={[
          isDarkMode
            ? '#0B1220'
            : '#FBF8F3',
          isDarkMode
            ? '#111827'
            : '#F8F5F0',
          isDarkMode
            ? '#1F2937'
            : '#F5F2ED'
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

      {/* Animated Floating Background Orbs (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        {/* Light Spot 1 - Top right gentle glow */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              top: '8%',
              right: '12%',
              transform: [
                {
                  translateX: lightSpot1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -15],
                  }),
                },
                {
                  translateY: lightSpot1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 12],
                  }),
                },
                {
                  scale: lightSpot1.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.08, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.lightSpot1}>
            <LinearGradient
              colors={['rgba(255, 220, 180, 0.35)', 'rgba(255, 200, 150, 0.18)', 'rgba(255, 230, 200, 0.08)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0.2, y: 0.2 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        {/* Light Spot 2 - Middle left soft circle */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              top: '45%',
              left: '8%',
              transform: [
                {
                  translateX: lightSpot2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 18],
                  }),
                },
                {
                  translateY: lightSpot2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -10],
                  }),
                },
                {
                  scale: lightSpot2.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.06, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.lightSpot2}>
            <LinearGradient
              colors={['rgba(255, 210, 170, 0.28)', 'rgba(255, 200, 160, 0.15)', 'rgba(255, 220, 190, 0.06)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0.3, y: 0.3 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        {/* Light Spot 3 - Bottom center blurry glow */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              bottom: '12%',
              left: '55%',
              transform: [
                {
                  translateX: lightSpot3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -20],
                  }),
                },
                {
                  translateY: lightSpot3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 8],
                  }),
                },
                {
                  scale: lightSpot3.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.1, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.lightSpot3}>
            <LinearGradient
              colors={['rgba(255, 190, 140, 0.25)', 'rgba(255, 180, 130, 0.12)', 'rgba(255, 210, 170, 0.05)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0.4, y: 0.4 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        {/* Cloud variation 1 - Top left soft light patch */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              top: '15%',
              left: '10%',
              transform: [
                {
                  translateX: cloudAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 20],
                  }),
                },
                {
                  translateY: cloudAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -15],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.cloudPatch1}>
            <LinearGradient
              colors={['rgba(255, 200, 150, 0.4)', 'rgba(255, 210, 170, 0.22)', 'rgba(255, 230, 200, 0.1)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        {/* Cloud variation 2 - Bottom right gentle tone */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              bottom: '20%',
              right: '15%',
              transform: [
                {
                  translateX: cloudAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -25],
                  }),
                },
                {
                  translateY: cloudAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 10],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.cloudPatch2}>
            <LinearGradient
              colors={['rgba(255, 190, 140, 0.32)', 'rgba(255, 200, 160, 0.18)', 'rgba(255, 220, 190, 0.08)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0.3, y: 0.3 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        {/* Orb 1 - Soft Orange Glow (Center area) */}
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
            <View style={styles.customHamburger} pointerEvents="none">
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>
            {messages.length > 0 ? 'Conversation' : 'New Conversation'}
          </Text>
          <View style={[styles.userTypeLabel, { backgroundColor: selectedUserType === 'student' ? '#10B981' : '#2563EB' }]}>
            <Text style={styles.userTypeLabelText}>
              {selectedUserType === 'faculty' ? 'Faculty' : 'Student'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={() => navigation.navigate('AdminSettings')} 
            accessibilityLabel="Admin profile - Go to settings"
          >
            <View style={[styles.profileIconCircle, { backgroundColor: isDarkMode ? '#FF9500' : '#FF9500' }]}>
              <Text style={styles.profileInitials}>AD</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      {/* Admin Sidebar Component */}
      <AdminSidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        chatHistory={chatHistory}
        onChatSelect={loadChatFromHistory}
        onNewConversation={() => {
          sessionId.current = '';
          setMessages([]);
        }}
        getUserToken={getUserToken}
        sessionId={sessionId.current}
        onDeleteChat={async (chatId) => {
          try {
            const token = await getUserToken();
            if (token) {
              const success = await AIService.deleteChatSession(chatId, token);
              if (success) {
                setChatHistory(prev => prev.filter(h => h.id !== chatId));
                if (sessionId.current === chatId) {
                  sessionId.current = '';
                  setMessages([]);
                }
                await loadChatHistory(); // Refresh the list
              }
            }
          } catch (error) {
            console.error('Failed to delete chat:', error);
          }
        }}
        onDeleteAllChats={handleDeleteAllChats}
      />
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
                  styles.messageRow,
                  message.role === 'user' ? styles.userMessageRow : styles.assistantMessageRow,
                ]}
              >
                {message.role === 'assistant' && (
                  <View style={[styles.aiAvatar, { backgroundColor: isDarkMode ? '#FF9500' : '#FF9500' }]}>
                    <MaterialIcons name="auto-awesome" size={14} color="#FFF" />
                  </View>
                )}
                {message.role === 'user' ? (
                  <View
                    style={[
                      styles.messageBubble,
                      { backgroundColor: isDarkMode ? '#2563EB' : '#2563EB' }
                    ]}
                  >
                    <Text style={[styles.messageText, { color: '#FFFFFF' }]}>
                      {message.content}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.messageBubble, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}>
                    <Markdown
                      style={getMarkdownStyles(theme)}
                      onLinkPress={(url: string) => {
                        Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
                        return false;
                      }}
                    >
                      {message.content}
                    </Markdown>
                  </View>
                )}
              </View>
            ))}
            {isLoading && (
              <View style={styles.assistantMessageRow}>
                <View style={[styles.aiAvatar, { backgroundColor: isDarkMode ? '#FF9500' : '#FF9500' }]}>
                  <MaterialIcons name="auto-awesome" size={14} color="#FFF" />
                </View>
                <View style={[styles.typingBubbleContainer, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}>
                  <BlurView
                    intensity={Platform.OS === 'ios' ? 50 : 40}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={styles.typingBlurView}
                  >
                    <View style={styles.typingIndicator}>
                      <Animated.View 
                        style={[
                          styles.typingDot, 
                          { 
                            backgroundColor: isDarkMode ? '#9CA3AF' : '#6B7280',
                            opacity: typingDot1.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.3, 1]
                            }),
                            transform: [{
                              translateY: typingDot1.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -4]
                              })
                            }]
                          }
                        ]} 
                      />
                      <Animated.View 
                        style={[
                          styles.typingDot, 
                          { 
                            backgroundColor: isDarkMode ? '#9CA3AF' : '#6B7280',
                            opacity: typingDot2.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.3, 1]
                            }),
                            transform: [{
                              translateY: typingDot2.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -4]
                              })
                            }]
                          }
                        ]} 
                      />
                      <Animated.View 
                        style={[
                          styles.typingDot, 
                          { 
                            backgroundColor: isDarkMode ? '#9CA3AF' : '#6B7280',
                            opacity: typingDot3.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.3, 1]
                            }),
                            transform: [{
                              translateY: typingDot3.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -4]
                              })
                            }]
                          }
                        ]} 
                      />
                    </View>
                  </BlurView>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Suggestions - Only show when no messages */}
      {messages.length === 0 && (
        <View style={[styles.suggestionsWrapper, {
          paddingHorizontal: 16 + insets.left,
          paddingRight: 16 + insets.right,
        }]}>
          {/* FAQs Section - Full width */}
          <View style={styles.faqsSection}>
            {/* Top 5 FAQs Header with Toggle */}
            <TouchableOpacity
              style={styles.faqsHeaderButton}
              onPress={() => {
                setIsFaqsExpanded(!isFaqsExpanded);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.faqsHeader}>
                <Text style={[styles.faqsLabel, { color: theme.colors.text }]}>Top 5 FAQs</Text>
                <Ionicons 
                  name={isFaqsExpanded ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={theme.colors.text} 
                />
              </View>
            </TouchableOpacity>

            {/* Expandable FAQ List */}
            {isFaqsExpanded && (
              <View style={styles.faqsDropdown}>
                <ScrollView 
                  style={styles.faqsScrollView}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {isLoadingTopQueries ? (
                    <View style={styles.loadingSuggestions}>
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                    </View>
                  ) : topQueries.length > 0 ? (
                    topQueries.map((txt, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.promptCard}
                        activeOpacity={0.9}
                        onPress={() => handleSuggestionPress(txt)}
                      >
                        <BlurView
                          intensity={Platform.OS === 'ios' ? 50 : 40}
                          tint={isDarkMode ? 'dark' : 'light'}
                          style={styles.promptCardBlur}
                        >
                          <View style={styles.promptCardContent}>
                            <View style={[styles.promptIconWrap, { backgroundColor: isDarkMode ? 'rgba(255, 149, 0, 0.15)' : 'rgba(255, 149, 0, 0.1)' }]}>
                              <Ionicons name="reorder-three" size={16} color="#FF9500" />
                            </View>
                            <Text style={[styles.promptCardText, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>{txt}</Text>
                          </View>
                        </BlurView>
                      </TouchableOpacity>
                    ))
                  ) : null}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Message Input Bar - Copilot Style Floating */}
      <View style={[styles.inputBarContainer, { 
        paddingLeft: 16 + insets.left,
        paddingRight: 16 + insets.right,
        paddingBottom: 12 + insets.bottom,
      }]}>
        {/* Student/Faculty Toggle - Perplexity style in input bar */}
        <View style={styles.userTypeToggleContainer}>
          <View 
            style={[styles.userTypeToggle, { backgroundColor: selectedUserType === 'student' ? '#10B981' : '#2563EB' }]}
            onLayout={(e) => {
              segmentWidth.current = e.nativeEvent.layout.width;
              const targetX = selectedUserType === 'faculty' 
                ? segmentWidth.current / 2 - 2 
                : 2;
              segmentAnim.setValue(targetX);
            }}
          >
            <Animated.View
              style={[
                styles.userTypeToggleSelector,
                {
                  transform: [
                    {
                      translateX: segmentAnim,
                    },
                  ],
                }
              ]}
            />
            <View style={styles.userTypeToggleOptions}>
              <TouchableOpacity
                style={styles.userTypeToggleOption}
                onPress={() => {
                  setSelectedUserType('student');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.userTypeToggleText,
                  { color: selectedUserType === 'student' ? '#10B981' : '#FFFFFF' }
                ]}>
                  Student
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.userTypeToggleOption}
                onPress={() => {
                  setSelectedUserType('faculty');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.userTypeToggleText,
                  { color: selectedUserType === 'faculty' ? '#2563EB' : '#FFFFFF' }
                ]}>
                  Faculty
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.inputBarOuter, {
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
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
                disabled={isLoading || !isOnline}
                accessibilityLabel={!isOnline ? "Send message (No internet connection)" : "Send message"}
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
      </View>

      <AdminBottomNavBar
        activeTab="chat"
        onChatPress={() => navigation.navigate('AdminAIChat')}
        onDashboardPress={() => navigation.navigate('AdminDashboard')}
        onCalendarPress={() => navigation.navigate('AdminCalendar')}
      />
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
  cloudWrapper: {
    position: 'absolute',
  },
  cloudPatch1: {
    width: 350,
    height: 350,
    borderRadius: 175,
    opacity: 0.25,
    overflow: 'hidden',
  },
  cloudPatch2: {
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.22,
    overflow: 'hidden',
  },
  lightSpot1: {
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.2,
    overflow: 'hidden',
  },
  lightSpot2: {
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.18,
    overflow: 'hidden',
  },
  lightSpot3: {
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.16,
    overflow: 'hidden',
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
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customHamburger: {
    width: 24,
    height: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hamburgerLine: {
    height: 2.5,
    borderRadius: 2,
  },
  hamburgerLineShort: {
    width: 18,
  },
  hamburgerLineLong: {
    width: 24,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  userTypeLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 1,
  },
  userTypeLabelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  profileButton: {
    width: 32,
    height: 32,
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
  suggestionsWrapper: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  faqsSection: {
    width: '100%',
    alignSelf: 'stretch',
  },
  faqsHeaderButton: {
    marginBottom: 12,
  },
  faqsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  faqsLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  faqsDropdown: {
    maxHeight: 300,
    marginTop: 8,
  },
  faqsScrollView: {
    maxHeight: 300,
  },
  userTypeToggleContainer: {
    marginBottom: 8,
    width: '100%',
    alignSelf: 'stretch',
  },
  userTypeToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    alignSelf: 'stretch',
  },
  userTypeToggleSelector: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userTypeToggleOptions: {
    flexDirection: 'row',
    width: '100%',
    zIndex: 1,
  },
  userTypeToggleOption: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTypeToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingSuggestions: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptCard: {
    width: '100%',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.15)',
  },
  promptCardBlur: {
    width: '100%',
    borderRadius: 16,
  },
  promptCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
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
  inputBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputBarOuter: {
    borderRadius: 30,
    borderWidth: 2,
    padding: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 8,
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
  typingBubbleContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    maxWidth: '75%',
  },
  typingBlurView: {
    borderRadius: 20,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
