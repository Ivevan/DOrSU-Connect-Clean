import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useThemeValues } from '../../contexts/ThemeContext';
import ReconnectionService from '../../services/ReconnectionService';

const ConnectionRestoredNotification: React.FC = () => {
  const { isConnected, isInternetReachable, wasOffline } = useNetworkStatus();
  const { theme } = useThemeValues();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const [isVisible, setIsVisible] = React.useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOnline = isConnected && isInternetReachable;

  useEffect(() => {
    // Show notification when connection is restored after being offline
    if (isOnline && wasOffline) {
      setIsVisible(true);
      
      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Auto-hide after 4 seconds
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setIsVisible(false);
        });
      }, 4000);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      // Hide if offline again
      if (!isOnline) {
        setIsVisible(false);
        slideAnim.setValue(-100);
      }
    }
  }, [isOnline, wasOffline, slideAnim]);

  if (!isVisible || !isOnline) {
    return null;
  }

  const queueSize = ReconnectionService.getQueueSize();
  const message = queueSize > 0 
    ? `Connection restored! Retrying ${queueSize} ${queueSize === 1 ? 'request' : 'requests'}...`
    : 'Connection restored!';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.success || '#10B981',
          paddingTop: insets.top + 4,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
        <Text style={styles.text}>{message}</Text>
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
    zIndex: 10000,
    elevation: 10000,
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

export default ConnectionRestoredNotification;

