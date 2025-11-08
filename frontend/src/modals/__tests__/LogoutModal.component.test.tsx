import React from 'react';
import { Animated } from 'react-native';
import { render, fireEvent, screen } from '../../__tests__/test-utils';
import LogoutModal from '../LogoutModal';

describe('LogoutModal', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();
  const mockSheetY = new Animated.Value(0);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when visible is true', () => {
    render(
      <LogoutModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        sheetY={mockSheetY}
      />
    );

    // There are multiple "Logout" texts (title and button), so use getAllByText
    const logoutTexts = screen.getAllByText('Logout');
    expect(logoutTexts.length).toBeGreaterThan(0);
    expect(screen.getByText('Are you sure you want to logout of DOrSU Connect?')).toBeTruthy();
  });

  it('should not render when visible is false', () => {
    const { queryByText } = render(
      <LogoutModal
        visible={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        sheetY={mockSheetY}
      />
    );

    expect(queryByText('Logout')).toBeNull();
  });

  it('should call onClose when Cancel button is pressed', () => {
    render(
      <LogoutModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        sheetY={mockSheetY}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.press(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('should call onConfirm when Logout button is pressed', () => {
    const { getAllByText } = render(
      <LogoutModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        sheetY={mockSheetY}
      />
    );

    // Get all "Logout" texts and press the button (last one is usually the button)
    const logoutTexts = getAllByText('Logout');
    const logoutButton = logoutTexts[logoutTexts.length - 1];
    fireEvent.press(logoutButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should render modal overlay correctly', () => {
    render(
      <LogoutModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        sheetY={mockSheetY}
      />
    );

    // Verify modal renders with all expected elements
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getAllByText('Logout').length).toBeGreaterThan(0);
    expect(screen.getByText('Are you sure you want to logout of DOrSU Connect?')).toBeTruthy();
  });

  it('should display logout icon', () => {
    render(
      <LogoutModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        sheetY={mockSheetY}
      />
    );

    // Check if icon is rendered (mocked as text in our test setup)
    const icon = screen.queryByTestId('icon-log-out-outline');
    expect(icon).toBeTruthy();
  });
});

