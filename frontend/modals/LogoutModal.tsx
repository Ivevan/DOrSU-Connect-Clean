import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

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
  const { theme: t } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }], backgroundColor: t.colors.surface }] }>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <View style={styles.sheetIconCircle}>
              <Ionicons name="log-out-outline" size={20} color={t.colors.accent} />
            </View>
            <Text style={[styles.sheetTitle, { color: t.colors.text }]}>Logout</Text>
          </View>
          <Text style={[styles.sheetMessage, { color: t.colors.textMuted }]}>Are you sure you want to logout of DOrSU Connect?</Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]} onPress={onClose}>
              <Text style={[styles.actionSecondaryText, { color: t.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary, { backgroundColor: t.colors.accent }]} onPress={onConfirm}>
              <Text style={[styles.actionPrimaryText, { color: t.colors.surface }]}>Logout</Text>
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
    backgroundColor: '#EEF2FF',
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

export default LogoutModal;
