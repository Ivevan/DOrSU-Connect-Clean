import React from 'react';
import { renderScreen, screen, waitFor } from '../../../__tests__/screen-test-utils';
import PrivacyPolicyScreen from '../../shared/PrivacyPolicyScreen';

describe('PrivacyPolicyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Privacy Policy screen', async () => {
    renderScreen(<PrivacyPolicyScreen />);

    await waitFor(() => {
      expect(screen.getByText('Privacy Policy')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render back button', async () => {
    renderScreen(<PrivacyPolicyScreen />);

    await waitFor(() => {
      const backButton = screen.queryByTestId('icon-chevron-back') || 
                        screen.queryByText(/Back/i);
      expect(backButton).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render privacy content', async () => {
    renderScreen(<PrivacyPolicyScreen />);

    await waitFor(() => {
      // Check for privacy content sections (multiple elements may match)
      const privacyContent = screen.queryAllByText(/Information|Data Collection|Cookies|Security|Your Rights|Privacy Policy/i);
      expect(privacyContent.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});

