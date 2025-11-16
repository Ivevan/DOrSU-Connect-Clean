import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, Alert, Animated, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import DeleteEventModal from '../../modals/DeleteEventModal';
import MonthPickerModal from '../../modals/MonthPickerModal';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import { categoryToColors, formatDateKey, parseAnyDateToKey } from '../../utils/calendarUtils';
import { formatDate } from '../../utils/dateUtils';

interface EventDetailsDrawerProps {
  visible: boolean;
  onClose: () => void;
  selectedEvent: CalendarEvent | null;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  editTitle: string;
  setEditTitle: (title: string) => void;
  editDescription: string;
  setEditDescription: (description: string) => void;
  editDate: string;
  setEditDate: (date: string) => void;
  editTime: string;
  setEditTime: (time: string) => void;
  selectedDateObj: Date | null;
  setSelectedDateObj: (date: Date | null) => void;
  showDatePicker: boolean;
  setShowDatePicker: (show: boolean) => void;
  isDeleting: boolean;
  setIsDeleting: (deleting: boolean) => void;
  isUpdating: boolean;
  setIsUpdating: (updating: boolean) => void;
  selectedDateEvents: any[];
  selectedDateForDrawer: Date | null;
  calendarEvents: CalendarEvent[];
  refreshCalendarEvents: () => Promise<void>;
  slideAnim: Animated.Value;
  backdropOpacity: Animated.Value;
  monthPickerScaleAnim: Animated.Value;
  monthPickerOpacityAnim: Animated.Value;
  onSelectEvent?: (event: CalendarEvent) => void;
}

