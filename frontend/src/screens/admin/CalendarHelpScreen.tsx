import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';

type RootStackParamList = {
  AdminCalendar: undefined;
  CalendarHelp: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CalendarHelpScreen = () => {
  const { isDarkMode, theme: t } = useThemeValues();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="transparent" barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent={true} />
      <LinearGradient 
        colors={[isDarkMode ? '#0B1220' : '#FBF8F3', isDarkMode ? '#111827' : '#F8F5F0', isDarkMode ? '#1F2937' : '#F5F2ED']} 
        style={styles.backgroundGradient} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 0, y: 1 }} 
      />
      <BlurView intensity={Platform.OS === 'ios' ? 5 : 3} tint="default" style={styles.backgroundGradient} />
      
      {/* Header */}
      <View style={[styles.header, { marginTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton} 
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIconContainer, { backgroundColor: isDarkMode ? 'rgba(255, 149, 0, 0.2)' : 'rgba(255, 149, 0, 0.1)' }]}>
            <Ionicons name="information-circle" size={20} color="#FF9500" />
          </View>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>
            Calendar Help
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* CSV Upload Section */}
        <View style={[styles.sectionCard, { 
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: '#3B82F6' + '20' }]}>
              <Ionicons name="cloud-upload" size={22} color="#3B82F6" />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
                CSV File Upload
              </Text>
              <Text style={[styles.sectionSubtitle, { color: t.colors.textMuted }]}>
                Required fields and format
              </Text>
            </View>
          </View>
          
          <View style={[styles.infoBox, { 
            backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
            borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
          }]}>
            <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
            <Text style={[styles.infoBoxText, { color: t.colors.text }]}>
              Your CSV file must contain at least 3 of the following fields
            </Text>
          </View>

          <View style={styles.fieldList}>
            {[
              { name: 'Type', desc: 'Institutional or Academic', required: false },
              { name: 'Event', desc: 'Event title/name', required: true },
              { name: 'DateType', desc: 'date, date_range, month, or week', required: false },
              { name: 'StartDate', desc: 'Start date of the event', required: false },
              { name: 'EndDate', desc: 'End date of the event', required: false },
              { name: 'Year', desc: 'Year of the event', required: false },
              { name: 'Month', desc: 'Month number (1-12)', required: false },
              { name: 'WeekOfMonth', desc: 'Week number (1-5)', required: false },
              { name: 'Description', desc: 'Event description', required: false },
            ].map((field, index) => (
              <View key={index} style={[styles.fieldItem, { 
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              }]}>
                <View style={styles.fieldItemLeft}>
                  <View style={[styles.fieldBadge, { 
                    backgroundColor: field.required ? '#EF4444' + '20' : '#6B7280' + '20',
                  }]}>
                    <Text style={[styles.fieldBadgeText, { 
                      color: field.required ? '#EF4444' : '#6B7280',
                    }]}>
                      {field.required ? 'Required' : 'Optional'}
                    </Text>
                  </View>
                  <Text style={[styles.fieldName, { color: t.colors.text }]}>
                    {field.name}
                  </Text>
                </View>
                <Text style={[styles.fieldDesc, { color: t.colors.textMuted }]}>
                  {field.desc}
                </Text>
              </View>
            ))}
          </View>
          
          <View style={[styles.noteBox, { 
            backgroundColor: isDarkMode ? 'rgba(255, 149, 0, 0.1)' : 'rgba(255, 149, 0, 0.08)',
            borderColor: isDarkMode ? 'rgba(255, 149, 0, 0.3)' : 'rgba(255, 149, 0, 0.2)',
          }]}>
            <Ionicons name="bulb" size={16} color="#FF9500" />
            <Text style={[styles.noteText, { color: t.colors.text }]}>
              Field names are flexible (case-insensitive). Missing fields can be added later using the Edit button.
            </Text>
          </View>
        </View>

        {/* Event Types Section */}
        <View style={[styles.sectionCard, { 
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: '#8B5CF6' + '20' }]}>
              <Ionicons name="color-palette" size={22} color="#8B5CF6" />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
                Event Type Categories
              </Text>
              <Text style={[styles.sectionSubtitle, { color: t.colors.textMuted }]}>
                Color-coded event types
              </Text>
            </View>
          </View>
          
          <View style={styles.categoryList}>
            <View style={[styles.categoryCard, { 
              backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.08)',
              borderColor: '#2563EB',
            }]}>
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
            
            <View style={[styles.categoryCard, { 
              backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)',
              borderColor: '#10B981',
            }]}>
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
        </View>

        {/* Date Types Section */}
        <View style={[styles.sectionCard, { 
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: '#10B981' + '20' }]}>
              <Ionicons name="calendar" size={22} color="#10B981" />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
                Date Types
              </Text>
              <Text style={[styles.sectionSubtitle, { color: t.colors.textMuted }]}>
                Supported date formats
              </Text>
            </View>
          </View>
          
          <View style={styles.dateTypeList}>
            {[
              { type: 'date', desc: 'Single specific date', example: '2025-11-15' },
              { type: 'date_range', desc: 'Multiple consecutive dates', example: '2025-11-15 to 2025-11-20' },
              { type: 'month', desc: 'Entire month', example: 'Requires Month and Year fields' },
              { type: 'week', desc: 'Specific week of month', example: 'Requires WeekOfMonth, Month, and Year' },
            ].map((dateType, index) => (
              <View key={index} style={[styles.dateTypeCard, { 
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              }]}>
                <View style={styles.dateTypeHeader}>
                  <View style={[styles.dateTypeBadge, { 
                    backgroundColor: '#10B981' + '20',
                  }]}>
                    <Text style={[styles.dateTypeBadgeText, { color: '#10B981' }]}>
                      {dateType.type}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.dateTypeDesc, { color: t.colors.textMuted }]}>
                  {dateType.desc}
                </Text>
                <Text style={[styles.dateTypeExample, { color: t.colors.text }]}>
                  Example: {dateType.example}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tips Section */}
        <View style={[styles.sectionCard, { 
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: '#F59E0B' + '20' }]}>
              <Ionicons name="bulb" size={22} color="#F59E0B" />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
                Tips for Smooth Upload
              </Text>
              <Text style={[styles.sectionSubtitle, { color: t.colors.textMuted }]}>
                Best practices and shortcuts
              </Text>
            </View>
          </View>
          
          <View style={styles.tipList}>
            {[
              { icon: 'checkmark-circle', text: 'Ensure your CSV file has headers in the first row' },
              { icon: 'calendar', text: 'Use consistent date formats (YYYY-MM-DD recommended)' },
              { icon: 'add-circle', text: 'Double-tap any calendar cell to quickly add an event' },
              { icon: 'create', text: 'Click on marked dates to view and edit event details' },
              { icon: 'pencil', text: 'Use the Edit button to update missing information after upload' },
              { icon: 'time-outline', text: 'Use the Yearly/Monthly dropdown to filter events by time range' },
              { icon: 'filter', text: 'Filter events by type using the Institutional/Academic toggle' },
            ].map((tip, index) => (
              <View key={index} style={[styles.tipCard, { 
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              }]}>
                <View style={[styles.tipIconContainer, { backgroundColor: '#F59E0B' + '20' }]}>
                  <Ionicons name={tip.icon as any} size={18} color="#F59E0B" />
                </View>
                <Text style={[styles.tipText, { color: t.colors.text }]}>
                  {tip.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  fieldList: {
    gap: 8,
    marginBottom: 12,
  },
  fieldItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  fieldItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  fieldBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fieldBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fieldDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 0,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  categoryList: {
    gap: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  colorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginTop: 2,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  categoryDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  dateTypeList: {
    gap: 10,
  },
  dateTypeCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateTypeHeader: {
    marginBottom: 8,
  },
  dateTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateTypeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dateTypeDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  dateTypeExample: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontStyle: 'italic',
  },
  tipList: {
    gap: 10,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  tipIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
});

export default CalendarHelpScreen;

