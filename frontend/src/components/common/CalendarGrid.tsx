import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { categoryToColors, formatDateKey, normalizeCategory } from '../../utils/calendarUtils';

dayjs.extend(utc);
dayjs.extend(timezone);

const PH_TZ = 'Asia/Manila';

// Get cell background color based on event types (highest priority)
// Note: This function is kept for backward compatibility but cell colors are no longer used
// We now use dot indicators instead of color fills
const getCellColor = (events: any[]): string | null => {
  // Return null - we don't use cell background colors anymore, only dot indicators
  return null;
};

// Get unique event type colors for indicators
// Returns: { indicators: string[], totalUniqueTypes: number }
const getEventTypeIndicators = (events: any[]): { indicators: string[]; totalUniqueTypes: number } => {
  if (!events || events.length === 0) return { indicators: [], totalUniqueTypes: 0 };
  
  const typeColorMap: { [key: string]: string } = {
    'academic': '#2563EB', // Blue - calm, serious, organized
    'institutional': '#4B5563', // Dark Gray - neutral, official-looking
    'announcement': '#EAB308', // Yellow - bright, attention-grabbing
    'event': '#10B981', // Green - friendly, inviting
    'news': '#EF4444', // Red - stands out, signals new/important
  };
  
  // Priority order for sorting
  const priorityOrder: { [key: string]: number } = {
    'institutional': 1,
    'academic': 2,
    'event': 3,
    'announcement': 4,
    'news': 5,
  };
  
  // Get unique event types - normalize to ensure consistent type extraction
  // Use normalizeCategory utility to handle all variations (plural forms, casing, etc.)
  // Note: Deduplication of events should happen in useCalendar hook, not here
  // This function only extracts unique TYPES from the events array
  const uniqueTypes = new Set<string>();
  
  events.forEach(e => {
    // Normalize: use type first, then category, with proper fallback
    // The type field should already be set by useCalendar hook (capitalized), but we check both for safety
    let eventType = e.type || e.category;
    
    // If still no type, check source-specific fields
    if (!eventType) {
      if (e.source === 'post') {
        eventType = e.category || 'Announcement';
      } else if (e.source === 'calendar') {
        eventType = e.category || 'Announcement';
      } else {
        eventType = 'Announcement';
      }
    }
    
    // Use normalizeCategory utility for consistent normalization (handles plural forms, casing, etc.)
    const normalizedCategory = normalizeCategory(eventType);
    const normalizedType = normalizedCategory.toLowerCase();
    
    // Ensure we have a valid type
    if (normalizedType && normalizedType.length > 0) {
      uniqueTypes.add(normalizedType);
    } else {
      // Fallback to announcement if type is empty or invalid
      uniqueTypes.add('announcement');
    }
  });
  
  const totalUniqueTypes = uniqueTypes.size;
  
  // Convert to array of colors, sorted by priority - show all unique types as stacked dots
  // Use stable sort to ensure consistent ordering regardless of when events are added
  const indicators = Array.from(uniqueTypes)
    .map(type => ({
      type,
      color: typeColorMap[type] || categoryToColors(type).cellColor || '#2563EB',
      priority: priorityOrder[type] || 99,
    }))
    .sort((a, b) => {
      // Primary sort by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Secondary sort by type name for stability when priorities are equal
      return a.type.localeCompare(b.type);
    })
    .map(item => item.color); // Show all indicators, no limit
  
  return { indicators, totalUniqueTypes };
};

