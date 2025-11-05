import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const ContactSupportScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();

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
    <View style={[styles.container, {backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom}]}> 
      {/* Minimalist Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{top: 16, bottom: 16, left: 16, right: 16}}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Contact Support</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Support</Text>
        </View>
      </View>
      <View style={[styles.divider, { borderBottomColor: theme.colors.border }]} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: theme.colors.textMuted }]}>Need assistance? Reach out to our support team through any of the following methods. We're here to help you with any questions or issues you may have.</Text>
        <View style={styles.contactMethodsContainer}>
          {contactMethods.map((method, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.contactCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
              onPress={method.action}
              activeOpacity={0.7}
            >
              <Ionicons name={method.icon as any} size={22} color={method.color} style={styles.iconLeft}/>
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
          <Text style={[styles.infoBoxText, { color: theme.colors.textMuted }]}>Monday - Friday: 8:00 AM - 5:00 PM{String.fromCharCode(10)}Saturday: 8:00 AM - 12:00 PM{String.fromCharCode(10)}Sunday: Closed</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8, backgroundColor: 'transparent' },
  backButton: { 
    height: 40, width: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent', marginRight: 4,
  },
  headerTextBlock: { marginLeft: 4, flex: 1, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: 0.1 },
  subtitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', opacity: 0.7, marginTop: 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: 0 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  contactMethodsContainer: { gap: 10, marginBottom: 18 },
  contactCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1 },
  iconLeft: { marginRight: 12 },
  contactTextContainer: { flex: 1 },
  contactTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  contactDescription: { fontSize: 13 },
  infoBox: { padding: 12, borderRadius: 8, borderWidth: 1 },
  infoBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoBoxTitle: { fontSize: 14, fontWeight: '600' },
  infoBoxText: { fontSize: 13, lineHeight: 20, opacity: 0.7 },
});

export default ContactSupportScreen;
