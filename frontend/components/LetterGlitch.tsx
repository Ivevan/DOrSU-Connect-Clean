import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';

const { width, height } = Dimensions.get('window');

interface LetterGlitchProps {
  glitchColors?: string[];
  glitchSpeed?: number;
  centerVignette?: boolean;
  outerVignette?: boolean;
  smooth?: boolean;
  characters?: string;
}

const LetterGlitch: React.FC<LetterGlitchProps> = ({
  glitchColors = ['#2b4539', '#61dca3', '#61b3dc'],
  glitchSpeed = 50,
  centerVignette = false,
  outerVignette = true,
  smooth = true,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789'
}) => {
  const glitchAnimation = useRef(new Animated.Value(0)).current;
  const [currentLetters, setCurrentLetters] = React.useState<string[]>([]);
  const [currentColors, setCurrentColors] = React.useState<string[]>([]);
  
  const lettersAndSymbols = Array.from(characters);
  const fontSize = 10;
  const charWidth = 6;
  const charHeight = 12;
  
  // Calculate grid to cover full screen
  const columns = Math.ceil(width / charWidth);
  const rows = Math.ceil(height / charHeight);
  const totalLetters = columns * rows;

  const getRandomChar = () => {
    return lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)];
  };

  const getRandomColor = () => {
    return glitchColors[Math.floor(Math.random() * glitchColors.length)];
  };

  const updateLetters = () => {
    const newLetters: string[] = [];
    const newColors: string[] = [];
    
    for (let i = 0; i < totalLetters; i++) {
      newLetters.push(getRandomChar());
      newColors.push(getRandomColor());
    }
    
    setCurrentLetters(newLetters);
    setCurrentColors(newColors);
  };

  useEffect(() => {
    // Initial setup
    updateLetters();
    
    // Start glitch animation
    const startAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glitchAnimation, {
            toValue: 1,
            duration: glitchSpeed,
            useNativeDriver: true,
          }),
          Animated.timing(glitchAnimation, {
            toValue: 0,
            duration: glitchSpeed,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    
    startAnimation();
    
    // Update letters periodically
    const interval = setInterval(() => {
      updateLetters();
    }, glitchSpeed * 2);
    
    return () => clearInterval(interval);
  }, [glitchSpeed]);

  const animatedStyle = {
    opacity: glitchAnimation.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.3, 0.8, 0.3],
    }),
  };

  const renderLetters = () => {
    const letterElements = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        if (index < currentLetters.length) {
          letterElements.push(
            <Text
              key={`${row}-${col}`}
              style={[
                styles.letter,
                {
                  position: 'absolute',
                  left: col * charWidth,
                  top: row * charHeight,
                  color: currentColors[index] || glitchColors[0],
                  fontSize,
                },
              ]}
            >
              {currentLetters[index]}
            </Text>
          );
        }
      }
    }
    
    return letterElements;
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.letterContainer, animatedStyle]}>
        {renderLetters()}
      </Animated.View>
      
      {outerVignette && <View style={styles.outerVignette} />}
      {centerVignette && <View style={styles.centerVignette} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  letterContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  letter: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  outerVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 100,
    elevation: 10,
  },
  centerVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
    elevation: 5,
  },
});

export default LetterGlitch;
