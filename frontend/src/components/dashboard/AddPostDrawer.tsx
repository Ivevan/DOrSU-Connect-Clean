import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import MonthPickerModal from '../../modals/MonthPickerModal';
import AdminDataService from '../../services/AdminDataService';
import { formatDate } from '../../utils/dateUtils';

interface AddEventAnnouncementDrawerProps {
  visible: boolean;
  onClose: () => void;
  type: 'event' | 'announcement' | null;
  onSuccess?: () => void;
  slideAnim: Animated.Value;
  backdropOpacity: Animated.Value;
  monthPickerScaleAnim: Animated.Value;
  monthPickerOpacityAnim: Animated.Value;
}

const AddEventAnnouncementDrawer: React.FC<AddEventAnnouncementDrawerProps> = ({
  visible,
  onClose,
  type,
  onSuccess,
  slideAnim,
  backdropOpacity,
  monthPickerScaleAnim,
  monthPickerOpacityAnim,
}) => {
  const { theme: t, isDarkMode } = useThemeValues();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [dateString, setDateString] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedType, setSelectedType] = useState<'event' | 'announcement'>('event');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickedFile, setPickedFile] = useState<{
    name: string;
    size: number;
    mimeType: string | null;
    uri: string;
    fileCopyUri: string | null;
    cachedUri: string | null;
  } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Initialize date when drawer opens
  useEffect(() => {
    if (visible) {
      const date = new Date();
      setSelectedDate(date);
      setDateString(formatDate(date));
      setName('');
      setDescription('');
      setPickedFile(null);
      // Set type from prop if provided, otherwise default to 'event'
      setSelectedType(type || 'event');
      setShowTypeDropdown(false);
      setShowDatePicker(false);
    }
  }, [visible, type]);

  // Update date string when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setDateString(formatDate(selectedDate));
    }
  }, [selectedDate]);

  // Animate month picker when it opens/closes
  useEffect(() => {
    if (showDatePicker) {
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
    } else {
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
      ]).start();
    }
  }, [showDatePicker, monthPickerScaleAnim, monthPickerOpacityAnim]);

  const handleSelectMonth = (monthIndex: number, year?: number, day?: number) => {
    // monthIndex is 0-based (0-11), convert to 1-based for Date constructor
    const selectedYear = year || selectedDate?.getFullYear() || new Date().getFullYear();
    const selectedDay = day || selectedDate?.getDate() || 1;
    const newDate = new Date(selectedYear, monthIndex, selectedDay);
    setSelectedDate(newDate);
    setDateString(formatDate(newDate));
    
    // Animate out before closing
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
      setShowDatePicker(false);
      Haptics.selectionAsync();
    });
  };

  const handleAddPhoto = async () => {
    if (isAnimating) return;

    setIsAnimating(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        multiple: false,
        copyToCacheDirectory: true,
      });

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      Alert.alert('Error', 'Unable to pick a file.');
      setIsAnimating(false);
    }
  };

  const handleRemovePhoto = () => {
    setPickedFile(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a name/title.');
      return;
    }

    if (!selectedDate) {
      Alert.alert('Validation Error', 'Please select a date.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create post data
      const postData: any = {
        title: name.trim(),
        description: description.trim(),
        category: selectedType === 'event' ? 'Event' : 'Announcement',
        date: selectedDate.toISOString(),
        isoDate: selectedDate.toISOString(),
      };

      // Include image if present - pass the full pickedFile object for better handling
      if (pickedFile) {
        // Pass the full pickedFile object so AdminDataService can use mimeType and name
        postData.image = pickedFile.uri;
        postData.images = [pickedFile.uri];
        postData.imageFile = pickedFile; // Pass full file object for better handling
        console.log('📸 Image URI for upload:', pickedFile.uri);
        console.log('📸 Picked file details:', {
          uri: pickedFile.uri,
          fileCopyUri: pickedFile.fileCopyUri,
          cachedUri: pickedFile.cachedUri,
          name: pickedFile.name,
          mimeType: pickedFile.mimeType,
          size: pickedFile.size,
        });
      }

      console.log('📝 Creating post in posts collection with data:', { ...postData, image: postData.image ? 'present' : 'missing' });
      
      await AdminDataService.createPost(postData);
      
      console.log('✅ Post created successfully in posts collection');
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Reset form immediately
      setName('');
      setDescription('');
      setSelectedDate(new Date());
      setPickedFile(null);
      
      // Close drawer immediately (don't wait for alert)
      onClose();
      
      // Show non-blocking success message
      Alert.alert(
        'Success', 
        `${selectedType === 'event' ? 'Event' : 'Announcement'} created successfully!`
      );
      
      // Refresh dashboard in background (non-blocking)
      if (onSuccess) {
        // Don't await - let it run in background
        Promise.resolve(onSuccess()).catch((err: any) => {
          console.error('Error refreshing dashboard:', err);
        });
      }
    } catch (error: any) {
      console.error('Error creating post:', error);
      Alert.alert('Error', error.message || `Failed to create ${selectedType}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const tagColor = selectedType === 'event' ? '#FEF3C7' : '#E8F0FF';
  const tagTextColor = selectedType === 'event' ? '#D97706' : '#1A3E7A';
  const tagBorderColor = selectedType === 'event' ? '#FCD34D' : '#93C5FD';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[
          styles.drawerOverlay,
          {
            opacity: backdropOpacity,
          }
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
      </Animated.View>
      
      <Animated.View
        style={[
          styles.drawerContentContainer,
          {
            backgroundColor: t.colors.card,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 0],
                }),
              },
            ],
            paddingBottom: insets.bottom,
          }
        ]}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.drawerHandle}>
            <View style={[styles.drawerHandleBar, { backgroundColor: isDarkMode ? '#374151' : '#D1D5DB' }]} />
          </View>

          <View style={styles.drawerHeader}>
            <Text style={[styles.drawerTitle, { color: t.colors.text }]}>Add Event or Announcement</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.drawerCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isSubmitting}
            >
              <Ionicons name="close" size={22} color={t.colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView
            style={styles.drawerScrollView}
            contentContainerStyle={[styles.drawerScrollContent, { paddingBottom: 20 }]}
            showsVerticalScrollIndicator={true}
            bounces={true}
          >

            {/* Type Selector - Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: t.colors.text }]}>Type *</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownButton,
                  { 
                    backgroundColor: t.colors.surface, 
                    borderColor: t.colors.border,
                    borderWidth: 1,
                  },
                  selectedType === 'event' && { borderColor: '#FCD34D' },
                  selectedType === 'announcement' && { borderColor: '#93C5FD' },
                ]}
                onPress={() => {
                  setShowTypeDropdown(!showTypeDropdown);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                disabled={isSubmitting}
              >
                <View style={styles.dropdownButtonContent}>
                  <View style={[
                    styles.typeIndicator,
                    selectedType === 'event' && { backgroundColor: '#FCD34D' },
                    selectedType === 'announcement' && { backgroundColor: '#93C5FD' },
                  ]} />
                  <Text style={[
                    styles.dropdownButtonText,
                    { color: t.colors.text }
                  ]}>
                    {selectedType === 'event' ? 'Event' : 'Announcement'}
                  </Text>
                </View>
                <Ionicons 
                  name={showTypeDropdown ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color={t.colors.textMuted} 
                />
              </TouchableOpacity>
              
              {/* Dropdown Options */}
              {showTypeDropdown && (
                <View style={[
                  styles.dropdownOptions,
                  { 
                    backgroundColor: t.colors.card,
                    borderColor: t.colors.border,
                    shadowColor: isDarkMode ? '#000' : '#000',
                  }
                ]}>
                  <TouchableOpacity
                    style={[
                      styles.dropdownOption,
                      selectedType === 'event' && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedType('event');
                      setShowTypeDropdown(false);
                      Haptics.selectionAsync();
                    }}
                    disabled={isSubmitting}
                  >
                    <View style={[styles.typeIndicator, { backgroundColor: '#FCD34D' }]} />
                    <Text style={[
                      styles.dropdownOptionText,
                      { color: t.colors.text },
                      selectedType === 'event' && { fontWeight: '600' }
                    ]}>
                      Event
                    </Text>
                    {selectedType === 'event' && (
                      <Ionicons name="checkmark" size={18} color={t.colors.accent} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dropdownOption,
                      selectedType === 'announcement' && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedType('announcement');
                      setShowTypeDropdown(false);
                      Haptics.selectionAsync();
                    }}
                    disabled={isSubmitting}
                  >
                    <View style={[styles.typeIndicator, { backgroundColor: '#93C5FD' }]} />
                    <Text style={[
                      styles.dropdownOptionText,
                      { color: t.colors.text },
                      selectedType === 'announcement' && { fontWeight: '600' }
                    ]}>
                      Announcement
                    </Text>
                    {selectedType === 'announcement' && (
                      <Ionicons name="checkmark" size={18} color={t.colors.accent} />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Name/Title Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: t.colors.text }]}>Name/Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: t.colors.surface, color: t.colors.text, borderColor: t.colors.border }]}
                value={name}
                onChangeText={setName}
                placeholder="Enter name or title"
                placeholderTextColor={t.colors.textMuted}
                editable={!isSubmitting}
              />
            </View>

            {/* Date Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: t.colors.text }]}>Date *</Text>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
                onPress={() => setShowDatePicker(true)}
                disabled={isSubmitting}
              >
                <Ionicons name="calendar-outline" size={20} color={t.colors.text} />
                <Text style={[styles.dateText, { color: t.colors.text }]}>{dateString}</Text>
                <Ionicons name="chevron-down" size={20} color={t.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: t.colors.text }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: t.colors.surface, color: t.colors.text, borderColor: t.colors.border }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter description (optional)"
                placeholderTextColor={t.colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isSubmitting}
              />
            </View>

            {/* Photo Upload */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: t.colors.text }]}>Photo</Text>
              {pickedFile ? (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: pickedFile.cachedUri || pickedFile.uri }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={handleRemovePhoto}
                    disabled={isSubmitting}
                  >
                    <Ionicons name="close-circle" size={24} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.photoButton, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
                  onPress={handleAddPhoto}
                  disabled={isSubmitting || isAnimating}
                >
                  <Ionicons name="image-outline" size={24} color={t.colors.text} />
                  <Text style={[styles.photoButtonText, { color: t.colors.text }]}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: tagTextColor,
                  opacity: isSubmitting ? 0.6 : 1,
                },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
                {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Create {selectedType === 'event' ? 'Event' : 'Announcement'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>

      {/* Month Picker Modal */}
      {showDatePicker && selectedDate && (
        <MonthPickerModal
          visible={showDatePicker}
          currentMonth={selectedDate}
          onClose={() => {
            // Animate out before closing
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
              setShowDatePicker(false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            });
          }}
          onSelectMonth={handleSelectMonth}
          scaleAnim={monthPickerScaleAnim}
          opacityAnim={monthPickerOpacityAnim}
          minYear={2020}
          maxYear={2030}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawerContentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  drawerHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  drawerHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  drawerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  drawerScrollView: {
    flex: 1,
  },
  drawerScrollContent: {
    padding: 20,
    paddingTop: 16,
  },
  inputGroup: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderStyle: 'dashed',
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  submitButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  dropdownButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  typeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dropdownOptions: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(255, 149, 0, 0.05)',
  },
  dropdownOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
  },
});

export default AddEventAnnouncementDrawer;

