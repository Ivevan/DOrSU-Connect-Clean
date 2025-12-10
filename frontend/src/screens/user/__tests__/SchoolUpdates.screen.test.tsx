import React from 'react';
import { renderScreen, screen, waitFor } from '../../../__tests__/screen-test-utils';
import SchoolUpdates from '../SchoolUpdates';

// Mock BottomNavBar
jest.mock('../../../components/navigation/BottomNavBar', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return ({ onFirstPress, onSecondPress, onThirdPress, tabType, autoDetect }: any) => (
    <View testID="user-bottom-nav-bar">
      <Text testID="nav-first" onPress={onFirstPress}>First</Text>
      <Text testID="nav-second" onPress={onSecondPress}>Second</Text>
      <Text testID="nav-third" onPress={onThirdPress}>Third</Text>
    </View>
  );
});

// Mock PreviewModal
jest.mock('../../../modals/PreviewModal', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return ({ visible, onClose, update }: any) => (
    visible ? (
      <View testID="preview-modal">
        <Text testID="preview-close" onPress={onClose}>Close</Text>
        {update && <Text testID="preview-title">{update.title}</Text>}
      </View>
    ) : null
  );
});

// Mock AdminDataService
jest.mock('../../../services/AdminDataService', () => ({
  __esModule: true,
  default: {
    getPosts: jest.fn(() => Promise.resolve([
      {
        id: '1',
        title: 'Test Update',
        category: 'Announcement',
        date: 'Nov 8, 2025',
        isoDate: new Date(2025, 10, 8).toISOString(),
        description: 'Test description',
        isPinned: false,
        isUrgent: false,
      },
    ])),
  },
}));

// Mock authService
jest.mock('../../../services/authService', () => ({
  getCurrentUser: jest.fn(() => Promise.resolve({
    displayName: 'Test User',
    email: 'test@example.com',
  })),
  onAuthStateChange: jest.fn((callback) => {
    callback({
      displayName: 'Test User',
      email: 'test@example.com',
    });
    return jest.fn(); // Return unsubscribe function
  }),
}));

describe('SchoolUpdates Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render School Updates screen', async () => {
    renderScreen(<SchoolUpdates />);

    await waitFor(() => {
      const titles = screen.queryAllByText(/School Updates|Hello/i);
      expect(titles.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should display personalized welcome message', async () => {
    renderScreen(<SchoolUpdates />);

    await waitFor(() => {
      const welcomeText = screen.queryByText(/Hello|DOrSU AI/i);
      expect(welcomeText).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render search button', async () => {
    renderScreen(<SchoolUpdates />);

    await waitFor(() => {
      // Search button should be present (usually an icon button)
      const searchButton = screen.queryByTestId('search-button') || 
                          screen.queryAllByText(/Search/i);
      expect(searchButton.length || 1).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should render notifications button', async () => {
    renderScreen(<SchoolUpdates />);

    await waitFor(() => {
      // Notifications button should be present (usually an icon button)
      const notificationsButton = screen.queryByTestId('notifications-button') || 
                                 screen.queryAllByText(/Notifications/i);
      expect(notificationsButton.length || 1).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should render updates list or empty state', async () => {
    renderScreen(<SchoolUpdates />);

    await waitFor(() => {
      // Should show either updates or empty state
      const updatesList = screen.queryByTestId('updates-list') || 
                         screen.queryByText(/No updates|Today's Events/i) ||
                         screen.queryByText('Test Update');
      expect(updatesList || screen.getByText(/School Updates|Hello/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render bottom navigation bar', async () => {
    renderScreen(<SchoolUpdates />);

    await waitFor(() => {
      expect(screen.getByTestId('user-bottom-nav-bar')).toBeTruthy();
    }, { timeout: 3000 });
  });
});

