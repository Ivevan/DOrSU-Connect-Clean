import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'GetStarted'>;

const { width, height } = Dimensions.get('window');

const GetStarted = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}
    >
      <StatusBar
        backgroundColor="transparent"
        barStyle="dark-content"
        translucent={true}
      />
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.topSection}>
          <View style={styles.logoPlaceholder} />
          <Text style={styles.title}>DOrSU CONNECT</Text>
          <Text style={styles.subtitle}>Your Academic AI Assistant</Text>
          <Text style={styles.aiText}>AI Powered</Text>
        </View>

        {/* Bottom Section with Buttons and University Name */}
        <View style={styles.bottomSection}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.emailButton} onPress={() => {}}>
              <MaterialCommunityIcons name="email-outline" size={24} color="black" style={styles.buttonIcon} />
              <Text style={styles.emailButtonText}>Continue with Email</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.darkButton} 
              onPress={() => navigation.navigate('CreateAccount')}
            >
              <MaterialIcons name="person-add-alt" size={24} color="white" style={styles.buttonIcon} />
              <Text style={styles.darkButtonText}>Sign up</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.darkButton} 
              onPress={() => navigation.navigate('SignIn')}
            >
              <MaterialIcons name="login" size={24} color="white" style={styles.buttonIcon} />
              <Text style={styles.darkButtonText}>Log in</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.darkButton} 
              onPress={() => navigation.navigate('AdminDashboard')}
            >
              <MaterialCommunityIcons name="shield-account" size={24} color="white" style={styles.buttonIcon} />
              <Text style={styles.darkButtonText}>Admin (Temp)</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.universityText}>Davao Oriental State University</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing(2.5),
    paddingTop: Platform.OS === 'android' ? theme.spacing(1) : theme.spacing(5.5),
    paddingBottom: Platform.OS === 'android' ? theme.spacing(2.5) : theme.spacing(4.25),
  },
  topSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginTop: -height * 0.1, // Adjust for better centering
  },
  logoPlaceholder: {
    width: width * 0.35,
    height: width * 0.35,
    backgroundColor: theme.colors.border,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing(2.5),
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing(1),
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: theme.spacing(0.5),
  },
  aiText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  bottomSection: {
    width: '100%',
  },
  buttonContainer: {
    width: '100%',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(3),
  },
  emailButton: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    ...theme.shadow1,
  },
  emailButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: theme.spacing(1),
  },
  darkButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    ...theme.shadow1,
  },
  darkButtonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: theme.spacing(1),
  },
  buttonIcon: {
    marginRight: theme.spacing(0.5),
  },
  universityText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});

export default GetStarted; 