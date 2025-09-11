import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useSubscriptionStore } from '@/store/subscriptionStore';

export const ProBadge: React.FC = () => {
  const { isPro } = useSubscriptionStore();

  if (!isPro) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Crown size={14} color={colors.warning} />
      <Text style={styles.text}>PRO</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.warning,
  },
});