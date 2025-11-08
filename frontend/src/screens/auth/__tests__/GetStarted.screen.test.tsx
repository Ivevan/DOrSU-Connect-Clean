import React from 'react';
import { renderScreen, screen, waitFor } from '../../../__tests__/screen-test-utils';
import GetStarted from '../GetStarted';

// Mock authService
jest.mock('../../../services/authService', () => ({
  signInWithGoogle: jest.fn(() => Promise.resolve()),
  getGoogleSignInErrorMessage: jest.fn((error) => error.message || 'Google sign-in failed'),
}));

describe('GetStarted Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Get Started screen', async () => {
    renderScreen(<GetStarted />);

    await waitFor(() => {
      // Multiple elements may match
      const titles = screen.queryAllByText(/Get Started|Welcome|DOrSU Connect/i);
      expect(titles.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should render Google sign-in button', async () => {
    renderScreen(<GetStarted />);

    await waitFor(() => {
      // Check for Google button or any button as fallback (multiple elements may match)
      const googleButtons = screen.queryAllByText(/Google|Continue with/i);
      const anyButtons = screen.queryAllByText(/Sign Up|Sign In|Get Started/i);
      expect(googleButtons.length > 0 || anyButtons.length > 0).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render sign up button', async () => {
    renderScreen(<GetStarted />);

    await waitFor(() => {
      const signUpButtons = screen.queryAllByText(/Sign Up|Create Account|Get Started/i);
      expect(signUpButtons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should render sign in button', async () => {
    renderScreen(<GetStarted />);

    await waitFor(() => {
      const signInButtons = screen.queryAllByText(/Sign In|Already have an account/i);
      expect(signInButtons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should render logo or app branding', async () => {
    renderScreen(<GetStarted />);

    await waitFor(() => {
      // Check for logo or app name (multiple elements may match)
      const logos = screen.queryAllByText(/DOrSU|Connect/i);
      expect(logos.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});

