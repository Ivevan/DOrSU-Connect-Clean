import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import DeleteEventModal from '../../modals/DeleteEventModal';
import MonthPickerModal from '../../modals/MonthPickerModal';
import CalendarService, { CalendarEvent } from '../../services/CalendarService';
import { categoryToColors, formatDateKey, parseAnyDateToKey } from '../../utils/calendarUtils';
import { formatDate } from '../../utils/dateUtils';

// Helper function for compact date formatting (prevents wrapping)
const formatCompactDate = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return '';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  
  // Use shorter format: "Nov 19, 2025" -> "Nov 19" or "Nov 19 '25" for very small screens
  return `${month} ${day}`;
};

// Helper function for compact date range
const formatCompactDateRange = (startDate: Date, endDate: Date): string => {
  const start = formatCompactDate(startDate);
  const end = formatCompactDate(endDate);
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  if (startYear === endYear) {
    return `${start} - ${end}, ${startYear}`;
  }
  return `${start}, ${startYear} - ${end}, ${endYear}`;
};

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
  readOnly?: boolean; // If true, hide edit/delete buttons (for user view)
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
  readOnly = false,
}) => {
  const { theme: t } = useThemeValues();
  const insets = useSafeAreaInsets();
  
  // Responsive design: detect screen width
  const [screenWidth, setScreenWidth] = React.useState(Dimensions.get('window').width);
  const isSmallScreen = screenWidth < 360;
  const isMediumScreen = screenWidth >= 360 && screenWidth < 400;
  
  React.useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);
  
  // Memoize formatted date for performance
  const formattedDate = useMemo(() => {
    if (!selectedEvent) return '';
    if (selectedEvent.dateType === 'date_range' && selectedEvent.startDate && selectedEvent.endDate) {
      return formatCompactDateRange(new Date(selectedEvent.startDate), new Date(selectedEvent.endDate));
    }
    if (selectedEvent.isoDate || selectedEvent.date) {
      const date = new Date(selectedEvent.isoDate || selectedEvent.date);
      return formatCompactDate(date);
    }
    return 'No date';
  }, [selectedEvent?.isoDate, selectedEvent?.date, selectedEvent?.dateType, selectedEvent?.startDate, selectedEvent?.endDate]);
  
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
          {/* Fixed Header Section */}
          <View style={styles.drawerHandle}>
            <View style={[styles.drawerHandleBar, { backgroundColor: t.colors.textMuted }]} />
          </View>
          
          <View style={styles.drawerHeader}>
            <Text style={[styles.drawerTitle, { color: t.colors.text }]}>
              {isEditing && !readOnly ? 'Edit Event' : 'Event Details'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.drawerCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={t.colors.text} />
            </TouchableOpacity>
          </View>
          
          {/* Scrollable Content Section */}
          <ScrollView
            style={styles.drawerScrollView}
            contentContainerStyle={[styles.drawerScrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={true}
            bounces={true}
            keyboardShouldPersistTaps="handled"
          >
              {/* Show event selector if multiple events on this date */}
              {selectedDateEvents && selectedDateEvents.length > 1 && !isEditing ? (
                <View style={styles.drawerEventSelectorSection}>
                  <Text style={[styles.drawerEventSelectorLabel, { color: t.colors.textMuted }]}>
                    MULTIPLE EVENTS ON {selectedDateForDrawer ? formatDate(selectedDateForDrawer).toUpperCase() : 'THIS DATE'}
                  </Text>
                  <View style={styles.drawerEventSelectorContainer}>
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
                </View>
              ) : null}
              
              {selectedEvent ? (
                <View style={styles.drawerContentWrapper}>
                  {/* Event Details Section - All details in one grouped section */}
                  <View style={[styles.drawerDetailsSection, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                    {/* Title Section */}
                    <View style={styles.drawerTitleSection}>
                      {/* Title */}
                      {isEditing && !readOnly ? (
                        <View style={styles.drawerTitleContainer}>
                          <View style={[styles.drawerInputContainer, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
                            <TextInput
                              style={[styles.drawerInput, { color: t.colors.text }]}
                              value={editTitle}
                              onChangeText={setEditTitle}
                              placeholder="Enter event title"
                              placeholderTextColor={t.colors.textMuted}
                              maxLength={100}
                              accessibilityLabel="Event title input"
                              accessibilityHint="Enter or edit the event title"
                            />
                            <Text style={[styles.drawerCharCount, { color: t.colors.textMuted }]}>
                              {editTitle.length}/100
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.drawerTitleContainer}>
                          <Text 
                            style={[styles.drawerEventTitle, { color: t.colors.text }, isSmallScreen && styles.drawerEventTitleSmall]} 
                            numberOfLines={isSmallScreen ? 2 : 3}
                            ellipsizeMode="tail"
                            accessibilityLabel={`Event title: ${selectedEvent.title}`}
                          >
                            {selectedEvent.title}
                          </Text>
                        </View>
                      )}

                      {/* Date, Time, and Category - Subtle text below title */}
                      {isEditing && !readOnly ? (
                        <View style={styles.drawerDateTimeSubtleContainer}>
                          <TouchableOpacity
                            style={styles.drawerDateTimeSubtle}
                            onPress={() => {
                              // Ensure selectedDateObj is set before opening picker
                              if (!selectedDateObj) {
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
                              setTimeout(() => {
                                setShowDatePicker(true);
                              }, 0);
                            }}
                            accessibilityLabel="Select event date"
                            accessibilityHint="Opens date picker to change the event date"
                          >
                            <Ionicons name="calendar-outline" size={13} color={t.colors.textMuted} />
                            <Text style={[styles.drawerDateTimeSubtleText, { color: editDate ? t.colors.textMuted : t.colors.textMuted }]} numberOfLines={1}>
                              {editDate || 'Select date'}
                            </Text>
                          </TouchableOpacity>
                          <View style={styles.drawerDateTimeSubtle}>
                            <Ionicons name="time-outline" size={13} color={t.colors.textMuted} />
                            <TextInput
                              style={[styles.drawerDateTimeSubtleText, styles.drawerDateTimeSubtleInput, { color: t.colors.textMuted }]}
                              value={editTime}
                              onChangeText={setEditTime}
                              placeholder="Time"
                              placeholderTextColor={t.colors.textMuted}
                              accessibilityLabel="Event time input"
                              accessibilityHint="Enter the event time or 'All Day'"
                            />
                          </View>
                        </View>
                      ) : (
                        <View 
                          style={styles.drawerDateTimeSubtle}
                          accessibilityLabel={`Event category, time, and date: ${selectedEvent.category || (selectedEvent as any).type || 'Event'}, ${selectedEvent.time ? ` at ${selectedEvent.time}` : ''}, ${formattedDate}`}
                        >
                          <Ionicons 
                            name="pricetag-outline" 
                            size={13} 
                            color={(selectedEvent as any).color || categoryToColors(selectedEvent.category || (selectedEvent as any).type).dot} 
                          />
                          <Text 
                            style={[
                              styles.drawerDateTimeSubtleText, 
                              { 
                                color: (selectedEvent as any).color || categoryToColors(selectedEvent.category || (selectedEvent as any).type).dot,
                                opacity: 0.8
                              }
                            ]} 
                            numberOfLines={1}
                          >
                            {String(selectedEvent.category || (selectedEvent as any).type || 'Event').charAt(0).toUpperCase() + String(selectedEvent.category || (selectedEvent as any).type || 'Event').slice(1)}
                          </Text>
                          {(selectedEvent.time || selectedEvent.dateType === 'date') && (
                            <>
                              <Text style={[styles.drawerDateTimeSubtleSeparator, { color: t.colors.textMuted }]}>·</Text>
                              <Ionicons name="time-outline" size={13} color={t.colors.textMuted} />
                              <Text 
                                style={[styles.drawerDateTimeSubtleText, { color: t.colors.textMuted }]} 
                                numberOfLines={1}
                              >
                                {selectedEvent.time || 'All Day'}
                              </Text>
                            </>
                          )}
                          <Text style={[styles.drawerDateTimeSubtleSeparator, { color: t.colors.textMuted }]}>·</Text>
                          <Ionicons name="calendar-outline" size={13} color={t.colors.textMuted} />
                          <Text 
                            style={[styles.drawerDateTimeSubtleText, { color: t.colors.textMuted }]} 
                            numberOfLines={1}
                          >
                            {formattedDate}
                          </Text>
                        </View>
                      )}

                      {/* Description - Below Date/Time/Category */}
                      {isEditing && !readOnly ? (
                        <View style={styles.drawerDescriptionInHeader}>
                          <View style={[styles.drawerTextAreaContainer, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
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
                              accessibilityLabel="Event description input"
                              accessibilityHint="Enter or edit the event description"
                            />
                            <Text style={[styles.drawerCharCount, { color: t.colors.textMuted }]}>
                              {editDescription.length}/500
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.drawerDescriptionInHeader}>
                          <View 
                            style={[styles.drawerDescriptionContainer, { backgroundColor: t.colors.card }]}
                            accessibilityLabel={`Event description: ${selectedEvent.description || 'No description provided'}`}
                          >
                            <Text style={[styles.drawerEventDescription, { color: t.colors.text }]}>
                              {selectedEvent.description || 'No description provided'}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                  </View>

                  {/* Attachments/Images */}
                  {(selectedEvent as any).attachments && Array.isArray((selectedEvent as any).attachments) && (selectedEvent as any).attachments.length > 0 && (
                    <View style={styles.drawerSection}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>ATTACHMENTS</Text>
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

          {/* Fixed Action Buttons - Hidden in read-only mode */}
          {selectedEvent && !readOnly && (
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    height: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 24,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  drawerHandle: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  drawerHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.25,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  drawerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  drawerScrollView: {
    flex: 1,
    flexShrink: 1,
  },
  drawerScrollContent: {
    padding: 24,
    paddingTop: 20,
    flexGrow: 1,
  },
  drawerContentWrapper: {
    paddingTop: 4,
  },
  drawerDetailsSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  drawerTitleSection: {
    marginBottom: 12,
  },
  drawerTitleContainer: {
    marginBottom: 4,
  },
  drawerDescriptionInHeader: {
    marginTop: 10,
    alignSelf: 'stretch',
  },
  drawerDateTimeSubtleContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  drawerDateTimeSubtle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  drawerDateTimeSubtleText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    opacity: 0.75,
    letterSpacing: 0.1,
  },
  drawerDateTimeSubtleInput: {
    minWidth: 60,
    maxWidth: 100,
    padding: 0,
    fontSize: 13,
    fontWeight: '500',
  },
  drawerDateTimeSubtleSeparator: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 4,
    opacity: 0.4,
  },
  drawerTopRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  drawerTopRowItem: {
    flex: 1,
    minWidth: 100,
    justifyContent: 'flex-start',
  },
  drawerTopRowItemTitle: {
    flex: 2,
    minWidth: 120,
    justifyContent: 'flex-start',
    paddingRight: 8,
  },
  drawerTopRowItemCompact: {
    flex: 1,
    minWidth: 80,
    maxWidth: 120,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  drawerTopRowItemPill: {
    flex: 1,
    minWidth: 140,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  drawerDateTimePillContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  drawerDateTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  drawerDateTimePillView: {
    borderWidth: 0,
  },
  drawerPillText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  drawerPillTextSmall: {
    fontSize: 12,
    lineHeight: 16,
  },
  drawerPillInput: {
    minWidth: 60,
    maxWidth: 100,
    padding: 0,
  },
  drawerPillSeparator: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 4,
    opacity: 0.5,
  },
  drawerCategoryContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    marginTop: 16,
    width: '100%',
  },
  drawerCategoryContent: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  drawerSection: {
    marginBottom: 28,
  },
  drawerDetailField: {
    marginBottom: 24,
  },
  drawerDetailFieldLast: {
    marginBottom: 0,
  },
  drawerEditField: {
    marginBottom: 28,
  },
  drawerFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  drawerInputContainer: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  drawerInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    lineHeight: 22,
  },
  drawerTextAreaContainer: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 140,
    marginTop: 4,
  },
  drawerTextArea: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    minHeight: 120,
    lineHeight: 22,
  },
  drawerCharCount: {
    fontSize: 11,
    marginTop: 8,
    alignSelf: 'flex-end',
    opacity: 0.6,
  },
  drawerEventTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  drawerEventTitleSmall: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  drawerEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerEventRowCompact: {
    gap: 8,
  },
  drawerEventRowContent: {
    paddingVertical: 4,
  },
  drawerEventIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerEventIconWrapperCompact: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  drawerEventText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
    fontWeight: '500',
  },
  drawerEventTextSmall: {
    fontSize: 13,
    lineHeight: 18,
  },
  drawerCategoryRow: {
    justifyContent: 'flex-end',
  },
  drawerCategoryIconWrapper: {
    width: 32,
    height: 32,
  },
  drawerCategoryText: {
    flex: 0,
    flexShrink: 1,
  },
  drawerDescriptionContainer: {
    borderRadius: 14,
    paddingTop: 14,
    paddingRight: 14,
    paddingBottom: 14,
    paddingLeft: 0,
  },
  drawerEventDescription: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.1,
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    gap: 12,
    zIndex: 10,
  },
  drawerActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    minHeight: 52,
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
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  drawerEventSelectorSection: {
    marginBottom: 32,
  },
  drawerEventSelectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  drawerEventSelectorContainer: {
    gap: 10,
  },
  drawerEventSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    gap: 14,
    minHeight: 56,
  },
  drawerEventSelectorAccent: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  drawerEventSelectorText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
});

export default EventDetailsDrawer;

