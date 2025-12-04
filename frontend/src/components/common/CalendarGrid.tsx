import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { categoryToColors, formatDateKey } from '../../utils/calendarUtils';

dayjs.extend(utc);
dayjs.extend(timezone);

const PH_TZ = 'Asia/Manila';

// Get cell background color based on event types
const getCellColor = (events: any[]): string | null => {
  if (!events || events.length === 0) return null;
  
  // Priority order: Institutional > Academic > Event > News > Announcement
  const hasInstitutional = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'institutional';
  });
  
  const hasAcademic = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'academic';
  });
  
  const hasEvent = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'event';
  });
  
  const hasNews = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'news';
  });
  
  const hasAnnouncement = events.some(e => {
    const type = String(e.type || e.category || '').toLowerCase();
    return type === 'announcement';
  });
  
  // Return color based on priority
  if (hasInstitutional) return '#2563EB'; // Blue
  if (hasAcademic) return '#10B981'; // Green
  if (hasEvent) return '#D97706'; // Orange
  if (hasNews) return '#8B5CF6'; // Purple
  if (hasAnnouncement) return '#1A3E7A'; // Dark Blue
  
  // Fallback: use first event's category color
  const firstEvent = events[0];
  if (firstEvent) {
    const colors = categoryToColors(firstEvent.type || firstEvent.category);
    return colors.cellColor || null;
  }
  
  return null;
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
  
  const cellColor = getCellColor(eventsForDay);
  const isLastColumn = (index % 7) === 6;
  const isSelected = isSelectedDay && !isCurrentDay;
  
  return (
    <TouchableOpacity 
      style={[
        styles.calendarDay,
        { 
          backgroundColor: cellColor || theme.colors.card,
          borderTopWidth: isSelected ? 2 : 0,
          borderTopColor: isSelected ? theme.colors.accent : 'transparent',
          borderLeftWidth: isSelected ? 2 : 0,
          borderLeftColor: isSelected ? theme.colors.accent : 'transparent',
          borderRightWidth: isLastColumn ? (isSelected ? 2 : 0) : (isSelected ? 2 : StyleSheet.hairlineWidth),
          borderRightColor: isSelected ? theme.colors.accent : theme.colors.border,
          borderBottomWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
          borderBottomColor: isSelected ? theme.colors.accent : theme.colors.border,
          opacity: cellColor ? 0.85 : 1,
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
          !isCurrentDay && cellColor && { backgroundColor: cellColor },
        ]}>
          <Text
            accessibilityRole="button"
            accessibilityLabel={`Select ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
            accessibilityHint={hasEvents ? "Tap to view events for this date" : "Selects this date"}
            style={[
              styles.dayNumber,
              { fontSize: theme.fontSize.scaleSize(12) },
              isCurrentDay && { color: '#FFFFFF', fontWeight: '700' },
              !isCurrentDay && { color: cellColor ? '#FFFFFF' : theme.colors.text },
              isCurrentDay && styles.todayText,
              !isCurrentDay && cellColor && { color: '#FFFFFF', fontWeight: '700' }
            ]}
          >
            {day}
          </Text>
        </View>
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
});

export default CalendarGrid;

