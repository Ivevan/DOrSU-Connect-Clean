import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Image, InteractionManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../components/common/BottomSheet';
import { useThemeValues } from '../contexts/ThemeContext';
import { categoryToColors } from '../utils/calendarUtils';
import { formatDate } from '../utils/dateUtils';

interface ViewEventModalProps {
  visible: boolean;
  onClose: () => void;
  selectedEvent: any | null;
  selectedDateEvents?: any[];
  onEdit?: () => void;
  onDelete?: () => void;
}

const ViewEventModal: React.FC<ViewEventModalProps> = ({
  visible,
  onClose,
  selectedEvent,
  selectedDateEvents = [],
  onEdit,
  onDelete,
}) => {
  const { theme } = useThemeValues();
  const insets = useSafeAreaInsets();
  const sheetY = useRef(new Animated.Value(500)).current;
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const deleteConfirmSheetY = useRef(new Animated.Value(300)).current;

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
      Animated.timing(deleteConfirmSheetY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(deleteConfirmSheetY, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showDeleteConfirm, deleteConfirmSheetY]);

  const handleDeletePress = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    Animated.timing(deleteConfirmSheetY, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      InteractionManager.runAfterInteractions(() => {
        setShowDeleteConfirm(false);
      });
    });
  }, [deleteConfirmSheetY]);

  const handleDeleteConfirm = useCallback(() => {
    if (onDelete) {
      onDelete();
    }
    Animated.timing(deleteConfirmSheetY, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      InteractionManager.runAfterInteractions(() => {
        setShowDeleteConfirm(false);
      });
    });
  }, [onDelete, deleteConfirmSheetY]);

  const handleClose = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: 500,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Defer state update to avoid React warning about scheduling updates during render
      // Use InteractionManager to ensure update happens after interactions complete
      InteractionManager.runAfterInteractions(() => {
        onClose();
      });
    });
  }, [sheetY, onClose]);

  // If there are multiple events, show the list; otherwise show single event
  const allEvents = selectedDateEvents.length > 0 ? selectedDateEvents : (selectedEvent ? [selectedEvent] : []);
  
  // Remove duplicate events - same title, category, and time are considered duplicates
  // IMPORTANT: This hook must be called before any early returns to follow Rules of Hooks
  const uniqueEvents = React.useMemo(() => {
    const seen = new Map<string, any>();
    const unique: any[] = [];
    
    allEvents.forEach((event) => {
      // Create a unique key based on title, category/type, and time
      const key = `${event.title || ''}_${event.category || event.type || ''}_${event.time || 'All Day'}`.toLowerCase();
      
      if (!seen.has(key)) {
        seen.set(key, event);
        unique.push(event);
      }
    });
    
    return unique;
  }, [allEvents]);
  
  const eventsToShow = uniqueEvents;
  const primaryEvent = selectedEvent || eventsToShow[0] || null;

  // Memoize expensive color calculations - MUST be called before any early returns
  const eventColor = useMemo(() => {
    if (!primaryEvent) return '#93C5FD'; // Default color
    return primaryEvent.color || categoryToColors(primaryEvent.category || primaryEvent.type || 'Event').dot;
  }, [primaryEvent?.color, primaryEvent?.category, primaryEvent?.type]);
  
  const eventCategory = useMemo(() => {
    if (!primaryEvent) return 'Event'; // Default category
    return primaryEvent.category || primaryEvent.type || 'Event';
  }, [primaryEvent?.category, primaryEvent?.type]);

  // Early return after all hooks have been called
  if (!visible || (!selectedEvent && selectedDateEvents.length === 0)) {
    return null;
  }

  // Ensure we have a primary event to display
  if (!primaryEvent) {
    return null;
  }

  // Check if there's an image to determine if we should auto-size
  const hasImage = !!(primaryEvent?.images?.[0] || primaryEvent?.image);

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
            const eventColor = event.color || categoryToColors(event.category || event.type || 'Event').dot;
            return (
              <TouchableOpacity
                key={event.id || index}
                style={[styles.eventItem, { 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                }]}
              >
                <View style={[styles.eventAccent, { backgroundColor: eventColor }]} />
                <View style={styles.eventItemContent}>
                  <Text style={[styles.eventItemTitle, { color: theme.colors.text }]} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <View style={styles.eventItemMeta}>
                    <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                    <Text style={[styles.eventItemTime, { color: theme.colors.textMuted }]}>
                      {event.time && event.time.trim() ? event.time : 'All Day'}
                    </Text>
                    <View style={[styles.eventItemCategory, { backgroundColor: eventColor + '20' }]}>
                      <Text style={[styles.eventItemCategoryText, { color: eventColor }]}>
                        {event.category || event.type || 'Event'}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Single Event Details */}
      {primaryEvent && (
        <View style={styles.eventDetails}>
          {/* Image (if available) */}
          {(primaryEvent.images?.[0] || primaryEvent.image) && (
            <Image
              source={{ uri: primaryEvent.images?.[0] || primaryEvent.image }}
              style={styles.eventImage}
              resizeMode="cover"
              onError={(error) => {
                console.error('Image load error:', error.nativeEvent.error);
              }}
            />
          )}

          {/* Title */}
          <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
            {primaryEvent.title || 'Untitled Event'}
          </Text>

          {/* Category Badge */}
          <View style={[styles.categoryBadge, { backgroundColor: eventColor + '20', borderColor: eventColor + '40' }]}>
            <Ionicons name="pricetag-outline" size={12} color={eventColor} />
            <Text style={[styles.categoryBadgeText, { color: eventColor }]}>
              {eventCategory}
            </Text>
          </View>

          {/* Date and Time */}
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <View style={styles.detailIconRow}>
                <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
                <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Date</Text>
              </View>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                {primaryEvent.isoDate || primaryEvent.date
                  ? formatDate(new Date(primaryEvent.isoDate || primaryEvent.date))
                  : 'Not specified'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <View style={styles.detailIconRow}>
                <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Time</Text>
              </View>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                {primaryEvent.time && primaryEvent.time.trim() ? primaryEvent.time : 'All Day'}
              </Text>
            </View>
          </View>

          {/* Date Range (if applicable) */}
          {primaryEvent.startDate && primaryEvent.endDate && (
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <View style={styles.detailIconRow}>
                  <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
                  <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Date Range</Text>
                </View>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {formatDate(new Date(primaryEvent.startDate))} - {formatDate(new Date(primaryEvent.endDate))}
                </Text>
              </View>
            </View>
          )}

          {/* Description */}
          {primaryEvent.description && (
            <View style={styles.descriptionContainer}>
              <Text style={[styles.descriptionLabel, { color: theme.colors.textMuted }]}>Description</Text>
              <Text style={[styles.descriptionText, { color: theme.colors.text }]}>
                {primaryEvent.description}
              </Text>
            </View>
          )}
        </View>
      )}
    </>
  );
  
  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      sheetY={sheetY}
      maxHeight="85%"
      backgroundColor={theme.colors.card}
      autoSize={!hasImage}
      sheetPaddingBottom={hasImage ? undefined : 0}
    >
      <View style={[styles.container, !hasImage && styles.containerAutoSize]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Event Details</Text>
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
          <View style={[styles.scrollContent, styles.contentContainer]}>
            {renderEventContent()}
          </View>
        )}

        {/* Action Buttons - Outside ScrollView to prevent cutoff */}
        {(onEdit || onDelete) && (
          <View style={[styles.actionsContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {onEdit && (
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton, { backgroundColor: theme.colors.primary }]}
                onPress={onEdit}
              >
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton, { backgroundColor: '#DC2626' }]}
                onPress={handleDeletePress}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Delete Confirmation Modal - Only render when needed */}
      {showDeleteConfirm && (
        <View style={styles.deleteModalOverlay} pointerEvents="box-none">
          <TouchableOpacity 
            style={styles.deleteModalBackdrop} 
            activeOpacity={1} 
            onPress={handleDeleteCancel}
          />
          <Animated.View 
            style={[
              styles.deleteModalSheet, 
              { 
                transform: [{ translateY: deleteConfirmSheetY }],
                backgroundColor: theme.colors.card,
                paddingBottom: Math.max(insets.bottom, 20),
              }
            ]}
            removeClippedSubviews={true}
          >
            <View style={styles.deleteModalHandle} />
            <View style={styles.deleteModalHeader}>
              <View style={[styles.deleteModalIconCircle, { backgroundColor: '#DC2626' + '20' }]}>
                <Ionicons name="trash" size={24} color="#DC2626" />
              </View>
              <Text style={[styles.deleteModalTitle, { color: theme.colors.text }]}>Delete Post</Text>
            </View>
            <Text style={[styles.deleteModalMessage, { color: theme.colors.textMuted }]}>
              Are you sure you want to delete "{primaryEvent?.title || 'this post'}"?
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
          </Animated.View>
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 200,
  },
  containerAutoSize: {
    flex: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  scrollContentAutoSize: {
    paddingBottom: 12,
  },
  contentContainer: {
    width: '100%',
  },
  eventsListContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    opacity: 0.7,
  },
  eventItem: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  eventAccent: {
    width: 3,
  },
  eventItemContent: {
    flex: 1,
    padding: 12,
  },
  eventItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 18,
  },
  eventItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventItemTime: {
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  eventItemCategory: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eventItemCategoryText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventDetails: {
    marginBottom: 16,
  },
  eventImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
    gap: 5,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 4,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  descriptionContainer: {
    marginTop: 6,
  },
  descriptionLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 2,
    opacity: 0.7,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  editButton: {
    // backgroundColor set inline
  },
  deleteButton: {
    // backgroundColor set inline
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Delete Confirmation Modal Styles
  deleteModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
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
  deleteModalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  deleteModalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginBottom: 20,
  },
  deleteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  deleteModalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
  },
  deleteModalMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
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

