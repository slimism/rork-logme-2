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
import { ChevronLeft, Calendar, Hourglass, Infinity } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useTokenStore } from '@/store/subscriptionStore';
import { iapService, IAPProduct } from '@/services/iapService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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



  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton}>
          <ChevronLeft size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        {/* Status Cards */}
        <View style={[styles.statusCard, styles.firstStatusCard]}>
          <Text style={styles.statusLabel}>Remaining Credits</Text>
          <Text style={styles.statusValue}>{tokens}</Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Trial Logs left</Text>
          <Text style={styles.statusValue}>{getRemainingTrialLogs()}</Text>
        </View>

        {/* How Credits Work */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>How Credits Work</Text>
          
          <View style={styles.infoItem}>
            <Calendar size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>Each token unlocks one project with unlimited logs.</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Hourglass size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>Free trial includes 15 logs across all projects.</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Infinity size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>Credits never expire and can be used anytime.</Text>
          </View>
        </View>

        {/* Purchase Credits */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Purchase Credits</Text>
          
          <View style={styles.purchaseOption}>
            <View style={styles.purchaseInfo}>
              <Text style={styles.purchaseTitle}>1 Project</Text>
              <Text style={styles.purchaseSubtitle}>Unlock one project</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>$4.99</Text>
            </View>
          </View>
          
          <View style={styles.purchaseOption}>
            <View style={styles.purchaseInfo}>
              <Text style={styles.purchaseTitle}>4 Projects</Text>
              <Text style={styles.purchaseSubtitle}>Best value</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>$14.99</Text>
            </View>
          </View>
          
          <View style={styles.purchaseOption}>
            <View style={styles.purchaseInfo}>
              <Text style={styles.purchaseTitle}>10 Projects</Text>
              <Text style={styles.purchaseSubtitle}>For the pros</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>$29.99</Text>
            </View>
          </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  firstStatusCard: {
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 16,
    color: colors.text,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  sectionContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    fontSize: 16,
    color: colors.subtext,
    flex: 1,
    lineHeight: 22,
  },
  purchaseOption: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  purchaseInfo: {
    flex: 1,
  },
  purchaseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  purchaseSubtitle: {
    fontSize: 14,
    color: colors.subtext,
  },
  priceContainer: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.subtext,
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
    color: colors.subtext,
    textAlign: 'center',
  },
});