import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import ReconnectionService from '../services/ReconnectionService';

interface NetworkStatusContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: NetInfoStateType | null;
  wasOffline: boolean;
}

const NetworkStatusContext = createContext<NetworkStatusContextType | undefined>(undefined);

interface NetworkStatusProviderProps {
  children: ReactNode;
}

export const NetworkStatusProvider: React.FC<NetworkStatusProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean>(true);
  const [type, setType] = useState<NetInfoStateType | null>(null);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const previousOnlineState = useRef<boolean>(true);

  useEffect(() => {
    // Get initial network state
    const getInitialNetworkState = async () => {
      try {
        const networkState: NetInfoState = await NetInfo.fetch();
        const wasOnline = (networkState.isConnected ?? false) && (networkState.isInternetReachable ?? false);
        setIsConnected(networkState.isConnected ?? false);
        setIsInternetReachable(networkState.isInternetReachable ?? false);
        setType(networkState.type ?? null);
        previousOnlineState.current = wasOnline;
      } catch (error) {
        console.error('Error getting initial network state:', error);
        // Default to connected if we can't determine
        setIsConnected(true);
        setIsInternetReachable(true);
        previousOnlineState.current = true;
      }
    };

    getInitialNetworkState();

    // Set up listener for network state changes
    const unsubscribe = NetInfo.addEventListener((networkState: NetInfoState) => {
      const isOnline = (networkState.isConnected ?? false) && (networkState.isInternetReachable ?? false);
      const wasOnline = previousOnlineState.current;
      
      setIsConnected(networkState.isConnected ?? false);
      setIsInternetReachable(networkState.isInternetReachable ?? false);
      setType(networkState.type ?? null);

      // Detect when connection is restored (was offline, now online)
      if (!wasOnline && isOnline) {
        console.log('✅ Connection restored! Processing queued requests...');
        setWasOffline(true);
        
        // Notify reconnection service
        ReconnectionService.notifyConnectionRestored();
        
        // Process queued requests after a short delay to ensure connection is stable
        setTimeout(() => {
          ReconnectionService.processQueue();
        }, 1000);
      }

      // Track offline state
      if (!isOnline) {
        setWasOffline(true);
      } else if (wasOffline && isOnline) {
        // Reset wasOffline flag after connection is restored
        setTimeout(() => {
          setWasOffline(false);
        }, 5000);
      }

      previousOnlineState.current = isOnline;
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const value: NetworkStatusContextType = {
    isConnected,
    isInternetReachable,
    type,
    wasOffline,
  };

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

export const useNetworkStatus = (): NetworkStatusContextType => {
  const context = useContext(NetworkStatusContext);
  if (context === undefined) {
    throw new Error('useNetworkStatus must be used within a NetworkStatusProvider');
  }
  return context;
};

