import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
  StatusBar,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ManageAccountsService, { BackendUser } from '../../services/ManageAccountsService';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from '../../components/navigation/Sidebar';

type RootStackParamList = {
  ManageAccounts: undefined;
  AdminDashboard: undefined;
  AdminSettings: undefined;
};

const ManageAccounts = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { isLoading: authLoading, userRole, isAdmin, isSuperAdmin, refreshUser, isAuthenticated, userName, userEmail } = useAuth();
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [openRoleDropdownUserId, setOpenRoleDropdownUserId] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'superadmin' | 'admin' | 'moderator' | 'user' | null>(null);
  const [backendUserPhoto, setBackendUserPhoto] = useState<string | null>(null);
  const [profileImageError, setProfileImageError] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Animated floating orb
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);

  useEffect(() => {
    const animate = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim1, {
            toValue: 1,
            duration: 8000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim1, {
            toValue: 0,
            duration: 8000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    animate();
  }, []);

  const loadUsers = useCallback(async (isRefresh = false) => {
    try {
      // Only set loading to true if it's not the initial load (to avoid double loading state)
      if (!isInitialLoad || isRefresh) {
        setLoading(true);
      }
      // Only set refreshing if it's an actual refresh (pull-to-refresh)
      if (isRefresh) {
        setRefreshing(true);
      }
      const fetchedUsers = await ManageAccountsService.getAllUsers();
      setUsers(fetchedUsers);
      // Clear failed images cache on refresh to retry loading images
      if (isRefresh) {
        setFailedImages(new Set());
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  // Track mount state to prevent alerts during unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load user profile picture
  useEffect(() => {
    let cancelled = false;
    const loadUserPhoto = async () => {
      try {
        const userPhoto = await AsyncStorage.getItem('userPhoto');
        if (!cancelled) {
          setBackendUserPhoto(userPhoto);
          setProfileImageError(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load user photo:', error);
        }
      }
    };
    loadUserPhoto();
    return () => {
      cancelled = true;
    };
  }, []);

  // Check admin authorization (admin only)
  useEffect(() => {
    if (authLoading) return;
    // Don't show alert if user is logging out (not authenticated), screen is not focused, or component is unmounting
    if (!isAuthenticated || !isFocused || !isMountedRef.current) {
      setIsAuthorized(false);
      return;
    }
    const hasAccess = isAdmin; // moderators not allowed here
    if (!hasAccess) {
      setIsAuthorized(false);
      // Add a small delay and re-check before showing alert to prevent showing during logout
      const timeoutId = setTimeout(() => {
        // Triple-check we're still mounted, focused, and authenticated before showing alert
        if (isMountedRef.current && isFocused && isAuthenticated) {
          Alert.alert(
            'Access Denied',
            'You do not have permission to access this page. Admin access required.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    setIsAuthorized(true);
    loadUsers(false);
  }, [authLoading, isAdmin, navigation, loadUsers, isAuthenticated]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers(true);
  }, [loadUsers]);

  const handleRoleChange = async (userId: string, newRole: 'user' | 'moderator' | 'admin' | 'superadmin') => {
    try {
      setUpdatingUserId(userId);
      setOpenRoleDropdownUserId(null); // Close dropdown
      
      // Get user info
      const user = users.find(u => u._id === userId);
      if (newRole === 'superadmin' && !isSuperAdmin) {
        Alert.alert('Access Denied', 'Only a superadmin can assign the Superadmin role.');
        setUpdatingUserId(null);
        return;
      }
      if (newRole === 'admin' && !isSuperAdmin) {
        Alert.alert('Access Denied', 'Only a superadmin can assign the Admin role.');
        setUpdatingUserId(null);
        return;
      }
      if (user?.role === 'superadmin' && !isSuperAdmin) {
        Alert.alert('Access Denied', 'Only a superadmin can modify another superadmin.');
        setUpdatingUserId(null);
        return;
      }
      // Only superadmins can modify existing admin accounts (backend enforces this at line 1061-1063)
      if (user?.role === 'admin' && !isSuperAdmin) {
        Alert.alert('Access Denied', 'Only a superadmin can modify an admin account.');
        setUpdatingUserId(null);
        return;
      }
      const capabilities = getRoleCapabilities(newRole);
      const capabilitiesText = capabilities.join(', ');
      
      // For moderator role, skip confirmation and update immediately
      if (newRole === 'moderator') {
        try {
          await ManageAccountsService.updateUserRole(userId, newRole);
          await loadUsers(true); // Refresh after role change
          
          // If the updated user is the current user, refresh their role from backend
          const currentUserId = await AsyncStorage.getItem('userId');
          if (currentUserId === userId) {
            console.log('Current user role changed to moderator, refreshing from backend...');
            await refreshUser();
            // Show notification for current user
            Alert.alert(
              'Moderator Access Granted',
              'You have been assigned as a moderator! You now have access to Post Management, Manage Posts, and Admin Dashboard.',
              [{ text: 'OK' }]
            );
          } else {
            // Show notification for other users
            Alert.alert(
              'Moderator Assigned',
              `${user?.email || 'User'} has been assigned as a moderator!`,
              [{ text: 'OK' }]
            );
          }
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
          Alert.alert('Error', error.message || 'Failed to update role');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
          setUpdatingUserId(null);
        }
        return;
      }
      
      // For admin (superadmin-only) and user roles, show confirmation with capabilities
      Alert.alert(
        'Confirm Role Change',
        `Assign "${getRoleLabel(newRole)}" role to ${user?.email || 'this user'}?\n\nThis will grant the following capabilities:\n${capabilities.map(cap => `• ${cap}`).join('\n')}\n\nContinue?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setUpdatingUserId(null);
            }
          },
          {
            text: 'Confirm',
            onPress: async () => {
              try {
                await ManageAccountsService.updateUserRole(userId, newRole);
                await loadUsers(true); // Refresh after role change
                
                // If the updated user is the current user, refresh their role from backend
                const currentUserId = await AsyncStorage.getItem('userId');
                if (currentUserId === userId) {
                  console.log('Current user role changed, refreshing from backend...');
                  await refreshUser();
                  // Show a message that they may need to restart the app or refresh
                  Alert.alert(
                    'Role Updated',
                    `Your role has been updated to "${getRoleLabel(newRole)}". You now have access to: ${capabilitiesText}\n\nPlease restart the app or navigate away and back to see the changes take effect.`,
                    [{ text: 'OK' }]
                  );
                } else {
                  // Show success message with capabilities
                  Alert.alert(
                    'Role Updated Successfully',
                    `${user?.email || 'User'} has been assigned the "${getRoleLabel(newRole)}" role.\n\nGranted capabilities:\n${capabilities.map(cap => `• ${cap}`).join('\n')}`,
                    [{ text: 'OK' }]
                  );
                }
                
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to update role');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              } finally {
                setUpdatingUserId(null);
              }
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update role');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setUpdatingUserId(null);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'Superadmin';
      case 'admin':
        return 'Admin';
      case 'moderator':
        return 'Moderator';
      default:
        return 'User';
    }
  };

  // Role capabilities definition
  const getRoleCapabilities = (role: 'user' | 'moderator' | 'admin' | 'superadmin'): string[] => {
    switch (role) {
      case 'superadmin':
        return ['All Access', 'Manage admins', 'Promote/demote admins', 'Security settings'];
      case 'admin':
        return ['All Access'];
      case 'moderator':
        return ['Post Management', 'Manage Posts', 'Admin Dashboard'];
      case 'user':
      default:
        return ['Basic Access'];
    }
  };

  const roleOptions: Array<{ key: 'user' | 'moderator' | 'admin' | 'superadmin'; label: string; capabilities: string[] }> = [
    { key: 'user', label: 'User', capabilities: getRoleCapabilities('user') },
    { key: 'moderator', label: 'Moderator', capabilities: getRoleCapabilities('moderator') },
    { key: 'admin', label: 'Admin', capabilities: getRoleCapabilities('admin') },
    { key: 'superadmin', label: 'Superadmin', capabilities: getRoleCapabilities('superadmin') },
  ];
  // Non-superadmin Admins can only assign User/Moderator; only Superadmin can see Admin/Superadmin options
  const visibleRoleOptions = roleOptions.filter(option => {
    if (isSuperAdmin) return true;
    return option.key === 'user' || option.key === 'moderator';
  });

  const getUserInitials = (user: BackendUser) => {
    // Priority: username -> email -> default
    if (user.username && user.username.trim()) {
      const parts = user.username.trim().split(' ').filter(p => p.length > 0);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      if (parts[0] && parts[0].length >= 2) {
        return parts[0].substring(0, 2).toUpperCase();
      }
      if (parts[0] && parts[0].length === 1) {
        return (parts[0][0] + parts[0][0]).toUpperCase();
      }
    }
    if (user.email && user.email.trim()) {
      const emailPrefix = user.email.trim().split('@')[0];
      if (emailPrefix.length >= 2) {
        return emailPrefix.substring(0, 2).toUpperCase();
      }
      if (emailPrefix.length === 1) {
        return (emailPrefix[0] + emailPrefix[0]).toUpperCase();
      }
    }
    return 'U';
  };

  // Get current user's initials for profile icon
  const getCurrentUserInitials = () => {
    if (userName && userName.trim()) {
      const parts = userName.trim().split(' ').filter(p => p.length > 0);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      if (parts[0] && parts[0].length >= 2) {
        return parts[0].substring(0, 2).toUpperCase();
      }
      if (parts[0] && parts[0].length === 1) {
        return (parts[0][0] + parts[0][0]).toUpperCase();
      }
    }
    if (userEmail && userEmail.trim()) {
      const emailPrefix = userEmail.trim().split('@')[0];
      if (emailPrefix.length >= 2) {
        return emailPrefix.substring(0, 2).toUpperCase();
      }
      if (emailPrefix.length === 1) {
        return (emailPrefix[0] + emailPrefix[0]).toUpperCase();
      }
    }
    return 'U';
  };

  // Filter users based on search query and role filter
  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    // Apply role filter
    if (selectedRoleFilter) {
      filtered = filtered.filter(user => (user.role || 'user') === selectedRoleFilter);
    }
    
    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(user => {
        const emailMatch = user.email?.toLowerCase().includes(query) || false;
        const usernameMatch = user.username?.toLowerCase().includes(query) || false;
        return emailMatch || usernameMatch;
      });
    }
    
    return filtered;
  }, [users, searchQuery, selectedRoleFilter]);

  // Group filtered users by role
  const groupedUsers = useMemo(() => ({
    superadmin: filteredUsers.filter(u => (u.role || 'user') === 'superadmin'),
    admin: filteredUsers.filter(u => (u.role || 'user') === 'admin'),
    moderator: filteredUsers.filter(u => (u.role || 'user') === 'moderator'),
    user: filteredUsers.filter(u => (u.role || 'user') === 'user'),
  }), [filteredUsers]);

  const getSectionColor = (role: string): string => {
    switch (role) {
      case 'superadmin':
        return '#7C3AED';
      case 'admin':
        return '#EF4444';
      case 'moderator':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  // State to track button positions for dropdown placement
  const buttonRefs = useRef<Record<string, View | null>>({});
  const [buttonLayouts, setButtonLayouts] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});

  // Render table row component to avoid duplication
  const renderUserRow = (user: BackendUser, role: string, index: number) => {
    const isImmutableForAdmin = !isSuperAdmin && (role === 'admin' || role === 'superadmin');

    return (
    <BlurView
      key={user._id}
      intensity={Platform.OS === 'ios' ? 50 : 40}
      tint={isDarkMode ? 'dark' : 'light'}
      style={[
        styles.tableRowContainer,
        {
          backgroundColor: isDarkMode
            ? 'rgba(42, 42, 42, 0.4)'
            : 'rgba(255, 255, 255, 0.25)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderTopWidth: index === 0 ? 1 : 0,
        },
      ]}
    >
      <View style={styles.tableRow}>
        <View style={styles.profileCell}>
          <View style={[styles.profileAvatar, { backgroundColor: getSectionColor(role) + '20' }]}>
            {user.profilePicture && user.profilePicture.trim() && !failedImages.has(user._id) ? (
              <Image
                source={{ uri: user.profilePicture }}
                style={styles.profileAvatarImage}
                resizeMode="cover"
                onError={() => {
                  // Mark this image as failed, will show initials instead
                  setFailedImages(prev => new Set(prev).add(user._id));
                }}
                onLoad={() => {
                  // If image loads successfully, remove from failed set
                  setFailedImages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(user._id);
                    return newSet;
                  });
                }}
              />
            ) : (
              <Text style={[styles.tableProfileInitials, { color: getSectionColor(role) }]}>
                {getUserInitials(user)}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.emailCell}>
          <Text
            style={[styles.tableCellText, { color: theme.colors.text, fontWeight: '600', textAlign: 'center' }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {user.email}
          </Text>
          {user.username && (
            <Text
              style={[styles.tableCellSubtext, { color: theme.colors.textMuted, textAlign: 'center' }]}
              numberOfLines={1}
            >
              @{user.username}
            </Text>
          )}
        </View>
        <View style={styles.actionsCell}>
          <View 
            ref={(ref) => { buttonRefs.current[user._id] = ref; }}
            style={styles.roleDropdownContainer}
            onLayout={() => {
              const buttonRef = buttonRefs.current[user._id];
              if (buttonRef) {
                buttonRef.measureInWindow((windowX, windowY, windowWidth, windowHeight) => {
                  setButtonLayouts(prev => ({
                    ...prev,
                    [user._id]: { x: windowX, y: windowY, width: windowWidth, height: windowHeight }
                  }));
                });
              }
            }}
          >
            <TouchableOpacity
              style={[
                styles.roleDropdownButton,
                {
                  backgroundColor: getSectionColor(user.role || 'user'),
                  borderColor: getSectionColor(user.role || 'user'),
                  opacity: updatingUserId === user._id || isImmutableForAdmin ? 0.5 : 1,
                },
              ]}
              onPress={() => {
                if (isImmutableForAdmin) {
                  Alert.alert('Access Denied', 'Only a superadmin can change the role of an Admin or Superadmin.');
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setOpenRoleDropdownUserId(openRoleDropdownUserId === user._id ? null : user._id);
              }}
              disabled={updatingUserId === user._id || isImmutableForAdmin}
              activeOpacity={0.7}
            >
              {updatingUserId === user._id ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Text 
                    style={[styles.roleDropdownButtonText, { 
                      color: '#FFF', 
                      fontSize: theme.fontSize.scaleSize(9),
                      flexShrink: 1,
                      fontWeight: '700',
                    }]}
                    numberOfLines={1}
                  >
                    {getRoleLabel(user.role || 'user')}
                  </Text>
                  <Ionicons 
                    name={openRoleDropdownUserId === user._id ? 'chevron-up' : 'chevron-down'} 
                    size={12} 
                    color="#FFF" 
                    style={{ flexShrink: 0, opacity: 0.9 }}
                  />
                </>
              )}
            </TouchableOpacity>

            {/* Role Dropdown Modal - centered */}
            <Modal
              visible={openRoleDropdownUserId === user._id}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setOpenRoleDropdownUserId(null)}
            >
              <TouchableOpacity
                style={styles.roleDropdownOverlay}
                activeOpacity={1}
                onPress={() => setOpenRoleDropdownUserId(null)}
              >
                <View style={styles.roleDropdownCenterWrapper}>
                  <BlurView
                    intensity={Platform.OS === 'ios' ? 80 : 60}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[
                      styles.roleDropdownContent,
                      {
                        backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      }
                    ]}
                  >
                    {visibleRoleOptions.map((option, index) => {
                      const isSelected = (user.role || 'user') === option.key;
                      const isLast = index === visibleRoleOptions.length - 1;
                      return (
                        <TouchableOpacity
                          key={option.key}
                          style={[
                            styles.roleDropdownItem,
                            isLast && { borderBottomWidth: 0 },
                            isSelected && {
                              backgroundColor: getSectionColor(option.key) + '20',
                            }
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleRoleChange(user._id, option.key);
                            setOpenRoleDropdownUserId(null);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.roleDropdownItemContent}>
                            <View style={styles.roleDropdownItemLeft}>
                              <View style={[styles.roleDropdownColorDot, { backgroundColor: getSectionColor(option.key) }]} />
                              <View style={styles.roleDropdownItemTextContainer}>
                                <Text style={[
                                  styles.roleDropdownItemText,
                                  { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(12) },
                                  isSelected && { color: getSectionColor(option.key), fontWeight: '700' }
                                ]}>
                                  {option.label}
                                </Text>
                                <Text style={[
                                  styles.roleDropdownItemCapabilities,
                                  { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(10) }
                                ]}>
                                  {option.capabilities.join(' • ')}
                                </Text>
                              </View>
                            </View>
                            {isSelected && (
                              <Ionicons name="checkmark" size={18} color={getSectionColor(option.key)} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </BlurView>
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
        </View>
      </View>
    </BlurView>
  );
  };

  // Render table header component to avoid duplication
  const renderTableHeader = () => (
    <BlurView
      intensity={Platform.OS === 'ios' ? 50 : 40}
      tint={isDarkMode ? 'dark' : 'light'}
      style={[
        styles.tableHeader,
        {
          backgroundColor: isDarkMode
            ? 'rgba(42, 42, 42, 0.6)'
            : 'rgba(255, 255, 255, 0.4)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
        },
      ]}
    >
      <View style={[styles.tableHeaderRow, styles.tableRow]}>
        <View style={styles.profileHeaderCell}>
          <Text style={[styles.tableHeaderText, { color: theme.colors.text }]}>
            Profile
          </Text>
        </View>
        <View style={styles.emailHeaderCell}>
          <Text style={[styles.tableHeaderText, { color: theme.colors.text }]}>
            Email
          </Text>
        </View>
        <View style={styles.actionsHeaderCell}>
          <Text style={[styles.tableHeaderText, { color: theme.colors.text }]}>
            Actions
          </Text>
        </View>
      </View>
    </BlurView>
  );

  // Render section component to avoid duplication
  const renderSection = (role: 'superadmin' | 'admin' | 'moderator' | 'user', users: BackendUser[]) => {
    if (users.length === 0) return null;

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIndicator, { backgroundColor: getSectionColor(role) }]} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {role.toUpperCase()} ({users.length})
          </Text>
        </View>
        <View style={styles.tableContainer}>
          {renderTableHeader()}
          {users.map((user, index) => renderUserRow(user, role, index))}
        </View>
      </View>
    );
  };

  const isPendingAuthorization = isAuthorized === null;

  if (authLoading || isPendingAuthorization) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3' }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (isAuthorized === false) {
    return (
      <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3' }} />
    );
  }

  const safeInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0B1220' : '#FBF8F3' }]} collapsable={false}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        translucent={true}
      />

      {/* Background Gradient Layer */}
      <LinearGradient
        colors={[
          isDarkMode ? '#0B1220' : '#FBF8F3',
          isDarkMode ? '#111827' : '#F8F5F0',
          isDarkMode ? '#1F2937' : '#F5F2ED',
        ]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* Blur overlay on entire background */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint="default"
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      {/* Animated Floating Background Orb (Copilot-style) */}
      <View style={styles.floatingBgContainer} pointerEvents="none" collapsable={false}>
        <Animated.View
          style={[
            styles.floatingOrbWrapper,
            {
              top: '35%',
              left: '50%',
              marginLeft: -250,
              transform: [
                {
                  translateX: floatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-30, 30],
                  }),
                },
                {
                  translateY: floatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 20],
                  }),
                },
                {
                  scale: floatAnim1.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.05, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.floatingOrb1}>
            <LinearGradient
              colors={[theme.colors.orbColors.orange1, theme.colors.orbColors.orange2, theme.colors.orbColors.orange3]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 45}
              tint="default"
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        </Animated.View>
      </View>

      {/* Header - Matching AdminCalendar style */}
      <View style={[styles.header, { 
        marginTop: safeInsets.top,
        marginLeft: safeInsets.left,
        marginRight: safeInsets.right,
      }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={() => setIsSidebarOpen(true)} 
            style={styles.menuButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Open sidebar"
            accessibilityRole="button"
          >
            <View style={styles.customHamburger} pointerEvents="none">
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
            </View>
          </TouchableOpacity>
        </View>
        <Text 
          style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(17) }]}
          pointerEvents="none"
        >
          Manage Accounts
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={() => navigation.navigate('AdminSettings')} 
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Admin profile - Go to settings"
            accessibilityRole="button"
          >
            {backendUserPhoto && !profileImageError ? (
              <Image 
                source={{ uri: backendUserPhoto }} 
                style={styles.profileIconCircle}
                resizeMode="cover"
                onError={() => setProfileImageError(true)}
              />
            ) : (
              <View style={[styles.profileIconCircle, { backgroundColor: theme.colors.accent }]} pointerEvents="none">
                <Text style={[styles.profileInitials, { fontSize: theme.fontSize.scaleSize(13) }]}>{getCurrentUserInitials()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.contentWrapper}>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: safeInsets.bottom + 20,
          }}
          showsVerticalScrollIndicator={true}
          bounces={true}
          refreshControl={
            !isInitialLoad && !isPendingAuthorization ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.accent}
                colors={[theme.colors.accent]}
              />
            ) : undefined
          }
        >
          {/* Show loading indicator only during initial authorization/load */}
          {(isPendingAuthorization || (loading && isInitialLoad)) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          ) : (
            <>
              {/* Search Bar */}
              <View style={styles.searchSection}>
                <BlurView
                  intensity={Platform.OS === 'ios' ? 50 : 40}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={[styles.searchBarContainer, {
                    backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }]}
                >
                  <Ionicons name="search-outline" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, {
                      color: theme.colors.text,
                      fontSize: theme.fontSize.scaleSize(14),
                    }]}
                    placeholder="Search users..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setSearchQuery('');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={styles.searchClearButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </BlurView>
              </View>

              {/* Legend Buttons */}
              <View style={styles.legendSection}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.legendContainer}
                >
                  <TouchableOpacity
                    style={[
                      styles.legendButton,
                      {
                        backgroundColor: selectedRoleFilter === null 
                          ? (isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)')
                          : 'transparent',
                        borderColor: selectedRoleFilter === null 
                          ? (isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                      }
                    ]}
                    onPress={() => {
                      setSelectedRoleFilter(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.legendButtonText,
                      { 
                        color: selectedRoleFilter === null 
                          ? theme.colors.text 
                          : theme.colors.textMuted,
                        fontSize: theme.fontSize.scaleSize(11)
                      }
                    ]}>
                      All
                    </Text>
                  </TouchableOpacity>

                  {roleOptions.map((option) => {
                    const isSelected = selectedRoleFilter === option.key;
                    const roleColor = getSectionColor(option.key);
                    
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.legendButton,
                          {
                            backgroundColor: isSelected 
                              ? roleColor + '20'
                              : 'transparent',
                            borderColor: isSelected 
                              ? roleColor 
                              : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                            borderWidth: isSelected ? 1.5 : 1,
                          }
                        ]}
                        onPress={() => {
                          setSelectedRoleFilter(isSelected ? null : option.key);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.legendColorDot, { backgroundColor: roleColor }]} />
                        <Text style={[
                          styles.legendButtonText,
                          { 
                            color: isSelected ? roleColor : theme.colors.textMuted,
                            fontSize: theme.fontSize.scaleSize(11),
                            fontWeight: isSelected ? '700' : '500',
                          }
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Search Results Count - Show when searching or filtering */}
              {(searchQuery.trim().length > 0 || selectedRoleFilter) && (
                <View style={styles.searchResultsHeader}>
                  <Text style={[styles.searchResultsCount, { 
                    color: theme.colors.textMuted, 
                    fontSize: theme.fontSize.scaleSize(12) 
                  }]}>
                    {filteredUsers.length} {filteredUsers.length === 1 ? 'result' : 'results'} found
                    {searchQuery.trim().length > 0 && ` for "${searchQuery}"`}
                    {selectedRoleFilter && ` (${getRoleLabel(selectedRoleFilter)} only)`}
                  </Text>
                </View>
              )}

              {filteredUsers.length === 0 && !loading && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                    {searchQuery.trim().length > 0 
                      ? `No users found matching "${searchQuery}"`
                      : 'No users found'}
                  </Text>
                </View>
              )}

              {/* Render sections */}
              {renderSection('superadmin', groupedUsers.superadmin)}
              {renderSection('admin', groupedUsers.admin)}
              {renderSection('moderator', groupedUsers.moderator)}
              {renderSection('user', groupedUsers.user)}

              {/* Footer with total count */}
              {filteredUsers.length > 0 && (
                <View style={styles.tableFooter}>
                  <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
                    {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} {searchQuery.trim().length > 0 ? 'found' : 'total'}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* Sidebar Component */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        allowedRoles={['superadmin', 'admin', 'moderator']}
      />
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  floatingBgContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: 'hidden',
  },
  floatingOrbWrapper: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    overflow: 'hidden',
  },
  floatingOrb1: {
    width: 500,
    height: 500,
    borderRadius: 250,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    zIndex: 10,
    position: 'relative',
  },
  headerLeft: {
    width: 44,
    zIndex: 11,
  },
  menuButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  customHamburger: {
    width: 24,
    height: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hamburgerLine: {
    height: 2.5,
    borderRadius: 2,
  },
  hamburgerLineShort: {
    width: 18,
  },
  hamburgerLineLong: {
    width: 24,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 1,
    pointerEvents: 'none',
  },
  headerRight: {
    width: 44,
    alignItems: 'flex-end',
    zIndex: 11,
  },
  profileButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  profileIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  profileInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  contentWrapper: {
    flex: 1,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
  },
  tableContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    width: '100%',
  },
  tableHeaderRow: {
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    width: '100%',
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    paddingHorizontal: 1,
    textAlign: 'center',
  },
  tableRowContainer: {
    borderWidth: 1,
    borderTopWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 6,
    width: '100%',
  },
  // Fixed width cells for phone layout - optimized to fit screen
  profileHeaderCell: {
    width: 40,
    paddingVertical: 10,
    paddingHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCell: {
    width: 40,
    paddingVertical: 12,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56,
  },
  emailHeaderCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
  },
  emailCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56,
    minWidth: 0,
  },
  actionsHeaderCell: {
    width: 70,
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsCell: {
    width: 70,
    paddingVertical: 12,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56,
  },
  tableCellSubtext: {
    fontSize: 10,
    fontWeight: '400',
    marginTop: 2,
  },
  tableCellText: {
    fontSize: 13,
    fontWeight: '500',
  },
  roleDropdownContainer: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },
  roleDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 5,
    minHeight: 28,
    width: '100%',
    maxWidth: 65,
    overflow: 'hidden',
    gap: 3,
  },
  roleDropdownButtonText: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  roleDropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  roleDropdownContentWrapper: {
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingTop: 20,
  },
  roleDropdownCenterWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  roleDropdownContent: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 220,
    maxWidth: 280,
  },
  roleDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  roleDropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleDropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  roleDropdownColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  roleDropdownItemTextContainer: {
    flex: 1,
    gap: 2,
  },
  roleDropdownItemText: {
    fontWeight: '500',
  },
  roleDropdownItemCapabilities: {
    fontWeight: '400',
    opacity: 0.7,
    marginTop: 2,
  },
  tableFooter: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tableProfileInitials: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
    paddingVertical: 60,
  },
  searchSection: {
    marginBottom: 16,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 52,
    width: '100%',
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 14,
  },
  searchClearButton: {
    padding: 4,
    marginLeft: 8,
  },
  searchResultsHeader: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchResultsCount: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
    opacity: 0.8,
  },
  legendSection: {
    marginBottom: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  legendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    minHeight: 36,
  },
  legendColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendButtonText: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

export default ManageAccounts;

