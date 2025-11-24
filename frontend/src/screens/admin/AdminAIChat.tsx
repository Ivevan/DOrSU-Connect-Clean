import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { ActivityIndicator, Animated, BackHandler, Image, Linking, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import AdminSidebar from '../../components/navigation/AdminSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';
import InfoModal from '../../modals/InfoModal';
import AIService, { ChatHistoryItem, isNetworkError, Message, NetworkError } from '../../services/AIService';
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
  const [isFaqsExpanded, setIsFaqsExpanded] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const sessionId = useRef<string>('');
  const hasRestoredConversation = useRef<boolean>(false);
  const isRestoringRef = useRef<boolean>(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const appWasInBackground = useRef<boolean>(false);
  const isLoggedInRef = useRef<boolean>(false);
  const hasInitialized = useRef<boolean>(false);

  // Segmented control animation and width tracking
  const segmentAnim = useRef(new Animated.Value(0)).current;
  const segmentWidth = useRef(0);

  // Animated floating background orb (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;

  // Typing indicator animations
  const typingDot1 = useRef(new Animated.Value(0)).current;
  const typingDot2 = useRef(new Animated.Value(0)).current;
  const typingDot3 = useRef(new Animated.Value(0)).current;

  // Update auth state ref on mount and focus
  useFocusEffect(
    useCallback(() => {
      const updateAuthState = async () => {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const [userToken, userEmail] = await Promise.all([
            AsyncStorage.getItem('userToken'),
            AsyncStorage.getItem('userEmail'),
          ]);
          isLoggedInRef.current = !!(userToken && userEmail);
        } catch (error) {
          console.error('Error checking auth status:', error);
          isLoggedInRef.current = false;
        }
      };
      updateAuthState();
    }, [])
  );

  // Prevent back navigation to GetStarted when logged in
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Check if user is logged in using ref (synchronous check)
        if (isLoggedInRef.current) {
          // On Android, exit app instead of going back
          if (Platform.OS === 'android') {
            BackHandler.exitApp();
          }
          return true; // Prevent default back behavior
        }
        return false; // Allow default back behavior if not logged in
      };

      if (Platform.OS === 'android') {
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
      }
    }, [])
  );

  // Handle navigation back button and iOS swipe back gesture
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
      // Check if user is logged in
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const userToken = await AsyncStorage.getItem('userToken');
        const userEmail = await AsyncStorage.getItem('userEmail');
        
        // If logged in, prevent navigation to GetStarted
        if (userToken && userEmail) {
          e.preventDefault();
          // On Android, exit app
          if (Platform.OS === 'android') {
            BackHandler.exitApp();
          }
          // On iOS, do nothing (prevent navigation)
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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
  }, [floatAnim1]);

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

  // Load top queries from backend with retry logic
  const loadTopQueries = async (retryCount = 0, maxRetries = 3) => {
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
    } catch (error: any) {
      console.error('Failed to load top queries:', error);
      // Retry on 404 errors (service not ready yet) with exponential backoff
      if (error?.message?.includes('404') && retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Max 5 seconds
        console.log(`Retrying top queries load in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          loadTopQueries(retryCount + 1, maxRetries);
        }, delay);
        return;
      }
      // No default suggestions - leave empty
      setTopQueries([]);
    } finally {
      setIsLoadingTopQueries(false);
    }
  };

  const loadChatHistory = async (retryCount = 0, maxRetries = 3) => {
    try {
      const token = await getUserToken();
      if (token) {
        const history = await AIService.getChatHistory(token);
        setChatHistory(history);
      }
    } catch (error: any) {
      console.error('Failed to load chat history:', error);
      // Retry on 404 errors (service not ready yet) with exponential backoff
      if (error?.message?.includes('404') && retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Max 5 seconds
        console.log(`Retrying chat history load in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          loadChatHistory(retryCount + 1, maxRetries);
        }, delay);
        return;
      }
    }
  };

  // Initialize chat data when screen is focused (ensures backend services are ready)
  // This runs on first focus and handles the initial load
  useFocusEffect(
    useCallback(() => {
      // Only initialize once on first focus
      if (hasInitialized.current) {
        return;
      }

      const initializeChat = async () => {
        try {
          // Wait a bit to ensure backend services are initialized
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Wait for auth token to be ready
          let attempts = 0;
          while (attempts < 10) {
            const token = await getUserToken();
            if (token) {
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
          }
          
          // Load chat history and top queries with retry logic
          loadChatHistory();
          loadTopQueries();
          
          hasInitialized.current = true;
        } catch (error) {
          console.error('Failed to initialize chat:', error);
          // Mark as initialized even on error to prevent infinite retries
          hasInitialized.current = true;
        }
      };
      
      initializeChat();
    }, [getUserToken])
  );

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

  // Save current conversation to AsyncStorage for persistence
  const saveCurrentConversation = useCallback(async () => {
    try {
      if (messages.length > 0 && sessionId.current) {
        const conversationData = {
          messages: messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
          })),
          sessionId: sessionId.current,
          selectedUserType,
        };
        await AsyncStorage.setItem('adminCurrentConversation', JSON.stringify(conversationData));
        // Save timestamp to detect app close
        lastSaveTime.current = Date.now();
        await AsyncStorage.setItem('adminConversationLastSaveTime', lastSaveTime.current.toString());
      }
    } catch (error) {
      console.error('Failed to save current conversation:', error);
    }
  }, [messages, sessionId, selectedUserType]);

  // Restore conversation from AsyncStorage
  const restoreCurrentConversation = useCallback(async () => {
    // Prevent multiple simultaneous restorations
    if (isRestoringRef.current) return;
    
    // Only restore if there are no current messages (empty conversation)
    if (messages.length > 0) return;
    
    // Only restore once per session
    if (hasRestoredConversation.current) return;
    
    try {
      isRestoringRef.current = true;
      const conversationData = await AsyncStorage.getItem('adminCurrentConversation');
      if (conversationData) {
        const parsed = JSON.parse(conversationData);
        if (parsed.messages && parsed.messages.length > 0 && parsed.sessionId) {
          // Restore messages with proper Date objects
          const restoredMessages = parsed.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(restoredMessages);
          sessionId.current = parsed.sessionId;
          if (parsed.selectedUserType) {
            setSelectedUserType(parsed.selectedUserType);
          }
          hasRestoredConversation.current = true;
        }
      }
    } catch (error) {
      console.error('Failed to restore current conversation:', error);
    } finally {
      isRestoringRef.current = false;
    }
  }, [messages.length]);

  // Clear current conversation from AsyncStorage
  const clearCurrentConversation = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('adminCurrentConversation');
      await AsyncStorage.removeItem('adminConversationLastSaveTime');
      hasRestoredConversation.current = false; // Reset flag to allow future restoration
      lastSaveTime.current = 0;
    } catch (error) {
      console.error('Failed to clear current conversation:', error);
    }
  }, []);

  // Track app lifecycle to detect actual app close (not just navigation)
  const appStartTime = useRef<number>(Date.now());
  const lastSaveTime = useRef<number>(0);
  
  // Clear conversation only on actual app start (not on navigation)
  useEffect(() => {
    const checkIfAppWasClosed = async () => {
      try {
        // Check when conversation was last saved
        const lastSave = await AsyncStorage.getItem('adminConversationLastSaveTime');
        const currentTime = Date.now();
        
        // If last save was more than 3 seconds ago, assume app was closed
        // This handles the case where app was closed and reopened
        if (lastSave) {
          const lastSaveTimestamp = parseInt(lastSave, 10);
          const timeSinceLastSave = currentTime - lastSaveTimestamp;
          
          // If more than 3 seconds passed, app was likely closed
          if (timeSinceLastSave > 3000) {
            await clearCurrentConversation();
            hasRestoredConversation.current = false;
          }
        } else {
          // No previous save, this is a fresh start
          await clearCurrentConversation();
          hasRestoredConversation.current = false;
        }
      } catch (error) {
        console.error('Failed to check app state:', error);
      }
    };
    
    // Only check on very first mount (app start)
    if (Date.now() - appStartTime.current < 1000) {
      checkIfAppWasClosed();
    }
  }, [clearCurrentConversation]);

  // Save chat when messages change (only if there are messages)
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory();
      // Also save to AsyncStorage for local persistence
      saveCurrentConversation();
    }
  }, [messages, saveCurrentConversation]);

  // Reload top queries when screen is focused and restore conversation
  // This runs every time the screen is focused (after initial load)
  useFocusEffect(
    useCallback(() => {
      // Restore conversation when screen comes into focus (only if no active conversation)
      // Use a small delay to ensure state is stable
      const restoreTimeout = setTimeout(() => {
        restoreCurrentConversation();
      }, 100);
      
      // Reload top queries when screen is focused (but only if already initialized)
      if (hasInitialized.current) {
        loadTopQueries();
      }
      
      // Save conversation when navigating away (on blur)
      return () => {
        clearTimeout(restoreTimeout);
        // Save conversation when screen loses focus
        if (messages.length > 0 && sessionId.current) {
          saveCurrentConversation();
        }
      };
    }, [selectedUserType, restoreCurrentConversation, saveCurrentConversation, messages.length])
  );

  // Reload top queries when userType changes
  useEffect(() => {
    loadTopQueries();
  }, [selectedUserType]);

  // Track app state changes and save conversation when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (previousState === 'active' && (nextAppState === 'background' || nextAppState === 'inactive')) {
        // App is going to background - mark it and save conversation
        appWasInBackground.current = true;
        if (messages.length > 0 && sessionId.current) {
          saveCurrentConversation();
        }
      } else if (previousState === 'background' && nextAppState === 'active') {
        // App is returning from background - keep conversation (don't clear)
        // Conversation will be restored by useFocusEffect if needed
      }
    });

    return () => {
      subscription.remove();
    };
  }, [messages, sessionId, saveCurrentConversation]);

  const loadChatFromHistory = async (chatId: string) => {
    try {
      const token = await getUserToken();
      if (!token) return;
      
      setIsLoading(true);
      const chatMessages = await AIService.getChatSession(chatId, token);
      setMessages(chatMessages);
      sessionId.current = chatId;
      // Save the loaded chat as current conversation
      if (chatMessages.length > 0) {
        const conversationData = {
          messages: chatMessages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
          })),
          sessionId: chatId,
          selectedUserType,
        };
        await AsyncStorage.setItem('adminCurrentConversation', JSON.stringify(conversationData));
      }
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
      
      // Scroll to bottom to show new message
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
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

  // Strip markdown formatting for cleaner clipboard text
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/`(.+?)`/g, '$1') // Remove inline code
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Convert links to text
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .trim();
  };

  // Copy message to clipboard
  const handleCopyMessage = async (content: string, isMarkdown: boolean = false) => {
    const textToCopy = isMarkdown ? stripMarkdown(content) : content;
    await Clipboard.setStringAsync(textToCopy);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Edit user message
  const handleEditMessage = (messageId: string, content: string) => {
    // Remove the message and its response from the messages list
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1) {
      // Remove the user message and any assistant response that follows it
      const newMessages = messages.slice(0, messageIndex);
      setMessages(newMessages);
      
      // Put the content in the input field
      setInputText(content);
      
      // Focus the input (if possible)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Show action menu for messages
  const handleMessageLongPress = (message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(message);
    setActionMenuVisible(true);
  };

  // Close action menu
  const closeActionMenu = () => {
    setActionMenuVisible(false);
    setSelectedMessage(null);
  };

  // Handle copy from action menu
  const handleCopyFromMenu = async () => {
    if (selectedMessage) {
      await handleCopyMessage(selectedMessage.content, selectedMessage.role === 'assistant');
      closeActionMenu();
    }
  };

  // Handle edit from action menu
  const handleEditFromMenu = () => {
    if (selectedMessage && selectedMessage.role === 'user') {
      handleEditMessage(selectedMessage.id, selectedMessage.content);
      closeActionMenu();
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

      {/* Animated Floating Background Orb (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        {/* Orb 1 - Soft Blue Glow (Center area) */}
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
              colors={[theme.colors.orbColors.orange1, theme.colors.orbColors.orange2, theme.colors.orbColors.orange3]}
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
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(17) }]}>
            {messages.length > 0 ? 'Conversation' : 'New Conversation'}
          </Text>
          <View style={[styles.userTypeLabel, { backgroundColor: selectedUserType === 'student' ? theme.colors.accent : '#FBBF24' }]}>
            <Text style={[styles.userTypeLabelText, { fontSize: theme.fontSize.scaleSize(9) }]}>
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
              <View style={[styles.profileIconCircle, { backgroundColor: theme.colors.accent }]}>
                <Text style={[styles.profileInitials, { fontSize: theme.fontSize.scaleSize(13) }]}>AD</Text>
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
          clearCurrentConversation();
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
            iconColor: theme.colors.accent,
            iconBgColor: theme.colors.accent + '20',
            text: 'Draft announcements and events faster'
          },
          {
            icon: 'document-text',
            iconColor: theme.colors.accentDark,
            iconBgColor: theme.colors.accent + '20',
            text: 'Summarize long updates into key points'
          },
          {
            icon: 'help-circle',
            iconColor: theme.colors.accent,
            iconBgColor: theme.colors.accent + '20',
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
            <Text style={[styles.askTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(18) }]}>Ask DOrSU AI anything</Text>
            <Text style={[styles.disclaimer, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }]}>Responses are generated by AI and may be inaccurate.</Text>
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
                  <View style={styles.aiAvatar}>
                    <Image 
                      source={require('../../../../assets/DOrSU.png')} 
                      style={styles.aiAvatarImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
                {message.role === 'user' ? (
                  <Pressable
                    onLongPress={() => handleMessageLongPress(message)}
                    style={[
                      styles.messageBubble,
                      { backgroundColor: theme.colors.accent }
                    ]}
                  >
                    <Text style={[styles.messageText, { color: '#FFFFFF', fontSize: theme.fontSize.scaleSize(15) }]}>
                      {message.content}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onLongPress={() => handleMessageLongPress(message)}
                    style={[styles.messageBubble, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}
                  >
                    <Markdown
                      style={getMarkdownStyles(theme)}
                      onLinkPress={(url: string) => {
                        Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
                        return false;
                      }}
                    >
                      {message.content}
                    </Markdown>
                  </Pressable>
                )}
              </View>
            ))}
            {isLoading && (
              <View style={styles.assistantMessageRow}>
                <View style={styles.aiAvatar}>
                  <Image 
                    source={require('../../../../assets/DOrSU.png')} 
                    style={styles.aiAvatarImage}
                    resizeMode="cover"
                  />
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
                <Text style={[styles.faqsLabel, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(16) }]}>Top 5 FAQs</Text>
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
                            <View style={[styles.promptIconWrap, { backgroundColor: isDarkMode ? theme.colors.accent + '26' : theme.colors.accent + '1A' }]}>
                              <Ionicons name="reorder-three" size={16} color={theme.colors.accent} />
                            </View>
                            <Text style={[styles.promptCardText, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(14) }]}>{txt}</Text>
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
            style={[styles.userTypeToggle, { backgroundColor: selectedUserType === 'student' ? theme.colors.accent : '#FBBF24' }]}
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
                  { color: selectedUserType === 'student' ? theme.colors.accent : '#FFFFFF', fontSize: theme.fontSize.scaleSize(12) }
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
                  { color: selectedUserType === 'faculty' ? '#FBBF24' : '#FFFFFF', fontSize: theme.fontSize.scaleSize(12) }
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
              style={[styles.input, { color: isDarkMode ? '#F9FAFB' : '#111827', fontSize: theme.fontSize.scaleSize(15) }]}
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
                  { backgroundColor: theme.colors.accent },
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

      {/* Action Menu Modal */}
      <Modal
        visible={actionMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeActionMenu}
      >
        <Pressable 
          style={styles.actionMenuOverlay} 
          onPress={closeActionMenu}
        >
          <View 
            style={[
              styles.actionMenuContainer,
              { 
                backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                paddingBottom: insets.bottom + 20,
              }
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.actionMenuHeader}>
              <Text style={[
                styles.actionMenuTitle,
                { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(18) }
              ]}>
                {selectedMessage?.role === 'user' ? 'Message Options' : 'AI Response Options'}
              </Text>
            </View>
            
            <View style={styles.actionMenuButtons}>
              <TouchableOpacity
                style={[
                  styles.actionMenuButton,
                  { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
                ]}
                onPress={handleCopyFromMenu}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={20} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
                <Text style={[
                  styles.actionMenuButtonText,
                  { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(16) }
                ]}>
                  Copy
                </Text>
              </TouchableOpacity>

              {selectedMessage?.role === 'user' && (
                <TouchableOpacity
                  style={[
                    styles.actionMenuButton,
                    { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
                  ]}
                  onPress={handleEditFromMenu}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={20} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
                  <Text style={[
                    styles.actionMenuButtonText,
                    { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(16) }
                  ]}>
                    Edit
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.actionMenuCancelButton,
                { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
              ]}
              onPress={closeActionMenu}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.actionMenuCancelText,
                { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(16) }
              ]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
    borderColor: 'transparent', // Will be set dynamically via theme
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
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  aiAvatarImage: {
    width: '100%',
    height: '100%',
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
  actionMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionMenuContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    maxHeight: '50%',
  },
  actionMenuHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  actionMenuTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionMenuButtons: {
    gap: 12,
    marginBottom: 12,
  },
  actionMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
  },
  actionMenuButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionMenuCancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  actionMenuCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminAIChat;
