export type ThemeMode = 'light' | 'dark';
export type ColorTheme = 'facet' | 'fnahs' | 'fals';
export type FontSizeScale = 'small' | 'medium' | 'large' | 'extraLarge';

// Font size multipliers
export const fontSizeScales: Record<FontSizeScale, number> = {
  small: 0.85,
  medium: 1.0,
  large: 1.15,
  extraLarge: 1.3,
};

// Color Palettes - Each faculty/department can have its own color scheme
export const colorPalettes = {
  facet: {
    primary: '#FF9500',        // Orange - Main accent color
    primaryLight: '#FFA726',   // Lighter orange for hover states
    primaryDark: '#F57C00',    // Darker orange for pressed states
    secondary: '#2563EB',      // Blue - Secondary actions
    success: '#10B981',        // Green - Success states
    error: '#EF4444',          // Red - Error states
    warning: '#F59E0B',        // Yellow - Warning states
    // Gradient backgrounds
    gradientLight: ['#FBF8F3', '#F8F5F0', '#F5F2ED'],  // Soft beige gradient (light mode)
    gradientDark: ['#0B1220', '#111827', '#1F2937'],   // Dark gradient
    // Floating orb colors
    orbColors: {
      orange1: 'rgba(255, 149, 0, 0.3)',
      orange2: 'rgba(255, 149, 0, 0.2)',
      orange3: 'rgba(255, 165, 100, 0.45)',
      orange4: 'rgba(255, 180, 120, 0.18)',
      orange5: 'rgba(255, 200, 100, 0.4)',
      beige1: 'rgba(255, 220, 180, 0.35)',
      beige2: 'rgba(255, 200, 150, 0.18)',
      beige3: 'rgba(255, 230, 200, 0.08)',
    },
  },
  fnahs: {
    primary: '#F59E0B',        // Golden Yellow
    primaryLight: '#FBBF24',   // Lighter golden yellow
    primaryDark: '#D97706',    // Darker golden yellow
    secondary: '#FF9500',      // Orange
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    gradientLight: ['#FFFBEB', '#FEF3C7', '#FDE68A'],  // Light yellow gradient
    gradientDark: ['#0B1220', '#111827', '#1F2937'],
    orbColors: {
      orange1: 'rgba(245, 158, 11, 0.3)',
      orange2: 'rgba(245, 158, 11, 0.2)',
      orange3: 'rgba(251, 191, 36, 0.45)',
      orange4: 'rgba(252, 211, 77, 0.18)',
      orange5: 'rgba(253, 224, 71, 0.4)',
      beige1: 'rgba(254, 243, 199, 0.35)',
      beige2: 'rgba(253, 230, 138, 0.18)',
      beige3: 'rgba(255, 251, 235, 0.08)',
    },
  },
  fals: {
    primary: '#047857',        // Dark Green
    primaryLight: '#059669',   // Lighter dark green
    primaryDark: '#065F46',    // Darker green
    secondary: '#10B981',      // Emerald
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    gradientLight: ['#ECFDF5', '#D1FAE5', '#A7F3D0'],  // Light green gradient
    gradientDark: ['#0B1220', '#111827', '#1F2937'],
    orbColors: {
      orange1: 'rgba(4, 120, 87, 0.3)',
      orange2: 'rgba(4, 120, 87, 0.2)',
      orange3: 'rgba(5, 150, 105, 0.45)',
      orange4: 'rgba(16, 185, 129, 0.18)',
      orange5: 'rgba(52, 211, 153, 0.4)',
      beige1: 'rgba(209, 250, 229, 0.35)',
      beige2: 'rgba(167, 243, 208, 0.18)',
      beige3: 'rgba(236, 253, 245, 0.08)',
    },
  },
};

