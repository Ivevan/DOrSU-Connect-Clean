import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Switch, Alert, Animated, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/AdminBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext'; 

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
};

const AdminSettings = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode, theme, toggleTheme } = useTheme();
  
  // State for various settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

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
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: '#fff' }]}>Settings</Text>
            <Text style={[styles.headerSubtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>DOrSU Connect</Text>
          </View>
        </View>
        <TouchableOpacity onPress={openLogout} style={[styles.logoutButton, { 
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          borderRadius: 8,
        }]}>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Text style={[styles.logoutText, { color: '#FFFFFF' }]}>Logout</Text>
        </TouchableOpacity>
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
            
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
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

            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
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

            <View style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.chipBg }]}>
                  <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Auto Backup</Text>
              </View>
              <Switch
                value={autoBackupEnabled}
                onValueChange={setAutoBackupEnabled}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor={autoBackupEnabled ? theme.colors.surface : theme.colors.surface}
              />
            </View>
          </View>


          {/* Support */}
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Support</Text>
            
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.chipBg }]}>
                  <Ionicons name="help-circle-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Help Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.colors.chipBg }]}>
                  <Ionicons name="mail-outline" size={20} color={theme.colors.accent} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Contact Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItemLast}>
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

      <Modal visible={isLogoutOpen} transparent animationType="none" onRequestClose={closeLogout}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={closeLogout} />
          <Animated.View style={[styles.sheet, { 
            backgroundColor: theme.colors.card,
            transform: [{ translateY: sheetY }] 
          }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.sheetIconCircle, { backgroundColor: theme.colors.chipBg }]}>
                <Ionicons name="log-out-outline" size={20} color={theme.colors.accent} />
              </View>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Logout</Text>
            </View>
            <Text style={[styles.sheetMessage, { color: theme.colors.textMuted }]}>Are you sure you want to logout of DOrSU Connect?</Text>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary, { 
                backgroundColor: theme.colors.surface, 
                borderColor: theme.colors.border 
              }]} onPress={closeLogout}>
                <Text style={[styles.actionSecondaryText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary, { backgroundColor: theme.colors.accent }]} onPress={confirmLogout}>
                <Text style={[styles.actionPrimaryText, { color: theme.colors.surface }]}>Logout</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: insets.bottom }} />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 8,
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
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  overlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sheetIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sheetMessage: {
    fontSize: 13,
    marginBottom: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionSecondary: {
    borderWidth: 1,
  },
  actionSecondaryText: {
    fontWeight: '700',
    fontSize: 13,
  },
  actionPrimary: {
    // backgroundColor will be set dynamically
  },
  actionPrimaryText: {
    fontWeight: '700',
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 120,
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
