/**
 * Mock Calendar Data for DOrSU Calendar Section
 * Temporary mock data for testing and development
 */

import { CalendarEvent } from '../services/CalendarService';

// Get current date for generating relative dates
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();
const currentDay = now.getDate();

// Helper function to create ISO date string
// Creates date at noon local time, then converts to ISO
// This ensures the date is correctly interpreted regardless of timezone
const createISODate = (year: number, month: number, day: number): string => {
  // Create date at noon local time (12:00 PM) to avoid timezone edge cases
  // Using noon ensures the date won't shift when converted to UTC
  const date = new Date(year, month, day, 12, 0, 0, 0);
  // Convert to ISO string - this will include timezone offset
  // But since we use noon, even with timezone conversion, the date should remain correct
  return date.toISOString();
};

// Helper function to create date string
const createDateString = (year: number, month: number, day: number): string => {
  const date = new Date(year, month, day);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

/**
 * Mock Calendar Events
 * Includes events for today, future dates, and past dates
 */
export const mockCalendarEvents: CalendarEvent[] = [
  // Today's Events
  {
    _id: 'mock-1',
    title: 'University Assembly',
    date: createDateString(currentYear, currentMonth, currentDay),
    isoDate: createISODate(currentYear, currentMonth, currentDay),
    time: '8:00 AM',
    category: 'Institutional',
    description: 'Monthly university assembly for all students and faculty members. Important announcements will be made.',
  },
  {
    _id: 'mock-2',
    title: 'Student Council Meeting',
    date: createDateString(currentYear, currentMonth, currentDay),
    isoDate: createISODate(currentYear, currentMonth, currentDay),
    time: '2:00 PM',
    category: 'Academic',
    description: 'Regular meeting of the student council to discuss upcoming events and student concerns.',
  },

  // Future Events (Next few days)
  {
    _id: 'mock-3',
    title: 'Career Guidance Seminar',
    date: createDateString(currentYear, currentMonth, currentDay + 1),
    isoDate: createISODate(currentYear, currentMonth, currentDay + 1),
    time: '9:00 AM',
    category: 'Academic',
    description: 'Seminar on career planning and job opportunities for graduating students.',
  },
  {
    _id: 'mock-4',
    title: 'Sports Festival Opening',
    date: createDateString(currentYear, currentMonth, currentDay + 2),
    isoDate: createISODate(currentYear, currentMonth, currentDay + 2),
    time: '7:00 AM',
    category: 'Event',
    description: 'Annual sports festival opening ceremony. All students are encouraged to attend.',
  },
  {
    _id: 'mock-5',
    title: 'Research Symposium',
    date: createDateString(currentYear, currentMonth, currentDay + 3),
    isoDate: createISODate(currentYear, currentMonth, currentDay + 3),
    time: '1:00 PM',
    category: 'Academic',
    description: 'Presentation of research papers by faculty and students. Open to all interested participants.',
  },
  {
    _id: 'mock-6',
    title: 'Library Workshop',
    date: createDateString(currentYear, currentMonth, currentDay + 4),
    isoDate: createISODate(currentYear, currentMonth, currentDay + 4),
    time: '10:00 AM',
    category: 'Academic',
    description: 'Workshop on using library resources and online databases effectively.',
  },
  {
    _id: 'mock-7',
    title: 'Cultural Night',
    date: createDateString(currentYear, currentMonth, currentDay + 5),
    isoDate: createISODate(currentYear, currentMonth, currentDay + 5),
    time: '6:00 PM',
    category: 'Event',
    description: 'Annual cultural night showcasing talents and traditions from different regions.',
  },
  {
    _id: 'mock-8',
    title: 'Midterm Examination Period',
    date: createDateString(currentYear, currentMonth, currentDay + 7),
    isoDate: createISODate(currentYear, currentMonth, currentDay + 7),
    time: 'All Day',
    category: 'Academic',
    description: 'Midterm examination period begins. Please check your exam schedules.',
  },
  {
    _id: 'mock-9',
    title: 'Alumni Homecoming',
    date: createDateString(currentYear, currentMonth, currentDay + 10),
    isoDate: createISODate(currentYear, currentMonth, currentDay + 10),
    time: '3:00 PM',
    category: 'Event',
    description: 'Annual alumni homecoming event. All alumni are welcome to join.',
  },
  {
    _id: 'mock-10',
    title: 'Science Fair',
    date: createDateString(currentYear, currentMonth, currentDay + 12),
    isoDate: createISODate(currentYear, currentMonth, currentDay + 12),
    time: '8:00 AM',
    category: 'Academic',
    description: 'Annual science fair showcasing student projects and innovations.',
  },

  // Past Events (Last few days)
  {
    _id: 'mock-11',
    title: 'Orientation Program',
    date: createDateString(currentYear, currentMonth, currentDay - 1),
    isoDate: createISODate(currentYear, currentMonth, currentDay - 1),
    time: '9:00 AM',
    category: 'Academic',
    description: 'Orientation program for new students. Campus tour and introduction to facilities.',
  },
  {
    _id: 'mock-12',
    title: 'Faculty Development Training',
    date: createDateString(currentYear, currentMonth, currentDay - 2),
    isoDate: createISODate(currentYear, currentMonth, currentDay - 2),
    time: '2:00 PM',
    category: 'Academic',
    description: 'Training session for faculty members on new teaching methodologies.',
  },
  {
    _id: 'mock-13',
    title: 'Health and Wellness Day',
    date: createDateString(currentYear, currentMonth, currentDay - 3),
    isoDate: createISODate(currentYear, currentMonth, currentDay - 3),
    time: '8:00 AM',
    category: 'Event',
    description: 'Free health check-up and wellness activities for all students and staff.',
  },
  {
    _id: 'mock-14',
    title: 'Book Fair',
    date: createDateString(currentYear, currentMonth, currentDay - 5),
    isoDate: createISODate(currentYear, currentMonth, currentDay - 5),
    time: '9:00 AM',
    category: 'Event',
    description: 'Annual book fair featuring various publishers and discounted books.',
  },
  {
    _id: 'mock-15',
    title: 'Scholarship Application Deadline',
    date: createDateString(currentYear, currentMonth, currentDay - 7),
    isoDate: createISODate(currentYear, currentMonth, currentDay - 7),
    time: '5:00 PM',
    category: 'Academic',
    description: 'Deadline for scholarship applications. Submit all required documents.',
  },
];

/**
 * Get mock calendar events
 * @param useMock - Set to true to return mock data, false to return empty array
 */
export const getMockCalendarEvents = (useMock: boolean = true): CalendarEvent[] => {
  if (!useMock) {
    return [];
  }
  return mockCalendarEvents;
};

