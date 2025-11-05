import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform, TouchableOpacity, ScrollView, Switch, Alert, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../config/theme';
import { useTheme } from '../../contexts/ThemeContext';
import LogoutModal from '../../modals/LogoutModal';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
};

const UserSettings = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t, toggleTheme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scrollRef = useRef<ScrollView>(null);
  
  // State for various settings
  // Dark mode now controlled globally via ThemeContext
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  
  // User state from Firebase Auth
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Get user display name and email
  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const userEmail = currentUser?.email || 'No email';
  const userPhoto = currentUser?.photoURL || null;

  // Animation values for smooth entrance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Unique entrance animation for Settings - Slide from bottom with scale
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
    
    // Get current user
    const user = getCurrentUser();
    setCurrentUser(user);
    
    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Function to handle logout
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const sheetY = useRef(new Animated.Value(300)).current;

  const openLogout = () => {
    setIsLogoutOpen(true);
    setTimeout(() => {
      Animated.timing(sheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
  };

  const closeLogout = () => {
    Animated.timing(sheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setIsLogoutOpen(false);
    });
  };

  const handleLogout = () => openLogout();

  const confirmLogout = () => {
    closeLogout();
    navigation.navigate('GetStarted');
  };
  
  return (
    <View style={[styles.container, {
      backgroundColor: t.colors.background,
      paddingTop: insets.top,
      paddingBottom: 0, // Remove bottom padding since UserBottomNavBar now handles it
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
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>DOrSU Connect</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={[
          styles.logoutButton,
          {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: 8
          }
        ]}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={[styles.logoutText, { color: '#EF4444' }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Profile Section */}
        <Animated.View 
          style={[
            styles.profileSection,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ],
              backgroundColor: t.colors.card
            }
          ]}
        >
          <View style={styles.profileAvatar}>
            {userPhoto ? (
              <Image 
                source={{ uri: userPhoto }} 
                style={styles.profileAvatarImage}
              />
            ) : (
              <Ionicons name="person" size={32} color={t.colors.textMuted} />
            )}
          </View>
          <Text style={[styles.profileName, { color: t.colors.text }]}>{userName}</Text>
          <Text style={[styles.profileEmail, { color: t.colors.textMuted }]}>{userEmail}</Text>
        </Animated.View>

        {/* Settings Categories */}
        <Animated.View 
          style={[
            styles.settingsContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          {/* Account Settings */}
          <View style={[styles.sectionCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Account</Text>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="person-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Profile Information</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="key-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* App Settings */}
          <View style={[styles.sectionCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>App Settings</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="moon-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Dark Mode</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: t.colors.border, true: t.colors.accent }}
                thumbColor={t.colors.surface}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="notifications-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: t.colors.border, true: t.colors.accent }}
                thumbColor={t.colors.surface}
              />
            </View>

            <View style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="cloud-upload-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Auto Backup</Text>
              </View>
              <Switch
                value={autoBackupEnabled}
                onValueChange={setAutoBackupEnabled}
                trackColor={{ false: t.colors.border, true: t.colors.accent }}
                thumbColor={t.colors.surface}
              />
            </View>
          </View>

          {/* Appearance */}
          <View style={[styles.sectionCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Appearance</Text>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="color-palette-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Theme</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="text-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Font Size</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Support */}
          <View style={[styles.sectionCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Support</Text>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="help-circle-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Help Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="mail-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Contact Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="information-circle-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>About</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      <UserBottomNavBar />

      <LogoutModal
        visible={isLogoutOpen}
        onClose={closeLogout}
        onConfirm={confirmLogout}
        sheetY={sheetY}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing(2),
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: theme.colors.surface,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    gap: theme.spacing(1),
  },
  logoutText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing(1.5),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(15),
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    ...theme.shadow1,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  settingsContainer: {
    gap: theme.spacing(1.5),
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing(1.5),
    ...theme.shadow1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing(1.5),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(1.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingItemLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(1.5),
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing(1.5),
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
});

export default UserSettings; 