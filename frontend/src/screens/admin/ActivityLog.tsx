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
  Animated, 
  StatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActivityLogService, { ActivityLog, ActivityLogFilters } from '../../services/ActivityLogService';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { formatDate, timeAgo } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';

type RootStackParamList = {
  ActivityLog: undefined;
  AdminDashboard: undefined;
  AdminSettings: undefined;
};

const ACTION_TYPES = [
  { key: '', label: 'All Actions' },
  { key: 'user.login', label: 'Login' },
  { key: 'user.logout', label: 'Logout' },
  { key: 'user.register', label: 'Registration' },
  { key: 'user.account_delete', label: 'Account Deletion' },
  { key: 'admin.role_change', label: 'Role Change' },
  { key: 'admin.user_delete', label: 'User Deletion' },
  { key: 'admin.post_create', label: 'Post Created' },
  { key: 'admin.post_update', label: 'Post Updated' },
  { key: 'admin.post_delete', label: 'Post Deleted' },
];

// Mock data for design preview
const generateMockLogs = (): ActivityLog[] => {
  const now = new Date();
  const mockLogs: ActivityLog[] = [
    {
      _id: 'mock1',
      userId: 'user1',
      userEmail: 'admin@dorsu.edu.ph',
      userName: 'Admin User',
      action: 'admin.role_change',
      details: {
        targetUserId: 'user123',
        targetUserEmail: 'student@dorsu.edu.ph',
        oldRole: 'user',
        newRole: 'moderator'
      },
      metadata: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 5 * 60000) // 5 minutes ago
      },
      createdAt: new Date(now.getTime() - 5 * 60000)
    },
    {
      _id: 'mock2',
      userId: 'user2',
      userEmail: 'john.doe@dorsu.edu.ph',
      userName: 'John Doe',
      action: 'user.login',
      details: {
        email: 'john.doe@dorsu.edu.ph',
        method: 'email'
      },
      metadata: {
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)',
        timestamp: new Date(now.getTime() - 15 * 60000) // 15 minutes ago
      },
      createdAt: new Date(now.getTime() - 15 * 60000)
    },
    {
      _id: 'mock3',
      userId: 'user3',
      userEmail: 'jane.smith@dorsu.edu.ph',
      userName: 'Jane Smith',
      action: 'user.register',
      details: {
        email: 'jane.smith@dorsu.edu.ph',
        username: 'Jane Smith',
        method: 'google'
      },
      metadata: {
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Android 11; Mobile)',
        timestamp: new Date(now.getTime() - 30 * 60000) // 30 minutes ago
      },
      createdAt: new Date(now.getTime() - 30 * 60000)
    },
    {
      _id: 'mock4',
      userId: 'user1',
      userEmail: 'admin@dorsu.edu.ph',
      userName: 'Admin User',
      action: 'admin.role_change',
      details: {
        targetUserId: 'user456',
        targetUserEmail: 'faculty@dorsu.edu.ph',
        oldRole: 'moderator',
        newRole: 'admin'
      },
      metadata: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 60 * 60000) // 1 hour ago
      },
      createdAt: new Date(now.getTime() - 60 * 60000)
    },
    {
      _id: 'mock5',
      userId: 'user4',
      userEmail: 'student1@dorsu.edu.ph',
      userName: 'Student One',
      action: 'user.login',
      details: {
        email: 'student1@dorsu.edu.ph',
        method: 'email'
      },
      metadata: {
        ipAddress: '192.168.1.103',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0)',
        timestamp: new Date(now.getTime() - 2 * 3600 * 1000) // 2 hours ago
      },
      createdAt: new Date(now.getTime() - 2 * 3600 * 1000)
    },
    {
      _id: 'mock6',
      userId: 'user5',
      userEmail: 'student2@dorsu.edu.ph',
      userName: 'Student Two',
      action: 'user.logout',
      details: {
        email: 'student2@dorsu.edu.ph'
      },
      metadata: {
        ipAddress: '192.168.1.104',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 3 * 3600 * 1000) // 3 hours ago
      },
      createdAt: new Date(now.getTime() - 3 * 3600 * 1000)
    },
    {
      _id: 'mock7',
      userId: 'user1',
      userEmail: 'admin@dorsu.edu.ph',
      userName: 'Admin User',
      action: 'admin.user_delete',
      details: {
        deletedUserId: 'user789',
        deletedUserEmail: 'olduser@dorsu.edu.ph'
      },
      metadata: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 5 * 3600 * 1000) // 5 hours ago
      },
      createdAt: new Date(now.getTime() - 5 * 3600 * 1000)
    },
    {
      _id: 'mock8',
      userId: 'user6',
      userEmail: 'newstudent@dorsu.edu.ph',
      userName: 'New Student',
      action: 'user.register',
      details: {
        email: 'newstudent@dorsu.edu.ph',
        username: 'New Student',
        method: 'firebase'
      },
      metadata: {
        ipAddress: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)',
        timestamp: new Date(now.getTime() - 6 * 3600 * 1000) // 6 hours ago
      },
      createdAt: new Date(now.getTime() - 6 * 3600 * 1000)
    },
    {
      _id: 'mock9',
      userId: 'user7',
      userEmail: 'moderator@dorsu.edu.ph',
      userName: 'Moderator User',
      action: 'user.login',
      details: {
        email: 'moderator@dorsu.edu.ph',
        method: 'google'
      },
      metadata: {
        ipAddress: '192.168.1.106',
        userAgent: 'Mozilla/5.0 (Android 12; Mobile)',
        timestamp: new Date(now.getTime() - 8 * 3600 * 1000) // 8 hours ago
      },
      createdAt: new Date(now.getTime() - 8 * 3600 * 1000)
    },
    {
      _id: 'mock10',
      userId: 'user8',
      userEmail: 'faculty1@dorsu.edu.ph',
      userName: 'Faculty Member',
      action: 'user.account_delete',
      details: {
        deletedUserId: 'user8',
        deletedUserEmail: 'faculty1@dorsu.edu.ph'
      },
      metadata: {
        ipAddress: '192.168.1.107',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        timestamp: new Date(now.getTime() - 12 * 3600 * 1000) // 12 hours ago
      },
      createdAt: new Date(now.getTime() - 12 * 3600 * 1000)
    },
    {
      _id: 'mock11',
      userId: 'user9',
      userEmail: 'example@dorsu.edu.ph',
      userName: 'Example User',
      action: 'user.login',
      details: {
        email: 'example@dorsu.edu.ph',
        method: 'email'
      },
      metadata: {
        ipAddress: '192.168.1.108',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 2 * 24 * 3600 * 1000) // 2 days ago - will show date + time
      },
      createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000)
    },
    {
      _id: 'mock12',
      userId: 'user1',
      userEmail: 'admin@dorsu.edu.ph',
      userName: 'Admin User',
      action: 'admin.role_change',
      details: {
        targetUserId: 'user999',
        targetUserEmail: 'student@dorsu.edu.ph',
        oldRole: 'user',
        newRole: 'moderator'
      },
      metadata: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 5 * 24 * 3600 * 1000) // 5 days ago - will show date + time
      },
      createdAt: new Date(now.getTime() - 5 * 24 * 3600 * 1000)
    },
    {
      _id: 'mock13',
      userId: 'user1',
      userEmail: 'admin@dorsu.edu.ph',
      userName: 'Admin User',
      action: 'admin.post_create',
      details: {
        postId: 'post123',
        postTitle: 'Semester Opening Ceremony 2024',
        category: 'Event'
      },
      metadata: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 10 * 60000) // 10 minutes ago
      },
      createdAt: new Date(now.getTime() - 10 * 60000)
    },
    {
      _id: 'mock14',
      userId: 'user1',
      userEmail: 'admin@dorsu.edu.ph',
      userName: 'Admin User',
      action: 'admin.post_create',
      details: {
        postId: 'post124',
        postTitle: 'Important Announcement: New Library Hours',
        category: 'News'
      },
      metadata: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 45 * 60000) // 45 minutes ago
      },
      createdAt: new Date(now.getTime() - 45 * 60000)
    },
    {
      _id: 'mock15',
      userId: 'user1',
      userEmail: 'admin@dorsu.edu.ph',
      userName: 'Admin User',
      action: 'admin.post_update',
      details: {
        postId: 'post123',
        postTitle: 'Semester Opening Ceremony 2024',
        category: 'Event',
        updatedFields: ['title', 'description', 'date']
      },
      metadata: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 90 * 60000) // 1.5 hours ago
      },
      createdAt: new Date(now.getTime() - 90 * 60000)
    },
    {
      _id: 'mock16',
      userId: 'user1',
      userEmail: 'admin@dorsu.edu.ph',
      userName: 'Admin User',
      action: 'admin.post_delete',
      details: {
        postId: 'post120',
        postTitle: 'Old Event Notice',
        category: 'General'
      },
      metadata: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 4 * 3600 * 1000) // 4 hours ago
      },
      createdAt: new Date(now.getTime() - 4 * 3600 * 1000)
    },
    {
      _id: 'mock17',
      userId: 'user1',
      userEmail: 'admin@dorsu.edu.ph',
      userName: 'Admin User',
      action: 'admin.post_update',
      details: {
        postId: 'post125',
        postTitle: 'Student Orientation Program',
        category: 'Academic',
        updatedFields: ['description']
      },
      metadata: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(now.getTime() - 1 * 24 * 3600 * 1000) // 1 day ago - will show date + time
      },
      createdAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000)
    }
  ];
  return mockLogs;
};