// Robust PH date-key comparison (avoids off-by-one no matter device tz)
const getPHDateKey = (d: Date) => {
  try {
    const dtf = new Intl.DateTimeFormat('en-PH', {
      timeZone: PH_TZ,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = dtf.formatToParts(d);
    const y = Number(parts.find(p => p.type === 'year')?.value);
    const m = Number(parts.find(p => p.type === 'month')?.value) - 1;
    const day = Number(parts.find(p => p.type === 'day')?.value);
    return Date.UTC(y, m, day);
  } catch {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
};

interface CalendarDayProps {
  date: Date;
  day: number | null;
  isCurrentDay: boolean;
  isSelectedDay: boolean;
  index: number;
  eventsForDay: any[];
  theme: any;
  onPress: (date: Date) => void;
  onLongPress?: (date: Date) => void;
}

const CalendarDay = memo(({ 
  date, 
  day, 
  isCurrentDay, 
  isSelectedDay, 
  index, 
  eventsForDay, 
  theme, 
  onPress,
  onLongPress 
}: CalendarDayProps) => {
  const hasEvents = eventsForDay && eventsForDay.length > 0;
  
  // Extract unique types first using the SAME logic as getEventTypeIndicators
  // This creates a stable key that won't change unless the actual event types change
  const uniqueTypesKey = useMemo(() => {
    if (!eventsForDay || eventsForDay.length === 0) return 'empty';
    
    const uniqueTypes = new Set<string>();
    eventsForDay.forEach(e => {
      // Use the exact same normalization logic as getEventTypeIndicators
      let eventType = e.type || e.category;
      if (!eventType) {
        if (e.source === 'post') {
          eventType = e.category || 'Announcement';
        } else if (e.source === 'calendar') {
          eventType = e.category || 'Announcement';
        } else {
          eventType = 'Announcement';
        }
      }
      const normalizedCategory = normalizeCategory(eventType);
      const normalizedType = normalizedCategory.toLowerCase();
      if (normalizedType && normalizedType.length > 0) {
        uniqueTypes.add(normalizedType);
      } else {
        uniqueTypes.add('announcement');
      }
    });
    
    // Return sorted unique types as a stable key
    return Array.from(uniqueTypes).sort().join('|');
  }, [eventsForDay]);
  
  // Memoize the indicators calculation based on unique types key
  // This ensures the result is stable even if eventsForDay array reference changes
  const { indicators: eventIndicators, totalUniqueTypes } = useMemo(() => {
    return getEventTypeIndicators(eventsForDay);
  }, [uniqueTypesKey]); // Only depend on uniqueTypesKey, which is stable
  
  const handlePress = () => {
    onPress(date);
  };
  
  const handleLongPress = () => {
    if (onLongPress && !hasEvents) {
      onLongPress(date);
    }
  };

  if (!day) return (
    <View
      style={[
        styles.calendarDay,
        {
          backgroundColor: theme.colors.surfaceAlt,
          borderRightColor: theme.colors.border,
          borderBottomColor: theme.colors.border,
          borderRightWidth: (index % 7) === 6 ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    />
  );
  const isLastColumn = (index % 7) === 6;
  const isSelected = isSelectedDay && !isCurrentDay;
  
  return (
    <TouchableOpacity 
      style={[
        styles.calendarDay,
        { 
          backgroundColor: theme.colors.card,
          borderTopWidth: isSelected ? 2 : 0,
          borderTopColor: isSelected ? theme.colors.accent : 'transparent',
          borderLeftWidth: isSelected ? 2 : 0,
          borderLeftColor: isSelected ? theme.colors.accent : 'transparent',
          borderRightWidth: isLastColumn ? (isSelected ? 2 : 0) : (isSelected ? 2 : StyleSheet.hairlineWidth),
          borderRightColor: isSelected ? theme.colors.accent : theme.colors.border,
          borderBottomWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
          borderBottomColor: isSelected ? theme.colors.accent : theme.colors.border,
        }
      ]}
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      activeOpacity={0.7}
    >
      <View style={styles.dayContent}>
        <View style={[
          styles.dayNumberContainer,
          isCurrentDay && styles.todayContainer,
          isCurrentDay && { backgroundColor: theme.colors.accent },
        ]}>
          <Text
            accessibilityRole="button"
            accessibilityLabel={`Select ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
            accessibilityHint={hasEvents ? `Tap to view ${eventsForDay.length} event${eventsForDay.length > 1 ? 's' : ''} for this date` : "Selects this date"}
            style={[
              styles.dayNumber,
              { fontSize: theme.fontSize.scaleSize(12) },
              isCurrentDay && { color: '#FFFFFF', fontWeight: '700' },
              !isCurrentDay && { color: theme.colors.text },
              isCurrentDay && styles.todayText,
            ]}
          >
            {day}
          </Text>
        </View>
        
        {/* Event Indicators - Show colored dots for all unique event types (stacked) */}
        {eventIndicators.length > 0 && (
          <View style={styles.eventIndicatorsContainer}>
            {eventIndicators.map((color, idx) => (
              <View
                key={idx}
                style={[
                  styles.eventIndicatorDot,
                  { 
                    backgroundColor: color,
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 1.5,
                    elevation: 2,
                  }
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders when only isSelectedDay changes
  // Only re-render if events actually changed or other important props changed
  if (prevProps.isSelectedDay !== nextProps.isSelectedDay) {
    // Allow re-render for selection changes (needed for border styling)
    // But the indicators will remain stable due to memoization
    return false;
  }
  
  // Compare events by length first
  if (prevProps.eventsForDay.length !== nextProps.eventsForDay.length) {
    return false; // Re-render if length changed
  }
  
  // Compare unique types (normalized) - this matches what getEventTypeIndicators uses
  const getUniqueTypesKey = (events: any[]) => {
    if (!events || events.length === 0) return 'empty';
    const uniqueTypes = new Set<string>();
    events.forEach(e => {
      let eventType = e.type || e.category;
      if (!eventType) {
        if (e.source === 'post') {
          eventType = e.category || 'Announcement';
        } else if (e.source === 'calendar') {
          eventType = e.category || 'Announcement';
        } else {
          eventType = 'Announcement';
        }
      }
      const normalizedCategory = normalizeCategory(eventType);
      const normalizedType = normalizedCategory.toLowerCase();
      if (normalizedType && normalizedType.length > 0) {
        uniqueTypes.add(normalizedType);
      } else {
        uniqueTypes.add('announcement');
      }
    });
    return Array.from(uniqueTypes).sort().join('|');
  };
  
  const prevTypesKey = getUniqueTypesKey(prevProps.eventsForDay);
  const nextTypesKey = getUniqueTypesKey(nextProps.eventsForDay);
  if (prevTypesKey !== nextTypesKey) {
    return false; // Re-render if unique types changed
  }
  
  // Compare other props
  return (
    prevProps.date.getTime() === nextProps.date.getTime() &&
    prevProps.day === nextProps.day &&
    prevProps.isCurrentDay === nextProps.isCurrentDay &&
    prevProps.index === nextProps.index &&
    prevProps.theme === nextProps.theme &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onLongPress === nextProps.onLongPress
  );
});

interface CalendarGridProps {
  currentMonth: Date;
  selectedDate: Date | null;
  eventsByDateMap: Map<string, any[]>;
  theme: any;
  onDayPress: (date: Date) => void;
  onDayLongPress?: (date: Date) => void;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentMonth,
  selectedDate,
  eventsByDateMap,
  theme,
  onDayPress,
  onDayLongPress,
}) => {
  const getDaysInMonth = useCallback((date: Date) => {
    const start = dayjs.utc(date).tz(PH_TZ).startOf('month');
    const daysInMonth = start.daysInMonth();
    const firstDayOfMonth = start.day();
    
    const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;
    const days: Array<number | null> = new Array(totalCells);
    
    for (let i = 0; i < firstDayOfMonth; i++) {
      days[i] = null;
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days[firstDayOfMonth + i - 1] = i;
    }
    
    for (let i = firstDayOfMonth + daysInMonth; i < totalCells; i++) {
      days[i] = null;
    }
    
    return days;
  }, []);

  const isToday = useCallback((date: Date) => {
    return getPHDateKey(date) === getPHDateKey(new Date());
  }, []);

  const isSelected = useCallback((date: Date) => {
    return selectedDate ? getPHDateKey(date) === getPHDateKey(selectedDate) : false;
  }, [selectedDate]);

  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth, getDaysInMonth]);

  const renderCalendarDay = useCallback((date: Date, day: number | null, isCurrentDay: boolean, isSelectedDay: boolean, key: number) => {
    const dateKey = formatDateKey(date);
    const eventsForDay = eventsByDateMap.get(dateKey) || [];
    
    return (
      <CalendarDay
        key={key}
        date={date}
        day={day}
        isCurrentDay={isCurrentDay}
        isSelectedDay={isSelectedDay}
        index={key}
        eventsForDay={eventsForDay}
        theme={theme}
        onPress={onDayPress}
        onLongPress={onDayLongPress}
      />
    );
  }, [eventsByDateMap, theme, onDayPress, onDayLongPress]);

  return (
    <View style={styles.calendarGrid}>
      {days && Array.isArray(days) && days.map((day, index) => {
        const currentDate = day ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day) : null;
        const isCurrentDay = currentDate ? isToday(currentDate) : false;
        const isSelectedDay = currentDate ? isSelected(currentDate) : false;
        return renderCalendarDay(currentDate || new Date(), day, isCurrentDay, !!isSelectedDay, index);
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  calendarDay: {
    width: '14.285%',
    aspectRatio: 1,
  },
  dayContent: {
    flex: 1,
    padding: 2,
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 0, // Allow flexbox to shrink if needed
    overflow: 'visible', // Ensure indicators are not clipped
  },
  dayNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  todayContainer: {
    backgroundColor: 'transparent',
  },
  todayText: {
    color: '#fff',
    fontWeight: '700',
  },
  eventIndicatorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1.5,
    marginTop: 2,
    flexWrap: 'wrap',
    maxWidth: '100%',
    paddingHorizontal: 0.5,
    paddingVertical: 0.5,
    minHeight: 5,
    maxHeight: 20, // Allow up to 3 rows of dots (5px dot + 1.5px gap * 2 rows)
    flexShrink: 0, // Prevent container from shrinking
    overflow: 'visible', // Ensure all dots are visible
  },
  eventIndicatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    minWidth: 5,
    minHeight: 5,
    flexShrink: 0, // Prevent dots from shrinking
  },
});

export default CalendarGrid;

