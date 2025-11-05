import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './frontend/src/navigation/AppNavigator';
import { ThemeProvider } from './frontend/src/contexts/ThemeContext';
import { useTheme } from './frontend/src/contexts/ThemeContext';
// import ThemeSwitchOverlay from './frontend/src/components/common/ThemeSwitchOverlay'; // Commented out because the module cannot be found

const Root = () => {
  const { isDarkMode } = useTheme();
  
  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
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
  container:   {
    flex: 1,
    backgroundColor: '#F2F0E9',
  },
});
