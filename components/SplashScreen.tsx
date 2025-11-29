import React, { useEffect, useRef, useCallback } from 'react';
import { Text, StyleSheet, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const handleFinish = useCallback(() => {
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    // Start animations
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
    ]).start(() => {
      // Wait a bit then finish
      const timeout = setTimeout(() => {
        handleFinish();
      }, 1500);
      
      return () => clearTimeout(timeout);
    });
  }, [fadeAnim, scaleAnim, handleFinish]);



  return (
    <SafeAreaView style={styles.container}>
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

      {/* Developer credit */}
      <Animated.View 
        style={[
          styles.creditContainer,
          { opacity: fadeAnim }
        ]}
      >
        <Text style={styles.creditText}>developed by cubiq-solutions</Text>
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
  logoContainer: {
    marginBottom: 20,
  },
  logoImage: {
    width: 200,
    height: 200,
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