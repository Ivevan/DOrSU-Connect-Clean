import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  onSelectMonth: (monthIndex: number, year?: number, day?: number) => void;
  scaleAnim: Animated.Value;
  opacityAnim: Animated.Value;
  minYear?: number;
  maxYear?: number;
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
  minYear,
  maxYear,
}) => {
  const { theme: t } = useTheme();
  
  // Safely get year from currentMonth, defaulting to current year if invalid
  const safeCurrentMonth = useMemo(() => {
    if (!currentMonth || !(currentMonth instanceof Date) || isNaN(currentMonth.getTime())) {
      return new Date();
    }
    return currentMonth;
  }, [currentMonth]);
  
  const [selectedYear, setSelectedYear] = useState(safeCurrentMonth.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(safeCurrentMonth.getDate());

  const currentMonthIndex = useMemo(() => safeCurrentMonth.getMonth(), [safeCurrentMonth]);
  const currentYear = useMemo(() => safeCurrentMonth.getFullYear(), [safeCurrentMonth]);

  // Calculate available years
  const availableYears = useMemo(() => {
    const years: number[] = [];
    const startYear = minYear || Math.max(currentYear - 2, 2020);
    const endYear = maxYear || Math.min(currentYear + 5, 2030);
    
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    return years;
  }, [minYear, maxYear, currentYear]);

  // Update selected year and day when currentMonth changes, reset month selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedYear(safeCurrentMonth.getFullYear());
      setSelectedDay(safeCurrentMonth.getDate());
      setSelectedMonth(null); // Reset month selection when modal opens
    }
  }, [visible, safeCurrentMonth]);

  // Get days in selected month
  const daysInMonth = useMemo(() => {
    if (selectedMonth === null) return [];
    const days = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  }, [selectedMonth, selectedYear]);

  const handleSelectMonth = useCallback((index: number) => {
    setSelectedMonth(index);
    // Reset day if it's invalid for the new month
    const maxDays = new Date(selectedYear, index + 1, 0).getDate();
    if (selectedDay && selectedDay > maxDays) {
      setSelectedDay(maxDays);
    }
  }, [selectedYear, selectedDay]);

  const handleSelectDay = useCallback((day: number) => {
    setSelectedDay(day);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedMonth !== null && selectedDay !== null) {
      onSelectMonth(selectedMonth, selectedYear, selectedDay);
    }
  }, [selectedMonth, selectedYear, selectedDay, onSelectMonth]);

  const handlePreviousYear = useCallback(() => {
    const currentIndex = availableYears.indexOf(selectedYear);
    if (currentIndex > 0) {
      setSelectedYear(availableYears[currentIndex - 1]);
    }
  }, [selectedYear, availableYears]);

  const handleNextYear = useCallback(() => {
    const currentIndex = availableYears.indexOf(selectedYear);
    if (currentIndex < availableYears.length - 1) {
      setSelectedYear(availableYears[currentIndex + 1]);
    }
  }, [selectedYear, availableYears]);

  const handleYearChange = useCallback((year: number) => {
    setSelectedYear(year);
  }, []);

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
            <View style={styles.yearSelector}>
              <TouchableOpacity 
                onPress={handlePreviousYear}
                disabled={availableYears.indexOf(selectedYear) === 0}
                style={[styles.yearNavButton, availableYears.indexOf(selectedYear) === 0 && styles.yearNavButtonDisabled]}
              >
                <Ionicons 
                  name="chevron-back" 
                  size={18} 
                  color={availableYears.indexOf(selectedYear) === 0 ? t.colors.textMuted : t.colors.text} 
                />
              </TouchableOpacity>
              <Text style={[styles.monthPickerTitle, { color: t.colors.text }]}>{selectedYear}</Text>
              <TouchableOpacity 
                onPress={handleNextYear}
                disabled={availableYears.indexOf(selectedYear) === availableYears.length - 1}
                style={[styles.yearNavButton, availableYears.indexOf(selectedYear) === availableYears.length - 1 && styles.yearNavButtonDisabled]}
              >
                <Ionicons 
                  name="chevron-forward" 
                  size={18} 
                  color={availableYears.indexOf(selectedYear) === availableYears.length - 1 ? t.colors.textMuted : t.colors.text} 
                />
              </TouchableOpacity>
            </View>
            <View style={styles.monthPickerSpacer} />
          </View>
          
          {selectedMonth === null ? (
            <View style={styles.monthPickerGrid}>
              {MONTH_NAMES.map((month, index) => (
                <MonthItem
                  key={index}
                  month={month}
                  index={index}
                  isSelected={currentMonthIndex === index && selectedYear === currentYear}
                  onSelect={handleSelectMonth}
                  theme={t}
                />
              ))}
            </View>
          ) : (
            <View style={styles.dayPickerContainer}>
              <Text style={[styles.dayPickerTitle, { color: t.colors.text }]}>
                Select Day - {MONTH_NAMES[selectedMonth]} {selectedYear}
              </Text>
              <View style={styles.dayPickerGrid}>
                {daysInMonth.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayPickerCard,
                      { backgroundColor: t.colors.surface, borderColor: t.colors.border },
                      selectedDay === day && [styles.dayPickerCardSelected, { backgroundColor: t.colors.primary, borderColor: t.colors.primary }]
                    ]}
                    onPress={() => handleSelectDay(day)}
                  >
                    <Text style={[
                      styles.dayPickerText,
                      { color: t.colors.text },
                      selectedDay === day && styles.dayPickerTextSelected
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.dayPickerActions}>
                <TouchableOpacity
                  style={[styles.dayPickerButton, styles.dayPickerButtonCancel, { borderColor: t.colors.border }]}
                  onPress={() => setSelectedMonth(null)}
                >
                  <Text style={[styles.dayPickerButtonText, { color: t.colors.text }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dayPickerButton, styles.dayPickerButtonConfirm, { backgroundColor: t.colors.primary }]}
                  onPress={handleConfirm}
                  disabled={selectedDay === null}
                >
                  <Text style={[styles.dayPickerButtonText, { color: '#FFFFFF' }]}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  yearNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearNavButtonDisabled: {
    opacity: 0.3,
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
  dayPickerContainer: {
    padding: 20,
    paddingTop: 0,
  },
  dayPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  dayPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  dayPickerCard: {
    width: '13%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayPickerCardSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  dayPickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  dayPickerTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayPickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  dayPickerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPickerButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  dayPickerButtonConfirm: {
    backgroundColor: '#2563EB',
  },
  dayPickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default memo(MonthPickerModal);
