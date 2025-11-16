import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import MonthPickerModal from '../../modals/MonthPickerModal';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import { formatDate } from '../../utils/dateUtils';

interface AddEventDrawerProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: Date | null;
  refreshCalendarEvents: () => Promise<void>;
  slideAnim: Animated.Value;
  backdropOpacity: Animated.Value;
  monthPickerScaleAnim: Animated.Value;
  monthPickerOpacityAnim: Animated.Value;
  eventYearRange: { minYear: number; maxYear: number };
}

const AddEventDrawer: React.FC<AddEventDrawerProps> = ({
  visible,
  onClose,
  initialDate,
  refreshCalendarEvents,
  slideAnim,
  backdropOpacity,
  monthPickerScaleAnim,
  monthPickerOpacityAnim,
  eventYearRange,
}) => {
  const { theme: t } = useThemeValues();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate || new Date());
  const [dateString, setDateString] = useState('');
  const [time, setTime] = useState('All Day');
  const [eventType, setEventType] = useState<'Academic' | 'Institutional'>('Institutional');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Animate month picker when it opens/closes
  useEffect(() => {
    if (showDatePicker) {
      // Animate in
      Animated.parallel([
        Animated.spring(monthPickerScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(monthPickerOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.spring(monthPickerScaleAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(monthPickerOpacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showDatePicker, monthPickerScaleAnim, monthPickerOpacityAnim]);

  // Initialize date when drawer opens or initialDate changes
  useEffect(() => {
    if (visible) {
      const date = initialDate || new Date();
      setSelectedDate(date);
      setDateString(formatDate(date));
      setTitle('');
      setDescription('');
      setTime('All Day');
      setEventType('Institutional');
    }
  }, [visible, initialDate]);

  // Update date string when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setDateString(formatDate(selectedDate));
    }
  }, [selectedDate]);

  const handleDateSelect = (monthIndex: number, year?: number, day?: number) => {
    // Use provided day, or fall back to current day, or 1
    const selectedDay = day !== undefined ? day : (selectedDate ? selectedDate.getDate() : 1);
    
    if (!year) {
      // If year is not provided, use the current selected date's year or current year
      const currentYear = selectedDate ? selectedDate.getFullYear() : new Date().getFullYear();
      const maxDaysInMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
      const newDay = Math.min(selectedDay, maxDaysInMonth);
      const newDate = new Date(currentYear, monthIndex, newDay);
      setSelectedDate(newDate);
    } else {
      const maxDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const newDay = Math.min(selectedDay, maxDaysInMonth);
      const newDate = new Date(year, monthIndex, newDay);
      setSelectedDate(newDate);
    }
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }

    if (!selectedDate) {
      Alert.alert('Error', 'Please select a date');
      return;
    }

    setIsCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Create ISO date string (start of day)
      const isoDate = new Date(selectedDate);
      isoDate.setHours(0, 0, 0, 0);

      const eventData: Partial<CalendarEvent> = {
        title: title.trim(),
        description: description.trim() || '',
        isoDate: isoDate.toISOString(),
        date: dateString,
        time: time.trim() || 'All Day',
        category: eventType,
        dateType: 'date',
        startDate: isoDate.toISOString(),
        endDate: isoDate.toISOString(),
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
      };

      const createdEvent = await CalendarService.createEvent(eventData);

      if (createdEvent) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Event created successfully');
        await refreshCalendarEvents();
        onClose();
      } else {
        throw new Error('Failed to create event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    setTime('All Day');
    setEventType('Institutional');
    setSelectedDate(initialDate || new Date());
    onClose();
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalContainer}>
          {/* Backdrop */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCancel}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: 'rgba(0, 0, 0, 0.5)', opacity: backdropOpacity },
              ]}
            />
          </TouchableOpacity>

          {/* Drawer */}
          <Animated.View
            style={[
              styles.drawer,
              {
                backgroundColor: t.colors.card,
                paddingBottom: insets.bottom,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: t.colors.border }]} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: t.colors.text }]}>Add Event</Text>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={t.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Event Type Selector */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: t.colors.text }]}>Event Type</Text>
                <View style={[styles.typeSelector, { backgroundColor: t.colors.surfaceAlt }]}>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      eventType === 'Institutional' && [styles.typeOptionActive, { backgroundColor: '#2563EB' }],
                    ]}
                    onPress={() => {
                      setEventType('Institutional');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        { color: eventType === 'Institutional' ? '#FFFFFF' : t.colors.text },
                      ]}
                    >
                      Institutional
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      eventType === 'Academic' && [styles.typeOptionActive, { backgroundColor: '#10B981' }],
                    ]}
                    onPress={() => {
                      setEventType('Academic');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        { color: eventType === 'Academic' ? '#FFFFFF' : t.colors.text },
                      ]}
                    >
                      Academic
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Title */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: t.colors.text }]}>Title *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: t.colors.surfaceAlt,
                      color: t.colors.text,
                      borderColor: t.colors.border,
                    },
                  ]}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter event title"
                  placeholderTextColor={t.colors.textMuted}
                  maxLength={100}
                />
                <Text style={[styles.charCount, { color: t.colors.textMuted }]}>
                  {title.length}/100
                </Text>
              </View>

              {/* Date */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: t.colors.text }]}>Date *</Text>
                <TouchableOpacity
                  style={[
                    styles.dateButton,
                    {
                      backgroundColor: t.colors.surfaceAlt,
                      borderColor: t.colors.border,
                    },
                  ]}
                  onPress={() => {
                    setShowDatePicker(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons name="calendar-outline" size={20} color={t.colors.text} />
                  <Text style={[styles.dateButtonText, { color: t.colors.text }]}>
                    {dateString || 'Select date'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Time */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: t.colors.text }]}>Time</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: t.colors.surfaceAlt,
                      color: t.colors.text,
                      borderColor: t.colors.border,
                    },
                  ]}
                  value={time}
                  onChangeText={setTime}
                  placeholder="e.g., 9:00 AM or All Day"
                  placeholderTextColor={t.colors.textMuted}
                  maxLength={50}
                />
              </View>

              {/* Description */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: t.colors.text }]}>Description</Text>
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: t.colors.surfaceAlt,
                      color: t.colors.text,
                      borderColor: t.colors.border,
                    },
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter event description (optional)"
                  placeholderTextColor={t.colors.textMuted}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={[styles.charCount, { color: t.colors.textMuted }]}>
                  {description.length}/500
                </Text>
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={[styles.footer, { borderTopColor: t.colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: t.colors.border }]}
                onPress={handleCancel}
                disabled={isCreating}
              >
                <Text style={[styles.cancelButtonText, { color: t.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: eventType === 'Academic' ? '#10B981' : '#2563EB',
                    opacity: isCreating ? 0.6 : 1,
                  },
                ]}
                onPress={handleSave}
                disabled={isCreating || !title.trim()}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Event</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Month Picker Modal */}
      {showDatePicker && selectedDate && (
        <MonthPickerModal
          visible={showDatePicker}
          onClose={() => {
            // Animate out first, then close
            Animated.parallel([
              Animated.spring(monthPickerScaleAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
              }),
              Animated.timing(monthPickerOpacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => {
              setShowDatePicker(false);
            });
          }}
          currentMonth={selectedDate}
          onSelectMonth={handleDateSelect}
          minYear={eventYearRange.minYear}
          maxYear={eventYearRange.maxYear}
          scaleAnim={monthPickerScaleAnim}
          opacityAnim={monthPickerOpacityAnim}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: 400,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeOptionActive: {
    // backgroundColor set dynamically
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AddEventDrawer;

