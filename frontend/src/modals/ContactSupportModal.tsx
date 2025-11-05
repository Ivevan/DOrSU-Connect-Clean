import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

interface ContactSupportModalProps {
  visible: boolean;
  onClose: () => void;
  sheetY: Animated.Value;
}

const ContactSupportModal: React.FC<ContactSupportModalProps> = ({
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
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
    onClose();
  };

  const handleEmailPress = () => {
    Linking.openURL('mailto:support@dorsu.edu.ph?subject=DOrSU Connect Support Request');
  };

  const handlePhonePress = () => {
    Linking.openURL('tel:+639123456789');
  };

  const handleWebsitePress = () => {
    Linking.openURL('https://www.dorsu.edu.ph');
  };

  const contactMethods = [
    {
      icon: 'mail-outline',
      title: 'Email Support',
      description: 'support@dorsu.edu.ph',
      action: handleEmailPress,
      color: theme.colors.accent,
    },
    {
      icon: 'call-outline',
      title: 'Phone Support',
      description: '+63 912 345 6789',
      action: handlePhonePress,
      color: theme.colors.accent,
    },
    {
      icon: 'globe-outline',
      title: 'Visit Website',
      description: 'www.dorsu.edu.ph',
      action: handleWebsitePress,
      color: theme.colors.accent,
    },
  ];

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
                <Ionicons name="mail" size={24} color={theme.colors.accent} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Contact Support</Text>
                <Text style={[styles.sheetSubtitle, { color: theme.colors.textMuted }]}>Get help with DOrSU Connect</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={[styles.sheetDescription, { color: theme.colors.textMuted }]}>
              Need assistance? Reach out to our support team through any of the following methods. 
              We're here to help you with any questions or issues you may have.
            </Text>

            {/* Contact Methods */}
            <View style={styles.contactMethodsContainer}>
              {contactMethods.map((method, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.contactCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
                  onPress={method.action}
                  activeOpacity={0.7}
                >
                  <View style={[styles.contactIconWrap, { backgroundColor: `${method.color}20` }]}>
                    <Ionicons name={method.icon as any} size={22} color={method.color} />
                  </View>
                  <View style={styles.contactTextContainer}>
                    <Text style={[styles.contactTitle, { color: theme.colors.text }]}>{method.title}</Text>
                    <Text style={[styles.contactDescription, { color: theme.colors.textMuted }]}>{method.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Office Hours */}
            <View style={[styles.infoBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
              <View style={styles.infoBoxHeader}>
                <Ionicons name="time-outline" size={18} color={theme.colors.accent} />
                <Text style={[styles.infoBoxTitle, { color: theme.colors.text }]}>Support Hours</Text>
              </View>
              <Text style={[styles.infoBoxText, { color: theme.colors.textMuted }]}>
                Monday - Friday: 8:00 AM - 5:00 PM{'\n'}
                Saturday: 8:00 AM - 12:00 PM{'\n'}
                Sunday: Closed
              </Text>
            </View>
          </ScrollView>

          {/* Close Button - Fixed at bottom, always visible */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.closeButton, { backgroundColor: theme.colors.accent }]} 
              onPress={handleClose}
            >
              <Text style={[styles.closeButtonText, { color: '#FFFFFF' }]}>Close</Text>
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
  contactMethodsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactTextContainer: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  contactDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  infoBoxText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
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

export default ContactSupportModal;

