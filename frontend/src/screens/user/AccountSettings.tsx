import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../config/theme';
import { useThemeValues } from '../../contexts/ThemeContext';
import { getCurrentUser, onAuthStateChange, User } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute } from '@react-navigation/native';

type RootStackParamList = {
  UserSettings: undefined;
  AccountSettings: undefined;
  GetStarted: undefined;
};

const AccountSettings = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useThemeValues();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();

  // Animated floating background orb
  const floatAnim1 = useRef(new Animated.Value(0)).current;

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      return getCurrentUser();
    } catch {
      return null;
    }
  });

  const [backendUserName, setBackendUserName] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'wrong' | 'success' | 'error'>('idle');
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      const loadBackendUserData = async () => {
        try {
          const userName = await AsyncStorage.getItem('userName');
          setBackendUserName(userName);
        } catch (error) {
          console.error('Failed to load backend user data:', error);
        }
      };
      loadBackendUserData();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let unsubscribe: (() => void) | null = null;
      const timeoutId = setTimeout(() => {
        unsubscribe = onAuthStateChange((user) => {
          setCurrentUser(prevUser => {
            if (prevUser?.uid !== user?.uid) {
              return user;
            }
            return prevUser;
          });
        });
      }, 50);

      return () => {
        clearTimeout(timeoutId);
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }, [])
  );

  const userName = useMemo(() => {
    if (backendUserName) return backendUserName;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'User';
  }, [currentUser, backendUserName]);

  const handleEditName = () => {
    setEditedName(userName);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      await AsyncStorage.setItem('userName', editedName.trim());
      setBackendUserName(editedName.trim());
      setIsEditingName(false);
      Alert.alert('Success', 'Name updated successfully');
    } catch (error) {
      console.error('Failed to save name:', error);
      Alert.alert('Error', 'Failed to update name. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      setDeleteStatus('wrong');
      setDeleteErrorMessage('Please type "Delete" to confirm');
      return;
    }

    try {
      setDeleteStatus('idle');
      
      // Clear user data from AsyncStorage
      await AsyncStorage.multiRemove(['userToken', 'userEmail', 'userName', 'userId', 'userPhoto', 'authProvider']);
      
      // Delete Firebase user account if available
      if (currentUser && typeof currentUser.delete === 'function') {
        try {
          await currentUser.delete();
        } catch (firebaseError) {
          console.error('Firebase account deletion error:', firebaseError);
          // Continue with local deletion even if Firebase fails
        }
      }
      
      // Sign out from Firebase if user is signed in
      try {
        const { getFirebaseAuth } = require('../../config/firebase');
        const auth = getFirebaseAuth();
        
        const isJSSDK = auth.signOut !== undefined;
        if (isJSSDK) {
          const { signOut } = require('firebase/auth');
          await signOut(auth);
        } else {
          await auth.signOut();
        }
      } catch (signOutError) {
        console.error('Firebase sign out error:', signOutError);
      }
      
      setDeleteStatus('success');
      // User will be redirected to auth flow automatically
    } catch (error) {
      console.error('Failed to delete account:', error);
      setDeleteStatus('error');
      setDeleteErrorMessage('Failed to delete account. Please try again.');
    }
  };

  const handleCancelDeleteModal = () => {
    setIsDeleteModalVisible(false);
    setDeleteConfirmText('');
    setDeleteStatus('idle');
    setDeleteErrorMessage('');
  };

  const handleSuccessClose = () => {
    setIsDeleteModalVisible(false);
    setDeleteConfirmText('');
    setDeleteStatus('idle');
    setDeleteErrorMessage('');
    // Navigate back to GetStarted after successful deletion
    navigation.reset({
      index: 0,
      routes: [{ name: 'GetStarted' }],
    });
  };

  // Animate floating background orb on mount
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim1, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [floatAnim1]);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        translucent={true}
      />

      {/* Background */}
      <LinearGradient
        colors={[
          isDarkMode ? '#0B1220' : '#FBF8F3',
          isDarkMode ? '#111827' : '#F8F5F0',
          isDarkMode ? '#1F2937' : '#F5F2ED'
        ]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint="default"
        style={styles.backgroundGradient}
      />

      {/* Animated Floating Background Orb */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.floatingOrbWrapper,
            {
              top: '35%',
              left: '50%',
              marginLeft: -250,
              transform: [
                {
                  translateX: floatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-30, 30],
                  }),
                },
                {
                  translateY: floatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 20],
                  }),
                },
                {
                  scale: floatAnim1.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.05, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.floatingOrb1}>
            <LinearGradient
              colors={['rgba(255, 165, 100, 0.45)', 'rgba(255, 149, 0, 0.3)', 'rgba(255, 180, 120, 0.18)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 45}
              tint="default"
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        </Animated.View>
      </View>

      {/* Header */}
      <View style={[styles.header, { top: insets.top, marginLeft: insets.left, marginRight: insets.right }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={28} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Account</Text>
      </View>

      <ScrollView
        style={[styles.scrollView, { marginTop: insets.top + 56 }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={styles.sectionCard}
        >
          <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Account Information</Text>

          <TouchableOpacity 
            style={[styles.settingItem, { borderBottomColor: t.colors.border }]}
            onPress={handleEditName}
            disabled={isEditingName}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                <Ionicons name="person-outline" size={20} color="#FF9500" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: t.colors.text }]}>Name</Text>
                {isEditingName ? (
                  <View style={styles.editNameContainer}>
                    <TextInput
                      style={[styles.nameInput, { color: t.colors.text, borderColor: t.colors.border }]}
                      value={editedName}
                      onChangeText={setEditedName}
                      placeholder="Enter your name"
                      placeholderTextColor={t.colors.textMuted}
                      autoFocus
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={handleCancelEdit}
                      >
                        <Text style={styles.cancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.saveButton]}
                        onPress={handleSaveName}
                      >
                        <Text style={styles.saveText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.settingValue, { color: t.colors.textMuted, marginTop: 4 }]}>{userName}</Text>
                )}
              </View>
            </View>
            {!isEditingName && <Ionicons name="pencil" size={18} color={t.colors.textMuted} />}
          </TouchableOpacity>
        </BlurView>

        <TouchableOpacity 
          style={[styles.deleteAccountButton, { 
            borderColor: '#EF4444',
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)'
          }]}
          onPress={() => setIsDeleteModalVisible(true)}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      {isDeleteModalVisible && (
        <View style={styles.modalOverlay}>
          {deleteStatus === 'success' ? (
            // Success Modal
            <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
              <View style={styles.successIconContainer}>
                <View style={styles.successIconBackground}>
                  <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </View>
              </View>
              <Text style={[styles.successTitle, { color: '#10B981' }]}>Account Deleted</Text>
              <Text style={[styles.successMessage, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                Your account has been successfully deleted. You will be redirected to the sign in screen.
              </Text>
              <TouchableOpacity
                style={styles.successButton}
                onPress={handleSuccessClose}
              >
                <Text style={styles.successButtonText}>Return to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : deleteStatus === 'error' ? (
            // Error Modal
            <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
              <View style={styles.errorIconContainer}>
                <View style={styles.errorIconBackground}>
                  <Ionicons name="alert-circle" size={64} color="#EF4444" />
                </View>
              </View>
              <Text style={[styles.errorTitle, { color: '#EF4444' }]}>Deletion Failed</Text>
              <Text style={[styles.errorMessage, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                {deleteErrorMessage}
              </Text>
              <TouchableOpacity
                style={styles.errorButton}
                onPress={handleCancelDeleteModal}
              >
                <Text style={styles.errorButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : deleteStatus === 'wrong' ? (
            // Wrong Input Modal
            <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
              <View style={styles.warningIconContainer}>
                <View style={styles.warningIconBackground}>
                  <Ionicons name="warning" size={64} color="#F59E0B" />
                </View>
              </View>
              <Text style={[styles.warningTitle, { color: '#F59E0B' }]}>Incorrect Confirmation</Text>
              <Text style={[styles.warningMessage, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                Please type "Delete" exactly to confirm the account deletion.
              </Text>
              <TouchableOpacity
                style={styles.warningButton}
                onPress={() => setDeleteStatus('idle')}
              >
                <Text style={styles.warningButtonText}>Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Default Confirmation Modal
            <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Delete Account</Text>
              <Text style={[styles.modalMessage, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                This action cannot be undone. All your data will be permanently deleted.
              </Text>
              <Text style={[styles.confirmLabel, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                Type "Delete" to confirm:
              </Text>
              <TextInput
                style={[styles.confirmInput, { 
                  color: isDarkMode ? '#F9FAFB' : '#1F2937',
                  borderColor: '#EF4444',
                  backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(239, 68, 68, 0.1)'
                }]}
                placeholder="Delete"
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                value={deleteConfirmText}
                onChangeText={(text) => {
                  setDeleteConfirmText(text);
                  if (deleteStatus !== 'idle' && deleteStatus !== 'success' && deleteStatus !== 'error') {
                    setDeleteStatus('idle');
                  }
                }}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelModalButton]}
                  onPress={handleCancelDeleteModal}
                >
                  <Text style={[styles.modalButtonText, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.deleteModalButton]}
                  onPress={handleDeleteAccount}
                >
                  <Text style={styles.deleteModalButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingItemLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 13,
    fontWeight: '400',
  },
  editNameContainer: {
    marginTop: 8,
    gap: 8,
  },
  nameInput: {
    fontSize: 14,
    fontWeight: '400',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
  },
  saveButton: {
    backgroundColor: '#FF9500',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  floatingBgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 0,
  },
  floatingOrbWrapper: {
    position: 'absolute',
  },
  floatingOrb1: {
    width: 500,
    height: 500,
    borderRadius: 250,
    opacity: 0.5,
    overflow: 'hidden',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 8,
  },
  deleteAccountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 12,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  confirmInput: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelModalButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  deleteModalButton: {
    backgroundColor: '#EF4444',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  successButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  warningIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  warningMessage: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  warningButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AccountSettings;
