import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const backgroundElementsAnim = useRef(new Animated.Value(0)).current;

  const handleFinish = useCallback(() => {
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    // Start animations
    Animated.sequence([
      // Background elements fade in
      Animated.timing(backgroundElementsAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      // Logo animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Wait a bit then finish
      const timeout = setTimeout(() => {
        handleFinish();
      }, 1500);
      
      return () => clearTimeout(timeout);
    });
  }, [backgroundElementsAnim, fadeAnim, scaleAnim, handleFinish]);



  return (
    <SafeAreaView style={styles.container}>
      {/* Background decorative elements */}
      <Animated.View 
        style={[
          styles.backgroundElements,
          { opacity: backgroundElementsAnim }
        ]}
      >
        {/* Top left geometric shapes */}
        <View style={[styles.decorativeShape, styles.topLeft]}>
          <Svg width="120" height="120" viewBox="0 0 120 120">
            <Defs>
              <LinearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#E8F4FD" stopOpacity="0.6" />
                <Stop offset="100%" stopColor="#B8E0FF" stopOpacity="0.3" />
              </LinearGradient>
            </Defs>
            <Path
              d="M20 20 L80 20 Q100 20 100 40 L100 80 Q100 100 80 100 L40 100 Q20 100 20 80 Z"
              fill="url(#grad1)"
            />
          </Svg>
        </View>

        {/* Bottom right geometric shapes */}
        <View style={[styles.decorativeShape, styles.bottomRight]}>
          <Svg width="100" height="100" viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#E1F5FE" stopOpacity="0.4" />
                <Stop offset="100%" stopColor="#81D4FA" stopOpacity="0.2" />
              </LinearGradient>
            </Defs>
            <Circle cx="30" cy="30" r="25" fill="url(#grad2)" />
            <Circle cx="70" cy="70" r="20" fill="url(#grad2)" />
          </Svg>
        </View>

        {/* Middle left accent */}
        <View style={[styles.decorativeShape, styles.middleLeft]}>
          <Svg width="80" height="150" viewBox="0 0 80 150">
            <Defs>
              <LinearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#F0F9FF" stopOpacity="0.5" />
                <Stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.2" />
              </LinearGradient>
            </Defs>
            <Path
              d="M10 20 Q30 10 50 20 Q70 30 60 50 Q50 70 30 60 Q10 50 10 30 Z"
              fill="url(#grad3)"
            />
          </Svg>
        </View>

        {/* Top right small elements */}
        <View style={[styles.decorativeShape, styles.topRight]}>
          <Svg width="60" height="60" viewBox="0 0 60 60">
            <Defs>
              <LinearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#E3F2FD" stopOpacity="0.6" />
                <Stop offset="100%" stopColor="#90CAF9" stopOpacity="0.3" />
              </LinearGradient>
            </Defs>
            <Path
              d="M15 15 L45 15 L30 45 Z"
              fill="url(#grad4)"
            />
          </Svg>
        </View>
      </Animated.View>

      {/* Main logo container */}
      <Animated.View 
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        <Image 
          source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/sxgkwkx03y0dzrrkc8aoa' }}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* App name */}
      <Animated.View 
        style={[
          styles.textContainer,
          { opacity: fadeAnim }
        ]}
      >
        <Text style={styles.appName}>LOGME</Text>
      </Animated.View>

      {/* Developer credit */}
      <Animated.View 
        style={[
          styles.creditContainer,
          { opacity: fadeAnim }
        ]}
      >
        <Text style={styles.creditText}>developed by cubiq-solutions.com</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f1f20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorativeShape: {
    position: 'absolute',
  },
  topLeft: {
    top: '10%',
    left: -20,
  },
  topRight: {
    top: '15%',
    right: 20,
  },
  middleLeft: {
    top: '40%',
    left: -10,
  },
  bottomRight: {
    bottom: '20%',
    right: -10,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoImage: {
    width: 200,
    height: 200,
  },
  textContainer: {
    marginBottom: 40,
  },
  appName: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 4,
    textAlign: 'center',
  },
  creditContainer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  creditText: {
    fontSize: 12,
    color: '#CCCCCC',
    fontWeight: '400',
    textAlign: 'center',
  },
});