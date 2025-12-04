import { useCallback, useMemo, useRef, useState } from 'react';
import { categoryToColors, formatDateKey, normalizeCategory, parseAnyDateToKey } from '../utils/calendarUtils';

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
      // Check for duplicates before adding (by id, _id, or source+title+dateKey combination)
      const existingEvents = dateMap.get(dateKey)!;
      const payloadId = payload.id || payload._id;
      const payloadKey = `${payload.source}-${payload.title}-${payload.dateKey}`;
      
      const isDuplicate = existingEvents.some(e => {
        const existingId = e.id || e._id;
        const existingKey = `${e.source}-${e.title}-${e.dateKey}`;
        
        // Match by ID if both have IDs
        if (payloadId && existingId && payloadId === existingId) {
          return true;
        }
        
        // Match by source+title+dateKey combination (for events without IDs)
        if (payloadKey === existingKey) {
          return true;
        }
        
        // Match by source, title, and dateKey separately (more lenient check)
        if (payload.source === e.source && 
            payload.title === e.title && 
            payload.dateKey === e.dateKey) {
          return true;
        }
        
        return false;
      });
      
      if (!isDuplicate) {
        dateMap.get(dateKey)!.push(payload);
        incrementMonth(year, month);
      }
    };

    // Process posts
    // Normalize categories BEFORE filtering to ensure consistent matching
    const postsForCalendar = posts.filter(post => {
      if (post.source === 'CSV Upload') return false;
      if (!post.category && !post.type) return false; // Skip posts without category
      
      const normalizedCategory = normalizeCategory(post.category || post.type);
      const postType = normalizedCategory.toLowerCase();
      
      // Double-check: ensure the normalized type is valid
      if (!postType || postType.length === 0) return false;
      
      return selectedContentTypesSet.has(postType);
    });

    for (let i = 0; i < postsForCalendar.length; i++) {
      const post = postsForCalendar[i];
      const dateObj = new Date(post.isoDate || post.date);
      if (Number.isNaN(dateObj.getTime())) continue;
      
      const dateKey = formatDateKey(dateObj);
      
      // Normalize category to ensure consistent type
      const normalizedCategory = normalizeCategory(post.category);
      const colors = categoryToColors(normalizedCategory);
      
      const payload = {
        id: post.id,
        title: post.title,
        dateKey,
        time: post.time || '',
        type: normalizedCategory,
        category: normalizedCategory, // Ensure both fields are set
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
    // Normalize categories BEFORE filtering to ensure consistent matching
    const calendarEventsForCalendar = calendarEvents.filter(event => {
      if (!event.category && !event.type) return false; // Skip events without category
      
      const normalizedCategory = normalizeCategory(event.category || event.type);
      const eventType = normalizedCategory.toLowerCase();
      
      // Double-check: ensure the normalized type is valid
      if (!eventType || eventType.length === 0) return false;
      
      return selectedContentTypesSet.has(eventType);
    });

    for (let i = 0; i < calendarEventsForCalendar.length; i++) {
      const event = calendarEventsForCalendar[i];
      // Normalize category to ensure consistent type
      const normalizedCategory = normalizeCategory(event.category);
      const colors = categoryToColors(normalizedCategory);
      
      const payload = {
        ...event,
        id: event._id || `calendar-${event.isoDate || event.startDate}-${event.title}`,
        type: normalizedCategory,
        category: normalizedCategory, // Ensure both fields are set consistently
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

