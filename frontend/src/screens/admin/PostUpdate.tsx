import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  StatusBar,
  Platform,
  ScrollView,
  Vibration,
  Image,
  FlatList,
  Animated,
  InteractionManager,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import AdminDataService from '../../services/AdminDataService';
import NotificationService from '../../services/NotificationService';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import PreviewModal from '../../modals/PreviewModal';
import BottomSheet from '../../components/common/BottomSheet';
import MonthPickerModal from '../../modals/MonthPickerModal';

type RootStackParamList = {
  AdminDashboard: undefined;
  PostUpdate: undefined;
  ManagePosts: undefined;
};

type PostUpdateNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PostUpdate'>;

const PostUpdate: React.FC = () => {
  const navigation = useNavigation<PostUpdateNavigationProp>();
  const route = useRoute<any>();
  const editingPostId: string | undefined = route?.params?.postId;
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeValues();
  
  // Memoize safe area insets to prevent recalculation during navigation
  const safeInsets = useMemo(() => ({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  }), [insets.top, insets.bottom, insets.left, insets.right]);
  
  // Lock header height to prevent layout shifts
  const headerHeightRef = useRef<number>(64);
  const [headerHeight, setHeaderHeight] = useState(64);
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Announcement');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  // removed: scheduleForLater, pinToTop, markAsUrgent

  const [pickedFile, setPickedFile] = useState<{
    name: string;
    size?: number;
    mimeType?: string | null;
    uri: string;
    fileCopyUri?: string | null;
    cachedUri?: string | null;
  } | null>(null);

  // Track original values to detect changes when editing
  const [originalValues, setOriginalValues] = useState<{
    title: string;
    category: string;
    date: string;
    description: string;
    hasFile: boolean;
  }>({
    title: '',
    category: 'Announcement',
    date: '',
    description: '',
    hasFile: false,
  });

  // Category and Date picker state
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  
  
  // Custom Alert Modals
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [isPublishAlertOpen, setIsPublishAlertOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Animation values - DISABLED FOR PERFORMANCE DEBUGGING
  const fadeAnim = useRef(new Animated.Value(1)).current; // Set to 1 (visible) immediately
  const slideAnim = useRef(new Animated.Value(0)).current; // Set to 0 (no offset) immediately
  
  // Animated floating background orbs (Copilot-style) - Simplified
  const bgFade1 = useRef(new Animated.Value(0)).current;
  const bgFade2 = useRef(new Animated.Value(0)).current;

  // Screen entrance animation - starts from bottom
  const screenSlideY = useRef(new Animated.Value(1000)).current;
  const screenOpacity = useRef(new Animated.Value(0)).current;

  // Bottom sheet animation refs
  const categorySheetY = useRef(new Animated.Value(300)).current;
  const datePickerSheetY = useRef(new Animated.Value(300)).current;
  const cancelAlertSheetY = useRef(new Animated.Value(300)).current;
  const publishAlertSheetY = useRef(new Animated.Value(300)).current;
  
  // Month picker animation refs
  const monthPickerScaleAnim = useRef(new Animated.Value(0)).current;
  const monthPickerOpacityAnim = useRef(new Animated.Value(0)).current;

  // Inline, dependency-free date data
  const months = useMemo(() => [
    'January','February','March','April','May','June','July','August','September','October','November','December'
  ], []);

  // Category meta for richer UI
  const CATEGORY_OPTIONS = useMemo(() => ([
    { key: 'Announcement', icon: 'megaphone', color: '#1976D2', description: 'General updates and notices' },
    { key: 'Event', icon: 'calendar-outline', color: '#D32F2F', description: 'Schedules and activities' },
    { key: 'News', icon: 'newspaper-outline', color: '#5E35B1', description: 'Campus news' },
  ]), []);
  const currentCategory = CATEGORY_OPTIONS.find(o => o.key === category) || CATEGORY_OPTIONS[0];

  const current = selectedDateObj ?? new Date();
  const [tmpMonth, setTmpMonth] = useState<number>(current.getMonth());
  const [tmpYear, setTmpYear] = useState<number>(current.getFullYear());
  const [tmpDay, setTmpDay] = useState<number>(current.getDate());
  
  // Animate screen entrance from bottom when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset animation values
      screenSlideY.setValue(1000);
      screenOpacity.setValue(0);
      
      // Animate screen entrance
      Animated.parallel([
        Animated.spring(screenSlideY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(screenOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      return () => {
        // Cleanup: reset animation when screen loses focus
        screenSlideY.setValue(1000);
        screenOpacity.setValue(0);
      };
    }, [screenSlideY, screenOpacity])
  );

  // Animate floating background orbs on mount
  useEffect(() => {
    const animations = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bgFade1, {
            toValue: 1,
            duration: 10000,
            useNativeDriver: true,
          }),
          Animated.timing(bgFade1, {
            toValue: 0,
            duration: 10000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bgFade2, {
            toValue: 1,
            duration: 15000,
            useNativeDriver: true,
          }),
          Animated.timing(bgFade2, {
            toValue: 0,
            duration: 15000,
            useNativeDriver: true,
          }),
        ])
      ),
    ];
    animations.forEach(anim => anim.start());
  }, []);

  const getDaysInMonth = (year: number, monthIdx: number) => {
    return new Date(year, monthIdx + 1, 0).getDate();
  };

  // Calendar grid helper functions
  const getFirstDayOfMonth = (year: number, monthIdx: number) => {
    return new Date(year, monthIdx, 1).getDay();
  };

  const generateCalendarGrid = useMemo(() => {
    const daysInMonth = getDaysInMonth(tmpYear, tmpMonth);
    const firstDay = getFirstDayOfMonth(tmpYear, tmpMonth);
    const grid: (number | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      grid.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      grid.push(day);
    }
    
    return grid;
  }, [tmpYear, tmpMonth]);

  const daysInTmpMonth = getDaysInMonth(tmpYear, tmpMonth);
  const dayOptions = Array.from({ length: daysInTmpMonth }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i); // [y-2..y+3]

  // Month navigation functions
  const goToPreviousMonth = useCallback(() => {
    if (tmpMonth === 0) {
      setTmpMonth(11);
      setTmpYear(tmpYear - 1);
    } else {
      setTmpMonth(tmpMonth - 1);
    }
    // Reset day if it's invalid for the new month
    const daysInNewMonth = getDaysInMonth(tmpMonth === 0 ? tmpYear - 1 : tmpYear, tmpMonth === 0 ? 11 : tmpMonth - 1);
    if (tmpDay > daysInNewMonth) {
      setTmpDay(daysInNewMonth);
    }
  }, [tmpMonth, tmpYear, tmpDay]);

  const goToNextMonth = useCallback(() => {
    if (tmpMonth === 11) {
      setTmpMonth(0);
      setTmpYear(tmpYear + 1);
    } else {
      setTmpMonth(tmpMonth + 1);
    }
    // Reset day if it's invalid for the new month
    const daysInNewMonth = getDaysInMonth(tmpMonth === 11 ? tmpYear + 1 : tmpYear, tmpMonth === 11 ? 0 : tmpMonth + 1);
    if (tmpDay > daysInNewMonth) {
      setTmpDay(daysInNewMonth);
    }
  }, [tmpMonth, tmpYear, tmpDay]);

  // Month picker handlers
  const openMonthPicker = useCallback(() => {
    setShowMonthPicker(true);
    Animated.parallel([
      Animated.spring(monthPickerScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(monthPickerOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [monthPickerScaleAnim, monthPickerOpacityAnim]);

  const closeMonthPicker = useCallback(() => {
    Animated.parallel([
      Animated.spring(monthPickerScaleAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(monthPickerOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      InteractionManager.runAfterInteractions(() => {
        setShowMonthPicker(false);
      });
    });
  }, [monthPickerScaleAnim, monthPickerOpacityAnim]);

  const selectMonth = useCallback((monthIndex: number, year?: number) => {
    const targetYear = year || tmpYear;
    setTmpMonth(monthIndex);
    setTmpYear(targetYear);
    // Reset day if it's invalid for the new month
    const daysInNewMonth = getDaysInMonth(targetYear, monthIndex);
    if (tmpDay > daysInNewMonth) {
      setTmpDay(daysInNewMonth);
    }
    closeMonthPicker();
    Haptics.selectionAsync();
  }, [tmpYear, tmpDay, closeMonthPicker]);

  // Single tap handler for month/year
  const handleMonthYearTap = useCallback(() => {
    openMonthPicker();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [openMonthPicker]);

  // Helper to format date as dd/mm/yyyy for display
  const formatDateForDisplay = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const MONTH_NAME_MAP = useMemo<Record<string, number>>(() => ({
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11
  }), []);

  // Helper to parse date from various formats (ISO, dd/mm/yyyy, textual, etc.)
  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    
    // Try ISO format first
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) return isoDate;
    
    // Try dd/mm/yyyy format
    const ddmmyyyyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, dd, mm, yyyy] = ddmmyyyyMatch;
      const parsed = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // Try formats with month names e.g., "February 12, 2025" or "Feb 12 2025"
    const monthNameMatch = dateStr.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,)?\s+(\d{4})$/);
    if (monthNameMatch) {
      const [, monthNameRaw, dayRaw, yearRaw] = monthNameMatch;
      const monthIndex = MONTH_NAME_MAP[monthNameRaw.toLowerCase()];
      const day = parseInt(dayRaw, 10);
      const year = parseInt(yearRaw, 10);
      if (monthIndex !== undefined && !isNaN(day) && !isNaN(year)) {
        const parsed = new Date(year, monthIndex, day);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    
    return null;
  };
  const resolvedDateForSubmission = useMemo(() => {
    if (selectedDateObj) return selectedDateObj;
    return parseDate(date);
  }, [selectedDateObj, date]);

  const openCategoryMenu = useCallback(() => {
    setIsCategoryOpen(true);
    setTimeout(() => {
      Animated.timing(categorySheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
  }, [categorySheetY]);
  const closeCategoryMenu = useCallback(() => {
    Animated.timing(categorySheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      InteractionManager.runAfterInteractions(() => {
        setIsCategoryOpen(false);
      });
    });
  }, [categorySheetY]);
  const selectCategory = useCallback((value: string) => {
    setCategory(value);
    closeCategoryMenu();
  }, [closeCategoryMenu]);

  const onPressDate = useCallback(() => {
    const base = selectedDateObj ?? new Date();
    setTmpMonth(base.getMonth());
    setTmpYear(base.getFullYear());
    setTmpDay(base.getDate());
    setShowDatePicker(true);
    setTimeout(() => {
      Animated.timing(datePickerSheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
  }, [selectedDateObj, datePickerSheetY]);

  const confirmTmpDate = useCallback(() => {
    const safeDay = Math.min(tmpDay, getDaysInMonth(tmpYear, tmpMonth));
    const next = new Date(tmpYear, tmpMonth, safeDay);
    setSelectedDateObj(next);
    setDate(formatDateForDisplay(next));
    Animated.timing(datePickerSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      InteractionManager.runAfterInteractions(() => {
        setShowDatePicker(false);
      });
    });
  }, [tmpDay, tmpYear, tmpMonth, datePickerSheetY]);

  const cancelTmpDate = useCallback(() => {
    Animated.timing(datePickerSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      InteractionManager.runAfterInteractions(() => {
        setShowDatePicker(false);
      });
    });
  }, [datePickerSheetY]);


  const handlePublish = useCallback(() => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    if (!title.trim()) {
      Alert.alert('Error', 'Please fill in the title field');
      return;
    }
    
    setIsAnimating(true);
    setIsPublishAlertOpen(true);
    setTimeout(() => {
      Animated.timing(publishAlertSheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating, title, publishAlertSheetY]);

  // Check if form is valid for publishing - memoized (only title is required)
  const isFormValid = useMemo(() => title.trim() !== '', [title]);

  const handleCancel = useCallback(() => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    // Check if there are any changes compared to original values
    const hasChanges = 
      title.trim() !== originalValues.title.trim() ||
      description.trim() !== originalValues.description.trim() ||
      date !== originalValues.date ||
      category !== originalValues.category ||
      pickedFile !== null; // New file always counts as a change
    
    // If no changes, cancel immediately without showing modal
    if (!hasChanges) {
      if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
        navigation.goBack();
      } else {
        (navigation as any).navigate('AdminDashboard');
      }
      return;
    }
    
    // If there are changes, show confirmation modal
    setIsAnimating(true);
    setIsCancelAlertOpen(true);
    setTimeout(() => {
      Animated.timing(cancelAlertSheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 0);
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating, cancelAlertSheetY, title, description, date, category, pickedFile, originalValues, navigation]);

  const handleShowPreview = useCallback(() => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    setIsAnimating(true);
    setIsPreviewModalOpen(true);
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating]);

  // Preview helpers to mirror AdminDashboard
  const timeAgo = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const then = new Date(dateStr);
    if (isNaN(then.getTime())) return '';
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - then.getTime());
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const previewImages = React.useMemo(() => {
    const uris: string[] = [];
    const c = pickedFile?.cachedUri || '';
    const a = pickedFile?.fileCopyUri || '';
    const b = pickedFile?.uri || '';
    if (c) uris.push(c);
    if (a && !uris.includes(a)) uris.push(a);
    if (b && !uris.includes(b)) uris.push(b);
    return uris.filter(u => typeof u === 'string' && u.trim().length > 0);
  }, [pickedFile]);

  // Load existing post when editing
  React.useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      if (!editingPostId) {
        // For new posts, reset original values
        setOriginalValues({
          title: '',
          category: 'Announcement',
          date: '',
          description: '',
          hasFile: false,
        });
        setSelectedDateObj(null);
        setDate('');
        return;
      }
      const post = await AdminDataService.getPostById(editingPostId);
      if (isCancelled || !post) return;
      const loadedTitle = post.title || '';
      const loadedCategory = post.category || 'Announcement';
      const loadedDescription = post.description || '';
      
      // Parse and format the date properly
      // Use isoDate if available (more reliable), otherwise use date
      const dateSource = post.isoDate || post.date || '';
      const parsedDate = parseDate(dateSource);
      const formattedDate = parsedDate ? formatDateForDisplay(parsedDate) : '';
      
      setTitle(loadedTitle);
      setCategory(loadedCategory);
      setDate(formattedDate);
      setDescription(loadedDescription);
      
      // Initialize selectedDateObj for the date picker
      if (parsedDate) {
        setSelectedDateObj(parsedDate);
        // Also initialize tmp values for the date picker
        setTmpMonth(parsedDate.getMonth());
        setTmpYear(parsedDate.getFullYear());
        setTmpDay(parsedDate.getDate());
      }
      
      // Store original values for change detection (use formatted date for comparison)
      setOriginalValues({
        title: loadedTitle,
        category: loadedCategory,
        date: formattedDate,
        description: loadedDescription,
        hasFile: false, // We don't track file changes from existing posts
      });
    };
    load();
    return () => { isCancelled = true; };
  }, [editingPostId]);

  const confirmPublish = useCallback(() => {
    // Prevent double submission
    if (isPublishing) {
      return;
    }

    setIsPublishing(true);
    
    // Close modal immediately for better UX
    Animated.timing(publishAlertSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      InteractionManager.runAfterInteractions(() => {
        setIsPublishAlertOpen(false);
      });
    });

    // Prepare payload immediately (no delay)
    const submissionDate = resolvedDateForSubmission || new Date();
    const isoDate = submissionDate.toISOString();
    
    const payload: any = {
      title: title || 'Untitled',
      category,
      date: isoDate,
      isoDate,
      description,
    };

    // If new image is picked, include imageFile object for proper backend handling
    if (pickedFile) {
      payload.image = pickedFile.uri;
      payload.images = [pickedFile.uri];
      payload.imageFile = pickedFile;
      console.log('📸 Including imageFile in payload', { uri: pickedFile.uri.substring(0, 50) + '...', hasImageFile: !!pickedFile });
    }
    
    console.log('📤 Calling AdminDataService', { 
      isEdit: !!editingPostId, 
      postId: editingPostId,
      payload: { ...payload, imageFile: payload.imageFile ? 'present' : 'none' } 
    });
    
    // Start the operation and wait for it to complete before navigating
    const op = editingPostId
      ? AdminDataService.updatePost(editingPostId, payload)
      : AdminDataService.createPost(payload);
    
    // Wait for the operation to complete before navigating
    // This ensures the backend has processed the update before we refresh the screens
    Promise.resolve(op)
      .then(async (result) => {
        console.log('✅ Post operation successful', { result: !!result });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Trigger notification check for new posts (only for new posts, not updates)
        if (!editingPostId && result?.id) {
          try {
            // Wait a bit for backend to process, then send notification for this specific post
            setTimeout(() => {
              NotificationService.notifyNewPost(result.id).catch((err: any) => {
                console.warn('Failed to send notification after post creation:', err);
                // Fallback to general check
                NotificationService.checkNewPosts().catch(() => {});
              });
            }, 1500);
          } catch (error) {
            console.warn('Could not trigger notifications:', error);
          }
        }
        
        // Add a small delay to ensure backend has fully processed the update
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Navigate after update is complete
        // Try to go back to previous screen, otherwise navigate to AdminDashboard
        InteractionManager.runAfterInteractions(() => {
          if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
            navigation.goBack();
          } else {
            // Fallback to AdminDashboard if we can't go back
            navigation.navigate('AdminDashboard');
          }
        });
      })
      .catch((error) => {
        console.error('❌ Post operation failed:', error);
        Alert.alert('Error', error.message || 'Failed to save post');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      })
      .finally(() => {
        setIsPublishing(false);
      });
  }, [title, category, date, description, pickedFile, editingPostId, navigation, resolvedDateForSubmission, publishAlertSheetY, isPublishing, parseDate]);

  const confirmCancel = useCallback(() => {
    Animated.timing(cancelAlertSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      InteractionManager.runAfterInteractions(() => {
        setIsCancelAlertOpen(false);
        if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
          navigation.goBack();
        } else {
          (navigation as any).navigate('AdminDashboard');
        }
      });
    });
  }, [navigation, cancelAlertSheetY]);

  const handleAddAttachment = useCallback(async () => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    setIsAnimating(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        multiple: false,
        copyToCacheDirectory: true,
      });

      // New API returns assets array; older returns name/size/uri directly
      const asset = Array.isArray((result as any).assets)
        ? (result as any).assets[0]
        : (result as any);

      if (result.canceled) {
        setIsAnimating(false);
        return;
      }

      const mime = asset.mimeType || '';
      if (!mime.startsWith('image/')) {
        Alert.alert('Invalid file', 'Please select a JPEG or PNG image.');
        setIsAnimating(false);
        return;
      }
      
      let cachedUri: string | null = null;
      try {
        const source = (asset.fileCopyUri || asset.uri) as string;
        const extension = (asset.name || 'image').split('.').pop() || 'jpg';
        const targetPath = `${FileSystem.cacheDirectory}preview_${Date.now()}.${extension}`;
        if (source && !source.startsWith('file://')) {
          await FileSystem.copyAsync({ from: source, to: targetPath });
          cachedUri = targetPath;
        } else if (source) {
          cachedUri = source;
        }
      } catch {}

      setPickedFile({
        name: asset.name || 'Unnamed file',
        size: asset.size,
        mimeType: asset.mimeType ?? null,
        uri: asset.uri,
        fileCopyUri: asset.fileCopyUri ?? null,
        cachedUri,
      });
      setIsAnimating(false);
    } catch (e) {
      Alert.alert('Error', 'Unable to pick a file.');
      setIsAnimating(false);
    }
  }, [isAnimating]);


  const handleUpload = useCallback(async () => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    if (!pickedFile) {
      Alert.alert('No file', 'Please select a file first.');
      return;
    }
    
    setIsAnimating(true);
    // Placeholder upload; integrate backend here
    Alert.alert('Upload', `Uploading: ${pickedFile.name}`);
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating, pickedFile]);

  return (
    <Animated.View 
      style={[
        styles.container, 
        {
          backgroundColor: 'transparent',
          transform: [{ translateY: screenSlideY }],
          opacity: screenOpacity,
        }
      ]} 
      collapsable={false}
    >
      <StatusBar 
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        translucent={true}
        hidden={false}
      />
      
      {/* Warm Gradient Background */}
      <LinearGradient
        colors={[
          isDarkMode ? '#0B1220' : '#FBF8F3',
          isDarkMode ? '#111827' : '#F8F5F0',
          isDarkMode ? '#1F2937' : '#F5F2ED'
        ]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      
      {/* Simplified Animated Background */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        {/* Subtle gradient overlays */}
        <Animated.View
          style={[
            styles.gradientOverlay1,
            {
              opacity: bgFade1.interpolate({
                inputRange: [0, 1],
                outputRange: [0.15, 0.3],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={[theme.colors.orbColors.orange5, theme.colors.orbColors.orange2, 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.gradientOverlay2,
            {
              opacity: bgFade2.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1, 0.25],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', theme.colors.orbColors.orange4, theme.colors.orbColors.orange1]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>
      </View>
      
      {/* Header - Clean transparent style matching AIChat */}
      <View
        style={[styles.header, {
          backgroundColor: 'transparent',
          marginTop: safeInsets.top,
          borderBottomWidth: 0,
        }]}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          // Only update if height actually changed to prevent unnecessary re-renders
          if (height > 0 && Math.abs(height - headerHeightRef.current) > 1) {
            headerHeightRef.current = height;
            setHeaderHeight(height);
          }
        }}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => {
              if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
                navigation.goBack();
              } else {
                (navigation as any).navigate('AdminDashboard');
              }
            }}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: theme.fontSize.scaleSize(17) }]} numberOfLines={1} pointerEvents="none">Post Update</Text>
        <View style={styles.headerRight}>
          <View style={[styles.categoryBadgeHeader, {
            backgroundColor: isDarkMode ? `${currentCategory.color}30` : `${currentCategory.color}20`,
            borderColor: isDarkMode ? `${currentCategory.color}50` : `${currentCategory.color}40`,
          }]}>
            <Text style={[styles.categoryBadgeLabel, { color: currentCategory.color, fontSize: theme.fontSize.scaleSize(11) }]} numberOfLines={1} ellipsizeMode="tail">{category}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={[styles.scrollView, {
          marginTop: 0,
          marginBottom: 0,
        }]}
        contentContainerStyle={[styles.content, {
          paddingBottom: 180, // Enough space for translucent footer
          paddingTop: 12,
        }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={true}
        removeClippedSubviews={true}
        scrollEventThrottle={16}
      >
        <View style={styles.contentInner}>
        
        {/* Title Field */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.cardContainer, {
            backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          }]}
        >
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) }]}>Title <Text style={{ color: '#E53935', fontSize: theme.fontSize.scaleSize(13) }}>*</Text></Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.textInput, styles.textInputElevated, { backgroundColor: 'transparent', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)', color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}
                placeholder="Enter announcement title"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={theme.colors.textMuted}
                maxLength={100}
              />
              <Text style={[styles.charCounter, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>{title.length}/100</Text>
            </View>
          </View>
        </BlurView>

        {/* Category and Date Row */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.cardContainer, {
            backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          }]}
        >
          <View style={styles.rowContainer}>
          {/* Category Dropdown */}
          <View style={styles.halfInputContainer}>
            <Text style={[styles.label, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) }]}>Category</Text>
            <TouchableOpacity style={[styles.dropdownContainer, { backgroundColor: 'transparent', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)' }]} onPress={openCategoryMenu}>
              <Text style={[styles.dropdownText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]} numberOfLines={1}>{category}</Text>
              <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Date Field */}
          <View style={styles.halfInputContainer}>
            <Text style={[styles.label, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) }]}>Date</Text>
            <TouchableOpacity style={[styles.dateContainer, { backgroundColor: 'transparent', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)' }]} onPress={onPressDate}>
              <Text style={[styles.dateText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}>{date || 'dd/mm/yyyy'}</Text>
              <Ionicons name="calendar" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          </View>
        </BlurView>


        {/* Category Menu (enhanced) */}
        <BottomSheet
          visible={isCategoryOpen}
          onClose={closeCategoryMenu}
          sheetY={categorySheetY}
          backgroundColor={theme.colors.card}
          maxHeight="70%"
        >
          <View style={styles.modalHeaderRow}>
            <Text style={[styles.categoryMenuTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}>Select Category</Text>
            <TouchableOpacity onPress={closeCategoryMenu} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 320 }}>
            {CATEGORY_OPTIONS.map(opt => {
              const active = category === opt.key;
              return (
                <TouchableOpacity key={opt.key} onPress={() => selectCategory(opt.key)} style={[styles.categoryRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, active && { backgroundColor: opt.color + '0F', borderColor: opt.color }]}> 
                  <View style={[styles.categoryIconWrap, { backgroundColor: opt.color + '22' }]}>
                    <Ionicons name={opt.icon as any} size={18} color={opt.color} />
                  </View>
                  <View style={styles.categoryTextWrap}>
                    <Text style={[styles.categoryRowTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) }, active && { color: theme.colors.text }]}>{opt.key}</Text>
                    <Text style={[styles.categoryRowSub, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>{opt.description}</Text>
                  </View>
                  {active && (
                    <Ionicons name="checkmark-circle" size={20} color={opt.color} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </BottomSheet>

        {/* Calendar Date Picker */}
        <BottomSheet
          visible={showDatePicker}
          onClose={cancelTmpDate}
          sheetY={datePickerSheetY}
          backgroundColor={theme.colors.card}
          maxHeight="75%"
        >
          <ScrollView 
            style={styles.calendarScrollView}
            contentContainerStyle={styles.calendarScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Month/Year Header with Navigation */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={goToPreviousMonth} style={styles.calendarNavButton}>
                <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.calendarHeaderCenter}
                onPress={handleMonthYearTap}
                activeOpacity={0.7}
              >
                <Text style={[styles.calendarMonthYear, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(16) }]}>
                  {months[tmpMonth]} {tmpYear}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goToNextMonth} style={styles.calendarNavButton}>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Weekday Headers */}
            <View style={[styles.calendarWeekdays, { backgroundColor: theme.colors.surface }]}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <View key={index} style={[styles.calendarWeekday, { borderRightColor: theme.colors.border }]}>
                  <Text style={[styles.calendarWeekdayText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(12) }]}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {generateCalendarGrid.map((day, index) => {
                const currentDate = day ? new Date(tmpYear, tmpMonth, day) : null;
                const isCurrentDay = currentDate ? (
                  day === new Date().getDate() &&
                  tmpMonth === new Date().getMonth() &&
                  tmpYear === new Date().getFullYear()
                ) : false;
                const isSelectedDay = day === tmpDay;
                
                if (!day) {
                  return (
                    <View
                      key={`empty-${index}`}
                      style={[
                        styles.calendarDayCell,
                        {
                          backgroundColor: theme.colors.surfaceAlt,
                          borderRightColor: theme.colors.border,
                          borderBottomColor: theme.colors.border,
                          borderRightWidth: (index % 7) === 6 ? 0 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    />
                  );
                }
                
                const isLastColumn = (index % 7) === 6;
                
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.calendarDayCell,
                      { 
                        backgroundColor: theme.colors.card,
                        borderTopWidth: isSelectedDay ? 2 : 0,
                        borderTopColor: isSelectedDay ? '#2563EB' : 'transparent',
                        borderLeftWidth: isSelectedDay ? 2 : 0,
                        borderLeftColor: isSelectedDay ? '#2563EB' : 'transparent',
                        borderRightWidth: isLastColumn ? (isSelectedDay ? 2 : 0) : (isSelectedDay ? 2 : StyleSheet.hairlineWidth),
                        borderRightColor: isSelectedDay ? '#2563EB' : theme.colors.border,
                        borderBottomWidth: isSelectedDay ? 2 : StyleSheet.hairlineWidth,
                        borderBottomColor: isSelectedDay ? '#2563EB' : theme.colors.border,
                      }
                    ]}
                    onPress={() => setTmpDay(day)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.calendarDayContent}>
                      <View style={[
                        styles.calendarDayNumberContainer,
                        isCurrentDay && { backgroundColor: '#2563EB' },
                      ]}>
                        <Text
                          style={[
                            styles.calendarDayText,
                            { 
                              fontSize: theme.fontSize.scaleSize(12) 
                            },
                            isCurrentDay && { color: '#FFFFFF', fontWeight: '700' },
                            !isCurrentDay && { color: theme.colors.text },
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Buttons - Fixed at bottom */}
          <View style={[styles.dateModalActions, { borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={cancelTmpDate}>
              <Text style={[styles.cancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.publishBtn, { backgroundColor: theme.colors.primary }]} onPress={confirmTmpDate}>
              <Text style={[styles.publishText, { color: '#fff' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>

        {/* Month Picker Modal */}
        <MonthPickerModal
          visible={showMonthPicker}
          currentMonth={new Date(tmpYear, tmpMonth, 1)}
          onClose={closeMonthPicker}
          onSelectMonth={selectMonth}
          scaleAnim={monthPickerScaleAnim}
          opacityAnim={monthPickerOpacityAnim}
          minYear={new Date().getFullYear() - 2}
          maxYear={new Date().getFullYear() + 3}
        />


        {/* Cancel Alert Modal */}
        <BottomSheet
          visible={isCancelAlertOpen}
          onClose={() => {
            Animated.timing(cancelAlertSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
              InteractionManager.runAfterInteractions(() => {
                setIsCancelAlertOpen(false);
              });
            });
          }}
          sheetY={cancelAlertSheetY}
          backgroundColor={theme.colors.card}
          maxHeight="40%"
          autoSize={true}
          sheetPaddingBottom={8}
          contentStyle={[styles.cancelAlertContent, { paddingBottom: 0 }]}
        >
          <View style={styles.alertIconWrapWarning}>
            <Ionicons name="warning" size={20} color="#F59E0B" />
          </View>
          <Text style={[styles.alertTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(18) }]}>Discard Changes?</Text>
          <Text style={[styles.alertSubtitle, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(13) }]}>All your changes will be lost and cannot be recovered.</Text>
          <View style={styles.alertActionsRow}>
            <TouchableOpacity style={[styles.alertCancelBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={() => {
              Animated.timing(cancelAlertSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
                InteractionManager.runAfterInteractions(() => {
                  setIsCancelAlertOpen(false);
                });
              });
            }}>
              <Text style={[styles.alertCancelText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}>Keep Editing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.alertDangerBtn} onPress={confirmCancel}>
              <Text style={[styles.alertDangerText, { fontSize: theme.fontSize.scaleSize(14) }]}>Discard</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>

        {/* Publish Alert Modal */}
        <BottomSheet
          visible={isPublishAlertOpen}
          onClose={() => {
            Animated.timing(publishAlertSheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
              InteractionManager.runAfterInteractions(() => {
                setIsPublishAlertOpen(false);
              });
            });
          }}
          sheetY={publishAlertSheetY}
          backgroundColor={theme.colors.card}
          maxHeight="60%"
          autoSize={true}
          sheetPaddingBottom={8}
          contentStyle={{ paddingBottom: 0 }}
        >
          <View style={styles.publishAlertContent}>
            <View style={styles.alertIconWrapSuccess}>
              <Ionicons name="checkmark-circle" size={32} color="#059669" />
            </View>
            <Text style={[styles.alertTitle, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(20) }]}>Ready to Publish?</Text>
            <Text style={[styles.alertSubtitle, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(14) }]}>Your update will be published and visible to all users.</Text>
            <View style={[styles.alertPreviewInfo, { backgroundColor: theme.colors.surfaceAlt }]}>
              <View style={styles.alertPreviewRow}>
                <Ionicons name="text" size={14} color={theme.colors.textMuted} />
                <Text style={[styles.alertPreviewText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) }]}>Title: {title || 'Untitled'}</Text>
              </View>
              <View style={styles.alertPreviewRow}>
                <Ionicons name="folder" size={14} color={theme.colors.textMuted} />
                <Text style={[styles.alertPreviewText, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) }]}>Category: {category}</Text>
              </View>
            </View>
            <View style={styles.alertActionsRowSingle}>
              <TouchableOpacity style={styles.alertSuccessBtn} onPress={confirmPublish}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={[styles.alertSuccessText, { fontSize: theme.fontSize.scaleSize(14) }]}>Publish Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheet>

        {/* Preview Modal */}
        <PreviewModal
          visible={isPreviewModalOpen}
          update={{
            title: title || 'Your post title will appear here',
            date: date || new Date().toLocaleDateString(),
            tag: category,
            description: description,
            images: previewImages,
          }}
          onClose={() => setIsPreviewModalOpen(false)}
          customAction={{
            label: 'Publish',
            icon: 'checkmark',
            onPress: () => {
              setIsPreviewModalOpen(false);
              handlePublish();
            }
          }}
        />

        {/* Description Field */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.cardContainer, {
            backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          }]}
        >
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) }]}>Description <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }}>(Optional)</Text></Text>
            <View style={styles.textAreaWrapper}>
              <TextInput
                style={[styles.textInput, styles.textArea, styles.textInputElevated, { backgroundColor: 'transparent', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)', color: theme.colors.text, fontSize: theme.fontSize.scaleSize(14) }]}
                placeholder="Enter announcement details"
                value={description}
                onChangeText={setDescription}
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={[styles.charCounter, { bottom: 8, color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>{description.length}/500</Text>
            </View>
          </View>
        </BlurView>

        {/* Attachment Section */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.cardContainer, {
            backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          }]}
        >
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(13) }]}>Attachments</Text>
            <TouchableOpacity style={[styles.dashedUpload, { borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)', backgroundColor: 'transparent' }]} onPress={handleAddAttachment}>
              <Ionicons name="attach" size={18} color={theme.colors.textMuted} />
              <Text style={[styles.dashedUploadText, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(14) }]}>Add Attachment</Text>
            </TouchableOpacity>

            {pickedFile && (
              <View style={[styles.fileCard, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.3)' : 'rgba(249, 250, 251, 0.5)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
                <View style={styles.fileLeft}>
                  <View style={styles.fileIconWrap}>
                    <Ionicons name="image" size={14} color="#1976D2" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fileName, { color: theme.colors.text, fontSize: theme.fontSize.scaleSize(12) }]} numberOfLines={1}>{pickedFile.name}</Text>
                    {!!pickedFile.size && (
                      <Text style={[styles.fileSize, { color: theme.colors.textMuted, fontSize: theme.fontSize.scaleSize(11) }]}>{(pickedFile.size / 1024).toFixed(0)} KB</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => setPickedFile(null)} 
                  style={[styles.removeBtn, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.6)' : 'rgba(255, 255, 255, 0.6)' }]}
                >
                  <Ionicons name="close" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </BlurView>

        </View>
      </ScrollView>

      {/* Footer with Action Buttons - Translucent with blur */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 60}
        tint={isDarkMode ? 'dark' : 'light'}
        style={[styles.footerBlurContainer, {
          paddingLeft: 16 + safeInsets.left,
          paddingRight: 16 + safeInsets.right,
          paddingBottom: 12 + safeInsets.bottom,
        }]}
      >
        <View style={[styles.footerContainer, {
          backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        }]}>
          {/* Show Preview Button */}
          <TouchableOpacity 
            style={[styles.previewBtn, { 
              backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
              borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'
            }]} 
            onPress={handleShowPreview} 
            activeOpacity={0.7}
            accessibilityRole="button" 
            accessibilityLabel="Show preview" 
            accessibilityHint="Opens a preview of your update"
          >
            <Ionicons name="eye" size={18} color="#6366F1" style={styles.previewIcon} />
            <Text style={[styles.previewText, { color: '#6366F1', fontSize: theme.fontSize.scaleSize(14) }]}>Show Preview</Text>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionBtn, {
                backgroundColor: '#DC2626',
                borderWidth: 0,
              }]} 
              onPress={handleCancel} 
              activeOpacity={0.7}
              accessibilityRole="button" 
              accessibilityLabel="Cancel" 
              accessibilityHint="Discard your changes and go back"
            >
              <Ionicons name="close-circle" size={18} color="#fff" style={styles.actionIcon} />
              <Text style={[styles.buttonText, { color: '#fff', fontSize: theme.fontSize.scaleSize(14) }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, {
                backgroundColor: (isFormValid && !isPublishing) ? '#2563EB' : (isDarkMode ? '#374151' : '#E5E7EB'),
                borderWidth: 0,
              }]} 
              onPress={handlePublish} 
              activeOpacity={(isFormValid && !isPublishing) ? 0.7 : 1}
              disabled={!isFormValid || isPublishing}
              accessibilityRole="button" 
              accessibilityLabel={isPublishing ? "Publishing..." : "Publish"} 
              accessibilityHint={(isFormValid && !isPublishing) ? "Publishes your update" : "Fill in title and description to enable publishing"}
            >
              <Ionicons 
                name={isPublishing ? "hourglass" : "checkmark-circle"} 
                size={18} 
                color={(isFormValid && !isPublishing) ? "#fff" : (isDarkMode ? '#6B7280' : '#9CA3AF')} 
                style={styles.actionIcon} 
              />
              <Text style={[styles.buttonText, {
                color: (isFormValid && !isPublishing) ? "#fff" : (isDarkMode ? '#6B7280' : '#9CA3AF'),
                fontSize: theme.fontSize.scaleSize(14)
              }]}>{isPublishing ? 'Publishing...' : 'Publish'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
};

// Helper functions for tag colors (matching AdminDashboard)
const getTagColor = (tag: string) => {
  switch ((tag || '').toLowerCase()) {
    case 'announcement':
      return '#E8F0FF';
    case 'academic':
      return '#F0F9FF';
    case 'event':
      return '#FEF3C7';
    case 'service':
      return '#ECFDF5';
    case 'infrastructure':
      return '#FEF2F2';
    default:
      return '#E8F0FF';
  }
};

const getTagTextColor = (tag: string) => {
  switch ((tag || '').toLowerCase()) {
    case 'announcement':
      return '#1A3E7A';
    case 'academic':
      return '#0369A1';
    case 'event':
      return '#D97706';
    case 'service':
      return '#059669';
    case 'infrastructure':
      return '#DC2626';
    default:
      return '#1A3E7A';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  floatingBgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  gradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOverlay2: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeAreaTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  scrollView: {
    flex: 1,
  },
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    zIndex: 1000,
  },
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerLeft: {
    width: 44,
    zIndex: 1000,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    pointerEvents: 'none',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  headerSpacer: {
    width: 40,
    height: 33,
    marginLeft: 4,
  },
  categoryBadgeHeader: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    maxWidth: 150,
  },
  categoryBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  categoryChipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 120,
  },
  categoryChipIconWrapSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipTextSmall: {
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 86,
  },
  softDivider: {
    height: 10,
    backgroundColor: '#fafafa',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f6f6f6',
  },
  content: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  contentInner: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    gap: 16,
  },
  cardContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 0,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  inputContainer: {
    marginBottom: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
  },
  textArea: {
    height: 64,
    paddingTop: 8,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
    gap: 8,
  },
  halfInputContainer: {
    width: '48%',
  },
  thirdInputContainer: {
    flex: 1,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  timeSeparator: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  timeInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  timeText: {
    fontSize: 14,
    flex: 1,
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  dropdownText: {
    fontSize: 14,
    flex: 1,
    flexShrink: 1,
  },
  categoryField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    minHeight: 44,
    height: 44,
  },
  categoryFieldIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 10,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  dateText: {
    fontSize: 14,
  },
  attachmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addAttachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 10,
  },
  addAttachmentText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 6,
  },
  fileMetaContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  filePlaceholder: {
    fontSize: 12,
    color: '#888',
  },
  fileName: {
    fontSize: 12,
  },
  fileSize: {
    fontSize: 11,
  },
  uploadBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  optionsContainerCard: {
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  optionsContainerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  optionRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTextCompact: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  footerBlurContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  footerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  previewBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    flexDirection: 'row',
    gap: 8,
  },
  previewIcon: {
    marginRight: 0,
  },
  previewText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  actionIcon: {
    marginRight: 0,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  publishBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  publishText: {
    fontSize: 14,
    fontWeight: '600',
  },
  smallSwitch: {
    transform: [{ scaleX: 0.65 }, { scaleY: 0.65 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  categoryMenu: {
    width: 240,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 6,
  },
  categoryItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoryItemText: {
    fontSize: 14,
    color: '#333',
  },
  categoryItemTextActive: {
    fontWeight: '700',
    color: '#111',
  },
  dateModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  dateModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  datePickersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  datePickerCol: {
    flex: 1,
  },
  datePickerLabel: {
    fontSize: 11,
    marginBottom: 6,
    textAlign: 'center',
  },
  datePickerList: {
    maxHeight: 160,
    borderWidth: 1,
    borderRadius: 8,
  },
  datePickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  datePickerItemActive: {
    backgroundColor: '#E8F0FF',
  },
  datePickerText: {
    fontSize: 13,
    textAlign: 'center',
  },
  datePickerTextActive: {
    fontWeight: '700',
    color: '#1A3E7A',
  },
  dateModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  // Calendar Grid Styles
  calendarScrollView: {
    flex: 1,
  },
  calendarScrollContent: {
    paddingBottom: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginBottom: 0,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  calendarMonthYear: {
    fontSize: 16,
    fontWeight: '700',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 0,
  },
  calendarWeekday: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
  },
  calendarWeekdayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  calendarDayCell: {
    width: '14.285%', // 100% / 7 days
    aspectRatio: 1,
  },
  calendarDayContent: {
    flex: 1,
    padding: 2,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarDayNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#444',
  },
  categoryMenuCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  categoryMenuTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  categoryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryTextWrap: {
    flex: 1,
  },
  categoryRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  categoryRowSub: {
    fontSize: 11,
  },
  inputWrapper: {
    position: 'relative',
  },
  textInputElevated: {
    borderRadius: 12,
    borderWidth: 1,
  },
  charCounter: {
    position: 'absolute',
    right: 10,
    top: 8,
    fontSize: 11,
  },
  textAreaWrapper: {
    position: 'relative',
  },
  dashedUpload: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    paddingVertical: 12,
    borderRadius: 12,
  },
  dashedUploadText: {
    fontWeight: '600',
  },
  fileCard: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  fileIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  removeBtn: {
    padding: 6,
    borderRadius: 12,
  },
  cancelOutlined: {
    borderWidth: 1,
    marginRight: 8,
  },
  cancelOutlinedText: {
    fontWeight: '600',
  },
  publishFilled: {
    marginLeft: 8,
  },
  publishFilledDisabled: {
    marginLeft: 8,
  },
  publishFilledText: {
    fontWeight: '700',
  },
  publishFilledTextDisabled: {
    fontWeight: '600',
  },
  footerBoundary: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  checkboxSelected: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxUnselected: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  // Alert Modal Styles
  cancelAlertContent: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 0,
  },
  alertCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  alertIconWrapWarning: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    alignSelf: 'center',
  },
  alertIconWrapSuccess: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  alertSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  alertPreviewInfo: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  alertPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  alertPreviewText: {
    fontSize: 13,
    flex: 1,
  },
  publishAlertContent: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 0,
  },
  alertActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
    marginTop: 2,
  },
  alertActionsRowSingle: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  alertCancelBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  alertDangerBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertDangerText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  alertSuccessBtn: {
    width: '100%',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
  },
  alertSuccessText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  // Preview Modal Styles
  previewCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  previewCloseBtn: {
    padding: 6,
    borderRadius: 10,
  },
  previewContent: {
    marginBottom: 16,
  },
  previewPostCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 16,
  },
  previewPostHeader: {
    marginBottom: 12,
  },
  previewPostTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    lineHeight: 22,
  },
  previewTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewPinnedTag: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#1565C0',
  },
  previewPinnedText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  previewUrgentTag: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#B71C1C',
  },
  previewUrgentText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  previewCategoryTag: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#1B5E20',
  },
  previewCategoryText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  previewPostContent: {
    marginBottom: 12,
  },
  previewPostDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  previewChipsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  previewSectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 12,
  },
  previewKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  previewKpi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  previewKpiText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewPostMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewPostDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  previewStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewStatusText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  previewBackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
  },
  previewBackText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewPublishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
  },
  previewPublishText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  // Added to mirror AdminDashboard preview styles
  previewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewMetaInline: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  previewCarouselWrap: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  previewImagePressable: {
    width: '100%',
    height: '100%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewImageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  carouselDots: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    opacity: 0.6,
  },
  carouselDotActive: {
    backgroundColor: '#ffffff',
    opacity: 1,
  },
  previewImagePlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewImagePlaceholderText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  pinnedRibbon: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedRibbonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  previewBody: {
    marginBottom: 16,
  },
  previewUpdateTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  previewMetaRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  previewMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewMetaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
});

export default PostUpdate;
