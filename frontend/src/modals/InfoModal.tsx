import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface InfoCard {
  icon: string;
  iconColor: string;
  iconBgColor: string;
  text: string;
}

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  cards?: InfoCard[];
  description?: string;
}

const InfoModal: React.FC<InfoModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  cards = [],
  description,
}) => {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.infoHeader}>
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>{title}</Text>
            <Pressable onPress={onClose} style={styles.infoCloseBtn} accessibilityLabel="Close info">
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>
          
          {subtitle && (
            <Text style={[styles.infoSubtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>
          )}
          
          {description && (
            <Text style={[styles.infoDescription, { color: theme.colors.textMuted }]}>{description}</Text>
          )}
          
          {cards.length > 0 && (
            <View style={styles.infoCards}>
              {cards.map((card, index) => (
                <View key={index} style={[styles.infoCardBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
                  <View style={[styles.infoCardIconWrap, { backgroundColor: card.iconBgColor, borderColor: card.iconBgColor }]}>
                    <Ionicons name={card.icon as any} size={18} color={card.iconColor} />
                  </View>
                  <Text style={[styles.infoCardText, { color: theme.colors.text }]}>{card.text}</Text>
                </View>
              ))}
            </View>
          )}
          
          <View style={styles.infoActions}>
            <Pressable style={[styles.infoCloseButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={onClose}>
              <Text style={[styles.infoCloseButtonText, { color: theme.colors.text }]}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    padding: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  infoCloseBtn: {
    padding: 6,
    borderRadius: 10,
  },
  infoSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  infoDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  infoCards: {
    gap: 12,
    marginBottom: 20,
  },
  infoCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoCardText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  infoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  infoCloseButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  infoCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
});

export default InfoModal;
