import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { useColorScheme, Platform, Animated } from 'react-native';
import { Theme, getTheme } from '../config/theme';

interface ThemeContextType {
  isDarkMode: boolean;
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
  fadeAnim: Animated.Value;
  isAnimating: boolean;
  nextIsDarkMode: boolean | null;
}

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
  // Default to 'light' mode on app launch
  const [userPreference, setUserPreference] = useState<null | 'light' | 'dark'>('light');

  // Animation for theme transition
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false);
  const previousIsDarkMode = useRef<boolean | null>(null);
  const nextIsDarkMode = useRef<boolean | null>(null);

  // Compute effective mode
  const isDarkMode = useMemo(() => {
    if (userPreference) return userPreference === 'dark';
    const system = Platform.OS === 'web' ? webScheme : (rnScheme ? (rnScheme === 'dark' ? 'dark' : 'light') : null);
    return system === 'dark';
  }, [rnScheme, webScheme, userPreference]);

  // Trigger animation when theme changes (for system changes)
  useEffect(() => {
    if (previousIsDarkMode.current !== null && previousIsDarkMode.current !== isDarkMode) {
      // Only animate if it's a system change, not a user toggle
      // (user toggles are handled in toggleTheme)
      if (!userPreference) {
        triggerAnimation(isDarkMode);
      }
    }
    previousIsDarkMode.current = isDarkMode;
  }, [isDarkMode, userPreference]);

  // Animation function
  const triggerAnimation = (willBeDark: boolean) => {
    nextIsDarkMode.current = willBeDark;
    setIsAnimating(true);
    fadeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsAnimating(false);
      nextIsDarkMode.current = null;
    });
  };

  const toggleTheme = () => {
    // Calculate the next theme state
    const nextMode = userPreference 
      ? (userPreference === 'dark' ? 'light' : 'dark')
      : (isDarkMode ? 'light' : 'dark');
    const willBeDark = nextMode === 'dark';
    
    // Start animation immediately before state change
    triggerAnimation(willBeDark);
    
    // Update state immediately after starting animation
    setUserPreference(nextMode);
  };

  const setTheme = (isDark: boolean) => {
    setUserPreference(isDark ? 'dark' : 'light');
  };

  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);

  const value: ThemeContextType = {
    isDarkMode,
    theme,
    toggleTheme,
    setTheme,
    fadeAnim,
    isAnimating,
    nextIsDarkMode: nextIsDarkMode.current,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
