import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

import { UpdatesProvider } from '../contexts/UpdatesContext';
import UserHelpCenterScreen from '../screens/shared/HelpCenterScreen';
import LicensesScreen from '../screens/shared/LicensesScreen';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import TermsOfUseScreen from '../screens/shared/TermsOfUseScreen';
import AdminAccountSettings from '../screens/admin/AdminAccountSettings';
import AdminAIChat from '../screens/admin/AdminAIChat';
import AdminCalendar from '../screens/admin/AdminCalendar';
import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminGeneralSettings from '../screens/admin/AdminGeneralSettings';
import AdminSettings from '../screens/admin/AdminSettings';
import CalendarHelpScreen from '../screens/admin/CalendarHelpScreen';
import ManagePosts from '../screens/admin/ManagePosts';
import PostUpdate from '../screens/admin/PostUpdate';
import CreateAccount from '../screens/auth/CreateAccount';
import GetStarted from '../screens/auth/GetStarted';
import SignIn from '../screens/auth/SignIn';
import SplashScreen from '../screens/auth/SplashScreen';
import About from '../screens/shared/About';
import EmailSettings from '../screens/shared/EmailSettings';
import AccountSettings from '../screens/user/AccountSettings';
import AIChat from '../screens/user/AIChat';
import Calendar from '../screens/user/Calendar';
import GeneralSettings from '../screens/user/GeneralSettings';
import SchoolUpdates from '../screens/user/SchoolUpdates';
import UserSettings from '../screens/user/UserSettings';

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
    // Keep screens mounted between navigations so heavy screens like SchoolUpdates
    // don't unmount/remount (which feels like a reload) on every tab switch.
    detachInactiveScreens: false,
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
        
        // Parse URL - handle both custom scheme (dorsuconnect://) and http/https URLs
        let oobCode: string | null = null;
        let mode: string | null = null;
        
        try {
          // Try parsing as standard URL first (works for http/https)
          const urlObj = new URL(url);
          oobCode = urlObj.searchParams.get('oobCode') || urlObj.searchParams.get('actionCode');
          mode = urlObj.searchParams.get('mode');
          console.log('🔗 Parsed URL - oobCode:', oobCode ? oobCode.substring(0, 20) + '...' : 'none', 'mode:', mode || 'none');
        } catch {
          // For custom schemes (dorsuconnect://), manually parse query parameters
          console.log('⚠️ Custom scheme detected, parsing manually...');
          
          // Extract oobCode using regex (handles both ? and &)
          const oobCodeMatch = url.match(/[?&](?:oobCode|actionCode|oobcode|actioncode)=([^&]+)/i);
          if (oobCodeMatch && oobCodeMatch[1]) {
            oobCode = decodeURIComponent(oobCodeMatch[1]);
          }
          
          // Extract mode using regex
          const modeMatch = url.match(/[?&]mode=([^&]+)/i);
          if (modeMatch && modeMatch[1]) {
            mode = decodeURIComponent(modeMatch[1]);
          }
          console.log('🔗 Parsed custom scheme - oobCode:', oobCode ? oobCode.substring(0, 20) + '...' : 'none', 'mode:', mode || 'none');
        }
        
        // Check if this is an email verification link
        const isVerificationLink = url.includes('verify-email') || 
                                   url.includes('action=verifyEmail') || 
                                   url.includes('action=VerifyEmail') ||
                                   mode === 'verifyEmail' ||
                                   mode === 'VerifyEmail' ||
                                   !!oobCode;
        
        if (isVerificationLink) {
          console.log('✅ Email verification link detected');
          
          if (oobCode) {
            console.log('🔐 Verification code found:', oobCode.substring(0, 20) + '...');
            
            // Store the verification code for CreateAccount to use
            await AsyncStorage.setItem('pendingVerificationCode', oobCode);
            
            // Navigate to CreateAccount screen to handle verification
            if (navigationRef.isReady()) {
              navigationRef.navigate('CreateAccount' as never);
            }
            
            // Apply the verification code immediately
            try {
              const { applyEmailVerificationCode, getCurrentUser, reloadUser } = require('../services/authService');
              
              // Step 1: Check if user is already signed in and verified
              const currentUser = getCurrentUser();
              if (currentUser) {
                // Reload user to get latest verification status
                await reloadUser(currentUser);
                const updatedUser = getCurrentUser();
                
                if (updatedUser?.emailVerified) {
                  // Email already verified, just clean up
                  await AsyncStorage.removeItem('pendingVerificationCode');
                  await AsyncStorage.setItem('emailVerifiedViaDeepLink', 'true');
                  // CreateAccount will detect this and complete account creation
                } else {
                  // Step 2: Apply the verification code if not already verified
                  try {
                    await applyEmailVerificationCode(oobCode);
                    await reloadUser(currentUser);
                    const finalUser = getCurrentUser();
                    
                    if (finalUser?.emailVerified) {
                      await AsyncStorage.removeItem('pendingVerificationCode');
                      await AsyncStorage.setItem('emailVerifiedViaDeepLink', 'true');
                    }
                  } catch (applyError: any) {
                    // If code is invalid/expired/already used, check if email is now verified
                    if (applyError?.code === 'auth/invalid-action-code' || 
                        applyError?.code === 'auth/expired-action-code') {
                      // Code might be invalid because email was already verified
                      await reloadUser(currentUser);
                      const checkUser = getCurrentUser();
                      if (checkUser?.emailVerified) {
                        // Email is verified, just clean up
                        await AsyncStorage.removeItem('pendingVerificationCode');
                        await AsyncStorage.setItem('emailVerifiedViaDeepLink', 'true');
                      } else {
                        // Email not verified, store error
                        await AsyncStorage.setItem('verificationError', applyError.message || 'Invalid or expired verification code');
                      }
                    } else {
                      await AsyncStorage.setItem('verificationError', applyError.message || 'Failed to verify email');
                    }
                  }
                }
              } else {
                // User not signed in yet - CreateAccount will handle it
                // Store the code for CreateAccount to use
              }
            } catch (error: any) {
              // General error handling
              await AsyncStorage.setItem('verificationError', error.message || 'Failed to verify email');
            }
          } else {
            console.log('⚠️ Verification link detected but no oobCode found');
            // Still navigate to CreateAccount to show appropriate message
            if (navigationRef.isReady()) {
              navigationRef.navigate('CreateAccount' as never);
            }
          }
        }
      } catch (error: any) {
        console.error('❌ Error handling deep link:', error);
        // Store error for CreateAccount to display
        await AsyncStorage.setItem('verificationError', error.message || 'Failed to process verification link');
        if (navigationRef.isReady()) {
          navigationRef.navigate('CreateAccount' as never);
        }
      }
    };

    // On web, check the current window location for verification parameters
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const checkCurrentUrl = async () => {
        const currentUrl = window.location.href;
        const urlParams = new URLSearchParams(window.location.search);
        const oobCode = urlParams.get('oobCode') || urlParams.get('actionCode');
        const hasVerifyEmail = currentUrl.includes('verify-email') || currentUrl.includes('/verify-email');
        
        if (hasVerifyEmail || oobCode) {
          console.log('🌐 Web: Checking current URL for verification parameters:', currentUrl);
          console.log('🌐 Web: oobCode found:', oobCode ? oobCode.substring(0, 20) + '...' : 'none');
          await handleDeepLink(currentUrl);
          // Clean up URL to remove parameters after processing (but wait a bit to ensure processing is done)
          setTimeout(() => {
            if (window.history && window.history.replaceState) {
              const cleanUrl = window.location.origin + window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
            }
          }, 2000);
        }
      };
      
      // Check immediately and after delays (in case page just loaded or redirected)
      checkCurrentUrl();
      setTimeout(checkCurrentUrl, 300);
      setTimeout(checkCurrentUrl, 1000);
      setTimeout(checkCurrentUrl, 2000);
      
      // Also listen for popstate events (back/forward navigation) and hashchange
      const handlePopState = () => {
        setTimeout(checkCurrentUrl, 100);
      };
      const handleHashChange = () => {
        setTimeout(checkCurrentUrl, 100);
      };
      window.addEventListener('popstate', handlePopState);
      window.addEventListener('hashchange', handleHashChange);
      
      // Cleanup
      return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('hashchange', handleHashChange);
      };
    }

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
    <UpdatesProvider>
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
          name="AdminEmailSettings" 
          component={EmailSettings}
          options={{
            headerShown: false,
            animationDuration: 0,
          }}
        />
        <Stack.Screen 
          name="AdminAbout" 
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
    </UpdatesProvider>
  );
};

export default AppNavigator; 