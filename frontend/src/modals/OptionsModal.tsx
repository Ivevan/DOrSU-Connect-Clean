import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface Option {
  id: string;
  label: string;
  icon?: string;
  iconColor?: string;
  destructive?: boolean;
}

interface OptionsModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: Option[];
  onOptionSelect: (optionId: string) => void;
}

const OptionsModal: React.FC<OptionsModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  options,
  onOptionSelect,
}) => {
  const { theme } = useTheme();

  const handleOptionPress = (optionId: string) => {
    onOptionSelect(optionId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.optionsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.modalHeaderRow}>
            <Text style={[styles.optionsTitle, { color: theme.colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          
          {subtitle && (
            <Text style={[styles.optionsSubtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>
          )}

          <View style={styles.optionsList}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionItem,
                  { borderBottomColor: theme.colors.border },
                  index === options.length - 1 && styles.optionItemLast
                ]}
                onPress={() => handleOptionPress(option.id)}
              >
                <View style={styles.optionLeft}>
                  {option.icon && (
                    <View style={[styles.optionIcon, { backgroundColor: option.destructive ? '#FEF2F2' : theme.colors.surfaceAlt }]}>
                      <Ionicons 
                        name={option.icon as any} 
                        size={18} 
                        color={option.iconColor || (option.destructive ? '#DC2626' : theme.colors.accent)} 
                      />
                    </View>
                  )}
                  <Text style={[
                    styles.optionText, 
                    { color: option.destructive ? '#DC2626' : theme.colors.text }
                  ]}>
                    {option.label}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 10,
  },
  optionsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  optionsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionItemLast: {
    borderBottomWidth: 0,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
});

export default OptionsModal;
