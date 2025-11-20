import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ConnectionRestoredNotification from './frontend/src/components/common/ConnectionRestoredNotification';
import NetworkStatusIndicator from './frontend/src/components/common/NetworkStatusIndicator';
import { AuthProvider } from './frontend/src/contexts/AuthContext';
import { NetworkStatusProvider } from './frontend/src/contexts/NetworkStatusContext';
import { ThemeProvider } from './frontend/src/contexts/ThemeContext';
import AppNavigator from './frontend/src/navigation/AppNavigator';
import NotificationService from './frontend/src/services/NotificationService';

const Root = () => {
  // Initialize notification session on app startup and when app comes to foreground
  useEffect(() => {
    // Initialize on mount
    NotificationService.initializeNewSession();
    
    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground - initialize new session to allow notifications again
        NotificationService.initializeNewSession();
      }
    });
    
    return () => {
      subscription?.remove();
    };
  }, []);

  // Animation overlay disabled for instant theme switching
  return (
    <>
      <AppNavigator />
      <NetworkStatusIndicator />
      <ConnectionRestoredNotification />
      <StatusBar style="auto" />
    </>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NetworkStatusProvider>
          <AuthProvider>
            <ThemeProvider>
              <Root />
            </ThemeProvider>
          </AuthProvider>
        </NetworkStatusProvider>
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
