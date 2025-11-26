import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

import UserHelpCenterScreen from '../screens/about/HelpCenterScreen';
import LicensesScreen from '../screens/about/LicensesScreen';
import PrivacyPolicyScreen from '../screens/about/PrivacyPolicyScreen';
import TermsOfUseScreen from '../screens/about/TermsOfUseScreen';
import AdminAIChat from '../screens/admin/AdminAIChat';
import AdminCalendar from '../screens/admin/AdminCalendar';
import CalendarHelpScreen from '../screens/admin/CalendarHelpScreen';
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
  const navigationRef = useNavigationContainerRef();
  const { resetInactivityTimer } = useAuth();
  
  // Handle deep links for email verification
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        console.log('🔗 Deep link received:', url);
        
        // Extract oobCode or actionCode from URL
        const urlObj = new URL(url);
        const oobCode = urlObj.searchParams.get('oobCode') || urlObj.searchParams.get('actionCode');
        const mode = urlObj.searchParams.get('mode');
        
        // Check if this is an email verification link
        const isVerificationLink = url.includes('verify-email') || 
                                   url.includes('action=verifyEmail') || 
                                   mode === 'verifyEmail' ||
                                   !!oobCode;
        
        if (isVerificationLink && oobCode) {
          console.log('✅ Email verification link detected with code');
          
          // Navigate to CreateAccount screen to handle verification
          if (navigationRef.isReady()) {
            navigationRef.navigate('CreateAccount' as never);
          }
          
          // Wait a moment for navigation to complete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check for pending account
          const pendingEmail = await AsyncStorage.getItem('pendingEmail');
          const pendingUsername = await AsyncStorage.getItem('pendingUsername');
          const pendingPassword = await AsyncStorage.getItem('pendingPassword');
          
          if (pendingEmail && pendingPassword && pendingUsername) {
            try {
              console.log('🔐 Applying email verification code...');
              const { applyEmailVerificationCode, signInWithEmailAndPassword, reloadUser, getCurrentUser, completeAccountCreation } = require('../services/authService');
              
              // Step 1: Apply the verification code from the URL
              try {
                await applyEmailVerificationCode(oobCode);
                console.log('✅ Email verification code applied successfully');
              } catch (applyError: any) {
                console.error('❌ Failed to apply verification code:', applyError);
                // Continue anyway - Firebase might have already verified it
              }
              
              // Step 2: Sign in to get the user
              const firebaseUser = await signInWithEmailAndPassword(pendingEmail, pendingPassword);
              
              // Step 3: Reload to get latest verification status
              await reloadUser(firebaseUser);
              
              // Step 4: Check verification status
              const currentUser = getCurrentUser();
              console.log('📧 Email verified status:', currentUser?.emailVerified);
              
              if (currentUser?.emailVerified) {
                // Email is verified - complete account creation
                console.log('✅ Email verified via deep link - completing account creation');
                await completeAccountCreation(firebaseUser, pendingUsername, pendingEmail);
              } else {
                console.log('⏳ Email not yet verified, will check again...');
                // Set flag for CreateAccount to check
                await AsyncStorage.setItem('emailVerifiedViaDeepLink', 'true');
              }
            } catch (error) {
              console.error('❌ Error verifying email via deep link:', error);
            }
          } else {
            console.log('⚠️ No pending account found for deep link verification');
            // User might have already completed registration, just verify the email
            if (oobCode) {
              try {
                const { applyEmailVerificationCode } = require('../services/authService');
                await applyEmailVerificationCode(oobCode);
                console.log('✅ Email verified (no pending account)');
                // Navigate to sign in
                if (navigationRef.isReady()) {
                  navigationRef.navigate('SignIn' as never);
                }
              } catch (error) {
                console.error('❌ Error applying verification code:', error);
              }
            }
          }
        } else if (isVerificationLink) {
          console.log('⚠️ Verification link detected but no oobCode found');
        }
      } catch (error) {
        console.error('❌ Error handling deep link:', error);
      }
    };

    // Handle initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 Initial URL:', url);
        handleDeepLink(url);
      }
    });

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔗 Deep link event:', event.url);
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [navigationRef]);

  // Check authentication status on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Always start with SplashScreen for fresh installs
        // Only route to authenticated screens if we have a valid, verified session
        
        // Check for Firebase auth first (most reliable)
        let hasFirebaseAuth = false;
        try {
          const { getCurrentUser } = require('../services/authService');
          const currentUser = getCurrentUser();
          if (currentUser?.email) {
            hasFirebaseAuth = true;
          }
        } catch {
          // No Firebase auth
        }
        
        // Check for backend auth token
        const userToken = await AsyncStorage.getItem('userToken');
        const userEmail = await AsyncStorage.getItem('userEmail');
        const authProvider = await AsyncStorage.getItem('authProvider');
        const userRole = await AsyncStorage.getItem('userRole');
        const isAdmin = await AsyncStorage.getItem('isAdmin');
        
        // Only route to authenticated screens if we have BOTH:
        // 1. A valid token (or Firebase auth)
        // 2. A user email
        // This prevents routing on stale/incomplete data
        const hasValidSession = (userToken && userToken.length > 20 && userEmail) || (hasFirebaseAuth && userEmail);
        
        if (hasValidSession) {
          // Determine route based on role
          if (isAdmin === 'true' || userRole === 'admin') {
            setInitialRoute('AdminAIChat');
          } else {
            setInitialRoute('AIChat');
          }
        } else {
          // No valid session - start with SplashScreen
          setInitialRoute('SplashScreen');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // On any error, default to SplashScreen
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
    <NavigationContainer 
      ref={navigationRef}
      onReady={() => {
        // Reset timer when navigation is ready (user is active)
        console.log('🧭 Navigation ready - Resetting inactivity timer');
        resetInactivityTimer();
      }}
      onStateChange={() => {
        // Reset timer on any navigation state change (user is active)
        console.log('🧭 Navigation state changed - Resetting inactivity timer');
        resetInactivityTimer();
      }}
    >
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
          options={{
            animation: 'none' as const,
            animationDuration: 0,
            freezeOnBlur: false,
            contentStyle: {
              backgroundColor: 'transparent',
            },
          }}
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
          name="CalendarHelp" 
          component={CalendarHelpScreen}
          options={{
            headerShown: false,
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="PostUpdate" 
          component={PostUpdate}
          options={{
            presentation: 'modal' as const,
            animation: 'slide_from_bottom' as const,
            animationDuration: 300,
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