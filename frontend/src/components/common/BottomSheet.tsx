import React, { ReactNode } from 'react';
import { Animated, Modal, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  sheetY: Animated.Value;
  showHandle?: boolean;
  maxHeight?: string | number;
  backgroundColor?: string;
  overlayOpacity?: number;
  contentStyle?: StyleProp<ViewStyle>;
  enableBackdropClose?: boolean;
}

/**
 * Universal BottomSheet component that automatically handles safe area insets
 * for bottom navigation bars and device notches/rounded corners.
 * 
 * Usage:
 * ```tsx
 * const sheetY = useRef(new Animated.Value(300)).current;
 * 
 * <BottomSheet
 *   visible={isOpen}
 *   onClose={handleClose}
 *   sheetY={sheetY}
 * >
 *   <YourContent />
 * </BottomSheet>
 * ```
 */
const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  sheetY,
  showHandle = true,
  maxHeight = '50%',
  backgroundColor,
  overlayOpacity = 0.5,
  contentStyle,
  enableBackdropClose = true,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useThemeValues();
  const defaultBackgroundColor = backgroundColor || theme.colors.surface;

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="none" 
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.modalOverlay, { backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }]} pointerEvents="box-none">
        {enableBackdropClose && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        )}
        <Animated.View
          style={[
            styles.modalSheet,
            {
              backgroundColor: defaultBackgroundColor,
              transform: [{ translateY: sheetY }],
              paddingBottom: Math.max(insets.bottom, 20),
              ...(typeof maxHeight === 'string' ? { maxHeight: maxHeight as any } : { maxHeight }),
            },
          ]}
        >
          {showHandle && <View style={styles.modalHandle} />}
          <View 
            style={[
              styles.modalContent,
              {
                paddingLeft: Math.max(insets.left, 20),
                paddingRight: Math.max(insets.right, 20),
              },
              contentStyle,
            ]}
          >
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalContent: {
    paddingTop: 8,
  },
});

export default BottomSheet;

