import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Switch, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import LogoutModal from '../../modals/LogoutModal';
import ProfileSettingsModal from '../../modals/ProfileSettingsModal'; 

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
  AdminSettings: undefined;
  AdminCalendar: undefined;
  PostUpdate: undefined;
  ManagePosts: undefined;
  About: undefined;
  ContactSupport: undefined;
  HelpCenter: undefined;
};

const AdminSettings = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode, theme, toggleTheme } = useTheme();
  
  // State for various settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);

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
  }, []);

  const sheetY = useRef(new Animated.Value(300)).current;
  const profileSettingsSheetY = useRef(new Animated.Value(300)).current;

  const openLogout = () => {
    setIsLogoutOpen(true);
    // Wait for modal mount then animate
    setTimeout(() => {
      Animated.timing(sheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
  };

  const closeLogout = () => {
    Animated.timing(sheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setIsLogoutOpen(false);
    });
  };

  const confirmLogout = () => {
    closeLogout();
    navigation.navigate('GetStarted');
  };

  const openProfileSettings = () => {
    setIsProfileSettingsOpen(true);
    // Wait for modal mount then animate
    setTimeout(() => {
      Animated.timing(profileSettingsSheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
  };

  const closeProfileSettings = () => {
    Animated.timing(profileSettingsSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setIsProfileSettingsOpen(false);
    });
  };


  return (
    <View style={[styles.container, {
      backgroundColor: theme.colors.background,
      paddingTop: 0,
      paddingBottom: 0, // Remove bottom padding since AdminBottomNavBar now handles it
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <StatusBar
        backgroundColor={theme.colors.primary}
        barStyle={isDarkMode ? "light-content" : "light-content"}
        translucent={true}
      />
      {/* Safe area filler to match header color when translucent status bar is used */}
      <View style={{ height: insets.top, backgroundColor: theme.colors.primary }} />

      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: theme.colors.primary,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
      }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: '#fff' }]}>Settings</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={openLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Profile Section */}
        <Animated.View 
          style={[
            styles.profileSection,
            {
              backgroundColor: theme.colors.card,
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <View style={[styles.profileAvatar, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Ionicons name="person" size={32} color={theme.colors.textMuted} />
          </View>
          <Text style={[styles.profileName, { color: theme.colors.text }]}>Admin User</Text>
          <Text style={[styles.profileEmail, { color: theme.colors.textMuted }]}>admin@dorsu.edu.ph</Text>
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
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account</Text>
            
            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={openProfileSettings}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.chipBg }]}>
                  <Ionicons name="person-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Profile Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.chipBg }]}>
                  <Ionicons name="key-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* App Settings */}
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>App Settings</Text>
            
            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.chipBg }]}>
                  <Ionicons name="moon-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Dark Mode</Text>
              </View>
              <Switch 
                value={isDarkMode} 
                onValueChange={toggleTheme} 
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }} 
                thumbColor={theme.colors.surface} 
              />
            </View>

            <View style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.chipBg }]}>
                  <Ionicons name="notifications-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor={notificationsEnabled ? theme.colors.surface : theme.colors.surface}
              />
            </View>
          </View>


          {/* Support */}
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Support</Text>
            
            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={() => navigation.navigate('HelpCenter')}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.chipBg }]}>
                  <Ionicons name="help-circle-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Help Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={() => navigation.navigate('ContactSupport')}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.chipBg }]}>
                  <Ionicons name="mail-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Contact Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItemLast} onPress={() => navigation.navigate('About')}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.chipBg }]}>
                  <Ionicons name="information-circle-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>About</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      <AdminBottomNavBar
        activeTab="settings"
        onDashboardPress={() => navigation.navigate('AdminDashboard')}
        onChatPress={() => navigation.navigate('AdminAIChat')}
        onAddPress={() => { /* future: open create flow */ }}
        onCalendarPress={() => navigation.navigate('AdminCalendar')}
        onSettingsPress={() => navigation.navigate('AdminSettings')}
        onPostUpdatePress={() => navigation.navigate('PostUpdate')}
        onManagePostPress={() => navigation.navigate('ManagePosts')}
      />

      <LogoutModal
        visible={isLogoutOpen}
        onClose={closeLogout}
        onConfirm={confirmLogout}
        sheetY={sheetY}
      />

      <ProfileSettingsModal
        visible={isProfileSettingsOpen}
        onClose={closeProfileSettings}
        sheetY={profileSettingsSheetY}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
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
    marginBottom: 6,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 4,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 32,
  },
  profileSection: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
  },
  settingsContainer: {
    gap: 12,
  },
  sectionCard: {
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingItemLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
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
  },
});

export default AdminSettings;
