import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { ThemeProvider } from '../contexts/ThemeContext';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockSetOptions = jest.fn();

export const mockNavigation = {
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
};

export const mockRoute = {
  key: 'test-route-key',
  name: 'TestScreen',
  params: {},
  path: undefined,
};

// Note: Navigation mocks are in jest.setup.js

interface ScreenTestWrapperProps {
  children: React.ReactNode;
}

const ScreenTestWrapper: React.FC<ScreenTestWrapperProps> = ({ children }) => {
  return <ThemeProvider>{children}</ThemeProvider>;
};

interface ScreenRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  navigation?: any;
  route?: any;
}

export const renderScreen = (
  ui: ReactElement,
  { navigation, route, ...renderOptions }: ScreenRenderOptions = {}
) => {
  // Update mocks if custom navigation/route provided
  if (navigation) {
    Object.assign(mockNavigation, navigation);
  }
  if (route) {
    Object.assign(mockRoute, route);
  }

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ScreenTestWrapper>{children}</ScreenTestWrapper>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Re-export everything from test-utils
export * from './test-utils';

// Re-export screen-specific utilities
export { mockNavigation, mockRoute };

