import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Animated, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import AIService, { ChatHistoryItem } from '../../services/AIService';
import { getCurrentUser } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

type Role = 'admin' | 'moderator' | 'user' | null;

// Union of routes needed for both admin and user flows
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
  ManageAccounts: undefined;
  ActivityLog: undefined;
};

type Navigation = NativeStackNavigationProp<RootStackParamList>;

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chatHistory?: ChatHistoryItem[];
  onChatSelect?: (chatId: string) => void;
  onNewConversation?: () => void;
  getUserToken?: () => Promise<string | null>;
  sessionId?: string;
  onDeleteChat?: (chatId: string) => void;
  onDeleteAllChats?: () => Promise<void>;
  selectedUserType?: 'student' | 'faculty';

  // Role handling
  roleOverride?: Role;
  allowedRoles?: Role[]; // render only for these roles
  disableIfUnauthorized?: boolean; // default true
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  chatHistory = [],
  onChatSelect,
  onNewConversation,
  getUserToken,
  sessionId,
  onDeleteChat,
  onDeleteAllChats,
  selectedUserType = 'student',
  roleOverride = null,
  allowedRoles = ['user', 'moderator', 'admin'],
  disableIfUnauthorized = true,
}) => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute();
  const { isDarkMode, theme: t, colorTheme } = useThemeValues();
  const insets = useSafeAreaInsets();
  const sidebarAnim = useRef(new Animated.Value(-320)).current;
  const { userRole, isAdmin, isLoading: authLoading, refreshUser } = useAuth();

  const effectiveRole: Role = roleOverride ?? (isAdmin ? 'admin' : userRole ?? 'user');
  const isAuthorized = !allowedRoles || allowedRoles.includes(effectiveRole);

  // Determine current active screen
  const currentScreen = route.name as keyof RootStackParamList;

  // Sort chat history by timestamp (newest first)
  const sortedChatHistory = useMemo(() => {
    return [...chatHistory].sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      if (isNaN(timeA) && isNaN(timeB)) return 0;
      if (isNaN(timeA)) return 1;
      if (isNaN(timeB)) return -1;
      return timeB - timeA;
    });
  }, [chatHistory]);

  // User state for avatar
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  // Load user data and refresh role when possible
  useFocusEffect(
    useCallback(() => {
      const loadUserData = async () => {
        try {
          const user = getCurrentUser();
          setCurrentUser(user);
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const userPhoto = await AsyncStorage.getItem('userPhoto');
          setBackendUserPhoto(userPhoto);
          await refreshUser?.();
        } catch (error) {
          console.error('Failed to load user data:', error);
        }
      };
      loadUserData();
    }, [refreshUser])
  );

  const getUserInitials = () => {
    if (!currentUser?.displayName) return effectiveRole === 'admin' ? 'AD' : '?';
    const names = currentUser.displayName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return currentUser.displayName.substring(0, 2).toUpperCase();
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Animate sidebar when opening/closing
  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: isOpen ? 0 : -320,
      duration: 300,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isOpen, sidebarAnim]);

  const handleDeleteChatClick = (chatId: string) => {
    setChatToDelete(chatId);
    setShowDeleteModal(true);
  };

  const handleDeleteChat = async () => {
    if (!chatToDelete) return;
    if (onDeleteChat) {
      onDeleteChat(chatToDelete);
      setShowDeleteModal(false);
      setChatToDelete(null);
      return;
    }
    try {
      let token = getUserToken ? await getUserToken() : null;
      if (!token) {
        const user = getCurrentUser();
        if (user && typeof user.getIdToken === 'function') {
          token = await user.getIdToken();
        }
      }
      if (!token) {
        setShowDeleteModal(false);
        setChatToDelete(null);
        return;
      }
      await AIService.deleteChatSession(chatToDelete, token);
      setShowDeleteModal(false);
      setChatToDelete(null);
    } catch (e) {
      console.error('Failed to delete chat:', e);
      setShowDeleteModal(false);
      setChatToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setChatToDelete(null);
  };

  const titleText =
    effectiveRole === 'admin'
      ? 'Admin Panel'
      : effectiveRole === 'moderator'
      ? 'Moderator Panel'
      : 'DOrSU AI';

  const isCurrent = (screen: keyof RootStackParamList) => currentScreen === screen;

  const menuItems = useMemo(() => {
    if (effectiveRole === 'admin') {
      return [
        {
          key: 'ai',
          label: 'AI Assistant',
          icon: isCurrent('AdminAIChat') ? 'home' : 'home-outline',
          target: 'AdminAIChat' as keyof RootStackParamList,
          onPress: () => {
            onNewConversation?.();
            onClose();
            navigation.navigate('AdminAIChat');
          },
        },
        {
          key: 'dashboard',
          label: 'Events',
          icon: isCurrent('AdminDashboard') ? 'newspaper' : 'newspaper-outline',
          target: 'AdminDashboard' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('AdminDashboard');
          },
        },
        {
          key: 'calendar',
          label: 'Calendar',
          icon: isCurrent('AdminCalendar') ? 'calendar' : 'calendar-outline',
          target: 'AdminCalendar' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('AdminCalendar');
          },
        },
        {
          key: 'postUpdate',
          label: 'Post Update',
          icon: isCurrent('PostUpdate') ? 'create' : 'create-outline',
          target: 'PostUpdate' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('PostUpdate');
          },
        },
        {
          key: 'managePosts',
          label: 'Manage Posts',
          icon: isCurrent('ManagePosts') ? 'list' : 'list-outline',
          target: 'ManagePosts' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('ManagePosts');
          },
        },
        {
          key: 'manageAccounts',
          label: 'Manage Accounts',
          icon: isCurrent('ManageAccounts') ? 'people' : 'people-outline',
          target: 'ManageAccounts' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('ManageAccounts');
          },
          roleGate: 'admin',
        },
        {
          key: 'settings',
          label: 'Profile Settings',
          icon: isCurrent('AdminSettings') ? 'person-circle' : 'person-circle-outline',
          target: 'AdminSettings' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('AdminSettings');
          },
        },
      ];
    }

    if (effectiveRole === 'moderator') {
      return [
        {
          key: 'ai',
          label: 'AI Assistant',
          icon: isCurrent('AdminAIChat') ? 'home' : 'home-outline',
          target: 'AdminAIChat' as keyof RootStackParamList,
          onPress: () => {
            onNewConversation?.();
            onClose();
            navigation.navigate('AdminAIChat');
          },
        },
        {
          key: 'dashboard',
          label: 'Events',
          icon: isCurrent('AdminDashboard') ? 'newspaper' : 'newspaper-outline',
          target: 'AdminDashboard' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('AdminDashboard');
          },
        },
        {
          key: 'calendarUser',
          label: 'Calendar',
          icon: isCurrent('Calendar') ? 'calendar' : 'calendar-outline',
          target: 'Calendar' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('Calendar');
          },
        },
        {
          key: 'postUpdate',
          label: 'Post Update',
          icon: isCurrent('PostUpdate') ? 'create' : 'create-outline',
          target: 'PostUpdate' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('PostUpdate');
          },
        },
        {
          key: 'managePosts',
          label: 'Manage Posts',
          icon: isCurrent('ManagePosts') ? 'list' : 'list-outline',
          target: 'ManagePosts' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('ManagePosts');
          },
        },
        {
          key: 'settings',
          label: 'Profile Settings',
          icon: isCurrent('UserSettings') ? 'person-circle' : 'person-circle-outline',
          target: 'UserSettings' as keyof RootStackParamList,
          onPress: () => {
            onClose();
            navigation.navigate('UserSettings');
          },
        },
      ];
    }

    // Default: user
    return [
      {
        key: 'ai',
        label: 'AI Assistant',
        icon: isCurrent('AIChat') ? 'home' : 'home-outline',
        target: 'AIChat' as keyof RootStackParamList,
        onPress: () => {
          onNewConversation?.();
          onClose();
          navigation.navigate('AIChat');
        },
      },
      {
        key: 'updates',
        label: 'Events',
        icon: isCurrent('SchoolUpdates') ? 'newspaper' : 'newspaper-outline',
        target: 'SchoolUpdates' as keyof RootStackParamList,
        onPress: () => {
          onClose();
          navigation.navigate('SchoolUpdates');
        },
      },
      {
        key: 'calendar',
        label: 'Calendar',
        icon: isCurrent('Calendar') ? 'calendar' : 'calendar-outline',
        target: 'Calendar' as keyof RootStackParamList,
        onPress: () => {
          onClose();
          navigation.navigate('Calendar');
        },
      },
      {
        key: 'settings',
        label: 'Profile Settings',
        icon: isCurrent('UserSettings') ? 'person-circle' : 'person-circle-outline',
        target: 'UserSettings' as keyof RootStackParamList,
        onPress: () => {
          onClose();
          navigation.navigate('UserSettings');
        },
      },
    ];
  }, [effectiveRole, currentScreen, navigation, onClose, onNewConversation]);

  // Guard after hooks to avoid hook-order mismatches while skipping render
  if (disableIfUnauthorized && !isAuthorized) {
    return null;
  }

  return (
    <>
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: sidebarAnim }],
            backgroundColor: isDarkMode ? '#1F2937' : effectiveRole === 'user' ? '#F9FAFB' : '#F5F2ED',
            paddingTop: insets.top,
          },
        ]}
      >
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarLogoSection}>
            <View style={[styles.sidebarLogo, { backgroundColor: t.colors.accent }]}>
              <Ionicons name={effectiveRole === 'user' ? 'school' : 'shield-checkmark'} size={28} color="#FFFFFF" />
            </View>
            <Text
              style={[
                styles.sidebarTitle,
                { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(20) },
              ]}
            >
              {titleText}
            </Text>
          </View>
          <View style={styles.sidebarHeaderButtons}>
            <TouchableOpacity
              style={styles.sidebarIconButton}
              onPress={() => {
                onNewConversation?.();
                onClose();
              }}
              accessibilityLabel="New conversation"
            >
              <Ionicons name="create-outline" size={26} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.sidebarIconButton} accessibilityLabel="Close sidebar">
              <View style={styles.customHamburger} pointerEvents="none">
                <View
                  style={[
                    styles.hamburgerLine,
                    styles.hamburgerLineShort,
                    { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' },
                  ]}
                />
                <View
                  style={[
                    styles.hamburgerLine,
                    styles.hamburgerLineLong,
                    { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' },
                  ]}
                />
                <View
                  style={[
                    styles.hamburgerLine,
                    styles.hamburgerLineShort,
                    { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sidebarMenu}>
          {menuItems
            .filter((item) => !item.roleGate || item.roleGate === effectiveRole)
            .map((item) => (
              <TouchableOpacity key={item.key} style={styles.sidebarMenuItem} onPress={item.onPress}>
                <Ionicons
                  name={item.icon as any}
                  size={24}
                  color={
                    (isCurrent(item.target) ? t.colors.accent : isDarkMode ? '#9CA3AF' : '#6B7280') as string
                  }
                />
                <Text
                  style={[
                    styles.sidebarMenuText,
                    {
                      color: isCurrent(item.target) ? t.colors.accent : isDarkMode ? '#D1D5DB' : '#4B5563',
                      fontWeight: isCurrent(item.target) ? '600' : '500',
                      fontSize: t.fontSize.scaleSize(16),
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
        </View>

        {(currentScreen === 'AIChat' || currentScreen === 'AdminAIChat') && (
          <View style={styles.sidebarHistorySection}>
            <View style={styles.sidebarSectionHeader}>
              <Text
                style={[
                  styles.sidebarSectionTitle,
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: t.fontSize.scaleSize(12) },
                ]}
              >
                Recent Chats
              </Text>
              {sortedChatHistory.length > 0 && onDeleteAllChats && (
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={async () => {
                    try {
                      await onDeleteAllChats();
                    } catch (error) {
                      console.error('Failed to delete all chats:', error);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.clearAllText,
                      { color: isDarkMode ? '#EF4444' : '#DC2626', fontSize: t.fontSize.scaleSize(12) },
                    ]}
                  >
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.sidebarContent} showsVerticalScrollIndicator={false}>
              {sortedChatHistory.length === 0 ? (
                <View style={styles.emptyHistoryContainer}>
                  <Ionicons name="chatbubbles-outline" size={40} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                  <Text
                    style={[
                      styles.emptyHistoryText,
                      { color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: t.fontSize.scaleSize(14) },
                    ]}
                  >
                    No chat history yet
                  </Text>
                </View>
              ) : (
                sortedChatHistory.map((chat, idx) => (
                  <View key={`${chat.id}:${idx}`} style={styles.historyItem}>
                    <TouchableOpacity
                      style={[
                        styles.historyItemButton,
                        { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' },
                      ]}
                      onPress={() => {
                        onChatSelect?.(chat.id);
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.historyItemContent}>
                        <View style={styles.historyItemTextContainer}>
                          <View style={styles.historyTitleRow}>
                            <Text
                              style={[
                                styles.historyTitle,
                                { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(14) },
                              ]}
                              numberOfLines={1}
                            >
                              {chat.title}
                            </Text>
                          </View>
                          <View style={styles.historyActionsRow}>
                            <Text
                              style={[
                                styles.historyPreview,
                                { color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: t.fontSize.scaleSize(13) },
                              ]}
                              numberOfLines={1}
                            >
                              {chat.preview}
                            </Text>
                            <TouchableOpacity
                              style={styles.deleteHistoryBtn}
                              onPress={() => handleDeleteChatClick(chat.id)}
                              accessibilityLabel="Delete chat"
                            >
                              <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                          {chat.timestamp && (
                            <View style={styles.historyDateRow}>
                              <Ionicons name="time-outline" size={9} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                              <Text
                                style={[
                                  styles.historyDate,
                                  { color: isDarkMode ? '#6B7280' : '#9CA3AF', fontSize: t.fontSize.scaleSize(10) },
                                ]}
                              >
                                {formatDate(
                                  chat.timestamp instanceof Date ? chat.timestamp : new Date(chat.timestamp)
                                )}{' '}
                                • {formatTime(chat.timestamp instanceof Date ? chat.timestamp : new Date(chat.timestamp))}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {isOpen && <TouchableOpacity style={styles.sidebarOverlay} onPress={onClose} activeOpacity={1} />}

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={handleCancelDelete}>
        <TouchableOpacity style={styles.deleteModalOverlay} activeOpacity={1} onPress={handleCancelDelete}>
          <View style={styles.deleteModalContentWrapper}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 80 : 60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[
                styles.deleteModalContent,
                {
                  backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
              ]}
            >
              <View style={[styles.deleteModalIconCircle, { backgroundColor: '#EF444420' }]}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <Text
                style={[
                  styles.deleteModalTitle,
                  { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(16) },
                ]}
              >
                Delete Conversation?
              </Text>
              <Text
                style={[
                  styles.deleteModalMessage,
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: t.fontSize.scaleSize(12) },
                ]}
              >
                This action cannot be undone.
              </Text>
              <View style={styles.deleteModalActions}>
                <TouchableOpacity
                  style={[
                    styles.deleteModalButton,
                    styles.deleteModalButtonCancel,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                  onPress={handleCancelDelete}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.deleteModalButtonText,
                      { color: isDarkMode ? '#D1D5DB' : '#4B5563', fontSize: t.fontSize.scaleSize(13) },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalButtonConfirm, { backgroundColor: '#EF4444' }]}
                  onPress={handleDeleteChat}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.deleteModalButtonText, { color: '#FFFFFF', fontSize: t.fontSize.scaleSize(13) }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 320,
    zIndex: 1000,
    elevation: 1000,
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sidebarLogoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sidebarLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sidebarHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sidebarIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  sidebarMenu: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 4,
  },
  sidebarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  sidebarMenuText: {
    fontSize: 16,
    fontWeight: '500',
  },
  sidebarHistorySection: {
    flex: 1,
    paddingTop: 4,
  },
  sidebarSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sidebarSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sidebarContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  historyItem: {
    marginBottom: 2,
    position: 'relative',
  },
  historyItemButton: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    position: 'relative',
  },
  historyItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyItemTextContainer: {
    flex: 1,
    marginLeft: 6,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
  historyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 6,
  },
  historyPreview: {
    fontSize: 12,
    flex: 1,
    minWidth: 0,
  },
  historyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  historyDate: {
    fontSize: 10,
    fontWeight: '500',
  },
  deleteHistoryBtn: {
    padding: 3,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyHistoryText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  deleteModalContentWrapper: {
    width: '100%',
    maxWidth: 280,
  },
  deleteModalContent: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  deleteModalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  deleteModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 16,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalButtonCancel: {
    borderWidth: 1,
  },
  deleteModalButtonConfirm: {
    backgroundColor: '#EF4444',
  },
  deleteModalButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default Sidebar;


