import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

// Month names array (moved outside component for performance)
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface MonthPickerModalProps {
  visible: boolean;
  currentMonth: Date;
  onClose: () => void;
  onSelectMonth: (monthIndex: number) => void;
  scaleAnim: Animated.Value;
  opacityAnim: Animated.Value;
}

// Memoized Month Item Component
const MonthItem = memo(({ month, index, isSelected, onSelect, theme }: { month: string; index: number; isSelected: boolean; onSelect: (index: number) => void; theme: any }) => (
  <TouchableOpacity
    style={[
      styles.monthPickerCard,
      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      isSelected && [styles.monthPickerCardSelected, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]
    ]}
    onPress={() => onSelect(index)}
  >
    <Text style={[
      styles.monthPickerText,
      { color: theme.colors.text },
      isSelected && styles.monthPickerTextSelected
    ]}>
      {month.substring(0, 3)}
    </Text>
  </TouchableOpacity>
));

const MonthPickerModal: React.FC<MonthPickerModalProps> = ({
  visible,
  currentMonth,
  onClose,
  onSelectMonth,
  scaleAnim,
  opacityAnim,
}) => {
  const { theme: t } = useTheme();

  const currentMonthIndex = useMemo(() => currentMonth.getMonth(), [currentMonth]);

  const handleSelectMonth = useCallback((index: number) => {
    onSelectMonth(index);
  }, [onSelectMonth]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[
        styles.modalOverlay,
        { opacity: opacityAnim }
      ]}>
        <Animated.View style={[
          styles.monthPickerModal,
          {
            transform: [{ scale: scaleAnim }],
            backgroundColor: t.colors.card
          }
        ]}>
          <View style={styles.monthPickerHeader}>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.monthPickerBackButton}
            >
              <Ionicons name="arrow-back" size={20} color={t.colors.textMuted} />
            </TouchableOpacity>
            <Text style={[styles.monthPickerTitle, { color: t.colors.text }]}>{currentMonth.getFullYear()}</Text>
            <View style={styles.monthPickerSpacer} />
          </View>
          
          <View style={styles.monthPickerGrid}>
            {MONTH_NAMES.map((month, index) => (
              <MonthItem
                key={index}
                month={month}
                index={index}
                isSelected={currentMonthIndex === index}
                onSelect={handleSelectMonth}
                theme={t}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
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
  monthPickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  monthPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  monthPickerBackButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  monthPickerSpacer: {
    width: 32,
  },
  monthPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    paddingTop: 0,
    gap: 8,
  },
  monthPickerCard: {
    width: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  monthPickerCardSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  monthPickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  monthPickerTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default memo(MonthPickerModal);
