import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Animated, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../contexts/ThemeContext';

interface CalendarHelpModalProps {
  visible: boolean;
  onClose: () => void;
  slideAnim: Animated.Value;
  backdropOpacity: Animated.Value;
}

const CalendarHelpModal: React.FC<CalendarHelpModalProps> = ({
  visible,
  onClose,
  slideAnim,
  backdropOpacity,
}) => {
  const { theme: t } = useThemeValues();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalBackdrop,
            {
              opacity: backdropOpacity,
            },
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
            styles.drawerContent,
            {
              backgroundColor: t.colors.card,
              paddingBottom: insets.bottom,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [600, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{ flex: 1 }}
          >
            {/* Handle */}
            <View style={styles.drawerHandle}>
              <View style={[styles.drawerHandleBar, { backgroundColor: t.colors.textMuted }]} />
            </View>
            
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
              <Text style={[styles.headerTitle, { color: t.colors.text }]}>
                Calendar Help & Instructions
              </Text>
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={t.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={true}
            >
              {/* CSV Upload Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="cloud-upload-outline" size={20} color={t.colors.accent} />
                  <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
                    CSV File Upload
                  </Text>
                </View>
                <Text style={[styles.sectionText, { color: t.colors.textMuted }]}>
                  Your CSV file must contain at least 3 of the following fields:
                </Text>
                <View style={styles.fieldList}>
                  {[
                    { name: 'Type', desc: 'Institutional or Academic' },
                    { name: 'Event', desc: 'Event title/name (Required)' },
                    { name: 'DateType', desc: 'date, date_range, month, or week' },
                    { name: 'StartDate', desc: 'Start date of the event' },
                    { name: 'EndDate', desc: 'End date of the event' },
                    { name: 'Year', desc: 'Year of the event' },
                    { name: 'Month', desc: 'Month number (1-12)' },
                    { name: 'WeekOfMonth', desc: 'Week number (1-5)' },
                    { name: 'Description', desc: 'Event description' },
                  ].map((field, index) => (
                    <View key={index} style={styles.fieldItem}>
                      <Text style={[styles.fieldName, { color: t.colors.text }]}>
                        • {field.name}:
                      </Text>
                      <Text style={[styles.fieldDesc, { color: t.colors.textMuted }]}>
                        {field.desc}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.noteText, { color: t.colors.textMuted }]}>
                  Note: Field names are flexible (case-insensitive, with/without underscores). 
                  Missing fields can be added later using the Edit button.
                </Text>
              </View>

              {/* Event Types Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="color-palette-outline" size={20} color={t.colors.accent} />
                  <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
                    Event Type Categories
                  </Text>
                </View>
                <View style={styles.categoryItem}>
                  <View style={[styles.colorIndicator, { backgroundColor: '#2563EB' }]} />
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: t.colors.text }]}>
                      Institutional
                    </Text>
                    <Text style={[styles.categoryDesc, { color: t.colors.textMuted }]}>
                      University-wide events, administrative activities, and institutional announcements
                    </Text>
                  </View>
                </View>
                <View style={styles.categoryItem}>
                  <View style={[styles.colorIndicator, { backgroundColor: '#10B981' }]} />
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: t.colors.text }]}>
                      Academic
                    </Text>
                    <Text style={[styles.categoryDesc, { color: t.colors.textMuted }]}>
                      Academic schedules, classes, exams, and educational events
                    </Text>
                  </View>
                </View>
              </View>

              {/* Date Types Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="calendar-outline" size={20} color={t.colors.accent} />
                  <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
                    Date Types
                  </Text>
                </View>
                <View style={styles.dateTypeItem}>
                  <Text style={[styles.dateTypeName, { color: t.colors.text }]}>
                    • date
                  </Text>
                  <Text style={[styles.dateTypeDesc, { color: t.colors.textMuted }]}>
                    Single specific date (e.g., "2025-11-15")
                  </Text>
                </View>
                <View style={styles.dateTypeItem}>
                  <Text style={[styles.dateTypeName, { color: t.colors.text }]}>
                    • date_range
                  </Text>
                  <Text style={[styles.dateTypeDesc, { color: t.colors.textMuted }]}>
                    Multiple consecutive dates (e.g., "2025-11-15" to "2025-11-20")
                  </Text>
                </View>
                <View style={styles.dateTypeItem}>
                  <Text style={[styles.dateTypeName, { color: t.colors.text }]}>
                    • month
                  </Text>
                  <Text style={[styles.dateTypeDesc, { color: t.colors.textMuted }]}>
                    Entire month (requires Month and Year fields)
                  </Text>
                </View>
                <View style={styles.dateTypeItem}>
                  <Text style={[styles.dateTypeName, { color: t.colors.text }]}>
                    • week
                  </Text>
                  <Text style={[styles.dateTypeDesc, { color: t.colors.textMuted }]}>
                    Specific week of month (requires WeekOfMonth, Month, and Year fields)
                  </Text>
                </View>
              </View>

              {/* Tips Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="bulb-outline" size={20} color={t.colors.accent} />
                  <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
                    Tips for Smooth Upload
                  </Text>
                </View>
                <View style={styles.tipList}>
                  {[
                    'Ensure your CSV file has headers in the first row',
                    'Use consistent date formats (YYYY-MM-DD recommended)',
                    'Double-tap any calendar cell to quickly add an event',
                    'Click on marked dates to view and edit event details',
                    'Use the Edit button to update missing information after upload',
                    'Filter events by type using the Institutional/Academic toggle',
                  ].map((tip, index) => (
                    <View key={index} style={styles.tipItem}>
                      <Ionicons name="checkmark-circle" size={16} color={t.colors.accent} />
                      <Text style={[styles.tipText, { color: t.colors.textMuted }]}>
                        {tip}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawerContent: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  fieldList: {
    marginBottom: 12,
  },
  fieldItem: {
    marginBottom: 8,
  },
  fieldName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fieldDesc: {
    fontSize: 13,
    marginLeft: 16,
  },
  noteText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: 2,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  dateTypeItem: {
    marginBottom: 12,
  },
  dateTypeName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateTypeDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 16,
  },
  tipList: {
    gap: 10,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});

export default CalendarHelpModal;

