import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Alert, Pressable, Image, Animated, Dimensions, Easing, SectionList, AccessibilityInfo } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserBottomNavBar from '../../components/navigation/UserBottomNavBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../config/theme';
import { useTheme } from '../../contexts/ThemeContext';
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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode, theme: t } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date()); // Default to today
  
  // Draggable calendar state
  const translateY = useRef(new Animated.Value(0)).current;
  const [isMinimized, setIsMinimized] = useState(true); // Start minimized
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const { height: screenHeight } = Dimensions.get('window');
  const CALENDAR_HEIGHT = 280; // Full calendar height - more compact
  const MINIMIZED_HEIGHT = 120; // Minimized to show only current week
  
  // Animation values
  const calendarHeightAnim = useRef(new Animated.Value(MINIMIZED_HEIGHT)).current;
  const calendarOpacityAnim = useRef(new Animated.Value(0.7)).current;
  const dragHandleRotationAnim = useRef(new Animated.Value(0)).current;
  const monthPickerScaleAnim = useRef(new Animated.Value(0)).current;
  const monthPickerOpacityAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.8)).current;

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
    load();
    return () => { cancelled = true; };
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
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
    
    const days = [];
    
    // Add empty cells so that calendar grid starts on Sunday
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  const getMonthName = (date: Date) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[date.getMonth()];
  };

  const getEventsForDate = (date: Date) => {
    const key = formatDateKey(date);
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
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  const getFilteredEvents = () => {
    if (selectedDate && !showAllEvents) {
      return getEventsForDate(selectedDate);
    }
    return posts.map(p => ({
      id: p.id,
      title: p.title,
      dateKey: parseAnyDateToKey(p.isoDate || p.date),
      time: '',
      type: p.category || 'Announcement',
      color: categoryToColors(p.category).dot,
      chip: categoryToColors(p.category),
      isPinned: !!p.isPinned,
      isUrgent: !!p.isUrgent,
    }));
  };

  const getWeekDaysFor = (referenceDate: Date) => {
    const ref = new Date(referenceDate);
    const currentDay = ref.getDay();
    const startOfWeek = new Date(ref);
    startOfWeek.setDate(ref.getDate() - currentDay);
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push(d);
    }
    return weekDays;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const selectMonth = (monthIndex: number) => {
    const newMonth = new Date(currentMonth.getFullYear(), monthIndex, 1);
    setCurrentMonth(newMonth);
    // Ensure the selected date moves into the chosen month so the week view reflects it
    setSelectedDate(new Date(newMonth.getFullYear(), newMonth.getMonth(), 1));
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

  // Drag gesture handlers
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === 5) { // END state
      const { translationY, velocityY } = event.nativeEvent;
      
      if (velocityY > 0) { // Dragging down - expand
        if (translationY > 50 || velocityY > 500) {
          expandCalendar();
        } else {
          minimizeCalendar();
        }
      } else { // Dragging up - minimize
        if (translationY < -50 || velocityY < -500) {
          minimizeCalendar();
        } else {
          expandCalendar();
        }
      }
    }
  };

  const minimizeCalendar = () => {
    setIsMinimized(true);
    
    // Animate calendar collapse
    Animated.parallel([
      Animated.timing(calendarHeightAnim, {
        toValue: MINIMIZED_HEIGHT,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(calendarOpacityAnim, {
        toValue: 0.7,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(dragHandleRotationAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  };

  const expandCalendar = () => {
    setIsMinimized(false);
    
    // Animate calendar expansion
    Animated.parallel([
      Animated.timing(calendarHeightAnim, {
        toValue: CALENDAR_HEIGHT,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(calendarOpacityAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(dragHandleRotationAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  };

  React.useEffect(() => {
    listAnim.setValue(0);
    Animated.timing(listAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    dotScale.setValue(0.8);
    Animated.spring(dotScale, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, [showAllEvents, selectedDate, posts]);

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // Sunday -> Saturday

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={[styles.container, {
      backgroundColor: t.colors.background,
      paddingTop: insets.top,
      paddingBottom: 0, // Remove bottom padding since UserBottomNavBar now handles it
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <StatusBar
          backgroundColor={t.colors.primary}
          barStyle={'light-content'}
        translucent={false}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: t.colors.primary }]}>
          <View style={styles.headerLeft}>
        <TouchableOpacity
              style={styles.monthSelectorButton}
              onPress={openMonthPicker}
              activeOpacity={0.7}
          accessibilityRole="button"
              accessibilityLabel="Open month picker"
              accessibilityHint="Opens a modal to select a month"
            >
              <View style={styles.monthSelectorContent}>
                <Ionicons name="calendar" size={20} color="white" />
                <Text style={styles.headerTitle}>{getMonthName(currentMonth)}</Text>
                <Ionicons name="chevron-down" size={16} color="white" />
              </View>
        </TouchableOpacity>
      </View>
          <View style={styles.headerRight}>
            <View style={styles.headerSpacer} />
            <View style={styles.headerSpacer} />
          </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Calendar Card - Fixed below header */}
        <Animated.View style={[
          styles.calendarCard,
          {
            height: calendarHeightAnim,
            opacity: calendarOpacityAnim,
            backgroundColor: t.colors.card
          }
        ]}>

          
          {/* Week day headers */}
          <View style={[styles.weekHeader, { backgroundColor: t.colors.card }]}>
            {weekDays.map((day, index) => (
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
            {isMinimized ? (
              // Show only the week of the selected date (or first day of currentMonth)
              getWeekDaysFor(selectedDate || new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)).map((date, index) => {
                const day = date.getDate();
                const eventsForDay = getEventsForDate(date);
                const isCurrentDay = isToday(date);
                const isSelectedDay = isSelected(date);
                
                return (
                  <TouchableOpacity 
                    key={index} 
                    style={[styles.calendarDay, { borderColor: t.colors.border }]}
                    onPress={() => { setSelectedDate(date); Haptics.selectionAsync(); }}
                  >
                  <View style={styles.dayContent}>
                      <View style={[
                        styles.dayNumberContainer,
                        isCurrentDay && styles.todayContainer,
                        isSelectedDay && [styles.selectedContainer, { borderColor: t.colors.accent }]
                      ]}>
                        <Text
                          accessibilityRole="button"
                          accessibilityLabel={`Select ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
                          accessibilityHint="Selects this date to view events"
                          style={[
                          styles.dayNumber,
                          { color: t.colors.text },
                          isCurrentDay && styles.todayText,
                          isSelectedDay && [styles.selectedText, { color: t.colors.accent }]
                        ]}>
                          {day}
                        </Text>
                      </View>
                      {/* Event indicators */}
                      {eventsForDay.length > 0 && (
                        <View style={styles.eventIndicators}>
                          {eventsForDay.slice(0, 3).map((event, eventIndex) => (
                            <Animated.View 
                              key={eventIndex} 
                              style={[styles.eventDot, { backgroundColor: event.color, transform: [{ scale: dotScale }] }]} 
                            />
                          ))}
                      </View>
                    )}
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              // Show full month when expanded
              days.map((day, index) => {
                const currentDate = day ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day) : null;
                const eventsForDay = currentDate ? getEventsForDate(currentDate) : [];
                const isCurrentDay = currentDate ? isToday(currentDate) : false;
                const isSelectedDay = currentDate ? isSelected(currentDate) : false;
                
                return (
                  <TouchableOpacity 
                    key={index} 
                    style={[styles.calendarDay, { borderColor: t.colors.border }]}
                    onPress={() => { if (currentDate) { setSelectedDate(currentDate); Haptics.selectionAsync(); } }}
                  >
                    {day ? (
                      <View style={styles.dayContent}>
                        <View style={[
                          styles.dayNumberContainer,
                          isCurrentDay && styles.todayContainer,
                          isSelectedDay && [styles.selectedContainer, { borderColor: t.colors.accent }]
                        ]}>
                          <Text
                            accessibilityRole="button"
                            accessibilityLabel={`Select ${currentDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
                            accessibilityHint="Selects this date to view events"
                            style={[
                            styles.dayNumber,
                            { color: t.colors.text },
                            isCurrentDay && styles.todayText,
                            isSelectedDay && [styles.selectedText, { color: t.colors.accent }]
                          ]}>
                            {day}
                          </Text>
                        </View>
                        {/* Event indicators */}
                        {eventsForDay.length > 0 && (
                          <View style={styles.eventIndicators}>
                            {eventsForDay.slice(0, 3).map((event, eventIndex) => (
                              <Animated.View 
                                key={eventIndex} 
                                style={[styles.eventDot, { backgroundColor: event.color, transform: [{ scale: dotScale }] }]} 
                              />
                            ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[styles.emptyDay, { borderRightColor: t.colors.border, borderBottomColor: t.colors.border }]} />
                )}
                  </TouchableOpacity>
                );
              })
                )}
              </View>

          {/* Calendar Dropdown Indicator */}
          <TouchableOpacity 
            style={[styles.calendarDropdownIndicator, { backgroundColor: t.colors.surfaceAlt, borderTopColor: t.colors.border }]}
            onPress={isMinimized ? expandCalendar : minimizeCalendar}
            activeOpacity={0.7}
          >
            <Animated.View style={[
              styles.dragHandle,
              { backgroundColor: t.colors.border },
              {
                transform: [{
                  rotate: dragHandleRotationAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  })
                }]
              }
            ]} />
          </TouchableOpacity>
        </Animated.View>

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
        <View style={[styles.eventsSection, { backgroundColor: t.colors.card }]}>
          <View style={styles.eventsHeader}>
            <View style={styles.eventsHeaderLeft}>
              <View style={[styles.eventsIconWrap, { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border }]}>
                <Ionicons name="calendar-outline" size={14} color={t.colors.accent} />
        </View>
              <Text style={[styles.eventsTitle, { color: t.colors.text }]}>Events</Text>
            </View>
            <View style={[styles.segmentedToggle, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <TouchableOpacity
                style={[styles.segmentItem, !showAllEvents && [styles.segmentItemActive, { backgroundColor: t.colors.surfaceAlt }]]}
                onPress={() => { setShowAllEvents(false); AccessibilityInfo.announceForAccessibility?.('Switched to Day view'); Haptics.selectionAsync(); }}
                accessibilityRole="button"
                accessibilityLabel="Day view"
              >
                <Text style={[styles.segmentText, { color: t.colors.textMuted }, !showAllEvents && [styles.segmentTextActive, { color: t.colors.accent }]]}>Day</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentItem, showAllEvents && [styles.segmentItemActive, { backgroundColor: t.colors.surfaceAlt }]]}
                onPress={() => { setShowAllEvents(true); AccessibilityInfo.announceForAccessibility?.('Switched to All events'); Haptics.selectionAsync(); }}
                accessibilityRole="button"
                accessibilityLabel="All events"
              >
                <Text style={[styles.segmentText, { color: t.colors.textMuted }, showAllEvents && [styles.segmentTextActive, { color: t.colors.accent }]]}>All</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.eventsSubtitleRowEnhanced}>
            <Text style={[styles.eventsSubtitle, { color: t.colors.textMuted }]} numberOfLines={1}>
              {showAllEvents
                ? 'All dates'
                : selectedDate
                  ? formatDate(selectedDate)
                  : 'All dates'} — {getFilteredEvents().length} {getFilteredEvents().length === 1 ? 'event' : 'events'}
            </Text>
          </View>
          <LinearGradient colors={[t.colors.border, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ height: 1, marginBottom: 10 }} />

          {getFilteredEvents().length === 0 && !isLoadingPosts && (
            <View style={[styles.emptyStateCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
              <View style={[styles.emptyStateIconWrap, { backgroundColor: t.colors.surfaceAlt }]}>
                <Ionicons name="calendar-outline" size={20} color={t.colors.accent} />
              </View>
              <Text style={[styles.emptyStateTitle, { color: t.colors.text }]}>No events yet</Text>
              <Text style={[styles.emptyStateSubtitle, { color: t.colors.textMuted }]}>
                {showAllEvents
                  ? 'No events scheduled at this time.'
                  : `No events for ${selectedDate ? formatDate(selectedDate) : 'this day'}`}
              </Text>
            </View>
          )}

          {isLoadingPosts && (
            <View style={[styles.emptyStateCard, { paddingVertical: 16, overflow: 'hidden', backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
              <LinearGradient colors={[t.colors.surfaceAlt, isDarkMode ? '#111827' : '#fafafa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ ...StyleSheet.absoluteFillObject, opacity: 0.6 }} />
              <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Loading…</Text>
            </View>
          )}

          {!showAllEvents && (
            <Animated.View style={{ opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
            {getFilteredEvents().map((event: any) => (
            <TouchableOpacity
              key={event.id}
              style={[styles.eventCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
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
            </Animated.View>
          )}

          {showAllEvents && (
            <Animated.View style={{ opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
            {getFilteredEvents().map((event: any) => (
            <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
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
            </Animated.View>
          )}
        </View>
      </ScrollView>

      <UserBottomNavBar />
    </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  header: {
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
    marginBottom: 8,
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
    paddingBottom: 120,
  },
  calendarCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    marginBottom: 16,
    ...theme.shadow1,
    overflow: 'hidden',
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
  calendarDropdownIndicator: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
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
  emptyDay: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  eventsSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: 16,
    marginBottom: 16,
    ...theme.shadow1,
  },
  emptyStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#EEF2FF',
    marginBottom: 10,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: '#6B7280',
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
    backgroundColor: theme.colors.surfaceAlt,
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
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
});

export default CalendarScreen;
