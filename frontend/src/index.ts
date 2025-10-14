// Main entry point for the frontend application
// This file exports all the main components and utilities

// Components
export { default as AdminBottomNavBar } from './components/navigation/AdminBottomNavBar';
export { default as UserBottomNavBar } from './components/navigation/UserBottomNavBar';
export { default as LetterGlitch } from './components/common/LetterGlitch';
export { default as ThemeSwitchOverlay } from './components/common/ThemeSwitchOverlay';
export { default as ThemeTestComponent } from './components/common/ThemeTestComponent';

// Navigation
export { default as AppNavigator } from './navigation/AppNavigator';

// Contexts
export { ThemeProvider, useTheme } from './contexts/ThemeContext';

// Configuration
export { lightTheme, darkTheme, getTheme, type ThemeMode, type Theme } from './config/theme';

// Types
export * from './types';

// Utils
export * from './utils/dateUtils';

// Services
export { default as AdminDataService } from './services/AdminDataService';
