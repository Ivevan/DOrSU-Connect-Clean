import { StyleSheet, Text, View, TextInput, TouchableOpacity, Dimensions, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';

type RootStackParamList = {
  GetStarted: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  SchoolUpdates: undefined; // Added new screen
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

const { width } = Dimensions.get('window');

const SignIn = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleClose = () => {
    navigation.navigate('GetStarted');
  };

  // Function to handle sign in button press
  const handleSignIn = () => {
    navigation.navigate('SchoolUpdates');
  };

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
        {/* Logo and Title Section */}
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoPlaceholder}>
              {/* Logo will be placed here */}
            </View>
            <Text style={styles.title}>DOrSU Connect</Text>
            <Text style={styles.subtitle}>Your Academic AI Assistant</Text>
          </View>

          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.signInText}>Sign in to continue</Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#666"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#666"
              secureTextEntry
            />
            <TouchableOpacity 
              style={styles.forgotPassword}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.signInButton}
            onPress={handleSignIn}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('CreateAccount')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
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
    marginTop: theme.spacing(2.5),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing(5),
  },
  logoPlaceholder: {
    width: width * 0.2,
    height: width * 0.2,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing(2),
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: theme.spacing(5),
    marginTop: theme.spacing(2.5),
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  signInText: {
    fontSize: 17,
    color: theme.colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: theme.spacing(3),
  },
  input: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(2),
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing(2),
    fontSize: 16,
    ...theme.shadow1,
    fontWeight: '500',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    ...theme.shadow1,
  },
  signInButtonText: {
    color: theme.colors.surface,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  signUpLink: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default SignIn; 