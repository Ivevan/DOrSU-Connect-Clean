import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

interface HelpCenterModalProps {
  visible: boolean;
  onClose: () => void;
  sheetY: Animated.Value;
}

const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  visible,
  onClose,
  sheetY,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      overlayOpacity.setValue(0);
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
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
    onClose();
  };

  const faqItems = [
    {
      question: 'How do I post an update?',
      answer: 'Go to Dashboard, tap the "+" button, fill out the form, and post your update.',
    },
    {
      question: 'How do I manage posts?',
      answer: 'Go to Dashboard, select "Manage Posts" to view, edit, or delete your posts.',
    },
    {
      question: 'How do I use AI Chat?',
      answer: 'Tap the chat icon in the bottom navigation and type your question.',
    },
    {
      question: 'How do I view calendar?',
      answer: 'Tap the calendar icon in the bottom navigation to see school events.',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={handleOverlayPress} />
        <Animated.View style={[
          styles.floatingModal, 
          { 
            transform: [{ scale: overlayOpacity }], 
            backgroundColor: theme.colors.card
          }
        ]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.sheetIconCircle, { backgroundColor: `${theme.colors.accent}20` }]}>
                <Ionicons name="help-circle" size={24} color={theme.colors.accent} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Help Center</Text>
                <Text style={[styles.sheetSubtitle, { color: theme.colors.textMuted }]}>Frequently Asked Questions</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.closeIconButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView 
            showsVerticalScrollIndicator={true}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Description */}
            <Text style={[styles.sheetDescription, { color: theme.colors.textMuted }]}>
              Find answers to common questions about DOrSU Connect.
            </Text>

            {/* FAQ Items */}
            <View style={styles.faqContainer}>
              {faqItems.map((item, index) => (
                <View 
                  key={index}
                  style={[styles.faqCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
                >
                  <View style={styles.faqQuestionRow}>
                    <View style={[styles.faqIconWrap, { backgroundColor: `${theme.colors.accent}20` }]}>
                      <Ionicons name="help-circle-outline" size={18} color={theme.colors.accent} />
                    </View>
                    <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>{item.question}</Text>
                  </View>
                  <Text style={[styles.faqAnswer, { color: theme.colors.textMuted }]}>{item.answer}</Text>
                </View>
              ))}
            </View>

            {/* Help Section */}
            <View style={[styles.helpBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
              <View style={styles.helpBoxHeader}>
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.accent} />
                <Text style={[styles.helpBoxTitle, { color: theme.colors.text }]}>Need more help?</Text>
              </View>
              <Text style={[styles.helpBoxText, { color: theme.colors.textMuted }]}>
                Contact our support team for personalized assistance.
              </Text>
            </View>
          </ScrollView>

          {/* Close Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.closeButton, { backgroundColor: theme.colors.accent }]} 
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.closeButtonText, { color: '#FFFFFF' }]}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
  },
  overlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floatingModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 15,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  closeIconButton: {
    padding: 8,
    marginLeft: 12,
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingBottom: 20,
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
  faqContainer: {
    gap: 12,
    marginBottom: 20,
  },
  faqCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  faqIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 18,
  },
  faqAnswer: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
    marginLeft: 32,
  },
  helpBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  helpBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  helpBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  helpBoxText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
  },
  buttonContainer: {
    paddingTop: 20,
    paddingBottom: 0,
  },
  closeButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default HelpCenterModal;

