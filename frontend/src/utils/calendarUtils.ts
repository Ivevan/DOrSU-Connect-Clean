/**
 * Calendar utility functions
 */

// Normalize category to consistent casing (first letter uppercase, rest lowercase)
// Also handles plural forms and common variations
export const normalizeCategory = (category?: string): string => {
  if (!category) return 'Announcement';
  const trimmed = String(category).trim();
  if (trimmed.length === 0) return 'Announcement';
  
  // Convert to lowercase first to handle all cases
  const lower = trimmed.toLowerCase();
  
  // Handle plural forms and common variations
  if (lower === 'events' || lower === 'event') {
    return 'Event';
  }
  if (lower === 'announcements' || lower === 'announcement') {
    return 'Announcement';
  }
  if (lower === 'academics' || lower === 'academic') {
    return 'Academic';
  }
  if (lower === 'institutionals' || lower === 'institutional') {
    return 'Institutional';
  }
  if (lower === 'news' || lower === 'new') {
    return 'News';
  }
  
  // Default: capitalize first letter, lowercase rest
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

export const categoryToColors = (category?: string) => {
  const key = String(category || '').toLowerCase();
  switch (key) {
    case 'academic':
      return { dot: '#2563EB', chipBg: '#EEF2FF', chipBorder: '#E0E7FF', chipText: '#1D4ED8', cellColor: '#2563EB' }; // Blue - calm, serious, organized
    case 'institutional':
      return { dot: '#4B5563', chipBg: '#F3F4F6', chipBorder: '#E5E7EB', chipText: '#1F2937', cellColor: '#4B5563' }; // Dark Gray - neutral, official-looking
    case 'announcement':
      return { dot: '#EAB308', chipBg: '#FEF9C3', chipBorder: '#FDE047', chipText: '#854D0E', cellColor: '#EAB308' }; // Yellow - bright, attention-grabbing
    case 'event':
      return { dot: '#10B981', chipBg: '#ECFDF5', chipBorder: '#BBF7D0', chipText: '#065F46', cellColor: '#10B981' }; // Green - friendly, inviting
    case 'news':
      return { dot: '#EF4444', chipBg: '#FEE2E2', chipBorder: '#FECACA', chipText: '#991B1B', cellColor: '#EF4444' }; // Red - stands out, signals new/important
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

