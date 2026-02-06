import { Platform } from 'react-native';

// Conditionally import react-native-iap - only available in development/production builds, not Expo Go
let RNIap: any = null;
try {
  const iapModule = require('react-native-iap');
  // Handle different export structures (default export vs named export)
  RNIap = iapModule.default || iapModule;

  // Debug: Log module structure if fetchProducts doesn't exist
  if (RNIap && typeof RNIap.fetchProducts !== 'function') {
    console.warn('RNIap.fetchProducts not found. Available methods:', Object.keys(RNIap || {}));
  }
} catch (error) {
  // react-native-iap not available (likely running in Expo Go)
  console.log('react-native-iap not available - running in Expo Go or module not installed');
}

export interface IAPProduct {
  productId: string;
  price: string;
  currency: string;
  title: string;
  description: string;
  tokens: number;
}

import { useTokenStore } from '@/store/subscriptionStore';

export interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
}

// ============================================================================
// IAP CONFIGURATION - App Store Connect product IDs
// ============================================================================
const PRODUCT_IDS: string[] = [
  'app.rork.logme.tokens.1',
  'app.rork.logme.tokens.4',
  'app.rork.logme.tokens.10',
];

// Map product IDs to token counts
// This mapping is used to determine how many tokens each product grants
const PRODUCT_TO_TOKEN_MAP: Record<string, number> = {
  'app.rork.logme.tokens.1': 1,
  'app.rork.logme.tokens.4': 4,
  'app.rork.logme.tokens.10': 10,
};
// ============================================================================

class IAPService {
  private initialized = false;
  private currentPurchaseProductId: string | null = null;
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;

  async initialize(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        console.log('IAP not available on web platform');
        return false;
      }

