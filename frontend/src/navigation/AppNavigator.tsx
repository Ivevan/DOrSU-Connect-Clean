import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

import UserHelpCenterScreen from '../screens/about/HelpCenterScreen';
import LicensesScreen from '../screens/about/LicensesScreen';
import PrivacyPolicyScreen from '../screens/about/PrivacyPolicyScreen';
import TermsOfUseScreen from '../screens/about/TermsOfUseScreen';
import AdminAIChat from '../screens/admin/AdminAIChat';
import AdminCalendar from '../screens/admin/AdminCalendar';
import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminSettings from '../screens/admin/AdminSettings';
import AdminAccountSettings from '../screens/admin/AdminAccountSettings';
import AdminGeneralSettings from '../screens/admin/AdminGeneralSettings';
import AdminEmailSettings from '../screens/admin/AdminEmailSettings';
import AdminAbout from '../screens/admin/AdminAbout';
import ManagePosts from '../screens/admin/ManagePosts';
import PostUpdate from '../screens/admin/PostUpdate';
import CreateAccount from '../screens/auth/CreateAccount';
import GetStarted from '../screens/auth/GetStarted';
import SignIn from '../screens/auth/SignIn';
import SplashScreen from '../screens/auth/SplashScreen';
import AIChat from '../screens/user/AIChat';
import Calendar from '../screens/user/Calendar';
import SchoolUpdates from '../screens/user/SchoolUpdates';
import UserSettings from '../screens/user/UserSettings';
import AccountSettings from '../screens/user/AccountSettings';
import GeneralSettings from '../screens/user/GeneralSettings';
import EmailSettings from '../screens/user/EmailSettings';
import About from '../screens/user/About';

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
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<string>('SplashScreen');
  
  // Check authentication status on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Check for backend auth token
        const userToken = await AsyncStorage.getItem('userToken');
        const userEmail = await AsyncStorage.getItem('userEmail');
        const authProvider = await AsyncStorage.getItem('authProvider');
        
        // If user has valid session, skip to main app (AIChat instead of SchoolUpdates)
        if ((userToken && userEmail) || (userEmail && authProvider === 'google')) {
          setInitialRoute('AIChat');
        } else {
          // Check for Firebase auth (if user logged in with Google)
          try {
            const { getCurrentUser } = require('../services/authService');
            const currentUser = getCurrentUser();
            if (currentUser?.email) {
              setInitialRoute('AIChat');
            } else {
              setInitialRoute('SplashScreen');
            }
          } catch {
            setInitialRoute('SplashScreen');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setInitialRoute('SplashScreen');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);
  
  // Show loading indicator while checking auth status
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1F2937' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }
  
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={initialRoute}
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
            freezeOnBlur: false, // Changed to false to prevent delay
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
            // Optimize for faster navigation
            freezeOnBlur: false,
          }}
        />
        <Stack.Screen 
          name="AccountSettings" 
          component={AccountSettings}
          options={{
            headerShown: false,
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="GeneralSettings" 
          component={GeneralSettings}
          options={{
            headerShown: false,
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="EmailSettings" 
          component={EmailSettings}
          options={{
            headerShown: false,
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="About" 
          component={About}
          options={{
            headerShown: false,
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="AdminDashboard" 
          component={AdminDashboard}
          options={{
            animation: 'none' as const, // Disabled for debugging
            animationDuration: 0,
            freezeOnBlur: false,
            contentStyle: {
              backgroundColor: 'transparent',
            },
          }}
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
          name="AdminAccountSettings" 
          component={AdminAccountSettings}
          options={{
            headerShown: false,
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="AdminGeneralSettings" 
          component={AdminGeneralSettings}
          options={{
            headerShown: false,
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="AdminEmailSettings" 
          component={AdminEmailSettings}
          options={{
            headerShown: false,
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="AdminAbout" 
          component={AdminAbout}
          options={{
            headerShown: false,
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="AdminCalendar" 
          component={AdminCalendar}
        />
        <Stack.Screen 
          name="PostUpdate" 
          component={PostUpdate}
          options={{
            animation: 'none' as const, // Disabled for debugging
            animationDuration: 0,
            freezeOnBlur: false,
            contentStyle: {
              backgroundColor: 'transparent',
            },
          }}
        />
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