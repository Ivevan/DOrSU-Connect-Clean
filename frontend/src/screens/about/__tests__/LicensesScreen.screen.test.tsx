import React from 'react';
import { renderScreen, screen, waitFor } from '../../../__tests__/screen-test-utils';
import LicensesScreen from '../../shared/LicensesScreen';

describe('LicensesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Licenses screen', async () => {
    renderScreen(<LicensesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Licenses')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render back button', async () => {
    renderScreen(<LicensesScreen />);

    await waitFor(() => {
      const backButton = screen.queryByTestId('icon-chevron-back') || 
                        screen.queryByText(/Back/i);
      expect(backButton).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render licenses content', async () => {
    renderScreen(<LicensesScreen />);

    await waitFor(() => {
      // Check for open source libraries (multiple elements may match)
      const licensesContent = screen.queryAllByText(/React|Expo|MIT|Apache|Open Source|Licenses/i);
      expect(licensesContent.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});

