import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Calendar, Hourglass, Infinity, Tag } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
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
  const colors = useColors();
  const { tokens, addTokens, getRemainingTrialLogs } = useTokenStore();
  const { darkMode } = useThemeStore();
  const { redeemVoucher, canUseDiscount, getDiscountPercentage } = useVoucherStore();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [products, setProducts] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [voucherCode, setVoucherCode] = useState('');
  const [showVoucher, setShowVoucher] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const voucherInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Scroll to voucher input when keyboard appears and voucher is shown
      if (showVoucher && voucherInputRef.current) {
        setTimeout(() => {
          voucherInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
            scrollViewRef.current?.scrollTo({ y: pageY - 100, animated: true });
          });
        }, 100);
      }
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [showVoucher]);

  const loadProducts = async () => {
    try {
      const iapProducts = await iapService.getProducts();
      
      if (iapProducts.length === 0) {
        // This could mean:
        // 1. Running in Expo Go (IAP not available)
        // 2. Products not configured in App Store Connect
        // 3. Network error
        console.warn('No IAP products available. If running in Expo Go, IAP requires a development build.');
        setLoading(false);
        return;
      }

      // Map IAP products to token packages
      // Filter out any products without valid productId
      const validProducts = iapProducts.filter(product => {
        if (!product.productId) {
          console.warn('Product missing productId, skipping:', product);
          return false;
        }
        return true;
      });
      
      // You can customize the popular badge and savings based on your product configuration
      const tokenPackages: TokenPackage[] = validProducts.map((product, index) => {
        // Determine which product should be marked as popular (typically the middle tier)
        const isPopular = index === Math.floor(validProducts.length / 2);
        
        return {
          ...product,
          popular: isPopular,
          // You can add originalPrice and savings if you have discount logic
        };
      });
      
      console.log('Loaded products:', tokenPackages.map(p => ({ productId: p.productId, title: p.title })));
      setProducts(tokenPackages);
    } catch (error) {
      console.error('Failed to load products:', error);
      Alert.alert(
        'Error',
        'Failed to load products. Please check your internet connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageItem: TokenPackage) => {
    // Validate productId before proceeding
    if (!packageItem?.productId) {
      console.error('Cannot purchase: productId is missing', packageItem);
      Alert.alert(
        'Purchase Error',
        'Product information is invalid. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert(
        'Purchase Not Available',
        'In-app purchases are not available on web. Please use the mobile app to purchase tokens.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log('Purchase initiated for product:', packageItem.productId);
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

  const getDiscountedPrice = (originalPrice: number): string => {
    if (!canUseDiscount()) {
      return originalPrice.toFixed(2);
    }
    const discountPercent = getDiscountPercentage();
    return (originalPrice * (1 - discountPercent / 100)).toFixed(2);
  };

  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Store</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollContainer} 
        contentContainerStyle={[styles.contentContainer, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.statusCard, styles.firstStatusCard]}>
          <Text style={styles.statusLabel}>Remaining Tokens</Text>
          <Text style={styles.statusValue}>{tokens}</Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Trial Logs left</Text>
          <Text style={styles.statusValue}>{getRemainingTrialLogs()}</Text>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>How Tokens Work</Text>
          
          <View style={styles.infoItem}>
            <Calendar size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>Each token unlocks one project with unlimited logs.</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Hourglass size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>The free trial includes 15 logs for a single project only.</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Infinity size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>Tokens never expire and can be used anytime.</Text>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <TouchableOpacity 
            style={styles.voucherButton}
            onPress={() => setShowVoucher(!showVoucher)}
          >
            <Tag size={20} color={colors.primary} style={styles.voucherIcon} />
            <Text style={styles.voucherButtonText}>
              {showVoucher ? 'Hide Voucher Code' : 'Have a Voucher Code?'}
            </Text>
          </TouchableOpacity>
          
          {showVoucher && (
            <View style={styles.voucherInputContainer}>
              <TextInput
                ref={voucherInputRef}
                style={styles.voucherInput}
                placeholder="Enter voucher code"
                placeholderTextColor={colors.subtext}
                value={voucherCode}
                onChangeText={setVoucherCode}
                autoCapitalize="characters"
                autoCorrect={false}
                onFocus={() => {
                  setTimeout(() => {
                    voucherInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
                      scrollViewRef.current?.scrollTo({ y: pageY - 100, animated: true });
                    });
                  }, 100);
                }}
              />
              <TouchableOpacity 
                style={styles.redeemButton}
                onPress={handleRedeemVoucher}
              >
                <Text style={styles.redeemButtonText}>Redeem</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Purchase Tokens</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading products...</Text>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                {Platform.OS === 'ios' 
                  ? 'IAP not available. To test purchases, create a development build using "npx expo run:ios" or EAS Build. IAP does not work in Expo Go.'
                  : 'In-app purchases are only available on iOS.'}
              </Text>
            </View>
          ) : (
            products
              .filter(packageItem => packageItem.productId) // Filter out any products without productId
              .map((packageItem, index) => (
                <TouchableOpacity
                  key={packageItem.productId || `product-${index}`}
                  style={[
                    styles.purchaseOption,
                    packageItem.popular && styles.popularOption
                  ]}
                  onPress={() => handlePurchase(packageItem)}
                  disabled={purchasing === packageItem.productId || !packageItem.productId}
                >
                  <View style={styles.purchaseInfo}>
                    <View style={styles.purchaseTitleRow}>
                      <Text style={styles.purchaseTitle}>{packageItem.title}</Text>
                      {packageItem.popular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>POPULAR</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.purchaseSubtitle}>{packageItem.description || `Unlock ${packageItem.tokens} project${packageItem.tokens > 1 ? 's' : ''}`}</Text>
                  </View>
                  <View style={styles.priceContainer}>
                    {packageItem.originalPrice && canUseDiscount() && (
                      <Text style={styles.originalPrice}>{packageItem.originalPrice}</Text>
                    )}
                    <Text style={styles.price}>
                      {packageItem.price}
                    </Text>
                    {purchasing === packageItem.productId && (
                      <Text style={styles.purchasingText}>Processing...</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
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
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  popularOption: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  purchaseInfo: {
    flex: 1,
  },
  purchaseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  purchaseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  popularBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
  },
  purchasingText: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 4,
  },
  purchaseSubtitle: {
    fontSize: 13,
    color: colors.subtext,
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
  voucherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
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
  voucherInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  voucherInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  redeemButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
});
