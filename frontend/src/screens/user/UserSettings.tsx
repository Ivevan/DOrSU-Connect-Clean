import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform, TouchableOpacity, ScrollView, Switch, Alert, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
  UserHelpCenter: undefined;
  TermsOfUse: undefined;
  PrivacyPolicy: undefined;
  Licenses: undefined;
};

const UserSettings = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t, toggleTheme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scrollRef = useRef<ScrollView>(null);
  
  // State for various settings
  const [language, setLanguage] = useState('English');
  
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
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerSpacer} />
        </View>
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
          <View style={styles.profileAvatarContainer}>
            <View style={[styles.profileAvatar, { backgroundColor: t.colors.primary + '20' }]}>
              {userPhoto ? (
                <Image 
                  source={{ uri: userPhoto }} 
                  style={styles.profileAvatarImage}
                />
              ) : (
                <View style={styles.profileAvatarPlaceholder}>
                  <Ionicons name="person" size={40} color={t.colors.primary} />
                </View>
              )}
            </View>
            <View style={[styles.profileBadge, { backgroundColor: '#10B981' }]}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: t.colors.text }]}>{userName}</Text>
            <View style={styles.profileEmailContainer}>
              <Ionicons name="mail-outline" size={14} color={t.colors.textMuted} />
              <Text style={[styles.profileEmail, { color: t.colors.textMuted }]}>{userEmail}</Text>
            </View>
          </View>
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
          {/* General Section */}
          <View style={[styles.sectionCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>General</Text>
            
            <View style={[styles.settingItem, { borderBottomColor: t.colors.border }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="moon-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Dark Mode</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  toggleTheme();
                }}
                trackColor={{ false: t.colors.border, true: t.colors.accent }}
                thumbColor={t.colors.surface}
              />
            </View>

            <TouchableOpacity style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="language-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Language</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: t.colors.textMuted }]}>{language}</Text>
                <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Email Section */}
          <View style={[styles.sectionCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Email</Text>
            
            <TouchableOpacity style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="mail-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>{userEmail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* About Section */}
          <View style={[styles.sectionCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>About</Text>
            
            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: t.colors.border }]}
              onPress={() => navigation.navigate('UserHelpCenter')}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="help-circle-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Help Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: t.colors.border }]}
              onPress={() => navigation.navigate('TermsOfUse')}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="document-text-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Terms of Use</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: t.colors.border }]}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: t.colors.border }]}
              onPress={() => navigation.navigate('Licenses')}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="document-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Licenses</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="information-circle-outline" size={20} color={t.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>DOrSU Connect</Text>
              </View>
              <Text style={[styles.settingValue, { color: t.colors.textMuted }]}>v1.0.0</Text>
            </View>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity 
            style={[
              styles.signOutButton, 
              { 
                backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
              }
            ]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={[styles.signOutText, { color: '#EF4444' }]}>Sign out</Text>
          </TouchableOpacity>
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
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  headerSpacer: {
    width: 40,
    height: 33,
    marginLeft: 4,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing(1.5),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(2),
    gap: theme.spacing(2),
  },
  profileAvatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: theme.colors.primary + '30',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  profileBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing(0.5),
    letterSpacing: 0.2,
  },
  profileEmailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileEmail: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '400',
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
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '400',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing(2.5),
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.md,
    marginTop: theme.spacing(2),
    marginBottom: 0,
    gap: theme.spacing(1.5),
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default UserSettings; 