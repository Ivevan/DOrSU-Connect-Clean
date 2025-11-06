import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Animated, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './frontend/src/navigation/AppNavigator';
import { ThemeProvider } from './frontend/src/contexts/ThemeContext';
import { useTheme } from './frontend/src/contexts/ThemeContext';

const Root = () => {
  const { fadeAnim, isAnimating, nextIsDarkMode } = useTheme();
  
  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
      {isAnimating && nextIsDarkMode !== null && (
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: fadeAnim,
              // Use the color of the theme we're transitioning TO
              backgroundColor: nextIsDarkMode ? '#000000' : '#FFFFFF',
            },
          ]}
          pointerEvents="none"
        />
      )}
    </>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Root />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0E9',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
});
