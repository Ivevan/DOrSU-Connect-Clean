import React from 'react';
import { renderScreen, screen, waitFor } from '../../../__tests__/screen-test-utils';
import TermsOfUseScreen from '../../shared/TermsOfUseScreen';

describe('TermsOfUseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Terms of Use screen', async () => {
    renderScreen(<TermsOfUseScreen />);

    await waitFor(() => {
      expect(screen.getByText('Terms of Use')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render back button', async () => {
    renderScreen(<TermsOfUseScreen />);

    await waitFor(() => {
      const backButton = screen.queryByTestId('icon-chevron-back') || 
                        screen.queryByText(/Back/i);
      expect(backButton).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render terms content', async () => {
    renderScreen(<TermsOfUseScreen />);

    await waitFor(() => {
      // Check for terms content sections (multiple elements may match)
      const termsContent = screen.queryAllByText(/Acceptance|User Conduct|Intellectual Property|Privacy|Termination|Terms of Use/i);
      expect(termsContent.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});

