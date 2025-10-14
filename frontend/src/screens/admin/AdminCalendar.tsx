import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Animated, Dimensions, Modal, Easing, AccessibilityInfo } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/navigation/AdminBottomNavBar';
import AdminDataService from '../../services/AdminDataService';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDate, formatCalendarDate } from '../../utils/dateUtils';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined;
  AIChat: undefined;
  UserSettings: undefined;
  Calendar: undefined;
  AdminDashboard: undefined;
  AdminAIChat: undefined;
  AdminSettings: undefined;
  AdminCalendar: undefined;
  PostUpdate: { postId?: string } | undefined;
  ManagePosts: undefined;
};

// Constants
const CALENDAR_HEIGHT = 280;
const MINIMIZED_HEIGHT = 120;
const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper functions
const formatEventTitle = (raw?: string) => {
  const title = String(raw || '').trim();
  if (title.length < 3) return 'Untitled';
  const cleaned = title.replace(/\s+/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const categoryToColors = (category?: string) => {
  const key = String(category || '').toLowerCase();
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
  const maybe = new Date(input);
  if (!isNaN(maybe.getTime())) return formatDateKey(maybe);
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
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  return days;
};

const getMonthName = (date: Date) => MONTH_NAMES[date.getMonth()];

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

const AdminCalendar = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode, theme } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  
  // Calendar state
  const translateY = useRef(new Animated.Value(0)).current;
  const [isMinimized, setIsMinimized] = useState(true);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  
  // Animation values
  const calendarHeightAnim = useRef(new Animated.Value(MINIMIZED_HEIGHT)).current;
  const calendarOpacityAnim = useRef(new Animated.Value(0.7)).current;
  const dragHandleRotationAnim = useRef(new Animated.Value(0)).current;
  const monthPickerScaleAnim = useRef(new Animated.Value(0)).current;
  const monthPickerOpacityAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.8)).current;


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

  const days = getDaysInMonth(currentMonth);

  // Helper functions
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

  const getTasksForDate = (_date: Date) => {
    return [] as any[];
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
    return posts.map(transformPostToEvent);
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

  const getAllEventsGrouped = () => {
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

  const getMonthEventCount = (dateRef: Date) => {
    const y = dateRef.getFullYear();
    const m = dateRef.getMonth() + 1;
    return posts.reduce((acc, p) => {
      const key = parseAnyDateToKey(p.isoDate || p.date);
      if (!key) return acc;
      const [yy, mm] = key.split('-');
      return acc + ((Number(yy) === y && Number(mm) === m) ? 1 : 0);
    }, 0);
  };

  const getFilteredTasks = () => {
    if (selectedDate) {
      return getTasksForDate(selectedDate);
    }
    return [] as any[];
  };

  const renderCalendarDay = (date: Date, day: number | null, isCurrentDay: boolean, isSelectedDay: boolean, key: number) => {
    if (!day) return <View key={key} style={[styles.emptyDay, { borderRightColor: theme.colors.border, borderBottomColor: theme.colors.border }]} />;
    
    const eventsForDay = getEventsForDate(date);
    
    return (
      <TouchableOpacity 
        key={key}
        style={[styles.calendarDay, { borderRightColor: theme.colors.border, borderBottomColor: theme.colors.border }]}
        onPress={() => { setSelectedDate(date); Haptics.selectionAsync(); }}
      >
        <View style={styles.dayContent}>
          <View style={[
            styles.dayNumberContainer,
            isCurrentDay && styles.todayContainer,
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={[styles.container, {
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
      paddingBottom: 0, // Remove bottom padding since AdminBottomNavBar now handles it
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <StatusBar
        backgroundColor={theme.colors.primary}
        barStyle={isDarkMode ? "light-content" : "light-content"}
        translucent={true}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
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
            backgroundColor: theme.colors.card,
            height: calendarHeightAnim,
            opacity: calendarOpacityAnim,
          }
        ]}>

          
          {/* Week day headers */}
          <View style={[styles.weekHeader, { backgroundColor: theme.colors.card }]}>
            {WEEK_DAYS.map((day, index) => (
              <View key={index} style={[styles.weekDayHeader, { borderRightColor: theme.colors.border }]}>
                <Text
                  style={[styles.weekDayText, { color: theme.colors.textMuted }]}
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
              // Show only the week of the selected date
              getWeekDaysFor(selectedDate || new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)).map((date, index) => {
                const day = date.getDate();
                const isCurrentDay = isToday(date);
                const isSelectedDay = isSelected(date);
                return renderCalendarDay(date, day, isCurrentDay, !!isSelectedDay, index);
              })
            ) : (
              // Show full month when expanded
              days.map((day, index) => {
                const currentDate = day ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day) : null;
                const isCurrentDay = currentDate ? isToday(currentDate) : false;
                const isSelectedDay = currentDate ? isSelected(currentDate) : false;
                return renderCalendarDay(currentDate || new Date(), day, isCurrentDay, !!isSelectedDay, index);
              })
            )}
          </View>

          {/* Calendar Dropdown Indicator */}
          <TouchableOpacity 
            style={[styles.calendarDropdownIndicator, { backgroundColor: theme.colors.surfaceAlt, borderTopColor: theme.colors.border }]}
            onPress={isMinimized ? expandCalendar : minimizeCalendar}
            activeOpacity={0.7}
          >
            <Animated.View style={[
              styles.dragHandle,
              { backgroundColor: theme.colors.border },
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
        <Modal
          visible={showMonthPicker}
          transparent={true}
          animationType="none"
          onRequestClose={closeMonthPicker}
        >
          <Animated.View style={[
            styles.modalOverlay,
            { opacity: monthPickerOpacityAnim }
          ]}>
            <Animated.View style={[
              styles.monthPickerModal,
              { backgroundColor: theme.colors.card },
              {
                transform: [{ scale: monthPickerScaleAnim }]
              }
            ]}>
              <View style={styles.monthPickerHeader}>
                <TouchableOpacity 
                  onPress={closeMonthPicker}
                  style={styles.monthPickerBackButton}
                >
                  <Ionicons name="arrow-back" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
                <Text style={[styles.monthPickerTitle, { color: theme.colors.text }]}>{currentMonth.getFullYear()}</Text>
                <View style={styles.monthPickerSpacer} />
              </View>
              
              <View style={styles.monthPickerGrid}>
                {MONTH_NAMES.map((month, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.monthPickerCard,
                      { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                      currentMonth.getMonth() === index && styles.monthPickerCardSelected
                    ]}
                    onPress={() => selectMonth(index)}
                  >
                    <Text style={[
                      styles.monthPickerText,
                      { color: theme.colors.text },
                      currentMonth.getMonth() === index && styles.monthPickerTextSelected
                    ]}>
                      {month.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
            ))}
          </View>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Day Summary removed by request (Events section already shows count) */}


        {/* Events Section */}
        <View style={[styles.eventsSection, { backgroundColor: theme.colors.card }]}>
          <View style={styles.eventsHeader}>
            <View style={styles.eventsHeaderLeft}>
              <View style={[styles.eventsIconWrap, { borderColor: theme.colors.border }]}>
                <Ionicons name="calendar-outline" size={14} color={theme.colors.accent} />
        </View>
              <Text style={[styles.eventsTitle, { color: theme.colors.text }]}>Events</Text>
            </View>
            <View style={[styles.segmentedToggle, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.segmentItem, !showAllEvents && styles.segmentItemActive]}
                onPress={() => { setShowAllEvents(false); AccessibilityInfo.announceForAccessibility?.('Switched to Day view'); Haptics.selectionAsync(); }}
                accessibilityRole="button"
                accessibilityLabel="Day view"
              >
                <Text style={[styles.segmentText, { color: theme.colors.textMuted }, !showAllEvents && styles.segmentTextActive]}>Day</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentItem, showAllEvents && styles.segmentItemActive]}
                onPress={() => { setShowAllEvents(true); AccessibilityInfo.announceForAccessibility?.('Switched to All events'); Haptics.selectionAsync(); }}
                accessibilityRole="button"
                accessibilityLabel="All events"
              >
                <Text style={[styles.segmentText, { color: theme.colors.textMuted }, showAllEvents && styles.segmentTextActive]}>All</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.eventsSubtitleRowEnhanced}>
            <Text style={[styles.eventsSubtitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {showAllEvents
                ? 'All dates'
                : selectedDate
                  ? formatDate(selectedDate)
                  : 'All dates'} — {getFilteredEvents().length} {getFilteredEvents().length === 1 ? 'event' : 'events'}
            </Text>
            {false && isMinimized && (
              <Text style={styles.monthHelperText}>
                {currentMonth.toLocaleDateString('en-US', { month: 'long' })} • {getMonthEventCount(currentMonth)} events
              </Text>
            )}
          </View>
          <LinearGradient colors={[theme.colors.border, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ height: 1, marginBottom: 10 }} />

          {getFilteredEvents().length === 0 && !isLoadingPosts && (
            <View style={[styles.emptyStateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.emptyStateIconWrap}>
                <Ionicons name="calendar-outline" size={20} color="#6366F1" />
              </View>
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No events yet</Text>
              <Text style={[styles.emptyStateSubtitle, { color: theme.colors.textMuted }]}>
                {showAllEvents
                  ? 'Create your first event or announcement.'
                  : `No events for ${selectedDate ? formatDate(selectedDate) : 'this day'}`}
              </Text>
              <TouchableOpacity style={[styles.emptyStateBtn, { borderColor: theme.colors.border }]} onPress={() => navigation.navigate('PostUpdate')}>
                <Ionicons name="add" size={14} color="#6366F1" />
                <Text style={styles.emptyStateBtnText}>Add Event</Text>
          </TouchableOpacity>
            </View>
          )}

          {isLoadingPosts && (
            <View style={[styles.emptyStateCard, { paddingVertical: 16, overflow: 'hidden' }]}>
              <LinearGradient colors={[theme.colors.surfaceAlt, '#fafafa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ ...StyleSheet.absoluteFillObject, opacity: 0.6 }} />
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Loading…</Text>
            </View>
          )}

          {!showAllEvents && (
            <Animated.View style={{ opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
            {false && getFilteredEvents().length === 0 && (
              <View />
            )}
            {getFilteredEvents().map((event: any) => (
            <TouchableOpacity
              key={event.id}
              style={[styles.eventCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => navigation.navigate('PostUpdate', { postId: event.id })}
              accessibilityRole="button"
              accessibilityLabel={`Open event ${event.title}`}
              accessibilityHint="Opens the event to view or edit"
              activeOpacity={0.7}
            >
              <View style={[styles.eventAccent, { backgroundColor: event.color }]} />
              <View style={styles.eventContent}>
                <Text style={[styles.eventTitle, { color: theme.colors.text }]} numberOfLines={1}>{formatEventTitle(event.title)}</Text>
                <View style={styles.eventInnerDivider} />
                <View style={styles.eventTimeRow}>
                  <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                  <Text style={[styles.eventTimeText, { color: theme.colors.textMuted }]}>{event.time || '—'}</Text>
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
                  {event.isUrgent && event.type && <Text style={styles.statusSep}>•</Text>}
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
            {groupedEvents.map(group => (
            <View key={group.key} style={styles.groupContainer}>
              <Text style={[styles.groupHeaderText, { color: theme.colors.textMuted }]}>
                {formatCalendarDate(new Date(group.key))}
              </Text>
              {group.items.map((event: any) => (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => navigation.navigate('PostUpdate', { postId: event.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open event ${event.title}`}
                  accessibilityHint="Opens the event to view or edit"
                  activeOpacity={0.7}
                >
                  <View style={[styles.eventAccent, { backgroundColor: event.color }]} />
                  <View style={styles.eventContent}>
                    <Text style={[styles.eventTitle, { color: theme.colors.text }]} numberOfLines={1}>{event.title}</Text>
                    <View style={styles.eventInnerDivider} />
                    <View style={styles.eventTimeRow}>
                      <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                      <Text style={[styles.eventTimeText, { color: theme.colors.textMuted }]}>{event.time || '—'}</Text>
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
                      {event.isUrgent && event.type && <Text style={styles.statusSep}>•</Text>}
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
            </Animated.View>
          )}
        </View>
      </ScrollView>

      <AdminBottomNavBar
        activeTab="calendar"
        onDashboardPress={() => navigation.navigate('AdminDashboard')}
        onChatPress={() => navigation.navigate('AdminAIChat')}
        onAddPress={() => { /* future: open create flow */ }}
        onCalendarPress={() => navigation.navigate('AdminCalendar')}
        onSettingsPress={() => navigation.navigate('AdminSettings')}
        onPostUpdatePress={() => navigation.navigate('PostUpdate')}
        onManagePostPress={() => navigation.navigate('ManagePosts')}
      />
    </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
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
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    borderTopWidth: 1,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  monthPickerModal: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  monthPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  monthPickerBackButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  monthPickerSpacer: {
    width: 32,
  },
  monthPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    paddingTop: 0,
    gap: 8,
  },
  monthPickerCard: {
    width: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  monthPickerCardSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  monthPickerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthPickerTextSelected: {
    fontWeight: '700',
  },
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekDayHeader: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
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
  },
  todayText: {
    fontWeight: '700',
  },
  selectedContainer: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  selectedText: {
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
    width: '14.285%', // 100% / 7 days
    aspectRatio: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  eventsSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  emptyStateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyStateBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  segmentedToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  segmentItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segmentItemActive: {
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  segmentTextActive: {
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
  },
  eventsBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  eventsBadgeCompact: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 6,
  },
  eventsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eventsSubtitle: {
    fontSize: 12,
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
  eventsHeaderDivider: {
    height: 1,
    marginBottom: 10,
  },
  monthHelperText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  groupContainer: {
    marginBottom: 12,
  },
  groupHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  eventSmallTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  eventSmallTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  addEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  addEventText: {
    fontSize: 14,
    fontWeight: '600',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
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
    fontWeight: '700',
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
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
    fontWeight: '700',
  },
  eventTypeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  eventTypeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  daySummarySection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  daySummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  daySummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  daySummaryDate: {
    fontSize: 24,
    fontWeight: '800',
  },
  daySummaryInfo: {
    flex: 1,
  },
  daySummaryDay: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  daySummaryCount: {
    fontSize: 12,
  },
  eventInnerDivider: {
    height: 1,
    marginVertical: 6,
  },
  inlineCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  inlineCalloutText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  inlineCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  inlineCreateText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default AdminCalendar;
