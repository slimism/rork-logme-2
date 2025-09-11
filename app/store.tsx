import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { ArrowLeft, ShoppingCart, Coins } from 'lucide-react-native';
import { useTokenStore } from '@/store/subscriptionStore';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';

interface TokenPackage {
  id: string;
  tokens: number;
  price: string;
  popular?: boolean;
}

const tokenPackages: TokenPackage[] = [
  {
    id: 'single',
    tokens: 1,
    price: '$6.99',
  },
  {
    id: 'pack4',
    tokens: 4,
    price: '$24.99',
    popular: true,
  },
  {
    id: 'pack10',
    tokens: 10,
    price: '$49.99',
  },
];

export default function StoreScreen() {
  const { tokens, addTokens, getRemainingTrialLogs } = useTokenStore();
  const remainingTrialLogs = getRemainingTrialLogs();

  const handlePurchase = (tokenPackage: TokenPackage) => {
    // In a real app, this would integrate with app store purchases
    Alert.alert(
      'Purchase Tokens',
      `Purchase ${tokenPackage.tokens} token${tokenPackage.tokens > 1 ? 's' : ''} for ${tokenPackage.price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: () => {
            addTokens(tokenPackage.tokens);
            Alert.alert(
              'Purchase Successful!',
              `You now have ${tokens + tokenPackage.tokens} tokens available.`,
              [{ text: 'OK', onPress: () => router.back() }]
            );
          },
        },
      ]
    );
  };

  const HeaderLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
      <ArrowLeft size={24} color={colors.text} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: "Token Store",
          headerLeft: () => <HeaderLeft />,
          headerBackVisible: false,
        }} 
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Coins size={48} color={colors.primary} />
          <Text style={styles.title}>Project Tokens</Text>
          <Text style={styles.subtitle}>
            Each token grants you full access to create and manage one complete project with unlimited logs.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Available Tokens:</Text>
            <Text style={styles.statusValue}>{tokens}</Text>
          </View>
          {remainingTrialLogs > 0 && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Trial Logs Remaining:</Text>
              <Text style={styles.statusValue}>{remainingTrialLogs}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Token Packages</Text>
          <Text style={styles.sectionSubtitle}>
            Choose the package that best fits your production needs.
          </Text>
          
          {tokenPackages.map((tokenPackage) => (
            <View key={tokenPackage.id} style={[
              styles.packageCard,
              tokenPackage.popular && styles.popularPackage
            ]}>
              {tokenPackage.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>Most Popular</Text>
                </View>
              )}
              
              <View style={styles.packageHeader}>
                <View style={styles.packageInfo}>
                  <Text style={styles.packageTokens}>
                    {tokenPackage.tokens} Token{tokenPackage.tokens > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.packagePrice}>{tokenPackage.price}</Text>
                </View>
                <Button
                  title="Purchase"
                  onPress={() => handlePurchase(tokenPackage)}
                  style={[
                    styles.purchaseButton,
                    tokenPackage.popular && styles.popularButton
                  ]}
                  icon={<ShoppingCart size={16} color="white" />}
                />
              </View>
              
              <Text style={styles.packageDescription}>
                {tokenPackage.tokens === 1 
                  ? 'Perfect for single project needs'
                  : tokenPackage.tokens === 4
                  ? 'Great for small productions or series'
                  : 'Ideal for large productions and studios'
                }
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How Tokens Work</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              Each token allows you to create one complete project
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              Once used, you have unlimited logs for that project
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              Tokens never expire and can be used anytime
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              New users get 15 free trial logs to test the app
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  content: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  statusCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: colors.text,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: 20,
    lineHeight: 20,
  },
  packageCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    position: 'relative',
  },
  popularPackage: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primary + '05',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  packageInfo: {
    flex: 1,
  },
  packageTokens: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 4,
  },
  purchaseButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  popularButton: {
    backgroundColor: colors.primary,
  },
  packageDescription: {
    fontSize: 14,
    color: colors.subtext,
    lineHeight: 18,
  },
  infoSection: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoBullet: {
    fontSize: 16,
    color: colors.primary,
    marginRight: 8,
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    color: colors.subtext,
    flex: 1,
    lineHeight: 20,
  },
});