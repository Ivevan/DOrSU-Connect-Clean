import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config/api.config';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createUserWithEmailAndPassword, sendEmailVerification, reloadUser, getCurrentUser, signInWithEmailAndPassword } from '../../services/authService';
import SuccessModal from '../../modals/SuccessModal';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateAccount'>;

const { width } = Dimensions.get('window');

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
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [emailVerificationStatus, setEmailVerificationStatus] = useState<'idle' | 'pending' | 'verified'>('idle');
  const [emailVerificationMessage, setEmailVerificationMessage] = useState('');
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [warningModalMessage, setWarningModalMessage] = useState('');
  const [errors, setErrors] = useState({ username: '', email: '', password: '', confirmPassword: '', general: '' });
  const [isCompletingAccount, setIsCompletingAccount] = useState(false);
  
  // Input focus states
  const usernameFocus = useRef(new Animated.Value(0)).current;
  const emailFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;
  const confirmPasswordFocus = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (!email.trim()) {
      setEmailVerificationStatus('idle');
      setEmailVerificationMessage('');
    }
  }, [email]);

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
    const allowedDomains = ['dorsu.edu.ph', 'gmail.com'];
    if (!emailDomain || !allowedDomains.includes(emailDomain)) {
      return 'Only @dorsu.edu.ph and @gmail.com addresses are supported';
    }
    if (TEMP_EMAIL_DOMAINS.includes(emailDomain)) {
      return 'Temporary emails not allowed';
    }
    return '';
  };

  // Check Firebase email verification status
  const checkEmailVerificationStatus = useCallback(
    async (options: { showErrors?: boolean } = {}) => {
      if (!email.trim()) {
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
        const currentUser = getCurrentUser();
        if (!currentUser || currentUser.email?.toLowerCase() !== email.trim().toLowerCase()) {
          // User not signed in or different email
          setEmailVerificationStatus('idle');
          setEmailVerificationMessage('');
          return false;
        }

        // Reload user to get latest verification status
        await reloadUser(currentUser);
        const updatedUser = getCurrentUser();
        
        if (updatedUser?.emailVerified) {
          setEmailVerificationStatus('verified');
          setEmailVerificationMessage('Email confirmed. You are good to go.');
          return true;
        } else {
          setEmailVerificationStatus('pending');
          setEmailVerificationMessage('Waiting for confirmation. Please tap the link we sent to your email.');
          
          if (options.showErrors) {
            setErrors(prev => ({
              ...prev,
              general: 'Please confirm your email by opening the link we sent.',
            }));
          }
          return false;
        }
      } catch (error) {
        console.error('Email verification status error:', error);
        if (options.showErrors) {
          setErrors(prev => ({
            ...prev,
            general: 'Unable to check email verification status. Please try again.',
          }));
        }
        return false;
      }
    },
    [email, isOnline]
  );

  const handleSendVerificationLink = async () => {
    if (!isOnline) {
      setErrors(prev => ({
        ...prev,
        general: 'No internet connection. Please check your network and try again.',
      }));
      return;
    }

    const emailError = validateEmailField(email);
    if (emailError) {
      setErrors(prev => ({ ...prev, email: emailError }));
      return;
    }

    setIsSendingVerification(true);
    setErrors(prev => ({ ...prev, general: '' }));

    try {
      // Check if user is already signed in
      let currentUser = getCurrentUser();
      
      if (!currentUser || currentUser.email?.toLowerCase() !== email.trim().toLowerCase()) {
        // User needs to create account first (will be done in handleSignUp)
        setErrors(prev => ({
          ...prev,
          general: 'Please create your account first. The verification email will be sent automatically.',
        }));
        return;
      }

      // Send verification email
      await sendEmailVerification(currentUser);
      setEmailVerificationStatus('pending');
      setEmailVerificationMessage('Confirmation link sent. Please open the link from your email inbox.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.error('Failed to send verification link:', error);
      setErrors(prev => ({
        ...prev,
        general: error?.message || 'Failed to send confirmation link. Please try again.',
      }));
    } finally {
      setIsSendingVerification(false);
    }
  };

  // Function to complete account creation after email verification
  const completeAccountCreation = async (firebaseUser: any, username: string, email: string) => {
    if (isCompletingAccount) return; // Prevent duplicate calls
    
    setIsCompletingAccount(true);
    setIsLoading(true);
    
    try {
      // Step 1: Sync user to backend MongoDB
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/register-firebase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim().toLowerCase(),
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync account with server');
      }
      
      // Step 2: Store user data locally
      await AsyncStorage.setItem('userToken', data.token || idToken);
      await AsyncStorage.setItem('userEmail', firebaseUser.email || email);
      await AsyncStorage.setItem('userName', username.trim());
      await AsyncStorage.setItem('userId', data.user?.id || firebaseUser.uid);
      await AsyncStorage.setItem('authProvider', 'email');
      
      // Clear pending data
      await AsyncStorage.multiRemove(['pendingEmail', 'pendingUsername', 'pendingPassword', 'pendingFirebaseUid']);
      
      setIsLoading(false);
      setIsCompletingAccount(false);
      
      // Update verification status
      setEmailVerificationStatus('verified');
      setEmailVerificationMessage('Email verified! Your account has been created successfully.');
      
      // Show success modal
      setShowSuccessModal(true);
      
      // Navigate after modal shows
      setTimeout(() => {
        setShowSuccessModal(false);
        navigation.navigate('SchoolUpdates');
      }, 2500);
    } catch (error: any) {
      setIsLoading(false);
      setIsCompletingAccount(false);
      setErrors({ username: '', email: '', password: '', confirmPassword: '', general: error.message || 'Failed to complete account creation' });
      console.error('Complete account creation error:', error);
    }
  };

  // Check for pending account creation on mount
  useEffect(() => {
    const checkPendingAccount = async () => {
      try {
        const pendingEmail = await AsyncStorage.getItem('pendingEmail');
        const pendingUsername = await AsyncStorage.getItem('pendingUsername');
        const pendingPassword = await AsyncStorage.getItem('pendingPassword');
        const pendingFirebaseUid = await AsyncStorage.getItem('pendingFirebaseUid');
        
        if (pendingEmail && pendingUsername && pendingPassword && pendingFirebaseUid) {
          // User has a pending account - check if email is verified
          setEmail(pendingEmail);
          setUsername(pendingUsername);
          setEmailVerificationStatus('pending');
          setEmailVerificationMessage('Please check your email and click the verification link to complete your account creation.');
          
          // Try to sign in to check verification status
          try {
            const firebaseUser = await signInWithEmailAndPassword(pendingEmail, pendingPassword);
            await reloadUser(firebaseUser);
            const currentUser = getCurrentUser();
            
            if (currentUser?.emailVerified) {
              // Email is verified - complete account creation
              await completeAccountCreation(firebaseUser, pendingUsername, pendingEmail);
            } else {
              // Start checking verification status periodically
              const verificationCheckInterval = setInterval(async () => {
                try {
                  await reloadUser(firebaseUser);
                  const updatedUser = getCurrentUser();
                  
                  if (updatedUser?.emailVerified) {
                    clearInterval(verificationCheckInterval);
                    if ((global as any).verificationCheckInterval === verificationCheckInterval) {
                      delete (global as any).verificationCheckInterval;
                    }
                    await completeAccountCreation(firebaseUser, pendingUsername, pendingEmail);
                  }
                } catch (error) {
                  console.error('Error checking verification status:', error);
                }
              }, 3000);
              
              (global as any).verificationCheckInterval = verificationCheckInterval;
            }
          } catch (signInError) {
            console.error('Failed to sign in with pending account:', signInError);
            // Clear pending data if sign in fails
            await AsyncStorage.multiRemove(['pendingEmail', 'pendingUsername', 'pendingPassword', 'pendingFirebaseUid']);
          }
        }
      } catch (error) {
        console.error('Error checking pending account:', error);
      }
    };
    
    checkPendingAccount();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (email && emailVerificationStatus === 'pending' && !isCompletingAccount) {
        // Check verification status periodically
        const interval = setInterval(() => {
          checkEmailVerificationStatus();
        }, 3000); // Check every 3 seconds
        
        return () => clearInterval(interval);
      }
    }, [email, emailVerificationStatus, checkEmailVerificationStatus, isCompletingAccount])
  );

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if ((global as any).verificationCheckInterval) {
        clearInterval((global as any).verificationCheckInterval);
        delete (global as any).verificationCheckInterval;
      }
    };
  }, []);

  // Handle app state changes to check verification when app comes to foreground or deep link
  useEffect(() => {
    const checkVerificationOnFocus = async () => {
      const pendingEmail = await AsyncStorage.getItem('pendingEmail');
      const pendingPassword = await AsyncStorage.getItem('pendingPassword');
      const pendingUsername = await AsyncStorage.getItem('pendingUsername');
      const emailVerifiedViaDeepLink = await AsyncStorage.getItem('emailVerifiedViaDeepLink');
      
      if (pendingEmail && pendingPassword && pendingUsername) {
        try {
          console.log('🔍 Checking email verification status...');
          const firebaseUser = await signInWithEmailAndPassword(pendingEmail, pendingPassword);
          await reloadUser(firebaseUser);
          const currentUser = getCurrentUser();
          
          console.log('📧 Email verified:', currentUser?.emailVerified);
          
          if (currentUser?.emailVerified) {
            // Clear the deep link flag
            if (emailVerifiedViaDeepLink) {
              await AsyncStorage.removeItem('emailVerifiedViaDeepLink');
            }
            
            // Complete account creation
            console.log('✅ Email verified - completing account creation');
            await completeAccountCreation(firebaseUser, pendingUsername, pendingEmail);
          } else if (emailVerificationStatus === 'pending') {
            // Still pending, update status
            setEmailVerificationStatus('pending');
            setEmailVerificationMessage('Please check your email and click the verification link.');
          }
        } catch (error) {
          console.error('❌ Error checking verification on focus:', error);
        }
      }
    };

    // Check when component mounts or when coming back to this screen
    checkVerificationOnFocus();
    
    // Also check periodically if verification is pending
    if (emailVerificationStatus === 'pending') {
      const interval = setInterval(() => {
        checkVerificationOnFocus();
      }, 2000); // Check every 2 seconds
      
      return () => clearInterval(interval);
    }
  }, [emailVerificationStatus]);

  const handleSignUp = async () => {
    // Check network status first
    if (!isOnline) {
      setErrors({ username: '', email: '', password: '', confirmPassword: '', general: 'No internet connection. Please check your network and try again.' });
      return;
    }

    // Clear previous errors
    setErrors({ username: '', email: '', password: '', confirmPassword: '', general: '' });
    
    // Validation
    let hasErrors = false;
    const newErrors = { username: '', email: '', password: '', confirmPassword: '', general: '' };
    
    if (!username.trim()) {
      newErrors.username = 'Please enter a username';
      hasErrors = true;
    }
    
    const emailValidationMessage = validateEmailField(email);
    if (emailValidationMessage) {
      newErrors.email = emailValidationMessage;
      hasErrors = true;
    }
    
    // Strong password validation
    if (!password.trim()) {
      newErrors.password = 'Please enter your password';
      hasErrors = true;
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      hasErrors = true;
    } else {
      // Check for alphanumeric (letters + numbers + special chars)
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
      const firebaseUser = await createUserWithEmailAndPassword(email.trim().toLowerCase(), password);
      
      // Step 2: Update Firebase user profile with username
      try {
        if (Platform.OS === 'web') {
          const { updateProfile } = require('firebase/auth');
          await updateProfile(firebaseUser, { displayName: username.trim() });
        } else {
          await firebaseUser.updateProfile({ displayName: username.trim() });
        }
      } catch (updateError) {
        console.warn('Failed to update profile:', updateError);
        // Continue anyway - profile update is not critical
      }
      
      // Step 3: Send email verification with deep link
      console.log('Attempting to send email verification...');
      try {
        await sendEmailVerification(firebaseUser);
        console.log('Email verification sent successfully');
      } catch (verificationError: any) {
        console.error('Failed to send verification email:', verificationError);
        // If verification email fails, delete the Firebase user to keep things clean
        try {
          if (Platform.OS === 'web') {
            const { deleteUser } = require('firebase/auth');
            await deleteUser(firebaseUser);
          } else {
            await firebaseUser.delete();
          }
        } catch (deleteError) {
          console.error('Failed to delete Firebase user after verification error:', deleteError);
        }
        throw new Error(verificationError.message || 'Failed to send verification email. Please try again.');
      }
      
      // Step 4: Store temporary user data locally (not synced to backend yet)
      await AsyncStorage.setItem('pendingEmail', email.trim().toLowerCase());
      await AsyncStorage.setItem('pendingUsername', username.trim());
      await AsyncStorage.setItem('pendingPassword', password); // Temporary, will be cleared after verification
      await AsyncStorage.setItem('pendingFirebaseUid', firebaseUser.uid);
      
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      // Set verification status to pending
      setEmailVerificationStatus('pending');
      setEmailVerificationMessage('Verification email sent! Please check your inbox and click the link to verify your email. The link will open this app automatically.');
      
      // Don't navigate yet - wait for email verification
      // Start checking verification status periodically
      const verificationCheckInterval = setInterval(async () => {
        try {
          await reloadUser(firebaseUser);
          const updatedUser = getCurrentUser();
          
          if (updatedUser?.emailVerified) {
            clearInterval(verificationCheckInterval);
            if ((global as any).verificationCheckInterval === verificationCheckInterval) {
              delete (global as any).verificationCheckInterval;
            }
            // Email verified - now sync to backend
            await completeAccountCreation(firebaseUser, username.trim(), email.trim().toLowerCase());
          }
        } catch (error) {
          console.error('Error checking verification status:', error);
        }
      }, 3000); // Check every 3 seconds
      
      // Store interval ID to clear it if component unmounts
      (global as any).verificationCheckInterval = verificationCheckInterval;
    } catch (error: any) {
      setIsLoading(false);
      loadingRotation.stopAnimation();
      
      let errorMessage = 'Failed to create account';
      
      if (error.message.includes('already registered') || error.message.includes('email-already-in-use')) {
        setErrors({ username: '', email: 'This email is already registered', password: '', confirmPassword: '', general: '' });
      } else if (error.message.includes('Invalid') || error.message.includes('invalid-email')) {
        setErrors({ username: '', email: 'Invalid email format', password: '', confirmPassword: '', general: '' });
      } else if (error.message.includes('weak-password')) {
        setErrors({ username: '', email: '', password: 'Password is too weak', confirmPassword: '', general: '' });
      } else if (error.message.includes('operation-not-allowed') || error.message.includes('Email/Password authentication is not enabled')) {
        setErrors({ 
          username: '', 
          email: '', 
          password: '', 
          confirmPassword: '', 
          general: 'Email/Password authentication is not enabled in Firebase. Please enable it in Firebase Console under Authentication > Sign-in method, then try again.' 
        });
      } else {
        setErrors({ username: '', email: '', password: '', confirmPassword: '', general: error.message || errorMessage });
      }
      
      console.error('Sign up error:', error);
    }
  };

  const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

  // Render form content
  const renderFormContent = () => {
    return (
      <>
        {/* Logo and Title Section */}
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

        {/* Welcome Text */}
        <Text style={styles.welcomeText}>Create your account</Text>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor: usernameFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [errors.username ? '#EF4444' : '#E5E7EB', errors.username ? '#EF4444' : '#2563EB'],
                }),
                borderWidth: usernameFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2],
                }),
              }
            ]}>
              <MaterialIcons 
                name="person" 
                size={20} 
                color={errors.username ? '#EF4444' : '#9CA3AF'} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (errors.username) setErrors(prev => ({ ...prev, username: '' }));
                }}
                onFocus={() => {
                  Animated.timing(usernameFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(usernameFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                accessibilityLabel="Username"
              />
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.username ? (
                <Text style={styles.errorText}>{errors.username}</Text>
              ) : null}
            </View>
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Registered E-mail Address</Text>
            {/* Warning about Gmail recommendation */}
            <View style={styles.emailWarningContainer}>
              <MaterialIcons name="info-outline" size={14} color="#F59E0B" style={{ marginRight: 4 }} />
              <Text style={styles.emailWarningText}>
                For best compatibility with email verification, please use a Gmail address (@gmail.com)
              </Text>
            </View>
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
                size={20} 
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
                accessibilityLabel="Registered E-mail Address"
              />
            </Animated.View>
            <View style={styles.errorContainer}>
              {errors.email ? (
                <Text style={styles.errorText}>{errors.email}</Text>
              ) : null}
            </View>
          {/* Email verification status (shown after account creation) */}
          {emailVerificationStatus === 'pending' ? (
            <View style={styles.verificationActions}>
              <View style={styles.verificationInfoBox}>
                <MaterialIcons name="info-outline" size={16} color="#2563EB" style={{ marginRight: 6 }} />
                <Text style={styles.verificationInfoText}>
                  Verification email sent! Please check your inbox (and spam folder) and click the verification link. The link will open this app automatically. Your account will be created once your email is verified.
                </Text>
              </View>
              <View style={styles.spamWarningBox}>
                <MaterialIcons name="warning-amber" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                <Text style={styles.spamWarningText}>
                  <Text style={styles.spamWarningBold}>Email in spam?</Text> Mark it as "Not Spam" and add noreply@firebaseapp.com to your contacts to prevent future emails from going to spam.
                </Text>
              </View>
              <View style={styles.verificationButtonRow}>
                <TouchableOpacity
                  style={[styles.verificationRefreshButton, styles.verificationButton]}
                  onPress={async () => {
                    const pendingEmail = await AsyncStorage.getItem('pendingEmail');
                    const pendingPassword = await AsyncStorage.getItem('pendingPassword');
                    if (pendingEmail && pendingPassword) {
                      try {
                        setIsSendingVerification(true);
                        const firebaseUser = await signInWithEmailAndPassword(pendingEmail, pendingPassword);
                        // Resend verification email
                        await sendEmailVerification(firebaseUser);
                        setEmailVerificationMessage('Verification email resent! Please check your inbox.');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      } catch (error: any) {
                        setErrors(prev => ({
                          ...prev,
                          general: error.message || 'Failed to resend verification email.',
                        }));
                      } finally {
                        setIsSendingVerification(false);
                      }
                    }
                  }}
                  accessibilityLabel="Resend verification email"
                  disabled={isSendingVerification}
                >
                  <MaterialIcons name="email" size={16} color="#2563EB" style={{ marginRight: 4 }} />
                  <Text style={styles.verificationRefreshText}>
                    {isSendingVerification ? 'Sending...' : 'Resend Email'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.verificationRefreshButton, styles.verificationButton]}
                  onPress={async () => {
                    const pendingEmail = await AsyncStorage.getItem('pendingEmail');
                    const pendingPassword = await AsyncStorage.getItem('pendingPassword');
                    if (pendingEmail && pendingPassword) {
                      try {
                        const firebaseUser = await signInWithEmailAndPassword(pendingEmail, pendingPassword);
                        await reloadUser(firebaseUser);
                        const currentUser = getCurrentUser();
                        if (currentUser?.emailVerified) {
                          const pendingUsername = await AsyncStorage.getItem('pendingUsername');
                          if (pendingUsername) {
                            await completeAccountCreation(firebaseUser, pendingUsername, pendingEmail);
                          }
                        } else {
                          setErrors(prev => ({
                            ...prev,
                            general: 'Email not verified yet. Please click the link in your email.',
                          }));
                        }
                      } catch (error: any) {
                        setErrors(prev => ({
                          ...prev,
                          general: error.message || 'Failed to check verification status.',
                        }));
                      }
                    }
                  }}
                  accessibilityLabel="Refresh email confirmation status"
                >
                  <MaterialIcons name="refresh" size={16} color="#2563EB" style={{ marginRight: 4 }} />
                  <Text style={styles.verificationRefreshText}>I confirmed – Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {emailVerificationStatus === 'verified' ? (
            <View style={styles.verificationBadge}>
              <MaterialIcons name="check-circle" size={16} color="#10B981" style={{ marginRight: 4 }} />
              <Text style={styles.verificationBadgeText}>Email verified</Text>
            </View>
          ) : null}
          {emailVerificationMessage ? (
            <Text
              style={[
                styles.verificationMessage,
                emailVerificationStatus === 'verified' && styles.verificationMessageSuccess
              ]}
            >
              {emailVerificationMessage}
            </Text>
          ) : null}
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
                size={20} 
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
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility-off" : "visibility"} 
                  size={20} 
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
                size={20} 
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
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.passwordToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
              >
                <MaterialIcons 
                  name={showConfirmPassword ? "visibility-off" : "visibility"} 
                  size={20} 
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

          {/* Sign Up Button */}
          <Animated.View style={{ transform: [{ scale: signUpButtonScale }] }}>
            <TouchableOpacity 
              style={[styles.signUpButton, (isLoading || !isOnline || emailVerificationStatus === 'pending') && styles.signUpButtonDisabled]}
              onPress={() => handleButtonPress(signUpButtonScale, handleSignUp)}
              disabled={isLoading || !isOnline || emailVerificationStatus === 'pending'}
              accessibilityRole="button"
              accessibilityLabel={
                isLoading ? "Creating account..." : 
                !isOnline ? "Sign up (No internet connection)" : 
                emailVerificationStatus === 'pending' ? "Please verify your email first" :
                "Sign up"
              }
              activeOpacity={0.8}
            >
              {isLoading ? (
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
                    {isCompletingAccount ? 'Completing Account...' : 'Creating Account'}
                  </Text>
                </>
              ) : emailVerificationStatus === 'pending' ? (
                <Text style={styles.signUpButtonText}>VERIFY EMAIL TO CONTINUE</Text>
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
      
      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Account Created!"
        message="Welcome to DOrSU Connect. Your account has been successfully created."
        icon="checkmark-circle"
        iconColor="#10B981"
      />

      <Modal
        visible={warningModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWarningModalVisible(false)}
      >
        <View style={styles.warningModalOverlay}>
          <View style={styles.warningModalCard}>
            <MaterialIcons name="warning-amber" size={32} color="#F97316" style={styles.warningModalIcon} />
            <Text style={styles.warningModalTitle}>Email not found</Text>
            <Text style={styles.warningModalMessage}>
              {warningModalMessage || 'We could not reach that email address. Please use an existing email account.'}
            </Text>
            <TouchableOpacity
              style={styles.warningModalButton}
              onPress={() => setWarningModalVisible(false)}
              accessibilityLabel="Close warning modal"
            >
              <Text style={styles.warningModalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 20,
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
    marginBottom: 12,
  },
  logoImage: {
    width: 50,
    height: 50,
    marginRight: 10,
  },
  logoTextContainer: {
    flex: 1,
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 2,
  },
  logoSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  // Form Section
  formSection: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emailWarningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  emailWarningText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    minHeight: 44,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  passwordToggle: {
    padding: 4,
    marginLeft: 6,
  },
  errorContainer: {
    minHeight: 16,
    marginTop: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    marginLeft: 4,
  },
  verificationActions: {
    marginTop: 4,
    alignItems: 'flex-start',
    gap: 8,
  },
  verificationInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
    width: '100%',
  },
  verificationInfoText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  spamWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    width: '100%',
    marginTop: 4,
  },
  spamWarningText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '400',
    flex: 1,
    lineHeight: 16,
  },
  spamWarningBold: {
    fontWeight: '600',
  },
  verificationButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  verificationButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  verificationRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationRefreshText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '500',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
  },
  verificationBadgeText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
  },
  verificationMessage: {
    marginTop: 6,
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '500',
  },
  verificationMessageSuccess: {
    color: '#059669',
  },
  warningModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  warningModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  warningModalIcon: {
    marginBottom: 12,
  },
  warningModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  warningModalMessage: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 16,
  },
  warningModalButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  warningModalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  generalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    minHeight: 40,
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
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  // Sign Up Button
  signUpButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 8,
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
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
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
    margin: 16,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});

export default CreateAccount;
