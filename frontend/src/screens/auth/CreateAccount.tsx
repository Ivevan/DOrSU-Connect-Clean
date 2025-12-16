import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, BackHandler, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config/api.config';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createUserWithEmailAndPassword, sendEmailVerification, reloadUser, getCurrentUser, onAuthStateChange } from '../../services/authService';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateAccount'>;

const TEMP_EMAIL_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
  'mailinator.com', 'maildrop.cc', 'temp-mail.org', 'yopmail.com',
  'fakeinbox.com', 'trashmail.com', 'getnada.com', 'mailnesia.com',
  'dispostable.com', 'throwawaymail.com', 'tempinbox.com', 'emailondeck.com',
  'sharklasers.com', 'guerrillamail.info', 'grr.la', 'guerrillamail.biz',
  'guerrillamail.de', 'spam4.me', 'mailtemp.com', 'tempsky.com'
];

const CreateAccount = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnline = isConnected && isInternetReachable;

  // Simplified animation values
  const signUpButtonScale = useRef(new Animated.Value(1)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [emailVerificationStatus, setEmailVerificationStatus] = useState<'idle' | 'pending' | 'verified'>('idle');
  const [emailVerificationMessage, setEmailVerificationMessage] = useState('');
  const [userType, setUserType] = useState<'faculty' | 'student' | null>(null); // Track user type selection
  const [studentVerified, setStudentVerified] = useState(false); // Track if student credentials are verified
  const [isVerifyingStudent, setIsVerifyingStudent] = useState(false);
  const [showEmailFields, setShowEmailFields] = useState(false); // Show email/password fields after student verification
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [errors, setErrors] = useState({ email: '', password: '', confirmPassword: '', studentId: '', fullName: '', firstName: '', lastName: '', general: '' });
  
  // Input focus states
  const emailFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;
  const confirmPasswordFocus = useRef(new Animated.Value(0)).current;
  const studentIdFocus = useRef(new Animated.Value(0)).current;
  const fullNameFocus = useRef(new Animated.Value(0)).current;
  const firstNameFocus = useRef(new Animated.Value(0)).current;
  const lastNameFocus = useRef(new Animated.Value(0)).current;
  const nameSectionOpacity = useRef(new Animated.Value(0)).current;
  const nameSectionTranslateY = useRef(new Animated.Value(20)).current;

  // Handle back button/gesture to navigate to GetStarted
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate('GetStarted');
        return true; // Prevent default behavior
      };

      if (Platform.OS === 'android') {
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
      }
    }, [navigation])
  );

  // Handle navigation back button and iOS swipe back gesture
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Prevent default behavior of leaving the screen
      e.preventDefault();
      // Navigate to GetStarted instead
      navigation.navigate('GetStarted');
    });

    return unsubscribe;
  }, [navigation]);


  // Button press handler
  const handleButtonPress = (scaleRef: Animated.Value, callback: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleRef, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleRef, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const validateEmailField = (value: string) => {
    if (!value.trim()) {
      return 'Please enter your email address';
    }
    if (!/\S+@\S+\.\S+/.test(value)) {
      return 'Please enter a valid email address';
    }
    const emailDomain = value.toLowerCase().split('@')[1];
    
    // Faculty accounts must use school email only
    if (userType === 'faculty') {
      const schoolDomains = ['dorsu.edu.ph'];
      if (!emailDomain || !schoolDomains.includes(emailDomain)) {
        return 'Faculty accounts must use a school email address (@dorsu.edu.ph)';
      }
    } else {
      // Student accounts can use multiple domains
      const allowedDomains = ['dorsu.edu.ph', 'gmail.com', 'yahoo.com', 'outlook.com', 'ymail.com', 'hotmail.com'];
      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        return 'Only @dorsu.edu.ph, @gmail.com, @yahoo.com, @outlook.com, @ymail.com, and @hotmail.com addresses are supported';
      }
    }
    
    if (TEMP_EMAIL_DOMAINS.includes(emailDomain)) {
      return 'Temporary emails not allowed';
    }
    return '';
  };

  // Check Firebase email verification status
  const checkEmailVerificationStatus = useCallback(
    async (options: { showErrors?: boolean } = {}) => {
      if (!email.trim() || !firebaseUser) {
        return false;
      }

      if (!isOnline) {
        if (options.showErrors) {
          setErrors(prev => ({
            ...prev,
            general: 'No internet connection. Please check your network and try again.',
          }));
        }
        return false;
      }

      try {
        // Reload user to get latest verification status from Firebase
        // This is critical for cross-device detection (phone app detecting desktop verification)
        
        // Get current user first to check if already verified
        let finalUser = getCurrentUser();
        
        // Force token refresh first to ensure we get latest data
        try {
          await firebaseUser.getIdToken(true); // Force refresh token
        } catch (tokenError) {
          // Token refresh failed, continue anyway
        }
        
        // Force reload the user to get fresh data from Firebase
        await reloadUser(firebaseUser);
        
        // Small delay to ensure Firebase has updated the user object
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get fresh user data after reload
        finalUser = getCurrentUser();
        
        // If still not verified, try multiple reloads (for cross-device scenarios)
        let attempts = 0;
        const maxAttempts = 3;
        while (!finalUser?.emailVerified && attempts < maxAttempts) {
          attempts++;
          
          try {
            // Force token refresh
            await firebaseUser.getIdToken(true);
            // Reload user
            await reloadUser(firebaseUser);
            // Wait a bit longer for cross-device sync
            await new Promise(resolve => setTimeout(resolve, 500));
            // Get fresh user
            finalUser = getCurrentUser();
            
            if (finalUser?.emailVerified) {
              break;
            }
          } catch (reloadError) {
            // Reload failed, continue to next attempt
          }
        }
        
        if (finalUser?.emailVerified) {
          // Check if this is a newly detected verification (status was pending before)
          const wasPending = emailVerificationStatus === 'pending';
          
          // Always update status to verified if email is verified
          setEmailVerificationStatus('verified');
          setEmailVerificationMessage('✅ Email verified successfully! Please enter your name (optional) to complete your account.');
          
          // Update firebaseUser state with verified user
          setFirebaseUser(finalUser);
          
          // If verification was just detected, provide haptic feedback and clear any errors
          if (wasPending) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setErrors(prev => ({ ...prev, general: '' }));
          }
          
          return true;
        } else {
          // Only update status if it's not already pending (to avoid unnecessary re-renders)
          if (emailVerificationStatus !== 'pending') {
            setEmailVerificationStatus('pending');
            setEmailVerificationMessage('Waiting for email verification. Please check your inbox and click the verification link.');
          }
          return false;
        }
      } catch (error) {
        if (options.showErrors) {
          setErrors(prev => ({
            ...prev,
            general: 'Unable to check email verification status. Please try again.',
          }));
        }
        return false;
      }
    },
    [email, firebaseUser, isOnline, emailVerificationStatus]
  );

  // Validate student credentials format
  const validateStudentCredentialsFormat = () => {
    const newErrors: { studentId: string; fullName: string } = { studentId: '', fullName: '' };
    let hasErrors = false;

    // Validate Student ID format (e.g., 2022-0987)
    const studentIdPattern = /^\d{4}-\d{4}$/;
    if (!studentId.trim()) {
      newErrors.studentId = 'Student ID is required';
      hasErrors = true;
    } else if (!studentIdPattern.test(studentId.trim())) {
      newErrors.studentId = 'Invalid format. Expected: YYYY-NNNN (e.g., 2022-0987)';
      hasErrors = true;
    }

    // Validate Full Name (must have at least 2 words - lastName & firstName)
    const nameParts = fullName.trim().split(/\s+/);
    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required';
      hasErrors = true;
    } else if (nameParts.length < 2) {
      newErrors.fullName = 'Please provide your full name (Last Name and First Name)';
      hasErrors = true;
    }

    return { hasErrors, errors: newErrors };
  };

  // Verify student credentials against database
  const verifyStudentCredentials = async () => {
    // Validate format first
    const validation = validateStudentCredentialsFormat();
    if (validation.hasErrors) {
      setErrors(prev => ({ ...prev, ...validation.errors }));
      return;
    }

    try {
      setIsVerifyingStudent(true);
      setErrors(prev => ({ ...prev, studentId: '', fullName: '', general: '' }));

      // Call backend to verify student credentials
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-student-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: studentId.trim(),
          fullName: fullName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify student credentials');
      }

      if (data.valid) {
        setStudentVerified(true);
        setShowEmailFields(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setErrors(prev => ({ 
          ...prev, 
          general: data.reason || 'Student credentials not found. Please check your Student ID and Name.' 
        }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error: any) {
      setErrors(prev => ({ 
        ...prev, 
        general: error.message || 'Failed to verify student credentials. Please try again.' 
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsVerifyingStudent(false);
    }
  };

  // Complete account creation after email verification
  const completeAccountCreation = useCallback(async () => {
    if (!firebaseUser || emailVerificationStatus !== 'verified') return;
    // For students, require verification; for faculty, skip verification
    if (userType === 'student' && !studentVerified) return;
    
    try {
      setIsLoading(true);
      
      // Use provided firstName/lastName if available, otherwise parse from fullName or use email username
      let finalFirstName = firstName.trim();
      let finalLastName = lastName.trim();
      
      // If firstName/lastName not provided, try to parse from fullName (for students)
      if (!finalFirstName && !finalLastName && fullName.trim()) {
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          finalFirstName = nameParts[nameParts.length - 1];
          finalLastName = nameParts.slice(0, -1).join(' ');
        } else {
          finalFirstName = fullName.trim();
          finalLastName = '';
        }
      }
      
      // If still no name, use email username as fallback
      if (!finalFirstName && !finalLastName) {
        const emailUsername = email.split('@')[0];
        finalFirstName = emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
        finalLastName = '';
      }
      
      const displayName = finalLastName 
        ? `${finalFirstName} ${finalLastName}`.trim()
        : finalFirstName;
      
      // Update Firebase user profile
      try {
        if (Platform.OS === 'web') {
          const { updateProfile } = require('firebase/auth');
          await updateProfile(firebaseUser, { displayName });
        } else {
          await firebaseUser.updateProfile({ displayName });
        }
      } catch (updateError) {
        // Failed to update profile, continue anyway
      }
      
      // Sync user to backend MongoDB
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/register-firebase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          username: displayName,
          firstName: finalFirstName,
          lastName: finalLastName,
          email: email.trim().toLowerCase(),
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync account with server');
      }

      // Submit student verification credentials (only for students)
      const userId = data.user?.id || firebaseUser.uid;
      if (userType === 'student') {
        const verificationResponse = await fetch(`${API_BASE_URL}/api/auth/submit-student-verification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token || idToken}`,
          },
          body: JSON.stringify({
            studentId: studentId.trim(),
            fullName: fullName.trim(),
          }),
        });

        if (!verificationResponse.ok) {
          const verificationError = await verificationResponse.json();
          throw new Error(verificationError.error || 'Failed to submit student verification');
        }
      }
      
      // Store user data locally
      const userRole = (data.user?.role || 'user') as 'user' | 'moderator' | 'admin' | 'superadmin';
      const adminFlag = userRole === 'admin' || userRole === 'superadmin';
      const superAdminFlag = userRole === 'superadmin';
      await AsyncStorage.setItem('userToken', data.token || idToken);
      await AsyncStorage.setItem('userEmail', firebaseUser.email || email);
      await AsyncStorage.setItem('userName', displayName);
      await AsyncStorage.setItem('userFirstName', finalFirstName);
      await AsyncStorage.setItem('userLastName', finalLastName);
      await AsyncStorage.setItem('userId', userId);
      await AsyncStorage.setItem('userRole', userRole);
      await AsyncStorage.setItem('isAdmin', adminFlag ? 'true' : 'false');
      await AsyncStorage.setItem('isSuperAdmin', superAdminFlag ? 'true' : 'false');
      await AsyncStorage.setItem('authProvider', 'email');
      
      setIsLoading(false);
      
      // Navigate to AIChat
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('AIChat');
    } catch (error: any) {
      setIsLoading(false);
      setErrors(prev => ({ ...prev, general: error.message || 'Failed to complete account creation' }));
    }
  }, [firebaseUser, email, emailVerificationStatus, studentId, fullName, studentVerified, userType, navigation]);

  // When email is verified, complete account creation
  useEffect(() => {
    if (emailVerificationStatus === 'verified' && firebaseUser && studentVerified) {
      // Auto-complete account creation when email is verified
      completeAccountCreation();
    }
  }, [emailVerificationStatus, firebaseUser, studentVerified, completeAccountCreation]);


  // Handle deep link verification when screen is focused
  useFocusEffect(
    useCallback(() => {
      const handleDeepLinkVerification = async () => {
        try {
          // Only process verification if we have a Firebase user (account creation started)
          if (!firebaseUser) {
            // Clear any stale verification data if no user exists (fresh start)
            await AsyncStorage.removeItem('pendingVerificationCode');
            await AsyncStorage.removeItem('emailVerifiedViaDeepLink');
            await AsyncStorage.removeItem('verificationError');
            return;
          }

          const pendingVerificationCode = await AsyncStorage.getItem('pendingVerificationCode');
          const emailVerifiedViaDeepLink = await AsyncStorage.getItem('emailVerifiedViaDeepLink');
          const verificationError = await AsyncStorage.getItem('verificationError');
          
          // Only show verification error if we're actually in a verification flow (pending status)
          // Don't show stale errors from previous attempts
          if (verificationError && emailVerificationStatus === 'pending') {
            setErrors(prev => ({ ...prev, general: verificationError }));
            await AsyncStorage.removeItem('verificationError');
          } else if (verificationError && emailVerificationStatus !== 'pending') {
            // Clear stale error if we're not in pending state
            await AsyncStorage.removeItem('verificationError');
          }
          
          // If verification code was applied via deep link, check status
          if (emailVerifiedViaDeepLink && firebaseUser) {
            const isVerified = await checkEmailVerificationStatus({ showErrors: true });
            
            if (isVerified) {
              await AsyncStorage.removeItem('emailVerifiedViaDeepLink');
              await AsyncStorage.removeItem('pendingVerificationCode');
            }
          } else if (pendingVerificationCode && firebaseUser && emailVerificationStatus === 'pending') {
            // Only process pending verification code if we're in pending state
            // Check if email is already verified before trying to apply code
            const currentUser = getCurrentUser();
            if (currentUser?.emailVerified) {
              // Email already verified, just clean up and check status
              await AsyncStorage.removeItem('pendingVerificationCode');
              await checkEmailVerificationStatus();
            } else {
              // If we have a verification code but haven't applied it yet, try to apply it
              try {
                const { applyEmailVerificationCode, reloadUser } = require('../../services/authService');
                await applyEmailVerificationCode(pendingVerificationCode);
                await reloadUser(firebaseUser);
                await AsyncStorage.removeItem('pendingVerificationCode');
                await AsyncStorage.setItem('emailVerifiedViaDeepLink', 'true');
                // Check verification status
                await checkEmailVerificationStatus();
              } catch (applyError: any) {
                // If code is invalid/expired/already used, check if email is already verified
                if (applyError?.code === 'auth/invalid-action-code' || applyError?.code === 'auth/expired-action-code') {
                  // Code might be invalid because email was already verified on another device
                  await reloadUser(firebaseUser);
                  const updatedUser = getCurrentUser();
                  if (updatedUser?.emailVerified) {
                    // Email is verified, just clean up
                    await AsyncStorage.removeItem('pendingVerificationCode');
                    await checkEmailVerificationStatus();
                  } else {
                    // Email not verified, show error only if we're still in pending state
                    if (emailVerificationStatus === 'pending') {
                      setErrors(prev => ({
                        ...prev,
                        general: 'Verification code is invalid or expired. Please request a new verification email.',
                      }));
                    }
                  }
                } else {
                  // Only show error if we're in pending state
                  if (emailVerificationStatus === 'pending') {
                    setErrors(prev => ({
                      ...prev,
                      general: applyError.message || 'Failed to verify email. Please try again.',
                    }));
                  }
                }
              }
            }
          } else if (pendingVerificationCode && emailVerificationStatus !== 'pending') {
            // Clear stale verification code if we're not in pending state
            await AsyncStorage.removeItem('pendingVerificationCode');
            await AsyncStorage.removeItem('emailVerifiedViaDeepLink');
          } else if (emailVerificationStatus === 'pending' && firebaseUser) {
            // User might have verified on web/desktop - check status immediately when screen is focused
            const isVerified = await checkEmailVerificationStatus({ showErrors: false });
            
            // On web, also check URL parameters in case verification link was clicked
            if (Platform.OS === 'web' && typeof window !== 'undefined' && !isVerified) {
              const urlParams = new URLSearchParams(window.location.search);
              const oobCode = urlParams.get('oobCode') || urlParams.get('actionCode');
              if (oobCode) {
                try {
                  // Check if already verified first
                  const currentUser = getCurrentUser();
                  if (currentUser?.emailVerified) {
                    // Already verified, just clean up URL
                    if (window.history && window.history.replaceState) {
                      const cleanUrl = window.location.origin + window.location.pathname;
                      window.history.replaceState({}, document.title, cleanUrl);
                    }
                    await checkEmailVerificationStatus({ showErrors: true });
                  } else {
                    const { applyEmailVerificationCode, reloadUser } = require('../../services/authService');
                    await applyEmailVerificationCode(oobCode);
                    await reloadUser(firebaseUser);
                    await checkEmailVerificationStatus({ showErrors: true });
                    
                    // Clean up URL
                    if (window.history && window.history.replaceState) {
                      const cleanUrl = window.location.origin + window.location.pathname;
                      window.history.replaceState({}, document.title, cleanUrl);
                    }
                  }
                } catch (applyError: any) {
                  // If code is invalid/expired/already used, check if email is already verified
                  if (applyError?.code === 'auth/invalid-action-code' || applyError?.code === 'auth/expired-action-code') {
                    await reloadUser(firebaseUser);
                    const updatedUser = getCurrentUser();
                    if (updatedUser?.emailVerified) {
                      // Email is verified, just clean up URL and check status
                      if (window.history && window.history.replaceState) {
                        const cleanUrl = window.location.origin + window.location.pathname;
                        window.history.replaceState({}, document.title, cleanUrl);
                      }
                      await checkEmailVerificationStatus({ showErrors: true });
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          // Error handling deep link verification
        }
      };
      
      handleDeepLinkVerification();
    }, [firebaseUser, checkEmailVerificationStatus, emailVerificationStatus])
  );

  // Listen to Firebase auth state changes to automatically detect verification
  // This is the PRIMARY method for cross-device detection
  useEffect(() => {
    if (emailVerificationStatus === 'pending' && firebaseUser) {
      const unsubscribe = onAuthStateChange(async (user) => {
        if (user && user.uid === firebaseUser.uid) {
          // Force reload to get latest verification status
          try {
            await reloadUser(user);
            // Small delay to ensure data is updated
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Get fresh user data
            const currentUser = getCurrentUser();
            
            // Check if verified directly from the user object
            if (currentUser?.emailVerified) {
              // Update state directly
              setEmailVerificationStatus('verified');
              setEmailVerificationMessage('✅ Email verified successfully! Your account is being created...');
              setFirebaseUser(currentUser); // Update firebaseUser state
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setErrors(prev => ({ ...prev, general: '' }));
            } else {
              // Still not verified, trigger check
              checkEmailVerificationStatus({ showErrors: false });
            }
          } catch (error) {
            // Fallback to regular check
            checkEmailVerificationStatus({ showErrors: false });
          }
        }
      });
      
      return () => {
        unsubscribe();
      };
    }
  }, [emailVerificationStatus, firebaseUser, checkEmailVerificationStatus]);

  // Check verification status periodically when pending (PRIMARY method for cross-device)
  // This is critical for cross-device detection (detecting verification on desktop from phone)
  // Firebase auth state listener doesn't always fire for emailVerified changes, so we poll aggressively
  useEffect(() => {
    if (emailVerificationStatus === 'pending' && firebaseUser) {
      // Check immediately first
      checkEmailVerificationStatus();
      
      // Check every 0.5 seconds for very fast detection when user clicks link on desktop
      const interval = setInterval(() => {
        checkEmailVerificationStatus();
      }, 500); // Check every 0.5 seconds for very fast response
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [emailVerificationStatus, firebaseUser, checkEmailVerificationStatus]);

  // Check verification status when app comes back into focus (user verified on web/desktop)
  useEffect(() => {
    if (emailVerificationStatus === 'pending' && firebaseUser) {
      // On web, also listen for visibility changes (tab focus)
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            // Check immediately and also after a short delay
            checkEmailVerificationStatus({ showErrors: false });
            setTimeout(() => {
              checkEmailVerificationStatus({ showErrors: false });
            }, 500);
          }
        };
        
        // Also check on focus event
        const handleFocus = () => {
          checkEmailVerificationStatus({ showErrors: false });
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        
        return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('focus', handleFocus);
        };
      } else {
        // On mobile, listen for AppState changes
        // This detects when user returns to app after verifying on desktop
        const subscription = AppState.addEventListener('change', (nextAppState: string) => {
          if (nextAppState === 'active') {
            // App came to foreground - check if user verified email on desktop/web
            // Check immediately and also after a short delay to ensure we get fresh data
            checkEmailVerificationStatus({ showErrors: false });
            setTimeout(() => {
              checkEmailVerificationStatus({ showErrors: false });
            }, 500);
            // One more check after 1 second to catch any delayed updates
            setTimeout(() => {
              checkEmailVerificationStatus({ showErrors: false });
            }, 1000);
          }
        });

        return () => {
          subscription.remove();
        };
      }
    }
  }, [emailVerificationStatus, firebaseUser, checkEmailVerificationStatus]);

  // Create account and send verification email
  const handleCreateAccount = async () => {
    if (!isOnline) {
      setErrors({ email: '', password: '', confirmPassword: '', studentId: '', fullName: '', firstName: '', lastName: '', general: 'No internet connection. Please check your network and try again.' });
      return;
    }

    // Clear previous errors
    setErrors({ email: '', password: '', confirmPassword: '', studentId: '', fullName: '', firstName: '', lastName: '', general: '' });
    
    // Clear any stale verification data from previous attempts
    await AsyncStorage.removeItem('pendingVerificationCode');
    await AsyncStorage.removeItem('emailVerifiedViaDeepLink');
    await AsyncStorage.removeItem('verificationError');
    
    // Validation
    let hasErrors = false;
    const newErrors = { email: '', password: '', confirmPassword: '', studentId: '', fullName: '', firstName: '', lastName: '', general: '' };
    
    const emailValidationMessage = validateEmailField(email);
    if (emailValidationMessage) {
      newErrors.email = emailValidationMessage;
      hasErrors = true;
    }
    
    if (!password.trim()) {
      newErrors.password = 'Please enter your password';
      hasErrors = true;
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      hasErrors = true;
    } else {
      // Check for strong password requirements
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/'`~;]/.test(password);
      
      if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
        newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
        hasErrors = true;
      }
    }
    
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
      hasErrors = true;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      hasErrors = true;
    }
    
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    Animated.loop(
      Animated.timing(loadingRotation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
    
    try {
      // Step 1: Create Firebase user account
      const user = await createUserWithEmailAndPassword(email.trim().toLowerCase(), password);
      setFirebaseUser(user);
      
      // Step 2: Send email verification link
      setIsSendingVerification(true);
      // Start loading animation
      Animated.loop(
        Animated.timing(loadingRotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
      
      try {
        await sendEmailVerification(user);
        setEmailVerificationStatus('pending');
        setEmailVerificationMessage('Verification email sent! Please check your inbox and click the link to verify your email. Your account will be activated once verified.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (verificationError: any) {
        // If verification email fails, delete the Firebase user to keep things clean
        try {
          if (Platform.OS === 'web') {
            const { deleteUser } = require('firebase/auth');
            await deleteUser(user);
          } else {
            await user.delete();
          }
        } catch (deleteError) {
          // Failed to delete Firebase user
        }
        throw new Error(verificationError.message || 'Failed to send verification email. Please try again.');
      } finally {
        setIsSendingVerification(false);
        loadingRotation.stopAnimation();
      }
      
      setIsLoading(false);
      
      // Start checking verification status
      checkEmailVerificationStatus();
    } catch (error: any) {
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      let errorMessage = 'Failed to create account';
      
      if (error.message.includes('already registered') || error.message.includes('email-already-in-use')) {
        setErrors({ email: 'This email is already registered', password: '', confirmPassword: '', studentId: '', fullName: '', firstName: '', lastName: '', general: '' });
      } else if (error.message.includes('Invalid') || error.message.includes('invalid-email')) {
        setErrors({ email: 'Invalid email format', password: '', confirmPassword: '', studentId: '', fullName: '', firstName: '', lastName: '', general: '' });
      } else if (error.message.includes('weak-password')) {
        setErrors({ email: '', password: 'Password is too weak', confirmPassword: '', studentId: '', fullName: '', firstName: '', lastName: '', general: '' });
      } else if (error.message.includes('operation-not-allowed') || error.message.includes('Email/Password authentication is not enabled')) {
        setErrors({ 
          email: '', 
          password: '', 
          confirmPassword: '', 
          studentId: '',
          fullName: '',
          firstName: '',
          lastName: '',
          general: 'Email/Password authentication is not enabled in Firebase. Please enable it in Firebase Console under Authentication > Sign-in method, then try again.' 
        });
      } else {
        setErrors({ email: '', password: '', confirmPassword: '', studentId: '', fullName: '', firstName: '', lastName: '', general: error.message || errorMessage });
      }
    }
  };


  const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

  // Render form content
  const renderFormContent = () => {
    return (
      <>
        <View style={styles.logoSection}>
          <Image 
            source={require('../../../../assets/DOrSU.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoTitle}>DOrSU CONNECT</Text>
            <Text style={styles.logoSubtitle}>AI-Powered Academic Assistant</Text>
          </View>
        </View>

        <Text style={styles.welcomeText}>Create your account</Text>
        
        {/* Student Verification Success Message */}
        {studentVerified && !showEmailFields && (
          <View style={styles.verificationSuccessBox}>
            <MaterialIcons name="check-circle" size={20} color="#10B981" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.verificationSuccessTitle}>Student Verified!</Text>
              <Text style={styles.verificationSuccessText}>
                Your student credentials have been verified. Please enter your email for verification.
              </Text>
            </View>
          </View>
        )}

        {/* Email Verification Status - Only show when Personal Information section is visible */}
        {emailVerificationStatus === 'verified' && showEmailFields && (
          <View style={styles.verificationSuccessBox}>
            <MaterialIcons name="check-circle" size={20} color="#10B981" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.verificationSuccessTitle}>Email Verified Successfully!</Text>
              <Text style={styles.verificationSuccessMessage}>
                Email verified successfully! Please enter your name (optional) to complete your account.
              </Text>
            </View>
          </View>
        )}

        {emailVerificationStatus === 'pending' && (
          <View style={styles.verificationInfoBox}>
            {isSendingVerification ? (
              <>
                <Animated.View style={[
                  styles.loadingSpinner,
                  {
                    transform: [{
                      rotate: loadingRotation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      })
                    }]
                  }
                ]}>
                  <MaterialIcons name="refresh" size={18} color="#2563EB" />
                </Animated.View>
                <Text style={styles.verificationInfoText}>Sending verification email...</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="info" size={18} color="#2563EB" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.verificationInfoText}>
                    {emailVerificationMessage || 'Verification email sent! Please check your inbox and click the link to verify your email.'}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        <View style={styles.formSection}>
          {/* Step 0: User Type Selection (Faculty or Student) */}
          {!userType ? (
            <>
              <Text style={styles.welcomeText}>Select Your Account Type</Text>
              <View style={styles.userTypeContainer}>
                <TouchableOpacity
                  style={[styles.userTypeButton, styles.facultyButton]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setUserType('faculty');
                    setShowEmailFields(true); // Skip student verification for faculty
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="school" size={32} color="#2563EB" />
                  <Text style={styles.userTypeTitle}>Faculty</Text>
                  <Text style={styles.userTypeDescription}>For university faculty members</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.userTypeButton, styles.studentButton]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setUserType('student');
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="person" size={32} color="#10B981" />
                  <Text style={styles.userTypeTitle}>Student</Text>
                  <Text style={styles.userTypeDescription}>For enrolled students</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : !studentVerified && userType === 'student' ? (
            // Step 1: Student ID and Full Name (only for students)
            <>
              {/* Student ID Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Student ID <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <Animated.View style={[
                  styles.inputWrapper,
                  {
                    borderColor: studentIdFocus.interpolate({
                      inputRange: [0, 1],
                      outputRange: [errors.studentId ? '#EF4444' : '#E5E7EB', errors.studentId ? '#EF4444' : '#2563EB'],
                    }),
                    borderWidth: studentIdFocus.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  }
                ]}>
                  <MaterialIcons 
                    name="badge" 
                    size={18} 
                    color={errors.studentId ? '#EF4444' : '#9CA3AF'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Student ID"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="default"
                    value={studentId}
                    onChangeText={(text) => {
                      // Auto-format: Add dash after 4 digits
                      let formatted = text.replace(/[^0-9]/g, '');
                      if (formatted.length > 4) {
                        formatted = formatted.slice(0, 4) + '-' + formatted.slice(4, 8);
                      }
                      setStudentId(formatted);
                      if (errors.studentId) setErrors(prev => ({ ...prev, studentId: '' }));
                    }}
                    maxLength={9}
                    onFocus={() => {
                      Animated.timing(studentIdFocus, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: false,
                      }).start();
                    }}
                    onBlur={() => {
                      Animated.timing(studentIdFocus, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: false,
                      }).start();
                    }}
                    accessibilityLabel="Student ID"
                    editable={!isVerifyingStudent}
                  />
                </Animated.View>
                <View style={styles.errorContainer}>
                  {errors.studentId ? (
                    <Text style={styles.errorText}>{errors.studentId}</Text>
                  ) : null}
                </View>
              </View>

              {/* Full Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <Animated.View style={[
                  styles.inputWrapper,
                  {
                    borderColor: fullNameFocus.interpolate({
                      inputRange: [0, 1],
                      outputRange: [errors.fullName ? '#EF4444' : '#E5E7EB', errors.fullName ? '#EF4444' : '#2563EB'],
                    }),
                    borderWidth: fullNameFocus.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  }
                ]}>
                  <MaterialIcons 
                    name="account-circle" 
                    size={18} 
                    color={errors.fullName ? '#EF4444' : '#9CA3AF'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Full Name"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    autoCorrect={false}
                    value={fullName}
                    onChangeText={(text) => {
                      setFullName(text);
                      if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                    }}
                    onFocus={() => {
                      Animated.timing(fullNameFocus, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: false,
                      }).start();
                    }}
                    onBlur={() => {
                      Animated.timing(fullNameFocus, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: false,
                      }).start();
                    }}
                    accessibilityLabel="Full Name"
                    editable={!isVerifyingStudent}
                  />
                </Animated.View>
                <View style={styles.errorContainer}>
                  {errors.fullName ? (
                    <Text style={styles.errorText}>{errors.fullName}</Text>
                  ) : null}
                </View>
              </View>
            </>
          ) : showEmailFields && emailVerificationStatus !== 'verified' ? (
            // Step 2: Email and Password fields (after student verification, before email verification)
            <>
              {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: emailFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.email ? '#EF4444' : '#E5E7EB', errors.email ? '#EF4444' : '#2563EB'],
                }),
                borderWidth: emailFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="email" 
                size={18} 
                color={errors.email ? '#EF4444' : '#9CA3AF'} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
                onFocus={() => {
                  Animated.timing(emailFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(emailFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                accessibilityLabel="Email Address"
                editable={emailVerificationStatus === 'idle'}
              />
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.email ? (
                <Text style={styles.errorText}>{errors.email}</Text>
              ) : null}
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.password ? '#EF4444' : '#E5E7EB', errors.password ? '#EF4444' : '#2563EB'],
                }),
                borderWidth: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="lock" 
                size={18} 
                color={errors.password ? '#EF4444' : '#9CA3AF'} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                }}
                onFocus={() => {
                  Animated.timing(passwordFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(passwordFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                accessibilityLabel="Password"
                editable={emailVerificationStatus === 'idle'}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility-off" : "visibility"} 
                  size={18} 
                  color="#9CA3AF" 
                />
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.password ? (
                <Text style={styles.errorText}>{errors.password}</Text>
              ) : null}
            </View>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: confirmPasswordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.confirmPassword ? '#EF4444' : '#E5E7EB', errors.confirmPassword ? '#EF4444' : '#2563EB'],
                }),
                borderWidth: confirmPasswordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="lock-outline" 
                size={18} 
                color={errors.confirmPassword ? '#EF4444' : '#9CA3AF'} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
                }}
                onFocus={() => {
                  Animated.timing(confirmPasswordFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(confirmPasswordFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                accessibilityLabel="Confirm Password"
                editable={emailVerificationStatus === 'idle'}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.passwordToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
              >
                <MaterialIcons 
                  name={showConfirmPassword ? "visibility-off" : "visibility"} 
                  size={18} 
                  color="#9CA3AF" 
                />
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.confirmPassword ? (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              ) : null}
            </View>
          </View>
            </>
          ) : emailVerificationStatus === 'verified' && showEmailFields ? (
            // Step 3: Personal Information (Replaces Email/Password after verification)
            <React.Fragment>
              {/* First Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name (Optional)</Text>
                <Animated.View style={[
                  styles.inputWrapper,
                  {
                    borderColor: firstNameFocus.interpolate({
                      inputRange: [0, 1],
                      outputRange: [errors.firstName ? '#EF4444' : '#E5E7EB', errors.firstName ? '#EF4444' : '#2563EB'],
                    }),
                    borderWidth: firstNameFocus.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  }
                ]}>
                  <MaterialIcons 
                    name="person" 
                    size={18} 
                    color={errors.firstName ? '#EF4444' : '#9CA3AF'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your first name"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    autoCorrect={false}
                    value={firstName}
                    onChangeText={(text) => {
                      setFirstName(text);
                      if (errors.firstName) setErrors(prev => ({ ...prev, firstName: '' }));
                    }}
                    onFocus={() => {
                      Animated.timing(firstNameFocus, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: false,
                      }).start();
                    }}
                    onBlur={() => {
                      Animated.timing(firstNameFocus, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: false,
                      }).start();
                    }}
                    accessibilityLabel="First Name"
                  />
                </Animated.View>
                <View style={styles.errorContainer}>
                  {errors.firstName ? (
                    <Text style={styles.errorText}>{errors.firstName}</Text>
                  ) : null}
                </View>
              </View>

              {/* Last Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name (Optional)</Text>
                <Animated.View style={[
                  styles.inputWrapper,
                  {
                    borderColor: lastNameFocus.interpolate({
                      inputRange: [0, 1],
                      outputRange: [errors.lastName ? '#EF4444' : '#E5E7EB', errors.lastName ? '#EF4444' : '#2563EB'],
                    }),
                    borderWidth: lastNameFocus.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  }
                ]}>
                  <MaterialIcons 
                    name="person-outline" 
                    size={18} 
                    color={errors.lastName ? '#EF4444' : '#9CA3AF'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your last name"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    autoCorrect={false}
                    value={lastName}
                    onChangeText={(text) => {
                      setLastName(text);
                      if (errors.lastName) setErrors(prev => ({ ...prev, lastName: '' }));
                    }}
                    onFocus={() => {
                      Animated.timing(lastNameFocus, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: false,
                      }).start();
                    }}
                    onBlur={() => {
                      Animated.timing(lastNameFocus, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: false,
                      }).start();
                    }}
                    accessibilityLabel="Last Name"
                  />
                </Animated.View>
                <View style={styles.errorContainer}>
                  {errors.lastName ? (
                    <Text style={styles.errorText}>{errors.lastName}</Text>
                  ) : null}
                </View>
              </View>
            </React.Fragment>
          ) : (
            null
          )}

        </View>

      {/* General Error Message */}
      <View style={[
        styles.generalErrorContainer,
        !errors.general && styles.generalErrorContainerHidden
      ]}>
        {errors.general ? (
          <>
            <MaterialIcons name="error-outline" size={20} color="#EF4444" />
            <Text style={styles.generalErrorText}>{errors.general}</Text>
          </>
        ) : null}
      </View>

      {/* Verify Student / Create Account Button */}
          <Animated.View style={{ transform: [{ scale: signUpButtonScale }] }}>
            <TouchableOpacity 
              style={[
                styles.signUpButton, 
                (isLoading || !isOnline || isVerifyingStudent || (emailVerificationStatus === 'pending' && !studentVerified)) && styles.signUpButtonDisabled
              ]}
              onPress={() => {
                if (!userType) {
                  // Should not happen - user type selection is handled by buttons
                  return;
                } else if (userType === 'student' && !studentVerified) {
                  // Step 1: Verify student credentials (students only)
                  handleButtonPress(signUpButtonScale, verifyStudentCredentials);
                } else if (showEmailFields && emailVerificationStatus === 'idle') {
                  // Step 2: Create account with email/password
                  handleButtonPress(signUpButtonScale, handleCreateAccount);
                } else if (emailVerificationStatus === 'verified') {
                  // Step 3: Complete account creation after email verification
                  handleButtonPress(signUpButtonScale, completeAccountCreation);
                }
              }}
              disabled={isLoading || !isOnline || isVerifyingStudent || (emailVerificationStatus === 'pending' && userType === 'student' && !studentVerified) || !userType || (emailVerificationStatus === 'idle' && !showEmailFields)}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              {isLoading || isVerifyingStudent ? (
                <>
                  <Animated.View style={[
                    styles.loadingSpinner,
                    {
                      transform: [{
                        rotate: loadingRotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        })
                      }]
                    }
                  ]}>
                    <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                  </Animated.View>
                  <Text style={styles.signUpButtonText}>
                    {isVerifyingStudent ? 'Verifying...' : 'Creating Account...'}
                  </Text>
                </>
              ) : !userType ? (
                <Text style={styles.signUpButtonText}>SELECT TYPE</Text>
              ) : userType === 'student' && !studentVerified ? (
                <Text style={styles.signUpButtonText}>VERIFY STUDENT</Text>
              ) : emailVerificationStatus === 'pending' ? (
                <Text style={styles.signUpButtonText}>VERIFY EMAIL TO CONTINUE</Text>
              ) : emailVerificationStatus === 'verified' ? (
                <Text style={styles.signUpButtonText}>CONTINUE</Text>
              ) : (
                <Text style={styles.signUpButtonText}>CREATE ACCOUNT</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

      {/* Links Section */}
      <View style={styles.linksSection}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('SignIn')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent={true}
        animated={true}
      />
      
      {/* Mobile Layout - Full screen form with background */}
      <View style={styles.mobileContainer}>
        <Image 
          source={require('../../../../assets/DOrSU_STATUE.png')} 
          style={styles.mobileBackgroundImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.5)', 'rgba(29, 78, 216, 0.7)']}
          style={styles.gradientOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <View style={[styles.mobileOverlay, { paddingTop: insets.top }]}>
          <KeyboardWrapper 
            style={styles.keyboardAvoidingView}
            {...keyboardProps}
          >
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={Platform.OS === 'ios'}
            >
              <View style={styles.mobileFormCard}>
                {renderFormContent()}
              </View>
            </ScrollView>
          </KeyboardWrapper>
        </View>
      </View>
      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  // Logo Section
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  logoTextContainer: {
    flex: 1,
  },
  logoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 1,
  },
  logoSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 1,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  // Form Section
  formSection: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    minHeight: 40,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
  },
  passwordToggle: {
    padding: 4,
    marginLeft: 4,
  },
  errorContainer: {
    minHeight: 14,
    marginTop: 1,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 10,
    marginLeft: 4,
  },
  generalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 6,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    minHeight: 36,
  },
  generalErrorContainerHidden: {
    opacity: 0,
    height: 0,
    minHeight: 0,
    marginBottom: 0,
    padding: 0,
    borderWidth: 0,
  },
  generalErrorText: {
    color: '#DC2626',
    fontSize: 11,
    marginLeft: 6,
    flex: 1,
  },
  // Sign Up Button
  signUpButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#9CA3AF',
  },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingSpinner: {
    marginRight: 8,
  },
  // Links Section
  linksSection: {
    marginTop: 10,
    alignItems: 'center',
  },
  linkText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '500',
  },
  verificationInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
    marginBottom: 12,
  },
  verificationInfoText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  verificationSuccessBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#10B981',
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  verificationSuccessTitle: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  verificationSuccessText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  verificationSuccessMessage: {
    color: '#047857',
    fontSize: 12,
    lineHeight: 16,
  },
  mobileContainer: {
    flex: 1,
    position: 'relative',
  },
  mobileBackgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  mobileOverlay: {
    flex: 1,
    zIndex: 2,
  },
  mobileFormCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    margin: 12,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  // User Type Selection
  userTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  userTypeButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  facultyButton: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  studentButton: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  userTypeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 4,
  },
  userTypeDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default CreateAccount;
