import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { theme } from '../../config/theme';
import { useThemeValues, useThemeActions } from '../../contexts/ThemeContext';
import NotificationService from '../../services/NotificationService';
import ThemeColorModal from '../../modals/ThemeColorModal';

type RootStackParamList = {
  AdminSettings: undefined;
  AdminGeneralSettings: undefined;
};

const AdminGeneralSettings = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useThemeValues();
  const { toggleTheme } = useThemeActions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // State for settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // Load notification preference on mount
  useEffect(() => {
    const loadNotificationPreference = async () => {
      const enabled = await NotificationService.areNotificationsEnabled();
      setNotificationsEnabled(enabled);
    };
    loadNotificationPreference();
  }, []);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isThemeColorModalVisible, setIsThemeColorModalVisible] = useState(false);

  // Animated floating background orb
  const floatAnim1 = useRef(new Animated.Value(0)).current;

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
          isDarkMode ? '#0B1220' : '#FBF8F3',
          isDarkMode ? '#111827' : '#F8F5F0',
          isDarkMode ? '#1F2937' : '#F5F2ED'
        ]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint="default"
        style={styles.backgroundGradient}
      />

      {/* Animated Floating Background Orb */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        {/* Large Orb */}
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

      {/* Header */}
      <View
        style={[styles.header, {
          backgroundColor: 'transparent',
          top: insets.top,
          marginLeft: insets.left,
          marginRight: insets.right,
        }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={28} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>General</Text>
      </View>

      <ScrollView
        style={[styles.scrollView, {
          marginTop: insets.top + 64,
        }]}
        contentContainerStyle={[styles.scrollContent, {
          paddingBottom: insets.bottom + 20,
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* General Settings */}
        <View style={styles.settingsContainer}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.sectionCard, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}
          >
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsThemeColorModalVisible(true);
              }}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="color-palette-outline" size={20} color="#FF9500" />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Theme Color</Text>
              </View>
              <View style={styles.settingRight}>
                <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={styles.settingItemLast}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                  <Ionicons name="moon-outline" size={20} color="#FF9500" />
                </View>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Dark Mode</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  toggleTheme();
                }}
                trackColor={{ false: t.colors.border, true: '#FF9500' }}
                thumbColor={t.colors.surface}
                ios_backgroundColor={t.colors.border}
              />
            </View>
          </BlurView>
        </View>
      </ScrollView>

      {/* Theme Color Modal */}
      <ThemeColorModal
        visible={isThemeColorModalVisible}
        onClose={() => setIsThemeColorModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
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
    width: 500,
    height: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingOrb1: {
    width: 500,
    height: 500,
    borderRadius: 250,
    opacity: 0.5,
    overflow: 'hidden',
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginLeft: 8,
  },
  scrollView: {
    paddingHorizontal: theme.spacing(1.5),
    paddingTop: theme.spacing(2),
  },
  scrollContent: {
    paddingHorizontal: theme.spacing(1.5),
    paddingBottom: 20,
  },
  settingsContainer: {
    gap: theme.spacing(1.5),
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(1.5),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

export default AdminGeneralSettings;
