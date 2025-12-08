import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'user' | 'moderator' | 'admin';

export interface AuthCheckResult {
  hasAccess: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  isModerator: boolean;
}

/**
 * Checks if the current user has admin or moderator access
 * @param requireAdminOnly - If true, only admin role is allowed (not moderator)
 * @returns Promise with authorization result
 */
export async function checkAdminOrModeratorAccess(requireAdminOnly: boolean = false): Promise<AuthCheckResult> {
  try {
    const isAdmin = await AsyncStorage.getItem('isAdmin');
    const userRole = await AsyncStorage.getItem('userRole') as UserRole | null;

    const isAdminRole = isAdmin === 'true' || userRole === 'admin';
    const isModeratorRole = userRole === 'moderator';

    // If requireAdminOnly is true, only admin can access
    if (requireAdminOnly) {
      return {
        hasAccess: isAdminRole,
        role: isAdminRole ? 'admin' : userRole,
        isAdmin: isAdminRole,
        isModerator: false,
      };
    }

    // Otherwise, both admin and moderator can access
    return {
      hasAccess: isAdminRole || isModeratorRole,
      role: userRole,
      isAdmin: isAdminRole,
      isModerator: isModeratorRole,
    };
  } catch (error) {
    console.error('Error checking admin/moderator access:', error);
    return {
      hasAccess: false,
      role: null,
      isAdmin: false,
      isModerator: false,
    };
  }
}

/**
 * Gets the current user's role from AsyncStorage
 * @returns Promise with user role
 */
export async function getUserRole(): Promise<UserRole | null> {
  try {
    const userRole = await AsyncStorage.getItem('userRole') as UserRole | null;
    const isAdmin = await AsyncStorage.getItem('isAdmin');
    
    // If isAdmin flag is set, return admin role
    if (isAdmin === 'true') {
      return 'admin';
    }
    
    return userRole || 'user';
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Refreshes the current user's role from the backend
 * Updates AsyncStorage with the latest role from the server
 * @returns Promise with updated user role, or null if failed
 */
export async function refreshUserRoleFromBackend(): Promise<UserRole | null> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const apiConfig = require('../config/api.config').default;
    const { getCurrentUser } = require('../services/authService');
    
    // Get current token
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      console.warn('No token available to refresh user role');
      return null;
    }

    // Static admin tokens should always be treated as admin
    if (token.startsWith('admin_')) {
      await AsyncStorage.setItem('userRole', 'admin');
      await AsyncStorage.setItem('isAdmin', 'true');
      return 'admin';
    }

    // Get current user ID
    const userId = await AsyncStorage.getItem('userId');
    if (!userId) {
      console.warn('No user ID available to refresh user role');
      return null;
    }

    // Fetch current user info from backend
    const response = await fetch(`${apiConfig.baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Failed to fetch user info from backend:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.success && data.user) {
      const newRole = (data.user.role || 'user') as UserRole;
      
      // Update AsyncStorage with the new role
      await AsyncStorage.setItem('userRole', newRole);
      await AsyncStorage.setItem('isAdmin', newRole === 'admin' ? 'true' : 'false');
      
      console.log('✅ User role refreshed from backend:', newRole);
      return newRole;
    }

    return null;
  } catch (error) {
    console.error('Error refreshing user role from backend:', error);
    return null;
  }
}

