import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../config/theme';

const ThemeTestComponent = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const theme = getTheme(isDarkMode);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Dark Mode Test Component
      </Text>
      
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          Current Theme: {isDarkMode ? 'Dark' : 'Light'}
        </Text>
        
        <Text style={[styles.description, { color: theme.colors.textMuted }]}>
          This component demonstrates the dark mode implementation. 
          All colors are dynamically applied based on the current theme.
        </Text>
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.colors.accent }]}
          onPress={toggleTheme}
        >
          <Text style={[styles.buttonText, { color: theme.colors.surface }]}>
            Toggle Theme
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={[styles.colorPalette, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.paletteTitle, { color: theme.colors.text }]}>
          Color Palette
        </Text>
        
        <View style={styles.colorRow}>
          <View style={[styles.colorBox, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.colorLabel, { color: theme.colors.surface }]}>Primary</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: theme.colors.accent }]}>
            <Text style={[styles.colorLabel, { color: theme.colors.surface }]}>Accent</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: theme.colors.success }]}>
            <Text style={[styles.colorLabel, { color: theme.colors.surface }]}>Success</Text>
          </View>
        </View>
        
        <View style={styles.colorRow}>
          <View style={[styles.colorBox, { backgroundColor: theme.colors.warning }]}>
            <Text style={[styles.colorLabel, { color: theme.colors.surface }]}>Warning</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: theme.colors.danger }]}>
            <Text style={[styles.colorLabel, { color: theme.colors.surface }]}>Danger</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: theme.colors.chipBg }]}>
            <Text style={[styles.colorLabel, { color: theme.colors.text }]}>Chip</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 15,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  colorPalette: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paletteTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  colorBox: {
    width: 80,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ThemeTestComponent;

