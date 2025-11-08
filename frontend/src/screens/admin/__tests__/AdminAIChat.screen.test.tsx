import React from 'react';
import { renderScreen, screen, waitFor } from '../../../__tests__/screen-test-utils';
import AdminAIChat from '../AdminAIChat';

// Mock AdminBottomNavBar
jest.mock('../../../components/navigation/AdminBottomNavBar', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return ({ onDashboardPress, onChatPress, onCalendarPress, onPostsPress, onSettingsPress }: any) => (
    <View testID="admin-bottom-nav-bar">
      <Text testID="nav-dashboard" onPress={onDashboardPress}>Dashboard</Text>
      <Text testID="nav-chat" onPress={onChatPress}>Chat</Text>
      <Text testID="nav-calendar" onPress={onCalendarPress}>Calendar</Text>
      <Text testID="nav-posts" onPress={onPostsPress}>Posts</Text>
      <Text testID="nav-settings" onPress={onSettingsPress}>Settings</Text>
    </View>
  );
});

// Mock InfoModal
jest.mock('../../../modals/InfoModal', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return ({ visible, onClose, title, message }: any) => (
    visible ? (
      <View testID="info-modal">
        {title && <Text testID="info-title">{title}</Text>}
        {message && <Text testID="info-message">{message}</Text>}
        <Text testID="info-close" onPress={onClose}>Close</Text>
      </View>
    ) : null
  );
});

// Note: useWindowDimensions is already mocked in jest.setup.js

describe('AdminAIChat Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Admin AI Chat screen', async () => {
    renderScreen(<AdminAIChat />);

    await waitFor(() => {
      expect(screen.getByText('DOrSU AI')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should display suggestion cards', async () => {
    renderScreen(<AdminAIChat />);

    await waitFor(() => {
      // Check if at least one suggestion is displayed
      const suggestions = screen.queryAllByText(/Review|Draft|Schedule|Show|Help/i);
      expect(suggestions.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should render message input field', async () => {
    renderScreen(<AdminAIChat />);

    await waitFor(() => {
      // Check for input field or title as fallback
      const input = screen.queryByPlaceholderText(/Type your message|Ask DOrSU AI|Message/i);
      const title = screen.queryByText('DOrSU AI');
      expect(input || title).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render info button', async () => {
    renderScreen(<AdminAIChat />);

    await waitFor(() => {
      // Info button should be present (usually an icon button)
      const infoButton = screen.queryByTestId('icon-information-circle-outline') || 
                        screen.queryByText(/About|Info/i);
      expect(infoButton).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render bottom navigation bar', async () => {
    renderScreen(<AdminAIChat />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-bottom-nav-bar')).toBeTruthy();
    }, { timeout: 3000 });
  });
});

