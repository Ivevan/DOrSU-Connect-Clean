import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

interface ProfileSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  sheetY: Animated.Value;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  visible,
  onClose,
  sheetY,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const [fullName, setFullName] = useState('Admin User');

  // Animation values for smooth entrance
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-20)).current;
  const avatarScaleAnim = useRef(new Animated.Value(0)).current;
  const avatarFadeAnim = useRef(new Animated.Value(0)).current;
  const formFadeAnim = useRef(new Animated.Value(0)).current;
  const formSlideAnim = useRef(new Animated.Value(30)).current;
  const buttonsFadeAnim = useRef(new Animated.Value(0)).current;
  const buttonsSlideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      overlayOpacity.setValue(0);
      headerFadeAnim.setValue(0);
      headerSlideAnim.setValue(-20);
      avatarScaleAnim.setValue(0);
      avatarFadeAnim.setValue(0);
      formFadeAnim.setValue(0);
      formSlideAnim.setValue(30);
      buttonsFadeAnim.setValue(0);
      buttonsSlideAnim.setValue(30);

      // Animate overlay
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();

      // Animate header
      Animated.parallel([
        Animated.timing(headerFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(headerSlideAnim, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate avatar with slight delay
      Animated.parallel([
        Animated.spring(avatarScaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(avatarFadeAnim, {
          toValue: 1,
          duration: 300,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate form with more delay
      Animated.parallel([
        Animated.timing(formFadeAnim, {
          toValue: 1,
          duration: 350,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.spring(formSlideAnim, {
          toValue: 0,
          tension: 70,
          friction: 8,
          delay: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate buttons last
      Animated.parallel([
        Animated.timing(buttonsFadeAnim, {
          toValue: 1,
          duration: 350,
          delay: 300,
          useNativeDriver: true,
        }),
        Animated.spring(buttonsSlideAnim, {
          toValue: 0,
          tension: 70,
          friction: 8,
          delay: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      overlayOpacity.setValue(0);
    }
  }, [visible]);

  const handleOverlayPress = () => {
    onClose();
  };

  const handleClose = () => {
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
    onClose();
  };

  const handleSave = () => {
    // Here you would typically save to backend
    Alert.alert(
      'Profile Updated',
      'Your profile information has been saved successfully.',
      [{ text: 'OK', onPress: onClose }]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={handleOverlayPress} />
        <Animated.View style={[
          styles.sheet, 
          { 
            transform: [{ translateY: sheetY }], 
            backgroundColor: theme.colors.card 
          }
        ]}>
          <View style={styles.sheetHandle} />
          
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <Animated.View 
              style={[
                styles.sheetHeaderRow,
                {
                  opacity: headerFadeAnim,
                  transform: [{ translateY: headerSlideAnim }],
                }
              ]}
            >
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Profile Settings</Text>
            </Animated.View>

            {/* Profile Avatar */}
            <Animated.View 
              style={[
                styles.avatarContainer,
                {
                  opacity: avatarFadeAnim,
                  transform: [{ scale: avatarScaleAnim }],
                }
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceAlt }]}>
                <Ionicons name="person" size={44} color={theme.colors.textMuted} />
              </View>
              <TouchableOpacity 
                style={[styles.changePhotoButton, { backgroundColor: theme.colors.accent }]}
                activeOpacity={0.8}
              >
                <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Form Fields */}
            <Animated.View 
              style={[
                styles.formContainer,
                {
                  opacity: formFadeAnim,
                  transform: [{ translateY: formSlideAnim }],
                }
              ]}
            >
              {/* Full Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Full Name</Text>
                <View style={[styles.inputWrapper, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter your full name"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Action Buttons */}
          <Animated.View 
            style={[
              styles.actionButtons,
              {
                opacity: buttonsFadeAnim,
                transform: [{ translateY: buttonsSlideAnim }],
              }
            ]}
          >
            <TouchableOpacity 
              style={[styles.cancelButton, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]} 
              onPress={handleClose}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: theme.colors.accent }]} 
              onPress={handleSave}
            >
              <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>Save Changes</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: insets.bottom }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  overlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '80%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginBottom: 20,
    marginTop: 4,
  },
  sheetHeaderRow: {
    marginBottom: 32,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.3,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  changePhotoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  formContainer: {
    gap: 24,
  },
  inputGroup: {
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000000',
    letterSpacing: 0.2,
    opacity: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 0,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    paddingVertical: 8,
    fontWeight: '400',
    letterSpacing: 0,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 20,
    paddingBottom: 12,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});

export default ProfileSettingsModal;

