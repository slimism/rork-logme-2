import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/constants/colors';
import { useTokenStore } from '@/store/subscriptionStore';

const logo = require('../assets/images/logo-light.png');

interface TopBarProps {
  showCredits?: boolean;
}

export function TopBar({ showCredits = true }: TopBarProps) {
  const { tokens } = useTokenStore();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const styles = createStyles(colors);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.leftSection}>
        <Image 
          source={logo}
          style={styles.appLogo} 
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