const EventDetailsDrawer: React.FC<EventDetailsDrawerProps> = ({
  visible,
  onClose,
  selectedEvent,
  isEditing,
  setIsEditing,
  editTitle,
  setEditTitle,
  editDescription,
  setEditDescription,
  editDate,
  setEditDate,
  editTime,
  setEditTime,
  selectedDateObj,
  setSelectedDateObj,
  showDatePicker,
  setShowDatePicker,
  isDeleting,
  setIsDeleting,
  isUpdating,
  setIsUpdating,
  selectedDateEvents,
  selectedDateForDrawer,
  calendarEvents,
  refreshCalendarEvents,
  slideAnim,
  backdropOpacity,
  monthPickerScaleAnim,
  monthPickerOpacityAnim,
  onSelectEvent,
}) => {
  const { theme: t } = useThemeValues();
  const insets = useSafeAreaInsets();
  
  // Delete modal state and animations
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const deleteModalSlideAnim = React.useRef(new Animated.Value(0)).current;
  const deleteModalBackdropOpacity = React.useRef(new Animated.Value(0)).current;

  // Animate month picker when it opens/closes
  React.useEffect(() => {
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

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (selectedEvent) {
      setEditTitle(selectedEvent.title || '');
      setEditDescription(selectedEvent.description || '');
      if (selectedEvent?.isoDate || selectedEvent?.date) {
        const eventDate = new Date(selectedEvent.isoDate || selectedEvent.date);
        setSelectedDateObj(eventDate);
        setEditDate(formatDate(eventDate));
      } else {
        setSelectedDateObj(null);
        setEditDate('');
      }
      setEditTime(selectedEvent?.time || '');
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedEvent?._id) {
      Alert.alert('Error', 'Cannot update event: missing event ID');
      return;
    }
    if (!editTitle.trim()) {
      Alert.alert('Validation Error', 'Title is required');
      return;
    }
    if (!editDate && !selectedDateObj) {
      Alert.alert('Validation Error', 'Date is required');
      return;
    }
    
    setIsUpdating(true);
    try {
      const isoDate = selectedDateObj ? selectedDateObj.toISOString() : (selectedEvent.isoDate || selectedEvent.date);
      
      const updated = await CalendarService.updateEvent(selectedEvent._id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        date: editDate,
        isoDate: isoDate,
        time: editTime.trim() || 'All Day',
      });
      
      if (updated) {
        // Refresh calendar events first
        await refreshCalendarEvents();
        
        // Update the selected event with the new data so it displays immediately
        if (onSelectEvent) {
          onSelectEvent(updated);
        }
        
        setIsEditing(false);
        Alert.alert('Success', 'Event updated successfully');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', 'Failed to update event');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('Failed to update event:', error);
      Alert.alert('Error', 'Failed to update event');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Show delete confirmation modal
  const handleDelete = () => {
    console.log('🗑️ handleDelete called', { selectedEvent: selectedEvent?._id, hasSelectedEvent: !!selectedEvent });
    
    if (!selectedEvent) {
      console.warn('⚠️ handleDelete: No selected event');
      return;
    }
    
    console.log('🗑️ Showing delete confirmation modal');
    setShowDeleteModal(true);
    
    // Animate modal in
    Animated.parallel([
      Animated.spring(deleteModalSlideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(deleteModalBackdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Close delete modal
  const handleCloseDeleteModal = () => {
    Animated.parallel([
      Animated.spring(deleteModalSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(deleteModalBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowDeleteModal(false);
    });
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    console.log('✅ Delete confirmed in modal, starting deletion process', { eventId: selectedEvent?._id });
    
    if (!selectedEvent || !selectedEvent._id) {
      console.error('❌ Delete failed: Missing event ID');
      Alert.alert('Error', 'Cannot delete event: missing event ID');
      handleCloseDeleteModal();
      return;
    }
    
    try {
      console.log('🔄 Setting isDeleting to true');
      setIsDeleting(true);
      
      console.log('📤 Calling CalendarService.deleteEvent', { eventId: selectedEvent._id });
      const deleted = await CalendarService.deleteEvent(selectedEvent._id);
      console.log('📥 CalendarService.deleteEvent response', { deleted });
      
      if (deleted) {
        console.log('✅ Event deleted successfully, refreshing calendar');
        // Refresh calendar events first to update the grid and list
        await refreshCalendarEvents();
        
        // Clear the selected event so it doesn't show stale data
        if (onSelectEvent) {
          console.log('🧹 Clearing selected event');
          onSelectEvent(null as any); // Clear selected event
        }
        
        // Close delete modal
        handleCloseDeleteModal();
        
        // Close the drawer
        console.log('🚪 Closing drawer');
        onClose();
        
        // Show success message
        Alert.alert('Success', 'Event deleted successfully');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        console.error('❌ Delete failed: CalendarService returned false');
        Alert.alert('Error', 'Failed to delete event. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('❌ Failed to delete event:', error);
      Alert.alert('Error', 'Failed to delete event. Please check your connection and try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      console.log('🔄 Setting isDeleting to false');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="none"
        onRequestClose={onClose}
      >
        <Animated.View
          style={[
            styles.drawerOverlay,
            {
              opacity: backdropOpacity,
            }
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>
        
        <Animated.View
          style={[
            styles.drawerContentContainer,
            {
              backgroundColor: t.colors.card,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [600, 0],
                  }),
                },
              ],
            }
          ]}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.drawerHandle}>
              <View style={[styles.drawerHandleBar, { backgroundColor: t.colors.textMuted }]} />
            </View>
            
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: t.colors.text }]}>
                {isEditing ? 'Edit Event' : 'Event Details'}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.drawerCloseButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={t.colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView
              style={styles.drawerScrollView}
              contentContainerStyle={[styles.drawerScrollContent, { paddingBottom: 20 }]}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >
              {/* Show event selector if multiple events on this date */}
              {selectedDateEvents && selectedDateEvents.length > 1 && !isEditing ? (
                <View style={styles.drawerSection}>
                  <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>
                    Multiple events on {selectedDateForDrawer ? formatDate(selectedDateForDrawer) : 'this date'}
                  </Text>
                  {selectedDateEvents.map((event: any, index: number) => {
                    const fullEvent = calendarEvents.find((e: any) => 
                      e._id === event.id || 
                      `calendar-${e.isoDate}-${e.title}` === event.id ||
                      (parseAnyDateToKey(e.isoDate || e.date) === formatDateKey(selectedDateForDrawer || new Date()) && e.title === event.title)
                    ) || event;
                    const isSelected = selectedEvent && (selectedEvent._id === fullEvent._id || selectedEvent.title === fullEvent.title);
                    
                    return (
                      <TouchableOpacity
                        key={event.id || index}
                        style={[
                          styles.drawerEventSelector,
                          { 
                            backgroundColor: isSelected ? t.colors.surfaceAlt : t.colors.surface,
                            borderColor: isSelected ? t.colors.accent : t.colors.border,
                          }
                        ]}
                        onPress={() => {
                          if (onSelectEvent) {
                            onSelectEvent(fullEvent);
                          }
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.drawerEventSelectorAccent, { backgroundColor: (event as any).color || categoryToColors((event as any).type).dot }]} />
                        <Text style={[styles.drawerEventSelectorText, { color: t.colors.text }]} numberOfLines={1}>
                          {event.title}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={t.colors.accent} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
              
              {selectedEvent ? (
                <View>
                  {/* Title */}
                  {isEditing ? (
                    <View style={styles.drawerEditField}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.text }]}>Title *</Text>
                      <View style={[styles.drawerInputContainer, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                        <TextInput
                          style={[styles.drawerInput, { color: t.colors.text }]}
                          value={editTitle}
                          onChangeText={setEditTitle}
                          placeholder="Enter event title"
                          placeholderTextColor={t.colors.textMuted}
                          maxLength={100}
                        />
                        <Text style={[styles.drawerCharCount, { color: t.colors.textMuted }]}>
                          {editTitle.length}/100
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.drawerSection}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>Title</Text>
                      <Text style={[styles.drawerEventTitle, { color: t.colors.text }]}>
                        {selectedEvent.title}
                      </Text>
                    </View>
                  )}

                  {/* Date */}
                  {isEditing ? (
                    <View style={styles.drawerEditField}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.text }]}>Date *</Text>
                      <TouchableOpacity
                        style={[styles.drawerInputContainer, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
                        onPress={() => {
                          // Ensure selectedDateObj is set before opening picker
                          if (!selectedDateObj) {
                            // Try to parse from editDate, or use selectedEvent date, or default to today
                            let initialDate: Date;
                            if (editDate) {
                              const parsed = new Date(editDate);
                              if (!isNaN(parsed.getTime())) {
                                initialDate = parsed;
                              } else {
                                initialDate = selectedEvent?.isoDate || selectedEvent?.date 
                                  ? new Date(selectedEvent.isoDate || selectedEvent.date)
                                  : new Date();
                              }
                            } else {
                              initialDate = selectedEvent?.isoDate || selectedEvent?.date 
                                ? new Date(selectedEvent.isoDate || selectedEvent.date)
                                : new Date();
                            }
                            setSelectedDateObj(initialDate);
                            if (!editDate) {
                              setEditDate(formatDate(initialDate));
                            }
                          }
                          // Use setTimeout to ensure state updates are processed before opening
                          setTimeout(() => {
                            setShowDatePicker(true);
                          }, 0);
                        }}
                      >
                        <Text style={[styles.drawerInput, { color: editDate ? t.colors.text : t.colors.textMuted }]}>
                          {editDate || 'Select date'}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color={t.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.drawerSection}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>Date</Text>
                      <View style={styles.drawerEventRow}>
                        <Ionicons name="calendar-outline" size={18} color={t.colors.textMuted} />
                        <Text style={[styles.drawerEventText, { color: t.colors.text }]}>
                          {selectedEvent.dateType === 'date_range' && selectedEvent.startDate && selectedEvent.endDate
                            ? `${formatDate(new Date(selectedEvent.startDate))} - ${formatDate(new Date(selectedEvent.endDate))}`
                            : selectedEvent.isoDate || selectedEvent.date
                            ? formatDate(new Date(selectedEvent.isoDate || selectedEvent.date))
                            : 'No date specified'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Time */}
                  {isEditing ? (
                    <View style={styles.drawerEditField}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.text }]}>Time</Text>
                      <View style={[styles.drawerInputContainer, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                        <TextInput
                          style={[styles.drawerInput, { color: t.colors.text }]}
                          value={editTime}
                          onChangeText={setEditTime}
                          placeholder="e.g., 9:00 AM - 5:00 PM or All Day"
                          placeholderTextColor={t.colors.textMuted}
                        />
                        <Ionicons name="time-outline" size={20} color={t.colors.textMuted} />
                      </View>
                    </View>
                  ) : (
                    (selectedEvent.time || selectedEvent.dateType === 'date') && (
                      <View style={styles.drawerSection}>
                        <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>Time</Text>
                        <View style={styles.drawerEventRow}>
                          <Ionicons name="time-outline" size={18} color={t.colors.textMuted} />
                          <Text style={[styles.drawerEventText, { color: t.colors.text }]}>
                            {selectedEvent.time || 'All Day'}
                          </Text>
                        </View>
                      </View>
                    )
                  )}

                  {/* Category */}
                  <View style={styles.drawerSection}>
                    <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>Category</Text>
                    <View style={styles.drawerEventRow}>
                      <Ionicons name="pricetag-outline" size={18} color={(selectedEvent as any).color || categoryToColors(selectedEvent.category || (selectedEvent as any).type).dot} />
                      <Text style={[styles.drawerEventText, { color: (selectedEvent as any).color || categoryToColors(selectedEvent.category || (selectedEvent as any).type).dot }]}>
                        {String(selectedEvent.category || (selectedEvent as any).type || 'Event').charAt(0).toUpperCase() + String(selectedEvent.category || (selectedEvent as any).type || 'Event').slice(1)}
                      </Text>
                    </View>
                  </View>

                  {/* Description */}
                  {isEditing ? (
                    <View style={styles.drawerEditField}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.text }]}>Description</Text>
                      <View style={[styles.drawerTextAreaContainer, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                        <TextInput
                          style={[styles.drawerTextArea, { color: t.colors.text }]}
                          value={editDescription}
                          onChangeText={setEditDescription}
                          placeholder="Enter event description"
                          placeholderTextColor={t.colors.textMuted}
                          multiline
                          numberOfLines={6}
                          textAlignVertical="top"
                          maxLength={500}
                        />
                        <Text style={[styles.drawerCharCount, { color: t.colors.textMuted }]}>
                          {editDescription.length}/500
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.drawerSection}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>Description</Text>
                      <Text style={[styles.drawerEventDescription, { color: t.colors.text }]}>
                        {selectedEvent.description || 'No description provided'}
                      </Text>
                    </View>
                  )}

                  {/* Attachments/Images */}
                  {(selectedEvent as any).attachments && Array.isArray((selectedEvent as any).attachments) && (selectedEvent as any).attachments.length > 0 && (
                    <View style={styles.drawerSection}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>Attachments</Text>
                      <View style={styles.drawerAttachmentsContainer}>
                        {(selectedEvent as any).attachments.map((attachment: any, index: number) => (
                          <View key={index} style={[styles.drawerAttachmentItem, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                            {attachment.type?.startsWith('image/') ? (
                              <Image
                                source={{ uri: attachment.url || attachment }}
                                style={styles.drawerAttachmentImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.drawerAttachmentIcon}>
                                <Ionicons name="document-outline" size={24} color={t.colors.textMuted} />
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.drawerEmptyState}>
                  <Text style={[styles.drawerEmptyText, { color: t.colors.textMuted }]}>
                    No event selected
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            {selectedEvent && (
              <View 
                style={[
                  styles.drawerActions, 
                  { 
                    backgroundColor: t.colors.card, 
                    borderTopColor: t.colors.border, 
                    paddingBottom: insets.bottom + 20,
                  }
                ]}
                pointerEvents="box-none"
              >
                {isEditing ? (
                  <>
                    <TouchableOpacity
                      style={[styles.drawerActionButton, styles.drawerCancelButton, { borderColor: t.colors.border }]}
                      onPress={handleCancelEdit}
                      disabled={isUpdating}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.drawerActionButtonText, { color: t.colors.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.drawerActionButton, styles.drawerSaveButton, { backgroundColor: t.colors.accent }]}
                      onPress={handleSaveEdit}
                      disabled={isUpdating}
                      activeOpacity={0.7}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.drawerActionButtonText, { color: '#FFFFFF' }]}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.drawerActionButton, styles.drawerDeleteButton, { backgroundColor: '#DC2626' }]}
                      onPress={() => {
                        console.log('🔴 Delete button pressed!');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        handleDelete();
                      }}
                      disabled={isDeleting}
                      activeOpacity={0.7}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                          <Text style={[styles.drawerActionButtonText, { color: '#FFFFFF' }]}>Delete</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.drawerActionButton, styles.drawerEditButton, { backgroundColor: t.colors.accent }]}
                      onPress={() => {
                        setIsEditing(true);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                      <Text style={[styles.drawerActionButtonText, { color: '#FFFFFF' }]}>Edit</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </Modal>

      {/* Date Picker Modal for Event Editing */}
      {showDatePicker && selectedDateObj && (
        <MonthPickerModal
          visible={showDatePicker}
          currentMonth={selectedDateObj}
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            });
          }}
          onSelectMonth={(monthIndex, year, day) => {
            if (year !== undefined) {
              try {
                // Use provided day, or fall back to current day, or 1
                const selectedDay = day !== undefined ? day : (selectedDateObj ? selectedDateObj.getDate() : 1);
                const maxDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                const newDay = Math.min(selectedDay, maxDaysInMonth);
                const newDate = new Date(year, monthIndex, newDay);
                
                setSelectedDateObj(newDate);
                setEditDate(formatDate(newDate));
                
                // Animate out before closing
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
                  Haptics.selectionAsync();
                });
              } catch (error) {
                console.error('Error selecting date:', error);
                // Animate out on error too
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
              }
            }
          }}
          scaleAnim={monthPickerScaleAnim}
          opacityAnim={monthPickerOpacityAnim}
          minYear={2020}
          maxYear={2030}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteEventModal
        visible={showDeleteModal}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteConfirm}
        eventTitle={selectedEvent?.title || ''}
        isDeleting={isDeleting}
        slideAnim={deleteModalSlideAnim}
        backdropOpacity={deleteModalBackdropOpacity}
      />
    </>
  );
};

const styles = StyleSheet.create({
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawerContentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  drawerHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  drawerHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  drawerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  drawerScrollView: {
    flex: 1,
  },
  drawerScrollContent: {
    padding: 20,
    paddingTop: 16,
  },
  drawerSection: {
    marginBottom: 20,
  },
  drawerEditField: {
    marginBottom: 20,
  },
  drawerFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  drawerInputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  drawerTextAreaContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 120,
  },
  drawerTextArea: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    minHeight: 100,
  },
  drawerCharCount: {
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  drawerEventTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  drawerEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  drawerEventText: {
    fontSize: 14,
    flex: 1,
  },
  drawerEventDescription: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  drawerAttachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  drawerAttachmentItem: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAttachmentImage: {
    width: '100%',
    height: '100%',
  },
  drawerAttachmentIcon: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  drawerEmptyText: {
    fontSize: 14,
  },
  drawerActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    zIndex: 10,
  },
  drawerActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    minHeight: 48,
    zIndex: 11,
  },
  drawerDeleteButton: {
    backgroundColor: '#DC2626',
  },
  drawerEditButton: {
    backgroundColor: '#2563EB',
  },
  drawerSaveButton: {
    backgroundColor: '#10B981',
  },
  drawerCancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  drawerActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  drawerEventSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  drawerEventSelectorAccent: {
    width: 3,
    height: 24,
    borderRadius: 2,
  },
  drawerEventSelectorText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default EventDetailsDrawer;

