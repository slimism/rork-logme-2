import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/constants/colors';
import { useTokenStore } from '@/store/subscriptionStore';
import { useThemeStore } from '@/store/themeStore';

interface TopBarProps {
  showCredits?: boolean;
}

export function TopBar({ showCredits = true }: TopBarProps) {
  const { tokens } = useTokenStore();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { darkMode } = useThemeStore();

  const styles = createStyles(colors);
  const logoSource = darkMode 
    ? require('../assets/images/logo-dark.png') 
    : require('../assets/images/logo-light.png');

  console.log('[TopBar] Rendering with darkMode:', darkMode);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.leftSection}>
        <Image 
          key={darkMode ? 'dark' : 'light'}
          source={logoSource}
          style={styles.appLogo}
          resizeMode="contain"
        />
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
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appLogo: {
    width: 62,
    height: 62,
    marginRight: 12,
    backgroundColor: 'transparent',
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