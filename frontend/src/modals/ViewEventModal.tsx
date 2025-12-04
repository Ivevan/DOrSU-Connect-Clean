import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../components/common/BottomSheet';
import { useThemeValues } from '../contexts/ThemeContext';
import { categoryToColors, normalizeCategory } from '../utils/calendarUtils';
import { formatDate } from '../utils/dateUtils';

// Helper function to get day name from date
const getDayName = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return '';
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '';
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

// Helper function to check if description exists and has content
const hasDescription = (description: string | undefined | null): boolean => {
  return !!(description && typeof description === 'string' && description.trim().length > 0);
};

interface ViewEventModalProps {
  visible: boolean;
  onClose: () => void;
  selectedEvent: any | null;
  selectedDateEvents?: any[];
  selectedDate?: Date | string | null;
  onEdit?: () => void;
  onDelete?: () => void;
}

const ViewEventModal: React.FC<ViewEventModalProps> = ({
  visible,
  onClose,
  selectedEvent,
  selectedDateEvents = [],
  selectedDate,
  onEdit,
  onDelete,
}) => {
  const { theme } = useThemeValues();
  const insets = useSafeAreaInsets();
  const sheetY = useRef(new Animated.Value(500)).current;
  const [selectedEventFromList, setSelectedEventFromList] = React.useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const deleteModalOpacity = useRef(new Animated.Value(0)).current;

  // Animate sheet when visible changes - optimized for performance
  React.useEffect(() => {
    if (visible) {
      // Use timing instead of spring for faster, smoother animation
      Animated.timing(sheetY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
        // Use easing for smoother feel
      }).start();
    } else {
      Animated.timing(sheetY, {
        toValue: 500,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, sheetY]);

  // Animate delete confirmation modal
  React.useEffect(() => {
    if (showDeleteConfirm) {
      Animated.timing(deleteModalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(deleteModalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [showDeleteConfirm, deleteModalOpacity]);

  const handleDeletePress = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(false);
    if (onDelete) {
      onDelete();
    }
  }, [onDelete]);

  const handleClose = useCallback(() => {
    // Start the close animation
    Animated.timing(sheetY, {
      toValue: 500,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    // Call onClose immediately to update parent state and hide Modal
    // This prevents the black overlay from showing
    onClose();
  }, [sheetY, onClose]);

  // If there are multiple events, show the list; otherwise show single event
  const allEvents = selectedDateEvents.length > 0 ? selectedDateEvents : (selectedEvent ? [selectedEvent] : []);
  
  // Remove duplicate events - same title, category, and time are considered duplicates
  const uniqueEvents = React.useMemo(() => {
    const seen = new Map<string, any>();
    const unique: any[] = [];
    
    allEvents.forEach((event) => {
      const key = `${event.title || ''}_${event.category || event.type || ''}_${event.time || 'All Day'}`.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, event);
        unique.push(event);
      }
    });
    
    return unique;
  }, [allEvents]);
  
  const eventsToShow = uniqueEvents;
  
  // Helper function to check if two events are the same
  const isSameEvent = useCallback((event1: any, event2: any): boolean => {
    if (!event1 || !event2) return false;
    
    // Check by ID first (most reliable)
    if (event1.id && event2.id && event1.id === event2.id) return true;
    if (event1._id && event2._id && event1._id === event2._id) return true;
    
    // Check by title and category/type as fallback
    if (event1.title === event2.title) {
      const cat1 = event1.category || event1.type || '';
      const cat2 = event2.category || event2.type || '';
      if (cat1 === cat2) return true;
    }
    
    return false;
  }, []);
  
  // Use selected event from list if available, otherwise use selectedEvent
  // For multiple events, only show details if one is explicitly selected
  // For single event, always show details
  // Memoize to ensure stable reference and trigger dependent memos correctly
  const primaryEvent = useMemo(() => {
    return selectedEventFromList || selectedEvent || (eventsToShow.length === 1 ? eventsToShow[0] : null);
  }, [selectedEventFromList, selectedEvent, eventsToShow]);
  
  // Reset selected event from list when modal closes
  React.useEffect(() => {
    if (!visible) {
      setSelectedEventFromList(null);
    }
  }, [visible]);
  
  // Auto-select event when modal opens
  React.useEffect(() => {
    if (visible && eventsToShow.length > 1) {
      if (selectedEvent) {
        // If selectedEvent is provided, use it for highlighting
        setSelectedEventFromList(selectedEvent);
      } else if (eventsToShow.length > 0 && !selectedEventFromList) {
        // Otherwise, auto-select first event if nothing is selected
        setSelectedEventFromList(eventsToShow[0]);
      }
    }
  }, [visible, eventsToShow.length, selectedEvent]);

  // Memoize expensive color calculations - MUST be called before any early returns
  const eventColor = useMemo(() => {
    if (!primaryEvent) return '#2563EB'; // Default to Academic Blue
    const category = normalizeCategory(primaryEvent.category || primaryEvent.type || 'Event');
    return primaryEvent.color || categoryToColors(category).dot;
  }, [primaryEvent]);
  
  const eventCategory = useMemo(() => {
    if (!primaryEvent) return 'Event'; // Default category
    return normalizeCategory(primaryEvent.category || primaryEvent.type || 'Event');
  }, [primaryEvent]);

  // Check if there's an image to determine if we should auto-size
  // Memoize to ensure it updates when primaryEvent changes
  // MUST be called before any early returns
  const hasImage = useMemo(() => {
    return !!(primaryEvent?.images?.[0] || primaryEvent?.image);
  }, [primaryEvent]);
  
  // Get image URI - memoized to ensure it updates when primaryEvent changes
  // MUST be called before any early returns
  const imageUri = useMemo(() => {
    return primaryEvent?.images?.[0] || primaryEvent?.image || null;
  }, [primaryEvent]);

  // Create a unique key for the Image component to force remount when event changes
  // MUST be called before any early returns
  // Use event ID as primary key - this ensures remount when switching between events
  const imageKey = useMemo(() => {
    if (!primaryEvent) return null;
    // Use event ID as the key - this will change when we switch events, forcing remount
    const eventId = primaryEvent.id || primaryEvent._id || `${primaryEvent.title}-${primaryEvent.isoDate || primaryEvent.date}`;
    return `event-image-${eventId}`;
  }, [primaryEvent]);

  // Determine if event is from calendar/CSV (only delete) or a post (edit + delete)
  // Calendar events have _id (MongoDB), posts have id
  // Also check source property as fallback
  const isCalendarOrCSVEvent = useMemo(() => {
    if (!primaryEvent) return false;
    
    // Check source property first
    const source = primaryEvent.source;
    if (source === 'calendar' || source === 'CSV Upload' || source === 'csv') {
      return true;
    }
    
    // Check if it has _id (MongoDB ID) - indicates calendar event
    if (primaryEvent._id) {
      return true;
    }
    
    // If it has id but no _id, it's likely a post
    // Posts have id property, calendar events have _id
    return false;
  }, [primaryEvent]);

  // Early return after all hooks have been called
  if (!visible || (!selectedEvent && selectedDateEvents.length === 0)) {
    return null;
  }

  // Ensure we have a primary event to display
  if (!primaryEvent) {
    return null;
  }

  // Shared content component to avoid duplication
  const renderEventContent = () => (
    <>
      {/* Multiple Events List */}
      {eventsToShow.length > 1 && (
        <View style={styles.eventsListContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
            {eventsToShow.length} {eventsToShow.length === 1 ? 'Event' : 'Events'} on this date
          </Text>
          {eventsToShow.map((event, index) => {
            const normalizedEventCategory = normalizeCategory(event.category || event.type || 'Event');
            const eventColor = event.color || categoryToColors(normalizedEventCategory).dot;
            // Check if this event is selected - prioritize selectedEventFromList, then selectedEvent, then primaryEvent
            const isSelected = selectedEventFromList 
              ? isSameEvent(selectedEventFromList, event)
              : selectedEvent 
                ? isSameEvent(selectedEvent, event)
                : primaryEvent 
                  ? isSameEvent(primaryEvent, event)
                  : false;
            return (
              <TouchableOpacity
                key={event.id || index}
                style={[styles.eventItem, { 
                  backgroundColor: isSelected ? eventColor + '10' : theme.colors.surface,
                  borderColor: isSelected ? eventColor : theme.colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                }]}
                onPress={() => setSelectedEventFromList(event)}
                activeOpacity={0.7}
              >
                <View style={[styles.eventAccent, { backgroundColor: eventColor }]} />
                <View style={styles.eventItemContent}>
                  <Text style={[styles.eventItemTitle, { color: theme.colors.text }]} numberOfLines={2} ellipsizeMode="tail">
                    {event.title}
                  </Text>
                  {/* Date Range (if applicable) */}
                  {(event.startDate && event.endDate) && (
                    <View style={styles.eventItemDateRangeContainer}>
                      <View style={styles.eventItemDateRange}>
                        <Ionicons name="calendar-outline" size={10} color={eventColor} />
                        <Text style={[styles.eventItemDateRangeText, { color: eventColor }]}>
                          Date: {getDayName(event.startDate)}, {formatDate(new Date(event.startDate))}
                    </Text>
                      </View>
                      <View style={[styles.eventItemDateRange, { marginTop: 2 }]}>
                        <Ionicons name="calendar-outline" size={10} color={eventColor} />
                        <Text style={[styles.eventItemDateRangeText, { color: eventColor }]}>
                          End Date: {getDayName(event.endDate)}, {formatDate(new Date(event.endDate))}
                      </Text>
                    </View>
                  </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Single Event Details - Show when there's a primary event */}
      {primaryEvent && (
        <View style={styles.eventDetails}>
          {/* Image (if available) - key forces remount when event changes */}
          {imageUri ? (
            <Image
              key={imageKey || `image-${primaryEvent?.id || primaryEvent?._id || 'default'}`}
              source={{ uri: imageUri }}
              style={styles.eventImage}
              resizeMode="cover"
              onError={(error) => {
                console.error('Image load error:', error.nativeEvent.error);
              }}
            />
          ) : null}

          {/* Title Section with Category Badge and Date/Time */}
          <View style={styles.titleSection}>
            <Text style={[styles.eventTitle, { color: theme.colors.text }]} numberOfLines={2}>
            {primaryEvent.title || 'Untitled Event'}
          </Text>
            <View style={styles.titleMetaRow}>
              {/* Date and Time as Subtle Text */}
              <View style={styles.dateTimeContainer}>
                <View style={styles.dateTimeRow}>
                  <Ionicons name="calendar-outline" size={12} color={eventColor} />
                  <Text style={[styles.dateTimeText, { color: eventColor }]}>
                    {primaryEvent.isoDate || primaryEvent.date
                      ? `${getDayName(primaryEvent.isoDate || primaryEvent.date)}, ${formatDate(new Date(primaryEvent.isoDate || primaryEvent.date))}`
                      : 'Not specified'}
                  </Text>
                </View>
                <View style={[styles.dateTimeRow, { marginBottom: 0 }]}>
                  <Ionicons name="time-outline" size={12} color={eventColor} />
                  <Text style={[styles.dateTimeText, { color: eventColor }]}>
                    {primaryEvent.time && primaryEvent.time.trim() ? primaryEvent.time : 'All Day'}
                  </Text>
                </View>
              </View>
          {/* Category Badge */}
          <View style={[styles.categoryBadge, { backgroundColor: eventColor + '20', borderColor: eventColor + '40' }]}>
            <Ionicons name="pricetag-outline" size={11} color={eventColor} />
            <Text style={[styles.categoryBadgeText, { color: eventColor }]}>
              {eventCategory}
            </Text>
          </View>
              </View>
            {/* Date Range (if applicable) */}
            {primaryEvent.startDate && primaryEvent.endDate && (
              <View style={styles.dateTimeContainer}>
                <View style={styles.dateTimeRow}>
                  <Ionicons name="calendar-outline" size={12} color={eventColor} />
                  <Text style={[styles.dateTimeText, { color: eventColor }]}>
                    Date: {getDayName(primaryEvent.startDate)}, {formatDate(new Date(primaryEvent.startDate))}
                </Text>
              </View>
                <View style={[styles.dateTimeRow, { marginBottom: 0 }]}>
                  <Ionicons name="calendar-outline" size={12} color={eventColor} />
                  <Text style={[styles.dateTimeText, { color: eventColor }]}>
                    End Date: {getDayName(primaryEvent.endDate)}, {formatDate(new Date(primaryEvent.endDate))}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Description - Only show if description exists and has content */}
          {hasDescription(primaryEvent.description) && (
            <View style={[styles.descriptionContainer, {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            }]}>
              <View style={styles.descriptionHeader}>
                <Ionicons name="document-text-outline" size={14} color={eventColor} />
                <Text style={[styles.descriptionLabel, { color: theme.colors.textMuted }]}>Description</Text>
              </View>
              <Text style={[styles.descriptionText, { color: theme.colors.text }]}>
                {primaryEvent.description?.trim()}
              </Text>
            </View>
          )}
        </View>
      )}
    </>
  );
  
  return (
    <>
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      sheetY={sheetY}
      maxHeight="90%"
      backgroundColor={theme.colors.card}
      autoSize={!hasImage}
      sheetPaddingBottom={hasImage ? undefined : (onEdit || onDelete ? Math.max(insets.bottom, 12) : 0)}
    >
      <View style={[
        styles.container, 
        !hasImage && styles.containerAutoSize,
        !hasImage && (onEdit || onDelete) && styles.containerWithActions
      ]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Event Details</Text>
            {/* Selected Date Indicator */}
            {selectedDate && primaryEvent && (
              <View style={[styles.selectedDateIndicator, { backgroundColor: eventColor + '15', borderColor: eventColor + '30' }]}>
                <Ionicons name="calendar" size={11} color={eventColor} />
                <Text style={[styles.selectedDateIndicatorText, { color: eventColor }]}>
                  {getDayName(selectedDate)}, {formatDate(typeof selectedDate === 'string' ? new Date(selectedDate) : selectedDate)}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {hasImage ? (
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              (onEdit || onDelete) && { paddingBottom: 12 }
            ]}
            removeClippedSubviews={true}
            scrollEventThrottle={16}
          >
            {renderEventContent()}
          </ScrollView>
        ) : (
          <View style={[
            styles.scrollContent, 
            styles.contentContainer,
            (onEdit || onDelete) && styles.contentWithActions
          ]}>
            {renderEventContent()}
          </View>
        )}

        {/* Action Buttons - Outside ScrollView */}
        {/* Show only delete for calendar/CSV events, show both edit and delete for posts */}
        {onDelete && (
          <View style={styles.actionsContainer}>
            {/* Show Edit button only for posts (not calendar/CSV events) */}
            {onEdit && !isCalendarOrCSVEvent && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                onPress={onEdit}
              >
                <Ionicons name="create-outline" size={14} color="#fff" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
            {/* Show Delete button for all event types */}
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.deleteButton, 
                { backgroundColor: '#DC2626' },
                // If only delete button, make it full width
                isCalendarOrCSVEvent && !onEdit && { flex: 1 }
              ]}
              onPress={handleDeletePress}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={14} color="#fff" />
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <View style={styles.deleteModalOverlay} pointerEvents="box-none">
          <TouchableOpacity 
            style={styles.deleteModalBackdrop} 
            activeOpacity={1} 
            onPress={handleDeleteCancel}
          />
          <Animated.View 
            style={[
              styles.deleteModalContainer,
              {
                opacity: deleteModalOpacity,
                transform: [{
                  scale: deleteModalOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                }],
              }
            ]}
          >
            <View style={[styles.deleteModalContent, { backgroundColor: theme.colors.card }]}>
              <View style={[styles.deleteModalIconWrapper, { backgroundColor: '#DC2626' + '15' }]}>
                <Ionicons name="trash" size={32} color="#DC2626" />
              </View>
              <Text style={[styles.deleteModalTitle, { color: theme.colors.text }]}>Delete Event</Text>
              <Text style={[styles.deleteModalMessage, { color: theme.colors.textMuted }]}>
                Are you sure you want to delete "{primaryEvent?.title || 'this event'}"?
              </Text>
              <View style={styles.deleteModalActions}>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalCancelButton, { 
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  }]}
                  onPress={handleDeleteCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.deleteModalCancelText, { color: theme.colors.text }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalConfirmButton, { backgroundColor: '#DC2626' }]}
                  onPress={handleDeleteConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteModalConfirmText}>DELETE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  bottomSheetContent: {
    flex: 1,
  },
  container: {
    flex: 1,
    minHeight: 200,
  },
  containerAutoSize: {
    flex: 0,
    minHeight: 0,
  },
  containerWithActions: {
    // Ensure container accounts for button height (button ~40px + padding ~20px)
    minHeight: 70,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    flexShrink: 0,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },
  scrollContentAutoSize: {
    paddingBottom: 12,
  },
  contentContainer: {
    width: '100%',
  },
  contentWithActions: {
    paddingBottom: 4,
  },
  eventsListContainer: {
    marginBottom: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    opacity: 0.7,
  },
  eventItem: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
    overflow: 'hidden',
    minHeight: 44,
    width: '100%',
  },
  eventAccent: {
    width: 4,
    flexShrink: 0,
  },
  eventItemContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    minWidth: 0,
  },
  eventItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'left',
    flexShrink: 1,
    width: '100%',
    marginBottom: 4,
  },
  eventItemDateRangeContainer: {
    marginTop: 4,
  },
  eventItemDateRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  eventItemDateRangeText: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.85,
    flexShrink: 1,
  },
  eventDetails: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  titleSection: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.3,
    textAlign: 'left',
    marginBottom: 8,
  },
  selectedDateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  selectedDateIndicatorText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  titleMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
    flexShrink: 0,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dateTimeContainer: {
    flex: 1,
    flexShrink: 1,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  dateTimeText: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    opacity: 0.85,
  },
  dateTimeSeparator: {
    fontSize: 12,
    fontWeight: '400',
    marginHorizontal: 2,
    opacity: 0.7,
  },
  descriptionContainer: {
    marginTop: 16,
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 20,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  descriptionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.8,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
    textAlign: 'left',
    letterSpacing: 0.1,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    flexShrink: 0,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButton: {
    // Additional styles for delete button if needed
  },
  // Delete Confirmation Modal Styles
  deleteModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  deleteModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  deleteModalContainer: {
    width: '85%',
    maxWidth: 400,
    zIndex: 1001,
  },
  deleteModalContent: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
  },
  deleteModalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  deleteModalMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
  },
  deleteModalCancelButton: {
    borderWidth: 1.5,
  },
  deleteModalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  deleteModalConfirmButton: {
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  deleteModalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default ViewEventModal;
