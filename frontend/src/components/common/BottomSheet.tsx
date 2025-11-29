import React, { ReactNode, useMemo } from 'react';
import { Animated, Dimensions, Modal, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
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
  sheetPaddingBottom?: number;
  autoSize?: boolean; // Automatically remove excess space by sizing to content
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
  sheetPaddingBottom,
  autoSize = false,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useThemeValues();
  const defaultBackgroundColor = backgroundColor || theme.colors.surface;
  
  // Memoize expensive calculations
  const { calculatedMaxHeight, bottomPadding, sheetStyle, contentStyleArray } = useMemo(() => {
    // Calculate maxHeight in pixels if it's a percentage string
    const screenHeight = Dimensions.get('window').height;
    const maxH = typeof maxHeight === 'string' && maxHeight.includes('%')
      ? (screenHeight * parseFloat(maxHeight) / 100)
      : (typeof maxHeight === 'number' ? maxHeight : screenHeight * 0.5);

    // Use custom paddingBottom if provided, otherwise use default safe area padding
    const bottomPad = sheetPaddingBottom !== undefined 
      ? sheetPaddingBottom 
      : Math.max(insets.bottom, 20);

    // Auto-size: remove excess space by letting content determine height
    const baseStyle = {
      backgroundColor: defaultBackgroundColor,
      transform: [{ translateY: sheetY }],
      paddingBottom: bottomPad,
      maxHeight: maxH,
    };

    const sheetSty = autoSize
      ? baseStyle
      : { ...baseStyle, height: maxH };

    // Auto-size: adjust content style to not expand unnecessarily
    const baseContentStyle = {
      paddingLeft: Math.max(insets.left, 20),
      paddingRight: Math.max(insets.right, 20),
    };

    const contentSty = autoSize
      ? [baseContentStyle, { flex: 0 }, contentStyle]
      : [baseContentStyle, contentStyle];

    return {
      calculatedMaxHeight: maxH,
      bottomPadding: bottomPad,
      sheetStyle: sheetSty,
      contentStyleArray: contentSty,
    };
  }, [maxHeight, sheetPaddingBottom, insets.bottom, insets.left, insets.right, defaultBackgroundColor, sheetY, autoSize, contentStyle]);

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
            sheetStyle,
          ]}
        >
          {showHandle && <View style={styles.modalHandle} />}
          <View 
            style={[
              styles.modalContent,
              contentStyleArray,
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
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 20,
    minHeight: 200,
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
    flex: 1,
    minHeight: 0,
  },
});

export default BottomSheet;