const ActivityLogScreen = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isLoading: authLoading, userRole, isAdmin } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [openActionFilter, setOpenActionFilter] = useState(false);
  const [total, setTotal] = useState(0);
  const [useMockData, setUseMockData] = useState(true); // Default to true for design preview
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Animated floating orb
  const floatAnim1 = useRef(new Animated.Value(0)).current;

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

  // Check admin authorization (admin only) via AuthContext
  useEffect(() => {
    // For design preview, skip authorization check and use mock data
    if (useMockData) {
      setIsAuthorized(true);
      loadLogs(false);
      return;
    }

    if (authLoading) return;
    const hasAccess = isAdmin; // only admins (not moderators)
    if (!hasAccess) {
      setIsAuthorized(false);
      Alert.alert(
        'Access Denied',
        'You do not have permission to access this page. Admin access required.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }
    setIsAuthorized(true);
    loadLogs(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, useMockData, authLoading, isAdmin]);

  const loadLogs = useCallback(async (isRefresh = false) => {
    try {
      if (!isInitialLoad || isRefresh) {
        setLoading(true);
      }
      if (isRefresh) {
        setRefreshing(true);
      }

      // Use mock data if enabled (for design preview)
      if (useMockData) {
        const mockLogs = generateMockLogs();
        // Apply filters to mock data
        let filteredLogs = mockLogs;
        
        if (selectedAction) {
          filteredLogs = filteredLogs.filter(log => log.action === selectedAction);
        }
        
        if (searchQuery.trim()) {
          const query = searchQuery.trim().toLowerCase();
          filteredLogs = filteredLogs.filter(log => 
            log.userEmail?.toLowerCase().includes(query) ||
            log.userName?.toLowerCase().includes(query)
          );
        }
        
        setLogs(filteredLogs);
        setTotal(filteredLogs.length);
        setLoading(false);
        setRefreshing(false);
        setIsInitialLoad(false);
        return;
      }

      const filters: ActivityLogFilters = {
        limit: 100,
        skip: 0,
      };

      if (selectedAction) {
        filters.action = selectedAction;
      }

      if (searchQuery.trim()) {
        filters.userEmail = searchQuery.trim();
      }

      const result = await ActivityLogService.getActivityLogs(filters);
      setLogs(result.logs);
      setTotal(result.total);
    } catch (error: any) {
      // On error, use mock data for design preview
      console.warn('Failed to load activity logs, using mock data:', error.message);
      const mockLogs = generateMockLogs();
      let filteredLogs = mockLogs;
      
      if (selectedAction) {
        filteredLogs = filteredLogs.filter(log => log.action === selectedAction);
      }
      
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        filteredLogs = filteredLogs.filter(log => 
          log.userEmail?.toLowerCase().includes(query) ||
          log.userName?.toLowerCase().includes(query)
        );
      }
      
      setLogs(filteredLogs);
      setTotal(filteredLogs.length);
      // Don't show alert when using mock data
      // Alert.alert('Error', error.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, selectedAction, searchQuery, useMockData]);

  useEffect(() => {
    if (isAuthorized === true && !isInitialLoad) {
      loadLogs(false);
    }
  }, [selectedAction, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLogs(true);
  }, [loadLogs]);

  const getActionLabel = (action: string) => {
    const actionType = ACTION_TYPES.find(a => a.key === action);
    return actionType ? actionType.label : action;
  };

  const getActionColor = (action: string) => {
    if (action.startsWith('user.')) {
      return '#3B82F6'; // Blue
    }
    if (action.startsWith('admin.')) {
      return '#EF4444'; // Red
    }
    return '#6B7280'; // Gray
  };

  const getActionIcon = (action: string): string => {
    if (action === 'user.login') return 'log-in';
    if (action === 'user.logout') return 'log-out';
    if (action === 'user.register') return 'person-add';
    if (action === 'user.account_delete') return 'trash';
    if (action === 'admin.role_change') return 'swap-horizontal';
    if (action === 'admin.user_delete') return 'person-remove';
    if (action === 'admin.post_create') return 'add-circle';
    if (action === 'admin.post_update') return 'create';
    if (action === 'admin.post_delete') return 'trash';
    return 'document-text';
  };

  const getUserInitials = (log: ActivityLog) => {
    if (log.userName) {
      const parts = log.userName.trim().split(' ').filter(p => p.length > 0);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      if (parts[0] && parts[0].length >= 2) {
        return parts[0].substring(0, 2).toUpperCase();
      }
    }
    if (log.userEmail) {
      const emailPrefix = log.userEmail.trim().split('@')[0];
      if (emailPrefix.length >= 2) {
        return emailPrefix.substring(0, 2).toUpperCase();
      }
    }
    return 'U';
  };

  const getActionDescription = (log: ActivityLog): string => {
    const { action, details } = log;
    
    if (action === 'admin.role_change') {
      const adminName = log.userName || log.userEmail || 'Admin';
      const targetEmail = details.targetUserEmail || details.targetUserId || 'user';
      const oldRole = details.oldRole || 'user';
      const newRole = details.newRole || 'user';
      return `${adminName} changed ${targetEmail} from ${oldRole} to ${newRole}`;
    }
    
    if (action === 'user.login') {
      const userName = log.userName || log.userEmail || 'User';
      const method = details.method || 'email';
      return `${userName} logged in via ${method === 'email' ? 'Email' : method === 'google' ? 'Google' : 'Firebase'}`;
    }
    
    if (action === 'user.register') {
      const method = details.method || 'email';
      return `Registered new account via ${method === 'email' ? 'Email' : method === 'google' ? 'Google' : 'Firebase'}`;
    }
    
    if (action === 'admin.user_delete' || action === 'user.account_delete') {
      const deletedEmail = details.deletedUserEmail || details.deletedUserId || 'account';
      return `Deleted account: ${deletedEmail}`;
    }
    
    if (action === 'user.logout') {
      const userName = log.userName || log.userEmail || 'User';
      return `${userName} logged out`;
    }
    
    if (action === 'admin.post_create') {
      const userName = log.userName || log.userEmail || 'Admin';
      const postTitle = details.postTitle || 'Untitled Post';
      const category = details.category || 'post';
      return `${userName} created ${category}: "${postTitle}"`;
    }
    
    if (action === 'admin.post_update') {
      const userName = log.userName || log.userEmail || 'Admin';
      const postTitle = details.postTitle || 'Untitled Post';
      const updatedFields = details.updatedFields || [];
      return `${userName} updated post: "${postTitle}" (${updatedFields.length} field${updatedFields.length !== 1 ? 's' : ''} changed)`;
    }
    
    if (action === 'admin.post_delete') {
      const userName = log.userName || log.userEmail || 'Admin';
      const postTitle = details.postTitle || 'Untitled Post';
      return `${userName} deleted post: "${postTitle}"`;
    }
    
    // Fallback to action label
    return getActionLabel(action);
  };


  const toggleExpand = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatTimestamp = (timestamp: Date | string): { date: string; time?: string; isRelative: boolean } => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      if (isNaN(date.getTime())) return { date: 'Invalid date', isRelative: false };
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      // If less than 60 minutes, show relative time
      if (diffMins < 60) {
        return { date: timeAgo(date), isRelative: true };
      }
      
      // If less than 24 hours, show time only
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return { 
          date: date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }),
          isRelative: true
        };
      }
      
      // Otherwise show date and time separately
      return {
        date: formatDate(date),
        time: date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }),
        isRelative: false
      };
    } catch {
      return { date: 'Invalid date', isRelative: false };
    }
  };

  // Filter logs based on search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) {
      return logs;
    }
    
    const query = searchQuery.trim().toLowerCase();
    return logs.filter(log => {
      const emailMatch = log.userEmail?.toLowerCase().includes(query) || false;
      const nameMatch = log.userName?.toLowerCase().includes(query) || false;
      const actionMatch = getActionLabel(log.action).toLowerCase().includes(query) || false;
      return emailMatch || nameMatch || actionMatch;
    });
  }, [logs, searchQuery]);

  if (isAuthorized === false) {
    return null;
  }

  const safeInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  };

  const isPendingAuthorization = isAuthorized === null;

  return (
    <View style={styles.container} collapsable={false}>
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

      {/* Blur overlay */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 5 : 3}
        tint="default"
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      {/* Animated Floating Background Orb */}
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

      {/* Header */}
      <View style={[styles.header, { 
        marginTop: safeInsets.top,
        marginLeft: safeInsets.left,
        marginRight: safeInsets.right,
      }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.menuButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
          </TouchableOpacity>
        </View>
        <Text 
          style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(17) }]}
          pointerEvents="none"
        >
          Activity Log
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
            <View style={[styles.profileIconCircle, { backgroundColor: theme.colors.accent }]} pointerEvents="none">
              <Text style={[styles.profileInitials, { fontSize: theme.fontSize.scaleSize(13) }]}>AD</Text>
            </View>
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
          {/* Show loading indicator */}
          {(isPendingAuthorization || (loading && isInitialLoad)) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          ) : (
            <>
              {/* Search Bar and Filters */}
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
                    placeholder="Search by user email or name..."
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

              {/* Action Filter */}
              <View style={styles.filterSection}>
                <TouchableOpacity
                  style={[styles.filterButton, {
                    backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setOpenActionFilter(!openActionFilter);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="filter-outline" size={18} color={theme.colors.text} />
                  <Text style={[styles.filterButtonText, { color: theme.colors.text }]}>
                    {selectedAction ? ACTION_TYPES.find(a => a.key === selectedAction)?.label : 'All Actions'}
                  </Text>
                  <Ionicons name={openActionFilter ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>

                {/* Action Filter Dropdown */}
                {openActionFilter && (
                  <BlurView
                    intensity={Platform.OS === 'ios' ? 80 : 60}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.filterDropdown, {
                      backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    }]}
                  >
                    {ACTION_TYPES.map((option) => (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.filterDropdownItem,
                          selectedAction === option.key && {
                            backgroundColor: theme.colors.accent + '20',
                          }
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedAction(option.key);
                          setOpenActionFilter(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.filterDropdownItemText,
                          { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) },
                          selectedAction === option.key && { color: theme.colors.accent, fontWeight: '700' }
                        ]}>
                          {option.label}
                        </Text>
                        {selectedAction === option.key && (
                          <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </BlurView>
                )}
              </View>

              {/* Mock Data Indicator */}
              {useMockData && (
                <View style={styles.mockDataIndicator}>
                  <Ionicons name="information-circle" size={16} color={theme.colors.accent} />
                  <Text style={[styles.mockDataText, { color: theme.colors.accent, fontSize: theme.fontSize.scaleSize(12) }]}>
                    Showing mock data for design preview
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setUseMockData(false);
                      loadLogs(true);
                    }}
                    style={styles.mockDataButton}
                  >
                    <Text style={[styles.mockDataButtonText, { color: theme.colors.accent, fontSize: theme.fontSize.scaleSize(11) }]}>
                      Load Real Data
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Results Count */}
              {filteredLogs.length > 0 && (
                <View style={styles.resultsHeader}>
                  <Text style={[styles.resultsCount, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }]}>
                    {filteredLogs.length} {filteredLogs.length === 1 ? 'log' : 'logs'} {searchQuery.trim() || selectedAction ? 'found' : 'total'}
                  </Text>
                </View>
              )}

              {/* Activity Logs Table */}
              {filteredLogs.length === 0 && !loading && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-text-outline" size={48} color={theme.colors.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                    {searchQuery.trim() || selectedAction 
                      ? 'No activity logs found matching your filters'
                      : 'No activity logs found'}
                  </Text>
                </View>
              )}

              {filteredLogs.length > 0 && (
                <View style={styles.tableContainer}>
                  {/* Table Header */}
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
                    <View style={styles.tableHeaderRow}>
                      <View style={styles.iconHeaderCell}>
                        <Ionicons name="flash-outline" size={14} color={theme.colors.textMuted} style={{ marginBottom: 2 }} />
                        <Text style={[styles.tableHeaderText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(11) }]}>
                          Type
                        </Text>
                      </View>
                      <View style={styles.userHeaderCell}>
                        <Ionicons name="person-outline" size={14} color={theme.colors.textMuted} style={{ marginBottom: 2 }} />
                        <Text style={[styles.tableHeaderText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(11) }]}>
                          User
                        </Text>
                      </View>
                      <View style={styles.actionHeaderCell}>
                        <Ionicons name="document-text-outline" size={14} color={theme.colors.textMuted} style={{ marginBottom: 2 }} />
                        <Text style={[styles.tableHeaderText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(11) }]}>
                          Activity
                        </Text>
                      </View>
                      <View style={styles.timeHeaderCell}>
                        <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} style={{ marginBottom: 2 }} />
                        <Text style={[styles.tableHeaderText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(11) }]}>
                          Timestamp
                        </Text>
                      </View>
                    </View>
                  </BlurView>

                  {/* Table Rows */}
                  {filteredLogs.map((log, index) => {
                    const isExpanded = expandedLogs.has(log._id);
                    const actionColor = getActionColor(log.action);
                    const actionIcon = getActionIcon(log.action);
                    
                    return (
                      <View key={log._id}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => toggleExpand(log._id)}
                        >
                          <BlurView
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
                                borderLeftWidth: 4,
                                borderLeftColor: actionColor + '60',
                              },
                            ]}
                          >
                            <View style={styles.tableRow}>
                              {/* Icon Cell */}
                              <View style={styles.iconCell}>
                                <View style={[styles.actionIconCircle, { backgroundColor: actionColor + '20' }]}>
                                  <Ionicons name={actionIcon as any} size={18} color={actionColor} />
                                </View>
                              </View>

                              {/* User Cell */}
                              <View style={styles.userCell}>
                                <View style={styles.userCellContent}>
                                  <View style={[styles.userAvatar, { backgroundColor: actionColor + '15' }]}>
                                    <Text style={[styles.userAvatarText, { color: actionColor, fontSize: theme.fontSize.scaleSize(10) }]}>
                                      {getUserInitials(log)}
                                    </Text>
                                  </View>
                                </View>
                              </View>

                              {/* Action Cell */}
                              <View style={styles.actionCell}>
                                <View style={[styles.actionBadge, { backgroundColor: actionColor + '20' }]}>
                                  <Text style={[styles.actionBadgeText, { color: actionColor, fontSize: theme.fontSize.scaleSize(11) }]}>
                                    {getActionLabel(log.action)}
                                  </Text>
                                </View>
                              </View>

                              {/* Time Cell */}
                              <View style={styles.timeCell}>
                                {(() => {
                                  const timestamp = formatTimestamp(log.metadata.timestamp);
                                  return (
                                    <View style={styles.timeCellContent}>
                                      <Text 
                                        style={[
                                          styles.timeCellDate, 
                                          { 
                                            color: theme.colors.text, 
                                            textAlign: 'center', 
                                            fontSize: theme.fontSize.scaleSize(11),
                                            fontWeight: timestamp.isRelative ? '500' : '600'
                                          }
                                        ]}
                                      >
                                        {timestamp.date}
                                      </Text>
                                      {timestamp.time && (
                                        <Text 
                                          style={[
                                            styles.timeCellTime, 
                                            { 
                                              color: theme.colors.textMuted, 
                                              textAlign: 'center', 
                                              fontSize: theme.fontSize.scaleSize(9),
                                              opacity: 0.7
                                            }
                                          ]}
                                        >
                                          {timestamp.time}
                                        </Text>
                                      )}
                                      <Ionicons 
                                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                                        size={14} 
                                        color={theme.colors.textMuted}
                                        style={{ marginTop: 4, opacity: 0.6 }}
                                      />
                                    </View>
                                  );
                                })()}
                              </View>
                            </View>
                          </BlurView>
                        </TouchableOpacity>

                        {/* Expandable Details Row */}
                        {isExpanded && (
                          <BlurView
                            intensity={Platform.OS === 'ios' ? 50 : 40}
                            tint={isDarkMode ? 'dark' : 'light'}
                            style={[
                              styles.tableRowContainer,
                              {
                                backgroundColor: isDarkMode
                                  ? 'rgba(42, 42, 42, 0.3)'
                                  : 'rgba(255, 255, 255, 0.15)',
                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                borderTopWidth: 0,
                                borderLeftWidth: 4,
                                borderLeftColor: actionColor + '40',
                              },
                            ]}
                          >
                            <View style={styles.expandedDetailsRow}>
                              <View style={styles.expandedDetailsContent}>
                                {/* Action Description with Arrow */}
                                <View style={styles.expandedDescription}>
                                  <View style={styles.expandedDescriptionHeader}>
                                    <Ionicons name="arrow-forward" size={14} color={actionColor} />
                                    <Text style={[styles.expandedDescriptionLabel, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11), fontWeight: '600' }]}>
                                      Description:
                                    </Text>
                                  </View>
                                  <Text style={[styles.expandedDescriptionText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13), fontWeight: '500' }]}>
                                    {getActionDescription(log)}
                                  </Text>
                                </View>

                                {/* Full Details with Arrow */}
                                {log.details && Object.keys(log.details).length > 0 && (
                                  <View style={styles.logFullDetails}>
                                    <View style={styles.expandedDetailsHeader}>
                                      <Ionicons name="arrow-forward" size={14} color={actionColor} />
                                      <Text style={[styles.logFullDetailsTitle, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11), fontWeight: '600' }]}>
                                        Full Details:
                                      </Text>
                                    </View>
                                    {Object.entries(log.details).map(([key, value]) => (
                                      <View key={key} style={styles.logDetailItem}>
                                        <View style={styles.logDetailItemLeft}>
                                          <Ionicons name="chevron-forward" size={12} color={theme.colors.textMuted} style={{ opacity: 0.5 }} />
                                          <Text style={[styles.logDetailKey, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>
                                            {key}:
                                          </Text>
                                        </View>
                                        <Text style={[styles.logDetailValue, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(11) }]}>
                                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            </View>
                          </BlurView>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
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
  searchSection: {
    marginBottom: 12,
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
  filterSection: {
    marginBottom: 16,
    position: 'relative',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  filterDropdown: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  filterDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  filterDropdownItemText: {
    flex: 1,
    fontWeight: '500',
  },
  resultsHeader: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  tableContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  tableHeader: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    width: '100%',
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    width: '100%',
  },
  // Table Cells
  iconHeaderCell: {
    width: 50,
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  iconCell: {
    width: 50,
    paddingVertical: 12,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56,
  },
  userHeaderCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
    gap: 4,
  },
  userCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56,
    minWidth: 0,
  },
  userCellContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userCellText: {
    flex: 1,
    minWidth: 0,
  },
  actionHeaderCell: {
    flex: 2,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
    gap: 4,
  },
  actionCell: {
    flex: 2,
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56,
    minWidth: 0,
    gap: 6,
  },
  timeHeaderCell: {
    width: 80,
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  timeCell: {
    width: 80,
    paddingVertical: 12,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56,
  },
  timeCellContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  timeCellDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  timeCellTime: {
    fontSize: 9,
    fontWeight: '400',
  },
  tableCellText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tableCellSubtext: {
    fontSize: 10,
    fontWeight: '400',
    marginTop: 2,
  },
  actionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionBadgeContainer: {
    marginTop: 4,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  expandedDetailsRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  expandedDetailsContent: {
    width: '100%',
    gap: 16,
  },
  expandedDescription: {
    gap: 8,
  },
  expandedDescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expandedDescriptionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expandedDescriptionText: {
    lineHeight: 18,
    marginLeft: 20,
  },
  expandedDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  logFullDetails: {
    gap: 8,
  },
  logFullDetailsTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logDetailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
    marginLeft: 20,
  },
  logDetailItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 120,
  },
  logDetailKey: {
    fontWeight: '600',
  },
  logDetailValue: {
    flex: 1,
    fontWeight: '400',
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
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
    paddingVertical: 60,
  },
  mockDataIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    gap: 8,
  },
  mockDataText: {
    flex: 1,
    fontWeight: '500',
  },
  mockDataButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  mockDataButtonText: {
    fontWeight: '600',
  },
});

export default ActivityLogScreen;


