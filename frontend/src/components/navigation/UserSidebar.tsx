import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import AIService, { ChatHistoryItem } from '../../services/AIService';
import { getCurrentUser } from '../../services/authService';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
};

interface UserSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chatHistory?: ChatHistoryItem[];
  onChatSelect?: (chatId: string) => void;
  onNewConversation?: () => void;
  getUserToken?: () => Promise<string | null>;
  sessionId?: string;
  onDeleteChat?: (chatId: string) => void;
}

const UserSidebar: React.FC<UserSidebarProps> = ({
  isOpen,
  onClose,
  chatHistory = [],
  onChatSelect,
  onNewConversation,
  getUserToken,
  sessionId,
  onDeleteChat,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const sidebarAnim = useRef(new Animated.Value(-320)).current;

  // User state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);

  // Load user data
  useFocusEffect(
    useCallback(() => {
      const loadUserData = async () => {
        try {
          const user = getCurrentUser();
          setCurrentUser(user);
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const userPhoto = await AsyncStorage.getItem('userPhoto');
          setBackendUserPhoto(userPhoto);
        } catch (error) {
          console.error('Failed to load user data:', error);
        }
      };
      loadUserData();
    }, [])
  );

  const getUserInitials = () => {
    if (!currentUser?.displayName) return '?';
    const names = currentUser.displayName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return currentUser.displayName.substring(0, 2).toUpperCase();
  };

  // Animate sidebar when opening/closing
  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: isOpen ? 0 : -320,
      duration: 300,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isOpen, sidebarAnim]);

  const handleDeleteChat = async (chatId: string) => {
    if (onDeleteChat) {
      onDeleteChat(chatId);
      return;
    }

    // Fallback deletion logic
    try {
      let token = getUserToken ? await getUserToken() : null;
      if (!token) {
        const user = getCurrentUser();
        if (user && typeof user.getIdToken === 'function') {
          token = await user.getIdToken();
        }
      }
      if (!token) return;
      await AIService.deleteChatSession(chatId, token);
    } catch (e) {
      console.error('Failed to delete chat:', e);
    }
  };

  return (
    <>
      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: sidebarAnim }],
            backgroundColor: isDarkMode ? '#1F2937' : '#F5F2ED',
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Sidebar Header */}
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarLogoSection}>
            <View style={styles.sidebarLogo}>
              <Ionicons name="school" size={28} color="#FFFFFF" />
            </View>
            <Text style={[styles.sidebarTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>
              DOrSU AI
            </Text>
          </View>
          <View style={styles.sidebarHeaderButtons}>
            <TouchableOpacity
              style={styles.sidebarIconButton}
              onPress={() => {
                onClose();
                navigation.navigate('UserSettings');
              }}
              accessibilityLabel="User settings"
            >
              <Ionicons name="person-circle-outline" size={26} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sidebarIconButton}
              onPress={() => {
                if (onNewConversation) {
                  onNewConversation();
                }
                onClose();
              }}
              accessibilityLabel="New conversation"
            >
              <Ionicons name="create-outline" size={26} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={styles.sidebarIconButton}
              accessibilityLabel="Close sidebar"
            >
              <View style={styles.customHamburger} pointerEvents="none">
                <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
                <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
                <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Navigation Menu */}
        <View style={styles.sidebarMenu}>
          <TouchableOpacity
            style={[styles.sidebarMenuItem, { backgroundColor: isDarkMode ? 'rgba(255, 149, 0, 0.1)' : 'rgba(255, 149, 0, 0.08)' }]}
            onPress={() => {
              if (onNewConversation) {
                onNewConversation();
              }
              onClose();
              navigation.navigate('AIChat');
            }}
          >
            <Ionicons name="home" size={24} color="#FF9500" />
            <Text style={[styles.sidebarMenuText, { color: '#FF9500', fontWeight: '600' }]}>
              Conversation
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sidebarMenuItem}
            onPress={() => {
              onClose();
              navigation.navigate('SchoolUpdates');
            }}
          >
            <Ionicons name="compass-outline" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            <Text style={[styles.sidebarMenuText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
              Discover
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sidebarMenuItem}
            onPress={() => {
              onClose();
              navigation.navigate('Calendar');
            }}
          >
            <Ionicons name="copy-outline" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            <Text style={[styles.sidebarMenuText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
              Calendar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Chat History Section */}
        <View style={styles.sidebarHistorySection}>
          <Text style={[styles.sidebarSectionTitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Recent Chats
          </Text>
          <ScrollView style={styles.sidebarContent} showsVerticalScrollIndicator={false}>
            {chatHistory.length === 0 ? (
              <View style={styles.emptyHistoryContainer}>
                <Ionicons name="chatbubbles-outline" size={40} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.emptyHistoryText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                  No chat history yet
                </Text>
              </View>
            ) : (
              chatHistory.map((chat, idx) => (
                <View key={`${chat.id}:${idx}`} style={styles.historyItem}>
                  <TouchableOpacity
                    style={[
                      styles.historyItemButton,
                      { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' },
                    ]}
                    onPress={() => {
                      if (onChatSelect) {
                        onChatSelect(chat.id);
                      }
                      onClose();
                    }}
                  >
                    <Text style={[styles.historyTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]} numberOfLines={1}>
                      {chat.title}
                    </Text>
                    <Text style={[styles.historyPreview, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                      {chat.preview}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteHistoryBtn}
                    onPress={() => handleDeleteChat(chat.id)}
                    accessibilityLabel="Delete chat"
                  >
                    <Ionicons name="trash-outline" size={16} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Animated.View>

      {/* Overlay for sidebar */}
      {isOpen && (
        <TouchableOpacity style={styles.sidebarOverlay} onPress={onClose} activeOpacity={1} />
      )}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sidebarLogoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sidebarIconWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButton: {
    width: 48,
    height: 48,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  userInfoSection: {
    flex: 1,
  },
  userEmail: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  sidebarLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 40,
    height: 40,
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
    paddingTop: 8,
  },
  sidebarSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sidebarContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  historyItem: {
    marginBottom: 4,
    position: 'relative',
  },
  historyItemButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyPreview: {
    fontSize: 13,
  },
  deleteHistoryBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    padding: 6,
    borderRadius: 6,
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
});

export default UserSidebar;
