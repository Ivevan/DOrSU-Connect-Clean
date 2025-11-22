import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { useColorScheme, Platform, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, getTheme, ColorTheme, FontSizeScale, fontSizeScales } from '../config/theme';

// Split context into values and actions to reduce re-renders
interface ThemeValuesType {
  isDarkMode: boolean;
  theme: Theme;
  colorTheme: ColorTheme;
  fontSizeScale: FontSizeScale;
}

interface ThemeActionsType {
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  setFontSizeScale: (scale: FontSizeScale) => void;
}

interface ThemeContextType extends ThemeValuesType, ThemeActionsType {
  fadeAnim: Animated.Value;
  isAnimating: boolean;
  nextIsDarkMode: boolean | null;
}

const ThemeValuesContext = createContext<ThemeValuesType | undefined>(undefined);
const ThemeActionsContext = createContext<ThemeActionsType | undefined>(undefined);
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // System scheme (native) + web matchMedia fallback
  const rnScheme = useColorScheme();
  const [webScheme, setWebScheme] = useState<null | 'light' | 'dark'>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const mq: any = (window as any)?.matchMedia?.('(prefers-color-scheme: dark)');
      if (!mq) return;
      const apply = (matches: boolean) => setWebScheme(matches ? 'dark' : 'light');
      apply(!!mq.matches);
      const handler = (e: any) => apply(!!(e.matches ?? e.currentTarget?.matches));
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', handler);
        else if (mq.removeListener) mq.removeListener(handler);
      };
    } catch (_) {}
  }, []);

  // Optional user preference override: 'light' | 'dark' | null (follow system)
  // Initialize with null to show loading state, then load from AsyncStorage
  const [userPreference, setUserPreference] = useState<null | 'light' | 'dark'>(null);
  const [isLoadingTheme, setIsLoadingTheme] = useState(true);
  
  // Color theme preference - default to 'dorsu' (Royal Blue)
  const [selectedColorTheme, setSelectedColorTheme] = useState<ColorTheme>('dorsu');
  
  // Font size scale preference - default to 'medium'
  const [fontSizeScale, setFontSizeScaleState] = useState<FontSizeScale>('medium');
  
  // Load saved theme preference from AsyncStorage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedPreference = await AsyncStorage.getItem('themePreference');
        if (savedPreference === 'light' || savedPreference === 'dark') {
          setUserPreference(savedPreference);
        } else {
          // Default to 'light' if no preference is saved
          setUserPreference('light');
        }
        
        // Load color theme preference
        const savedColorTheme = await AsyncStorage.getItem('colorTheme');
        if (savedColorTheme && ['dorsu', 'facet'].includes(savedColorTheme)) {
          setSelectedColorTheme(savedColorTheme as ColorTheme);
        }
        
        // Load font size scale preference
        const savedFontSizeScale = await AsyncStorage.getItem('fontSizeScale');
        if (savedFontSizeScale && ['small', 'medium', 'large', 'extraLarge'].includes(savedFontSizeScale)) {
          setFontSizeScaleState(savedFontSizeScale as FontSizeScale);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
        // Default to 'light' on error
        setUserPreference('light');
      } finally {
        setIsLoadingTheme(false);
      }
    };
    
    loadThemePreference();
  }, []);
  
  // Save theme preference to AsyncStorage whenever it changes
  useEffect(() => {
    if (!isLoadingTheme && userPreference !== null) {
      AsyncStorage.setItem('themePreference', userPreference).catch(error => {
        console.error('Failed to save theme preference:', error);
      });
    }
  }, [userPreference, isLoadingTheme]);
  
  // Save color theme preference to AsyncStorage whenever it changes
  useEffect(() => {
    if (!isLoadingTheme) {
      AsyncStorage.setItem('colorTheme', selectedColorTheme).catch(error => {
        console.error('Failed to save color theme preference:', error);
      });
    }
  }, [selectedColorTheme, isLoadingTheme]);
  
  // Save font size scale preference to AsyncStorage whenever it changes
  useEffect(() => {
    if (!isLoadingTheme) {
      AsyncStorage.setItem('fontSizeScale', fontSizeScale).catch(error => {
        console.error('Failed to save font size scale preference:', error);
      });
    }
  }, [fontSizeScale, isLoadingTheme]);

  // Animation for theme transition - use refs to avoid triggering re-renders
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isAnimatingRef = useRef(false);
  const previousIsDarkMode = useRef<boolean | null>(null);
  const nextIsDarkMode = useRef<boolean | null>(null);

  // Compute effective mode
  // While loading, default to light mode to prevent flash
  const isDarkMode = useMemo(() => {
    if (isLoadingTheme) return false; // Default to light while loading
    if (userPreference) return userPreference === 'dark';
    const system = Platform.OS === 'web' ? webScheme : (rnScheme ? (rnScheme === 'dark' ? 'dark' : 'light') : null);
    return system === 'dark';
  }, [rnScheme, webScheme, userPreference, isLoadingTheme]);

  // Removed animation trigger - no longer needed for instant theme switching

  // Optimized toggleTheme - INSTANT theme switch, no animation delays
  const toggleTheme = React.useCallback(() => {
    // Calculate the next theme state
    const nextMode = userPreference 
      ? (userPreference === 'dark' ? 'light' : 'dark')
      : (isDarkMode ? 'light' : 'dark');
    
    // Update state IMMEDIATELY - no delays, no animation, no batching
    // This triggers re-renders but should be instant
    setUserPreference(nextMode);
    
    // No animation - instant switch
  }, [userPreference, isDarkMode]);

  const setTheme = React.useCallback((isDark: boolean) => {
    setUserPreference(isDark ? 'dark' : 'light');
  }, []);
  
  const setColorTheme = React.useCallback((colorTheme: ColorTheme) => {
    setSelectedColorTheme(colorTheme);
  }, []);
  
  const setFontSizeScale = React.useCallback((scale: FontSizeScale) => {
    setFontSizeScaleState(scale);
  }, []);

  // Memoize theme calculation to prevent unnecessary recalculations
  const theme = useMemo(() => getTheme(isDarkMode, selectedColorTheme, fontSizeScale), [isDarkMode, selectedColorTheme, fontSizeScale]);

  // Split context values - only changes when theme actually changes
  const values: ThemeValuesType = useMemo(() => ({
    isDarkMode,
    theme,
    colorTheme: selectedColorTheme,
    fontSizeScale,
  }), [isDarkMode, theme, selectedColorTheme, fontSizeScale]);

  // Split context actions - stable, never changes
  const actions: ThemeActionsType = useMemo(() => ({
    toggleTheme,
    setTheme,
    setColorTheme,
    setFontSizeScale,
  }), [toggleTheme, setTheme, setColorTheme, setFontSizeScale]);

  // Full context value for backward compatibility
  const fullValue: ThemeContextType = useMemo(() => ({
    ...values,
    ...actions,
    fadeAnim,
    isAnimating: isAnimatingRef.current,
    nextIsDarkMode: nextIsDarkMode.current,
  }), [values, actions, fadeAnim]);

  return (
    <ThemeValuesContext.Provider value={values}>
      <ThemeActionsContext.Provider value={actions}>
        <ThemeContext.Provider value={fullValue}>
          {children}
        </ThemeContext.Provider>
      </ThemeActionsContext.Provider>
    </ThemeValuesContext.Provider>
  );
};

// Optimized hook - components can use this to avoid re-renders when only actions are needed
export const useThemeActions = (): ThemeActionsType => {
  const context = useContext(ThemeActionsContext);
  if (context === undefined) {
    throw new Error('useThemeActions must be used within a ThemeProvider');
  }
  return context;
};

// Optimized hook - components can use this to only subscribe to theme values
export const useThemeValues = (): ThemeValuesType => {
  const context = useContext(ThemeValuesContext);
  if (context === undefined) {
    throw new Error('useThemeValues must be used within a ThemeProvider');
  }
  return context;
};

// Full hook for backward compatibility - use useThemeValues + useThemeActions when possible
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
