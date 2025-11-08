import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';

import SplashScreen from '../screens/auth/SplashScreen';
import GetStarted from '../screens/auth/GetStarted';
import SignIn from '../screens/auth/SignIn';
import CreateAccount from '../screens/auth/CreateAccount';
import SchoolUpdates from '../screens/user/SchoolUpdates';
import AIChat from '../screens/user/AIChat';
import UserSettings from '../screens/user/UserSettings';
import Calendar from '../screens/user/Calendar';
import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminAIChat from '../screens/admin/AdminAIChat';
import AdminSettings from '../screens/admin/AdminSettings';
import AdminCalendar from '../screens/admin/AdminCalendar';
import PostUpdate from '../screens/admin/PostUpdate';
import ManagePosts from '../screens/admin/ManagePosts';
import UserHelpCenterScreen from '../screens/about/HelpCenterScreen';
import TermsOfUseScreen from '../screens/about/TermsOfUseScreen';
import PrivacyPolicyScreen from '../screens/about/PrivacyPolicyScreen';
import LicensesScreen from '../screens/about/LicensesScreen';

const Stack = createNativeStackNavigator();

// Optimized animation config for better performance; theme-aware nav bar
const useScreenOptions = () => {
  const { theme } = useTheme();
  return React.useMemo(() => ({
    headerShown: false,
    animation: 'fade' as const,
    animationDuration: 200,
    gestureEnabled: false,
    presentation: 'card' as const,
    contentStyle: {
      backgroundColor: 'transparent',
    },
    detachInactiveScreens: true,
    freezeOnBlur: false,
    // Remove runtime nav bar color to avoid live switching; rely on OS/app.json on minimize/resume
  }), [theme]);
};

const AppNavigator = () => {
  const screenOptions = useScreenOptions();
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="SplashScreen"
        screenOptions={screenOptions}
      >
        <Stack.Screen 
          name="SplashScreen" 
          component={SplashScreen}
        />
        <Stack.Screen 
          name="GetStarted" 
          component={GetStarted}
        />
        <Stack.Screen 
          name="SignIn" 
          component={SignIn}
        />
        <Stack.Screen 
          name="CreateAccount" 
          component={CreateAccount}
        />
        <Stack.Screen 
          name="SchoolUpdates" 
          component={SchoolUpdates}
          options={{
            animation: 'none' as const, // Disabled for debugging
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="AIChat" 
          component={AIChat}
          options={{
            animation: 'none' as const, // Disabled for debugging
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="UserSettings" 
          component={UserSettings}
          options={{
            animation: 'none' as const, // Disabled for debugging
            animationDuration: 0,
            // Prevent layout shifts during navigation
            freezeOnBlur: true,
            // Ensure consistent layout
            contentStyle: {
              backgroundColor: 'transparent',
            },
          }}
        />
        <Stack.Screen 
          name="Calendar" 
          component={Calendar}
          options={{
            animation: 'none' as const, // Disabled for debugging
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="AdminDashboard" 
          component={AdminDashboard}
        />
        <Stack.Screen 
          name="AdminAIChat" 
          component={AdminAIChat}
        />
        <Stack.Screen 
          name="AdminSettings" 
          component={AdminSettings}
        />
        <Stack.Screen 
          name="AdminCalendar" 
          component={AdminCalendar}
        />
        <Stack.Screen name="PostUpdate" component={PostUpdate} />
        <Stack.Screen name="ManagePosts" component={ManagePosts} />
        <Stack.Screen name="UserHelpCenter" component={UserHelpCenterScreen} />
        <Stack.Screen name="TermsOfUse" component={TermsOfUseScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="Licenses" component={LicensesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 