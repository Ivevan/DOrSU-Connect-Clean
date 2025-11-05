import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const AboutScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}> 
      {/* Minimalist Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{top: 16, bottom: 16, left: 16, right: 16}}>
            <Ionicons name="chevron-back" size={26} color={theme.colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
            <Text style={[styles.title, { color: theme.colors.text }]}>About</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>DOrSU Connect</Text>
        </View>
      </View>
      <View style={[styles.divider, { borderBottomColor: theme.colors.border }]} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: theme.colors.textMuted }]}>DOrSU Connect is the official mobile application for Davao Oriental State University. Stay connected with the latest school updates, announcements, events, and more.</Text>
        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={[styles.featureCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }] }>
            <Ionicons name="school-outline" size={20} color={theme.colors.accent} style={styles.featureIcon}/>
            <Text style={[styles.featureText, { color: theme.colors.text }]}>Official DOrSU mobile app</Text>
          </View>
          <View style={[styles.featureCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }] }>
            <Ionicons name="notifications-outline" size={20} color={theme.colors.accent} style={styles.featureIcon}/>
            <Text style={[styles.featureText, { color: theme.colors.text }]}>Real-time school updates</Text>
          </View>
          <View style={[styles.featureCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }] }>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.accent} style={styles.featureIcon}/>
            <Text style={[styles.featureText, { color: theme.colors.text }]}>School calendar and events</Text>
          </View>
          <View style={[styles.featureCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }] }>
            <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.accent} style={styles.featureIcon}/>
            <Text style={[styles.featureText, { color: theme.colors.text }]}>AI-powered assistance</Text>
          </View>
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
  featuresContainer: { gap: 10, marginBottom: 18 },
  featureCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1 },
  featureIcon: { marginRight: 12 },
  featureText: { flex: 1, fontSize: 14, fontWeight: '500' },
});

export default AboutScreen;
