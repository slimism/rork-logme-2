import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { Calendar, Hourglass, Infinity, Tag } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useTokenStore } from '@/store/subscriptionStore';
import { useVoucherStore } from '@/store/voucherStore';
import { iapService, IAPProduct } from '@/services/iapService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/store/themeStore';

interface TokenPackage extends IAPProduct {
  originalPrice?: string;
  popular?: boolean;
  savings?: string;
}

export default function Store() {
  const { tokens, addTokens, getRemainingTrialLogs } = useTokenStore();
  const { darkMode } = useThemeStore();
  const { redeemVoucher, canUseDiscount } = useVoucherStore();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [products, setProducts] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [voucherCode, setVoucherCode] = useState('');
  const [showVoucher, setShowVoucher] = useState(false);

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

  const handleTestPurchase = (tokenCount: number, originalPrice?: number) => {
    const hasDiscount = canUseDiscount() && originalPrice;
    const discountedPrice = hasDiscount ? originalPrice! * 0.8 : originalPrice;
    
    Alert.alert(
      'Test Purchase',
      `Add ${tokenCount} token${tokenCount > 1 ? 's' : ''} for testing? (No payment required)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Tokens',
          onPress: () => {
            addTokens(tokenCount);
            Alert.alert(
              'Success!',
              `${tokenCount} token${tokenCount > 1 ? 's' : ''} added to your account.`
            );
          }
        }
      ]
    );
  };

  const handleRedeemVoucher = () => {
    if (!voucherCode.trim()) {
      Alert.alert('Error', 'Please enter a voucher code');
      return;
    }

    const result = redeemVoucher(voucherCode);
    
    if (result.success) {
      Alert.alert('Success!', result.message);
      setVoucherCode('');
      setShowVoucher(false);
    } else {
      Alert.alert('Error', result.message);
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
    <View style={[styles.container, darkMode && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, darkMode && styles.headerDark, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSpacer} />
        <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>Store</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        {/* Status Cards */}
        <View style={[styles.statusCard, styles.firstStatusCard, darkMode && styles.statusCardDark]}>
          <Text style={[styles.statusLabel, darkMode && styles.statusLabelDark]}>Remaining Tokens</Text>
          <Text style={[styles.statusValue, darkMode && styles.statusValueDark]}>{tokens}</Text>
        </View>

        <View style={[styles.statusCard, darkMode && styles.statusCardDark]}>
          <Text style={[styles.statusLabel, darkMode && styles.statusLabelDark]}>Trial Logs left</Text>
          <Text style={[styles.statusValue, darkMode && styles.statusValueDark]}>{getRemainingTrialLogs()}</Text>
        </View>

        {/* How Tokens Work */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>How Tokens Work</Text>
          
          <View style={styles.infoItem}>
            <Calendar size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={[styles.infoText, darkMode && styles.infoTextDark]}>Each token unlocks one project with unlimited logs.</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Hourglass size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={[styles.infoText, darkMode && styles.infoTextDark]}>The free trial includes 15 logs for a single project only.</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Infinity size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={[styles.infoText, darkMode && styles.infoTextDark]}>Tokens never expire and can be used anytime.</Text>
          </View>
        </View>

        {/* Purchase Vouchers Button */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity 
            style={[styles.voucherButton, darkMode && styles.voucherButtonDark]}
            onPress={() => setShowVoucher(!showVoucher)}
          >
            <Tag size={20} color={colors.primary} style={styles.voucherIcon} />
            <Text style={[styles.voucherButtonText, darkMode && styles.voucherButtonTextDark]}>
              {showVoucher ? 'Hide Voucher Code' : 'Have a Voucher Code?'}
            </Text>
          </TouchableOpacity>
          
          {showVoucher && (
            <View style={[styles.voucherInputContainer, darkMode && styles.voucherInputContainerDark]}>
              <TextInput
                style={[styles.voucherInput, darkMode && styles.voucherInputDark]}
                placeholder="Enter voucher code"
                placeholderTextColor={darkMode ? '#888' : '#aaa'}
                value={voucherCode}
                onChangeText={setVoucherCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity 
                style={[styles.redeemButton, darkMode && styles.redeemButtonDark]}
                onPress={handleRedeemVoucher}
              >
                <Text style={styles.redeemButtonText}>Redeem</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Purchase Credits */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>Purchase Tokens</Text>
          
          <TouchableOpacity 
            style={[styles.purchaseOption, darkMode && styles.purchaseOptionDark]}
            onPress={() => handleTestPurchase(1, 4.99)}
          >
            <View style={styles.purchaseInfo}>
              <Text style={[styles.purchaseTitle, darkMode && styles.purchaseTitleDark]}>1 Token</Text>
              <Text style={[styles.purchaseSubtitle, darkMode && styles.purchaseSubtitleDark]}>Unlock one project</Text>
            </View>
            <View style={styles.priceContainer}>
              {!canUseDiscount() && (
                <Text style={[styles.originalPrice, darkMode && styles.originalPriceDark]}>$4.99</Text>
              )}
              <Text style={styles.price}>
                {canUseDiscount() ? '$3.99' : '$4.99'}
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.purchaseOption, darkMode && styles.purchaseOptionDark]}
            onPress={() => handleTestPurchase(4, 14.99)}
          >
            <View style={styles.purchaseInfo}>
              <Text style={[styles.purchaseTitle, darkMode && styles.purchaseTitleDark]}>4 Tokens</Text>
              <Text style={[styles.purchaseSubtitle, darkMode && styles.purchaseSubtitleDark]}>Best value</Text>
            </View>
            <View style={styles.priceContainer}>
              {!canUseDiscount() && (
                <Text style={[styles.originalPrice, darkMode && styles.originalPriceDark]}>$14.99</Text>
              )}
              <Text style={styles.price}>
                {canUseDiscount() ? '$11.99' : '$14.99'}
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.purchaseOption, darkMode && styles.purchaseOptionDark]}
            onPress={() => handleTestPurchase(10, 29.99)}
          >
            <View style={styles.purchaseInfo}>
              <Text style={[styles.purchaseTitle, darkMode && styles.purchaseTitleDark]}>10 Tokens</Text>
              <Text style={[styles.purchaseSubtitle, darkMode && styles.purchaseSubtitleDark]}>For the pros</Text>
            </View>
            <View style={styles.priceContainer}>
              {!canUseDiscount() && (
                <Text style={[styles.originalPrice, darkMode && styles.originalPriceDark]}>$29.99</Text>
              )}
              <Text style={styles.price}>
                {canUseDiscount() ? '$23.99' : '$29.99'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

      {Platform.OS !== 'web' && (
        <TouchableOpacity style={[styles.restoreButton, darkMode && styles.restoreButtonDark]} onPress={handleRestorePurchases}>
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <Text style={[styles.footerText, darkMode && styles.footerTextDark]}>
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
  containerDark: {
    backgroundColor: '#1a1a1a',
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
  headerDark: {
    backgroundColor: '#2a2a2a',
    borderBottomColor: '#444',
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
  headerTitleDark: {
    color: '#ffffff',
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
  statusCardDark: {
    backgroundColor: '#2a2a2a',
    borderBottomColor: '#444',
  },
  firstStatusCard: {
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 16,
    color: colors.text,
  },
  statusLabelDark: {
    color: '#ffffff',
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  statusValueDark: {
    color: '#ffffff',
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
  sectionTitleDark: {
    color: '#ffffff',
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
  infoTextDark: {
    color: '#cccccc',
  },
  purchaseOption: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  purchaseOptionDark: {
    backgroundColor: '#2a2a2a',
  },
  purchaseInfo: {
    flex: 1,
  },
  purchaseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  purchaseTitleDark: {
    color: '#ffffff',
  },
  purchaseSubtitle: {
    fontSize: 13,
    color: colors.subtext,
  },
  purchaseSubtitleDark: {
    color: '#cccccc',
  },
  priceContainer: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  price: {
    fontSize: 15,
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
  restoreButtonDark: {
    borderColor: '#444',
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
  footerTextDark: {
    color: '#cccccc',
  },
  voucherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  voucherButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: colors.primary,
  },
  voucherIcon: {
    marginRight: 8,
  },
  voucherButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  voucherButtonTextDark: {
    color: colors.primary,
  },
  voucherInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  voucherInputContainerDark: {
    backgroundColor: 'transparent',
  },
  voucherInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voucherInputDark: {
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    borderColor: '#444',
  },
  redeemButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redeemButtonDark: {
    backgroundColor: colors.primary,
  },
  redeemButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  originalPrice: {
    fontSize: 13,
    color: colors.subtext,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  originalPriceDark: {
    color: '#888',
  },
});