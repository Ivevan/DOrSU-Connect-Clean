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
];

const ActivityLogScreen = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [openActionFilter, setOpenActionFilter] = useState(false);
  const [total, setTotal] = useState(0);

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

  // Check admin authorization
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const isAdmin = await AsyncStorage.getItem('isAdmin');
        const userRole = await AsyncStorage.getItem('userRole');
        
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
        loadLogs(false);
      } catch (error) {
        console.error('Admin check failed:', error);
        setIsAuthorized(false);
        navigation.goBack();
      }
    };
    
    checkAdminAccess();
  }, [navigation]);

  const loadLogs = useCallback(async (isRefresh = false) => {
    try {
      if (!isInitialLoad || isRefresh) {
        setLoading(true);
      }
      if (isRefresh) {
        setRefreshing(true);
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
      Alert.alert('Error', error.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, selectedAction, searchQuery]);

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

  const formatTimestamp = (timestamp: Date | string) => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      if (isNaN(date.getTime())) return 'Invalid date';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 60) {
        return timeAgo(date);
      }
      
      return formatDate(date) + ' ' + date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return 'Invalid date';
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

              {/* Results Count */}
              {filteredLogs.length > 0 && (
                <View style={styles.resultsHeader}>
                  <Text style={[styles.resultsCount, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }]}>
                    {filteredLogs.length} {filteredLogs.length === 1 ? 'log' : 'logs'} {searchQuery.trim() || selectedAction ? 'found' : 'total'}
                  </Text>
                </View>
              )}

              {/* Activity Logs List */}
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

              {filteredLogs.map((log) => (
                <BlurView
                  key={log._id}
                  intensity={Platform.OS === 'ios' ? 50 : 40}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={[styles.logCard, {
                    backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.4)' : 'rgba(255, 255, 255, 0.25)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                  }]}
                >
                  <View style={styles.logHeader}>
                    <View style={[styles.actionBadge, { backgroundColor: getActionColor(log.action) + '20' }]}>
                      <Text style={[styles.actionBadgeText, { color: getActionColor(log.action), fontSize: theme.fontSize.scaleSize(10) }]}>
                        {getActionLabel(log.action)}
                      </Text>
                    </View>
                    <Text style={[styles.logTimestamp, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>
                      {formatTimestamp(log.metadata.timestamp)}
                    </Text>
                  </View>
                  
                  <View style={styles.logContent}>
                    <View style={styles.logUserInfo}>
                      <Ionicons name="person-circle-outline" size={20} color={theme.colors.textMuted} />
                      <Text style={[styles.logUserText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) }]}>
                        {log.userName || log.userEmail || 'Unknown User'}
                      </Text>
                    </View>
                    
                    {log.details && Object.keys(log.details).length > 0 && (
                      <View style={styles.logDetails}>
                        {Object.entries(log.details).map(([key, value]) => (
                          <Text key={key} style={[styles.logDetailText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>
                            {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </BlurView>
              ))}
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
  logCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionBadgeText: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logTimestamp: {
    fontWeight: '500',
  },
  logContent: {
    gap: 8,
  },
  logUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logUserText: {
    fontWeight: '600',
  },
  logDetails: {
    marginTop: 4,
    gap: 4,
  },
  logDetailText: {
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
});

export default ActivityLogScreen;

