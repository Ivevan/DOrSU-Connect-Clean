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
  Modal,
  ScrollView,
  Vibration,
  Image,
  FlatList,
  Animated,
  InteractionManager,
  Easing,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import AdminDataService from '../../services/AdminDataService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import PreviewModal from '../../modals/PreviewModal';

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
  const { isDarkMode, theme } = useTheme();
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Announcement');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [pinToTop, setPinToTop] = useState(false);
  const [markAsUrgent, setMarkAsUrgent] = useState(false);
  // removed: scheduleForLater

  const [pickedFile, setPickedFile] = useState<{
    name: string;
    size?: number;
    mimeType?: string | null;
    uri: string;
    fileCopyUri?: string | null;
    cachedUri?: string | null;
  } | null>(null);

  // Category and Date picker state
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  
  // Custom Alert Modals
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [isPublishAlertOpen, setIsPublishAlertOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animation values for smooth entrance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Optimized entrance animation - delay until interactions complete
    const handle = InteractionManager.runAfterInteractions(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => handle.cancel();
  }, []);

  // Inline, dependency-free date data
  const months = useMemo(() => [
    'January','February','March','April','May','June','July','August','September','October','November','December'
  ], []);

  // Category meta for richer UI
  const CATEGORY_OPTIONS = useMemo(() => ([
    { key: 'Announcement', icon: 'megaphone', color: '#1976D2', description: 'General updates and notices' },
    { key: 'Academic', icon: 'school', color: '#2E7D32', description: 'Classes, exams, academics' },
    { key: 'Event', icon: 'calendar-outline', color: '#D32F2F', description: 'Schedules and activities' },
    { key: 'News', icon: 'newspaper-outline', color: '#5E35B1', description: 'Campus news' },
    { key: 'Update', icon: 'refresh', color: '#00897B', description: 'System or app updates' },
    { key: 'Alert', icon: 'alert-circle', color: '#E65100', description: 'Urgent alerts' },
    { key: 'General', icon: 'information-circle', color: '#455A64', description: 'Miscellaneous' },
  ]), []);
  const currentCategory = CATEGORY_OPTIONS.find(o => o.key === category) || CATEGORY_OPTIONS[0];

  const current = selectedDateObj ?? new Date();
  const [tmpMonth, setTmpMonth] = useState<number>(current.getMonth());
  const [tmpYear, setTmpYear] = useState<number>(current.getFullYear());
  const [tmpDay, setTmpDay] = useState<number>(current.getDate());

  const getDaysInMonth = (year: number, monthIdx: number) => {
    return new Date(year, monthIdx + 1, 0).getDate();
  };

  const daysInTmpMonth = getDaysInMonth(tmpYear, tmpMonth);
  const dayOptions = Array.from({ length: daysInTmpMonth }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i); // [y-2..y+3]

  const formatDate = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const openCategoryMenu = useCallback(() => setIsCategoryOpen(true), []);
  const closeCategoryMenu = useCallback(() => setIsCategoryOpen(false), []);
  const selectCategory = useCallback((value: string) => {
    setCategory(value);
    setIsCategoryOpen(false);
  }, []);

  const onPressDate = useCallback(() => {
    const base = selectedDateObj ?? new Date();
    setTmpMonth(base.getMonth());
    setTmpYear(base.getFullYear());
    setTmpDay(base.getDate());
    setShowDatePicker(true);
  }, [selectedDateObj]);

  const confirmTmpDate = useCallback(() => {
    const safeDay = Math.min(tmpDay, getDaysInMonth(tmpYear, tmpMonth));
    const next = new Date(tmpYear, tmpMonth, safeDay);
    setSelectedDateObj(next);
    setDate(formatDate(next));
    setShowDatePicker(false);
  }, [tmpDay, tmpYear, tmpMonth]);

  const cancelTmpDate = useCallback(() => setShowDatePicker(false), []);

  const handlePublish = useCallback(() => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    if (!title.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    setIsAnimating(true);
    setIsPublishAlertOpen(true);
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating, title, description]);

  // Check if form is valid for publishing - memoized
  const isFormValid = useMemo(() => title.trim() !== '' && description.trim() !== '', [title, description]);

  const handleCancel = useCallback(() => {
    // Prevent rapid tapping during animation
    if (isAnimating) {
      return;
    }
    
    setIsAnimating(true);
    setIsCancelAlertOpen(true);
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating]);

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
      if (!editingPostId) return;
      const post = await AdminDataService.getPostById(editingPostId);
      if (isCancelled || !post) return;
      setTitle(post.title || '');
      setCategory(post.category || 'Announcement');
      setDate(post.date || '');
      setDescription(post.description || '');
      setPinToTop(!!post.isPinned);
      setMarkAsUrgent(!!post.isUrgent);
    };
    load();
    return () => { isCancelled = true; };
  }, [editingPostId]);

  const confirmPublish = useCallback(() => {
    setIsPublishAlertOpen(false);
    // Simulate publishing then go to ManagePosts
    setTimeout(() => {
      const now = new Date();
      const displayDate = now.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
      const images: string[] = [];
      if (pickedFile?.uri) {
        images.push(pickedFile.uri);
      }
      const payload = {
        title: title || 'Untitled',
        category,
        date: date || displayDate,
        description,
        images: images.length > 0 ? images : undefined,
        isPinned: pinToTop,
        isUrgent: markAsUrgent,
      };
      const op = editingPostId
        ? AdminDataService.updatePost(editingPostId, payload)
        : AdminDataService.createPost(payload);
      Promise.resolve(op).finally(() => {
        navigation.navigate('AdminDashboard');
      });
    }, 500);
  }, [title, category, date, description, pickedFile, pinToTop, markAsUrgent, editingPostId, navigation]);

  const confirmCancel = useCallback(() => {
    setIsCancelAlertOpen(false);
    if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
      navigation.goBack();
    } else {
      (navigation as any).navigate('AdminDashboard');
    }
  }, [navigation]);

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
    <View style={[styles.container, {
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
      paddingBottom: insets.bottom, // Keep bottom padding since this screen doesn't use AdminBottomNavBar
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor="transparent" 
        translucent 
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Go back" accessibilityHint="Returns to the previous screen">
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Post Update</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textMuted }]}>Create and edit updates</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.categoryChipSmall, { borderColor: currentCategory.color + '33', backgroundColor: currentCategory.color + '14' }]}>
            <View style={[styles.categoryChipIconWrapSmall, { backgroundColor: currentCategory.color + '22' }]}>
              <Ionicons name={currentCategory.icon as any} size={14} color={currentCategory.color} />
            </View>
            <Text style={[styles.categoryChipTextSmall, { color: theme.colors.text }]} numberOfLines={1}>{currentCategory.key}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <Animated.View 
          style={[
            styles.contentInner,
            {
              opacity: fadeAnim,
            transform: [
              { translateY: slideAnim }
            ]
            }
          ]}
        >
        
        {/* Title Field */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Title <Text style={{ color: '#E53935' }}>*</Text></Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.textInput, styles.textInputElevated, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="Enter announcement title"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={theme.colors.textMuted}
              maxLength={100}
            />
            <Text style={[styles.charCounter, { color: theme.colors.textMuted }]}>{title.length}/100</Text>
          </View>
        </View>

        {/* Category and Date Row */}
        <View style={styles.rowContainer}>
          {/* Category Dropdown */}
          <View style={styles.halfInputContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Category</Text>
            <TouchableOpacity style={[styles.dropdownContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={openCategoryMenu}>
              <Text style={[styles.dropdownText, { color: theme.colors.text }]} numberOfLines={1}>{category}</Text>
              <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Date Field */}
          <View style={styles.halfInputContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Date</Text>
            <TouchableOpacity style={[styles.dateContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={onPressDate}>
              <Text style={[styles.dateText, { color: theme.colors.text }]}>{date || 'dd/mm/yyyy'}</Text>
              <Ionicons name="calendar" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Menu (enhanced) */}
        <Modal visible={isCategoryOpen} transparent animationType="fade" onRequestClose={closeCategoryMenu}>
          <View style={styles.modalOverlay}>
            <View style={[styles.categoryMenuCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.categoryMenuTitle, { color: theme.colors.text }]}>Select Category</Text>
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
                        <Text style={[styles.categoryRowTitle, { color: theme.colors.text }, active && { color: theme.colors.text }]}>{opt.key}</Text>
                        <Text style={[styles.categoryRowSub, { color: theme.colors.textMuted }]}>{opt.description}</Text>
                      </View>
                      {active && (
                        <Ionicons name="checkmark-circle" size={20} color={opt.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Native Date Picker replaced by custom modal */}
        {showDatePicker && (
          <Modal transparent animationType="fade" onRequestClose={cancelTmpDate}>
            <View style={styles.modalOverlay}>
              <View style={[styles.dateModal, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.dateModalTitle, { color: theme.colors.text }]}>Select Date</Text>
                <View style={styles.datePickersRow}>
                  {/* Month */}
                  <View style={styles.datePickerCol}>
                    <Text style={[styles.datePickerLabel, { color: theme.colors.textMuted }]}>Month</Text>
                    <ScrollView style={[styles.datePickerList, { borderColor: theme.colors.border }]}>
                      {months.map((m, idx) => (
                        <TouchableOpacity key={m} style={[styles.datePickerItem, { backgroundColor: theme.colors.surface }, tmpMonth === idx && styles.datePickerItemActive]} onPress={() => setTmpMonth(idx)}>
                          <Text style={[styles.datePickerText, { color: theme.colors.text }, tmpMonth === idx && styles.datePickerTextActive]} numberOfLines={1}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  {/* Day */}
                  <View style={styles.datePickerCol}>
                    <Text style={[styles.datePickerLabel, { color: theme.colors.textMuted }]}>Day</Text>
                    <ScrollView style={[styles.datePickerList, { borderColor: theme.colors.border }]}>
                      {dayOptions.map((d) => (
                        <TouchableOpacity key={d} style={[styles.datePickerItem, { backgroundColor: theme.colors.surface }, tmpDay === d && styles.datePickerItemActive]} onPress={() => setTmpDay(d)}>
                          <Text style={[styles.datePickerText, { color: theme.colors.text }, tmpDay === d && styles.datePickerTextActive]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  {/* Year */}
                  <View style={styles.datePickerCol}>
                    <Text style={[styles.datePickerLabel, { color: theme.colors.textMuted }]}>Year</Text>
                    <ScrollView style={[styles.datePickerList, { borderColor: theme.colors.border }]}>
                      {yearOptions.map((y) => (
                        <TouchableOpacity key={y} style={[styles.datePickerItem, { backgroundColor: theme.colors.surface }, tmpYear === y && styles.datePickerItemActive]} onPress={() => setTmpYear(y)}>
                          <Text style={[styles.datePickerText, { color: theme.colors.text }, tmpYear === y && styles.datePickerTextActive]}>{y}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
                <View style={styles.dateModalActions}>
                  <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={cancelTmpDate}>
                    <Text style={[styles.cancelText, { color: theme.colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.publishBtn, { backgroundColor: theme.colors.primary }]} onPress={confirmTmpDate}>
                    <Text style={[styles.publishText, { color: '#fff' }]}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Cancel Alert Modal */}
        <Modal visible={isCancelAlertOpen} transparent animationType="fade" onRequestClose={() => setIsCancelAlertOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} activeOpacity={1} onPress={() => setIsCancelAlertOpen(false)} />
            <View style={[styles.alertCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.alertIconWrapWarning}>
                <Ionicons name="warning" size={24} color="#F59E0B" />
              </View>
              <Text style={[styles.alertTitle, { color: theme.colors.text }]}>Discard Changes?</Text>
              <Text style={[styles.alertSubtitle, { color: theme.colors.textMuted }]}>All your changes will be lost and cannot be recovered.</Text>
              <View style={styles.alertActionsRow}>
                <TouchableOpacity style={[styles.alertCancelBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={() => setIsCancelAlertOpen(false)}>
                  <Text style={[styles.alertCancelText, { color: theme.colors.text }]}>Keep Editing</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.alertDangerBtn} onPress={confirmCancel}>
                  <Text style={styles.alertDangerText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Publish Alert Modal */}
        <Modal visible={isPublishAlertOpen} transparent animationType="fade" onRequestClose={() => setIsPublishAlertOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} activeOpacity={1} onPress={() => setIsPublishAlertOpen(false)} />
            <View style={[styles.alertCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.alertIconWrapSuccess}>
                <Ionicons name="checkmark-circle" size={24} color="#059669" />
              </View>
              <Text style={[styles.alertTitle, { color: theme.colors.text }]}>Ready to Publish?</Text>
              <Text style={[styles.alertSubtitle, { color: theme.colors.textMuted }]}>Your update will be published and visible to all users.</Text>
              <View style={[styles.alertPreviewInfo, { backgroundColor: theme.colors.surfaceAlt }]}>
                <View style={styles.alertPreviewRow}>
                  <Ionicons name="text" size={14} color={theme.colors.textMuted} />
                  <Text style={[styles.alertPreviewText, { color: theme.colors.text }]}>Title: {title || 'Untitled'}</Text>
                </View>
                <View style={styles.alertPreviewRow}>
                  <Ionicons name="folder" size={14} color={theme.colors.textMuted} />
                  <Text style={[styles.alertPreviewText, { color: theme.colors.text }]}>Category: {category}</Text>
                </View>
                {pinToTop && (
                  <View style={styles.alertPreviewRow}>
                    <Ionicons name="pin" size={14} color={theme.colors.textMuted} />
                    <Text style={[styles.alertPreviewText, { color: theme.colors.text }]}>Will be pinned to top</Text>
                  </View>
                )}
                {markAsUrgent && (
                  <View style={styles.alertPreviewRow}>
                    <Ionicons name="alert-circle" size={14} color={theme.colors.textMuted} />
                    <Text style={[styles.alertPreviewText, { color: theme.colors.text }]}>Marked as urgent</Text>
                  </View>
                )}
              </View>
              <View style={styles.alertActionsRow}>
                <TouchableOpacity style={[styles.alertCancelBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={() => setIsPublishAlertOpen(false)}>
                  <Text style={[styles.alertCancelText, { color: theme.colors.text }]}>Review</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.alertSuccessBtn} onPress={confirmPublish}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.alertSuccessText}>Publish Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Preview Modal */}
        <PreviewModal
          visible={isPreviewModalOpen}
          update={{
            title: title || 'Your post title will appear here',
            date: date || new Date().toLocaleDateString(),
            tag: category,
            description: description,
            pinned: pinToTop
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
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Description</Text>
          <View style={styles.textAreaWrapper}>
            <TextInput
              style={[styles.textInput, styles.textArea, styles.textInputElevated, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="Enter announcement details"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={[styles.charCounter, { bottom: 8, color: theme.colors.textMuted }]}>{description.length}/500</Text>
          </View>
        </View>

        {/* Attachment Section */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Attachments</Text>
          <TouchableOpacity style={[styles.dashedUpload, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]} onPress={handleAddAttachment}>
            <Ionicons name="attach" size={18} color={theme.colors.textMuted} />
            <Text style={[styles.dashedUploadText, { color: theme.colors.textMuted }]}>Add Attachment</Text>
          </TouchableOpacity>

          {pickedFile && (
            <View style={[styles.fileCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
              <View style={styles.fileLeft}>
                <View style={styles.fileIconWrap}>
                  <Ionicons name="attach" size={14} color="#1976D2" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fileName, { color: theme.colors.text }]} numberOfLines={1}>{pickedFile.name}</Text>
                  {!!pickedFile.size && (
                    <Text style={[styles.fileSize, { color: theme.colors.textMuted }]}>{(pickedFile.size / 1024).toFixed(0)} KB</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => setPickedFile(null)} style={[styles.removeBtn, { backgroundColor: theme.colors.surface }]}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Update Options */}
        <View style={[styles.optionsContainerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.optionsContainerHeaderRow}>
            <Text style={[styles.optionsTitle, { color: theme.colors.text }]}>Update Options</Text>
          </View>

          {/* Pin to Top */}
          <TouchableOpacity style={styles.optionRowCompact} activeOpacity={0.7} onPress={() => {
            Vibration.vibrate(50);
            setPinToTop(!pinToTop);
          }}>
            <View style={styles.optionLeft}>
              <Ionicons name={pinToTop ? 'pin' : 'pin-outline'} size={20} color={pinToTop ? '#1976D2' : theme.colors.textMuted} />
              <Text style={[styles.optionTextCompact, { color: theme.colors.text }]}>Pin to Top</Text>
            </View>
            <Switch
              value={pinToTop}
              onValueChange={(value) => {
                Vibration.vibrate(50);
                setPinToTop(value);
              }}
              trackColor={{ false: theme.colors.border, true: '#1976D266' }}
              thumbColor={pinToTop ? '#1976D2' : theme.colors.surface}
              style={styles.smallSwitch}
            />
          </TouchableOpacity>

          {/* Mark as urgent */}
          <TouchableOpacity style={styles.optionRowCompact} activeOpacity={0.7} onPress={() => {
            Vibration.vibrate(50);
            setMarkAsUrgent(!markAsUrgent);
          }}>
            <View style={styles.optionLeft}>
              <Ionicons name={markAsUrgent ? 'alert-circle' : 'alert-circle-outline'} size={20} color={markAsUrgent ? '#D32F2F' : theme.colors.textMuted} />
              <Text style={[styles.optionTextCompact, { color: theme.colors.text }]}>Mark as urgent</Text>
            </View>
            <Switch
              value={markAsUrgent}
              onValueChange={(value) => {
                Vibration.vibrate(50);
                setMarkAsUrgent(value);
              }}
              trackColor={{ false: theme.colors.border, true: '#D32F2F66' }}
              thumbColor={markAsUrgent ? '#D32F2F' : theme.colors.surface}
              style={styles.smallSwitch}
            />
          </TouchableOpacity>

          {/* Schedule for later removed */}
        </View>

        </Animated.View>
      </ScrollView>

      {/* Footer with Action Buttons */}
      <View style={[styles.footer, { 
        backgroundColor: theme.colors.background,
        borderTopColor: theme.colors.border,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 16 + insets.bottom 
      }]}>
        {/* Background layer to prevent transparency below footer */}
        <View style={[styles.footerBackground, { backgroundColor: theme.colors.background, height: insets.bottom }]} />
        {/* Show Preview Button */}
        <TouchableOpacity 
          style={[styles.previewBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]} 
          onPress={handleShowPreview} 
          activeOpacity={0.7}
          accessibilityRole="button" 
          accessibilityLabel="Show preview" 
          accessibilityHint="Opens a preview of your update"
        >
          <Ionicons name="eye" size={18} color="#6366F1" style={styles.previewIcon} />
          <Text style={styles.previewText}>Show Preview</Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[
              styles.actionBtn,
              styles.cancelOutlined,
              { borderColor: '#DC2626', backgroundColor: '#DC2626' }
            ]} 
            onPress={handleCancel} 
            activeOpacity={0.7}
            accessibilityRole="button" 
            accessibilityLabel="Cancel" 
            accessibilityHint="Discard your changes and go back"
          >
            <Ionicons name="close-circle" size={18} color="#fff" style={styles.actionIcon} />
            <Text style={[styles.cancelOutlinedText, { color: '#fff' }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.actionBtn, 
              styles.publishFilled,
              { backgroundColor: isFormValid ? '#059669' : theme.colors.border },
              !isFormValid && styles.publishFilledDisabled
            ]} 
            onPress={handlePublish} 
            activeOpacity={isFormValid ? 0.7 : 1}
            disabled={!isFormValid}
            accessibilityRole="button" 
            accessibilityLabel="Publish" 
            accessibilityHint={isFormValid ? "Publishes your update" : "Fill in title and description to enable publishing"}
          >
            <Ionicons 
              name="checkmark-circle" 
              size={18} 
              color={isFormValid ? "#fff" : theme.colors.textMuted} 
              style={styles.actionIcon} 
            />
            <Text style={[
              styles.publishFilledText,
              { color: isFormValid ? "#fff" : theme.colors.textMuted },
              !isFormValid && styles.publishFilledTextDisabled
            ]}>Publish</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
    paddingBottom: 12,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  closeButton: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },
  headerRight: {
    width: 120,
    alignItems: 'flex-end',
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
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  inputContainer: {
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
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
    marginBottom: 10,
  },
  halfInputContainer: {
    width: '48%',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 3,
  },
  footerBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },
  previewBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    flexDirection: 'row',
    gap: 8,
  },
  previewIcon: {
    marginRight: 4,
  },
  previewText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
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
    marginTop: 12,
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
    borderRadius: 10,
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
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  actionIcon: {
    marginRight: 4,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  alertIconWrapSuccess: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  alertPreviewInfo: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  alertActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  alertCancelBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 12,
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
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertDangerText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  alertSuccessBtn: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
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
