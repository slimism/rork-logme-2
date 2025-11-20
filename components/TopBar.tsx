import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/constants/colors';
import { useTokenStore } from '@/store/subscriptionStore';
import { useThemeStore } from '@/store/themeStore';

const logoLight = require('../assets/images/logo-light.png');
const logoDark = require('../assets/images/logo-dark.png');

interface TopBarProps {
  showCredits?: boolean;
}

export function TopBar({ showCredits = true }: TopBarProps) {
  const { tokens } = useTokenStore();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { darkMode } = useThemeStore();

  const styles = createStyles(colors);
  const logoSource = darkMode ? logoDark : logoLight;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.leftSection}>
        <View style={styles.logoContainer}>
          <Image 
            source={logoSource}
            style={styles.appLogo}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
            onLoad={() => console.log('[TopBar] Logo loaded successfully:', darkMode ? 'dark' : 'light')}
            onError={(error) => console.error('[TopBar] Image load error:', error)}
          />
        </View>
        <Text style={styles.appTitle}>LogMe</Text>
      </View>
      
      {showCredits && (
        <View style={styles.creditsContainer}>
          <Text style={styles.creditsLabel}>Remaining Credits</Text>
          <Text style={styles.creditsNumber}>{tokens}</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 60,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 62,
    height: 62,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  appLogo: {
    width: '100%',
    height: '100%',
    maxWidth: 62,
    maxHeight: 62,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  creditsContainer: {
    alignItems: 'flex-end',
  },
  creditsLabel: {
    fontSize: 12,
    color: colors.subtext,
    marginBottom: 2,
  },
  creditsNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
