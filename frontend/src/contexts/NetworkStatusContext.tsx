import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

interface NetworkStatusContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: NetInfoStateType | null;
}

const NetworkStatusContext = createContext<NetworkStatusContextType | undefined>(undefined);

interface NetworkStatusProviderProps {
  children: ReactNode;
}

export const NetworkStatusProvider: React.FC<NetworkStatusProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean>(true);
  const [type, setType] = useState<NetInfoStateType | null>(null);

  useEffect(() => {
    // Get initial network state
    const getInitialNetworkState = async () => {
      try {
        const networkState: NetInfoState = await NetInfo.fetch();
        setIsConnected(networkState.isConnected ?? false);
        setIsInternetReachable(networkState.isInternetReachable ?? false);
        setType(networkState.type ?? null);
      } catch (error) {
        console.error('Error getting initial network state:', error);
        // Default to connected if we can't determine
        setIsConnected(true);
        setIsInternetReachable(true);
      }
    };

    getInitialNetworkState();

    // Set up listener for network state changes
    const unsubscribe = NetInfo.addEventListener((networkState: NetInfoState) => {
      setIsConnected(networkState.isConnected ?? false);
      setIsInternetReachable(networkState.isInternetReachable ?? false);
      setType(networkState.type ?? null);
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

