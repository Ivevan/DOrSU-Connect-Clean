import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, AppStateStatus, BackHandler, Image, Linking, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import UserSidebar from '../../components/navigation/UserSidebar';
import { theme } from '../../config/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';
import AIService, { ChatHistoryItem, isNetworkError, Message, NetworkError } from '../../services/AIService';
import ReconnectionService from '../../services/ReconnectionService';
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

// No default suggestions - FAQs will be empty until populated from backend

const AIChat = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t, colorTheme } = useTheme();
  const { getUserToken, userEmail: authUserEmail, checkAuthStatus } = useAuth();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnline = isConnected && isInternetReachable;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const isWide = width > 600;
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
  const hasInitialized = useRef<boolean>(false);
  const isEditingRef = useRef<boolean>(false);
  const originalMessagesRef = useRef<Message[]>([]);
  const previousUserTypeRef = useRef<'student' | 'faculty'>('student');

  // Segmented control animation and width tracking
  const segmentAnim = useRef(new Animated.Value(0)).current;
  const segmentWidth = useRef(0);

  // Animated floating background orb (Copilot-style)
  const floatAnim1 = useRef(new Animated.Value(0)).current;

  // Typing indicator animations
  const typingDot1 = useRef(new Animated.Value(0)).current;
  const typingDot2 = useRef(new Animated.Value(0)).current;
  const typingDot3 = useRef(new Animated.Value(0)).current;

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

  // Prevent back navigation to GetStarted when logged in
  useFocusEffect(
    useCallback(() => {
      const onBackPress = async () => {
        // Check if user is logged in
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const userToken = await AsyncStorage.getItem('userToken');
          const userEmail = await AsyncStorage.getItem('userEmail');
          
          // If logged in, prevent navigation to GetStarted
          if (userToken && userEmail) {
            // On Android, exit app instead of going back
            if (Platform.OS === 'android') {
              BackHandler.exitApp();
              return true;
            }
            // On iOS, prevent the back action
            return true;
          }
        } catch (error) {
          console.error('Error checking auth status:', error);
        }
        return false; // Allow default back behavior if not logged in
      };

      if (Platform.OS === 'android') {
        const onBackPressWrapper = () => {
          // onBackPress returns a Promise<boolean>, but hardwareBackPress expects sync return
          // So we call async and handle result, but always return true to prevent default behavior
          onBackPress();
          return true;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPressWrapper);
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
        // Only restrict FAQs when student mode is active; faculty sees all
        const queries = await AIService.getTopQueries(
          token,
          selectedUserType === 'student' ? 'student' : undefined
        );
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
          
          // Refresh auth status to ensure we have the latest token
          await checkAuthStatus();
          
          // Wait for auth to be ready
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
    }, [checkAuthStatus, getUserToken])
  );

  // Subscribe to auth changes when screen is focused and reload top queries
  // This runs every time the screen is focused (after initial load)
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
      
      // Refresh top queries when screen is focused (but only if already initialized)
      if (hasInitialized.current) {
        loadTopQueries();
      }
      
      return () => {
        clearTimeout(timeoutId);
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }, [selectedUserType])
  );

  // Reload top queries when userType changes
  useEffect(() => {
    loadTopQueries();
  }, [selectedUserType]);

  // Reset chat when userType changes
  useEffect(() => {
    // Skip on initial mount (when selectedUserType is first set)
    if (!hasInitialized.current) {
      previousUserTypeRef.current = selectedUserType;
      return;
    }

    // Only reset if userType actually changed
    if (previousUserTypeRef.current === selectedUserType) {
      return;
    }

    // Save current conversation with previous userType before clearing
    const saveAndReset = async () => {
      try {
        // Capture current messages and sessionId before clearing
        const currentMessages = messages;
        const currentSessionId = sessionId.current;
        
        // Save current conversation if there are messages, using the PREVIOUS userType
        if (currentMessages.length > 0 && currentSessionId) {
          const token = await getUserToken();
          if (token) {
            // Save with the previous userType before switching
            await AIService.saveChatHistory(currentSessionId, currentMessages, token, previousUserTypeRef.current);
            await loadChatHistory();
          }
        }
        
        // Clear current conversation
        setMessages([]);
        sessionId.current = '';
        hasRestoredConversation.current = false;
        await clearCurrentConversation();
        setInputText('');
        isEditingRef.current = false;
        setIsEditing(false);
        originalMessagesRef.current = [];
        
        // Update the previous userType ref
        previousUserTypeRef.current = selectedUserType;
      } catch (error) {
        console.error('Failed to reset chat on userType change:', error);
        // Still update the ref even on error
        previousUserTypeRef.current = selectedUserType;
      }
    };

    saveAndReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserType]);

  // Animate floating background orb on mount
  useEffect(() => {
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
    ).start();
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
        await AsyncStorage.setItem('currentConversation', JSON.stringify(conversationData));
        // Save timestamp to detect app close
        lastSaveTime.current = Date.now();
        await AsyncStorage.setItem('conversationLastSaveTime', lastSaveTime.current.toString());
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
      const conversationData = await AsyncStorage.getItem('currentConversation');
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
      await AsyncStorage.removeItem('currentConversation');
      await AsyncStorage.removeItem('conversationLastSaveTime');
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
        const lastSave = await AsyncStorage.getItem('conversationLastSaveTime');
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

  // Restore conversation when screen comes into focus, save when navigating away
  useFocusEffect(
    useCallback(() => {
      // Restore conversation when screen comes into focus (only if no active conversation)
      // Use a small delay to ensure state is stable
      const restoreTimeout = setTimeout(() => {
        restoreCurrentConversation();
      }, 100);
      
      // Save conversation when navigating away (on blur)
      return () => {
        clearTimeout(restoreTimeout);
        if (messages.length > 0 && sessionId.current) {
          saveCurrentConversation();
        }
      };
    }, [restoreCurrentConversation, saveCurrentConversation, messages.length])
  );

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
              await AIService.saveChatHistory(sessionId.current, messages, firebaseToken, selectedUserType);
              await loadChatHistory();
            }
          } catch (err) {
            console.error('❌ saveChatHistory: Failed to get Firebase token:', err);
          }
        }
        return;
      }
      
      if (messages.length > 0 && sessionId.current) {
        const success = await AIService.saveChatHistory(sessionId.current, messages, token, selectedUserType);
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

  // Save chat when messages change (only if there are messages)
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory();
      // Also save to AsyncStorage for local persistence
      saveCurrentConversation();
    }
  }, [messages, saveCurrentConversation]);

  const loadChatFromHistory = async (chatId: string) => {
    try {
      const token = await getUserToken();
      if (!token) return;
      
      setIsLoading(true);
      const chatMessages = await AIService.getChatSession(chatId, token);
      setMessages(chatMessages);
      sessionId.current = chatId; // Set the session ID to the loaded chat
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
        await AsyncStorage.setItem('currentConversation', JSON.stringify(conversationData));
      }
      setIsHistoryOpen(false);
    } catch (error) {
      console.error('Failed to load chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAllChats = async () => {
    try {
      const token = await getUserToken();
      if (!token) {
        const user = getCurrentUser();
        if (user && typeof user.getIdToken === 'function') {
          const firebaseToken = await user.getIdToken();
          const success = await AIService.deleteAllChatHistory(firebaseToken);
          if (success) {
            setChatHistory([]);
            sessionId.current = '';
            setMessages([]);
            await loadChatHistory();
          }
        }
        return;
      }
      
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

    // Capture current messages before adding the new one (for conversation history)
    // This is the state after removing the edited message and subsequent messages
    const currentMessages = messages;

    // Create user message (this replaces the edited message)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    // Add user message to chat (replaces the old one that was removed during edit)
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    // Clear edit mode after sending
    isEditingRef.current = false;
    setIsEditing(false);
    originalMessagesRef.current = [];
    setIsLoading(true);

    try {
      // Call AI service with selected userType
      const token = await getUserToken();
      
      // If there are previous messages, include conversation history in the prompt
      // This ensures the AI can regenerate properly when a message is edited
      // When editing, we want to regenerate based on the conversation up to the edited point
      let promptToSend = textToSend;
      if (currentMessages.length > 0) {
        // Build conversation history from existing messages (before the new/edited one)
        const conversationHistory = currentMessages
          .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        // Include the new/edited message in the context
        promptToSend = `${conversationHistory}\n\nUser: ${textToSend}`;
      }
      
      const response = await AIService.sendMessage(promptToSend, token || undefined, selectedUserType);

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
        const queuedMessages = currentMessages; // Store messages before the new one for context
        
        ReconnectionService.queueRequest({
          execute: async () => {
            const token = await getUserToken();
            
            // Include conversation history if there are previous messages
            let promptToSend = queuedMessage;
            if (queuedMessages.length > 0) {
              const conversationHistory = queuedMessages
                .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
                .join('\n\n');
              promptToSend = `${conversationHistory}\n\nUser: ${queuedMessage}`;
            }
            
            const response = await AIService.sendMessage(promptToSend, token || undefined, queuedUserType);
            
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
      // Store original messages state for cancel functionality (full conversation before edit)
      originalMessagesRef.current = [...messages];
      isEditingRef.current = true;
      setIsEditing(true);
      
      // Remove the user message and any assistant response that follows it
      // This allows the user to edit and regenerate from this point
      const newMessages = messages.slice(0, messageIndex);
      setMessages(newMessages);
      
      // Put the content in the input field
      setInputText(content);
      
      // Focus the input (if possible)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Cancel edit and restore original conversation
  const cancelEdit = useCallback(() => {
    if (isEditingRef.current && originalMessagesRef.current.length > 0) {
      setMessages(originalMessagesRef.current);
      setInputText('');
      isEditingRef.current = false;
      setIsEditing(false);
      originalMessagesRef.current = [];
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

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
              colors={[t.colors.orbColors.orange1, t.colors.orbColors.orange2, t.colors.orbColors.orange3]}
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
            activeOpacity={0.7}
          >
            <View style={styles.customHamburger} pointerEvents="none">
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(17) }]}>
            {messages.length > 0 ? 'Conversation' : 'New Conversation'}
          </Text>
        </View>
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
              <View style={[styles.profileIconCircle, { backgroundColor: t.colors.accent }]}>
                <Text style={[styles.profileInitials, { fontSize: t.fontSize.scaleSize(13) }]}>{getUserInitials()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {/* User Sidebar Component */}
      <UserSidebar
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
        selectedUserType={selectedUserType}
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
            } else {
              // Fallback to Firebase token
              const user = getCurrentUser();
              if (user && typeof user.getIdToken === 'function') {
                const firebaseToken = await user.getIdToken();
                const success = await AIService.deleteChatSession(chatId, firebaseToken);
                if (success) {
                  setChatHistory(prev => prev.filter(h => h.id !== chatId));
                  if (sessionId.current === chatId) {
                    sessionId.current = '';
                    setMessages([]);
                  }
                  await loadChatHistory(); // Refresh the list
                }
              }
            }
          } catch (error) {
            console.error('Failed to delete chat:', error);
          }
        }}
        onDeleteAllChats={handleDeleteAllChats}
      />
      {/* Info Modal */}
      <Modal visible={isInfoOpen} transparent animationType="fade" onRequestClose={() => setIsInfoOpen(false)}>
        <View style={styles.infoModalOverlay}>
          <View style={[styles.infoCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <View style={styles.infoHeader}>
              <Text style={[styles.infoTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(16) }]}>About DOrSU AI</Text>
              <Pressable onPress={() => setIsInfoOpen(false)} style={styles.infoCloseBtn} accessibilityLabel="Close info">
                <Ionicons name="close" size={20} color={t.colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.infoBodyText, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(14) }]}>DOrSU AI can help you:</Text>
            <View style={styles.infoCards}>
              <View style={[styles.infoCardBox, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                <View style={[styles.infoCardIconWrap, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                  <Ionicons name="help-circle" size={18} color={t.colors.primary} />
                </View>
                <Text style={[styles.infoCardText, { color: t.colors.text, fontSize: t.fontSize.scaleSize(13) }]}>Answer questions about enrollment and policies</Text>
              </View>
              <View style={[styles.infoCardBox, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                <View style={[styles.infoCardIconWrap, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                  <Ionicons name="location" size={18} color={t.colors.primary} />
                </View>
                <Text style={[styles.infoCardText, { color: t.colors.text, fontSize: t.fontSize.scaleSize(13) }]}>Find campus locations and facilities</Text>
              </View>
              <View style={[styles.infoCardBox, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                <View style={[styles.infoCardIconWrap, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                  <Ionicons name="school" size={18} color={t.colors.primary} />
                </View>
                <Text style={[styles.infoCardText, { color: t.colors.text, fontSize: t.fontSize.scaleSize(13) }]}>Get information about academic programs</Text>
              </View>
            </View>
            <View style={[styles.infoNote, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={t.colors.textMuted} />
              <Text style={[styles.infoNoteText, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(12) }]}>Avoid sharing sensitive or personal data.</Text>
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
            <Text style={[styles.askTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(18) }]}>What do you want to know about DOrSU?</Text>
            <Text style={[styles.disclaimer, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(12) }]}>Responses are generated by AI and may be inaccurate.</Text>
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
                      { backgroundColor: t.colors.accent }
                    ]}
                  >
                    <Text style={[styles.messageText, { color: '#FFFFFF', fontSize: t.fontSize.scaleSize(15) }]}>
                      {message.content}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onLongPress={() => handleMessageLongPress(message)}
                    style={[styles.messageBubble, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}
                  >
                    <View>
                      <Markdown
                        style={getMarkdownStyles(t)}
                        onLinkPress={(url: string) => {
                          Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
                          return false;
                        }}
                      >
                        {message.content}
                      </Markdown>
                    </View>
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
                <Text style={[styles.faqsLabel, { color: t.colors.text, fontSize: t.fontSize.scaleSize(16) }]}>Top 5 FAQs</Text>
                <Ionicons 
                  name={isFaqsExpanded ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={t.colors.text} 
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
                      <ActivityIndicator size="small" color={t.colors.accent} />
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
                            <View style={[styles.promptIconWrap, { backgroundColor: isDarkMode ? t.colors.accent + '26' : t.colors.accent + '1A' }]}>
                              <Ionicons name="reorder-three" size={16} color={t.colors.accent} />
                            </View>
                            <Text style={[styles.promptCardText, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(14) }]}>{txt}</Text>
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

        {/* Editing Message Indicator */}
        {isEditing && (
          <View style={[styles.editingIndicator, {
            backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
          }]}>
            <View style={styles.editingIndicatorContent}>
              <Ionicons name="create-outline" size={16} color={t.colors.accent} />
              <Text style={[styles.editingIndicatorText, { 
                color: isDarkMode ? '#F9FAFB' : '#1F2937',
                fontSize: t.fontSize.scaleSize(13)
              }]}>
                Editing message
              </Text>
            </View>
            <TouchableOpacity
              onPress={cancelEdit}
              style={styles.editingCancelButton}
              accessibilityLabel="Cancel edit"
            >
              <Ionicons name="close" size={18} color={t.colors.accent} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputBarOuter, {
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }]}>
          <View style={[styles.inputBar, {
            backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
            borderColor: isDarkMode ? '#374151' : '#E5E7EB',
            shadowColor: '#000',
          }]}>
            <TextInput
              style={[styles.input, { color: isDarkMode ? '#F9FAFB' : '#111827', fontSize: t.fontSize.scaleSize(15) }]}
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
                  { backgroundColor: t.colors.accent },
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
      <UserBottomNavBar />

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
                { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(18) }
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
                  { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(16) }
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
                    { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(16) }
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
                { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(16) }
              ]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

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
  headerRight: {
    width: 44,
    alignItems: 'flex-end',
    zIndex: 11,
  },
  profileButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
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
  emptyFaqsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFaqsText: {
    fontSize: 13,
    fontStyle: 'italic',
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
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  inputBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  editingIndicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editingIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  editingCancelButton: {
    padding: 4,
    borderRadius: 12,
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
  aiMessageCard: {
    overflow: 'hidden',
  },
  aiMessageBlur: {
    borderRadius: 20,
  },
  aiMessageContent: {
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  typingText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
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

export default AIChat;