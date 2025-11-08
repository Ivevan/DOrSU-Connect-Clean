import React, { useRef, useState, useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Alert, Pressable, Image, Animated, Dimensions, Easing, SectionList, AccessibilityInfo, InteractionManager } from 'react-native';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../config/theme';
import { useThemeValues } from '../../contexts/ThemeContext';
import AdminDataService from '../../services/AdminDataService';
import { formatDate, timeAgo, formatCalendarDate } from '../../utils/dateUtils';
import MonthPickerModal from '../../modals/MonthPickerModal';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
};

const CalendarScreen = () => {
  dayjs.extend(utc);
  dayjs.extend(timezone);
  const PH_TZ = 'Asia/Manila';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode, theme: t } = useThemeValues();
  const scrollRef = useRef<ScrollView>(null);
  const initialNow = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(Date.UTC(initialNow.getFullYear(), initialNow.getMonth(), 1)));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date()); // Default to today
  
  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);
  
  // Lock header height to prevent layout shifts
  const headerHeightRef = useRef<number>(64);
  const [headerHeight, setHeaderHeight] = useState(64);
  
  // Calendar state
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  
  // Animation values
  const monthPickerScaleAnim = useRef(new Animated.Value(0)).current;
  const monthPickerOpacityAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.8)).current;

  // Entrance animation values - DISABLED FOR DEBUGGING
  const fadeAnim = useRef(new Animated.Value(1)).current; // Set to 1 (visible) immediately
  const slideAnim = useRef(new Animated.Value(0)).current; // Set to 0 (no offset) immediately

  const formatEventTitle = (raw?: string) => {
    const title = String(raw || '').trim();
    if (title.length < 3) return 'Untitled';
    // Capitalize first letter, collapse spaces
    const cleaned = title.replace(/\s+/g, ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  // Data from AdminDataService
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);

  // Defer data loading until after screen is visible to prevent navigation delay
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoadingPosts(true);
        const data = await AdminDataService.getPosts();
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setIsLoadingPosts(false);
      }
    };
    // Use requestAnimationFrame to defer to next frame, allowing screen to render immediately
    const rafId = requestAnimationFrame(() => {
    load();
    });
    return () => { 
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

  const categoryToColors = (category?: string) => {
    const key = String(category || '').toLowerCase();
    // Dot/text base color
    switch (key) {
      case 'announcement':
        return { dot: '#1A3E7A', chipBg: '#E8F0FF', chipBorder: '#CCE0FF', chipText: '#1A3E7A' };
      case 'academic':
        return { dot: '#0369A1', chipBg: '#F0F9FF', chipBorder: '#CFF3FF', chipText: '#0369A1' };
      case 'event':
        return { dot: '#D97706', chipBg: '#FEF3C7', chipBorder: '#FDE68A', chipText: '#92400E' };
      case 'service':
        return { dot: '#059669', chipBg: '#ECFDF5', chipBorder: '#BBF7D0', chipText: '#065F46' };
      case 'infrastructure':
        return { dot: '#DC2626', chipBg: '#FEE2E2', chipBorder: '#FECACA', chipText: '#991B1B' };
      default:
        return { dot: '#2563EB', chipBg: '#EEF2FF', chipBorder: '#E0E7FF', chipText: '#1D4ED8' };
    }
  };

  const parseAnyDateToKey = (input: any): string | null => {
    if (!input) return null;
    // Try native Date parsing first
    const maybe = new Date(input);
    if (!isNaN(maybe.getTime())) return formatDateKey(maybe);
    // Try dd/mm/yyyy
    if (typeof input === 'string' && input.includes('/')) {
      const parts = input.split('/');
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const d = Number(dd), m = Number(mm) - 1, y = Number(yyyy);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) return formatDateKey(dt);
      }
    }
    return null;
  };

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getDaysInMonth = (date: Date) => {
    const start = dayjs.utc(date).tz(PH_TZ).startOf('month');
    const daysInMonth = start.daysInMonth();
    const firstDayOfMonth = start.day(); // 0=Sun..6=Sat in PH tz
    
    const days: Array<number | null> = [];
    
    // Add leading empty cells so week starts on Sunday
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    // Add trailing empty cells so total cells is multiple of 7 (complete rows)
    const remainder = days.length % 7;
    if (remainder !== 0) {
      const toAdd = 7 - remainder;
      for (let i = 0; i < toAdd; i++) days.push(null);
    }
    
    return days;
  };

  const getMonthName = (date: Date) => {
    return dayjs.utc(date).tz(PH_TZ).format('MMMM');
  };

  const transformPostToEvent = (p: any) => ({
    id: p.id,
    title: p.title,
    dateKey: parseAnyDateToKey(p.isoDate || p.date),
    time: '',
    type: p.category || 'Announcement',
    color: categoryToColors(p.category).dot,
    chip: categoryToColors(p.category),
    isPinned: !!p.isPinned,
    isUrgent: !!p.isUrgent,
  });

  const getEventsForDate = React.useCallback((date: Date) => {
    const key = formatDateKey(date);
    if (!Array.isArray(posts)) return [];
    return posts
      .map(p => ({
        id: p.id,
        title: p.title,
        dateKey: parseAnyDateToKey(p.isoDate || p.date),
        time: '',
        type: p.category || 'Announcement',
        color: categoryToColors(p.category).dot,
        chip: categoryToColors(p.category),
      }))
      .filter(e => e.dateKey === key);
  }, [posts]);

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

  const isToday = (date: Date) => {
    return getPHDateKey(date) === getPHDateKey(new Date());
  };

  const isSelected = (date: Date) => {
    return selectedDate ? getPHDateKey(date) === getPHDateKey(selectedDate) : false;
  };

  const handleDayPress = useCallback((date: Date) => {
    setSelectedDate(date);
    Haptics.selectionAsync();
  }, []);

  // Memoized Calendar Day Component
  const CalendarDay = memo(({ date, day, isCurrentDay, isSelectedDay, index, eventsForDay, theme, dotScale, onPress }: { date: Date; day: number | null; isCurrentDay: boolean; isSelectedDay: boolean; index: number; eventsForDay: any[]; theme: any; dotScale: Animated.Value; onPress: (date: Date) => void }) => {
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
    
    return (
      <TouchableOpacity 
        style={[
          styles.calendarDay,
          { 
            backgroundColor: theme.colors.card,
            borderRightColor: theme.colors.border, 
            borderBottomColor: theme.colors.border,
            borderRightWidth: (index % 7) === 6 ? 0 : StyleSheet.hairlineWidth
          }
        ]}
        onPress={() => onPress(date)}
      >
        <View style={styles.dayContent}>
          <View style={[
            styles.dayNumberContainer,
            isCurrentDay && styles.todayContainer,
            isCurrentDay && { backgroundColor: theme.colors.accent },
            isSelectedDay && [styles.selectedContainer, { borderColor: theme.colors.accent }]
          ]}>
            <Text
              accessibilityRole="button"
              accessibilityLabel={`Select ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
              accessibilityHint="Selects this date to view events"
              style={[
                styles.dayNumber,
                { color: theme.colors.text },
                isCurrentDay && styles.todayText,
                isSelectedDay && styles.selectedText
              ]}
            >
              {day}
            </Text>
          </View>
          {eventsForDay && eventsForDay.length > 0 && (
            <View style={styles.eventIndicators}>
              {eventsForDay.slice(0, 3).map((event, eventIndex) => (
                <View 
                  key={eventIndex} 
                  style={[styles.eventDot, { backgroundColor: event.color }]} 
                />
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  });

  const renderCalendarDay = useCallback((date: Date, day: number | null, isCurrentDay: boolean, isSelectedDay: boolean, key: number) => {
    const eventsForDay = getEventsForDate(date);
    return (
      <CalendarDay
        key={key}
        date={date}
        day={day}
        isCurrentDay={isCurrentDay}
        isSelectedDay={isSelectedDay}
        index={key}
        eventsForDay={eventsForDay}
        theme={t}
        dotScale={dotScale}
        onPress={handleDayPress}
      />
    );
  }, [getEventsForDate, t, dotScale, handleDayPress]);

  const filteredEvents = React.useMemo(() => {
    if (!Array.isArray(posts)) return [];
    if (selectedDate && !showAllEvents) {
      return getEventsForDate(selectedDate);
    }
    return posts.map(transformPostToEvent);
  }, [selectedDate, showAllEvents, posts, getEventsForDate, transformPostToEvent]);

  const getAllEventsGrouped = () => {
    if (!Array.isArray(posts)) return [];
    const all = posts.map(p => ({
      ...transformPostToEvent(p),
      dateObj: (() => { 
        const k = parseAnyDateToKey(p.isoDate || p.date); 
        return k ? new Date(k) : new Date(); 
      })(),
    })).filter(e => !!e.dateKey);
    
    const groupedMap = new Map();
    all.forEach(e => {
      const key = e.dateKey;
      if (!groupedMap.has(key)) groupedMap.set(key, []);
      groupedMap.get(key).push(e);
    });
    
    return Array.from(groupedMap.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([key, items]) => ({ key, items: items as any[] }));
  };
  const groupedEvents = React.useMemo(() => getAllEventsGrouped(), [posts]);

  const selectMonth = (monthIndex: number) => {
    const newMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), monthIndex, 1));
    setCurrentMonth(newMonth);
    // Ensure the selected date moves into the chosen month so the week view reflects it
    setSelectedDate(new Date(Date.UTC(newMonth.getUTCFullYear(), newMonth.getUTCMonth(), 1)));
    closeMonthPicker();
  };

  const openMonthPicker = () => {
    setShowMonthPicker(true);
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
  };

  const closeMonthPicker = () => {
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
      setShowMonthPicker(false);
    });
  };

  const getMonthNames = () => {
    return [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
  };


  // Optimized entrance animation for Calendar - DISABLED FOR DEBUGGING
  // React.useEffect(() => {
  //   const handle = InteractionManager.runAfterInteractions(() => {
  //     Animated.parallel([
  //       Animated.timing(fadeAnim, {
  //         toValue: 1,
  //         duration: 250,
  //         easing: Easing.out(Easing.ease),
  //         useNativeDriver: true,
  //       }),
  //       Animated.timing(slideAnim, {
  //         toValue: 0,
  //         duration: 250,
  //         easing: Easing.out(Easing.ease),
  //         useNativeDriver: true,
  //       }),
  //     ]).start();
  //   });
  //   return () => handle.cancel();
  // }, []);

  // List animation - DISABLED FOR DEBUGGING
  React.useEffect(() => {
    // Set values immediately without animation
    listAnim.setValue(1);
    dotScale.setValue(1);
    // const handle = InteractionManager.runAfterInteractions(() => {
    //   listAnim.setValue(0);
    //   Animated.timing(listAnim, {
    //     toValue: 1,
    //     duration: 200,
    //     easing: Easing.out(Easing.ease),
    //     useNativeDriver: true,
    //   }).start();
    //   dotScale.setValue(0.8);
    //   Animated.timing(dotScale, {
    //     toValue: 1,
    //     duration: 200,
    //     easing: Easing.out(Easing.ease),
    //     useNativeDriver: true,
    //   }).start();
    // });
    // return () => handle.cancel();
  }, [showAllEvents, selectedDate, posts]);

  const days = React.useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  const weekDays = React.useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []); // Sunday -> Saturday

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={[styles.container, {
      backgroundColor: t.colors.background,
    }]} collapsable={false}>
      <StatusBar
          backgroundColor={t.colors.primary}
        barStyle={isDarkMode ? "light-content" : "light-content"}
        translucent={false}
        hidden={false}
      />

      {/* Safe Area Top Spacer - Fixed position */}
      <View style={[styles.safeAreaTop, { 
        height: safeInsets.top,
        backgroundColor: t.colors.primary,
      }]} collapsable={false} />

      {/* Header - Fixed position to prevent layout shifts */}
      <View 
        style={[styles.header, { 
          backgroundColor: t.colors.primary,
          top: safeInsets.top,
        }]}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          if (height > 0 && height !== headerHeightRef.current) {
            headerHeightRef.current = height;
            setHeaderHeight(height);
          }
        }}
        collapsable={false}
      >
        <View style={styles.headerLeft} collapsable={false}>
          <Text style={styles.headerTitle} numberOfLines={1}>School Calendar</Text>
              </View>
        <View style={styles.headerRight} collapsable={false}>
            <View style={styles.headerSpacer} />
            <View style={styles.headerSpacer} />
          </View>
      </View>

      <ScrollView 
        ref={scrollRef} 
        style={[styles.scrollView, {
          marginTop: safeInsets.top + headerHeight,
          marginBottom: 0,
        }]}
        contentContainerStyle={[styles.scrollContent, {
          paddingBottom: safeInsets.bottom + 80, // Bottom nav bar height + safe area
        }]} 
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        scrollEventThrottle={16}
      >

        {/* Calendar Card - Fixed below header */}
        {/* Animation wrapper removed for debugging */}
        <View>
          {/* Calendar Card */}
          <View style={[
          styles.calendarCard,
          {
              backgroundColor: t.colors.card,
            }
          ]}>

          {/* Month selector at top of calendar */}
          <View style={[styles.calendarMonthHeader, { backgroundColor: t.colors.card, borderBottomColor: t.colors.border }]}>
            <TouchableOpacity
              style={styles.monthSelectorButton}
              onPress={openMonthPicker}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open month picker"
              accessibilityHint="Opens a modal to select a month"
            >
              <View style={styles.monthSelectorContent}>
                <Ionicons name="calendar" size={18} color={t.colors.text} />
                <Text style={[styles.monthHeaderText, { color: t.colors.text }]}>
                  {getMonthName(currentMonth)} {currentMonth.getFullYear()}
                </Text>
                <Ionicons name="chevron-down" size={14} color={t.colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Week day headers */}
          <View style={[styles.weekHeader, { backgroundColor: t.colors.card }]}>
            {weekDays && Array.isArray(weekDays) && weekDays.map((day, index) => (
              <View key={index} style={[styles.weekDayHeader, { borderRightColor: t.colors.border }]}>
                <Text
                  style={[styles.weekDayText, { color: t.colors.textMuted }]}
                  accessibilityElementsHidden={true}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {/* Show full month */}
            {days && Array.isArray(days) && days.map((day, index) => {
                const currentDate = day ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day) : null;
                const isCurrentDay = currentDate ? isToday(currentDate) : false;
                const isSelectedDay = currentDate ? isSelected(currentDate) : false;
              return renderCalendarDay(currentDate || new Date(), day, isCurrentDay, !!isSelectedDay, index);
            })}
                        </View>
                      </View>
              </View>

        {/* Month Picker Modal */}
        <MonthPickerModal
          visible={showMonthPicker}
          currentMonth={currentMonth}
          onClose={closeMonthPicker}
          onSelectMonth={selectMonth}
          scaleAnim={monthPickerScaleAnim}
          opacityAnim={monthPickerOpacityAnim}
        />

        {/* Events Section */}
        <View 
          style={[
            styles.eventsSection,
            {
              backgroundColor: t.colors.card
            }
          ]}
        >
          <View style={styles.eventsHeader}>
            <View style={styles.eventsHeaderLeft}>
              <View style={[styles.eventsIconWrap, { borderColor: t.colors.border }]}>
                <Ionicons name="calendar-outline" size={14} color={t.colors.accent} />
        </View>
              <Text style={[styles.eventsTitle, { color: t.colors.text }]}>Events</Text>
            </View>
            <View style={[styles.segmentedToggle, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
              <TouchableOpacity
                style={[styles.segmentItem, !showAllEvents && [styles.segmentItemActive, { backgroundColor: t.colors.surfaceAlt }]]}
                onPress={() => { setShowAllEvents(false); AccessibilityInfo.announceForAccessibility?.('Switched to Day view'); Haptics.selectionAsync(); }}
                accessibilityRole="button"
                accessibilityLabel="Day view"
              >
                <Text style={[styles.segmentText, { color: t.colors.textMuted }, !showAllEvents && styles.segmentTextActive]}>Day</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentItem, showAllEvents && [styles.segmentItemActive, { backgroundColor: t.colors.surfaceAlt }]]}
                onPress={() => { setShowAllEvents(true); AccessibilityInfo.announceForAccessibility?.('Switched to All events'); Haptics.selectionAsync(); }}
                accessibilityRole="button"
                accessibilityLabel="All events"
              >
                <Text style={[styles.segmentText, { color: t.colors.textMuted }, showAllEvents && styles.segmentTextActive]}>All</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.eventsSubtitleRowEnhanced}>
            <Text style={[styles.eventsSubtitle, { color: t.colors.textMuted }]} numberOfLines={1}>
              {showAllEvents
                ? 'All dates'
                : selectedDate
                  ? formatDate(selectedDate)
                  : 'All dates'} — {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
            </Text>
          </View>
          <LinearGradient colors={[t.colors.border, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ height: 1, marginBottom: 10 }} />

          {filteredEvents.length === 0 && !isLoadingPosts && (
            <View style={[styles.emptyStateCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <View style={[styles.emptyStateIconWrap, { backgroundColor: t.colors.surfaceAlt }]}>
                <Ionicons name="calendar-outline" size={20} color={t.colors.accent} />
              </View>
              <Text style={[styles.emptyStateTitle, { color: t.colors.text }]}>No events yet</Text>
              <Text style={[styles.emptyStateSubtitle, { color: t.colors.textMuted }]}>
                {showAllEvents
                  ? 'Create your first event or announcement.'
                  : `No events for ${selectedDate ? formatDate(selectedDate) : 'this day'}`}
              </Text>
            </View>
          )}

          {isLoadingPosts && (
            <View style={[styles.emptyStateCard, { paddingVertical: 16, overflow: 'hidden', backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <LinearGradient colors={[t.colors.surfaceAlt, t.colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ ...StyleSheet.absoluteFillObject, opacity: 0.6 }} />
              <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Loading…</Text>
            </View>
          )}

          {!showAllEvents && (
            <View>
            {Array.isArray(filteredEvents) && filteredEvents.map((event: any) => (
            <TouchableOpacity
              key={event.id}
              style={[styles.eventCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
              onPress={() => {/* User can only view events, not edit */}}
              accessibilityRole="button"
              accessibilityLabel={`View event ${event.title}`}
              accessibilityHint="View event details"
              activeOpacity={0.7}
            >
              <View style={[styles.eventAccent, { backgroundColor: event.color }]} />
              <View style={styles.eventContent}>
                <Text style={[styles.eventTitle, { color: t.colors.text }]} numberOfLines={1}>{formatEventTitle(event.title)}</Text>
                <View style={styles.eventInnerDivider} />
                <View style={styles.eventTimeRow}>
                  <Ionicons name="time-outline" size={12} color={t.colors.textMuted} />
                  <Text style={[styles.eventTimeText, { color: t.colors.textMuted }]}>{event.time || '—'}</Text>
                </View>
                <View style={styles.statusInline}>
                  {event.isPinned && (
                    <View style={styles.statusItem}>
                      <Ionicons name="pin" size={12} color="#0284C7" />
                      <Text style={[styles.statusText, { color: '#0369A1' }]}>Pinned</Text>
                    </View>
                  )}
                  {event.isPinned && (event.isUrgent || event.type) && <Text style={styles.statusSep}>•</Text>}
                  {event.isUrgent && (
                    <View style={styles.statusItem}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={[styles.statusText, { color: '#B91C1C' }]}>Urgent</Text>
                    </View>
                  )}
                  {event.isUrgent && event.type && <Text style={[styles.statusSep, { color: t.colors.textMuted }]}>•</Text>}
                  {!!event.type && (
                    <View style={styles.statusItem}>
                      <Ionicons name="pricetag-outline" size={12} color={event.color} />
                      <Text style={[styles.statusText, { color: event.color }]}>
                        {String(event.type || '').charAt(0).toUpperCase() + String(event.type || '').slice(1)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
            ))}
            </View>
          )}

          {showAllEvents && (
            <View>
            {Array.isArray(groupedEvents) && groupedEvents.map(group => (
            <View key={group.key} style={styles.groupContainer}>
              <Text style={[styles.groupHeaderText, { color: t.colors.textMuted }]}>
                {formatCalendarDate(new Date(group.key))}
              </Text>
              {Array.isArray(group.items) && group.items.map((event: any) => (
            <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
                  onPress={() => {/* User can only view events, not edit */}}
                  accessibilityRole="button"
                  accessibilityLabel={`View event ${event.title}`}
                  accessibilityHint="View event details"
                  activeOpacity={0.7}
                >
                  <View style={[styles.eventAccent, { backgroundColor: event.color }]} />
                  <View style={styles.eventContent}>
                    <Text style={[styles.eventTitle, { color: t.colors.text }]} numberOfLines={1}>{event.title}</Text>
                    <View style={styles.eventInnerDivider} />
                    <View style={styles.eventTimeRow}>
                      <Ionicons name="time-outline" size={12} color={t.colors.textMuted} />
                      <Text style={[styles.eventTimeText, { color: t.colors.textMuted }]}>{event.time || '—'}</Text>
                    </View>
                    <View style={styles.statusInline}>
                      {event.isPinned && (
                        <View style={styles.statusItem}>
                          <Ionicons name="pin" size={12} color="#0284C7" />
                          <Text style={[styles.statusText, { color: '#0369A1' }]}>Pinned</Text>
                        </View>
                      )}
                      {event.isPinned && (event.isUrgent || event.type) && <Text style={styles.statusSep}>•</Text>}
                      {event.isUrgent && (
                        <View style={styles.statusItem}>
                          <Ionicons name="alert-circle" size={12} color="#DC2626" />
                          <Text style={[styles.statusText, { color: '#B91C1C' }]}>Urgent</Text>
                        </View>
                      )}
                      {event.isUrgent && event.type && <Text style={[styles.statusSep, { color: t.colors.textMuted }]}>•</Text>}
                      {!!event.type && (
                        <View style={styles.statusItem}>
                          <Ionicons name="pricetag-outline" size={12} color={event.color} />
                          <Text style={[styles.statusText, { color: event.color }]}>
                            {String(event.type || '').charAt(0).toUpperCase() + String(event.type || '').slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar - Fixed position */}
      <View style={[styles.bottomNavContainer, {
        bottom: 0,
        paddingBottom: safeInsets.bottom,
      }]} collapsable={false}>
      <UserBottomNavBar />
      </View>
    </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  safeAreaTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  scrollView: {
    flex: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  headerSpacer: {
    width: 40,
    height: 33,
    marginLeft: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 998,
  },
  calendarCard: {
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  calendarMonthHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  monthSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthHeaderText: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekDayHeader: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  calendarDay: {
    width: '14.285%', // 100% / 7 days
    aspectRatio: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
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
    color: theme.colors.text,
  },
  todayContainer: {
    backgroundColor: '#2563EB',
  },
  todayText: {
    color: '#fff',
    fontWeight: '700',
  },
  selectedContainer: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  selectedText: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  eventIndicators: {
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  eventsSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emptyStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emptyStateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  segmentItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segmentItemActive: {
    // Background color applied inline for theme awareness
  },
  segmentText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: theme.colors.accent,
  },
  eventsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventsIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  eventsSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: -6,
    marginBottom: 12,
  },
  eventsSubtitleRowEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: -6,
    marginBottom: 12,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  eventAccent: {
    width: 2,
    height: '100%',
    borderRadius: 1,
    marginRight: 10,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  eventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  eventTimeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusSep: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  eventInnerDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 6,
  },
  groupContainer: {
    marginBottom: 12,
  },
  groupHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
});

export default CalendarScreen;
