import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

interface OrientationGuardProps {
  children: React.ReactNode;
}

const OrientationGuardComponent: React.FC<OrientationGuardProps> = ({ children }) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const showBlocker = useMemo(() => {
    const shouldBlock = Platform.OS === 'web' && isLandscape;
    console.log('[OrientationGuard] width:', width, 'height:', height, 'isLandscape:', isLandscape, 'showBlocker:', shouldBlock);
    return shouldBlock;
  }, [width, height, isLandscape]);

  if (showBlocker) {
    return (
      <View style={styles.blocker} testID="orientation-blocker">
        <View style={styles.blockerCard}>
          <Text style={styles.title} testID="orientation-title">Portrait mode only</Text>
          <Text style={styles.subtitle} testID="orientation-subtitle">Please rotate your device back to portrait to continue.</Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

export const OrientationGuard = memo(OrientationGuardComponent);

const styles = StyleSheet.create({
  blocker: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)'
  },
  blockerCard: {
    width: 320,
    maxWidth: 360,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#F9FAFB',
    marginBottom: 6,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: '#D1D5DB',
    textAlign: 'center'
  }
});
