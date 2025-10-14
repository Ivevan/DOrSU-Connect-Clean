import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated, InteractionManager } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

interface AdminBottomNavBarProps {
  onDashboardPress?: () => void;
  onChatPress?: () => void;
  onAddPress?: () => void;
  onCalendarPress?: () => void;
  onSettingsPress?: () => void;
  onPostUpdatePress?: () => void;
  onManagePostPress?: () => void;
  activeTab?: 'dashboard' | 'chat' | 'add' | 'calendar' | 'settings';
}

const AdminBottomNavBar: React.FC<AdminBottomNavBarProps> = ({
  onDashboardPress,
  onChatPress,
  onAddPress,
  onCalendarPress,
  onSettingsPress,
  onPostUpdatePress,
  onManagePostPress,
  activeTab = 'dashboard',
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const isAnimatingRef = useRef(false);
  
  // Use useRef to persist Animated.Value objects and prevent recreation
  const pulseAnimRef = useRef<Animated.Value | null>(null);
  const expandAnimRef = useRef<Animated.Value | null>(null);
  const waveAnim1Ref = useRef<Animated.Value | null>(null);
  const waveAnim2Ref = useRef<Animated.Value | null>(null);
  const waveAnim3Ref = useRef<Animated.Value | null>(null);
  const rotateAnimRef = useRef<Animated.Value | null>(null);
  
  // Initialize Animated.Value objects only once
  if (!pulseAnimRef.current) {
    pulseAnimRef.current = new Animated.Value(1);
  }
  if (!expandAnimRef.current) {
    expandAnimRef.current = new Animated.Value(0);
  }
  if (!waveAnim1Ref.current) {
    waveAnim1Ref.current = new Animated.Value(0);
  }
  if (!waveAnim2Ref.current) {
    waveAnim2Ref.current = new Animated.Value(0);
  }
  if (!waveAnim3Ref.current) {
    waveAnim3Ref.current = new Animated.Value(0);
  }
  if (!rotateAnimRef.current) {
    rotateAnimRef.current = new Animated.Value(0);
  }
  
  const pulseAnim = pulseAnimRef.current!;
  const expandAnim = expandAnimRef.current!;
  const waveAnim1 = waveAnim1Ref.current!;
  const waveAnim2 = waveAnim2Ref.current!;
  const waveAnim3 = waveAnim3Ref.current!;
  const rotateAnim = rotateAnimRef.current!;

  useEffect(() => {
    // Only start animation if component is mounted
    let isMounted = true;
    
    const startPulseWithWaves = () => {
      if (!isMounted) return;
      
      // Main pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );

      // Wave animations with staggered timing
      const wave1Animation = Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim1, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim1, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

      const wave2Animation = Animated.loop(
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(waveAnim2, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim2, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

      const wave3Animation = Animated.loop(
        Animated.sequence([
          Animated.delay(1000),
          Animated.timing(waveAnim3, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim3, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      
      pulseAnimation.start();
      wave1Animation.start();
      wave2Animation.start();
      wave3Animation.start();
      
      return { pulseAnimation, wave1Animation, wave2Animation, wave3Animation };
    };

    const animations = startPulseWithWaves();

    return () => {
      isMounted = false;
      if (animations) {
        animations.pulseAnimation.stop();
        animations.wave1Animation.stop();
        animations.wave2Animation.stop();
        animations.wave3Animation.stop();
      }
    };
  }, []); // Empty dependency array to run only once

  const handleAddPress = () => {
    // Prevent rapid tapping during animation using both state and ref
    if (isAnimating || isAnimatingRef.current) {
      return;
    }

    console.log('ADD button pressed, isExpanded:', isExpanded);
    setIsAnimating(true);
    isAnimatingRef.current = true;

    if (isExpanded) {
      // Collapse and rotate back
      Animated.parallel([
        Animated.timing(expandAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsExpanded(false);
        setIsRotated(false);
        setIsAnimating(false);
        isAnimatingRef.current = false;
      });
    } else {
      // Expand and rotate
      setIsExpanded(true);
      setIsRotated(true);
      Animated.parallel([
        Animated.timing(expandAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsAnimating(false);
        isAnimatingRef.current = false;
      });
    }
    
    if (onAddPress) {
      onAddPress();
    }
  };

  const handlePostUpdatePress = () => {
    // Prevent rapid tapping during animation using both state and ref
    if (isAnimating || isAnimatingRef.current) {
      return;
    }
    
    console.log('PostUpdate icon pressed!');
    console.log('onPostUpdatePress function:', onPostUpdatePress);
    
    // Immediately collapse menu and navigate without animation
    setIsExpanded(false);
    setIsRotated(false);
    setIsAnimating(true);
    isAnimatingRef.current = true;
    
    // Reset animation state immediately
    setIsAnimating(false);
    isAnimatingRef.current = false;
    
    // Call navigation immediately
    if (onPostUpdatePress) {
      console.log('Calling onPostUpdatePress function');
      onPostUpdatePress();
    } else {
      console.log('onPostUpdatePress is undefined!');
    }
  };

  const handleManagePostPress = () => {
    // Prevent rapid tapping during animation using both state and ref
    if (isAnimating || isAnimatingRef.current) {
      return;
    }
    
    console.log('ManagePost icon pressed!');
    console.log('onManagePostPress function:', onManagePostPress);
    
    // Immediately collapse menu and navigate without animation
    setIsExpanded(false);
    setIsRotated(false);
    setIsAnimating(true);
    isAnimatingRef.current = true;
    
    // Reset animation state immediately
    setIsAnimating(false);
    isAnimatingRef.current = false;
    
    // Call navigation immediately
    if (onManagePostPress) {
      console.log('Calling onManagePostPress function');
      onManagePostPress();
    } else {
      console.log('onManagePostPress is undefined!');
    }
  };

  return (
    <View style={[
      styles.container, 
      { 
        paddingBottom: insets.bottom,
        backgroundColor: theme.colors.tabBar,
        borderTopColor: theme.colors.tabBarBorder,
        ...theme.navBarShadow
      }
    ]} collapsable={false}>
      <View style={[styles.backgroundLayer, { bottom: -insets.bottom, backgroundColor: theme.colors.tabBar }]} pointerEvents="none" />
      <TouchableOpacity style={styles.tab} onPress={onDashboardPress}>
        <Ionicons name="home-outline" size={24} color={activeTab === 'dashboard' ? theme.colors.iconActive : theme.colors.icon} />
        <Text style={[styles.label, { color: theme.colors.icon }, activeTab === 'dashboard' && { color: theme.colors.iconActive, fontWeight: '600' }]}>Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={onChatPress}>
        <Ionicons name="chatbubbles-outline" size={24} color={activeTab === 'chat' ? theme.colors.iconActive : theme.colors.icon} />
        <Text style={[styles.label, { color: theme.colors.icon }, activeTab === 'chat' && { color: theme.colors.iconActive, fontWeight: '600' }]}>AI Chat</Text>
      </TouchableOpacity>

      {/* Floating Action Button with Pulse Animation */}
      <View style={[styles.centerBtnContainer, { marginHorizontal: 8, marginTop: -24 }]}>
        {/* Hover Circle Icons */}
        {isExpanded && (
          <>
            <Animated.View 
              style={[
                styles.hoverCircle,
                styles.postUpdateCircle,
                {
                  transform: [
                    { 
                      translateY: expandAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -20]
                      })
                    }
                  ],
                  opacity: expandAnim
                }
              ]}
            >
              <TouchableOpacity onPress={handlePostUpdatePress} style={[styles.hoverCircleBtn, { backgroundColor: theme.colors.primary }]}> 
                <MaterialIcons name="post-add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View 
              style={[
                styles.hoverCircle,
                styles.managePostCircle,
                {
                  transform: [
                    { 
                      translateY: expandAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -20]
                      })
                    }
                  ],
                  opacity: expandAnim
                }
              ]}
            >
              <TouchableOpacity onPress={handleManagePostPress} style={[styles.hoverCircleBtn, { backgroundColor: theme.colors.primary }]}> 
                <MaterialIcons name="manage-accounts" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        {/* Wave Effects */}
        <Animated.View
          style={[
            styles.wave,
            {
              backgroundColor: theme.colors.primary,
              transform: [
                { 
                  scale: waveAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.8]
                  })
                }
              ],
              opacity: waveAnim1.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0.6, 0.3, 0]
              })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.wave,
            {
              backgroundColor: theme.colors.accent,
              transform: [
                { 
                  scale: waveAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.8]
                  })
                }
              ],
              opacity: waveAnim2.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0.6, 0.3, 0]
              })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.wave,
            {
              backgroundColor: theme.colors.accent,
              transform: [
                { 
                  scale: waveAnim3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.8]
                  })
                }
              ],
              opacity: waveAnim3.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0.6, 0.3, 0]
              })
            }
          ]}
        />

        {/* Main Add Button with Echo Animation */}
        <Animated.View
          style={[
            styles.centerBtn,
            {
              transform: [
                { scale: pulseAnim },
                { 
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '45deg']
                  })
                }
              ]
            }
          ]}
        >
          <TouchableOpacity style={[styles.centerBtnInner, { backgroundColor: theme.colors.primary }]} onPress={handleAddPress}>
            <MaterialIcons 
              name="add" 
              size={28} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <TouchableOpacity style={styles.tab} onPress={onCalendarPress}>
        <Ionicons name="calendar-outline" size={24} color={activeTab === 'calendar' ? theme.colors.iconActive : theme.colors.icon} />
        <Text style={[styles.label, { color: theme.colors.icon }, activeTab === 'calendar' && { color: theme.colors.iconActive, fontWeight: '600' }]}>Calendar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={onSettingsPress}>
        <Ionicons name="settings-outline" size={24} color={activeTab === 'settings' ? theme.colors.iconActive : theme.colors.icon} />
        <Text style={[styles.label, { color: theme.colors.icon }, activeTab === 'settings' && { color: theme.colors.iconActive, fontWeight: '600' }]}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    position: 'relative',
  },
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  centerBtnContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
  },
  wave: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    opacity: 0.6,
    top: 0,
    left: 0,
  },
  centerBtn: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    top: 0,
    left: 0,
  },
  centerBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoverCircle: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  postUpdateCircle: {
    left: -25,
  },
  managePostCircle: {
    right: -25,
  },
  hoverCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdminBottomNavBar;