// Function to get theme with color palette applied
const createTheme = (isDark: boolean, colorTheme: ColorTheme = 'facet', fontSizeScale: FontSizeScale = 'medium') => {
  const palette = colorPalettes[colorTheme];
  const fontSizeMultiplier = fontSizeScales[fontSizeScale];
  
  return isDark ? {
    colors: {
      primary: '#0B1220',
      accent: palette.primary,           // Use color theme primary
      accentLight: palette.primaryLight,
      accentDark: palette.primaryDark,
      surface: '#1F2937',
      surfaceAlt: '#111827',
      border: 'rgba(255,255,255,0.1)',
      text: '#F9FAFB',
      textMuted: '#9CA3AF',
      success: palette.success,
      warning: palette.warning,
      danger: palette.error,
      chipBg: '#374151',
      background: '#111827',
      card: '#1F2937',
      textSecondary: '#9CA3AF',
      icon: '#9CA3AF',
      iconActive: '#F9FAFB',
      tabBar: '#1F2937',
      tabBarBorder: '#374151',
      // Gradient colors
      gradientColors: palette.gradientDark,
      // Orb colors
      orbColors: palette.orbColors,
    },
    radii: { sm: 8, md: 12, lg: 16, pill: 999 },
    fontSize: {
      scale: fontSizeScale,
      multiplier: fontSizeMultiplier,
      // Helper function to scale font sizes
      scaleSize(size: number): number {
        return size * fontSizeMultiplier;
      },
    },
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
    navBarShadow: {
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: -2 },
      elevation: 12,
    },
  } : {
    colors: {
      primary: '#1F2937',
      accent: palette.primary,           // Use color theme primary
      accentLight: palette.primaryLight,
      accentDark: palette.primaryDark,
      surface: '#FFFFFF',
      surfaceAlt: '#F8FAFC',
      border: 'rgba(0,0,0,0.06)',
      text: '#111827',
      textMuted: '#4B5563',
      success: palette.success,
      warning: palette.warning,
      danger: palette.error,
      chipBg: '#E7EEF9',
      background: '#FFFFFF',
      card: '#FFFFFF',
      textSecondary: '#6B7280',
      icon: '#6B7280',
      iconActive: '#1F2937',
      tabBar: '#FFFFFF',
      tabBarBorder: '#E5E7EB',
      // Gradient colors
      gradientColors: palette.gradientLight,
      // Orb colors
      orbColors: palette.orbColors,
    },
    radii: { sm: 8, md: 12, lg: 16, pill: 999 },
    fontSize: {
      scale: fontSizeScale,
      multiplier: fontSizeMultiplier,
      // Helper function to scale font sizes
      scaleSize(size: number): number {
        return size * fontSizeMultiplier;
      },
    },
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
    navBarShadow: {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: -2 },
      elevation: 12,
    },
  };
};

// Backward compatibility - default themes with 'facet' palette and 'medium' font size
export const lightTheme = createTheme(false, 'facet', 'medium');
export const darkTheme = createTheme(true, 'facet', 'medium');

// Default theme (light)
export const theme = lightTheme;

export type Theme = typeof lightTheme;

// Cache theme objects to prevent recreation on every call
const themeCache = new Map<string, Theme>();

// Helper function to get theme based on mode and color theme - returns cached objects
export const getTheme = (isDark: boolean, colorTheme: ColorTheme = 'facet', fontSizeScale: FontSizeScale = 'medium'): Theme => {
  const cacheKey = `${isDark ? 'dark' : 'light'}-${colorTheme}-${fontSizeScale}`;
  
  if (!themeCache.has(cacheKey)) {
    themeCache.set(cacheKey, createTheme(isDark, colorTheme, fontSizeScale));
  }
  
  return themeCache.get(cacheKey)!;
};

// Get available color themes with their display names
export const getColorThemes = (): Array<{ id: ColorTheme; name: string; color: string }> => [
  { id: 'facet', name: 'Facet', color: colorPalettes.facet.primary },
  { id: 'fnahs', name: 'FNAHS', color: colorPalettes.fnahs.primary },
  { id: 'fals', name: 'FALS', color: colorPalettes.fals.primary },
];


