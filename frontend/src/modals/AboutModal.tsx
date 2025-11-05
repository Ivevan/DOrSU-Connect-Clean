import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
  sheetY: Animated.Value;
}

const AboutModal: React.FC<AboutModalProps> = ({
  visible,
  onClose,
  sheetY,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      overlayOpacity.setValue(0);
    }
  }, [visible]);

  const handleOverlayPress = () => {
    onClose();
  };

  const handleClose = () => {
    // Fade out overlay first, then trigger parent close
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={handleOverlayPress} />
        <Animated.View style={[
          styles.sheet, 
          { 
            transform: [{ translateY: sheetY }], 
            backgroundColor: theme.colors.card 
          }
        ]}>
          <View style={styles.sheetHandle} />
          
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.sheetIconCircle, { backgroundColor: `${theme.colors.accent}20` }]}>
                <Ionicons name="information-circle" size={24} color={theme.colors.accent} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>About DOrSU Connect</Text>
                <Text style={[styles.sheetSubtitle, { color: theme.colors.textMuted }]}>Version 1.0.0</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={[styles.sheetDescription, { color: theme.colors.textMuted }]}>
              DOrSU Connect is the official mobile application for Davao Oriental State University. 
              Stay connected with the latest school updates, announcements, events, and more.
            </Text>

            {/* Features */}
            <View style={styles.featuresContainer}>
              <View style={[styles.featureCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
                <View style={[styles.featureIconWrap, { backgroundColor: theme.colors.accent }]}>
                  <Ionicons name="school-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.featureText, { color: theme.colors.text }]}>Official DOrSU mobile app</Text>
              </View>

              <View style={[styles.featureCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
                <View style={[styles.featureIconWrap, { backgroundColor: theme.colors.accent }]}>
                  <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.featureText, { color: theme.colors.text }]}>Real-time school updates</Text>
              </View>

              <View style={[styles.featureCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
                <View style={[styles.featureIconWrap, { backgroundColor: theme.colors.accent }]}>
                  <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.featureText, { color: theme.colors.text }]}>School calendar and events</Text>
              </View>

              <View style={[styles.featureCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
                <View style={[styles.featureIconWrap, { backgroundColor: theme.colors.accent }]}>
                  <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.featureText, { color: theme.colors.text }]}>AI-powered assistance</Text>
              </View>
            </View>
          </ScrollView>

          {/* Close Button - Fixed at bottom, always visible */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.closeButton, { backgroundColor: theme.colors.accent }]} 
              onPress={handleClose}
            >
              <Text style={[styles.closeButtonText, { color: '#FFFFFF' }]}>Got it</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: insets.bottom }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  overlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    maxHeight: '85%',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  buttonContainer: {
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: '#FFFFFF',
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  sheetIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 2,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  sheetDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginBottom: 20,
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  closeButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    marginTop: 8,
    marginBottom: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default AboutModal;

