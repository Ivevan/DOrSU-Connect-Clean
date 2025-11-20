import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const sheetY = useRef(new Animated.Value(500)).current;
  const closeAlertSheetY = useRef(new Animated.Value(300)).current;
  const [isCloseAlertOpen, setIsCloseAlertOpen] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);

  // Animate sheet when visible changes
  React.useEffect(() => {
    if (visible) {
      Animated.spring(sheetY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(sheetY, {
        toValue: 500,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, sheetY]);

  const handleClose = useCallback(() => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    setIsAnimating(true);
    setIsCloseAlertOpen(true);
    setTimeout(() => {
      Animated.timing(closeAlertSheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating, closeAlertSheetY]);

  const confirmClose = useCallback(() => {
    Animated.timing(closeAlertSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setIsCloseAlertOpen(false);
      Animated.timing(sheetY, {
        toValue: 500,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        onClose();
      });
    });
  }, [closeAlertSheetY, sheetY, onClose]);

  const cancelClose = useCallback(() => {
    Animated.timing(closeAlertSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setIsCloseAlertOpen(false);
    });
  }, [closeAlertSheetY]);

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
  const primaryEvent = selectedEvent || eventsToShow[0];

  const eventColor = primaryEvent?.color || categoryToColors(primaryEvent?.category || primaryEvent?.type || 'Event').dot;
  const eventCategory = primaryEvent?.category || primaryEvent?.type || 'Event';

  // Early return after all hooks have been called
  if (!selectedEvent && selectedDateEvents.length === 0) {
    return null;
  }

  return (
    <>
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      sheetY={sheetY}
      maxHeight="90%"
      backgroundColor={theme.colors.card}
      contentStyle={styles.bottomSheetContent}
    >
      <View style={styles.container}>
        {/* Header with Close Button */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Event Details</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
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
                        {event.time || 'All Day'}
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
            {/* Event Icon */}
            <View style={[styles.eventIconWrapper, { backgroundColor: eventColor + '15' }]}>
              <Ionicons name="calendar" size={32} color={eventColor} />
            </View>

            {/* Title */}
            <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
              {primaryEvent.title}
            </Text>

            {/* Category Badge */}
            <View style={[styles.categoryBadge, { backgroundColor: eventColor + '20', borderColor: eventColor + '40' }]}>
              <Ionicons name="pricetag-outline" size={12} color={eventColor} />
              <Text style={[styles.categoryBadgeText, { color: eventColor }]}>
                {eventCategory}
              </Text>
            </View>

            {/* Date and Time - Centered */}
            <View style={styles.detailsContainer}>
              <View style={styles.detailCard}>
                <View style={styles.detailIconWrapper}>
                  <Ionicons name="calendar-outline" size={20} color={eventColor} />
                </View>
                <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Date</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {primaryEvent.isoDate || primaryEvent.date
                    ? formatDate(new Date(primaryEvent.isoDate || primaryEvent.date))
                    : 'Not specified'}
                </Text>
              </View>
              <View style={styles.detailCard}>
                <View style={styles.detailIconWrapper}>
                  <Ionicons name="time-outline" size={20} color={eventColor} />
                </View>
                <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Time</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {primaryEvent.time || 'All Day'}
                </Text>
              </View>
            </View>

            {/* Date Range (if applicable) */}
            {primaryEvent.startDate && primaryEvent.endDate && (
              <View style={styles.detailCard}>
                <View style={styles.detailIconWrapper}>
                  <Ionicons name="calendar-outline" size={20} color={eventColor} />
                </View>
                <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Date Range</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {formatDate(new Date(primaryEvent.startDate))} - {formatDate(new Date(primaryEvent.endDate))}
                </Text>
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
        </ScrollView>

        {/* Action Buttons - Outside ScrollView */}
        {(onEdit || onDelete) && (
          <View style={styles.actionsContainer}>
            {onEdit && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                onPress={onEdit}
              >
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#DC2626' }]}
                onPress={onDelete}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </BottomSheet>

    {/* Close Confirmation Alert Modal - Separate BottomSheet */}
    <BottomSheet
      visible={isCloseAlertOpen}
      onClose={cancelClose}
      sheetY={closeAlertSheetY}
      backgroundColor={theme.colors.card}
      maxHeight="50%"
    >
      <View style={styles.alertIconWrapWarning}>
        <Ionicons name="warning" size={24} color="#F59E0B" />
      </View>
      <Text style={[styles.alertTitle, { color: theme.colors.text }]}>Close Event Details?</Text>
      <Text style={[styles.alertSubtitle, { color: theme.colors.textMuted }]}>Are you sure you want to close this event view?</Text>
      <View style={styles.alertActionsRow}>
        <TouchableOpacity 
          style={[styles.alertCancelBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} 
          onPress={cancelClose}
        >
          <Text style={[styles.alertCancelText, { color: theme.colors.text }]}>Keep Open</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.alertDangerBtn} onPress={confirmClose}>
          <Text style={styles.alertDangerText}>Close</Text>
        </TouchableOpacity>
      </View>
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
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
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
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  eventIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    lineHeight: 28,
    letterSpacing: -0.4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    width: '100%',
    paddingHorizontal: 20,
  },
  detailCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  detailIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    opacity: 0.7,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  descriptionContainer: {
    marginTop: 8,
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  descriptionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    opacity: 0.7,
    textAlign: 'center',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    flexShrink: 0,
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
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Alert Modal Styles
  alertIconWrapWarning: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  alertActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  alertCancelBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  alertDangerBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertDangerText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});

export default ViewEventModal;
