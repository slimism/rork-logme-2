import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Coins, Star, Package, Crown } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useTokenStore } from '@/store/subscriptionStore';
import { iapService, IAPProduct } from '@/services/iapService';

interface TokenPackage extends IAPProduct {
  originalPrice?: string;
  popular?: boolean;
  savings?: string;
}

export default function Store() {
  const { tokens, addTokens, getRemainingTrialLogs } = useTokenStore();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [products, setProducts] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const iapProducts = await iapService.getProducts();
      const tokenPackages: TokenPackage[] = iapProducts.map((product, index) => ({
        ...product,
        originalPrice: index === 1 ? '$27.96' : index === 2 ? '$69.90' : undefined,
        popular: index === 1,
        savings: index === 1 ? 'Save $2.97' : index === 2 ? 'Save $19.91' : undefined,
      }));
      setProducts(tokenPackages);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageItem: TokenPackage) => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Purchase Not Available',
        'In-app purchases are not available on web. Please use the mobile app to purchase tokens.',
        [{ text: 'OK' }]
      );
      return;
    }

    setPurchasing(packageItem.productId);
    
    try {
      const result = await iapService.purchaseProduct(packageItem.productId);
      
      if (result.success) {
        addTokens(packageItem.tokens);
        
        Alert.alert(
          'Purchase Successful!',
          `You have successfully purchased ${packageItem.tokens} token${packageItem.tokens > 1 ? 's' : ''}. You now have ${tokens + packageItem.tokens} tokens available.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Purchase Failed',
          result.error || 'There was an error processing your purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Purchase Failed',
        'There was an error processing your purchase. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestorePurchases = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Restore Not Available',
        'Purchase restoration is not available on web.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const restoredPurchases = await iapService.restorePurchases();
      
      if (restoredPurchases.length > 0) {
        let totalTokens = 0;
        restoredPurchases.forEach(purchase => {
          if (purchase.success && purchase.productId) {
            totalTokens += iapService.getTokensForProduct(purchase.productId);
          }
        });
        
        if (totalTokens > 0) {
          addTokens(totalTokens);
          Alert.alert(
            'Purchases Restored',
            `Successfully restored ${totalTokens} tokens from previous purchases.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases were found to restore.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Restore Failed',
        'Failed to restore purchases. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderTokenPackage = (packageItem: TokenPackage) => (
    <View key={packageItem.productId} style={[styles.packageCard, packageItem.popular && styles.popularCard]}>
      {packageItem.popular && (
        <View style={styles.popularBadge}>
          <Star size={12} color="white" />
          <Text style={styles.popularText}>Most Popular</Text>
        </View>
      )}
      
      <View style={styles.packageHeader}>
        <View style={styles.tokenInfo}>
          <Coins size={24} color={colors.primary} />
          <Text style={styles.tokenCount}>{packageItem.tokens}</Text>
          <Text style={styles.tokenLabel}>Token{packageItem.tokens > 1 ? 's' : ''}</Text>
        </View>
        
        <View style={styles.priceInfo}>
          <Text style={styles.price}>{packageItem.price}</Text>
          {packageItem.originalPrice && (
            <Text style={styles.originalPrice}>{packageItem.originalPrice}</Text>
          )}
          {packageItem.savings && (
            <Text style={styles.savings}>{packageItem.savings}</Text>
          )}
        </View>
      </View>
      
      <Text style={styles.packageDescription}>
        Each token grants full access to one project with unlimited logs
      </Text>
      
      <TouchableOpacity
        style={[
          styles.purchaseButton,
          packageItem.popular && styles.popularButton,
          purchasing === packageItem.productId && styles.purchasingButton
        ]}
        onPress={() => handlePurchase(packageItem)}
        disabled={purchasing !== null}
      >
        <Text style={[
          styles.purchaseButtonText,
          packageItem.popular && styles.popularButtonText
        ]}>
          {purchasing === packageItem.productId ? 'Processing...' : 'Purchase'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Crown size={32} color={colors.primary} />
        <Text style={styles.title}>Token Store</Text>
        <Text style={styles.subtitle}>
          Purchase tokens to unlock unlimited projects
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Coins size={20} color={colors.primary} />
            <Text style={styles.statusLabel}>Your Tokens</Text>
            <Text style={styles.statusValue}>{tokens}</Text>
          </View>
          
          <View style={styles.statusDivider} />
          
          <View style={styles.statusItem}>
            <Package size={20} color={colors.secondary} />
            <Text style={styles.statusLabel}>Trial Logs Left</Text>
            <Text style={styles.statusValue}>{getRemainingTrialLogs()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How Tokens Work</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoBullet}>•</Text>
          <Text style={styles.infoText}>Each token unlocks one project with unlimited logs</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoBullet}>•</Text>
          <Text style={styles.infoText}>Free trial includes 15 logs across all projects</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoBullet}>•</Text>
          <Text style={styles.infoText}>Tokens never expire and can be used anytime</Text>
        </View>
      </View>

      <View style={styles.packagesContainer}>
        <Text style={styles.packagesTitle}>Choose Your Package</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : (
          products.map(renderTokenPackage)
        )}
      </View>

      {Platform.OS !== 'web' && (
        <TouchableOpacity style={styles.restoreButton} onPress={handleRestorePurchases}>
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Secure payments processed through the App Store
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  statusDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
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
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  packagesContainer: {
    marginBottom: 24,
  },
  packagesTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  packageCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  popularCard: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  popularText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 8,
  },
  tokenLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  originalPrice: {
    fontSize: 14,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  savings: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
  packageDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  purchaseButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  popularButton: {
    backgroundColor: colors.primary,
  },
  purchasingButton: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  popularButtonText: {
    color: 'white',
  },
  restoreButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  restoreButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});