import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { formatDate, timeAgo } from '../utils/dateUtils';

interface PreviewUpdate {
  title: string;
  date: string;
  tag: string;
  time?: string;
  image?: string;
  images?: string[];
  description?: string;
  source?: string;
  pinned?: boolean;
}

// Helper functions for tag colors (moved outside component for performance)
const getTagColor = (tag: string) => {
  switch (tag.toLowerCase()) {
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
  switch (tag.toLowerCase()) {
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

interface PreviewModalProps {
  visible: boolean;
  update: PreviewUpdate | null;
  onClose: () => void;
  customAction?: {
    label: string;
    onPress: () => void;
    icon?: string;
  };
}

const PreviewModal: React.FC<PreviewModalProps> = ({
  visible,
  update,
  onClose,
  customAction,
}) => {
  const { theme } = useTheme();

  // Get image URL from update
  const imageUrl = useMemo(() => {
    if (update?.images && update.images.length > 0) return update.images[0];
    if (update?.image) return update.image;
    return null;
  }, [update?.images, update?.image]);

  // Memoize tag colors and icon
  const tagColor = useMemo(() => getTagColor(update?.tag || ''), [update?.tag]);
  const tagTextColor = useMemo(() => getTagTextColor(update?.tag || ''), [update?.tag]);
  const tagIcon = useMemo(() => {
    const tagLower = update?.tag?.toLowerCase();
    if (tagLower === 'announcement') return 'megaphone';
    if (tagLower === 'academic') return 'school';
    if (tagLower === 'event') return 'calendar';
    return 'pricetag-outline';
  }, [update?.tag]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.previewCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {imageUrl ? (
            <View style={styles.previewImageContainer}>
              <Image 
                source={{ uri: imageUrl }} 
                style={styles.previewImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.previewImageGradient}
              >
                <View style={styles.previewImageOverlay}>
                  <View style={[styles.tagChipOverlay, { backgroundColor: tagColor }]}>
                    <Text style={[styles.tagChipText, { color: tagTextColor }]}>{update?.tag}</Text>
                  </View>
                  <Text style={styles.previewTitleOverlay} numberOfLines={2}>{update?.title}</Text>
                  <View style={styles.previewDateTimeRow}>
                    <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.previewDateOverlay}>{formatDate(update?.date)}</Text>
                    {update?.time && (
                      <>
                        <Text style={styles.previewDateSeparator}>•</Text>
                        <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.previewDateOverlay}>{update.time}</Text>
                      </>
                    )}
                  </View>
                </View>
              </LinearGradient>
              {update?.pinned && (
                <View style={styles.pinnedRibbon}>
                  <Ionicons name="pin" size={12} color="#fff" />
                  <Text style={styles.pinnedRibbonText}>Pinned</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.previewImagePlaceholder, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="image-outline" size={28} color={theme.colors.textMuted} />
              <Text style={[styles.previewImagePlaceholderText, { color: theme.colors.textMuted }]}>No image</Text>
            </View>
          )}
          <View style={[styles.previewDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.previewBody}>
            {!!update?.description && (
              <Text style={[styles.previewUpdateDescription, { color: theme.colors.text }]} numberOfLines={5}>
                {update?.description}
              </Text>
            )}
          </View>
          <View style={styles.previewActions}>
            <Pressable style={[styles.previewSecondaryBtn, styles.previewButtonShadow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={onClose} android_ripple={{ color: '#00000012' }}>
              <Text style={[styles.previewSecondaryText, { color: theme.colors.text }]}>Close</Text>
            </Pressable>
            {customAction && (
              <Pressable style={[styles.previewPrimaryBtn, styles.previewButtonShadow, { backgroundColor: theme.colors.accent }]} onPress={customAction.onPress} android_ripple={{ color: 'rgba(255,255,255,0.2)' }}>
                {customAction.icon && <Ionicons name={customAction.icon as any} size={16} color="#fff" />}
                <Text style={styles.previewPrimaryText}>{customAction.label}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 0,
  },
  previewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  previewMetaInline: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewCloseBtn: {
    padding: 6,
    borderRadius: 10,
  },
  previewImagePlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
  },
  previewImageContainer: {
    position: 'relative',
    width: '100%',
    height: 220,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
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
    height: '60%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  previewImageOverlay: {
    gap: 6,
  },
  tagChipOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  previewTitleOverlay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  previewDateOverlay: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  previewDateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  previewDateSeparator: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.7,
  },
  previewImagePlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  previewDivider: {
    height: 0,
  },
  previewUpdateTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    lineHeight: 26,
    letterSpacing: 0.3,
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
    fontSize: 13,
    fontWeight: '700',
  },
  previewUpdateDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  previewSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewPrimaryBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  previewPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  previewButtonShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  pinnedRibbon: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedRibbonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});

export default memo(PreviewModal);
