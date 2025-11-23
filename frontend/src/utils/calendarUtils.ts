/**
 * Calendar utility functions
 */

export const categoryToColors = (category?: string) => {
  const key = String(category || '').toLowerCase();
  switch (key) {
    case 'announcement':
      return { dot: '#1A3E7A', chipBg: '#E8F0FF', chipBorder: '#CCE0FF', chipText: '#1A3E7A', cellColor: '#1A3E7A' }; // Blue for Announcement
    case 'academic':
      return { dot: '#10B981', chipBg: '#ECFDF5', chipBorder: '#BBF7D0', chipText: '#065F46', cellColor: '#10B981' }; // Green for Academic
    case 'institutional':
      return { dot: '#2563EB', chipBg: '#EEF2FF', chipBorder: '#E0E7FF', chipText: '#1D4ED8', cellColor: '#2563EB' }; // Blue for Institutional
    case 'event':
      return { dot: '#D97706', chipBg: '#FEF3C7', chipBorder: '#FDE68A', chipText: '#92400E', cellColor: '#D97706' }; // Orange for Event
    case 'news':
      return { dot: '#8B5CF6', chipBg: '#F3E8FF', chipBorder: '#E9D5FF', chipText: '#6D28D9', cellColor: '#8B5CF6' }; // Purple for News
    case 'service':
      return { dot: '#059669', chipBg: '#ECFDF5', chipBorder: '#BBF7D0', chipText: '#065F46', cellColor: '#059669' };
    case 'infrastructure':
      return { dot: '#DC2626', chipBg: '#FEE2E2', chipBorder: '#FECACA', chipText: '#991B1B', cellColor: '#DC2626' };
    default:
      return { dot: '#2563EB', chipBg: '#EEF2FF', chipBorder: '#E0E7FF', chipText: '#1D4ED8', cellColor: '#2563EB' };
  }
};

export const formatDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseAnyDateToKey = (input: any): string | null => {
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

