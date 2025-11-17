import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import DeleteEventModal from '../../modals/DeleteEventModal';
import MonthPickerModal from '../../modals/MonthPickerModal';
import AdminDataService, { Post } from '../../services/AdminDataService';
import { categoryToColors } from '../../utils/calendarUtils';
import { formatDate } from '../../utils/dateUtils';

interface PostDetailsDrawerProps {
  visible: boolean;
  onClose: () => void;
  selectedPost: Post | null;
  onRefresh?: () => Promise<void>;
  onPostUpdated?: (updatedPost: Post) => void; // Callback to update selectedPost after edit
  slideAnim: Animated.Value;
  backdropOpacity: Animated.Value;
  monthPickerScaleAnim: Animated.Value;
  monthPickerOpacityAnim: Animated.Value;
  readOnly?: boolean; // If true, hides edit/delete buttons
}

const PostDetailsDrawer: React.FC<PostDetailsDrawerProps> = ({
  visible,
  onClose,
  selectedPost,
  onRefresh,
  onPostUpdated,
  slideAnim,
  backdropOpacity,
  monthPickerScaleAnim,
  monthPickerOpacityAnim,
  readOnly = false,
}) => {
  const { theme: t } = useThemeValues();
  const insets = useSafeAreaInsets();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pickedFile, setPickedFile] = useState<{
    name: string;
    size: number;
    mimeType: string | null;
    uri: string;
    fileCopyUri: string | null;
    cachedUri: string | null;
  } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Delete modal state and animations
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteModalSlideAnim = useRef(new Animated.Value(0)).current;
  const deleteModalBackdropOpacity = useRef(new Animated.Value(0)).current;

  // Initialize edit fields when post is selected or editing starts
  useEffect(() => {
    if (selectedPost && visible) {
      if (isEditing) {
        setEditTitle(selectedPost.title || '');
        setEditDescription(selectedPost.description || '');
        setEditCategory(selectedPost.category || '');
        if (selectedPost.isoDate || selectedPost.date) {
          const eventDate = new Date(selectedPost.isoDate || selectedPost.date);
          setSelectedDateObj(eventDate);
          setEditDate(formatDate(eventDate));
        } else {
          setSelectedDateObj(null);
          setEditDate('');
        }
        setPickedFile(null);
      } else {
        // Reset to original values when not editing
        setEditTitle(selectedPost.title || '');
        setEditDescription(selectedPost.description || '');
        setEditCategory(selectedPost.category || '');
        if (selectedPost.isoDate || selectedPost.date) {
          const eventDate = new Date(selectedPost.isoDate || selectedPost.date);
          setSelectedDateObj(eventDate);
          setEditDate(formatDate(eventDate));
        }
        setPickedFile(null);
      }
    }
  }, [selectedPost, visible, isEditing]);

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

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (selectedPost) {
      setEditTitle(selectedPost.title || '');
      setEditDescription(selectedPost.description || '');
      setEditCategory(selectedPost.category || '');
      if (selectedPost.isoDate || selectedPost.date) {
        const eventDate = new Date(selectedPost.isoDate || selectedPost.date);
        setSelectedDateObj(eventDate);
        setEditDate(formatDate(eventDate));
      } else {
        setSelectedDateObj(null);
        setEditDate('');
      }
      setPickedFile(null);
    }
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

  const handleSaveEdit = async () => {
    console.log('💾 handleSaveEdit called', { postId: selectedPost?.id, hasSelectedPost: !!selectedPost });
    
    if (!selectedPost?.id) {
      console.error('❌ Save failed: Missing post ID');
      Alert.alert('Error', 'Cannot update post: missing post ID');
      return;
    }
    if (!editTitle.trim()) {
      console.warn('⚠️ Validation failed: Title is required');
      Alert.alert('Validation Error', 'Title is required');
      return;
    }
    if (!editDate && !selectedDateObj) {
      console.warn('⚠️ Validation failed: Date is required');
      Alert.alert('Validation Error', 'Date is required');
      return;
    }
    
    console.log('🔄 Setting isUpdating to true');
    setIsUpdating(true);
    
    try {
      const isoDate = selectedDateObj ? selectedDateObj.toISOString() : (selectedPost.isoDate || selectedPost.date);
      console.log('📝 Preparing update data', { isoDate, hasPickedFile: !!pickedFile });
      
      // Prepare update data
      const updateData: any = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory.trim(),
        date: isoDate, // Use ISO date string for backend
        isoDate: isoDate,
      };

      // If new image is picked, include it
      if (pickedFile) {
        updateData.image = pickedFile.uri;
        updateData.images = [pickedFile.uri];
        updateData.imageFile = pickedFile;
        console.log('📸 Including image in update', { uri: pickedFile.uri.substring(0, 50) + '...' });
      }

      console.log('📤 Calling AdminDataService.updatePost', { postId: selectedPost.id, updateData: { ...updateData, imageFile: updateData.imageFile ? 'present' : 'none' } });
      const updated = await AdminDataService.updatePost(selectedPost.id, updateData);
      console.log('📥 AdminDataService.updatePost response', { updated: !!updated });
      
      if (updated) {
        console.log('✅ Post updated successfully, refreshing dashboard');
        
        // Update the selectedPost immediately with the updated data
        if (onPostUpdated && updated) {
          console.log('🔄 Updating selectedPost with new data');
          onPostUpdated(updated);
        }
        
        // Refresh the dashboard
        if (onRefresh) {
          await onRefresh();
        }
        
        setIsEditing(false);
        Alert.alert('Success', 'Post updated successfully');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        console.error('❌ Update failed: AdminDataService returned null');
        Alert.alert('Error', 'Failed to update post');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('❌ Failed to update post:', error);
      Alert.alert('Error', 'Failed to update post');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      console.log('🔄 Setting isUpdating to false');
      setIsUpdating(false);
    }
  };

  const handleDelete = () => {
    console.log('🗑️ handleDelete called', { selectedPost: selectedPost?.id, hasSelectedPost: !!selectedPost });
    
    if (!selectedPost) {
      console.warn('⚠️ handleDelete: No selected post');
      return;
    }
    
    console.log('🗑️ Showing delete confirmation modal');
    setShowDeleteModal(true);
    
    // Animate modal in
    Animated.parallel([
      Animated.spring(deleteModalSlideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(deleteModalBackdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Close delete modal
  const handleCloseDeleteModal = () => {
    Animated.parallel([
      Animated.spring(deleteModalSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(deleteModalBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowDeleteModal(false);
    });
  };

  const handleDeleteConfirm = async () => {
    console.log('✅ Delete confirmed in modal, starting deletion process', { postId: selectedPost?.id });
    
    if (!selectedPost || !selectedPost.id) {
      console.error('❌ Delete failed: Missing post ID');
      Alert.alert('Error', 'Cannot delete post: missing post ID');
      handleCloseDeleteModal();
      return;
    }
    
    try {
      console.log('🔄 Setting isDeleting to true');
      setIsDeleting(true);
      
      console.log('📤 Calling AdminDataService.deletePost', { postId: selectedPost.id });
      const deleted = await AdminDataService.deletePost(selectedPost.id);
      console.log('📥 AdminDataService.deletePost response', { deleted });
      
      if (deleted) {
        console.log('✅ Post deleted successfully, refreshing dashboard');
        
        // Refresh the dashboard first
        if (onRefresh) {
          await onRefresh();
        }
        
        // Close delete modal
        handleCloseDeleteModal();
        
        // Close the drawer
        console.log('🚪 Closing drawer');
        onClose();
        
        // Show success message
        Alert.alert('Success', 'Post deleted successfully');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        console.error('❌ Delete failed: AdminDataService returned false');
        Alert.alert('Error', 'Failed to delete post. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('❌ Failed to delete post:', error);
      Alert.alert('Error', 'Failed to delete post. Please check your connection and try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      console.log('🔄 Setting isDeleting to false');
      setIsDeleting(false);
    }
  };

  const handleSelectMonth = (monthIndex: number, year?: number, day?: number) => {
    if (year !== undefined) {
      try {
        const selectedDay = day !== undefined ? day : (selectedDateObj ? selectedDateObj.getDate() : 1);
        const maxDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const newDay = Math.min(selectedDay, maxDaysInMonth);
        const newDate = new Date(year, monthIndex, newDay);
        
        setSelectedDateObj(newDate);
        setEditDate(formatDate(newDate));
        
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
      } catch (error) {
        console.error('Error selecting date:', error);
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
        });
      }
    }
  };

  const displayImage = pickedFile?.uri || selectedPost?.image || selectedPost?.images?.[0];
  const tagLower = selectedPost?.category?.toLowerCase() || '';
  let accentColor = '#93C5FD';
  
  if (tagLower === 'institutional') {
    accentColor = '#2563EB';
  } else if (tagLower === 'academic') {
    accentColor = '#10B981';
  } else if (selectedPost?.category) {
    const colors = categoryToColors(selectedPost.category);
    accentColor = colors.dot || '#93C5FD';
  }

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="none"
        onRequestClose={onClose}
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
            onPress={onClose}
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
              height: '85%',
              maxHeight: '85%',
              paddingBottom: insets.bottom,
            }
          ]}
        >
          {/* Fixed Header Section */}
          <View style={styles.drawerHeaderFixed}>
            <View style={styles.drawerHandle}>
              <View style={[styles.drawerHandleBar, { backgroundColor: t.colors.textMuted }]} />
            </View>
            
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: t.colors.text }]}>
                {isEditing ? 'Edit Post' : 'Post Details'}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.drawerCloseButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={t.colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Scrollable Content Area */}
          <ScrollView
            style={styles.drawerScrollView}
            contentContainerStyle={[styles.drawerScrollContent, { paddingBottom: 20 }]}
            showsVerticalScrollIndicator={true}
            bounces={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            alwaysBounceVertical={false}
            removeClippedSubviews={false}
          >
              {selectedPost ? (
                <View>
                  {/* Image */}
                  {displayImage && (
                    <View style={styles.drawerSection}>
                      <Image 
                        source={{ uri: displayImage }} 
                        style={styles.drawerImage}
                        resizeMode="cover"
                        onError={(error) => {
                          console.error('Image load error:', error.nativeEvent.error);
                        }}
                      />
                      {isEditing && (
                        <View style={styles.imageActions}>
                          <TouchableOpacity
                            style={[styles.imageActionButton, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
                            onPress={handleAddPhoto}
                            disabled={isAnimating}
                          >
                            <Ionicons name="camera-outline" size={18} color={t.colors.text} />
                            <Text style={[styles.imageActionText, { color: t.colors.text }]}>Change</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.imageActionButton, { backgroundColor: '#DC2626' }]}
                            onPress={handleRemovePhoto}
                          >
                            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                            <Text style={[styles.imageActionText, { color: '#FFFFFF' }]}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Title */}
                  {isEditing ? (
                    <View style={styles.drawerEditField}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.text }]}>Title *</Text>
                      <View style={[styles.drawerInputContainer, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                        <TextInput
                          style={[styles.drawerInput, { color: t.colors.text }]}
                          value={editTitle}
                          onChangeText={setEditTitle}
                          placeholder="Enter post title"
                          placeholderTextColor={t.colors.textMuted}
                          maxLength={100}
                        />
                        <Text style={[styles.drawerCharCount, { color: t.colors.textMuted }]}>
                          {editTitle.length}/100
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.drawerSection}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>Title</Text>
                      <Text style={[styles.drawerEventTitle, { color: t.colors.text }]}>
                        {selectedPost.title}
                      </Text>
                    </View>
                  )}

                  {/* Date */}
                  {isEditing ? (
                    <View style={styles.drawerEditField}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.text }]}>Date *</Text>
                      <TouchableOpacity
                        style={[styles.drawerInputContainer, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
                        onPress={() => {
                          if (!selectedDateObj) {
                            const initialDate = selectedPost?.isoDate || selectedPost?.date 
                              ? new Date(selectedPost.isoDate || selectedPost.date)
                              : new Date();
                            setSelectedDateObj(initialDate);
                            if (!editDate) {
                              setEditDate(formatDate(initialDate));
                            }
                          }
                          setTimeout(() => {
                            setShowDatePicker(true);
                          }, 0);
                        }}
                      >
                        <Text style={[styles.drawerInput, { color: editDate ? t.colors.text : t.colors.textMuted }]}>
                          {editDate || 'Select date'}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color={t.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.drawerSection}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>Date</Text>
                      <View style={styles.drawerEventRow}>
                        <Ionicons name="calendar-outline" size={18} color={t.colors.textMuted} />
                        <Text style={[styles.drawerEventText, { color: t.colors.text }]}>
                          {selectedPost.isoDate || selectedPost.date
                            ? formatDate(new Date(selectedPost.isoDate || selectedPost.date))
                            : 'No date specified'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Category */}
                  {isEditing ? (
                    <View style={styles.drawerEditField}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.text }]}>Category</Text>
                      <View style={styles.categoryButtons}>
                        <TouchableOpacity
                          style={[
                            styles.categoryButton,
                            { 
                              backgroundColor: editCategory === 'Institutional' ? accentColor : t.colors.surface,
                              borderColor: t.colors.border,
                            }
                          ]}
                          onPress={() => setEditCategory('Institutional')}
                        >
                          <Text style={[
                            styles.categoryButtonText,
                            { color: editCategory === 'Institutional' ? '#FFFFFF' : t.colors.text }
                          ]}>
                            Institutional
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.categoryButton,
                            { 
                              backgroundColor: editCategory === 'Academic' ? accentColor : t.colors.surface,
                              borderColor: t.colors.border,
                            }
                          ]}
                          onPress={() => setEditCategory('Academic')}
                        >
                          <Text style={[
                            styles.categoryButtonText,
                            { color: editCategory === 'Academic' ? '#FFFFFF' : t.colors.text }
                          ]}>
                            Academic
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.drawerSection}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>Category</Text>
                      <View style={styles.drawerEventRow}>
                        <Ionicons name="pricetag-outline" size={18} color={accentColor} />
                        <Text style={[styles.drawerEventText, { color: accentColor }]}>
                          {selectedPost.category || 'Event'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Description */}
                  {isEditing ? (
                    <View style={styles.drawerEditField}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.text }]}>Description</Text>
                      <View style={[styles.drawerTextAreaContainer, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                        <TextInput
                          style={[styles.drawerTextArea, { color: t.colors.text }]}
                          value={editDescription}
                          onChangeText={setEditDescription}
                          placeholder="Enter post description"
                          placeholderTextColor={t.colors.textMuted}
                          multiline
                          numberOfLines={6}
                          textAlignVertical="top"
                          maxLength={500}
                        />
                        <Text style={[styles.drawerCharCount, { color: t.colors.textMuted }]}>
                          {editDescription.length}/500
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.drawerSection}>
                      <Text style={[styles.drawerFieldLabel, { color: t.colors.textMuted }]}>Description</Text>
                      <Text style={[styles.drawerEventDescription, { color: t.colors.text }]}>
                        {selectedPost.description || 'No description provided'}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.drawerEmptyState}>
                  <Text style={[styles.drawerEmptyText, { color: t.colors.textMuted }]}>
                    No post selected
                  </Text>
                </View>
              )}
          </ScrollView>

          {/* Action Buttons - Only show if not read-only */}
          {selectedPost && !readOnly && (
            <View 
              style={[
                styles.drawerActions, 
                { 
                  backgroundColor: t.colors.card, 
                  borderTopColor: t.colors.border,
                }
              ]}
              pointerEvents="box-none"
            >
                {isEditing ? (
                  <>
                    <TouchableOpacity
                      style={[styles.drawerActionButton, styles.drawerCancelButton, { borderColor: t.colors.border }]}
                      onPress={() => {
                        console.log('❌ Cancel button pressed!');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleCancelEdit();
                      }}
                      disabled={isUpdating}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.drawerActionButtonText, { color: t.colors.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.drawerActionButton, styles.drawerSaveButton, { backgroundColor: '#FF9500' }]}
                      onPress={() => {
                        console.log('💾 Save button pressed!');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        handleSaveEdit();
                      }}
                      disabled={isUpdating}
                      activeOpacity={0.7}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.drawerActionButtonText, { color: '#FFFFFF' }]}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.drawerActionButton, styles.drawerDeleteButton, { backgroundColor: '#DC2626' }]}
                      onPress={() => {
                        console.log('🔴 Delete button pressed!');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        handleDelete();
                      }}
                      disabled={isDeleting}
                      activeOpacity={0.7}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                          <Text style={[styles.drawerActionButtonText, { color: '#FFFFFF' }]}>Delete</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.drawerActionButton, styles.drawerEditButton, { backgroundColor: '#FF9500' }]}
                      onPress={() => {
                        console.log('✏️ Edit button pressed!');
                        setIsEditing(true);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                      <Text style={[styles.drawerActionButtonText, { color: '#FFFFFF' }]}>Edit</Text>
                    </TouchableOpacity>
                  </>
                )}
            </View>
          )}
        </Animated.View>
      </Modal>

      {/* Date Picker Modal */}
      {showDatePicker && selectedDateObj && (
        <MonthPickerModal
          visible={showDatePicker}
          currentMonth={selectedDateObj}
          onClose={() => {
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

      {/* Delete Confirmation Modal */}
      <DeleteEventModal
        visible={showDeleteModal}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteConfirm}
        eventTitle={selectedPost?.title || ''}
        isDeleting={isDeleting}
        slideAnim={deleteModalSlideAnim}
        backdropOpacity={deleteModalBackdropOpacity}
      />
    </>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    flexDirection: 'column',
  },
  drawerHeaderFixed: {
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
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
    overflow: 'hidden',
  },
  drawerScrollContent: {
    padding: 20,
    paddingTop: 16,
  },
  drawerSection: {
    marginBottom: 20,
  },
  drawerEditField: {
    marginBottom: 20,
  },
  drawerFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  drawerInputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  drawerTextAreaContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 120,
  },
  drawerTextArea: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    minHeight: 100,
  },
  drawerCharCount: {
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  drawerImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 12,
  },
  imageActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  imageActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  drawerEventTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  drawerEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  drawerEventText: {
    fontSize: 14,
    flex: 1,
  },
  drawerEventDescription: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  drawerEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  drawerEmptyText: {
    fontSize: 14,
  },
  drawerActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    zIndex: 10,
  },
  drawerActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    minHeight: 48,
    zIndex: 11,
  },
  drawerDeleteButton: {
    backgroundColor: '#DC2626',
  },
  drawerEditButton: {
    backgroundColor: '#FF9500',
  },
  drawerSaveButton: {
    backgroundColor: '#FF9500',
  },
  drawerCancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  drawerActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PostDetailsDrawer;

