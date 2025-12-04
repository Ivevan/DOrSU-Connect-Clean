import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { categoryToColors, formatDateKey } from '../../utils/calendarUtils';

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
  const uniqueTypes = new Set<string>();
  events.forEach(e => {
    // Normalize: use type first, then category, with proper fallback
    // The type field should already be set by useCalendar hook, but we check both for safety
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
    
    // Normalize to lowercase and trim whitespace
    const normalizedType = String(eventType).toLowerCase().trim();
    if (normalizedType) {
      uniqueTypes.add(normalizedType);
    }
  });
  
  const totalUniqueTypes = uniqueTypes.size;
  
  // Convert to array of colors, sorted by priority, limit to 4 indicators
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
    .slice(0, 4) // Limit to 4 indicators to avoid clutter
    .map(item => item.color);
  
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
  
  const { indicators: eventIndicators, totalUniqueTypes } = getEventTypeIndicators(eventsForDay);
  const isLastColumn = (index % 7) === 6;
  const isSelected = isSelectedDay && !isCurrentDay;
  const hasMoreTypes = totalUniqueTypes > eventIndicators.length;
  
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
        
        {/* Event Indicators - Show colored dots for all events */}
        {hasEvents && eventIndicators.length > 0 && (
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
            {hasMoreTypes && (
              <Text style={styles.moreEventsText}>
                +{totalUniqueTypes - eventIndicators.length}
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
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
    gap: 3,
    marginTop: 3,
    flexWrap: 'wrap',
    maxWidth: '100%',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  eventIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    minWidth: 6,
    minHeight: 6,
  },
  moreEventsText: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.6)',
    marginLeft: 2,
    lineHeight: 10,
  },
});

export default CalendarGrid;

