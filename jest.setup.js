// Jest setup file for testing
import '@testing-library/jest-native/extend-expect';

// Mock React Native modules
try {
  jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));
} catch (e) {
  // Ignore if module doesn't exist
}

// Mock Expo modules
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  notificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: React.forwardRef((props, ref) => <View ref={ref} {...props} />),
  };
});

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: jest.fn(() => jest.fn()),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
  })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = {};
  return {
    getItem: jest.fn((key) => Promise.resolve(storage[key] || null)),
    setItem: jest.fn((key, value) => {
      storage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key) => {
      delete storage[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key]);
      return Promise.resolve();
    }),
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name, size, color, ...props }) => (
      <Text testID={`icon-${name}`} {...props}>
        {name}
      </Text>
    ),
    MaterialIcons: ({ name, size, color, ...props }) => (
      <Text testID={`icon-${name}`} {...props}>
        {name}
      </Text>
    ),
    MaterialCommunityIcons: ({ name, size, color, ...props }) => (
      <Text testID={`icon-${name}`} {...props}>
        {name}
      </Text>
    ),
  };
});

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    default: {
      View: React.View,
      Text: React.Text,
      Image: React.Image,
      ScrollView: React.ScrollView,
      createAnimatedComponent: (component) => component,
    },
    Easing: {
      linear: () => {},
      ease: () => {},
      quad: () => {},
      cubic: () => {},
    },
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (fn) => fn(),
    withTiming: (value) => value,
    withSpring: (value) => value,
    withRepeat: (value) => value,
    withSequence: (...values) => values[0],
  };
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children, ...props }) => <View {...props}>{children}</View>,
    GestureDetector: ({ children }) => <View>{children}</View>,
    Gesture: {
      Tap: () => ({ onStart: () => {} }),
      Pan: () => ({ onStart: () => {} }),
    },
    GestureState: {
      BEGAN: 1,
      ACTIVE: 2,
      END: 3,
      FAILED: 4,
      CANCELLED: 5,
    },
  };
});

// Note: useWindowDimensions is already available from react-native
// If needed, we can add it to the react-native mock, but it should work as-is

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockReset = jest.fn();
  const mockSetOptions = jest.fn();
  
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      reset: mockReset,
      setOptions: mockSetOptions,
      canGoBack: jest.fn(() => true),
      dispatch: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
      removeListener: jest.fn(),
      isFocused: jest.fn(() => true),
      getParent: jest.fn(),
      getState: jest.fn(),
      getId: jest.fn(),
    }),
    useRoute: () => ({
      key: 'test-route-key',
      name: 'TestScreen',
      params: {},
      path: undefined,
    }),
    useFocusEffect: jest.fn(),
  };
});

// Mock @react-navigation/native-stack
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: ({ children }) => children,
    Screen: ({ children }) => children,
  })),
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

