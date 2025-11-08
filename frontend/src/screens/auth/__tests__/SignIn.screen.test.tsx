import React from 'react';
import { renderScreen, screen, waitFor, fireEvent } from '../../../__tests__/screen-test-utils';
import SignIn from '../SignIn';

describe('SignIn Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Sign In screen', async () => {
    renderScreen(<SignIn />);

    await waitFor(() => {
      expect(screen.getByText('Sign In')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render email input field', async () => {
    renderScreen(<SignIn />);

    await waitFor(() => {
      const emailInput = screen.queryByPlaceholderText(/Email|email address/i);
      expect(emailInput).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render password input field', async () => {
    renderScreen(<SignIn />);

    await waitFor(() => {
      const passwordInput = screen.queryByPlaceholderText(/Password|password/i);
      expect(passwordInput).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should render sign in button', async () => {
    renderScreen(<SignIn />);

    await waitFor(() => {
      const signInButtons = screen.queryAllByText(/Sign In|Sign in/i);
      expect(signInButtons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should render create account link', async () => {
    renderScreen(<SignIn />);

    await waitFor(() => {
      const createAccountLinks = screen.queryAllByText(/Create Account|Don't have an account|Sign up|Sign Up/i);
      expect(createAccountLinks.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should allow typing in email field', async () => {
    renderScreen(<SignIn />);

    await waitFor(() => {
      const emailInput = screen.queryByPlaceholderText(/Email|email address/i);
      expect(emailInput).toBeTruthy();
      
      if (emailInput) {
        fireEvent.changeText(emailInput, 'test@example.com');
        expect(emailInput.props.value || '').toBeTruthy();
      }
    }, { timeout: 3000 });
  });

  it('should allow typing in password field', async () => {
    renderScreen(<SignIn />);

    await waitFor(() => {
      const passwordInput = screen.queryByPlaceholderText(/Password|password/i);
      expect(passwordInput).toBeTruthy();
      
      if (passwordInput) {
        fireEvent.changeText(passwordInput, 'password123');
        expect(passwordInput.props.value || '').toBeTruthy();
      }
    }, { timeout: 3000 });
  });
});

