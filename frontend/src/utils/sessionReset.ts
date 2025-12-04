/**
 * Utility functions to reset session flags when logging out
 * This ensures fresh data loads when switching between user and admin accounts
 */

// Session flag reset functions
let resetAdminDashboardFn: (() => void) | null = null;
let resetSchoolUpdatesFn: (() => void) | null = null;

export const registerAdminDashboardReset = (resetFn: () => void) => {
  resetAdminDashboardFn = resetFn;
};

export const registerSchoolUpdatesReset = (resetFn: () => void) => {
  resetSchoolUpdatesFn = resetFn;
};

export const resetAllSessionFlags = () => {
  if (resetAdminDashboardFn) {
    try {
      resetAdminDashboardFn();
    } catch (error) {
      if (__DEV__) console.warn('Error resetting AdminDashboard session:', error);
    }
  }
  if (resetSchoolUpdatesFn) {
    try {
      resetSchoolUpdatesFn();
    } catch (error) {
      if (__DEV__) console.warn('Error resetting SchoolUpdates session:', error);
    }
  }
};

