import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
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
 };

 type Navigation = NativeStackNavigationProp<RootStackParamList>;

interface BarProps {
  onHomePress?: () => void;
  onDiscoveryPress?: () => void;
  onCalendarPress?: () => void;
  activeTab?: 'home' | 'discovery' | 'calendar';
  isDarkMode?: boolean;
}

const Bar: React.FC<BarProps> = ({
  onHomePress,
  onDiscoveryPress,
  onCalendarPress,
  activeTab = 'home',
  isDarkMode = false,
}) => {
  const insets = useSafeAreaInsets();
  const { theme: t } = useThemeValues();
  
  return (
    <View style={[styles.container, { 
      paddingBottom: insets.bottom,
    }]} collapsable={false}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 50 : 40}
        tint={isDarkMode ? 'dark' : 'light'}
        style={styles.blurBackground}
      >
        <View style={[styles.navContent, {
          backgroundColor: 'transparent',
        }]}>
          <TouchableOpacity style={styles.tab} onPress={onHomePress}>
            <Ionicons 
              name={activeTab === 'home' ? 'home' : 'home-outline'} 
              size={28} 
              color={activeTab === 'home' ? '#FF9500' : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)')} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={onDiscoveryPress}>
            <Ionicons 
              name={activeTab === 'discovery' ? 'newspaper' : 'newspaper-outline'} 
              size={28} 
              color={activeTab === 'discovery' ? '#FF9500' : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)')} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={onCalendarPress}>
            <Ionicons 
              name={activeTab === 'calendar' ? 'copy' : 'copy-outline'} 
              size={28} 
              color={activeTab === 'calendar' ? '#FF9500' : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)')} 
            />
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
};

const MemoizedBar = React.memo(Bar);

const UserBottomNavBar = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute();
  const { isDarkMode } = useThemeValues();

  const routeName = route.name as keyof RootStackParamList;
  const activeTab: 'home' | 'discovery' | 'calendar' =
    routeName === 'AIChat' ? 'home'
    : routeName === 'SchoolUpdates' ? 'discovery'
    : 'calendar';

  const handleHomePress = React.useCallback(() => navigation.navigate('AIChat'), [navigation]);
  const handleDiscoveryPress = React.useCallback(() => navigation.navigate('SchoolUpdates'), [navigation]);
  const handleCalendarPress = React.useCallback(() => navigation.navigate('Calendar'), [navigation]);

  return (
    <MemoizedBar
      activeTab={activeTab}
      onHomePress={handleHomePress}
      onDiscoveryPress={handleDiscoveryPress}
      onCalendarPress={handleCalendarPress}
      isDarkMode={isDarkMode}
    />
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

export default UserBottomNavBar;
