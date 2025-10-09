export type ThemeMode = 'light' | 'dark';

export const lightTheme = {
  colors: {
    primary: '#1F2937',
    accent: '#2563EB',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    border: 'rgba(0,0,0,0.06)',
    text: '#111827',
    textMuted: '#4B5563',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    chipBg: '#E7EEF9',
    // Additional colors for better dark mode support
    background: '#FFFFFF',
    card: '#FFFFFF',
    textSecondary: '#6B7280',
    icon: '#6B7280',
    iconActive: '#1F2937',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E5E7EB',
  },
  radii: { sm: 8, md: 12, lg: 16, pill: 999 },
  spacing(n: number) {
    return n * 8;
  },
  shadow2: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shadow1: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // NavBar specific shadows
  navBarShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
};

export const darkTheme = {
  colors: {
    primary: '#0B1220',
    accent: '#3B82F6',
    surface: '#1F2937',
    surfaceAlt: '#111827',
    border: 'rgba(255,255,255,0.1)',
    text: '#F9FAFB',
    textMuted: '#9CA3AF',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    chipBg: '#374151',
    // Additional colors for dark mode
    background: '#111827',
    card: '#1F2937',
    textSecondary: '#9CA3AF',
    icon: '#9CA3AF',
    iconActive: '#F9FAFB',
    tabBar: '#1F2937',
    tabBarBorder: '#374151',
  },
  radii: { sm: 8, md: 12, lg: 16, pill: 999 },
  spacing(n: number) {
    return n * 8;
  },
  shadow2: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shadow1: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // NavBar specific shadows
  navBarShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
};

// Default theme (light)
export const theme = lightTheme;

export type Theme = typeof lightTheme;

// Helper function to get theme based on mode
export const getTheme = (isDark: boolean): Theme => {
  return isDark ? darkTheme : lightTheme;
};


