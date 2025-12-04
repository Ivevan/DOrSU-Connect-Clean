import { useCallback, useMemo, useRef, useState } from 'react';
import { categoryToColors, formatDateKey, parseAnyDateToKey } from '../utils/calendarUtils';

// Build date range more efficiently
const buildDateRange = (startISO?: string, endISO?: string): Date[] => {
  if (!startISO || !endISO) return [];
  
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }
  
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  
  const daysDiff = Math.floor((endTime - startTime) / (1000 * 60 * 60 * 24));
  if (daysDiff > 365) {
    return [new Date(startTime), new Date(endTime)];
  }
  
  const dates: Date[] = [];
  const current = new Date(startTime);
  const maxDays = Math.min(daysDiff + 1, 365);
  
  for (let i = 0; i <= maxDays; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

interface UseCalendarOptions {
  posts: any[];
  calendarEvents: any[];
  selectedContentTypesSet: Set<string>;
}

export const useCalendar = ({ posts, calendarEvents, selectedContentTypesSet }: UseCalendarOptions) => {
  // Process events and posts into date map
  const { eventsByDateMap, monthEventCountMap } = useMemo(() => {
    const dateMap = new Map<string, any[]>();
    const monthMap = new Map<string, number>();

    const incrementMonth = (year: number, month: number) => {
      const key = `${year}-${month}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    };

    const addEventInstance = (dateKey: string, year: number, month: number, payload: any) => {
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(payload);
      incrementMonth(year, month);
    };

    // Process posts
    const postsForCalendar = posts.filter(post => {
      if (post.source === 'CSV Upload') return false;
      const postType = String(post.category || 'Announcement').toLowerCase();
      return selectedContentTypesSet.has(postType);
    });

    for (let i = 0; i < postsForCalendar.length; i++) {
      const post = postsForCalendar[i];
      const dateObj = new Date(post.isoDate || post.date);
      if (Number.isNaN(dateObj.getTime())) continue;
      
      const dateKey = formatDateKey(dateObj);
      const colors = categoryToColors(post.category || 'Announcement');
      
      const payload = {
        id: post.id,
        title: post.title,
        dateKey,
        time: post.time || '',
        type: post.category || 'Announcement',
        color: colors.dot,
        chip: colors,
        description: post.description,
        isPinned: post.isPinned,
        isUrgent: post.isUrgent,
        source: 'post',
      };
      
      addEventInstance(dateKey, dateObj.getFullYear(), dateObj.getMonth() + 1, payload);
    }

    // Process calendar events
    const calendarEventsForCalendar = calendarEvents.filter(event => {
      const eventType = String(event.category || 'Announcement').toLowerCase();
      return selectedContentTypesSet.has(eventType);
    });

    for (let i = 0; i < calendarEventsForCalendar.length; i++) {
      const event = calendarEventsForCalendar[i];
      const colors = categoryToColors(event.category || 'Announcement');
      
      const payload = {
        ...event,
        id: event._id || `calendar-${event.isoDate || event.startDate}-${event.title}`,
        type: event.category || 'Announcement',
        color: colors.dot,
        chip: colors,
        source: 'calendar',
      };

      const dateType = String(event.dateType || '');
      if (dateType === 'month_only' || dateType === 'week_in_month' || 
          dateType === 'week' || dateType === 'month') {
        if (event.year && event.month) {
          incrementMonth(event.year, event.month);
        }
        continue;
      }

      if (event.dateType === 'date_range' && event.startDate && event.endDate) {
        const start = new Date(event.startDate);
        const end = new Date(event.endDate);
        
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff > 90) {
            const startKey = formatDateKey(start);
            const endKey = formatDateKey(end);
            addEventInstance(startKey, start.getFullYear(), start.getMonth() + 1, payload);
            if (startKey !== endKey) {
              addEventInstance(endKey, end.getFullYear(), end.getMonth() + 1, payload);
            }
          } else {
            const rangeDates = buildDateRange(event.startDate, event.endDate);
            for (let j = 0; j < rangeDates.length; j++) {
              const dateObj = rangeDates[j];
              const dateKey = formatDateKey(dateObj);
              addEventInstance(dateKey, dateObj.getFullYear(), dateObj.getMonth() + 1, payload);
            }
          }
        }
      } else {
        const fallbackDate = event.isoDate || event.date || event.startDate;
        if (fallbackDate) {
          const dateObj = new Date(fallbackDate);
          if (!Number.isNaN(dateObj.getTime())) {
            const dateKey = formatDateKey(dateObj);
            addEventInstance(dateKey, dateObj.getFullYear(), dateObj.getMonth() + 1, payload);
          }
        }
      }
    }

    return { eventsByDateMap: dateMap, monthEventCountMap: monthMap };
  }, [posts, calendarEvents, selectedContentTypesSet]);

  const getMonthEventCount = useCallback((dateRef: Date) => {
    const key = `${dateRef.getFullYear()}-${dateRef.getMonth() + 1}`;
    return monthEventCountMap.get(key) || 0;
  }, [monthEventCountMap]);

  const getEventsForDate = useCallback((date: Date) => {
    const key = formatDateKey(date);
    return eventsByDateMap.get(key) || [];
  }, [eventsByDateMap]);

  return {
    eventsByDateMap,
    monthEventCountMap,
    getMonthEventCount,
    getEventsForDate,
  };
};

