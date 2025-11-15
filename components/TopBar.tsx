import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/constants/colors';
import { useTokenStore } from '@/store/subscriptionStore';
import { useThemeStore } from '@/store/themeStore';
import { Asset } from 'expo-asset';

const logoLight = Asset.fromModule(require('../assets/images/logo-light.png')).uri;
const logoDark = Asset.fromModule(require('../assets/images/logo-dark.png')).uri;

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

  console.log('[TopBar] Rendering with darkMode:', darkMode);
  console.log('[TopBar] Logo source URI:', logoSource);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.leftSection}>
        <Image 
          key={darkMode ? 'dark' : 'light'}
          source={{ uri: logoSource }}
          style={styles.appLogo}
          onError={(error) => {
            console.log('[TopBar] Image load error:', error.nativeEvent?.error);
            console.log('[TopBar] Attempting to load:', darkMode ? 'logo-dark.png' : 'logo-light.png');
            console.log('[TopBar] Logo source URI:', logoSource);
          }}
          onLoad={() => {
            console.log('[TopBar] Image loaded successfully:', darkMode ? 'logo-dark.png' : 'logo-light.png');
          }}
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