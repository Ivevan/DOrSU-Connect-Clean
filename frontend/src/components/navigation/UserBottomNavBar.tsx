import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';

// Keep in sync with app navigator
 type RootStackParamList = {
   GetStarted: undefined;
   SignIn: undefined;
   CreateAccount: undefined;
   SchoolUpdates: undefined;
   AIChat: undefined;
   UserSettings: undefined;
   Calendar: undefined;
   AdminDashboard?: undefined;
   AdminAIChat?: undefined;
 };

 type Navigation = NativeStackNavigationProp<RootStackParamList>;

interface BarProps {
  onHomePress?: () => void;
  onChatPress?: () => void;
  onCalendarPress?: () => void;
  onSettingsPress?: () => void;
  activeTab?: 'home' | 'chat' | 'calendar' | 'settings';
  isDarkMode?: boolean;
}

const Bar: React.FC<BarProps> = ({
  onHomePress,
  onChatPress,
  onCalendarPress,
  onSettingsPress,
  activeTab = 'home',
  isDarkMode = false,
}) => {
  const insets = useSafeAreaInsets();
  const { theme: t } = useThemeValues();
  
  return (
    <View style={[styles.container, { 
      backgroundColor: t.colors.tabBar,
      borderTopColor: t.colors.tabBarBorder,
      paddingBottom: 0 // Padding handled by parent container
    }]} collapsable={false}>
      <View style={[styles.backgroundLayer, { 
        backgroundColor: t.colors.tabBar,
      }]} pointerEvents="none" />
      
      <TouchableOpacity style={styles.tab} onPress={onHomePress}>
        <Ionicons name="home-outline" size={24} color={activeTab === 'home' ? t.colors.iconActive : t.colors.icon} />
        <Text style={[styles.label, { color: t.colors.textMuted }, activeTab === 'home' && { color: t.colors.iconActive, fontWeight: '600' }]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={onChatPress}>
        <Ionicons name="chatbubbles-outline" size={24} color={activeTab === 'chat' ? t.colors.iconActive : t.colors.icon} />
        <Text style={[styles.label, { color: t.colors.textMuted }, activeTab === 'chat' && { color: t.colors.iconActive, fontWeight: '600' }]}>AI Chat</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={onCalendarPress}>
        <Ionicons name="calendar-outline" size={24} color={activeTab === 'calendar' ? t.colors.iconActive : t.colors.icon} />
        <Text style={[styles.label, { color: t.colors.textMuted }, activeTab === 'calendar' && { color: t.colors.iconActive, fontWeight: '600' }]}>Calendar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={onSettingsPress}>
        <Ionicons name="settings-outline" size={24} color={activeTab === 'settings' ? t.colors.iconActive : t.colors.icon} />
        <Text style={[styles.label, { color: t.colors.textMuted }, activeTab === 'settings' && { color: t.colors.iconActive, fontWeight: '600' }]}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
};

const MemoizedBar = React.memo(Bar);

const UserBottomNavBar = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute();
  // Revert: no theme toggling

  const routeName = route.name as keyof RootStackParamList;
  const activeTab: 'home' | 'chat' | 'calendar' | 'settings' =
    routeName === 'SchoolUpdates' ? 'home'
    : routeName === 'AIChat' ? 'chat'
    : routeName === 'Calendar' ? 'calendar'
    : routeName === 'UserSettings' ? 'settings'
    : 'home';

  // Memoize navigation handlers to prevent re-renders
  const handleHomePress = React.useCallback(() => navigation.navigate('SchoolUpdates'), [navigation]);
  const handleChatPress = React.useCallback(() => navigation.navigate('AIChat'), [navigation]);
  const handleCalendarPress = React.useCallback(() => navigation.navigate('Calendar'), [navigation]);
  const handleSettingsPress = React.useCallback(() => navigation.navigate('UserSettings'), [navigation]);

  return (
    <MemoizedBar
      activeTab={activeTab}
      onHomePress={handleHomePress}
      onChatPress={handleChatPress}
      onCalendarPress={handleCalendarPress}
      onSettingsPress={handleSettingsPress}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    position: 'relative',
  },
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default UserBottomNavBar;
