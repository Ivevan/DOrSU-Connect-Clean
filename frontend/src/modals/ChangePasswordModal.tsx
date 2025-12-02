import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, Animated, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import ProfileService from '../services/ProfileService';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  onClose,
  onSuccess,
  title = 'Change Password',
}) => {
  const insets = useSafeAreaInsets();
  const { theme: t, isDarkMode } = useTheme();
  const sheetY = useRef(new Animated.Value(300)).current;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.timing(sheetY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sheetY, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setTimeout(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError(null);
        setSuccess(null);
        setIsSubmitting(false);
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      }, 220);
    }
  }, [sheetY, visible]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('All fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      // Special handling for static admin sessions that use a local token
      const [isAdmin, storedToken] = await Promise.all([
        AsyncStorage.getItem('isAdmin'),
        AsyncStorage.getItem('userToken'),
      ]);

      if (isAdmin === 'true' && storedToken && storedToken.startsWith('admin_')) {
        // Admin account uses a locally stored password (no backend user record).
        const storedAdminPassword = await AsyncStorage.getItem('adminPassword');
        const effectiveCurrentPassword = storedAdminPassword || '12345';

        if (currentPassword !== effectiveCurrentPassword) {
          setError('Current password is incorrect');
          setIsSubmitting(false);
          return;
        }

        if (newPassword === effectiveCurrentPassword) {
          setError('New password must be different from the current password');
          setIsSubmitting(false);
          return;
        }

        await AsyncStorage.setItem('adminPassword', newPassword);
        setSuccess('Password updated successfully');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess?.();
        setIsSubmitting(false);
        setTimeout(() => {
          onClose();
        }, 600);
        return;
      }

      // Regular users: delegate to backend profile service
      await ProfileService.changePassword(currentPassword, newPassword);
      setSuccess('Password updated successfully');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (submitError: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(submitError?.message || 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmPassword, currentPassword, isSubmitting, newPassword, onClose, onSuccess]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <LinearGradient
        colors={[
          isDarkMode ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.4)',
          isDarkMode ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.5)',
        ]}
        style={styles.modalOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: sheetY }] }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 50}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.blurContainer}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheet}
            >
              <ScrollView
                contentContainerStyle={[
                  styles.scrollContent,
                  {
                    paddingBottom: insets.bottom + 16,
                  },
                ]}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.sheetHandle} />
                <View style={styles.iconContainer}>
                  <View style={[
                    styles.iconBackground,
                    { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }
                  ]}>
                    <Ionicons name="key-outline" size={28} color={t.colors.primary} />
                  </View>
                </View>
                <Text style={[styles.sheetTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>{title}</Text>
                <Text style={[styles.sheetMessage, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                  Update your account password to keep your profile secure.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>Current password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Enter current password"
                      placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                      secureTextEntry={!showCurrentPassword}
                      style={[
                        styles.input,
                        styles.passwordInput,
                        {
                          color: isDarkMode ? '#F9FAFB' : '#111827',
                          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.6)' : 'rgba(249, 250, 251, 0.9)',
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                      style={styles.eyeIcon}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showCurrentPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>New password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                      secureTextEntry={!showNewPassword}
                      style={[
                        styles.input,
                        styles.passwordInput,
                        {
                          color: isDarkMode ? '#F9FAFB' : '#111827',
                          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.6)' : 'rgba(249, 250, 251, 0.9)',
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      style={styles.eyeIcon}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>Confirm new password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                      secureTextEntry={!showConfirmPassword}
                      style={[
                        styles.input,
                        styles.passwordInput,
                        {
                          color: isDarkMode ? '#F9FAFB' : '#111827',
                          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.6)' : 'rgba(249, 250, 251, 0.9)',
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {error ? (
                  <Text style={styles.errorText}>{error}</Text>
                ) : null}

                {success ? (
                  <Text style={styles.successText}>{success}</Text>
                ) : null}

                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.actionSecondary,
                      {
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      },
                    ]}
                    onPress={onClose}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.actionSecondaryText, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionPrimary, { opacity: isSubmitting ? 0.7 : 1 }]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.actionPrimaryText}>Update</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </BlurView>
        </Animated.View>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    overflow: 'hidden',
  },
  blurContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(156, 163, 175, 0.4)',
    marginBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBackground: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sheetMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 15,
  },
  passwordInputContainer: {
    position: 'relative',
    width: '100%',
  },
  passwordInput: {
    paddingRight: 45,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    top: Platform.select({ ios: 14, default: 12 }),
    padding: 4,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  successText: {
    color: '#34D399',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionSecondary: {
    borderWidth: 1,
  },
  actionSecondaryText: {
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  actionPrimary: {
    backgroundColor: '#2563EB',
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
});

export default ChangePasswordModal;


