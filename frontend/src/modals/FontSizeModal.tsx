import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontSizeScale } from '../config/theme';
import { useThemeActions, useThemeValues } from '../contexts/ThemeContext';

interface FontSizeModalProps {
  visible: boolean;
  onClose: () => void;
}

const fontSizeOptions: Array<{ label: string; value: FontSizeScale; description: string }> = [
  { label: 'Small', value: 'small', description: '85% of default' },
  { label: 'Medium', value: 'medium', description: '100% (Default)' },
  { label: 'Large', value: 'large', description: '115% of default' },
  { label: 'Extra Large', value: 'extraLarge', description: '130% of default' },
];

const FontSizeModal: React.FC<FontSizeModalProps> = ({ visible, onClose }) => {
  const { isDarkMode, fontSizeScale, theme } = useThemeValues();
  const { setFontSizeScale } = useThemeActions();

  const handleSelectFontSize = (scale: FontSizeScale) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFontSizeScale(scale);
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
              Choose Font Size
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Font Size Options */}
          <View style={styles.optionsContainer}>
            {fontSizeOptions.map((option) => {
              const isSelected = fontSizeScale === option.value;
              
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: isSelected 
                        ? theme.colors.accent 
                        : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                      borderColor: isSelected 
                        ? theme.colors.accent 
                        : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'),
                    }
                  ]}
                  onPress={() => handleSelectFontSize(option.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <View style={styles.optionLeft}>
                      <View style={[
                        styles.optionIcon,
                        { 
                          backgroundColor: isSelected 
                            ? 'rgba(255, 255, 255, 0.2)' 
                            : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                        }
                      ]}>
                        <Ionicons 
                          name="text-outline" 
                          size={24} 
                          color={isSelected ? '#FFFFFF' : theme.colors.accent} 
                        />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text style={[
                          styles.optionLabel,
                          { 
                            color: isSelected ? '#FFFFFF' : theme.colors.text,
                            fontSize: theme.fontSize.scaleSize(16),
                          }
                        ]}>
                          {option.label}
                        </Text>
                        <Text style={[
                          styles.optionDescription,
                          { 
                            color: isSelected ? 'rgba(255, 255, 255, 0.8)' : theme.colors.textMuted,
                            fontSize: theme.fontSize.scaleSize(12),
                          }
                        ]}>
                          {option.description}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer Info */}
          <View style={[styles.footer, { borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)' }]}>
            <Ionicons name="information-circle-outline" size={16} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
            <Text style={[styles.footerText, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>
              Font size changes will be applied immediately across the app
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
    marginBottom: 20,
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
  optionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  optionCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    fontWeight: '400',
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

export default FontSizeModal;

