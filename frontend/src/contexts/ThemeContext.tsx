import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef, useCallback } from 'react';
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
  
  // Refs to track pending saves for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSavesRef = useRef<{
    themePreference?: 'light' | 'dark';
    colorTheme?: ColorTheme;
    fontSizeScale?: FontSizeScale;
  }>({});
  
  // Debounced batch save function - batches all AsyncStorage writes
  const debouncedBatchSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      const pending = pendingSavesRef.current;
      if (Object.keys(pending).length === 0) return;
      
      try {
        // Batch all AsyncStorage writes together for better performance
        const updates: Array<[string, string]> = [];
        
        if (pending.themePreference !== undefined) {
          updates.push(['themePreference', pending.themePreference]);
        }
        if (pending.colorTheme !== undefined) {
          updates.push(['colorTheme', pending.colorTheme]);
        }
        if (pending.fontSizeScale !== undefined) {
          updates.push(['fontSizeScale', pending.fontSizeScale]);
        }
        
        // Use multiSet for better performance - all writes in one operation
        if (updates.length > 0) {
          await AsyncStorage.multiSet(updates);
        }
        
        // Clear pending saves after successful write
        pendingSavesRef.current = {};
      } catch (error) {
        console.error('Failed to save theme preferences:', error);
      } finally {
        saveTimeoutRef.current = null;
      }
    }, 300); // 300ms debounce delay - batches rapid changes
  }, []);
  
  // Load saved theme preference from AsyncStorage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        // Use multiGet for better performance - load all preferences in one operation
        const keys = ['themePreference', 'colorTheme', 'fontSizeScale'];
        const values = await AsyncStorage.multiGet(keys);
        const preferences = Object.fromEntries(values);
        
        // Set theme preference
        const savedPreference = preferences.themePreference;
        if (savedPreference === 'light' || savedPreference === 'dark') {
          setUserPreference(savedPreference);
        } else {
          setUserPreference('light');
        }
        
        // Set color theme preference
        const savedColorTheme = preferences.colorTheme;
        if (savedColorTheme && ['dorsu', 'facet'].includes(savedColorTheme)) {
          setSelectedColorTheme(savedColorTheme as ColorTheme);
        }
        
        // Set font size scale preference
        const savedFontSizeScale = preferences.fontSizeScale;
        if (savedFontSizeScale && ['small', 'medium', 'large', 'extraLarge'].includes(savedFontSizeScale)) {
          setFontSizeScaleState(savedFontSizeScale as FontSizeScale);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
        setUserPreference('light');
      } finally {
        setIsLoadingTheme(false);
      }
    };
    
    loadThemePreference();
  }, []);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  
  // Batch save preferences with debouncing - watch for changes and save automatically
  useEffect(() => {
    if (isLoadingTheme || userPreference === null) return;
    pendingSavesRef.current.themePreference = userPreference;
    debouncedBatchSave();
  }, [userPreference, isLoadingTheme, debouncedBatchSave]);
  
  useEffect(() => {
    if (isLoadingTheme) return;
    pendingSavesRef.current.colorTheme = selectedColorTheme;
    debouncedBatchSave();
  }, [selectedColorTheme, isLoadingTheme, debouncedBatchSave]);
  
  useEffect(() => {
    if (isLoadingTheme) return;
    pendingSavesRef.current.fontSizeScale = fontSizeScale;
    debouncedBatchSave();
  }, [fontSizeScale, isLoadingTheme, debouncedBatchSave]);

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

  // Optimized toggleTheme - INSTANT theme switch, optimized state update
  // Uses functional state update to avoid dependency on isDarkMode
  const toggleTheme = useCallback(() => {
    setUserPreference(prev => {
      // If following system (null), check system preference and toggle from it
      if (prev === null) {
        const systemMode = Platform.OS === 'web' 
          ? (webScheme === 'dark' ? 'dark' : 'light')
          : (rnScheme === 'dark' ? 'dark' : 'light');
        return systemMode === 'dark' ? 'light' : 'dark';
      }
      // Otherwise toggle between light and dark
      return prev === 'dark' ? 'light' : 'dark';
    });
  }, [rnScheme, webScheme]);

  const setTheme = useCallback((isDark: boolean) => {
    setUserPreference(isDark ? 'dark' : 'light');
  }, []);
  
  const setColorTheme = useCallback((colorTheme: ColorTheme) => {
    setSelectedColorTheme(colorTheme);
  }, []);
  
  const setFontSizeScale = useCallback((scale: FontSizeScale) => {
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
