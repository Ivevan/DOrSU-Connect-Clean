import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../contexts/ThemeContext';

interface DeleteAllModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventCount: number;
  isDeleting: boolean;
  slideAnim: Animated.Value;
  backdropOpacity: Animated.Value;
}

const DeleteAllModal: React.FC<DeleteAllModalProps> = ({
  visible,
  onClose,
  onConfirm,
  eventCount,
  isDeleting,
  slideAnim,
  backdropOpacity,
}) => {
  const { theme: t } = useThemeValues();
  const insets = useSafeAreaInsets();

  return (
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
          }
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={{ flex: 1 }}
        >
          <View style={styles.drawerHandle}>
            <View style={[styles.drawerHandleBar, { backgroundColor: t.colors.textMuted }]} />
          </View>
          
          <View style={styles.drawerHeader}>
            <Text style={[styles.drawerTitle, { color: t.colors.text }]}>
              Delete All Events
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.drawerCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={t.colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.drawerScrollContent}>
            <View style={styles.drawerSection}>
              <View style={[styles.deleteAllWarningContainer, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                <Ionicons name="warning-outline" size={24} color="#DC2626" />
                <Text style={[styles.deleteAllWarningText, { color: '#991B1B' }]}>
                  Are you sure you want to delete all events?
                </Text>
              </View>
              
              <Text style={[styles.deleteAllDescription, { color: t.colors.text }]}>
                This will permanently delete all {eventCount} calendar event{eventCount !== 1 ? 's' : ''} from the system. This action cannot be undone.
              </Text>
              
              <Text style={[styles.deleteAllSubtext, { color: t.colors.textMuted }]}>
                All marked dates on the calendar grid and event list entries will be removed.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={[styles.drawerActions, { backgroundColor: t.colors.card, borderTopColor: t.colors.border, paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity
              style={[styles.drawerActionButton, styles.drawerCancelButton, { borderColor: t.colors.border }]}
              onPress={onClose}
              disabled={isDeleting}
            >
              <Text style={[styles.drawerActionButtonText, { color: t.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.drawerActionButton, styles.drawerDeleteButton, { backgroundColor: '#DC2626' }]}
              onPress={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  <Text style={[styles.drawerActionButtonText, { color: '#FFFFFF' }]}>Delete All</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
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
  drawerScrollContent: {
    padding: 20,
    paddingTop: 16,
  },
  drawerSection: {
    marginBottom: 20,
  },
  deleteAllWarningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  deleteAllWarningText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  deleteAllDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  deleteAllSubtext: {
    fontSize: 13,
    lineHeight: 18,
  },
  drawerActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  drawerActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  drawerCancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  drawerDeleteButton: {
    backgroundColor: '#DC2626',
  },
  drawerActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeleteAllModal;

