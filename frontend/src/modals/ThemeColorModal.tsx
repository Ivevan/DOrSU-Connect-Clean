import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues, useThemeActions } from '../contexts/ThemeContext';
import { getColorThemes, ColorTheme } from '../config/theme';
import * as Haptics from 'expo-haptics';

interface ThemeColorModalProps {
  visible: boolean;
  onClose: () => void;
}

const ThemeColorModal: React.FC<ThemeColorModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colorTheme } = useThemeValues();
  const { setColorTheme } = useThemeActions();
  const colorThemes = getColorThemes();

  const handleSelectTheme = (themeId: ColorTheme) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setColorTheme(themeId);
    // Close modal after a short delay to show selection
    setTimeout(() => {
      onClose();
    }, 200);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <BlurView
          intensity={Platform.OS === 'ios' ? 80 : 60}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.modalContent, { 
            backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)'
          }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>
              Choose Theme Color
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Theme Options Grid */}
          <View style={styles.themeGrid}>
            {colorThemes.map((theme) => {
              const isSelected = colorTheme === theme.id;
              
              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[
                    styles.themeCard,
                    { 
                      backgroundColor: theme.color,
                      opacity: isSelected ? 1 : 0.85,
                    }
                  ]}
                  onPress={() => handleSelectTheme(theme.id)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.themeCardText}>
                    {theme.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer Info */}
          <View style={[styles.footer, { borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)' }]}>
            <Ionicons name="information-circle-outline" size={16} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
            <Text style={[styles.footerText, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>
              Theme color changes will be applied immediately
            </Text>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    borderRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 24,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  themeCard: {
    width: '31%',
    aspectRatio: 1.15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  themeCardText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 0,
    borderTopWidth: 1,
    gap: 8,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
});

export default ThemeColorModal;
