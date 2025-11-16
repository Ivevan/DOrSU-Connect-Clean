import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../config/theme';
import { useThemeActions, useThemeValues } from '../../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';
import ThemeColorModal from '../../modals/ThemeColorModal';

type RootStackParamList = {
  UserSettings: undefined;
  GeneralSettings: undefined;
};

const GeneralSettings = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme: t } = useThemeValues();
  const { toggleTheme } = useThemeActions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [language, setLanguage] = useState('English');
  const [isThemeColorModalVisible, setIsThemeColorModalVisible] = useState(false);

  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim1 = useRef(new Animated.Value(0)).current;
  const cloudAnim2 = useRef(new Animated.Value(0)).current;
  const lightSpot1 = useRef(new Animated.Value(0)).current;
  const lightSpot2 = useRef(new Animated.Value(0)).current;
  const lightSpot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [
      Animated.loop(
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
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(cloudAnim1, {
            toValue: 1,
            duration: 15000,
            useNativeDriver: true,
          }),
          Animated.timing(cloudAnim1, {
            toValue: 0,
            duration: 15000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(cloudAnim2, {
            toValue: 1,
            duration: 20000,
            useNativeDriver: true,
          }),
          Animated.timing(cloudAnim2, {
            toValue: 0,
            duration: 20000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lightSpot1, {
            toValue: 1,
            duration: 12000,
            useNativeDriver: true,
          }),
          Animated.timing(lightSpot1, {
            toValue: 0,
            duration: 12000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lightSpot2, {
            toValue: 1,
            duration: 18000,
            useNativeDriver: true,
          }),
          Animated.timing(lightSpot2, {
            toValue: 0,
            duration: 18000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lightSpot3, {
            toValue: 1,
            duration: 14000,
            useNativeDriver: true,
          }),
          Animated.timing(lightSpot3, {
            toValue: 0,
            duration: 14000,
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    animations.forEach(anim => anim.start());
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        translucent={true}
      />

      {/* Background */}
      <LinearGradient
        colors={[
          isDarkMode ? '#0B1220' : '#FBF8F3',
          isDarkMode ? '#111827' : '#F8F5F0',
          isDarkMode ? '#1F2937' : '#F5F2ED'
        ]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Animated Floating Background Orbs */}
      <View style={styles.floatingBgContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              transform: [
                {
                  translateY: cloudAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -30],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.cloudPatch1}>
            <LinearGradient
              colors={['rgba(255, 149, 0, 0.3)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              transform: [
                {
                  translateY: cloudAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 40],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.cloudPatch2}>
            <LinearGradient
              colors={['rgba(255, 149, 0, 0.2)', 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.lightSpot1,
            {
              transform: [
                {
                  scale: lightSpot1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255, 200, 100, 0.4)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>

      {/* Header */}
      <View style={[styles.header, { top: insets.top, marginLeft: insets.left, marginRight: insets.right }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={28} color={isDarkMode ? '#F9FAFB' : '#1F2937'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#F9FAFB' : '#1F2937' }]}>General</Text>
      </View>

      <ScrollView
        style={[styles.scrollView, { marginTop: insets.top + 56 }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={styles.sectionCard}
        >
          <Text style={[styles.sectionTitle, { color: t.colors.text }]}>General Settings</Text>

          <TouchableOpacity 
            style={[styles.settingItem, { borderBottomColor: t.colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsThemeColorModalVisible(true);
            }}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                <Ionicons name="color-palette-outline" size={20} color="#FF9500" />
              </View>
              <Text style={[styles.settingTitle, { color: t.colors.text }]}>Theme Color</Text>
            </View>
            <View style={styles.settingRight}>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </View>
          </TouchableOpacity>

          <View style={[styles.settingItem, { borderBottomColor: t.colors.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                <Ionicons name="moon-outline" size={20} color="#FF9500" />
              </View>
              <Text style={[styles.settingTitle, { color: t.colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={(value) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                toggleTheme();
              }}
              trackColor={{ false: t.colors.border, true: t.colors.accent }}
              thumbColor={t.colors.surface}
              ios_backgroundColor={t.colors.border}
            />
          </View>

          <TouchableOpacity style={styles.settingItemLast}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.colors.surface }]}>
                <Ionicons name="language-outline" size={20} color="#FF9500" />
              </View>
              <Text style={[styles.settingTitle, { color: t.colors.text }]}>Language</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: t.colors.textMuted }]}>{language}</Text>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </View>
          </TouchableOpacity>
        </BlurView>
      </ScrollView>

      {/* Theme Color Modal */}
      <ThemeColorModal
        visible={isThemeColorModalVisible}
        onClose={() => setIsThemeColorModalVisible(false)}
      />
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
    zIndex: -1,
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingItemLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 13,
    fontWeight: '400',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingBgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 0,
  },
  cloudWrapper: {
    position: 'absolute',
  },
  cloudPatch1: {
    width: 350,
    height: 350,
    borderRadius: 175,
    opacity: 0.25,
    overflow: 'hidden',
  },
  cloudPatch2: {
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.22,
    overflow: 'hidden',
  },
  lightSpot1: {
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.2,
    overflow: 'hidden',
  },
});

export default GeneralSettings;
