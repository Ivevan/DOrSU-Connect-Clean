import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import { BlurView } from 'expo-blur';

interface AdminBottomNavBarProps {
  onDashboardPress?: () => void;
  onChatPress?: () => void;
  onCalendarPress?: () => void;
  activeTab?: 'dashboard' | 'chat' | 'calendar';
}

const AdminBottomNavBar: React.FC<AdminBottomNavBarProps> = ({
  onDashboardPress,
  onChatPress,
  onCalendarPress,
  activeTab = 'chat',
}) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useThemeValues();

  return (
    <View style={[
      styles.container, 
      { 
        paddingBottom: insets.bottom,
      }
    ]} collapsable={false}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 50 : 40}
        tint={isDarkMode ? 'dark' : 'light'}
        style={styles.blurBackground}
      >
        <View style={[styles.navContent, {
          backgroundColor: 'transparent',
        }]}>
          <TouchableOpacity style={styles.tab} onPress={onChatPress}>
            <Ionicons 
              name={activeTab === 'chat' ? 'home' : 'home-outline'} 
              size={28} 
              color={activeTab === 'chat' ? t.colors.accent : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)')} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={onDashboardPress}>
            <Ionicons 
              name={activeTab === 'dashboard' ? 'newspaper' : 'newspaper-outline'} 
              size={28} 
              color={activeTab === 'dashboard' ? t.colors.accent : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)')} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={onCalendarPress}>
            <Ionicons 
              name={activeTab === 'calendar' ? 'calendar' : 'calendar-outline'} 
              size={28} 
              color={activeTab === 'calendar' ? t.colors.accent : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)')} 
            />
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  blurBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 0,
    borderBottomWidth: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 40,
  },
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    overflow: 'hidden',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 52,
  },
});

export default AdminBottomNavBar;