      if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        console.log('IAP only supported on iOS and Android');
        return false;
      }

      // Check if react-native-iap is available (not available in Expo Go)
      if (!RNIap) {
        console.warn(`react-native-iap not available. IAP requires a development build. Use "npx expo run:${Platform.OS}" or EAS Build.`);
        return false;
      }

      // Check if product IDs are configured
      if (PRODUCT_IDS.length === 0) {
        console.warn('No product IDs configured. Please add your product IDs in services/iapService.ts');
        return false;
      }

      // Initialize react-native-iap connection
      await RNIap.initConnection();

      this.initialized = true;
      console.log(`IAP Service initialized successfully for ${Platform.OS}`);

      // Start listening for transactions immediately after initialization
      this.startListening();

      return true;
    } catch (error) {
      console.error('Failed to initialize IAP service:', error);
      return false;
    }
  }

  startListening() {
    if (!RNIap) return;

    // Remove existing listeners if any
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }

    console.log('Starting global IAP transaction listeners');

    this.purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase: any) => {
      console.log('Global listener received purchase:', purchase);

      // If this is the purchase we are currently processing in purchaseProduct, let the local listener handle it
      if (this.currentPurchaseProductId && purchase.productId === this.currentPurchaseProductId) {
        console.log('Global listener ignoring current active purchase:', purchase.productId);
        return;
      }

      // Otherwise, this is an external transaction (offer code, unfinished transaction, etc.)
      console.log('Global listener processing external/unfinished purchase:', purchase.productId);
      await this.handleTransaction(purchase);
    });

    this.purchaseErrorSubscription = RNIap.purchaseErrorListener((error: any) => {
      console.log('Global listener received error:', error);
    });
  }

  async checkUnfinishedTransactions() {
    if (!this.initialized) await this.initialize();
    if (!RNIap) return;

    try {
      console.log('Checking for available purchases/unfinished transactions...');
      const purchases = await RNIap.getAvailablePurchases();
      console.log('Available purchases:', purchases);

      if (purchases && purchases.length > 0) {
        for (const purchase of purchases) {
          await this.handleTransaction(purchase);
        }
      }
    } catch (error) {
      console.error('Error checking unfinished transactions:', error);
    }
  }

  private async handleTransaction(purchase: any) {
    try {
      if (!purchase.productId) return;

      // Validate token mapping exists
      const tokens = this.getTokensForProduct(purchase.productId);
      if (tokens <= 0) {
        console.warn('Unknown product ID in transaction:', purchase.productId);
        return;
      }

      console.log(`Processing transaction for ${purchase.productId}, adding ${tokens} tokens`);

      // Add tokens to store
      useTokenStore.getState().addTokens(tokens);

      // Finish transaction
      await RNIap.finishTransaction({ purchase, isConsumable: true });
      console.log('Transaction finished successfully');

    } catch (error) {
      console.error('Error handling transaction:', error);
    }
  }

  async getProducts(): Promise<IAPProduct[]> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return [];
      }
    }

    if (Platform.OS === 'web' || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
      return [];
    }

    try {
      if (!RNIap) {
        console.warn('react-native-iap not available. IAP requires a development build.');
        return [];
      }

      // Check for fetchProducts method (getProducts was replaced in react-native-iap v14+)
      if (typeof RNIap.fetchProducts !== 'function') {
        console.error('RNIap.fetchProducts is not a function. Module structure:', {
          hasFetchProducts: 'fetchProducts' in RNIap,
          keys: Object.keys(RNIap),
          type: typeof RNIap.fetchProducts
        });
        return [];
      }

      if (PRODUCT_IDS.length === 0) {
        console.warn('No product IDs configured');
        return [];
      }

      // Fetch products from App Store (iOS) using StoreKit
      // On iOS builds, this exclusively uses Apple's App Store payment system
      // Note: fetchProducts replaced getProducts in react-native-iap v14+
      const products = await RNIap.fetchProducts({ skus: PRODUCT_IDS });

      console.log('Raw products from fetchProducts:', JSON.stringify(products, null, 2));

      // Map react-native-iap products to our IAPProduct format
      // Note: react-native-iap v14+ uses 'id' instead of 'productId'
      const mappedProducts = products
        .filter((product: any) => {
          // Filter out products without id (react-native-iap v14+ uses 'id' not 'productId')
          const productIdentifier = product.id || product.productId;
          if (!productIdentifier) {
            console.warn('Product missing id/productId, skipping:', product);
            return false;
          }
          return true;
        })
        .map((product: any) => {
          // react-native-iap v14+ uses 'id' instead of 'productId'
          const productIdentifier = product.id || product.productId;

          // Get the raw price value (use price or parse displayPrice)
          const rawPrice = product.price || (product.displayPrice ? parseFloat(product.displayPrice.replace(/[^0-9.-]/g, '')) : 0);

          // Clean the product title by removing everything in parentheses
          let cleanTitle = product.title || product.displayName || productIdentifier;
          // Remove all content in parentheses (including nested parentheses)
          cleanTitle = cleanTitle.replace(/\s*\([^)]*(\([^)]*\))*[^)]*\)\s*/g, '').trim();
          // Remove any trailing closing parentheses or opening parentheses that might remain
          cleanTitle = cleanTitle.replace(/\)\s*$/g, '').replace(/^\s*\(/g, '').trim();
          // Remove any standalone parentheses
          cleanTitle = cleanTitle.replace(/\s*[()]\s*/g, ' ').trim();

          const mappedProduct = {
            productId: productIdentifier, // Map 'id' to 'productId' for our interface
            price: this.formatPrice(rawPrice),
            currency: product.currency || 'USD',
            title: cleanTitle,
            description: product.description || '',
            tokens: this.getTokensForProduct(productIdentifier),
          };

          console.log('Mapped product:', { productId: mappedProduct.productId, title: mappedProduct.title });
          return mappedProduct;
        });

      return mappedProducts;
    } catch (error) {
      console.error('Failed to fetch products:', error);
      return [];
    }
  }

  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'IAP service not initialized',
        };
      }
    }

    if (Platform.OS === 'web') {
      return {
        success: false,
        error: 'In-app purchases are not available on web platform',
      };
    }

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return {
        success: false,
        error: 'In-app purchases are only available on iOS and Android',
      };
    }

    if (!RNIap) {
      return {
        success: false,
        error: `IAP requires a development build. Use "npx expo run:${Platform.OS}" or EAS Build to test purchases.`,
      };
    }

    try {
      // Validate productId
      if (!productId || typeof productId !== 'string') {
        console.error('Invalid productId provided for purchase:', productId);
        return {
          success: false,
          error: 'Invalid product ID',
        };
      }

      console.log(`Attempting to purchase product: ${productId}`);
      this.currentPurchaseProductId = productId;

      // Set up purchase listener before initiating purchase
      return new Promise<PurchaseResult>((resolve) => {
        const purchaseUpdateListener = RNIap.purchaseUpdatedListener((purchase: any) => {
          purchaseUpdateListener.remove();
          purchaseErrorListener.remove();

          if (purchase.productId === productId) {
            RNIap.finishTransaction({ purchase, isConsumable: true });

            this.currentPurchaseProductId = null;
            resolve({
              success: true,
              productId: purchase.productId,
              transactionId: purchase.transactionId || purchase.transactionReceipt,
            });
          }
        });

        // Handle purchase errors
        const purchaseErrorListener = RNIap.purchaseErrorListener((error: any) => {
          purchaseErrorListener.remove();
          purchaseUpdateListener.remove();

          let errorMessage = 'Purchase failed';
          if (error.code === 'E_USER_CANCELLED') {
            errorMessage = 'Purchase was canceled';
          } else if (error.message) {
            errorMessage = error.message;
          }

          resolve({
            success: false,
            error: errorMessage,
          });
          this.currentPurchaseProductId = null;
        });

        // Initiate purchase - react-native-iap v14+ format
        // The correct format requires a 'request' wrapper with platform-specific props and 'type' field
        const purchaseConfig = {
          request: Platform.OS === 'ios'
            ? {
              ios: {
                sku: productId,
              },
            }
            : {
              android: {
                skus: [productId],
              },
            },
          type: 'in-app' as const,
        };

        console.log('Purchase config:', JSON.stringify(purchaseConfig, null, 2));

        RNIap.requestPurchase(purchaseConfig).catch((error: any) => {
          purchaseErrorListener.remove();
          purchaseUpdateListener.remove();

          resolve({
            success: false,
            error: error.message || 'Purchase failed',
          });
          this.currentPurchaseProductId = null;
        });

        // Timeout after 60 seconds
        setTimeout(() => {
          purchaseUpdateListener.remove();
          purchaseErrorListener.remove();
          resolve({
            success: false,
            error: 'Purchase timeout',
          });
        }, 60000);
        // Note: we don't clear currentPurchaseProductId on timeout immediately effectively, 
        // as the transaction might still come in later.
      });
    } catch (error) {
      console.error('Purchase failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed',
      };
    }
  }

  getTokensForProduct(productId: string): number {
    // Get token count from the mapping
    return PRODUCT_TO_TOKEN_MAP[productId] || 0;
  }

  /**
   * Format price to 2 decimal places
   * Handles both string and number inputs
   * Preserves currency symbols if present in the input string
   */
  private formatPrice(price: string | number | undefined): string {
    if (price === undefined || price === null) {
      return '0.00';
    }

    let numericValue: number;
    let currencyPrefix = '';
    let currencySuffix = '';

    // Convert to number if it's a string
    if (typeof price === 'string') {
      // Check if string contains currency symbols at the start
      const currencyMatch = price.trim().match(/^([\$€£¥₹])\s*(.+)$/);
      if (currencyMatch) {
        currencyPrefix = currencyMatch[1] + ' ';
        price = currencyMatch[2];
      }

      // Extract numeric value from string
      numericValue = parseFloat(price.replace(/[^0-9.-]/g, ''));
      if (isNaN(numericValue)) {
        return '0.00';
      }
    } else {
      numericValue = price;
    }

    // Format to 2 decimal places and add currency prefix if it existed
    return currencyPrefix + numericValue.toFixed(2);
  }
}

export const iapService = new IAPService();