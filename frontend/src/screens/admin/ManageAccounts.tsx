import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ManageAccountsService, { BackendUser } from '../../services/ManageAccountsService';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type RootStackParamList = {
  ManageAccounts: undefined;
  AdminDashboard: undefined;
  AdminSettings: undefined;
};

const ManageAccounts = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Check admin authorization
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const isAdmin = await AsyncStorage.getItem('isAdmin');
        const userRole = await AsyncStorage.getItem('userRole');
        
        // If not admin, redirect away
        if (isAdmin !== 'true' && userRole !== 'admin') {
          setIsAuthorized(false);
          Alert.alert(
            'Access Denied',
            'You do not have permission to access this page.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        
        setIsAuthorized(true);
        loadUsers();
      } catch (error) {
        console.error('Admin check failed:', error);
        setIsAuthorized(false);
        navigation.goBack();
      }
    };
    
    checkAdminAccess();
  }, [navigation]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedUsers = await ManageAccountsService.getAllUsers();
      setUsers(fetchedUsers);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers();
  }, [loadUsers]);

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const roles: Array<'user' | 'moderator' | 'admin'> = ['user', 'moderator', 'admin'];
    const currentIndex = roles.indexOf(currentRole as any);
    const nextRole = roles[(currentIndex + 1) % roles.length];

    Alert.alert(
      'Change User Role',
      `Change role from "${currentRole}" to "${nextRole}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setUpdatingUserId(userId);
              await ManageAccountsService.updateUserRole(userId, nextRole);
              await loadUsers();
              Alert.alert('Success', 'User role updated successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to update role');
            } finally {
              setUpdatingUserId(null);
            }
          },
        },
      ]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#EF4444'; // Red
      case 'moderator':
        return '#F59E0B'; // Amber
      default:
        return '#6B7280'; // Gray
    }
  };

  if (isAuthorized === null || loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (isAuthorized === false) {
    return null; // Will navigate away
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with gradient */}
      <LinearGradient
        colors={
          theme.colors.accent === '#2563EB'
            ? ['#93C5FD', '#60A5FA', '#2563EB']
            : theme.colors.accent === '#FF9500'
            ? ['#FFCC80', '#FFA726', '#FF9500']
            : [
                theme.colors.accentLight || '#93C5FD',
                theme.colors.accent || '#2563EB',
                theme.colors.accentDark || '#1E3A8A',
              ]
        }
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Accounts</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {users.length} {users.length === 1 ? 'user' : 'users'} total
        </Text>

        {users.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No users found
            </Text>
          </View>
        )}

        {users.map((user) => (
          <BlurView
            key={user._id}
            intensity={Platform.OS === 'ios' ? 50 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[
              styles.userCard,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(42, 42, 42, 0.5)'
                  : 'rgba(255, 255, 255, 0.3)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
              },
            ]}
          >
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <Text style={[styles.userEmail, { color: theme.colors.text }]}>
                  {user.email}
                </Text>
                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: getRoleColor(user.role || 'user') + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      { color: getRoleColor(user.role || 'user') },
                    ]}
                  >
                    {(user.role || 'user').toUpperCase()}
                  </Text>
                </View>
              </View>
              {user.username && (
                <Text style={[styles.userName, { color: theme.colors.textMuted }]}>
                  @{user.username}
                </Text>
              )}
              {user.lastLogin && (
                <Text style={[styles.userMeta, { color: theme.colors.textMuted }]}>
                  Last login: {new Date(user.lastLogin).toLocaleDateString()}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.changeRoleButton,
                {
                  backgroundColor: theme.colors.accent,
                  opacity: updatingUserId === user._id ? 0.5 : 1,
                },
              ]}
              onPress={() => handleRoleChange(user._id, user.role || 'user')}
              disabled={updatingUserId === user._id}
            >
              {updatingUserId === user._id ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="swap-horizontal" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </BlurView>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    fontWeight: '500',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 12,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  userName: {
    fontSize: 14,
    marginBottom: 2,
  },
  userMeta: {
    fontSize: 12,
  },
  changeRoleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
});

export default ManageAccounts;

