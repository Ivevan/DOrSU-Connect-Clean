import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const ThemeSwitchOverlay: React.FC = () => {
  const { isDarkMode } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Simulate exit-to-black and return without unmounting screens
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(120),
      Animated.timing(opacity, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [isDarkMode]);

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity }]} />
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    zIndex: 9999,
  },
});

export default ThemeSwitchOverlay;


