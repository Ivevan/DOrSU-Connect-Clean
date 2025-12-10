import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import { BlurView } from 'expo-blur';

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
  AdminCalendar?: undefined;
  AdminSettings?: undefined;
  PostUpdate?: undefined;
  ManagePosts?: undefined;
};

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export type TabType = 'admin' | 'user';

export type AdminTab = 'dashboard' | 'chat' | 'calendar';
export type UserTab = 'home' | 'discovery' | 'calendar';

interface BottomNavBarProps {
  // Tab type determines which tab naming scheme to use
  tabType?: TabType;
  
  // Controlled mode: provide callbacks and activeTab
  onFirstPress?: () => void;
  onSecondPress?: () => void;
  onThirdPress?: () => void;
  activeTab?: AdminTab | UserTab;
  
  // Uncontrolled mode: auto-detect from route (only works for user tabs)
  autoDetect?: boolean;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({
  tabType = 'user',
  onFirstPress,
  onSecondPress,
  onThirdPress,
  activeTab,
  autoDetect = false,
}) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useThemeValues();
  const navigation = useNavigation<Navigation>();
  const route = useRoute();

  // Auto-detect active tab from route (for user mode only)
  let detectedActiveTab: AdminTab | UserTab | undefined;
  if (autoDetect && tabType === 'user') {
    const routeName = route.name as keyof RootStackParamList;
    detectedActiveTab =
      routeName === 'AIChat' ? 'home'
      : routeName === 'SchoolUpdates' ? 'discovery'
      : 'calendar';
  }

  // Use provided activeTab or detected one
  const currentActiveTab = activeTab || detectedActiveTab;

  // Determine handlers: use provided callbacks or auto-navigation
  let handleFirstPress: () => void;
  let handleSecondPress: () => void;
  let handleThirdPress: () => void;

  if (onFirstPress && onSecondPress && onThirdPress) {
    // Controlled mode
    handleFirstPress = onFirstPress;
    handleSecondPress = onSecondPress;
    handleThirdPress = onThirdPress;
  } else if (autoDetect && tabType === 'user') {
    // Uncontrolled mode for user
    handleFirstPress = () => navigation.navigate('AIChat');
    handleSecondPress = () => navigation.navigate('SchoolUpdates');
    handleThirdPress = () => navigation.navigate('Calendar');
  } else {
    // Fallback: no-op handlers
    handleFirstPress = () => {};
    handleSecondPress = () => {};
    handleThirdPress = () => {};
  }

  // Determine icon and label based on tab type
  const getFirstTabConfig = () => {
    if (tabType === 'admin') {
      return {
        icon: currentActiveTab === 'chat' ? 'home' : 'home-outline',
        isActive: currentActiveTab === 'chat',
      };
    } else {
      return {
        icon: currentActiveTab === 'home' ? 'home' : 'home-outline',
        isActive: currentActiveTab === 'home',
      };
    }
  };

  const getSecondTabConfig = () => {
    if (tabType === 'admin') {
      return {
        icon: currentActiveTab === 'dashboard' ? 'newspaper' : 'newspaper-outline',
        isActive: currentActiveTab === 'dashboard',
      };
    } else {
      return {
        icon: currentActiveTab === 'discovery' ? 'newspaper' : 'newspaper-outline',
        isActive: currentActiveTab === 'discovery',
      };
    }
  };

  const getThirdTabConfig = () => {
    return {
      icon: currentActiveTab === 'calendar' ? 'calendar' : 'calendar-outline',
      isActive: currentActiveTab === 'calendar',
    };
  };

  const firstTab = getFirstTabConfig();
  const secondTab = getSecondTabConfig();
  const thirdTab = getThirdTabConfig();

  const getIconColor = (isActive: boolean) => {
    return isActive
      ? t.colors.accent
      : isDarkMode
      ? 'rgba(255, 255, 255, 0.6)'
      : 'rgba(0, 0, 0, 0.5)';
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
        },
      ]}
      collapsable={false}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 50 : 40}
        tint={isDarkMode ? 'dark' : 'light'}
        style={styles.blurBackground}
      >
        <View
          style={[
            styles.navContent,
            {
              backgroundColor: 'transparent',
            },
          ]}
        >
          <TouchableOpacity style={styles.tab} onPress={handleFirstPress}>
            <Ionicons
              name={firstTab.icon as any}
              size={28}
              color={getIconColor(firstTab.isActive)}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={handleSecondPress}>
            <Ionicons
              name={secondTab.icon as any}
              size={28}
              color={getIconColor(secondTab.isActive)}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={handleThirdPress}>
            <Ionicons
              name={thirdTab.icon as any}
              size={28}
              color={getIconColor(thirdTab.isActive)}
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
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 52,
  },
});

export default BottomNavBar;

