// Shared date utility functions for consistent date formatting across the app

/**
 * Format date to Mon DD, YYYY format (e.g., "Sep 12, 2025")
 * @param dateStr - Date string or Date object
 * @returns Formatted date string or original string if invalid
 */
export const formatDate = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return '';
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return typeof dateStr === 'string' ? dateStr : '';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const month = months[date.getMonth()];
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${month} ${day}, ${year}`;
};

/**
 * Compute time ago string (e.g., "2h ago", "3d ago")
 * @param dateStr - Date string or Date object
 * @returns Time ago string or empty string if invalid
 */
export const timeAgo = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return '';
  
  const then = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(then.getTime())) return '';
  
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - then.getTime());
  const minutes = Math.floor(diffMs / 60000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/**
 * Format date for calendar display (e.g., "Sep 12")
 * @param dateStr - Date string or Date object
 * @returns Formatted date string for calendar
 */
export const formatCalendarDate = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return '';
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const month = months[date.getMonth()];
  const day = date.getDate().toString().padStart(2, '0');
  
  return `${month} ${day}`;
};

