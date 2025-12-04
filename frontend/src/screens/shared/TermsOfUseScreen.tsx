import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeValues } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

type RootStackParamList = {
  UserSettings: undefined;
  AdminSettings: undefined;
  TermsOfUse: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'TermsOfUse'>;

const TermsOfUseScreen = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useThemeValues();
  const navigation = useNavigation<NavigationProp>();

  const floatAnim1 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim1, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: 'By accessing and using DOrSU Connect, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Use, please do not use this application.',
    },
    {
      title: '2. Use License',
      content: 'Permission is granted to temporarily access and use DOrSU Connect for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not: modify or copy the materials; use the materials for any commercial purpose or for any public display; attempt to reverse engineer any software contained in the application; remove any copyright or other proprietary notations from the materials.',
    },
    {
      title: '3. User Accounts',
      content: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.',
    },
    {
      title: '4. User Conduct',
      content: 'You agree to use DOrSU Connect only for lawful purposes and in a way that does not infringe the rights of, restrict or inhibit anyone else\'s use and enjoyment of the application. Prohibited behavior includes harassing or causing distress or inconvenience to any person, transmitting obscene or offensive content, or disrupting the normal flow of dialogue within the application.',
    },
    {
      title: '5. Content and Intellectual Property',
      content: 'All content, features, and functionality of DOrSU Connect, including but not limited to text, graphics, logos, icons, images, and software, are the exclusive property of the application and its licensors. The content is protected by copyright, trademark, and other intellectual property laws.',
    },
    {
      title: '6. Privacy Policy',
      content: 'Your use of DOrSU Connect is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices regarding the collection and use of your personal information.',
    },
    {
      title: '7. Disclaimer',
      content: 'The materials on DOrSU Connect are provided on an \'as is\' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.',
    },
    {
      title: '8. Limitations',
      content: 'In no event shall DOrSU Connect or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on DOrSU Connect, even if authorized representative has been notified orally or in writing of the possibility of such damage.',
    },
    {
      title: '9. Revisions and Errata',
      content: 'The materials appearing on DOrSU Connect could include technical, typographical, or photographic errors. We do not warrant that any of the materials on its website are accurate, complete, or current. We may make changes to the materials contained on its website at any time without notice.',
    },
    {
      title: '10. Modifications',
      content: 'We reserve the right to revise these Terms of Use at any time without notice. By using DOrSU Connect, you are agreeing to be bound by the then current version of these Terms of Use.',
    },
    {
      title: '11. Termination',
      content: 'We may terminate or suspend your account and access to DOrSU Connect immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms of Use.',
    },
    {
      title: '12. Governing Law',
      content: 'These Terms of Use shall be governed by and construed in accordance with the laws of the Philippines, without regard to its conflict of law provisions. Any disputes arising under or in connection with these Terms of Use shall be subject to the exclusive jurisdiction of the courts of the Philippines.',
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="transparent" barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent={true} />
      <LinearGradient colors={[isDarkMode ? '#0B1220' : '#FBF8F3', isDarkMode ? '#111827' : '#F8F5F0', isDarkMode ? '#1F2937' : '#F5F2ED']} style={styles.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <BlurView intensity={Platform.OS === 'ios' ? 5 : 3} tint="default" style={styles.backgroundGradient} />
      <View style={styles.floatingBgContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.floatingOrbWrapper,
            {
              top: '35%',
              left: '50%',
              marginLeft: -250,
              transform: [
                {
                  translateX: floatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-30, 30],
                  }),
                },
                {
                  translateY: floatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 20],
                  }),
                },
                {
                  scale: floatAnim1.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.05, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.floatingOrb1}>
            <LinearGradient
              colors={[t.colors.orbColors.orange1, t.colors.orbColors.orange2, t.colors.orbColors.orange3]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 45}
              tint="default"
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        </Animated.View>
      </View>
      <View style={[styles.header, { marginTop: insets.top, marginLeft: insets.left, marginRight: insets.right }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={isDarkMode ? '#F9FAFB' : '#1F2937'} /></TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937', fontSize: t.fontSize.scaleSize(17) }]}>Terms of Use</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <View style={styles.descriptionContainer}>
          <View style={[styles.descriptionCard, { borderColor: t.colors.border }]}>
            <BlurView intensity={Platform.OS === 'ios' ? 20 : 15} tint={isDarkMode ? 'dark' : 'light'} style={styles.descriptionBlur}>
              <View style={[styles.descriptionContent, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                <Text style={[styles.description, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(14) }]}>Please read these Terms of Use carefully before using DOrSU Connect. By using this application, you agree to be bound by these terms.</Text>
              </View>
            </BlurView>
          </View>
        </View>
        
        <View style={styles.sectionsContainer}>
          {sections.map((section, index) => (
            <View key={index} style={[styles.sectionCardWrapper, { borderColor: t.colors.border }]}>
              <BlurView intensity={Platform.OS === 'ios' ? 20 : 15} tint={isDarkMode ? 'dark' : 'light'} style={styles.sectionCardBlur}>
                <View style={[styles.sectionCard, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                  <Text style={[styles.sectionTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(16) }]}>{section.title}</Text>
                  <Text style={[styles.sectionContent, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(14) }]}>{section.content}</Text>
                </View>
              </BlurView>
            </View>
          ))}
        </View>

        {/* Last Updated */}
        <View style={[styles.lastUpdatedBoxWrapper, { borderColor: t.colors.border }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 20 : 15} tint={isDarkMode ? 'dark' : 'light'} style={styles.lastUpdatedBoxBlur}>
            <View style={[styles.lastUpdatedBox, { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
              <View style={styles.lastUpdatedHeader}>
                <Ionicons name="information-circle-outline" size={20} color={t.colors.accent} />
                <Text style={[styles.lastUpdatedTitle, { color: t.colors.text, fontSize: t.fontSize.scaleSize(15) }]}>Last Updated</Text>
              </View>
              <Text style={[styles.lastUpdatedText, { color: t.colors.textMuted, fontSize: t.fontSize.scaleSize(13) }]}>These Terms of Use were last updated on January 1, 2024.</Text>
            </View>
          </BlurView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  floatingBgContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0 },
  floatingOrbWrapper: { position: 'absolute' },
  floatingOrb1: { width: 500, height: 500, borderRadius: 250, opacity: 0.5, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: 'transparent', zIndex: 10 },
  headerLeft: { width: 40 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  headerRight: { width: 40 },
  content: { flex: 1 },
  descriptionContainer: { marginBottom: 20 },
  descriptionCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  descriptionBlur: { borderRadius: 12, overflow: 'hidden' },
  descriptionContent: { padding: 16, borderRadius: 12 },
  description: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  sectionsContainer: { gap: 12, marginBottom: 18 },
  sectionCardWrapper: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  sectionCardBlur: { borderRadius: 12, overflow: 'hidden' },
  sectionCard: { padding: 16, borderRadius: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: 0.2 },
  sectionContent: { fontSize: 14, lineHeight: 20, opacity: 0.9 },
  lastUpdatedBoxWrapper: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  lastUpdatedBoxBlur: { borderRadius: 12, overflow: 'hidden' },
  lastUpdatedBox: { padding: 16, borderRadius: 12 },
  lastUpdatedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  lastUpdatedTitle: { fontSize: 15, fontWeight: '600' },
  lastUpdatedText: { fontSize: 13, lineHeight: 20, opacity: 0.8, marginLeft: 30 },
});

export default TermsOfUseScreen;

