import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { isDarkMode } = useTheme();

  return (
    <View style={[
      styles.container, 
      { 
        paddingBottom: insets.bottom,
      }
    ]} collapsable={false}>
      <View style={[styles.blurBackground, {
        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.85)',
      }]}>
        <View style={[styles.navContent, {
          backgroundColor: 'transparent',
        }]}>
          <TouchableOpacity style={styles.tab} onPress={onChatPress}>
            <Ionicons 
              name={activeTab === 'chat' ? 'home' : 'home-outline'} 
              size={28} 
              color={activeTab === 'chat' ? '#FF9500' : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)')} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={onDashboardPress}>
            <Ionicons 
              name={activeTab === 'dashboard' ? 'newspaper' : 'newspaper-outline'} 
              size={28} 
              color={activeTab === 'dashboard' ? '#FF9500' : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)')} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={onCalendarPress}>
            <Ionicons 
              name={activeTab === 'calendar' ? 'calendar' : 'calendar-outline'} 
              size={28} 
              color={activeTab === 'calendar' ? '#FF9500' : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)')} 
            />
          </TouchableOpacity>
        </View>
      </View>
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
    borderWidth: 0,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    backdropFilter: 'blur(10px)',
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
