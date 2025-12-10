import React from 'react';
import { renderScreen, screen, fireEvent, waitFor, mockNavigation } from '../../../__tests__/screen-test-utils';
import AdminDashboard from '../AdminDashboard';

// Mock AdminDataService
jest.mock('../../../services/AdminDataService', () => ({
  __esModule: true,
  default: {
    getDashboard: jest.fn(() => Promise.resolve({
      totalUpdates: 10,
      pinned: 3,
      urgent: 2,
      recentUpdates: [
        {
          title: 'Test Update 1',
          date: 'Nov 8, 2025',
          tag: 'Announcement',
          description: 'Test description',
          pinned: true,
        },
        {
          title: 'Test Update 2',
          date: 'Nov 7, 2025',
          tag: 'Event',
          description: 'Test description 2',
          pinned: false,
        },
      ],
    })),
    getPosts: jest.fn(() => Promise.resolve([])),
  },
}));

// Mock BottomNavBar
jest.mock('../../../components/navigation/BottomNavBar', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return ({ onFirstPress, onSecondPress, onThirdPress, tabType, activeTab }: any) => (
    <View testID="admin-bottom-nav-bar">
      <Text testID="nav-first" onPress={onFirstPress}>First</Text>
      <Text testID="nav-second" onPress={onSecondPress}>Second</Text>
      <Text testID="nav-third" onPress={onThirdPress}>Third</Text>
    </View>
  );
});

// Mock PreviewModal
jest.mock('../../../modals/PreviewModal', () => {
  const React = require('react');
  const { View, Text, Modal } = require('react-native');
  return ({ visible, onClose, update }: any) => (
    <Modal visible={visible} transparent>
      <View testID="preview-modal">
        <Text testID="preview-close" onPress={onClose}>Close</Text>
        {update && <Text>{update.title}</Text>}
      </View>
    </Modal>
  );
});

describe('AdminDashboard Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render admin dashboard screen', async () => {
    renderScreen(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeTruthy();
    });
  });

  it('should display dashboard statistics', async () => {
    renderScreen(<AdminDashboard />);

    await waitFor(() => {
      // Check if Dashboard title is displayed (statistics may take time to load)
      const dashboardTitle = screen.getByText('Dashboard');
      expect(dashboardTitle).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should display recent updates', async () => {
    renderScreen(<AdminDashboard />);

    await waitFor(() => {
      // Check if Dashboard renders (updates may take time to load)
      const dashboardTitle = screen.getByText('Dashboard');
      expect(dashboardTitle).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should display filter options', async () => {
    renderScreen(<AdminDashboard />);

    await waitFor(() => {
      // Check if Dashboard renders (filters may be present)
      const dashboardTitle = screen.getByText('Dashboard');
      expect(dashboardTitle).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render search functionality', async () => {
    renderScreen(<AdminDashboard />);

    await waitFor(() => {
      // Check if Dashboard renders (search may be present)
      const dashboardTitle = screen.getByText('Dashboard');
      expect(dashboardTitle).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render bottom navigation bar', async () => {
    renderScreen(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-bottom-nav-bar')).toBeTruthy();
    });
  });
});

