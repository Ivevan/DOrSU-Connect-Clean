import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../../components/common/BottomSheet';
import Sidebar from '../../components/navigation/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeValues } from '../../contexts/ThemeContext';
import ManageUserAccountService from '../../services/ManageUserAccountService';

type RootStackParamList = {
  ManageUserAccount: undefined;
  AdminDashboard: undefined;
  AdminSettings: undefined;
};

type TabType = 'users' | 'csv';
type UserType = 'student' | 'faculty';

interface UnifiedUser {
  _id?: string;
  studentId?: string;
  lastName: string;
  firstName: string;
  middleInitial?: string;
  extension?: string;
  fullName: string;
  type: UserType;
  createdAt?: string;
  updatedAt?: string;
}

const ManageUserAccount = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { isLoading: authLoading, isSuperAdmin, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Users state (combined students and faculty)
  const [users, setUsers] = useState<UnifiedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersRefreshing, setUsersRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add User Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [userType, setUserType] = useState<UserType>('student');
  const [studentId, setStudentId] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [extension, setExtension] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Success Modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Delete Confirmation Modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmData, setDeleteConfirmData] = useState<{
    type: 'single' | 'all-students' | 'all-faculty';
    user?: UnifiedUser;
    count?: number;
  } | null>(null);

  // Delete state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingUserType, setDeletingUserType] = useState<UserType | null>(null);
  const [deletingAllStudents, setDeletingAllStudents] = useState(false);
  const [deletingAllFaculty, setDeletingAllFaculty] = useState(false);
  
  // Collapsible sections state
  const [studentsExpanded, setStudentsExpanded] = useState(true);
  const [facultyExpanded, setFacultyExpanded] = useState(true);

  // CSV Upload state
  const [csvUploading, setCsvUploading] = useState(false);

  // Animated floating orb
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);
  
  // Bottom sheet animation for add user modal
  const addUserSheetY = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  // Check superadmin authorization
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !isFocused || !isMountedRef.current) {
      setIsAuthorized(false);
      return;
    }
    if (!isSuperAdmin) {
      setIsAuthorized(false);
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && isFocused && isAuthenticated) {
          Alert.alert(
            'Access Denied',
            'You do not have permission to access this page. Superadmin access required.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    setIsAuthorized(true);
    if (activeTab === 'users') {
    loadUsers(false);
    }
  }, [authLoading, isSuperAdmin, navigation, isAuthenticated, activeTab]);

  const loadUsers = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setUsersLoading(true);
      } else {
        setUsersRefreshing(true);
      }
      
      // Load both students and faculty
      const [students, faculty] = await Promise.all([
        ManageUserAccountService.getAllStudents(),
        ManageUserAccountService.getAllFaculty(),
      ]);

      // Combine and transform to unified format
      const unifiedUsers: UnifiedUser[] = [
        ...students.map(s => ({
          _id: s._id || s.studentId,
          studentId: s.studentId,
          lastName: s.lastName || '',
          firstName: s.firstName || '',
          middleInitial: s.middleInitial || '',
          extension: s.extension || '',
          fullName: s.fullName,
          type: 'student' as UserType,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        ...faculty.map(f => ({
          _id: f._id,
          lastName: '',
          firstName: '',
          middleInitial: '',
          extension: '',
          fullName: f.fullName,
          type: 'faculty' as UserType,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
      ];

      setUsers(unifiedUsers);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load users');
    } finally {
      setUsersLoading(false);
      setUsersRefreshing(false);
    }
  }, []);

  // Animate bottom sheet when modal visibility changes
  useEffect(() => {
    if (showAddModal) {
      Animated.timing(addUserSheetY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(addUserSheetY, {
        toValue: 500,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showAddModal, addUserSheetY]);

  const handleCloseAddModal = useCallback(() => {
    Animated.timing(addUserSheetY, {
      toValue: 500,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowAddModal(false);
      setStudentId('');
      setLastName('');
      setFirstName('');
      setMiddleInitial('');
      setExtension('');
    });
  }, [addUserSheetY]);

  const handleAddUser = async () => {
    // Validate required fields
    if (!lastName.trim() || !firstName.trim()) {
      Alert.alert('Error', 'Please fill in Last Name and First Name');
        return;
      }

    if (userType === 'student') {
      if (!studentId.trim()) {
        Alert.alert('Error', 'Please enter Student ID');
        return;
      }

      // Validate Student ID format
      const studentIdPattern = /^\d{4}-\d{4}$/;
      if (!studentIdPattern.test(studentId.trim())) {
        Alert.alert('Error', 'Invalid Student ID format. Expected format: YYYY-NNNN (e.g., 2022-0987)');
        return;
      }
    }

    try {
      setIsAddingUser(true);

      if (userType === 'student') {
        await ManageUserAccountService.addStudent(
          studentId.trim(),
          lastName.trim(),
          firstName.trim(),
          middleInitial.trim(),
          extension.trim()
        );
        let fullName = `${lastName}, ${firstName}`;
        if (middleInitial) fullName += ` ${middleInitial}.`;
        if (extension) fullName += ` ${extension}`;
        setSuccessMessage(`Student "${fullName}" added successfully!`);
          } else {
        // Construct faculty full name
        let facultyFullName = `${lastName}, ${firstName}`;
        if (middleInitial) {
          facultyFullName += ` ${middleInitial}.`;
        }
        if (extension) {
          facultyFullName += ` ${extension}`;
        }
        
        await ManageUserAccountService.addFaculty(facultyFullName);
        setSuccessMessage(`Faculty "${facultyFullName}" added successfully!`);
          }
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Close add modal
      handleCloseAddModal();
      
      // Show success modal
      setShowSuccessModal(true);
      
      // Reload users
      await loadUsers(true);
        } catch (error: any) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to add user');
        } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = async (user: UnifiedUser) => {
    setDeleteConfirmData({ type: 'single', user });
    setShowDeleteConfirm(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirmData || !deleteConfirmData.user) return;

    const user = deleteConfirmData.user;
    try {
      setDeletingUserId(user._id || '');
      setDeletingUserType(user.type);
      setShowDeleteConfirm(false);
      
      if (user.type === 'student' && user.studentId) {
        await ManageUserAccountService.deleteStudent(user.studentId);
        setSuccessMessage(`Student "${user.studentId}" deleted successfully!`);
      } else if (user.type === 'faculty' && user._id) {
        await ManageUserAccountService.deleteFaculty(user._id);
        setSuccessMessage(`Faculty "${user.fullName}" deleted successfully!`);
                }
                
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSuccessModal(true);
      await loadUsers(true);
              } catch (error: any) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to delete user');
              } finally {
      setDeletingUserId(null);
      setDeletingUserType(null);
      setDeleteConfirmData(null);
    }
  };

  const handleDeleteAllStudents = async () => {
    if (students.length === 0) {
      Alert.alert('No Students', 'There are no students to delete.');
      return;
    }

    setDeleteConfirmData({ type: 'all-students', count: students.length });
    setShowDeleteConfirm(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const confirmDeleteAllStudents = async () => {
    if (!deleteConfirmData || deleteConfirmData.type !== 'all-students') return;

    try {
      setDeletingAllStudents(true);
      setShowDeleteConfirm(false);
      const result = await ManageUserAccountService.deleteAllStudents();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessMessage(`Successfully deleted ${result.deletedCount} student${result.deletedCount !== 1 ? 's' : ''}!`);
      setShowSuccessModal(true);
      await loadUsers(true);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to delete all students');
    } finally {
      setDeletingAllStudents(false);
      setDeleteConfirmData(null);
    }
  };

  const handleDeleteAllFaculty = async () => {
    if (faculty.length === 0) {
      Alert.alert('No Faculty', 'There are no faculty to delete.');
      return;
    }

    setDeleteConfirmData({ type: 'all-faculty', count: faculty.length });
    setShowDeleteConfirm(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const confirmDeleteAllFaculty = async () => {
    if (!deleteConfirmData || deleteConfirmData.type !== 'all-faculty') return;

    try {
      setDeletingAllFaculty(true);
      setShowDeleteConfirm(false);
      const result = await ManageUserAccountService.deleteAllFaculty();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessMessage(`Successfully deleted ${result.deletedCount} faculty member${result.deletedCount !== 1 ? 's' : ''}!`);
      setShowSuccessModal(true);
      await loadUsers(true);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to delete all faculty');
    } finally {
      setDeletingAllFaculty(false);
      setDeleteConfirmData(null);
    }
  };

  const handleCSVUpload = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Request document picker with multiple MIME types for better compatibility
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        if (__DEV__) console.log('CSV upload canceled by user');
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        Alert.alert('Error', 'No file selected');
        return;
      }

      const file = result.assets[0];
      if (__DEV__) {
        console.log('Selected file:', {
          name: file.name,
          uri: file.uri,
          size: file.size,
          mimeType: file.mimeType,
        });
      }

      // Check if file is CSV
      const fileName = file.name?.toLowerCase() || '';
      if (!fileName.endsWith('.csv') && file.mimeType && !file.mimeType.includes('csv') && !file.mimeType.includes('text')) {
        Alert.alert(
          'Invalid File Type',
          'Please select a CSV file (.csv extension)',
          [{ text: 'OK' }]
        );
        return;
      }

      setCsvUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        // Read file content - handle web platform differently
        let fileContent: string;
        
        if (Platform.OS === 'web') {
          // For web, use FileReader API
          if (!file.uri) {
            throw new Error('File URI not available on web');
          }
          
          // On web, DocumentPicker returns a File object in the asset
          // We need to read it using FileReader
          const fileObj = (file as any).file || (result.assets[0] as any).file;
          
          if (fileObj && fileObj instanceof File) {
            fileContent = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                if (e.target?.result && typeof e.target.result === 'string') {
                  resolve(e.target.result);
                } else {
                  reject(new Error('Failed to read file content'));
                }
              };
              reader.onerror = () => reject(new Error('File reading error'));
              reader.readAsText(fileObj);
            });
          } else {
            // Fallback: try to fetch the file if we have a blob URL
            const response = await fetch(file.uri);
            fileContent = await response.text();
          }
        } else {
          // For native platforms, use FileSystem
          fileContent = await FileSystem.readAsStringAsync(file.uri);
        }
        
        if (__DEV__) {
          console.log('File content length:', fileContent.length);
          console.log('First 200 chars:', fileContent.substring(0, 200));
        }

        if (!fileContent || !fileContent.trim()) {
          Alert.alert('Error', 'CSV file is empty or could not be read');
          setCsvUploading(false);
          return;
        }

        // Parse CSV
        const parsed = ManageUserAccountService.parseCSV(fileContent);
        
        if (__DEV__) {
          console.log('Parsed CSV entries:', parsed.length);
          console.log('Sample parsed data:', parsed.slice(0, 3));
        }

        if (parsed.length === 0) {
          Alert.alert('Error', 'No valid entries found in CSV file. Please check the format.');
          setCsvUploading(false);
          return;
        }
        
        // Separate students and faculty
        const students = parsed.filter(p => p.type === 'student').map(p => ({
          studentId: p.studentId!,
          fullName: p.fullName
        }));
        const faculty = parsed.filter(p => p.type === 'faculty').map(p => ({
          fullName: p.fullName
        }));

        if (__DEV__) {
          console.log('Students to add:', students.length);
          console.log('Faculty to add:', faculty.length);
        }

        let studentsAdded = 0;
        let facultyAdded = 0;
        let errorMessages: string[] = [];

        // Add students
        if (students.length > 0) {
          try {
            const studentResult = await ManageUserAccountService.bulkAddStudents(students);
            studentsAdded = studentResult.insertedCount || 0;
            if (__DEV__) {
              console.log('Students added:', studentsAdded);
            }
          } catch (studentError: any) {
            errorMessages.push(`Students: ${studentError.message || 'Failed to add students'}`);
            if (__DEV__) {
              console.error('Error adding students:', studentError);
            }
          }
        }

        // Add faculty
        if (faculty.length > 0) {
          try {
            const facultyResult = await ManageUserAccountService.bulkAddFaculty(faculty);
            facultyAdded = facultyResult.insertedCount || 0;
            if (__DEV__) {
              console.log('Faculty added:', facultyAdded);
            }
          } catch (facultyError: any) {
            errorMessages.push(`Faculty: ${facultyError.message || 'Failed to add faculty'}`);
            if (__DEV__) {
              console.error('Error adding faculty:', facultyError);
            }
          }
        }

        // Build success/error message
        const messages = [];
        if (studentsAdded > 0) {
          messages.push(`${studentsAdded} student${studentsAdded !== 1 ? 's' : ''}`);
        }
        if (facultyAdded > 0) {
          messages.push(`${facultyAdded} faculty member${facultyAdded !== 1 ? 's' : ''}`);
        }
        
        if (messages.length > 0) {
          const successMsg = `Successfully added ${messages.join(' and ')}!`;
          if (errorMessages.length > 0) {
            setSuccessMessage(`${successMsg}\n\nNote: ${errorMessages.join('; ')}`);
          } else {
            setSuccessMessage(successMsg);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowSuccessModal(true);
          
          if (activeTab === 'users') {
            await loadUsers(true);
          }
        } else if (errorMessages.length > 0) {
          // All operations failed
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Upload Failed', errorMessages.join('\n\n'));
        } else {
          // No entries to add
          Alert.alert('No Entries', 'No users were added. Please check your CSV format.');
        }
      } catch (parseError: any) {
        if (__DEV__) {
          console.error('CSV parse/upload error:', parseError);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        // Format error message for better display
        let errorMessage = parseError.message || 'Failed to process CSV file. Please check the format and try again.';
        
        // If error contains multiple lines (from our improved parser), show it in a scrollable way
        if (errorMessage.includes('\n')) {
          // For multi-line errors, show first few lines and indicate there are more
          const errorLines = errorMessage.split('\n');
          if (errorLines.length > 5) {
            errorMessage = errorLines.slice(0, 5).join('\n') + `\n\n... and ${errorLines.length - 5} more error(s)`;
          }
        }
        
        Alert.alert(
          'CSV Upload Error',
          errorMessage,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('CSV upload error:', error);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Upload Failed',
        error.message || 'Failed to upload CSV file. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setCsvUploading(false);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(u => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const searchableText = u.type === 'student' 
      ? `${u.studentId || ''} ${u.fullName}`.toLowerCase()
      : u.fullName.toLowerCase();
    return searchableText.includes(query);
  });

  // Group users by type
  const students = filteredUsers.filter(u => u.type === 'student');
  const faculty = filteredUsers.filter(u => u.type === 'faculty');

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

  const getUserTypeColor = (type: UserType) => {
    return type === 'student' ? '#10B981' : '#2563EB';
  };

  const getUserTypeIcon = (type: UserType) => {
    return type === 'student' ? 'person' : 'school';
  };

  const renderUsersTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={{ paddingBottom: safeInsets.bottom + 20 }}
      refreshControl={
        <RefreshControl
          refreshing={usersRefreshing}
          onRefresh={() => loadUsers(true)}
          tintColor={theme.colors.accent}
          colors={[theme.colors.accent]}
        />
      }
    >
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
            }]}
            placeholder="Search users..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </BlurView>
          </View>

      {/* Users List */}
      {usersLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            {searchQuery ? 'No users found' : 'No users added yet'}
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {/* Students Section */}
          {students.length > 0 && (
            <View style={styles.sectionContainer}>
            <TouchableOpacity
                style={styles.sectionHeader}
              onPress={() => {
                  setStudentsExpanded(!studentsExpanded);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIndicator, { backgroundColor: getUserTypeColor('student') }]} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    STUDENTS ({students.length})
                  </Text>
                </View>
                <View style={styles.sectionHeaderRight}>
                  <TouchableOpacity
                    style={styles.deleteAllButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteAllStudents();
                    }}
                    disabled={deletingAllStudents}
                    activeOpacity={0.7}
                  >
                    {deletingAllStudents ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    )}
                    <Text style={[styles.deleteAllButtonText, { color: '#EF4444' }]}>
                      Delete All
                  </Text>
                  </TouchableOpacity>
                  <Ionicons 
                    name={studentsExpanded ? 'chevron-down' : 'chevron-forward'} 
                    size={20} 
                    color={theme.colors.textMuted} 
                  />
                </View>
            </TouchableOpacity>
              {studentsExpanded && students.map((user) => (
                  <BlurView
                  key={user._id}
                  intensity={Platform.OS === 'ios' ? 50 : 40}
                    tint={isDarkMode ? 'dark' : 'light'}
                  style={[styles.listItem, {
                    backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.4)' : 'rgba(255, 255, 255, 0.25)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                  }]}
                >
                  <View style={styles.listItemContent}>
                    <View style={styles.listItemLeft}>
                      <View style={[styles.userTypeBadge, { backgroundColor: getUserTypeColor('student') + '20' }]}>
                        <Ionicons name={getUserTypeIcon('student')} size={16} color={getUserTypeColor('student')} />
                      </View>
                      <View style={styles.listItemInfo}>
                        <Text style={[styles.listItemTitle, { color: theme.colors.text }]}>
                          {user.studentId}
                        </Text>
                        <Text style={[styles.listItemSubtitle, { color: theme.colors.textMuted }]}>
                          {user.fullName}
                        </Text>
                      </View>
                    </View>
                        <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteUser(user)}
                      disabled={deletingUserId === user._id}
                      activeOpacity={0.7}
                    >
                      {deletingUserId === user._id && deletingUserType === 'student' ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                </BlurView>
              ))}
            </View>
          )}

          {/* Faculty Section */}
          {faculty.length > 0 && (
            <View style={styles.sectionContainer}>
              <TouchableOpacity
                style={styles.sectionHeader}
                          onPress={() => {
                  setFacultyExpanded(!facultyExpanded);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          activeOpacity={0.7}
                        >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIndicator, { backgroundColor: getUserTypeColor('faculty') }]} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    FACULTY ({faculty.length})
                                </Text>
                              </View>
                <View style={styles.sectionHeaderRight}>
                  <TouchableOpacity
                    style={styles.deleteAllButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteAllFaculty();
                    }}
                    disabled={deletingAllFaculty}
                    activeOpacity={0.7}
                  >
                    {deletingAllFaculty ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    )}
                    <Text style={[styles.deleteAllButtonText, { color: '#EF4444' }]}>
                      Delete All
                    </Text>
                        </TouchableOpacity>
                  <Ionicons 
                    name={facultyExpanded ? 'chevron-down' : 'chevron-forward'} 
                    size={20} 
                    color={theme.colors.textMuted} 
                  />
                </View>
              </TouchableOpacity>
              {facultyExpanded && faculty.map((user) => (
                <BlurView
                  key={user._id}
                  intensity={Platform.OS === 'ios' ? 50 : 40}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={[styles.listItem, {
                    backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.4)' : 'rgba(255, 255, 255, 0.25)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                  }]}
                >
                  <View style={styles.listItemContent}>
                    <View style={styles.listItemLeft}>
                      <View style={[styles.userTypeBadge, { backgroundColor: getUserTypeColor('faculty') + '20' }]}>
                        <Ionicons name={getUserTypeIcon('faculty')} size={16} color={getUserTypeColor('faculty')} />
          </View>
                      <View style={styles.listItemInfo}>
                        <Text style={[styles.listItemTitle, { color: theme.colors.text }]}>
                          {user.fullName}
                        </Text>
        </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteUser(user)}
                      disabled={deletingUserId === user._id}
                      activeOpacity={0.7}
                    >
                      {deletingUserId === user._id && deletingUserType === 'faculty' ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      )}
                    </TouchableOpacity>
      </View>
    </BlurView>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderCSVTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={{ paddingBottom: safeInsets.bottom + 20 }}
    >
    <BlurView
      intensity={Platform.OS === 'ios' ? 50 : 40}
      tint={isDarkMode ? 'dark' : 'light'}
        style={[styles.formCard, {
          backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.3)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
        }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Bulk Upload CSV</Text>
        <Text style={[styles.sectionDescription, { color: theme.colors.textMuted }]}>
          Upload a CSV file to add multiple students and faculty at once.
          </Text>

        {/* CSV Format Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={[styles.instructionsTitle, { color: theme.colors.text }]}>
            CSV Format Instructions
          </Text>
          <Text style={[styles.instructionsText, { color: theme.colors.textMuted }]}>
            • Column 1: Student ID (format: YYYY-NNNN for students, leave empty for faculty)
          </Text>
          <Text style={[styles.instructionsText, { color: theme.colors.textMuted }]}>
            • Column 2: Full Name (Last Name, First Name Middle Initial)
          </Text>
          <Text style={[styles.instructionsText, { color: theme.colors.textMuted }]}>
            • Column 3: User Type ("Student" or "Faculty")
          </Text>
          <Text style={[styles.instructionsText, { color: theme.colors.textMuted }]}>
            • Example:
          </Text>
          <Text style={[styles.instructionsExample, { color: theme.colors.textMuted }]}>
            2022-1433,Valeriano, Kenneth Devon A.,Student{'\n'}
            2022-0987,Vasay, Ivan J P.,Student{'\n'}
            ,Sacay, Ar-Jay,Faculty{'\n'}
            ,Simo, Wilkin F.,Faculty
          </Text>
          <Text style={[styles.instructionsText, { color: theme.colors.textMuted, marginTop: 8, fontStyle: 'italic' }]}>
            Note: You can also use 2 columns (StudentID/Empty, FullName) - the system will automatically detect the type based on whether Student ID is present.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.uploadButton, { backgroundColor: theme.colors.accent }]}
          onPress={handleCSVUpload}
          disabled={csvUploading}
          activeOpacity={0.8}
        >
          {csvUploading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
              <Text style={styles.uploadButtonText}>Upload CSV File</Text>
            </>
          )}
        </TouchableOpacity>
      </BlurView>
    </ScrollView>
  );

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
            onPress={() => setIsSidebarOpen(true)} 
            style={styles.menuButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.customHamburger} pointerEvents="none">
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineLong, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineShort, { backgroundColor: isDarkMode ? '#F9FAFB' : '#1F2937' }]} />
            </View>
          </TouchableOpacity>
        </View>
        <Text 
          style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}
          pointerEvents="none"
        >
          Verified Users
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, {
        marginLeft: safeInsets.left,
        marginRight: safeInsets.right,
      }]}>
          <TouchableOpacity 
          style={[
            styles.tab,
            activeTab === 'users' && styles.tabActive,
            activeTab === 'users' && { borderBottomColor: theme.colors.accent },
          ]}
          onPress={() => {
            setActiveTab('users');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (users.length === 0) {
              loadUsers(false);
            }
          }}
            activeOpacity={0.7}
        >
          <Ionicons 
            name="people" 
            size={20} 
            color={activeTab === 'users' ? theme.colors.accent : theme.colors.textMuted} 
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'users' ? theme.colors.accent : theme.colors.textMuted },
            activeTab === 'users' && { fontWeight: '700' },
          ]}>
            Users
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'csv' && styles.tabActive,
            activeTab === 'csv' && { borderBottomColor: theme.colors.accent },
          ]}
          onPress={() => {
            setActiveTab('csv');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="document-attach" 
            size={20} 
            color={activeTab === 'csv' ? theme.colors.accent : theme.colors.textMuted} 
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'csv' ? theme.colors.accent : theme.colors.textMuted },
            activeTab === 'csv' && { fontWeight: '700' },
          ]}>
            CSV Upload
          </Text>
          </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.contentWrapper}>
        {activeTab === 'users' && renderUsersTab()}
        {activeTab === 'csv' && renderCSVTab()}
      </View>

      {/* Floating Plus Icon Button - Bottom Right */}
      {activeTab === 'users' && (
        <TouchableOpacity
          style={[styles.floatingAddButton, {
            bottom: insets.bottom + 80, // Above nav bar
          }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowAddModal(true);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.floatingAddButtonIcon, { backgroundColor: theme.colors.accent }]}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
            </View>
        </TouchableOpacity>
      )}

      {/* Add User Bottom Sheet */}
      <BottomSheet
        visible={showAddModal}
        onClose={handleCloseAddModal}
        sheetY={addUserSheetY}
        maxHeight="85%"
        backgroundColor={isDarkMode ? 'rgba(42, 42, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)'}
        overlayOpacity={0.5}
        enableBackdropClose={true}
      >
        <View style={styles.bottomSheetContent}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add User</Text>
                    <TouchableOpacity
              onPress={handleCloseAddModal}
              style={styles.modalCloseButton}
                      activeOpacity={0.7}
                    >
              <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
              </View>

          <ScrollView 
            style={styles.modalScrollView} 
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
          >
              {/* User Type Selection */}
              <View style={styles.typeSelection}>
                  <TouchableOpacity
                    style={[
                    styles.typeButton,
                    userType === 'student' && { backgroundColor: '#10B98120', borderColor: '#10B981' },
                    {
                      borderColor: userType === 'student' ? '#10B981' : 'rgba(255, 255, 255, 0.2)',
                      }
                    ]}
                    onPress={() => {
                    setUserType('student');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                  >
                  <Ionicons name="person" size={24} color={userType === 'student' ? '#10B981' : theme.colors.textMuted} />
                  <Text style={[styles.typeButtonText, {
                    color: userType === 'student' ? '#10B981' : theme.colors.textMuted,
                    fontWeight: userType === 'student' ? '700' : '500',
                  }]}>
                    Student
                    </Text>
                  </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                    styles.typeButton,
                    userType === 'faculty' && { backgroundColor: '#2563EB20', borderColor: '#2563EB' },
                    {
                      borderColor: userType === 'faculty' ? '#2563EB' : 'rgba(255, 255, 255, 0.2)',
                          }
                        ]}
                        onPress={() => {
                    setUserType('faculty');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                      >
                  <Ionicons name="school" size={24} color={userType === 'faculty' ? '#2563EB' : theme.colors.textMuted} />
                  <Text style={[styles.typeButtonText, {
                    color: userType === 'faculty' ? '#2563EB' : theme.colors.textMuted,
                    fontWeight: userType === 'faculty' ? '700' : '500',
                  }]}>
                    Faculty
                        </Text>
                      </TouchableOpacity>
              </View>

              {/* Student ID (only for students) */}
              {userType === 'student' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                    Student ID <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                      color: theme.colors.text,
                    }]}
                    placeholder="2022-0987"
                    placeholderTextColor={theme.colors.textMuted}
                    value={studentId}
                    onChangeText={setStudentId}
                    maxLength={9}
                    autoCapitalize="none"
                  />
                </View>
              )}

              {/* Last Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Last Name <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                    color: theme.colors.text,
                  }]}
                  placeholder="Enter Last Name"
                  placeholderTextColor={theme.colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
                </View>

              {/* First Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  First Name <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                    color: theme.colors.text,
                  }]}
                  placeholder="Enter First Name"
                  placeholderTextColor={theme.colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
                </View>

              {/* Middle Initial */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Middle Initial (Optional)</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                    color: theme.colors.text,
                  }]}
                  placeholder="Enter Middle Initial"
                  placeholderTextColor={theme.colors.textMuted}
                  value={middleInitial}
                  onChangeText={(text) => setMiddleInitial(text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1))}
                  autoCapitalize="characters"
                  maxLength={1}
                />
              </View>

              {/* Extension */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Extension (Optional)</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                    color: theme.colors.text,
                  }]}
                  placeholder="Jr., Sr., II, III, etc."
                  placeholderTextColor={theme.colors.textMuted}
                  value={extension}
                  onChangeText={setExtension}
                  autoCapitalize="words"
                />
              </View>

              {/* Add Button */}
              <TouchableOpacity
                style={[styles.modalAddButton, { backgroundColor: theme.colors.accent }]}
                onPress={handleAddUser}
                disabled={isAddingUser}
                activeOpacity={0.8}
              >
                {isAddingUser ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="add" size={20} color="#FFF" />
                    <Text style={styles.modalAddButtonText}>Add User</Text>
            </>
          )}
              </TouchableOpacity>
        </ScrollView>
      </View>
      </BottomSheet>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm && deleteConfirmData !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteConfirm(false);
          setDeleteConfirmData(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 80 : 60}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.deleteConfirmModalContent, {
              backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            }]}
          >
            <View style={styles.deleteConfirmIconContainer}>
              <View style={styles.deleteConfirmIconBackground}>
                <Ionicons name="warning" size={48} color="#EF4444" />
              </View>
            </View>
            <Text style={[styles.deleteConfirmTitle, { color: theme.colors.text }]}>
              {deleteConfirmData && deleteConfirmData.type === 'single' 
                ? 'Confirm Delete' 
                : deleteConfirmData && deleteConfirmData.type === 'all-students'
                ? 'Delete All Students'
                : 'Delete All Faculty'}
            </Text>
            <Text style={[styles.deleteConfirmMessage, { color: theme.colors.textMuted }]}>
              {deleteConfirmData && deleteConfirmData.type === 'single' && deleteConfirmData.user
                ? `Are you sure you want to delete ${deleteConfirmData.user.type === 'student' 
                    ? `student ${deleteConfirmData.user.studentId}` 
                    : `faculty "${deleteConfirmData.user.fullName}"`}?`
                : deleteConfirmData && deleteConfirmData.type === 'all-students'
                ? `Are you sure you want to delete ALL ${deleteConfirmData.count || 0} student${(deleteConfirmData.count || 0) !== 1 ? 's' : ''}? This action cannot be undone.`
                : deleteConfirmData && deleteConfirmData.type === 'all-faculty'
                ? `Are you sure you want to delete ALL ${deleteConfirmData.count || 0} faculty member${(deleteConfirmData.count || 0) !== 1 ? 's' : ''}? This action cannot be undone.`
                : 'Are you sure you want to delete this item?'}
            </Text>
            <View style={styles.deleteConfirmButtons}>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, styles.deleteConfirmButtonCancel, {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }]}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmData(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.deleteConfirmButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, styles.deleteConfirmButtonDelete, { backgroundColor: '#EF4444' }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (deleteConfirmData?.type === 'single') {
                    confirmDeleteUser();
                  } else if (deleteConfirmData?.type === 'all-students') {
                    confirmDeleteAllStudents();
                  } else if (deleteConfirmData?.type === 'all-faculty') {
                    confirmDeleteAllFaculty();
                  }
                }}
                activeOpacity={0.8}
                disabled={
                  (deleteConfirmData?.type === 'single' && (deletingUserId !== null)) ||
                  (deleteConfirmData?.type === 'all-students' && deletingAllStudents) ||
                  (deleteConfirmData?.type === 'all-faculty' && deletingAllFaculty)
                }
              >
                {(deleteConfirmData?.type === 'single' && deletingUserId !== null) ||
                 (deleteConfirmData?.type === 'all-students' && deletingAllStudents) ||
                 (deleteConfirmData?.type === 'all-faculty' && deletingAllFaculty) ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.deleteConfirmButtonTextDelete}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 80 : 60}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.successModalContent, {
              backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            }]}
          >
            <View style={styles.successIconContainer}>
              <View style={styles.successIconBackground}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: theme.colors.text }]}>Success!</Text>
            <Text style={[styles.successMessage, { color: theme.colors.textMuted }]}>
              {successMessage}
            </Text>
            <TouchableOpacity
              style={[styles.successButton, { backgroundColor: '#10B981' }]}
              onPress={() => {
                setShowSuccessModal(false);
                setSuccessMessage('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        allowedRoles={['superadmin']}
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
  addButtonHeader: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    zIndex: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  contentWrapper: {
    flex: 1,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
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
    paddingVertical: 12,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 15,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  listContainer: {
    gap: 8,
  },
  listItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  userTypeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemInfo: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 13,
  },
  deleteButton: {
    padding: 8,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
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
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  typeSelection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 16,
    gap: 8,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  instructionsExample: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 6,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Floating Add Button Styles
  floatingAddButton: {
    position: 'absolute',
    right: 20,
    zIndex: 999,
  },
  floatingAddButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomSheetContent: {
    flex: 1,
    minHeight: 200,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  modalAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  modalAddButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Success Modal Styles
  successModalContent: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  successButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    minWidth: 120,
  },
  successButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Delete Confirmation Modal Styles
  deleteConfirmModalContent: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  deleteConfirmIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteConfirmIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteConfirmMessage: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  deleteConfirmButtonCancel: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  deleteConfirmButtonDelete: {
    // backgroundColor is set inline
  },
  deleteConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteConfirmButtonTextDelete: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default ManageUserAccount;
