/**
 * DOrSU Connect Color Palette
 * 
 * This file defines the official color palette for the DOrSU Connect application
 * with their symbolic meanings and usage guidelines.
 */

/**
 * Primary Color Palette
 * These colors represent the core identity and values of DOrSU Connect
 */
export const colorPalette = {
  /**
   * Royal Blue - Primary Color
   * Represents: Excellence, Spirituality, and Competence
   * Usage: Primary actions, active states, student indicators, main UI elements
   */
  royalBlue: {
    primary: '#2563EB',      // Primary Royal Blue
    dark: '#1E3A8A',         // University Blue (darker variant)
    light: '#3B82F6',        // Lighter variant for hover states
    veryLight: '#DBEAFE',    // Very light for backgrounds
    rgba: {
      light: 'rgba(37, 99, 235, 0.1)',
      medium: 'rgba(37, 99, 235, 0.2)',
      dark: 'rgba(37, 99, 235, 0.4)',
    },
  },

  /**
   * Golden Yellow - Secondary Color
   * Represents: Commitment and Integrity
   * Usage: Faculty indicators, special highlights, important notices
   */
  goldenYellow: {
    primary: '#FBBF24',      // Golden Yellow
    dark: '#F59E0B',         // Amber (darker variant)
    light: '#FCD34D',        // Lighter variant
    veryLight: '#FEF3C7',    // Very light for backgrounds
    rgba: {
      light: 'rgba(251, 191, 36, 0.1)',
      medium: 'rgba(251, 191, 36, 0.2)',
      dark: 'rgba(251, 191, 36, 0.4)',
    },
  },

  /**
   * Background Gradients
   * Used for screen backgrounds to create depth and visual interest
   */
  gradients: {
    light: {
      primary: '#FBF8F3',    // Light beige
      secondary: '#F8F5F0',  // Medium beige
      tertiary: '#F5F2ED',   // Darker beige
    },
    dark: {
      primary: '#0B1220',    // Dark blue-black
      secondary: '#111827',  // Dark gray-blue
      tertiary: '#1F2937',   // Dark gray
    },
  },
} as const;

/**
 * Semantic Color Mappings
 * Maps colors to their semantic meanings for easy reference
 */
export const semanticColors = {
  // User Type Colors
  student: colorPalette.royalBlue.primary,      // Royal Blue for students
  faculty: colorPalette.goldenYellow.primary,   // Golden Yellow for faculty
  
  // Status Colors
  active: colorPalette.royalBlue.primary,
  inactive: '#9CA3AF',
  
  // Action Colors
  primary: colorPalette.royalBlue.primary,
  secondary: colorPalette.goldenYellow.primary,
} as const;

/**
 * Color Usage Guidelines
 * 
 * Royal Blue (#2563EB):
 * - Use for primary buttons, links, and interactive elements
 * - Use for student-related indicators and badges
 * - Use for active states and selected items
 * - Use for navigation highlights
 * 
 * University Blue (#1E3A8A):
 * - Use as a darker variant of Royal Blue
 * - Use for hover states on Royal Blue elements
 * - Use for emphasis when Royal Blue needs more contrast
 * 
 * Golden Yellow (#FBBF24):
 * - Use for faculty-related indicators and badges
 * - Use for special highlights and important notices
 * - Use for secondary actions that need to stand out
 * 
 * Amber (#F59E0B):
 * - Use as a darker variant of Golden Yellow
 * - Use for hover states on Golden Yellow elements
 * - Use for warnings and important alerts
 */

// Export individual colors for convenience
export const COLORS = {
  // Royal Blue variants
  ROYAL_BLUE: colorPalette.royalBlue.primary,
  UNIVERSITY_BLUE: colorPalette.royalBlue.dark,
  ROYAL_BLUE_LIGHT: colorPalette.royalBlue.light,
  ROYAL_BLUE_VERY_LIGHT: colorPalette.royalBlue.veryLight,
  
  // Golden Yellow variants
  GOLDEN_YELLOW: colorPalette.goldenYellow.primary,
  AMBER: colorPalette.goldenYellow.dark,
  GOLDEN_YELLOW_LIGHT: colorPalette.goldenYellow.light,
  GOLDEN_YELLOW_VERY_LIGHT: colorPalette.goldenYellow.veryLight,
  
  // Semantic
  STUDENT: semanticColors.student,
  FACULTY: semanticColors.faculty,
  ACTIVE: semanticColors.active,
  PRIMARY: semanticColors.primary,
  SECONDARY: semanticColors.secondary,
} as const;

