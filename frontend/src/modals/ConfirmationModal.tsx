import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  iconColor?: string;
  confirmButtonColor?: string;
  sheetY: Animated.Value;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  icon = 'help-circle-outline',
  iconColor,
  confirmButtonColor,
  sheetY,
}) => {
  const insets = useSafeAreaInsets();
  const { theme: t } = useTheme();

  const defaultIconColor = iconColor || t.colors.accent;
  const defaultConfirmColor = confirmButtonColor || t.colors.accent;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }], backgroundColor: t.colors.surface }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <View style={[styles.sheetIconCircle, { backgroundColor: `${defaultIconColor}20` }]}>
              <Ionicons name={icon as any} size={20} color={defaultIconColor} />
            </View>
            <Text style={[styles.sheetTitle, { color: t.colors.text }]}>{title}</Text>
          </View>
          <Text style={[styles.sheetMessage, { color: t.colors.textMuted }]}>{message}</Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]} onPress={onClose}>
              <Text style={[styles.actionSecondaryText, { color: t.colors.text }]}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary, { backgroundColor: defaultConfirmColor }]} onPress={onConfirm}>
              <Text style={[styles.actionPrimaryText, { color: t.colors.surface }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: insets.bottom }} />
        </Animated.View>
      </View>
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
    backgroundColor: 'rgba(0,0,0,0.35)'
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  sheetIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  sheetMessage: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 24,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 10,
  },
  actionSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionSecondaryText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 13,
  },
  actionPrimary: {
    backgroundColor: '#2563EB',
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default ConfirmationModal;
