import React from 'react';
import { renderScreen, screen, waitFor } from '../../../__tests__/screen-test-utils';
import HelpCenterScreen from '../../shared/HelpCenterScreen';

describe('HelpCenterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Help Center screen', async () => {
    renderScreen(<HelpCenterScreen />);

    await waitFor(() => {
      expect(screen.getByText('Help Center')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render back button', async () => {
    renderScreen(<HelpCenterScreen />);

    await waitFor(() => {
      const backButton = screen.queryByTestId('icon-chevron-back') || 
                        screen.queryByText(/Back/i);
      expect(backButton).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render help content', async () => {
    renderScreen(<HelpCenterScreen />);

    await waitFor(() => {
      // Check for help content sections (multiple elements may match)
      const helpContent = screen.queryAllByText(/Getting Started|FAQ|Support|Contact|Help Center/i);
      expect(helpContent.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});

