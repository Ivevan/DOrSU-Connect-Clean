import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface LogoutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sheetY: Animated.Value;
}

const LogoutModal: React.FC<LogoutModalProps> = ({
  visible,
  onClose,
  onConfirm,
  sheetY,
}) => {
  const insets = useSafeAreaInsets();
  const { theme: t, isDarkMode } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Background Overlay with Gradient */}
      <LinearGradient
        colors={[
          isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.4)',
          isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.5)',
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
            <View style={[styles.sheet, { 
              backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.85)' : 'rgba(255, 255, 255, 0.85)',
              borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)'
            }]}>
              <View style={styles.sheetHandle} />
              
              {/* Icon Container */}
              <View style={styles.iconContainer}>
                <View style={[styles.iconBackground, { 
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'
                }]}>
                  <Ionicons name="log-out" size={32} color="#EF4444" />
                </View>
              </View>
              
              <Text style={[styles.sheetTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Logout</Text>
              <Text style={[styles.sheetMessage, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                Are you sure you want to logout of DOrSU Connect?
              </Text>
              
              <View style={styles.sheetActions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.actionSecondary, { 
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
                  }]} 
                  onPress={onClose}
                >
                  <Text style={[styles.actionSecondaryText, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={onConfirm}>
                  <Text style={styles.actionPrimaryText}>Logout</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: insets.bottom }} />
            </View>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  sheetMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 28,
    fontWeight: '400',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
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
    backgroundColor: '#EF4444',
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
});

export default memo(LogoutModal);
