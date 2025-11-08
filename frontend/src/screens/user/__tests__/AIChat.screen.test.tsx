import React from 'react';
import { renderScreen, screen, waitFor } from '../../../__tests__/screen-test-utils';
import AIChat from '../AIChat';

// Mock UserBottomNavBar
jest.mock('../../../components/navigation/UserBottomNavBar', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return ({ onDashboardPress, onChatPress, onCalendarPress, onSettingsPress }: any) => (
    <View testID="user-bottom-nav-bar">
      <Text testID="nav-dashboard" onPress={onDashboardPress}>Dashboard</Text>
      <Text testID="nav-chat" onPress={onChatPress}>Chat</Text>
      <Text testID="nav-calendar" onPress={onCalendarPress}>Calendar</Text>
      <Text testID="nav-settings" onPress={onSettingsPress}>Settings</Text>
    </View>
  );
});

// Note: useWindowDimensions should be available from react-native preset

describe('AIChat Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render AI Chat screen', async () => {
    renderScreen(<AIChat />);

    await waitFor(() => {
      expect(screen.getByText('DOrSU AI')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should display suggestion cards', async () => {
    renderScreen(<AIChat />);

    await waitFor(() => {
      // Check if at least one suggestion is displayed
      const suggestions = screen.queryAllByText(/How do I|What are|When is/);
      expect(suggestions.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should render message input field', async () => {
    renderScreen(<AIChat />);

    await waitFor(() => {
      const input = screen.queryByPlaceholderText('Type a message to DOrSU AI');
      expect(input).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render bottom navigation bar', async () => {
    renderScreen(<AIChat />);

    await waitFor(() => {
      expect(screen.getByTestId('user-bottom-nav-bar')).toBeTruthy();
    }, { timeout: 3000 });
  });
});

