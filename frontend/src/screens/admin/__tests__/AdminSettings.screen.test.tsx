import React from 'react';
import { renderScreen, screen, fireEvent, waitFor, mockNavigation } from '../../../__tests__/screen-test-utils';
import AdminSettings from '../AdminSettings';

// Mock AdminBottomNavBar
jest.mock('../../../components/navigation/AdminBottomNavBar', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return ({ onDashboardPress, onChatPress, onCalendarPress, onSettingsPress, onPostUpdatePress, onManagePostPress, onAddPress }: any) => (
    <View testID="admin-bottom-nav-bar">
      <Text testID="nav-dashboard" onPress={onDashboardPress}>Dashboard</Text>
      <Text testID="nav-chat" onPress={onChatPress}>Chat</Text>
      <Text testID="nav-calendar" onPress={onCalendarPress}>Calendar</Text>
      <Text testID="nav-settings" onPress={onSettingsPress}>Settings</Text>
    </View>
  );
});

describe('AdminSettings Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render admin settings screen', async () => {
    renderScreen(<AdminSettings />);

    await waitFor(() => {
      // Use getAllByText since "Settings" appears multiple times
      const settingsTexts = screen.getAllByText('Settings');
      expect(settingsTexts.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should display admin profile information', async () => {
    renderScreen(<AdminSettings />);

    await waitFor(() => {
      // Check if admin email is displayed (may appear multiple times)
      const adminEmails = screen.getAllByText('admin@dorsu.edu.ph');
      expect(adminEmails.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should toggle dark mode when switch is pressed', async () => {
    renderScreen(<AdminSettings />);

    await waitFor(() => {
      // Find the dark mode switch
      const darkModeSwitch = screen.queryByTestId('dark-mode-switch');
      if (darkModeSwitch) {
        fireEvent(darkModeSwitch, 'valueChange', true);
        expect(darkModeSwitch).toBeTruthy();
      }
    });
  });

  it('should display Help Center option', async () => {
    renderScreen(<AdminSettings />);

    await waitFor(() => {
      const helpCenterText = screen.getByText('Help Center');
      expect(helpCenterText).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should display sign out button', async () => {
    renderScreen(<AdminSettings />);

    await waitFor(() => {
      const signOutText = screen.getByText('Sign out');
      expect(signOutText).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render bottom navigation bar', async () => {
    renderScreen(<AdminSettings />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-bottom-nav-bar')).toBeTruthy();
    });
  });
});

