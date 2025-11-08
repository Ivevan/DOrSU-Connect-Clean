import { formatDate, timeAgo, formatCalendarDate } from '../dateUtils';

describe('dateUtils', () => {
  describe('formatDate', () => {
    it('should format a valid date string correctly', () => {
      const dateStr = '2025-11-08T00:00:00.000Z';
      const result = formatDate(dateStr);
      expect(result).toBe('Nov 08, 2025');
    });

    it('should format a Date object correctly', () => {
      const date = new Date(2025, 10, 8); // November 8, 2025
      const result = formatDate(date);
      expect(result).toBe('Nov 08, 2025');
    });

    it('should handle single digit days with padding', () => {
      const date = new Date(2025, 0, 5); // January 5, 2025
      const result = formatDate(date);
      expect(result).toBe('Jan 05, 2025');
    });

    it('should return empty string for undefined', () => {
      const result = formatDate(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for null', () => {
      const result = formatDate(null as any);
      expect(result).toBe('');
    });

    it('should return original string for invalid date string', () => {
      const invalidDate = 'invalid-date';
      const result = formatDate(invalidDate);
      expect(result).toBe(invalidDate);
    });

    it('should return empty string for invalid Date object', () => {
      const invalidDate = new Date('invalid');
      const result = formatDate(invalidDate);
      expect(result).toBe('');
    });

    it('should format different months correctly', () => {
      const months = [
        { month: 0, expected: 'Jan' },
        { month: 5, expected: 'Jun' },
        { month: 11, expected: 'Dec' },
      ];

      months.forEach(({ month, expected }) => {
        const date = new Date(2025, month, 15);
        const result = formatDate(date);
        expect(result).toContain(expected);
      });
    });
  });

  describe('timeAgo', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-11-08T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return "just now" for dates less than 1 minute ago', () => {
      const date = new Date('2025-11-08T11:59:30.000Z');
      const result = timeAgo(date);
      expect(result).toBe('just now');
    });

    it('should return minutes ago for dates less than 1 hour ago', () => {
      const date = new Date('2025-11-08T11:30:00.000Z');
      const result = timeAgo(date);
      expect(result).toBe('30m ago');
    });

    it('should return hours ago for dates less than 24 hours ago', () => {
      const date = new Date('2025-11-08T08:00:00.000Z');
      const result = timeAgo(date);
      expect(result).toBe('4h ago');
    });

    it('should return days ago for dates more than 24 hours ago', () => {
      const date = new Date('2025-11-06T12:00:00.000Z');
      const result = timeAgo(date);
      expect(result).toBe('2d ago');
    });

    it('should return empty string for undefined', () => {
      const result = timeAgo(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for null', () => {
      const result = timeAgo(null as any);
      expect(result).toBe('');
    });

    it('should return empty string for invalid date', () => {
      const result = timeAgo('invalid-date');
      expect(result).toBe('');
    });

    it('should handle future dates by returning "just now"', () => {
      const futureDate = new Date('2025-11-09T12:00:00.000Z');
      const result = timeAgo(futureDate);
      expect(result).toBe('just now');
    });

    it('should handle date strings correctly', () => {
      const dateStr = '2025-11-08T10:00:00.000Z';
      const result = timeAgo(dateStr);
      expect(result).toBe('2h ago');
    });
  });

  describe('formatCalendarDate', () => {
    it('should format a valid date string correctly', () => {
      const dateStr = '2025-11-08T00:00:00.000Z';
      const result = formatCalendarDate(dateStr);
      expect(result).toBe('Nov 08');
    });

    it('should format a Date object correctly', () => {
      const date = new Date(2025, 10, 8); // November 8, 2025
      const result = formatCalendarDate(date);
      expect(result).toBe('Nov 08');
    });

    it('should handle single digit days with padding', () => {
      const date = new Date(2025, 0, 5); // January 5, 2025
      const result = formatCalendarDate(date);
      expect(result).toBe('Jan 05');
    });

    it('should return empty string for undefined', () => {
      const result = formatCalendarDate(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for null', () => {
      const result = formatCalendarDate(null as any);
      expect(result).toBe('');
    });

    it('should return empty string for invalid date string', () => {
      const result = formatCalendarDate('invalid-date');
      expect(result).toBe('');
    });

    it('should return empty string for invalid Date object', () => {
      const invalidDate = new Date('invalid');
      const result = formatCalendarDate(invalidDate);
      expect(result).toBe('');
    });

    it('should format different months correctly', () => {
      const months = [
        { month: 0, expected: 'Jan' },
        { month: 5, expected: 'Jun' },
        { month: 11, expected: 'Dec' },
      ];

      months.forEach(({ month, expected }) => {
        const date = new Date(2025, month, 15);
        const result = formatCalendarDate(date);
        expect(result).toContain(expected);
      });
    });

    it('should not include year in the output', () => {
      const date = new Date(2025, 10, 8);
      const result = formatCalendarDate(date);
      expect(result).not.toContain('2025');
      expect(result).toBe('Nov 08');
    });
  });
});

