import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { BlurView } from 'expo-blur';

interface AdminBottomNavBarProps {
  onDashboardPress?: () => void;
  onChatPress?: () => void;
  onSettingsPress?: () => void;
  activeTab?: 'dashboard' | 'chat' | 'settings';
}

const AdminBottomNavBar: React.FC<AdminBottomNavBarProps> = ({
  onDashboardPress,
  onChatPress,
  onSettingsPress,
  activeTab = 'dashboard',
}) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();

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
          backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)',
        }]}>
          <TouchableOpacity style={styles.tab} onPress={onDashboardPress}>
            <Ionicons 
              name={activeTab === 'dashboard' ? 'home' : 'home-outline'} 
              size={28} 
              color={activeTab === 'dashboard' ? (isDarkMode ? '#FFFFFF' : '#1F2937') : (isDarkMode ? '#9CA3AF' : '#6B7280')} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={onChatPress}>
            <Ionicons 
              name={activeTab === 'chat' ? 'compass' : 'compass-outline'} 
              size={28} 
              color={activeTab === 'chat' ? (isDarkMode ? '#FFFFFF' : '#1F2937') : (isDarkMode ? '#9CA3AF' : '#6B7280')} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={onSettingsPress}>
            <Ionicons 
              name={activeTab === 'settings' ? 'copy' : 'copy-outline'} 
              size={28} 
              color={activeTab === 'settings' ? (isDarkMode ? '#FFFFFF' : '#1F2937') : (isDarkMode ? '#9CA3AF' : '#6B7280')} 
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
  },
  blurBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
