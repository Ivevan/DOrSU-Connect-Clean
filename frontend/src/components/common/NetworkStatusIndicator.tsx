import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useThemeValues } from '../../contexts/ThemeContext';

const NetworkStatusIndicator: React.FC = () => {
  const { isConnected, isInternetReachable, type } = useNetworkStatus();
  const { theme } = useThemeValues();
  const insets = useSafeAreaInsets();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const [isVisible, setIsVisible] = React.useState(true);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOnline = isConnected && isInternetReachable;

  React.useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Show indicator when status changes
    setIsVisible(true);
    fadeAnim.setValue(0);
    
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // If online, fade out after 3 seconds
    if (isOnline) {
      timeoutRef.current = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setIsVisible(false);
        });
      }, 3000); // Show for 3 seconds then fade out
    }
    // If offline, keep it visible (don't fade out)

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isOnline, fadeAnim]);

  const getConnectionTypeLabel = () => {
    if (isOnline) {
      if (!type) return 'Online';
      switch (type) {
        case 'wifi':
          return 'Online - WiFi';
        case 'cellular':
          return 'Online - Mobile Data';
        case 'ethernet':
          return 'Online - Ethernet';
        default:
          return 'Online';
      }
    } else {
      if (!type) return 'Offline';
      switch (type) {
        case 'wifi':
          return 'WiFi (No Internet)';
        case 'cellular':
          return 'Mobile (No Internet)';
        case 'ethernet':
          return 'Ethernet (No Internet)';
        case 'none':
          return 'Offline';
        default:
          return 'No Internet';
      }
    }
  };

  const getIconName = () => {
    if (isOnline) {
      return 'cloud-done-outline';
    }
    return 'cloud-offline-outline';
  };

  const getBackgroundColor = () => {
    if (isOnline) {
      return theme.colors.success || '#10B981'; // Green for online
    }
    // Use 'danger' from theme, which is mapped from the palette's error color
    return theme.colors.danger || '#EF4444'; // Red for offline
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          paddingTop: insets.top + 4,
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={getIconName()} size={18} color="#FFFFFF" />
        <Text style={styles.text}>{getConnectionTypeLabel()}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NetworkStatusIndicator;

